"""Run the bounded, approved S4 API operator P95 verification.

The command is deliberately narrow: it can measure only the three approved
GET routes, and it cannot make a real request unless ``--execute`` and the
literal operator confirmation are both supplied.  Results are aggregate-only.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import platform
import re
import ssl
import sys
import threading
import time
from collections import Counter
from collections.abc import Callable
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from datetime import UTC, date, datetime, timedelta
from http import HTTPStatus
from http.client import HTTPConnection, HTTPResponse, HTTPSConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urlsplit

TOOL_VERSION = "api-p95-measurement-v1"
EXPECTED_REVISION = "bp7-api-00014-jeq"
EXPECTED_ENVIRONMENT = "production"
EXPECTED_SERVICE = "bp7-api"
SAMPLES_PER_CONDITION = 100
CONCURRENCIES = (1, 4)
WARMUP_COUNT = 1
TIMEOUT_SECONDS = 8.0
TIMEOUT_BUDGET_MS = TIMEOUT_SECONDS * 1000
P95_THRESHOLD_MS = 3000.0
WINDOW_TOKEN_ENV = "SK7_P95_BEARER_TOKEN"
WINDOW_START_ENV = "SK7_P95_START_ON"
WINDOW_END_ENV = "SK7_P95_END_ON"
CONFIRMATION = "I_UNDERSTAND_OPERATOR_VERIFICATION_NO_PRODUCTION_LOAD_TEST"

ENDPOINTS: dict[str, tuple[str, int]] = {
    "live": ("/live", 200),
    "ready": ("/ready", 200),
    "window": ("/api/v1/observations/window", 200),
}
ALLOWED_METHOD = "GET"
RUNNER_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")


class ToolError(Exception):
    """A safe, user-facing validation or measurement error."""


def percentile_type7(values: list[float], probability: float) -> float:
    """Return Hyndman–Fan type 7: linear interpolation at (n - 1) * p."""

    if not values or not 0 <= probability <= 1:
        raise ValueError("percentile requires non-empty values and p in [0, 1]")
    if any(not math.isfinite(value) or value < 0 for value in values):
        raise ValueError("latency values must be finite and non-negative")
    ordered = sorted(values)
    position = (len(ordered) - 1) * probability
    lower = math.floor(position)
    upper = math.ceil(position)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def validate_date_range(start_text: str, end_text: str) -> tuple[date, date]:
    """Validate an inclusive, at-most-seven-calendar-day observation window."""

    try:
        start = date.fromisoformat(start_text)
        end = date.fromisoformat(end_text)
    except (TypeError, ValueError) as error:
        raise ToolError("window dates must use ISO YYYY-MM-DD") from error
    if start > end:
        raise ToolError("window start date must not be after end date")
    if end - start > timedelta(days=6):
        raise ToolError("window date range must be at most seven inclusive days")
    return start, end


def validate_runner_label(label: str) -> str:
    if not RUNNER_PATTERN.fullmatch(label):
        raise ToolError("runner label must be 1-80 ASCII letters, digits, dot, underscore, or hyphen")
    return label


def validate_base_url(base_url: str, *, allow_loopback: bool) -> tuple[str, str, int | None]:
    try:
        parsed = urlsplit(base_url)
        parsed_port = parsed.port
    except ValueError as error:
        raise ToolError("base URL is malformed") from error
    if parsed.scheme != "https" and not (allow_loopback and parsed.scheme == "http"):
        raise ToolError("real execution requires an HTTPS base URL")
    if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ToolError("base URL must have no credentials, query, or fragment")
    if parsed.path not in ("", "/"):
        raise ToolError("base URL must not contain a path")
    hostname = parsed.hostname.lower()
    if not allow_loopback and hostname in {"localhost", "127.0.0.1", "::1"}:
        raise ToolError("localhost is available only to --self-test")
    if allow_loopback and hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ToolError("self-test accepts only a loopback base URL")
    if parsed_port is not None and not 1 <= parsed_port <= 65535:
        raise ToolError("base URL port is invalid")
    origin = f"{parsed.scheme}://{parsed.netloc}"
    return origin, hostname, parsed.port


def endpoint_target(label: str, dates: tuple[date, date] | None) -> str:
    if label not in ENDPOINTS:
        raise ToolError("endpoint is outside the approved allowlist")
    path, _ = ENDPOINTS[label]
    if label != "window":
        return path
    if dates is None:
        raise ToolError("window date range is required")
    return f"{path}?{urlencode({'start_on': dates[0].isoformat(), 'end_on': dates[1].isoformat()})}"


class RequestClient:
    """One connection per worker thread, with no retry or redirect behavior."""

    def __init__(self, origin: str, hostname: str, port: int | None, *, loopback: bool = False):
        self.origin = origin
        self.hostname = hostname
        self.port = port
        self.loopback = loopback
        self.local = threading.local()
        self.ssl_context = ssl.create_default_context() if not loopback else None

    def _connection(self) -> HTTPConnection | HTTPSConnection:
        connection = getattr(self.local, "connection", None)
        if connection is None:
            if self.loopback:
                connection = HTTPConnection(self.hostname, self.port, timeout=TIMEOUT_SECONDS)
            else:
                connection = HTTPSConnection(
                    self.hostname,
                    self.port or 443,
                    timeout=TIMEOUT_SECONDS,
                    context=self.ssl_context,
                )
            self.local.connection = connection
        return connection

    def get(self, target: str, token: str | None) -> tuple[int, float, str | None]:
        headers = {"Accept": "application/json", "Connection": "keep-alive"}
        if token is not None:
            headers["Authorization"] = f"Bearer {token}"
        started_ns = time.perf_counter_ns()
        connection = self._connection()
        try:
            connection.request(ALLOWED_METHOD, target, headers=headers)
            response: HTTPResponse = connection.getresponse()
            response.read()
            elapsed_ms = (time.perf_counter_ns() - started_ns) / 1_000_000
            return response.status, elapsed_ms, None
        except Exception as error:  # transport errors are aggregate-only and never expose exception text
            elapsed_ms = (time.perf_counter_ns() - started_ns) / 1_000_000
            try:
                connection.close()
            finally:
                self.local.connection = None
            return 0, elapsed_ms, type(error).__name__


def classify_sample(sample: tuple[int, float, str | None]) -> tuple[int, float, str | None]:
    """Apply the end-to-end timeout boundary without exposing internal labels."""

    status, elapsed_ms, error = sample
    if elapsed_ms > TIMEOUT_BUDGET_MS:
        return status, elapsed_ms, "TimeoutError"
    return status, elapsed_ms, error


def summarize(samples: list[tuple[int, float, str | None]], expected_status: int, concurrency: int) -> dict[str, Any]:
    if not samples:
        raise ToolError("no measured samples were collected")
    samples = [classify_sample(sample) for sample in samples]
    latencies = [sample[1] for sample in samples]
    status_counts = dict(sorted(Counter(str(sample[0]) for sample in samples).items()))
    error_count = sum(status != expected_status or error is not None for status, _, error in samples)
    transport_error_count = status_counts.get("0", 0)
    p50 = percentile_type7(latencies, 0.50)
    p95 = percentile_type7(latencies, 0.95)
    return {
        "concurrency": concurrency,
        "n": len(samples),
        "expected_status": expected_status,
        "status_counts": status_counts,
        "error_count": error_count,
        "transport_error_count": transport_error_count,
        "p50_ms": round(p50, 6),
        "p95_ms": round(p95, 6),
        "max_ms": round(max(latencies), 6),
        "pass": len(samples) == SAMPLES_PER_CONDITION and error_count == 0 and p95 <= P95_THRESHOLD_MS,
    }


def measure_condition(
    call: Callable[[], tuple[int, float, str | None]],
    expected_status: int,
    concurrency: int,
) -> tuple[dict[str, Any], bool]:
    """Collect at most n samples, stopping launches after the first failure."""

    samples: list[tuple[int, float, str | None]] = []
    futures: set[Future[tuple[int, float, str | None]]] = set()
    next_sample = 0
    stop = False
    with ThreadPoolExecutor(max_workers=concurrency, thread_name_prefix="p95") as pool:
        while next_sample < SAMPLES_PER_CONDITION and len(futures) < concurrency:
            futures.add(pool.submit(call))
            next_sample += 1
        while futures:
            done, futures = wait(futures, return_when=FIRST_COMPLETED)
            for future in done:
                sample = classify_sample(future.result())
                samples.append(sample)
                if sample[0] != expected_status or sample[2] is not None:
                    stop = True
            if stop:
                continue
            while next_sample < SAMPLES_PER_CONDITION and len(futures) < concurrency:
                futures.add(pool.submit(call))
                next_sample += 1
    result = summarize(samples, expected_status, concurrency)
    return result, not stop and len(samples) == SAMPLES_PER_CONDITION


def measure_endpoint_condition(
    client: RequestClient,
    endpoint: str,
    target: str,
    token: str | None,
    expected_status: int,
    concurrency: int,
) -> tuple[dict[str, Any], bool]:
    warmup_status, _, _ = client.get(target, token)
    if warmup_status != expected_status:
        return (
            {
                "endpoint": endpoint,
                "concurrency": concurrency,
                "n": 0,
                "expected_status": expected_status,
                "status_counts": {str(warmup_status): 1},
                "error_count": 1,
                "transport_error_count": int(warmup_status == 0),
                "pass": False,
            },
            False,
        )
    result, condition_ok = measure_condition(lambda: client.get(target, token), expected_status, concurrency)
    result["endpoint"] = endpoint
    return result, condition_ok


def make_aggregate(
    *, runner_label: str, results: list[dict[str, Any]], status: str, started: str, ended: str
) -> dict[str, Any]:
    return {
        "schema_version": "s4-api-p95-evidence-v1",
        "status": status,
        "scope": "operator_verification_not_client_acceptance",
        "target": {
            "environment": EXPECTED_ENVIRONMENT,
            "service": EXPECTED_SERVICE,
            "expected_revision": EXPECTED_REVISION,
        },
        "criterion": {"p95_ms": P95_THRESHOLD_MS, "percentile": "Hyndman-Fan type 7"},
        "method": {
            "warm_only": True,
            "samples_per_condition": SAMPLES_PER_CONDITION,
            "concurrency": list(CONCURRENCIES),
            "warmup_per_condition": WARMUP_COUNT,
            "timeout_seconds": TIMEOUT_SECONDS,
            "retry": False,
            "redirects": False,
            "timer": "perf_counter_ns; request start through full response body read",
            "arrival": "closed-loop",
            "connections": "one reusable HTTP connection per worker thread; at most c in-flight",
            "raw_samples_retained": False,
            "request_bodies_retained": False,
            "response_bodies_retained": False,
        },
        "runner": {"label": runner_label, "os_family": platform.system(), "python": platform.python_version()},
        "run_window": {"started_at": started, "ended_at": ended},
        "tool": {"name": "scripts/ops/measure_api_p95.py", "version": TOOL_VERSION},
        "results": results,
    }


def write_aggregate(path: Path, aggregate: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(json.dumps(aggregate, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def read_window_config() -> tuple[str, tuple[date, date]]:
    token = os.environ.get(WINDOW_TOKEN_ENV)
    if not token:
        raise ToolError(f"missing {WINDOW_TOKEN_ENV} for the approved window endpoint")
    start_text = os.environ.get(WINDOW_START_ENV)
    end_text = os.environ.get(WINDOW_END_ENV)
    if not start_text or not end_text:
        raise ToolError(f"missing {WINDOW_START_ENV} or {WINDOW_END_ENV}")
    return token, validate_date_range(start_text, end_text)


def execute(args: argparse.Namespace) -> int:  # noqa: C901
    if args.confirm_operator_verification != CONFIRMATION:
        raise ToolError("the literal operator confirmation is required for --execute")
    if args.expected_revision != EXPECTED_REVISION:
        raise ToolError("expected revision does not match the approved production target")
    if not args.output:
        raise ToolError("--output is required for --execute")
    runner_label = validate_runner_label(args.runner_label)
    origin, hostname, port = validate_base_url(args.base_url, allow_loopback=False)
    token, dates = read_window_config()
    client = RequestClient(origin, hostname, port)
    started = datetime.now(UTC).isoformat()
    results: list[dict[str, Any]] = []
    run_ok = True
    try:
        for label in ENDPOINTS:
            target = endpoint_target(label, dates if label == "window" else None)
            endpoint_token = token if label == "window" else None
            for concurrency in CONCURRENCIES:
                result, condition_ok = measure_endpoint_condition(
                    client,
                    label,
                    target,
                    endpoint_token,
                    ENDPOINTS[label][1],
                    concurrency,
                )
                results.append(result)
                if not condition_ok:
                    run_ok = False
                    break
            if not run_ok:
                break
    except KeyboardInterrupt:
        run_ok = False
    finally:
        ended = datetime.now(UTC).isoformat()
        aggregate = make_aggregate(
            runner_label=runner_label,
            results=results,
            status="passed" if run_ok and len(results) == 6 else "failed",
            started=started,
            ended=ended,
        )
        write_aggregate(args.output, aggregate)
    if not run_ok:
        print("operator verification stopped; failed aggregate written", file=sys.stderr)
        return 1
    print(f"aggregate evidence written: {args.output}")
    return 0


class _MockHandler(BaseHTTPRequestHandler):
    """Local-only test server that records headers, not bodies."""

    requests: list[tuple[str, str, dict[str, str]]] = []
    in_flight = 0
    max_in_flight = 0
    lock = threading.Lock()
    mode = "ok"

    def do_GET(self) -> None:  # noqa: N802
        with self.lock:
            type(self).requests.append(
                (self.command, self.path, {key.lower(): value for key, value in self.headers.items()})
            )
            type(self).in_flight += 1
            type(self).max_in_flight = max(type(self).max_in_flight, type(self).in_flight)
        try:
            if type(self).mode == "redirect":
                self.send_response(HTTPStatus.FOUND)
                self.send_header("Location", "/live")
                self.end_headers()
                return
            if type(self).mode == "429" and self.path == "/live":
                status = HTTPStatus.TOO_MANY_REQUESTS
            elif type(self).mode == "500" and self.path == "/live":
                status = HTTPStatus.INTERNAL_SERVER_ERROR
            else:
                status = HTTPStatus.OK
            if type(self).mode == "timeout" and self.path == "/live":
                time.sleep(0.05)
            body = b"discarded mock body"
            self.send_response(status)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        finally:
            with self.lock:
                type(self).in_flight -= 1

    def log_message(self, *_args: Any) -> None:
        return


class _MockServer:
    def __enter__(self) -> tuple[str, type[_MockHandler]]:
        _MockHandler.requests = []
        _MockHandler.in_flight = 0
        _MockHandler.max_in_flight = 0
        _MockHandler.mode = "ok"
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), _MockHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        return f"http://127.0.0.1:{self.server.server_port}", _MockHandler

    def __exit__(self, *_args: Any) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)


def _self_test() -> None:  # noqa: C901
    """Exercise safety, arithmetic, bounded scheduling, and local HTTP semantics."""

    assert math.isclose(percentile_type7([0, 10, 20, 30], 0.95), 28.5)
    assert percentile_type7([0, 3000], 0.95) == 2850.0
    assert percentile_type7([3000], 0.95) == 3000
    for bad in ([], [float("nan")], [float("inf")], [-1]):
        try:
            percentile_type7(bad, 0.95)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid percentile input accepted")
    assert validate_date_range("2026-01-01", "2026-01-07")[0].isoformat() == "2026-01-01"
    for dates in (("bad", "2026-01-01"), ("2026-01-02", "2026-01-01"), ("2026-01-01", "2026-01-08")):
        try:
            validate_date_range(*dates)
        except ToolError:
            pass
        else:
            raise AssertionError("invalid date range accepted")
    saved_window_env = {key: os.environ.get(key) for key in (WINDOW_TOKEN_ENV, WINDOW_START_ENV, WINDOW_END_ENV)}
    try:
        for key in saved_window_env:
            os.environ.pop(key, None)
        try:
            read_window_config()
        except ToolError:
            pass
        else:
            raise AssertionError("missing bearer token accepted")
    finally:
        for key, value in saved_window_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
    for base in ("https://example.test?x=1", "https://user:pass@example.test", "http://127.0.0.1:1"):
        try:
            validate_base_url(base, allow_loopback=False)
        except ToolError:
            pass
        else:
            raise AssertionError("unsafe base URL accepted")
    for label in ("export", "risk-signal", "POST /live"):
        try:
            endpoint_target(label, None)
        except ToolError:
            pass
        else:
            raise AssertionError("endpoint allowlist bypass")
    with _MockServer() as (base_url, handler):
        origin, hostname, port = validate_base_url(base_url, allow_loopback=True)
        client = RequestClient(origin, hostname, port, loopback=True)
        assert client.get(endpoint_target("live", None), None)[0] == 200
        assert client.get(endpoint_target("ready", None), None)[0] == 200
        assert client.get(endpoint_target("window", (date(2026, 1, 1), date(2026, 1, 7))), "local-test-token")[0] == 200
        assert all(path != "/api/v1/observations/export" for _, path, _ in handler.requests)
        assert "authorization" not in handler.requests[0][2]
        assert "authorization" not in handler.requests[1][2]
        assert handler.requests[2][2]["authorization"] == "Bearer local-test-token"
        handler.mode = "redirect"
        redirect_result, redirect_ok = measure_condition(lambda: client.get("/live", None), 200, 1)
        assert not redirect_ok and redirect_result["status_counts"] == {"302": 1}
        handler.mode = "ok"
        before_warmup = len(handler.requests)
        result, ok = measure_endpoint_condition(client, "live", "/live", None, 200, 1)
        assert ok and result["n"] == 100 and len(handler.requests) - before_warmup == WARMUP_COUNT + 100
        result, ok = measure_condition(lambda: client.get("/live", None), 200, 4)
        assert ok and result["n"] == 100 and handler.max_in_flight <= 4
        assert result["pass"]
        result, ok = measure_condition(lambda: client.get("/live", None), 200, 1)
        assert ok and result["n"] == 100 and result["concurrency"] == 1
        exact_pass = summarize([(200, 3000.0, None)] * 100, 200, 1)
        exact_fail = summarize([(200, 3000.0001, None)] * 100, 200, 1)
        assert exact_pass["p95_ms"] == 3000.0 and exact_pass["pass"]
        assert exact_fail["p95_ms"] > 3000.0 and not exact_fail["pass"]
        timeout_boundary_pass = summarize([(200, TIMEOUT_BUDGET_MS, None)] * 100, 200, 1)
        assert timeout_boundary_pass["error_count"] == 0
        assert timeout_boundary_pass["transport_error_count"] == 0
        assert not timeout_boundary_pass["pass"]  # P95 failure is separate from timeout classification.
        assert classify_sample((200, TIMEOUT_BUDGET_MS, None)) == (200, TIMEOUT_BUDGET_MS, None)
        timeout_over_boundary = classify_sample((200, TIMEOUT_BUDGET_MS + 0.0001, None))
        assert timeout_over_boundary == (200, TIMEOUT_BUDGET_MS + 0.0001, "TimeoutError")
        result, ok = measure_condition(lambda: (200, TIMEOUT_BUDGET_MS + 0.0001, None), 200, 1)
        assert not ok and result["n"] == 1 and result["status_counts"] == {"200": 1}
        assert result["error_count"] == 1 and result["transport_error_count"] == 0
        handler.mode = "429"
        result, ok = measure_condition(lambda: client.get("/live", None), 200, 4)
        assert not ok and result["n"] <= 4 and result["status_counts"].get("429", 0) >= 1
        handler.mode = "500"
        result, ok = measure_condition(lambda: client.get("/live", None), 200, 1)
        assert not ok and not result["pass"]
        timeout_result, timeout_ok = measure_condition(lambda: (0, TIMEOUT_SECONDS * 1000, "TimeoutError"), 200, 1)
        assert not timeout_ok and timeout_result["transport_error_count"] == 1
    aggregate_text = json.dumps(
        make_aggregate(runner_label="self-test", results=[], status="failed", started="a", ended="b")
    )
    assert "local-test-token" not in aggregate_text


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="validate command shape without making a request")
    mode.add_argument("--self-test", action="store_true", help="run localhost-only safety and arithmetic tests")
    mode.add_argument("--execute", action="store_true", help="run the explicitly confirmed operator verification")
    parser.add_argument("--base-url")
    parser.add_argument("--expected-revision")
    parser.add_argument("--runner-label")
    parser.add_argument("--confirm-operator-verification")
    parser.add_argument("--output", type=Path)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.self_test:
            _self_test()
            print("API P95 measurement self-test passed (localhost mock only)")
            return 0
        if args.dry_run:
            if any(
                value is not None
                for value in (
                    args.base_url,
                    args.expected_revision,
                    args.runner_label,
                    args.confirm_operator_verification,
                    args.output,
                )
            ):
                raise ToolError("--dry-run accepts no execution arguments")
            print("dry-run: 0 network requests; no production target was contacted")
            return 0
        if not args.base_url or not args.expected_revision or not args.runner_label:
            raise ToolError("--execute requires --base-url, --expected-revision, and --runner-label")
        return execute(args)
    except KeyboardInterrupt:
        print("operator interruption; no passing evidence was produced", file=sys.stderr)
        return 130
    except ToolError as error:
        print(f"measurement refused: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
