#!/usr/bin/env python3
"""Finalize repository-safe Model V2 G7 external evaluation result."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    evidence_path = args.evidence.expanduser().resolve()
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))

    if evidence.get("gate") != "Model V2 G7":
        raise SystemExit("STOP: not Model V2 G7 evidence")
    if evidence.get("status") != "external_transportability_consumed":
        raise SystemExit("STOP: incomplete G7 evidence")

    safety = evidence.get("safety", {})
    required_false = [
        "external_used_for_model_change",
        "g6_validation_participant_data_read",
        "g6_validation_labels_used_for_fitting",
        "final_test_file_read",
        "final_test_performance_accessed",
        "v1_validation_or_test_used",
        "feature_contract_changed",
        "model_family_changed",
        "hyperparameter_tuning_performed",
        "threshold_selection_performed",
        "recalibration_performed",
        "production_serialization_performed",
        "sleep_mapping_changed_after_performance_access",
    ]
    bad = [key for key in required_false if safety.get(key) is not False]
    if bad:
        raise SystemExit(f"STOP: unsafe G7 evidence flags: {bad}")
    if safety.get("external_consumed_once_in_g7_event") is not True:
        raise SystemExit("STOP: missing one-time G7 consumption state")

    metrics = evidence["external_metrics"]
    weighted = metrics["survey_weighted"]
    unweighted = metrics["unweighted_sensitivity"]
    calibration = metrics["calibration"]
    gate = evidence["gate_decision"]
    provenance = evidence["provenance"]
    repro = evidence["reproducibility"]
    g6_ref = evidence["g6_validation_reference"]

    lines = [
        "# Model V2 G7 — KNHANES 2023 Temporal Korean Transportability Result",
        "",
        f"Status: **{gate['decision']}**",
        "",
        "## Interpretation",
        "",
        "This is a temporal Korean transportability evaluation with a",
        "predeclared sleep-measurement instrument shift. It is not an exact",
        "same-instrument replication and is not an independent-source",
        "external validation.",
        "",
        "The model remains an `입력 기반 위험군 선별 신호`; this result does",
        "not establish diagnosis, future risk, treatment, prevention, or",
        "causal improvement.",
        "",
        "## Frozen candidate",
        "",
        "- candidate: `logistic_regression`",
        "- fit set: full G3 development only",
        f"- development rows: **{int(evidence['development_rows']):,}**",
        f"- development PSU groups: **{int(evidence['development_psu_groups']):,}**",
        "- G6 validation labels used for fitting: **False**",
        "- threshold selection: **False**",
        "- recalibration: **False**",
        "- model/feature/hyperparameter changes: **False**",
        "",
        "## External cohort",
        "",
        "- source: `hn23_all.sas7bdat`",
        f"- source SHA-256: `{provenance['external_source_sha256']}`",
        f"- eligible external rows: **{int(evidence['external_rows']):,}**",
        f"- external PSU groups: **{int(evidence['external_psu_groups']):,}**",
        "",
        "Sleep harmonization was frozen before performance access:",
        "",
        "- `weekday_sleep_minutes = BP16_1 * 60`",
        "- `weekend_sleep_minutes = BP16_2 * 60`",
        "- `88` / `99` -> missing",
        "",
        "## External performance",
        "",
        "| Metric | Survey-weighted | Unweighted sensitivity |",
        "| --- | ---: | ---: |",
        f"| AUROC | {weighted['auroc']:.9f} | {unweighted['auroc']:.9f} |",
        f"| Average precision | {weighted['average_precision']:.9f} | {unweighted['average_precision']:.9f} |",
        f"| Brier score | {weighted['brier']:.9f} | {unweighted['brier']:.9f} |",
        "",
        f"- calibration intercept: **{calibration['intercept']:.9f}**",
        f"- calibration slope: **{calibration['slope']:.9f}**",
        f"- G6 weighted validation AUROC reference: **{g6_ref['weighted_auroc']:.9f}**",
        f"- G6 validation minus external AUROC: **{g6_ref['weighted_auroc'] - weighted['auroc']:.9f}**",
        "",
        "## Frozen G7 gate",
        "",
    ]
    for name, passed in gate["criteria"].items():
        lines.append(f"- `{name}`: **{bool(passed)}**")

    lines.extend(
        [
            "",
            f"Decision: **{gate['decision']}**",
            "",
            "A STOP decision is terminal for this candidate at G7 and must not",
            "be repaired using external-performance feedback.",
            "",
            "## Reproducibility",
            "",
            "- two fresh full-development fits: **True**",
            f"- max absolute probability difference: **{float(repro['max_abs_probability_difference']):.3e}**",
            f"- required tolerance: **{float(repro['required_atol']):.3e}**",
            f"- reproducibility passed: **{bool(repro['passed'])}**",
            "",
            "## Descriptive subgroup audit",
            "",
            "Subgroup results are descriptive only and were not used for",
            "selection, tuning, threshold choice, or recalibration.",
            "",
            "### Sex",
            "",
            "| Sex code | Rows | Weighted AUROC | Weighted AP | Weighted Brier |",
            "| --- | ---: | ---: | ---: | ---: |",
        ]
    )

    for key, item in evidence["subgroups"]["sex"].items():
        auroc = "NA" if item["weighted_auroc"] is None else f"{item['weighted_auroc']:.9f}"
        ap = "NA" if item["weighted_average_precision"] is None else f"{item['weighted_average_precision']:.9f}"
        brier = "NA" if item["weighted_brier"] is None else f"{item['weighted_brier']:.9f}"
        lines.append(f"| {key} | {int(item['rows']):,} | {auroc} | {ap} | {brier} |")

    lines.extend(
        [
            "",
            "### Age",
            "",
            "| Age band | Rows | Weighted AUROC | Weighted AP | Weighted Brier |",
            "| --- | ---: | ---: | ---: | ---: |",
        ]
    )
    for key, item in evidence["subgroups"]["age"].items():
        auroc = "NA" if item["weighted_auroc"] is None else f"{item['weighted_auroc']:.9f}"
        ap = "NA" if item["weighted_average_precision"] is None else f"{item['weighted_average_precision']:.9f}"
        brier = "NA" if item["weighted_brier"] is None else f"{item['weighted_brier']:.9f}"
        lines.append(f"| {key} | {int(item['rows']):,} | {auroc} | {ap} | {brier} |")

    lines.extend(
        [
            "",
            "## Safety",
            "",
            "- external performance used for model change: **False**",
            "- G6 validation participant data read: **False**",
            "- KNHANES 2024 final-test file read: **False**",
            "- V1 validation/test used: **False**",
            "- production serialization: **False**",
            "",
            "Participant-level external cohort, predictions, and full evidence",
            "remain outside Git.",
            "",
            "KNHANES 2024 final internal test remains locked until explicit G8",
            "approval.",
            "",
            "## Provenance",
            "",
            f"- execution commit: `{evidence['execution_commit']}`",
            f"- config SHA-256: `{evidence['config_sha256']}`",
            f"- development SHA-256: `{provenance['development_sha256']}`",
            f"- G3 manifest SHA-256: `{provenance['g3_manifest_sha256']}`",
            f"- G5 evidence SHA-256: `{provenance['g5_evidence_sha256']}`",
            f"- G6 evidence SHA-256: `{provenance['g6_evidence_sha256']}`",
            f"- G7-A evidence SHA-256: `{provenance['g7a_evidence_sha256']}`",
            "",
        ]
    )

    out = args.out.expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")

    print("wrote:", out)
    print("G7 repository-safe result:", gate["decision"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
