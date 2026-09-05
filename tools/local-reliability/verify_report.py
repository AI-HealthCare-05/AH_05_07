"""Check aggregate arithmetic and top-level/phase allowlists; does not rerun HTTP or SQL."""

import argparse
import json
import math
from pathlib import Path

TOP = {
    "schema_version",
    "status",
    "source_commit",
    "started_at",
    "ended_at",
    "environment",
    "measurement_scope",
    "mocked_response",
    "host_load_context",
    "production_validation",
    "natural_30_day_expiry_observed",
    "method",
    "stages",
    "measurements",
    "checks",
    "cleanup",
    "source_hashes",
    "tool_hashes",
    "measurement_coordination",
}
PHASE = {
    "phase",
    "concurrency",
    "sample_count",
    "started_at",
    "ended_at",
    "expected_status",
    "status_counts",
    "unexpected_count",
    "unexpected_rate",
    "transport_error_count",
    "latency_ms",
}


def keys(value, expected):
    if not isinstance(value, dict) or set(value) != expected:
        raise ValueError("Unexpected aggregate fields")


def verify_phase(phase):
    keys(phase, PHASE)
    n = phase["sample_count"]
    counts = phase["status_counts"]
    if (
        type(n) is not int
        or n <= 0
        or any(type(v) is not int or v < 0 for v in counts.values())
        or sum(counts.values()) != n
    ):
        raise ValueError("Inconsistent status/sample counts")
    unexpected = n - counts.get(str(phase["expected_status"]), 0)
    if (
        phase["unexpected_count"] != unexpected
        or phase["unexpected_rate"] != unexpected / n
        or phase["transport_error_count"] != counts.get("0", 0)
    ):
        raise ValueError("Inconsistent error arithmetic")
    keys(phase["latency_ms"], {"min", "p50", "p95", "max"})
    values = [phase["latency_ms"][name] for name in ("min", "p50", "p95", "max")]
    if any(type(v) not in (int, float) or not math.isfinite(v) or v < 0 for v in values) or values != sorted(values):
        raise ValueError("Invalid latency order or finite values")


def verify(report):
    keys(report, TOP if "measurement_coordination" in report else TOP - {"measurement_coordination"})
    if report["schema_version"] != "local-reliability-v1" or report["status"] != "passed":
        raise ValueError("Successful local report required")
    if any(
        report[key] is not False
        for key in ("mocked_response", "production_validation", "natural_30_day_expiry_observed")
    ):
        raise ValueError("Scope boundary differs")
    if any(not item for item in report["checks"].values()):
        raise ValueError("A required check failed")
    if (
        report["cleanup"]["status"] != "passed"
        or report["cleanup"]["owned_container_count"] != 0
        or report["cleanup"]["owned_volume_count"] != 0
    ):
        raise ValueError("Local cleanup incomplete")
    for stage in report["stages"]:
        keys(stage, {"name", "exit_code", "elapsed_s"})
        if stage["exit_code"] != 0:
            raise ValueError("A command did not pass")
    if len(report["measurements"]) != 9:
        raise ValueError("Expected eight endpoint scenarios and one bounded fault")
    for phases in report["measurements"].values():
        for phase in phases:
            verify_phase(phase)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    args = parser.parse_args()
    verify(json.loads(args.report.read_text(encoding="utf-8")))
    print("Local aggregate structure/arithmetic passed; HTTP/SQL not rerun.")


if __name__ == "__main__":
    main()
