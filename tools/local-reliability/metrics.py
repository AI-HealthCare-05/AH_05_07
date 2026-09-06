"""Aggregate-only loopback measurements; no request bodies or identities persist."""

import concurrent.futures
import json
import math
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import UTC, datetime
from urllib.parse import urlsplit


def percentile(values: list[float], probability: float) -> float | None:
    """Linear interpolation at (n - 1) * p (Hyndman–Fan type 7)."""
    if not values:
        return None
    if not 0 <= probability <= 1 or any(not math.isfinite(v) or v < 0 for v in values):
        raise ValueError("Invalid latency sample or percentile")
    ordered = sorted(values)
    index = (len(ordered) - 1) * probability
    low = math.floor(index)
    high = math.ceil(index)
    return ordered[low] + (ordered[high] - ordered[low]) * (index - low)


def request(base: str, path: str, method: str = "GET", token: str = "", body=None, key: str = ""):
    parsed = urlsplit(base)
    if (
        parsed.scheme != "http"
        or parsed.hostname != "127.0.0.1"
        or not parsed.port
        or parsed.username
        or parsed.password
        or parsed.path
        or parsed.query
        or parsed.fragment
        or not path.startswith("/")
        or path.startswith("//")
    ):
        raise ValueError("Only the owned loopback service is allowed")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if key:
        headers["apikey"] = key
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    start = time.perf_counter_ns()
    # Disable environment proxy discovery; no redirect or remote base is accepted.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        with opener.open(req, timeout=15) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read()
    except (OSError, urllib.error.URLError, TimeoutError):
        status, raw = 0, b""
    elapsed = (time.perf_counter_ns() - start) / 1_000_000
    try:
        content = json.loads(raw) if raw else None
    except (ValueError, UnicodeDecodeError):
        content = None
    return status, content, elapsed


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def summarize(samples, expected_status: int, phase: str, concurrency: int, started: str, ended: str):
    if not samples:
        raise ValueError("A measured group must contain samples")
    latencies = [sample[2] for sample in samples]
    unexpected = sum(status != expected_status for status, _, _ in samples)
    return {
        "phase": phase,
        "concurrency": concurrency,
        "sample_count": len(samples),
        "started_at": started,
        "ended_at": ended,
        "expected_status": expected_status,
        "status_counts": dict(sorted(Counter(str(sample[0]) for sample in samples).items())),
        "unexpected_count": unexpected,
        "unexpected_rate": unexpected / len(samples),
        "transport_error_count": sum(sample[0] == 0 for sample in samples),
        "latency_ms": {
            "min": min(latencies),
            "p50": percentile(latencies, 0.5),
            "p95": percentile(latencies, 0.95),
            "max": max(latencies),
        },
    }


def measure(call, expected_status: int, phase: str, count: int, concurrency: int):
    started = datetime.now(UTC).isoformat()
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        samples = list(pool.map(lambda _: call(), range(count)))
    ended = datetime.now(UTC).isoformat()
    return summarize(samples, expected_status, phase, concurrency, started, ended)
