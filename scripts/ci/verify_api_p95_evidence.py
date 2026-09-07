"""Verify sanitized S4 API P95 evidence without network access."""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path
from typing import Any

EXPECTED_ENDPOINTS = {(endpoint, concurrency) for endpoint in ("live", "ready", "window") for concurrency in (1, 4)}
FORBIDDEN_KEY = re.compile(
    r"(?:token|authorization|cookie|password|secret|jwt|email|uuid|user.?id|health|blood.?pressure|raw.?sample)", re.I
)
ALLOWED_BOUNDARY_KEYS = {"raw_samples_retained", "request_bodies_retained", "response_bodies_retained"}


def _reject_forbidden_keys(value: Any) -> None:
    if isinstance(value, dict):
        for key, nested in value.items():
            if key not in ALLOWED_BOUNDARY_KEYS and FORBIDDEN_KEY.search(str(key)):
                raise ValueError("secret, body, identity, health, or raw-sample key present")
            _reject_forbidden_keys(nested)
    elif isinstance(value, list):
        for nested in value:
            _reject_forbidden_keys(nested)


def verify(evidence: dict[str, Any]) -> None:  # noqa: C901
    required = {
        "schema_version",
        "status",
        "scope",
        "target",
        "criterion",
        "method",
        "runner",
        "run_window",
        "tool",
        "results",
    }
    if set(evidence) != required:
        raise ValueError("unexpected top-level schema")
    _reject_forbidden_keys(evidence)
    if evidence["schema_version"] != "s4-api-p95-evidence-v1" or evidence["status"] != "passed":
        raise ValueError("successful S4 evidence required")
    if evidence["scope"] != "operator_verification_not_client_acceptance":
        raise ValueError("client acceptance scope claim is invalid")
    target = evidence["target"]
    if target != {"environment": "production", "service": "bp7-api", "expected_revision": "bp7-api-00014-jeq"}:
        raise ValueError("unexpected production target")
    criterion = evidence["criterion"]
    if criterion != {"p95_ms": 3000.0, "percentile": "Hyndman-Fan type 7"}:
        raise ValueError("threshold or percentile declaration is invalid")
    method = evidence["method"]
    if (
        method.get("warm_only") is not True
        or method.get("samples_per_condition") != 100
        or method.get("concurrency") != [1, 4]
        or method.get("warmup_per_condition") != 1
        or method.get("timeout_seconds") != 8.0
        or method.get("arrival") != "closed-loop"
        or method.get("retry") is not False
        or method.get("redirects") is not False
        or method.get("raw_samples_retained") is not False
        or method.get("request_bodies_retained") is not False
        or method.get("response_bodies_retained") is not False
    ):
        raise ValueError("measurement contract mismatch")
    results = evidence["results"]
    if (
        not isinstance(results, list)
        or len(results) != 6
        or {(item.get("endpoint"), item.get("concurrency")) for item in results} != EXPECTED_ENDPOINTS
    ):
        raise ValueError("exact six endpoint/concurrency conditions are required")
    for result in results:
        required_result = {
            "endpoint",
            "concurrency",
            "n",
            "expected_status",
            "status_counts",
            "error_count",
            "transport_error_count",
            "p50_ms",
            "p95_ms",
            "max_ms",
            "pass",
        }
        if set(result) != required_result or result["expected_status"] != 200 or result["n"] != 100:
            raise ValueError("condition result is incomplete")
        if (
            result["error_count"] != 0
            or result["transport_error_count"] != 0
            or result["status_counts"] != {"200": 100}
        ):
            raise ValueError("successful evidence contains errors")
        if result["pass"] is not True or not all(
            type(result[key]) in (int, float) and math.isfinite(result[key]) and result[key] >= 0
            for key in ("p50_ms", "p95_ms", "max_ms")
        ):
            raise ValueError("invalid aggregate latency")
        if result["p50_ms"] > result["p95_ms"] or result["p95_ms"] > result["max_ms"] or result["p95_ms"] > 3000.0:
            raise ValueError("P95 threshold or latency ordering failed")


def _self_test() -> None:
    result = {
        "endpoint": "live",
        "concurrency": 1,
        "n": 100,
        "expected_status": 200,
        "status_counts": {"200": 100},
        "error_count": 0,
        "transport_error_count": 0,
        "p50_ms": 10.0,
        "p95_ms": 20.0,
        "max_ms": 30.0,
        "pass": True,
    }
    evidence = {
        "schema_version": "s4-api-p95-evidence-v1",
        "status": "passed",
        "scope": "operator_verification_not_client_acceptance",
        "target": {"environment": "production", "service": "bp7-api", "expected_revision": "bp7-api-00014-jeq"},
        "criterion": {"p95_ms": 3000.0, "percentile": "Hyndman-Fan type 7"},
        "method": {
            "warm_only": True,
            "samples_per_condition": 100,
            "concurrency": [1, 4],
            "warmup_per_condition": 1,
            "timeout_seconds": 8.0,
            "retry": False,
            "redirects": False,
            "timer": "perf_counter_ns; request start through full response body read",
            "arrival": "closed-loop",
            "connections": "one reusable HTTP connection per worker thread; at most c in-flight",
            "raw_samples_retained": False,
            "request_bodies_retained": False,
            "response_bodies_retained": False,
        },
        "runner": {"label": "self-test"},
        "run_window": {"started_at": "2026-01-01T00:00:00+00:00", "ended_at": "2026-01-01T00:01:00+00:00"},
        "tool": {"name": "test", "version": "test"},
        "results": [
            result | {"endpoint": endpoint, "concurrency": concurrency}
            for endpoint in ("live", "ready", "window")
            for concurrency in (1, 4)
        ],
    }
    verify(evidence)
    for mutation in (
        lambda value: value["results"].pop(),
        lambda value: value["results"][0].update({"n": 99}),
        lambda value: value["results"][0].update({"p95_ms": 3000.1}),
        lambda value: value["results"][0].update({"token": "must-not-appear"}),
        lambda value: value.update({"scope": "client_acceptance"}),
        lambda value: value["method"].update({"request_bodies_retained": True}),
        lambda value: value["method"].update({"response_bodies_retained": True}),
    ):
        broken = json.loads(json.dumps(evidence))
        mutation(broken)
        try:
            verify(broken)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid evidence accepted")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("evidence", nargs="?", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        _self_test()
        print("API P95 evidence verifier self-test passed; no network access")
        return 0
    if not args.evidence:
        parser.error("evidence path is required unless --self-test is used")
    verify(json.loads(args.evidence.read_text(encoding="utf-8")))
    print("API P95 aggregate evidence verified; no network access")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
