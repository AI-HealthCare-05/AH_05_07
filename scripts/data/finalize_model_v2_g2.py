#!/usr/bin/env python3
"""
Finalize Model V2 G2 from aggregate KNHANES 2024 audit outputs.

Reads only previously generated aggregate JSON files from the external data root
and writes a repository-safe Markdown summary.

No participant-level rows are read or written by this script.
No model fitting, splitting, scoring, feature ranking, calibration, or threshold
selection is performed.
"""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path


TARGET_COMPONENTS = [
    "HE_HP",
    "HE_sbp",
    "HE_dbp",
    "DI1_dg",
    "DI1_pr",
    "DI1_pt",
    "DI1_2",
]

PRODUCT_CANDIDATES = [
    "age",
    "sex",
    "HE_ht",
    "HE_wt",
    "HE_BMI",
    "BS3_1",
    "BD1_11",
    "BD2_14",
    "BE3_31",
    "BE3_32",
    "BE3_33",
    "BE5_1",
    "pa_aerobic",
    "BP16_1",
    "BP16_2",
]

LEAKAGE_EXCLUSIONS = [
    "HE_sbp1",
    "HE_dbp1",
    "HE_sbp2",
    "HE_dbp2",
    "HE_sbp3",
    "HE_dbp3",
    "HE_sbp",
    "HE_dbp",
    "HE_HP",
    "DI1_dg",
    "DI1_pr",
    "DI1_pt",
    "DI1_2",
]


def pct(n: int, d: int) -> str:
    if d <= 0:
        return "n/a"
    return f"{(100*n/d):.1f}%"


