from __future__ import annotations

import argparse
import asyncio
import json
import math
import os
import signal
import socket
import subprocess
import sys
import threading
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import httpx

BROWSER_ATTEMPT_DEADLINE_S = 8.0
AUTH_PATH = "/auth/v1/user"
BP_PATH = "/rest/v1/blood_pressure_observations"
LEGACY_PATH = "/rest/v1/challenge_events"
CHALLENGE_RPC_PATH = "/rest/v1/rpc/get_owned_challenge_window"


def utc() -> str:
    return datetime.now(UTC).isoformat()


def percentile(values: list[float], probability: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = (len(ordered) - 1) * probability
    low = math.floor(index)
    high = math.ceil(index)
    return ordered[low] + (ordered[high] - ordered[low]) * (index - low)


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@dataclass(frozen=True)
class Scenario:
    name: str
    auth_delay_s: float = 0.0
    data_delay_s: float = 0.0
    path_delay_s: dict[str, float] = field(default_factory=dict)

    def delay_for(self, path: str) -> float:
        if path.startswith(AUTH_PATH):
            return self.auth_delay_s
        for prefix, delay in self.path_delay_s.items():
            if path.startswith(prefix):
                return delay
        if path.startswith("/rest/v1/"):
            return self.data_delay_s
        return 0.0


SCENARIOS = (
    Scenario("control"),
    Scenario("auth-3s", auth_delay_s=3.0),
    Scenario("data-3s", data_delay_s=3.0),
    Scenario("auth3-data3", auth_delay_s=3.0, data_delay_s=3.0),
    Scenario("auth4-data4", auth_delay_s=4.0, data_delay_s=4.0),
    Scenario("auth4.5-data4.5", auth_delay_s=4.5, data_delay_s=4.5),
    Scenario("one-fanin-4.5s", path_delay_s={CHALLENGE_RPC_PATH: 4.5}),
    Scenario("one-fanin-5.2s", path_delay_s={CHALLENGE_RPC_PATH: 5.2}),
)


class DependencyState:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.scenario = SCENARIOS[0]
        self.calls: Counter[str] = Counter()
        self.active = 0
        self.peak_active = 0

    def set_scenario(self, scenario: Scenario) -> None:
        with self._lock:
            if self.active:
                raise RuntimeError("dependency calls still active before scenario switch")
            self.scenario = scenario
            self.calls = Counter()
            self.peak_active = 0

    def begin(self, path: str) -> tuple[Scenario, str]:
        with self._lock:
            scenario = self.scenario
            kind = "auth" if path.startswith(AUTH_PATH) else "data" if path.startswith("/rest/v1/") else "other"
            self.calls[kind] += 1
            if path.startswith(BP_PATH):
                self.calls["data:blood_pressure"] += 1
            elif path.startswith(LEGACY_PATH):
                self.calls["data:challenge_events"] += 1
            elif path.startswith(CHALLENGE_RPC_PATH):
                self.calls["data:challenge_window_rpc"] += 1
            else:
                self.calls[f"path:{path.split('?', 1)[0]}"] += 1
            self.active += 1
            self.peak_active = max(self.peak_active, self.active)
            return scenario, kind

    def end(self) -> None:
        with self._lock:
            self.active -= 1

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "calls": dict(self.calls),
                "active": self.active,
                "peak_active": self.peak_active,
            }


class DependencyHandler(BaseHTTPRequestHandler):
    server_version = "SK7DeadlineDependency/1"
    protocol_version = "HTTP/1.1"

    @property
    def state(self) -> DependencyState:
        return self.server.state  # type: ignore[attr-defined]

    def log_message(self, fmt: str, *args: object) -> None:
        return

    def _consume_body(self) -> None:
        length = int(self.headers.get("content-length", "0") or "0")
        if length:
            self.rfile.read(length)

    def _send_json(self, status: int, payload: object) -> None:
        raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(raw)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            self.close_connection = True

    def _handle(self) -> None:
        path = self.path
        scenario, _kind = self.state.begin(path)
        try:
            self._consume_body()
            delay = scenario.delay_for(path)
            if delay:
                time.sleep(delay)

            if path.startswith(AUTH_PATH):
                self._send_json(200, {"id": "synthetic-user"})
                return
            if path.startswith(BP_PATH) or path.startswith(LEGACY_PATH):
                self._send_json(200, [])
                return
            if path.startswith(CHALLENGE_RPC_PATH):
                self._send_json(200, {"active_challenge": None, "challenge_checkins": []})
                return
            self._send_json(404, {"detail": "synthetic_dependency_path_not_found"})
        finally:
            self.state.end()

    def do_GET(self) -> None:
        self._handle()

    def do_POST(self) -> None:
        self._handle()


class DependencyServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address: tuple[str, int], state: DependencyState):
        super().__init__(address, DependencyHandler)
        self.state = state


def safe_env() -> dict[str, str]:
    allowed = {
        "PATH",
        "HOME",
        "USERPROFILE",
        "TMP",
        "TEMP",
        "TMPDIR",
        "LANG",
        "LC_ALL",
        "PYTHONUTF8",
        "SYSTEMROOT",
        "WINDIR",
        "COMSPEC",
        "PATHEXT",
    }
    env = {key: value for key, value in os.environ.items() if key.upper() in allowed}
    env["PYTHONUTF8"] = "1"
    env["ENABLE_LEGACY_MYSQL"] = "false"
    env["HTTP_PROXY"] = ""
    env["HTTPS_PROXY"] = ""
    env["ALL_PROXY"] = ""
    env["NO_PROXY"] = "127.0.0.1,localhost"
    return env


async def wait_api_ready(api: str, process: subprocess.Popen[bytes]) -> None:
    async with httpx.AsyncClient(timeout=1.0, trust_env=False) as client:
        for _ in range(100):
            if process.poll() is not None:
                raise RuntimeError("FastAPI process exited before readiness")
            try:
                response = await client.get(f"{api}/live")
                if response.status_code == 200:
                    return
            except httpx.HTTPError:
                pass
            await asyncio.sleep(0.1)
    raise RuntimeError("FastAPI readiness deadline exceeded")


async def wait_dependency_quiet(state: DependencyState, timeout_s: float = 6.0) -> None:
    deadline = time.monotonic() + timeout_s
    quiet_since: float | None = None
    while time.monotonic() < deadline:
        active = int(state.snapshot()["active"])
        now = time.monotonic()
        if active == 0:
            quiet_since = quiet_since or now
            if now - quiet_since >= 0.2:
                return
        else:
            quiet_since = None
        await asyncio.sleep(0.05)
    raise RuntimeError("synthetic dependency did not become quiet")


async def api_attempt(client: httpx.AsyncClient, api: str) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        response = await asyncio.wait_for(
            client.get(
                f"{api}/api/v1/observations/window",
                params={"start_on": "2026-09-01", "end_on": "2026-09-07"},
                headers={"Authorization": "Bearer synthetic-access-token"},
            ),
            timeout=BROWSER_ATTEMPT_DEADLINE_S,
        )
        elapsed_ms = (time.perf_counter() - started) * 1000
        code = None
        if response.status_code >= 400:
            try:
                payload = response.json()
                detail = payload.get("detail") if isinstance(payload, dict) else None
                code = detail.get("code") if isinstance(detail, dict) else None
            except ValueError:
                code = None
        return {
            "status": response.status_code,
            "code": code,
            "elapsed_ms": elapsed_ms,
            "timeout": False,
        }
    except TimeoutError:
        return {
            "status": 0,
            "code": "request_timeout",
            "elapsed_ms": (time.perf_counter() - started) * 1000,
            "timeout": True,
        }
    except httpx.HTTPError:
        return {
            "status": 0,
            "code": "network_error",
            "elapsed_ms": (time.perf_counter() - started) * 1000,
            "timeout": False,
        }


def retryable_initial_read(attempt: dict[str, Any]) -> bool:
    return (attempt["status"] == 0 and attempt["code"] in {"network_error", "request_timeout"}) or attempt[
        "status"
    ] in {502, 503, 504}


