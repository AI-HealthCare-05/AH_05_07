#!/usr/bin/env python3
"""Finalize repository-safe revised Model V2 G7-A compatibility report."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    evidence = json.loads(args.evidence.expanduser().resolve().read_text(encoding="utf-8"))
    if evidence.get("gate") != "Model V2 G7-A":
        raise SystemExit("STOP: not G7-A evidence")
    if evidence.get("status") != "revised_metadata_only_schema_screen_complete":
        raise SystemExit("STOP: incomplete revised G7-A evidence")

    safety = evidence["safety"]
    if any(
        safety.get(name) is not False
        for name in [
            "participant_rows_read",
            "target_distribution_inspected",
            "model_fitting_performed",
            "predictions_computed",
            "performance_metrics_computed",
            "knhanes_2024_final_test_accessed",
            "v1_validation_or_test_accessed",
        ]
    ):
        raise SystemExit("STOP: G7-A safety boundary violated")

    source = evidence["source"]
    missing = evidence["missing_required_columns"]
    decision = evidence["decision"]
    sleep = evidence["external_sleep_harmonization"]

    lines = [
        "# Model V2 G7-A — KNHANES 2023 External Compatibility Result",
        "",
        f"Status: **{decision}**",
        "",
        "## Scope",
        "",
        "- metadata-only schema screen after pre-performance contract revision",
        "- participant rows read: **False**",
        "- target prevalence accessed: **False**",
        "- model fitting/prediction/performance: **False**",
        "- KNHANES 2024 final internal test accessed: **False**",
        "",
        "## Source",
        "",
        f"- filename: `{source['filename']}`",
        f"- SHA-256: `{source['sha256']}`",
        f"- columns: **{int(source['column_count']):,}**",
        "",
        "## Sleep measurement shift discovered before external evaluation",
        "",
        "KNHANES 2023 and 2024 measure the sleep-duration construct using different",
        "source instruments.",
        "",
        "- 2023 weekday sleep source: `BP16_1`",
        "- 2023 weekend sleep source: `BP16_2`",
        f"- external weekday harmonization: `{sleep['weekday_sleep_minutes']}`",
        f"- external weekend harmonization: `{sleep['weekend_sleep_minutes']}`",
        "- 88/99 are treated as missing",
        "- measurement shift versus 2024: **True**",
        "- mapping selected from performance: **False**",
        "",
        "Therefore G7 is interpreted as a temporal Korean transportability",
        "evaluation with a predeclared sleep-measurement shift, not an exact",
        "same-instrument temporal replication.",
        "",
        "## Revised schema compatibility",
        "",
        f"- missing revised required columns: **{len(missing)}**",
    ]
    if missing:
        lines.extend(f"  - `{name}`" for name in missing)
    else:
        lines.append("- all revised required columns present: **True**")

    lines.extend(
        [
            "",
            "Expected absent 2024-only sleep clock fields:",
            "",
            *[f"- `{name}`" for name in evidence["expected_absent_clock_columns"]],
            "",
            "## Decision",
            "",
            f"**{decision}**",
            "",
            "Approval means compatibility for the explicitly defined G7",
            "transportability evaluation. It is not external performance evidence.",
            "The KNHANES 2024 final internal test remains locked.",
            "",
        ]
    )

    out = args.out.expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")
    print("wrote:", out)
    print("G7-A revised repository-safe compatibility report complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
