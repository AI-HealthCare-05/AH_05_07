#!/usr/bin/env python3
"""
KNHANES 2024 G2-A candidate feasibility audit.

No model fitting, splitting, performance metrics, feature ranking,
calibration, or threshold selection.

Outputs only:
- candidate column presence
- official SAS labels
- aggregate non-null/missing counts
- low-cardinality aggregate code counts
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import pyreadstat


CANDIDATES = [
    # target / leakage audit
    "HE_HP",
    "HE_sbp",
    "HE_dbp",
    "DI1_dg",
    "DI1_pr",
    "DI1_pt",
    "DI1_2",

    # minimal product-input candidates
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

    # sleep candidates from the Cycle 9 guide
    "BP16_1",
    "BP16_2",
    "BP16_11",
    "BP16_12",
    "BP16_13",
    "BP16_14",
    "BP16_21",
    "BP16_22",
    "BP16_23",
    "BP16_24",
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def find_main(root: Path) -> Path:
    matches = sorted(
        p.resolve()
        for p in (root / "raw").rglob("hn24_all.sas7bdat")
        if p.is_file()
    )
    if not matches:
        raise SystemExit("STOP: hn24_all.sas7bdat not found")
    hashes = {sha256(p) for p in matches}
    if len(hashes) != 1:
        raise SystemExit("STOP: multiple non-identical hn24_all files found")
    return matches[0]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=Path, required=True)
    args = ap.parse_args()

    root = args.root.expanduser().resolve()
    sas = find_main(root)
    audit_dir = root / "audit"
    audit_dir.mkdir(parents=True, exist_ok=True)

    _, meta = pyreadstat.read_sas7bdat(str(sas), metadataonly=True)
    columns = set(meta.column_names)
    labels = dict(meta.column_names_to_labels or {})

    present = [c for c in CANDIDATES if c in columns]
    absent = [c for c in CANDIDATES if c not in columns]

    df, _ = pyreadstat.read_sas7bdat(str(sas), usecols=present)

    variables = {}
    for c in present:
        s = df[c]
        n_unique = int(s.nunique(dropna=True))
        counts = None
        if n_unique <= 30:
            vc = s.value_counts(dropna=False)
            counts = {str(k): int(v) for k, v in vc.items()}

        variables[c] = {
            "label": labels.get(c),
            "non_null": int(s.notna().sum()),
            "missing": int(s.isna().sum()),
            "n_unique_non_null": n_unique,
            "aggregate_code_counts_if_low_cardinality": counts,
        }

    out = {
        "audit_gate": "Model V2 G2-A",
        "dataset": "KNHANES 2024 annual main DB",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_file": sas.name,
        "source_sha256": sha256(sas),
        "candidate_columns_present": present,
        "candidate_columns_absent": absent,
        "variables": variables,
        "safety": {
            "participant_values_written": False,
            "model_fitting_performed": False,
            "split_performed": False,
            "performance_metrics_computed": False,
            "feature_ranking_performed": False,
            "calibration_performed": False,
            "threshold_selection_performed": False,
        },
    }

    dest = audit_dir / "candidate-feasibility-2024.json"
    dest.write_text(
        json.dumps(out, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("=== KNHANES 2024 G2-A candidate feasibility ===")
    print("source:", sas.name)
    print("\n[present]")
    for c in present:
        v = variables[c]
        print(
            f"{c}: {v['label']} | "
            f"non_null={v['non_null']} missing={v['missing']} "
            f"unique={v['n_unique_non_null']}"
        )

    print("\n[absent]")
    for c in absent:
        print(c)

    print("\nwrote:", dest)
    for k, v in out["safety"].items():
        print(f"{k}: {v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
