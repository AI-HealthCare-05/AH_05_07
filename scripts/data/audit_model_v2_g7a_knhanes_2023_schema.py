#!/usr/bin/env python3
"""Metadata-only KNHANES 2023 schema audit for Model V2 G7-A."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

import pyreadstat

PREDICTOR_SOURCE_COLUMNS = [
    "age",
    "sex",
    "HE_ht",
    "HE_wt",
    "BS1_1",
    "BS3_1",
    "BD1_11",
    "BD2_1",
    "BE3_31",
    "BE3_32",
    "BE3_33",
    "BE5_1",
    "BP16_11",
    "BP16_12",
    "BP16_13",
    "BP16_14",
    "BP16_21",
    "BP16_22",
    "BP16_23",
    "BP16_24",
]

TARGET_AND_COHORT_COLUMNS = [
    "ID",
    "HE_HP",
    "HE_prg",
    "wt_itvex",
    "kstrata",
    "psu",
]

LEAKAGE_GUARD_COLUMNS = [
    "HE_sbp1",
    "HE_dbp1",
    "HE_sbp2",
    "HE_dbp2",
    "HE_sbp3",
    "HE_dbp3",
    "HE_sbp",
    "HE_dbp",
    "DI1_dg",
    "DI1_ag",
    "DI1_pr",
    "DI1_pt",
    "DI1_2",
]

REQUIRED_COLUMNS = PREDICTOR_SOURCE_COLUMNS + TARGET_AND_COHORT_COLUMNS + LEAKAGE_GUARD_COLUMNS


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def outside_repo(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    cwd = Path.cwd().resolve()
    try:
        import subprocess

        repo = Path(
            subprocess.run(
                ["git", "rev-parse", "--show-toplevel"],
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()
        ).resolve()
    except Exception:
        repo = cwd
    if resolved == repo or repo in resolved.parents:
        raise SystemExit("STOP: raw KNHANES files/evidence must remain outside Git")
    return resolved


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sas", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    sas = outside_repo(args.sas)
    output = outside_repo(args.output)

    if not sas.exists() or not sas.is_file():
        raise SystemExit("STOP: KNHANES 2023 SAS file not found")
    if sas.suffix.lower() != ".sas7bdat":
        raise SystemExit("STOP: expected .sas7bdat file")
    if output.exists():
        raise SystemExit("STOP: G7-A output already exists")

    # Crucial boundary: metadataonly=True asks pyreadstat for metadata without
    # returning participant-level rows.
    frame, meta = pyreadstat.read_sas7bdat(str(sas), metadataonly=True)
    if len(frame) != 0:
        raise SystemExit("STOP: metadata-only reader unexpectedly returned rows")

    columns = list(meta.column_names)
    column_set = set(columns)
    missing = [name for name in REQUIRED_COLUMNS if name not in column_set]

    labels: dict[str, str | None] = {}
    label_map = dict(zip(meta.column_names, meta.column_labels, strict=True))
    for name in REQUIRED_COLUMNS:
        labels[name] = label_map.get(name)

    decision = "APPROVE_KNHANES_2023_FOR_G7" if not missing else "NEEDS_CONTRACT_MAPPING_REVISION"

    output.mkdir(parents=True, exist_ok=False)
    evidence = {
        "schema_version": 1,
        "gate": "Model V2 G7-A",
        "status": "metadata_only_schema_screen_complete",
        "created_at_utc": datetime.now(UTC).isoformat(),
        "source": {
            "filename": sas.name,
            "sha256": sha256(sas),
            "participant_rows_read": False,
            "metadata_only": True,
            "column_count": len(columns),
        },
        "required_columns": REQUIRED_COLUMNS,
        "missing_required_columns": missing,
        "required_column_labels": labels,
        "documentation_semantics_reviewed": True,
        "performance_accessed": False,
        "target_prevalence_accessed": False,
        "participant_values_accessed": False,
        "decision": decision,
        "safety": {
            "participant_rows_read": False,
            "target_distribution_inspected": False,
            "model_fitting_performed": False,
            "predictions_computed": False,
            "performance_metrics_computed": False,
            "knhanes_2024_final_test_accessed": False,
            "v1_validation_or_test_accessed": False,
        },
    }

    evidence_path = output / "g7a-knhanes-2023-schema-evidence.json"
    evidence_path.write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("=== Model V2 G7-A KNHANES 2023 metadata-only schema audit ===")
    print("source:", sas)
    print("source SHA-256:", evidence["source"]["sha256"])
    print("columns:", len(columns))
    print("participant rows read: False")
    print("target prevalence accessed: False")
    print("performance accessed: False")
    print("missing required columns:", missing)
    print("G7-A decision:", decision)
    print("evidence:", evidence_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
