#!/usr/bin/env python3
"""Create repository-safe Model V2 G6 frozen-validation result Markdown."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def f9(value: float) -> str:
    return f"{float(value):.9f}"


def optional_metric(value: float | None) -> str:
    if value is None:
        return "suppressed"
    return f9(value)


def validate_evidence(evidence: dict[str, Any]) -> None:
    if evidence.get("gate") != "Model V2 G6":
        raise SystemExit("STOP: not Model V2 G6 evidence")
    if evidence.get("status") != "frozen_validation_consumed":
        raise SystemExit("STOP: G6 validation evidence incomplete")
    if evidence.get("candidate") != "logistic_regression":
        raise SystemExit("STOP: unexpected G6 candidate")

    required = {
        "validation_consumed_once_in_g6_event": True,
        "validation_used_for_model_change": False,
        "final_test_file_read": False,
        "final_test_performance_accessed": False,
        "v1_validation_or_test_used": False,
        "feature_contract_changed": False,
        "model_family_changed": False,
        "hyperparameter_tuning_performed": False,
        "threshold_selection_performed": False,
        "recalibration_performed": False,
        "production_serialization_performed": False,
    }
    safety = evidence.get("safety", {})
    bad = {key: (safety.get(key), expected) for key, expected in required.items() if safety.get(key) is not expected}
    if bad:
        raise SystemExit(f"STOP: unsafe G6 evidence state: {bad}")


def subgroup_lines(
    title: str,
    groups: dict[str, dict[str, Any]],
) -> list[str]:
    lines = [
        f"### {title}",
        "",
        "| Group | Rows | Weighted AUROC | Weighted AP | Weighted Brier |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for name, item in groups.items():
        lines.append(
            f"| `{name}` | {int(item['rows']):,} | "
            f"{optional_metric(item['weighted_auroc'])} | "
            f"{optional_metric(item['weighted_average_precision'])} | "
            f"{f9(item['weighted_brier'])} |"
        )
    return lines


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    evidence = json.loads(args.evidence.expanduser().resolve().read_text(encoding="utf-8"))
    validate_evidence(evidence)

    weighted = evidence["validation_metrics"]["survey_weighted"]
    unweighted = evidence["validation_metrics"]["unweighted_sensitivity"]
    calibration = evidence["validation_metrics"]["calibration"]
    gate = evidence["gate_decision"]
    provenance = evidence["provenance"]
    repro = evidence["reproducibility"]

    lines = [
        "# Model V2 G6 — One-time Frozen Validation Result",
        "",
        f"Status: **{gate['decision']}**",
        "",
        "## Scope",
        "",
        "- candidate: **`logistic_regression`**",
        f"- development rows: **{int(evidence['development_rows']):,}**",
        f"- development PSU groups: **{int(evidence['development_psu_groups']):,}**",
        f"- validation rows: **{int(evidence['validation_rows']):,}**",
        f"- validation PSU groups: **{int(evidence['validation_psu_groups']):,}**",
        "- final internal test: **not read**",
        "- participant-level validation predictions: **outside Git**",
        "",
        "## Provenance",
        "",
        f"- execution commit: `{evidence['execution_commit']}`",
        f"- development SHA-256: `{provenance['development_sha256']}`",
        f"- validation SHA-256: `{provenance['validation_sha256']}`",
        f"- G3 manifest SHA-256: `{provenance['g3_manifest_sha256']}`",
        f"- G5 evidence SHA-256: `{provenance['g5_evidence_sha256']}`",
        f"- G6 config SHA-256: `{evidence['config_sha256']}`",
        "",
        "## Frozen validation metrics",
        "",
        "| Metric | Survey-weighted | Unweighted sensitivity |",
        "| --- | ---: | ---: |",
        f"| AUROC | {f9(weighted['auroc'])} | {f9(unweighted['auroc'])} |",
        (f"| Average precision | {f9(weighted['average_precision'])} | {f9(unweighted['average_precision'])} |"),
        f"| Brier score | {f9(weighted['brier'])} | {f9(unweighted['brier'])} |",
        "",
        "Calibration diagnostics are evaluation-only and were not applied to",
        "predictions:",
        "",
        f"- weighted calibration intercept: **{f9(calibration['intercept'])}**",
        f"- weighted calibration slope: **{f9(calibration['slope'])}**",
        "",
        "## Development reference",
        "",
        (
            "- G5 logistic development OOF weighted AUROC: "
            f"**{f9(evidence['development_oof_reference']['weighted_auroc'])}**"
        ),
        (
            "- development minus validation AUROC: "
            f"**{f9(evidence['development_oof_reference']['weighted_auroc'] - weighted['auroc'])}**"
        ),
        "",
        "## Frozen gate criteria",
        "",
    ]

    for name, passed in gate["criteria"].items():
        lines.append(f"- `{name}`: **{passed}**")

    lines.extend(
        [
            "",
            f"Overall G6 decision: **{gate['decision']}**",
            "",
            "These criteria are project gate checks, not claims of clinical validity.",
            "",
            "## Reproducibility",
            "",
            "- two fresh full-development fits: **True**",
            "- same in-memory frozen validation frame: **True**",
            (
                "- max absolute validation probability difference: "
                f"**{float(repro['max_abs_probability_difference']):.3e}**"
            ),
            f"- required tolerance: **{float(repro['required_atol']):.1e}**",
            f"- reproducibility passed: **{repro['passed']}**",
            "",
            "## Descriptive subgroup audit",
            "",
            "Subgroup results were not used for retuning or model selection.",
            "",
            *subgroup_lines("Sex", evidence["subgroups"]["sex"]),
            "",
            *subgroup_lines("Age", evidence["subgroups"]["age"]),
            "",
            "## Safety / gate state",
            "",
            "- validation used for model change: **False**",
            "- final-test file read: **False**",
            "- feature contract changed: **False**",
            "- model family changed: **False**",
            "- hyperparameter tuning: **False**",
            "- threshold selection: **False**",
            "- recalibration: **False**",
            "- production serialization: **False**",
            "",
            "The final internal test remains locked after G6.",
            "",
        ]
    )

    out = args.out.expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")
    print("wrote:", out)
    print("G6 repository-safe result: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
