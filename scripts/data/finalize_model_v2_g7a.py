#!/usr/bin/env python3
"""Finalize repository-safe Model V2 G7-A compatibility report."""

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
    if evidence.get("status") != "metadata_only_schema_screen_complete":
        raise SystemExit("STOP: incomplete G7-A evidence")

    safety = evidence["safety"]
    required_false = [
        "participant_rows_read",
        "target_distribution_inspected",
        "model_fitting_performed",
        "predictions_computed",
        "performance_metrics_computed",
        "knhanes_2024_final_test_accessed",
        "v1_validation_or_test_accessed",
    ]
    if any(safety.get(name) is not False for name in required_false):
        raise SystemExit("STOP: G7-A safety boundary violated")

    decision = evidence["decision"]
    missing = evidence["missing_required_columns"]
    source = evidence["source"]

    lines = [
        "# Model V2 G7-A — KNHANES 2023 External Compatibility Result",
        "",
        f"Status: **{decision}**",
        "",
        "## Scope",
        "",
        "- documentation + schema-only screen",
        "- participant rows read: **False**",
        "- target prevalence accessed: **False**",
        "- model fitting/prediction/performance: **False**",
        "- KNHANES 2024 final internal test accessed: **False**",
        "",
        "## Source metadata",
        "",
        f"- filename: `{source['filename']}`",
        f"- SHA-256: `{source['sha256']}`",
        f"- SAS columns: **{int(source['column_count']):,}**",
        "",
        "## Frozen mapping compatibility",
        "",
        "The G3 Model V2-A feature, target, cohort, survey-design, and leakage",
        "contracts were checked against the KNHANES 2023 main-database schema.",
        "",
        f"- missing required columns: **{len(missing)}**",
    ]
    if missing:
        for name in missing:
            lines.append(f"  - `{name}`")
    else:
        lines.append("- all frozen source/target/survey/leakage columns present: **True**")

    lines.extend(
        [
            "",
            "## Documentation semantic review",
            "",
            "- same KNHANES 9th cycle (2022–2024): **True**",
            "- `HE_HP` 1/2/3/4 hypertension-state semantics compatible: **True**",
            "- `HE_prg` current-pregnancy exclusion available: **True**",
            "- `wt_itvex`, `kstrata`, `psu` survey roles compatible: **True**",
            "- walking/strength source variables compatible: **True**",
            "- weekday/weekend sleep clock-time variables compatible: **True**",
            "- smoking and alcohol source variables compatible: **True**",
            "- BP and hypertension diagnosis/treatment leakage guard fields present: "
            f"**{not any(name in missing for name in evidence['required_columns'] if name.startswith(('HE_sbp', 'HE_dbp', 'DI1_')))}**",
            "",
            "## Decision",
            "",
            f"**{decision}**",
            "",
            "This decision concerns dataset/mapping compatibility only. It is not",
            "external performance evidence and does not authorize access to the",
            "KNHANES 2024 final internal test.",
            "",
        ]
    )

    out = args.out.expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")
    print("wrote:", out)
    print("G7-A repository-safe compatibility report complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
