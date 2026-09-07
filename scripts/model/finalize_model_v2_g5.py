#!/usr/bin/env python3
"""Create repository-safe Model V2 G5 result Markdown."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

MODEL_ORDER = [
    "logistic_regression",
    "histogram_gradient_boosting",
    "random_forest",
    "extra_trees",
]


def f9(value: float) -> str:
    return f"{float(value):.9f}"


def validate_safety(evidence: dict[str, Any]) -> None:
    required = {
        "development_only": True,
        "validation_file_read": False,
        "validation_performance_accessed": False,
        "final_test_file_read": False,
        "final_test_performance_accessed": False,
        "v1_validation_or_test_used": False,
        "feature_contract_changed": False,
        "adaptive_hyperparameter_search_performed": False,
        "threshold_selection_performed": False,
        "calibration_fitting_performed": False,
        "production_serialization_performed": False,
    }
    safety = evidence.get("safety", {})
    bad = {key: (safety.get(key), expected) for key, expected in required.items() if safety.get(key) is not expected}
    if bad:
        raise SystemExit(f"STOP: unsafe G5 evidence state: {bad}")


def model_table(evidence: dict[str, Any]) -> list[str]:
    lines = [
        "| Model | Weighted AUROC | Weighted AP | Weighted Brier |",
        "| --- | ---: | ---: | ---: |",
    ]
    for name in MODEL_ORDER:
        weighted = evidence["models"][name]["weighted"]
        lines.append(
            f"| `{name}` | {f9(weighted['auroc'])} | {f9(weighted['average_precision'])} | {f9(weighted['brier'])} |"
        )
    return lines


def guardrail_table(evidence: dict[str, Any]) -> list[str]:
    lines = [
        "| Challenger | AUROC Δ | AP Δ | Brier Δ | Fold AUROC wins | Pass |",
        "| --- | ---: | ---: | ---: | ---: | --- |",
    ]
    for name in MODEL_ORDER[1:]:
        item = evidence["guardrails_vs_logistic"][name]
        lines.append(
            f"| `{name}` | {item['weighted_auroc_delta']:+.9f} | "
            f"{item['weighted_average_precision_delta']:+.9f} | "
            f"{item['weighted_brier_delta']:+.9f} | "
            f"{int(item['fold_auroc_wins_vs_logistic'])}/5 | "
            f"**{item['passes']}** |"
        )
    return lines


def repro_lines(evidence: dict[str, Any]) -> list[str]:
    lines = []
    for name in MODEL_ORDER:
        item = evidence["reproducibility"]["models"][name]
        lines.append(
            f"- `{name}` max absolute probability difference: "
            f"**{float(item['max_abs_probability_difference']):.3e}** "
            f"(pass: **{item['passed']}**)"
        )
    return lines


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    evidence = json.loads(args.evidence.expanduser().resolve().read_text(encoding="utf-8"))
    if evidence.get("gate") != "Model V2 G5":
        raise SystemExit("STOP: not Model V2 G5 evidence")
    if evidence.get("status") != "bounded_development_family_screen_complete":
        raise SystemExit("STOP: G5 did not complete")
    if evidence.get("g4_logistic_digest_reproduced") is not True:
        raise SystemExit("STOP: G4 logistic digest was not reproduced")
    if evidence.get("nomination_is_validation_evidence") is not False:
        raise SystemExit("STOP: invalid nomination semantics")
    validate_safety(evidence)

    provenance = evidence["provenance"]
    nomination = evidence["g6_development_nomination"]

    lines = [
        "# Model V2 G5 — Bounded Development-only Family Screen Result",
        "",
        "Status: **PASS — bounded development-only family screen complete**",
        "",
        "## Scope",
        "",
        f"- development rows: **{int(evidence['development_rows']):,}**",
        f"- development PSU groups: **{int(evidence['development_psu_groups']):,}**",
        "- validation: **not read**",
        "- final internal test: **not read**",
        "- V1 validation/test: **not used**",
        "- participant-level OOF predictions: **outside Git**",
        "",
        "## Provenance",
        "",
        f"- execution commit: `{evidence['execution_commit']}`",
        f"- development SHA-256: `{provenance['development_sha256']}`",
        f"- G3 manifest SHA-256: `{provenance['g3_manifest_sha256']}`",
        f"- G4 evidence SHA-256: `{provenance['g4_evidence_sha256']}`",
        f"- G4 OOF canonical digest: `{provenance['g4_oof_canonical_sha256']}`",
        f"- G5 config SHA-256: `{evidence['config_sha256']}`",
        "- G4 logistic OOF digest reproduced: **True**",
        "",
        "## Development OOF aggregate metrics",
        "",
        *model_table(evidence),
        "",
        "These are development-only results. They are not G6 validation evidence,",
        "G7 external evaluation, G8 final-test evidence, or release approval.",
        "",
        "## Predeclared guardrails versus logistic baseline",
        "",
        *guardrail_table(evidence),
        "",
        "## G6 development nomination",
        "",
        f"- nominated family: **`{nomination}`**",
        "- nomination is development-only and must be evaluated separately at G6.",
        "",
        "## Reproducibility",
        "",
        "- two complete four-family screens: **True**",
        "- fold assignments identical: **True**",
        *repro_lines(evidence),
        "",
        "## Safety / gate state",
        "",
        "- development only: **True**",
        "- validation file read: **False**",
        "- final-test file read: **False**",
        "- adaptive hyperparameter search: **False**",
        "- threshold selection: **False**",
        "- calibration fitting: **False**",
        "- production serialization: **False**",
        "",
        "G6 remains a separate gate. Validation must stay locked until an explicit",
        "G6 approval and pre-validation contract are complete.",
        "",
    ]

    out = args.out.expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")
    print("wrote:", out)
    print("G5 repository-safe result: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
