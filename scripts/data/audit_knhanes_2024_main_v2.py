#!/usr/bin/env python3
"""
KNHANES 2024 Model V2 G2-A strict annual-main schema audit.

This audit:
- accepts ONLY hn24_all.sas7bdat / hn24_all.xpt
- ignores hn24_24rc and every other detail DB
- uses strict BP matching (HE_sbp*/HE_dbp* only)
- writes schema/aggregate metadata only
- performs no modelling, splitting, scoring, calibration, thresholding,
  or outcome-based feature selection
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


EXPECTED_NAMES = {"hn24_all.sas7bdat", "hn24_all.xpt"}

PATTERNS = {
    "age": re.compile(r"^age$", re.I),
    "sex_gender": re.compile(r"^sex$", re.I),

    # Strict: do not confuse BP_PHQ / BP_GAD with blood pressure.
    "blood_pressure": re.compile(r"^HE_(?:sbp|dbp)(?:[123])?$", re.I),

    "anthropometry": re.compile(
        r"^HE_(?:ht|wt|wc|BMI|BMI_pct)$", re.I
    ),

    # Domain discovery only; exact semantics still require the official codebook.
    "smoking": re.compile(r"^(?:BS|sm_)", re.I),
    "alcohol": re.compile(r"^BD", re.I),
    "physical_activity": re.compile(r"^(?:BE|pa_)", re.I),

    # Intentionally broad for discovery; absence is not interpreted as proof
    # that sleep was not surveyed until checked against official docs.
    "sleep": re.compile(r"(?:sleep|slp|^SL[_0-9A-Za-z])", re.I),

    "survey_design": re.compile(
        r"^(?:psu|kstrata|wt_[A-Za-z0-9_]+)$", re.I
    ),

    # Documentation candidates, not model predictors.
    "hypertension_history_or_medication": re.compile(
        r"(?:hypert|htn|^HE_HP|^DI1)", re.I
    ),
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def read_main(path: Path) -> pd.DataFrame:
    if path.name.lower() not in EXPECTED_NAMES:
        raise RuntimeError(
            f"Refusing non-main KNHANES DB: {path.name}. "
            "Expected hn24_all.sas7bdat or hn24_all.xpt."
        )

    if path.suffix.lower() == ".sas7bdat":
        return pd.read_sas(path, format="sas7bdat")
    if path.suffix.lower() == ".xpt":
        return pd.read_sas(path, format="xport")
    raise RuntimeError(path)


def choose_main(raw_dir: Path) -> Path:
    candidates = [
        p.resolve()
        for p in raw_dir.rglob("*")
        if p.is_file() and p.name.lower() in EXPECTED_NAMES
    ]

    if not candidates:
        raise SystemExit(
            f"STOP: hn24_all main DB not found directly in {raw_dir}"
        )

    if len(candidates) > 1:
        hashes = {sha256(p) for p in candidates}
        if len(hashes) != 1:
            raise SystemExit(
                "STOP: multiple non-identical hn24_all files found. "
                "Resolve provenance before continuing."
            )

    return sorted(candidates)[0]


def variable_meta(df: pd.DataFrame, name: str) -> dict:
    s = df[name]
    return {
        "name": name,
        "dtype": str(s.dtype),
        "non_null": int(s.notna().sum()),
        "missing": int(s.isna().sum()),
        "n_unique_non_null": int(s.nunique(dropna=True)),
    }


def small_code_counts(df: pd.DataFrame, name: str) -> dict | None:
    """
    Aggregate code counts only for low-cardinality variables.
    Continuous variables are never dumped.
    """
    s = df[name]
    n_unique = int(s.nunique(dropna=True))
    if n_unique > 20:
        return None

    counts = s.value_counts(dropna=False).head(30)
    return {
        str(k): int(v)
        for k, v in counts.items()
    }


def age_groups(df: pd.DataFrame) -> dict:
    if "age" not in df.columns:
        return {"available": False}

    s = pd.to_numeric(df["age"], errors="coerce")
    bins = [-float("inf"), 18, 30, 40, 50, 60, 70, 80, float("inf")]
    labels = [
        "under_18",
        "18_29",
        "30_39",
        "40_49",
        "50_59",
        "60_69",
        "70_79",
        "80_plus",
    ]

    grouped = pd.cut(s, bins=bins, labels=labels, right=False)
    vc = grouped.value_counts(sort=False, dropna=False)

    return {
        "available": True,
        "column": "age",
        "counts": {str(k): int(v) for k, v in vc.items()},
        "missing_numeric": int(s.isna().sum()),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, type=Path)
    args = ap.parse_args()

    root = args.root.expanduser().resolve()
    raw_dir = root / "raw"
    audit_dir = root / "audit"
    audit_dir.mkdir(parents=True, exist_ok=True)

    main_file = choose_main(raw_dir)
    df = read_main(main_file)
    columns = [str(c) for c in df.columns]

    groups = {
        group: [c for c in columns if pattern.search(c)]
        for group, pattern in PATTERNS.items()
    }

    candidate_schema = {
        group: [variable_meta(df, c) for c in names]
        for group, names in groups.items()
    }

    low_cardinality_counts = {}
    for group in (
        "sex_gender",
        "smoking",
        "alcohol",
        "physical_activity",
        "sleep",
        "hypertension_history_or_medication",
    ):
        low_cardinality_counts[group] = {}
        for c in groups[group]:
            counts = small_code_counts(df, c)
            if counts is not None:
                low_cardinality_counts[group][c] = counts

    # Required structural checks only, not target definition.
    expected_bp = [
        "HE_sbp1", "HE_dbp1",
        "HE_sbp2", "HE_dbp2",
        "HE_sbp3", "HE_dbp3",
        "HE_sbp", "HE_dbp",
    ]
    bp_presence = {
        name: name in df.columns
        for name in expected_bp
    }

    output = {
        "audit_gate": "Model V2 G2-A",
        "dataset": "KNHANES 2024 annual main DB",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_file": {
            "name": main_file.name,
            "bytes": main_file.stat().st_size,
            "sha256": sha256(main_file),
            "rows": int(df.shape[0]),
            "columns": int(df.shape[1]),
        },
        "strict_main_db_only": True,
        "ignored_detail_databases": True,
        "participant_values_written": False,
        "model_fitting_performed": False,
        "split_performed": False,
        "performance_metrics_computed": False,
        "feature_ranking_performed": False,
        "candidate_column_matches": groups,
        "candidate_schema": candidate_schema,
        "low_cardinality_aggregate_code_counts": low_cardinality_counts,
        "expected_bp_component_presence": bp_presence,
        "age_group_counts": age_groups(df),
        "unresolved": [
            "Exact 2024 codebook semantics for every candidate predictor remain to be reviewed.",
            "Sleep variable absence from automatic discovery is unresolved until official codebook review.",
            "Final BP target formula is not selected.",
            "Medication/history contribution to the target is not selected.",
            "Survey-weight role is not selected.",
            "Product-supported age range is not selected.",
        ],
    }

    out = audit_dir / "schema-audit-2024-main-v2.json"
    out.write_text(
        json.dumps(output, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("=== KNHANES 2024 G2-A strict main-DB audit ===")
    print(
        f"source: {main_file.name} "
        f"rows={df.shape[0]} cols={df.shape[1]}"
    )
    for group in (
        "blood_pressure",
        "age",
        "sex_gender",
        "anthropometry",
        "smoking",
        "alcohol",
        "physical_activity",
        "sleep",
        "survey_design",
        "hypertension_history_or_medication",
    ):
        print(f"{group}: {groups[group]}")

    print("BP component presence:")
    for k, v in bp_presence.items():
        print(f"  {k}: {v}")

    print("age groups:", output["age_group_counts"])
    print(f"wrote: {out}")
    print("model fitting: False")
    print("split performed: False")
    print("performance metrics: False")
    print("feature ranking: False")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