async def logical_initial_load(api: str, state: DependencyState) -> dict[str, Any]:
    started = time.perf_counter()
    before = state.snapshot()
    async with httpx.AsyncClient(timeout=None, trust_env=False) as client:
        attempts = [await api_attempt(client, api)]
        if retryable_initial_read(attempts[0]):
            attempts.append(await api_attempt(client, api))

    await wait_dependency_quiet(state)
    after = state.snapshot()
    elapsed_ms = (time.perf_counter() - started) * 1000

    calls_before = Counter(before["calls"])
    calls_after = Counter(after["calls"])
    calls = calls_after - calls_before
    final = attempts[-1]

    return {
        "status": final["status"],
        "code": final["code"],
        "elapsed_ms": elapsed_ms,
        "attempt_count": len(attempts),
        "retry_count": len(attempts) - 1,
        "attempts": attempts,
        "upstream_calls": dict(calls),
        "peak_dependency_concurrency": after["peak_active"],
    }


def summarize_scenario(name: str, samples: list[dict[str, Any]]) -> dict[str, Any]:
    latencies = [float(sample["elapsed_ms"]) for sample in samples]
    attempt_latencies = [float(attempt["elapsed_ms"]) for sample in samples for attempt in sample["attempts"]]
    status_counts = Counter(str(sample["status"]) for sample in samples)
    codes = Counter(str(sample["code"]) for sample in samples if sample["code"])
    auth_calls = [int(sample["upstream_calls"].get("auth", 0)) for sample in samples]
    data_calls = [int(sample["upstream_calls"].get("data", 0)) for sample in samples]
    retry_counts = [int(sample["retry_count"]) for sample in samples]
    return {
        "scenario": name,
        "sample_count": len(samples),
        "status_counts": dict(status_counts),
        "code_counts": dict(codes),
        "completion_rate": status_counts.get("200", 0) / len(samples),
        "transport_or_timeout_rate": status_counts.get("0", 0) / len(samples),
        "latency_ms": {
            "p50": percentile(latencies, 0.50),
            "p95": percentile(latencies, 0.95),
            "p99": percentile(latencies, 0.99),
            "max": max(latencies),
        },
        "attempt_latency_ms": {
            "p50": percentile(attempt_latencies, 0.50),
            "p95": percentile(attempt_latencies, 0.95),
            "p99": percentile(attempt_latencies, 0.99),
            "max": max(attempt_latencies),
        },
        "retry_count": {
            "total": sum(retry_counts),
            "max_per_logical_load": max(retry_counts),
        },
        "upstream_auth_calls": {
            "total": sum(auth_calls),
            "max_per_logical_load": max(auth_calls),
        },
        "upstream_data_calls": {
            "total": sum(data_calls),
            "max_per_logical_load": max(data_calls),
        },
        "peak_dependency_concurrency": max(int(sample["peak_dependency_concurrency"]) for sample in samples),
    }


def arm_a_decision(results: dict[str, dict[str, Any]]) -> tuple[str, list[str]]:
    reasons: list[str] = []
    control = results["control"]
    composed = results["auth4.5-data4.5"]

    if control["completion_rate"] != 1.0:
        return "INSUFFICIENT_MEASUREMENT", ["control did not complete successfully"]

    if (
        composed["completion_rate"] < 1.0
        or composed["retry_count"]["total"] > 0
        or (composed["latency_ms"]["p95"] or 0) >= BROWSER_ATTEMPT_DEADLINE_S * 1000
    ):
        reasons.append(
            "auth4.5-data4.5 uses per-hop delays below 5 s but crosses or pressures the 8 s browser attempt boundary"
        )
        if composed["retry_count"]["total"] > 0:
            reasons.append("initial-read retry amplified upstream calls")
        return "COORDINATED_BUDGET_EXPERIMENT_WARRANTED", reasons

    return "CURRENT_BOUNDS_SUFFICIENT", [
        "tested composed delays stayed inside the browser boundary without meaningful retry amplification"
    ]