def load_json(path: Path) -> dict:
    if not path.exists():
        raise SystemExit(f"STOP: missing audit file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def row_for(name: str, variables: dict, total_rows: int) -> str:
    v = variables.get(name)
    if not v:
        return f"| `{name}` | absent | — | — | — |"
    non_null = int(v.get("non_null", 0))
    missing = int(v.get("missing", 0))
    label = str(v.get("label") or "").replace("|", "\\|")
    return (
        f"| `{name}` | present | {label} | "
        f"{non_null:,} | {missing:,} ({pct(missing, total_rows)}) |"
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--audit-root", type=Path, required=True)
    ap.add_argument("--repo-out", type=Path, required=True)
    args = ap.parse_args()

    audit_root = args.audit_root.expanduser().resolve()
    repo_out = args.repo_out.expanduser().resolve()

    feasibility = load_json(audit_root / "candidate-feasibility-2024.json")
    schema = load_json(audit_root / "schema-audit-2024-main-v2.json")
    semantic = load_json(audit_root / "semantic-audit-2024-main.json")

    source = schema["source_file"]
    total_rows = int(source["rows"])
    total_cols = int(source["columns"])
    variables = feasibility.get("variables", {})

    safety = feasibility.get("safety", {})
    required_false = [
        "participant_values_written",
        "model_fitting_performed",
        "split_performed",
        "performance_metrics_computed",
        "feature_ranking_performed",
        "calibration_performed",
        "threshold_selection_performed",
    ]
    bad = [k for k in required_false if safety.get(k) is not False]
    if bad:
        raise SystemExit(f"STOP: unsafe or unknown audit flags: {bad}")

    age_counts = schema.get("age_group_counts", {}).get("counts", {})

    lines = []
    lines.append("# Model V2 G2 — KNHANES 2024 Schema and Feasibility Audit")
    lines.append("")
    lines.append(
        f"Status: **G2 audit complete — proceed to G3 design only; model fitting remains prohibited**"
    )
    lines.append("")
    lines.append("## 1. Scope")
    lines.append("")
    lines.append(
        "This document closes the bounded G2-A audit for the approved Model V2-A "
        "Korean cross-sectional screening research path."
    )
    lines.append("")
    lines.append("The audit used KNHANES 2024 annual main database metadata and aggregate counts only.")
    lines.append("")
    lines.append("No participant-level record is stored in this repository.")
    lines.append("")
    lines.append("## 2. Source")
    lines.append("")
    lines.append(f"- file: `{source['name']}`")
    lines.append(f"- rows: **{total_rows:,}**")
    lines.append(f"- columns: **{total_cols:,}**")
    lines.append(f"- SHA-256: `{source['sha256']}`")
    lines.append("- participant-level source remains outside Git")
    lines.append("")
    lines.append("The earlier nutrition-detail file `hn24_24rc` was identified as the wrong sub-database and excluded from the strict main-DB audit.")
    lines.append("")
    lines.append("## 3. Safety boundary verification")
    lines.append("")
    for key in required_false:
        lines.append(f"- `{key}`: **False**")
    lines.append("")
    lines.append("Therefore G2 contains no model-selection evidence.")
    lines.append("")
    lines.append("## 4. Blood-pressure and target components")
    lines.append("")
    bp_names = schema.get("candidate_column_matches", {}).get("blood_pressure", [])
    for name in bp_names:
        label = semantic.get("variables", {}).get(name, {}).get("label", "")
        lines.append(f"- `{name}` — {label}")
    lines.append("")
    lines.append(
        "`HE_sbp` and `HE_dbp` are labeled as final systolic/diastolic pressure values "
        "derived from the second and third measurements."
    )
    lines.append("")
    lines.append(
        "`HE_HP` is retained as the preferred **target candidate**, not a predictor. "
        "Its exact category-code contract must be copied from the official 2024 user guide/codebook "
        "and frozen in G3 before any modelling."
    )
    lines.append("")
    lines.append(
        "Because hypertension diagnosis/treatment/medication variables are target-adjacent and may "
        "participate in the official hypertension-state definition, they are excluded from predictors."
    )
    lines.append("")
    lines.append("### Target/leakage availability")
    lines.append("")
    lines.append("| Variable | Status | Official label | Non-null | Missing |")
    lines.append("| --- | --- | --- | ---: | ---: |")
    for name in TARGET_COMPONENTS:
        lines.append(row_for(name, variables, total_rows))
    lines.append("")
    lines.append("## 5. Predictor leakage exclusions")
    lines.append("")
    lines.append("The following must not be candidate predictors for the current BP-related target design:")
    lines.append("")
    for name in LEAKAGE_EXCLUSIONS:
        lines.append(f"- `{name}`")
    lines.append("")
    lines.append(
        "This includes direct BP measurements, the derived hypertension state, and "
        "current diagnosis/treatment/medication variables."
    )
    lines.append("")
    lines.append("## 6. Product-input feasibility candidates")
    lines.append("")
    lines.append(
        "These variables are feasibility candidates only. G2 does not select a final feature set."
    )
    lines.append("")
    lines.append("| Variable | Status | Official label | Non-null | Missing |")
    lines.append("| --- | --- | --- | ---: | ---: |")
    for name in PRODUCT_CANDIDATES:
        lines.append(row_for(name, variables, total_rows))
    lines.append("")
    lines.append("### Current interpretation")
    lines.append("")
    lines.append("- `age`: strong product-native candidate.")
    lines.append("- `sex`: candidate only if the product input preserves the KNHANES survey meaning; do not silently reinterpret it as gender identity.")
    lines.append("- `HE_ht` + `HE_wt`: preferred product-facing anthropometry inputs; BMI can be calculated identically in product code.")
    lines.append("- `HE_BMI`: research convenience field; product parity requires deriving BMI from product-entered height/weight rather than asking users for BMI.")
    lines.append("- `BS3_1`: compact current-cigarette-smoking candidate.")
    lines.append("- `BD1_11` + `BD2_14`: compact drinking frequency/amount candidates.")
    lines.append("- walking / strength / aerobic activity candidates remain to be reduced to the smallest semantically reproducible questionnaire contract.")
    lines.append("- `BP16_1` / `BP16_2`: sleep-duration candidates if present and confirmed by the official codebook.")
    lines.append("")
    lines.append("## 7. Age feasibility")
    lines.append("")
    lines.append("| Age band | Count |")
    lines.append("| --- | ---: |")
    for key in ["under_18", "18_29", "30_39", "40_49", "50_59", "60_69", "70_79", "80_plus"]:
        if key in age_counts:
            lines.append(f"| {key} | {int(age_counts[key]):,} |")
    lines.append("")
    lines.append(
        "G2 does not choose a supported product age range from predictive performance."
    )
    lines.append("")
    lines.append("## 8. Survey design")
    lines.append("")
    survey_vars = schema.get("candidate_column_matches", {}).get("survey_design", [])
    lines.append("Available survey-design fields include:")
    lines.append("")
    for name in survey_vars:
        lines.append(f"- `{name}`")
    lines.append("")
    lines.append(
        "The modelling/evaluation role of survey weights, strata and PSU is deferred to the G3 statistical design contract."
    )
    lines.append("")
    lines.append("## 9. G2 decision")
    lines.append("")
    lines.append("**Proceed to G3 design.**")
    lines.append("")
    lines.append("G2 establishes that KNHANES 2024 is structurally suitable for the V2-A design because:")
    lines.append("")
    lines.append("- repeated and final BP measurements are present;")
    lines.append("- a hypertension-state target candidate is present;")
    lines.append("- realistic non-invasive product inputs are available;")
    lines.append("- survey-design fields are available;")
    lines.append("- the dataset covers a broad age range;")
    lines.append("- leakage-prone diagnosis/treatment/medication fields can be explicitly excluded.")
    lines.append("")
    lines.append("## 10. G3 must freeze before modelling")
    lines.append("")
    lines.append("G3 must explicitly freeze:")
    lines.append("")
    lines.append("1. exact cohort eligibility and age range;")
    lines.append("2. exact `HE_HP` category-code mapping from the official 2024 guide;")
    lines.append("3. binary target definition and excluded/missing categories;")
    lines.append("4. predictor list and exact Korean product-question semantics;")
    lines.append("5. BMI research/product parity rule;")
    lines.append("6. survey-weight / strata / PSU handling;")
    lines.append("7. missing/refused/not-applicable handling;")
    lines.append("8. development / validation / final-test roles;")
    lines.append("9. physical/logical protection of the new V2 final test;")
    lines.append("10. metric hierarchy before any model-family comparison.")
    lines.append("")
    lines.append("Until G3 is merged:")
    lines.append("")
    lines.append("- model fitting: **prohibited**")
    lines.append("- train/validation/test split: **prohibited**")
    lines.append("- feature ranking by outcome performance: **prohibited**")
    lines.append("- calibration/threshold tuning: **prohibited**")
    lines.append("- V1 validation/test reuse: **prohibited**")
    lines.append("- production scoring: **disabled**")
    lines.append("")
    lines.append(f"_Generated from aggregate G2 audit outputs on {date.today().isoformat()}._")
    lines.append("")

    repo_out.parent.mkdir(parents=True, exist_ok=True)
    repo_out.write_text("\n".join(lines), encoding="utf-8")

    print(f"wrote: {repo_out}")
    print(f"rows: {total_rows}")
    print(f"columns: {total_cols}")
    print("G2 decision: proceed to G3 design")
    print("model fitting: False")
    print("split performed: False")
    print("performance metrics: False")
    print("feature ranking: False")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
