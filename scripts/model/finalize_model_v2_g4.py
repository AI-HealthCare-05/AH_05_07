#!/usr/bin/env python3
"""Create repository-safe G4 Markdown from aggregate external evidence."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def f9(value: float) -> str:
    return f"{float(value):.9f}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    evidence = json.loads(args.evidence.expanduser().resolve().read_text(encoding="utf-8"))
    if evidence.get("gate") != "Model V2 G4":
        raise SystemExit("STOP: not Model V2 G4 evidence")
    if evidence.get("status") != "reproducible_development_baseline":
        raise SystemExit("STOP: G4 evidence did not pass reproducibility")

    safety = evidence["safety"]
    required = {
        "development_only": True,
        "validation_file_read": False,
        "validation_performance_accessed": False,
        "final_test_file_read": False,
        "final_test_performance_accessed": False,
        "v1_validation_or_test_used": False,
        "feature_ranking_performed": False,
        "model_family_comparison_performed": False,
        "hyperparameter_search_performed": False,
        "threshold_selection_performed": False,
        "calibration_fitting_performed": False,
        "production_serialization_performed": False,
    }
    bad = {key: (safety.get(key), expected) for key, expected in required.items() if safety.get(key) is not expected}
    if bad:
        raise SystemExit(f"STOP: unsafe G4 evidence state: {bad}")

    weighted = evidence["oof_metrics"]["survey_weighted"]
    unweighted = evidence["oof_metrics"]["unweighted_sensitivity"]
    repro = evidence["reproducibility"]
    provenance = evidence["provenance"]

    lines = [
        "# Model V2 G4 — Development-only Baseline Reproducibility Result",
        "",
        "Status: **PASS — reproducible development-only baseline**",
        "",
        "## Scope",
        "",
        "- model family: L2 logistic regression only",
        f"- development rows: **{int(evidence['development_rows']):,}**",
        f"- development PSU groups: **{int(evidence['development_psu_groups']):,}**",
        "- validation: **not read**",
        "- final internal test: **not read**",
        "- V1 validation/test: **not used**",
        "",
        "## Provenance",
        "",
        f"- execution commit: `{evidence['execution_commit']}`",
        f"- development SHA-256: `{provenance['development_sha256']}`",
        f"- external G3 manifest SHA-256: `{provenance['g3_manifest_sha256']}`",
        f"- G4 config SHA-256: `{evidence['config_sha256']}`",
        f"- OOF canonical digest: `{evidence['oof_canonical_sha256']}`",
        "",
        "Participant-level OOF predictions remain outside Git.",
        "",
        "## Development OOF metrics",
        "",
        "| Metric | Survey-weighted | Unweighted sensitivity |",
        "| --- | ---: | ---: |",
        f"| AUROC | {f9(weighted['auroc'])} | {f9(unweighted['auroc'])} |",
        f"| Average precision / PR-AUC | {f9(weighted['average_precision'])} | {f9(unweighted['average_precision'])} |",
        f"| Brier score | {f9(weighted['brier'])} | {f9(unweighted['brier'])} |",
        "",
        "These are **development-only** baseline results and are not validation,",
        "final-test, external-evaluation, or release evidence.",
        "",
        "## Fold audit",
        "",
        "| Fold | Rows | PSU groups | Weighted AUROC | Weighted AP | Weighted Brier |",
        "| ---: | ---: | ---: | ---: | ---: | ---: |",
    ]

    for fold in evidence["folds"]:
        metric = fold["weighted"]
        lines.append(
            f"| {int(fold['fold'])} | {int(fold['rows']):,} | "
            f"{int(fold['psu_groups']):,} | {f9(metric['auroc'])} | "
            f"{f9(metric['average_precision'])} | {f9(metric['brier'])} |"
        )

    lines.extend(
        [
            "",
            "## Reproducibility",
            "",
            f"- complete procedure executed twice: **{repro['two_full_runs']}**",
            f"- fold assignments identical: **{repro['fold_assignments_identical']}**",
            f"- max absolute OOF probability difference: **{float(repro['max_abs_probability_difference']):.3e}**",
            f"- required tolerance: **{float(repro['required_atol']):.1e}**",
            f"- reproducibility passed: **{repro['passed']}**",
            "",
            "## Safety / gate state",
            "",
        ]
    )

    for key, expected in required.items():
        lines.append(f"- `{key}`: **{expected}**")

    lines.extend(
        [
            "",
            "No operational threshold was selected and no calibration model was fit.",
            "No model-family winner was selected in G4.",
            "",
            "After G4 merge, G5 may begin bounded development-only family screening",
            "using the frozen G3 features and the same G4 development resampling design.",
            "",
        ]
    )

    out = args.out.expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")

    print("wrote:", out)
    print("G4 repository-safe result: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