async def run(args: argparse.Namespace) -> dict[str, Any]:
    repo = args.repo.resolve()
    output = args.output.resolve()
    if output.exists():
        raise RuntimeError(f"output already exists: {output}")
    output.mkdir(parents=True)

    state = DependencyState()
    dependency = DependencyServer(("127.0.0.1", 0), state)
    dependency_port = dependency.server_address[1]
    dependency_thread = threading.Thread(target=dependency.serve_forever, daemon=True)
    dependency_thread.start()

    api_port = free_port()
    api = f"http://127.0.0.1:{api_port}"
    dependency_url = f"http://127.0.0.1:{dependency_port}"

    env = safe_env()
    env["SUPABASE_URL"] = dependency_url
    env["SUPABASE_PUBLISHABLE_KEY"] = "synthetic-publishable-key"
    env["API_CORS_ORIGINS"] = "http://127.0.0.1:4173"

    logs = output / "api.log"
    with logs.open("wb") as log:
        process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(api_port),
                "--workers",
                "1",
                "--no-access-log",
                "--log-level",
                "critical",
            ],
            cwd=repo,
            env=env,
            stdout=log,
            stderr=subprocess.STDOUT,
        )

    try:
        await wait_api_ready(api, process)

        results: dict[str, dict[str, Any]] = {}
        raw: dict[str, list[dict[str, Any]]] = {}

        for scenario in SCENARIOS:
            await wait_dependency_quiet(state)
            state.set_scenario(scenario)
            scenario_samples: list[dict[str, Any]] = []
            print(f"SCENARIO {scenario.name}: {args.samples} logical loads", flush=True)
            for index in range(args.samples):
                sample = await logical_initial_load(api, state)
                scenario_samples.append(sample)
                print(
                    f"  {index + 1}/{args.samples} status={sample['status']} "
                    f"attempts={sample['attempt_count']} elapsed_ms={sample['elapsed_ms']:.1f} "
                    f"auth={sample['upstream_calls'].get('auth', 0)} "
                    f"data={sample['upstream_calls'].get('data', 0)}",
                    flush=True,
                )
            raw[scenario.name] = scenario_samples
            results[scenario.name] = summarize_scenario(scenario.name, scenario_samples)

        decision, reasons = arm_a_decision(results)
        report = {
            "schema_version": "architecture-run-03-arm-a-v1",
            "recorded_at": utc(),
            "source_commit": args.source_commit,
            "measurement_scope": "actual loopback FastAPI + synthetic loopback Auth/Data API dependency + browser-contract 8s client simulator",
            "browser_attempt_deadline_ms": int(BROWSER_ATTEMPT_DEADLINE_S * 1000),
            "samples_per_scenario": args.samples,
            "production_access": False,
            "production_mutation": False,
            "persisted_request_bodies": False,
            "persisted_tokens": False,
            "results": results,
            "decision": decision,
            "decision_reasons": reasons,
        }
        (output / "RESULT.json").write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

        # Raw samples remain aggregate-only: no bodies, token, or identity.
        (output / "SAMPLES.json").write_text(
            json.dumps(raw, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

        lines = [
            "# Run 03 Arm A summary",
            "",
            f"- source: `{args.source_commit}`",
            f"- samples/scenario: `{args.samples}`",
            f"- decision: `{decision}`",
            "- production access: `false`",
            "- production mutation: `false`",
            "",
            "| scenario | completion | p50 ms | p95 ms | retries | auth calls | data calls |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
        for scenario in SCENARIOS:
            item = results[scenario.name]
            lines.append(
                f"| {scenario.name} | {item['completion_rate']:.2f} | "
                f"{item['latency_ms']['p50']:.1f} | {item['latency_ms']['p95']:.1f} | "
                f"{item['retry_count']['total']} | "
                f"{item['upstream_auth_calls']['total']} | "
                f"{item['upstream_data_calls']['total']} |"
            )
        lines += ["", "## Decision reasons", ""]
        lines += [f"- {reason}" for reason in reasons]
        (output / "SUMMARY.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

        return report
    finally:
        if process.poll() is None:
            process.send_signal(signal.SIGTERM)
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        dependency.shutdown()
        dependency.server_close()
        dependency_thread.join(timeout=5)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--samples", type=int, default=5)
    args = parser.parse_args()

    if args.samples < 1 or args.samples > 20:
        raise SystemExit("--samples must be between 1 and 20")

    report = asyncio.run(run(args))
    print("")
    print("=== RUN 03 ARM A COMPLETE ===")
    print(f"Decision: {report['decision']}")
    print(f"Evidence: {args.output.resolve()}")


if __name__ == "__main__":
    main()
