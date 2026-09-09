"""Verify sanitized retention purge cron health evidence without network access."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "retention-purge-health-evidence-v1"
FRESHNESS_WINDOW = timedelta(hours=30)
EXPECTED_SCHEDULES = {
    "purge-expired-observation-records": "17 0 * * *",
    "purge-expired-active-challenges": "19 0 * * *",
}


def _parse_timestamp(value: Any, field: str) -> datetime:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{field} must be a timestamp string")

    normalized = f"{value[:-1]}+00:00" if value.endswith("Z") else value

    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(f"{field} must be ISO 8601") from exc

    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError(f"{field} must include a timezone")

    return parsed


def verify(evidence: dict[str, Any]) -> list[str]:  # noqa: C901
    if set(evidence) != {"schema_version", "checked_at", "jobs"}:
        raise ValueError("unexpected top-level schema")

    if evidence["schema_version"] != SCHEMA_VERSION:
        raise ValueError("unexpected schema_version")

    checked_at = _parse_timestamp(evidence["checked_at"], "checked_at")

    jobs = evidence["jobs"]
    if not isinstance(jobs, list) or len(jobs) != len(EXPECTED_SCHEDULES):
        raise ValueError("exactly two expected purge jobs are required")

    jobnames = [job.get("jobname") for job in jobs if isinstance(job, dict)]

    if len(jobnames) != len(jobs) or set(jobnames) != set(EXPECTED_SCHEDULES) or len(set(jobnames)) != len(jobnames):
        raise ValueError("expected purge jobs must each appear exactly once")

    warnings: list[str] = []

    for job in jobs:
        if set(job) != {
            "jobname",
            "schedule",
            "active",
            "recent_non_succeeded_count_30h",
            "runs",
        }:
            raise ValueError("unexpected purge job schema")

        jobname = job["jobname"]

        if job["schedule"] != EXPECTED_SCHEDULES[jobname]:
            raise ValueError(f"{jobname}: schedule mismatch")

        if job["active"] is not True:
            raise ValueError(f"{jobname}: job is not active")

        recent_non_succeeded_count = job["recent_non_succeeded_count_30h"]
        if type(recent_non_succeeded_count) is not int or recent_non_succeeded_count < 0:
            raise ValueError(f"{jobname}: recent_non_succeeded_count_30h must be a non-negative integer")
        if recent_non_succeeded_count > 0:
            raise ValueError(f"{jobname}: non-succeeded run occurred within 30 hours")

        runs = job["runs"]
        if not isinstance(runs, list) or not 1 <= len(runs) <= 7:
            raise ValueError(f"{jobname}: one to seven recent runs are required")

        parsed_runs: list[tuple[str, datetime, datetime]] = []
        previous_start: datetime | None = None

        for run in runs:
            if not isinstance(run, dict) or set(run) != {
                "status",
                "start_time",
                "end_time",
            }:
                raise ValueError(f"{jobname}: unexpected run schema")

            status = run["status"]
            if not isinstance(status, str) or not status:
                raise ValueError(f"{jobname}: run status must be a non-empty string")

            start_time = _parse_timestamp(
                run["start_time"],
                f"{jobname}.start_time",
            )
            end_time = _parse_timestamp(
                run["end_time"],
                f"{jobname}.end_time",
            )

            if end_time < start_time:
                raise ValueError(f"{jobname}: run end precedes start")

            if end_time > checked_at:
                raise ValueError(f"{jobname}: run ends after checked_at")

            if previous_start is not None and start_time > previous_start:
                raise ValueError(f"{jobname}: runs must be newest first")

            previous_start = start_time
            parsed_runs.append((status, start_time, end_time))

        latest_status, _, latest_end = parsed_runs[0]

        if latest_status != "succeeded":
            raise ValueError(f"{jobname}: latest run did not succeed")

        if checked_at - latest_end > FRESHNESS_WINDOW:
            raise ValueError(f"{jobname}: latest successful run is older than 30 hours")

        for status, _, end_time in parsed_runs:
            if status == "succeeded":
                continue

            age = checked_at - end_time

            if age <= FRESHNESS_WINDOW:
                raise ValueError(f"{jobname}: non-succeeded run occurred within 30 hours")

            warnings.append(f"{jobname}: recovered historical non-succeeded run older than 30 hours")

    return warnings


def _self_test() -> None:
    evidence: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "checked_at": "2026-09-09T06:00:00+00:00",
        "jobs": [
            {
                "jobname": "purge-expired-active-challenges",
                "schedule": "19 0 * * *",
                "active": True,
                "recent_non_succeeded_count_30h": 0,
                "runs": [
                    {
                        "status": "succeeded",
                        "start_time": "2026-09-09T00:19:00+00:00",
                        "end_time": "2026-09-09T00:19:01+00:00",
                    },
                    {
                        "status": "succeeded",
                        "start_time": "2026-09-08T00:19:00+00:00",
                        "end_time": "2026-09-08T00:19:01+00:00",
                    },
                    {
                        "status": "succeeded",
                        "start_time": "2026-09-07T00:19:00+00:00",
                        "end_time": "2026-09-07T00:19:01+00:00",
                    },
                ],
            },
            {
                "jobname": "purge-expired-observation-records",
                "schedule": "17 0 * * *",
                "active": True,
                "recent_non_succeeded_count_30h": 0,
                "runs": [
                    {
                        "status": "succeeded",
                        "start_time": "2026-09-09T00:17:00+00:00",
                        "end_time": "2026-09-09T00:17:01+00:00",
                    },
                    {
                        "status": "succeeded",
                        "start_time": "2026-09-08T00:17:00+00:00",
                        "end_time": "2026-09-08T00:17:01+00:00",
                    },
                    {
                        "status": "succeeded",
                        "start_time": "2026-09-07T00:17:00+00:00",
                        "end_time": "2026-09-07T00:17:01+00:00",
                    },
                ],
            },
        ],
    }

    assert verify(evidence) == []

    mutations = (
        # Visible recent runs may all succeed while an eighth run inside the
        # 30-hour window failed. The SQL aggregate must still make this fail.
        lambda value: value["jobs"][0].update({"recent_non_succeeded_count_30h": 1}),
        lambda value: value["jobs"].pop(),
        lambda value: value["jobs"][0].update({"active": False}),
        lambda value: value["jobs"][0].update({"schedule": "0 0 * * *"}),
        lambda value: value.update({"checked_at": "2026-09-10T07:00:00+00:00"}),
        lambda value: value["jobs"][0]["runs"][0].update({"status": "failed"}),
        lambda value: value["jobs"][1].update({"jobname": "purge-expired-active-challenges"}),
        lambda value: value["jobs"][0]["runs"][1].update({"status": "failed"}),
        lambda value: value.update({"checked_at": "2026-09-09T06:00:00"}),
    )

    for mutation in mutations:
        broken = json.loads(json.dumps(evidence))
        mutation(broken)

        try:
            verify(broken)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid retention purge evidence accepted")

    recovered = json.loads(json.dumps(evidence))
    recovered["jobs"][0]["runs"][2]["status"] = "failed"

    warnings = verify(recovered)
    assert len(warnings) == 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("evidence", nargs="?", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)

    if args.self_test:
        _self_test()
        print("retention purge health verifier self-test passed; no network access")
        return 0

    if not args.evidence:
        parser.error("evidence path is required unless --self-test is used")

    loaded = json.loads(args.evidence.read_text(encoding="utf-8"))

    if not isinstance(loaded, dict):
        raise ValueError("evidence must be a JSON object")

    warnings = verify(loaded)

    for warning in warnings:
        print(f"WARNING: {warning}")

    print("retention purge health evidence verified; no network access")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
