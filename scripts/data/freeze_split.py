"""Freeze type-aware preprocessing and row splits for one derived table."""

import argparse
import json
import re
from pathlib import Path

import pandas as pd
from contract import MANIFEST_PATH, ROOT, load_manifest, outside_repository
from preparation import sha256, split_table, write_splits


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("table", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--evidence", type=Path)
    parser.add_argument("--commit")
    args = parser.parse_args()
    if bool(args.evidence) != bool(args.commit):
        parser.error("--evidence and --commit must be provided together")
    if args.commit and re.fullmatch(r"[0-9a-f]{40}", args.commit) is None:
        parser.error("--commit must be a full lowercase 40-character Git SHA")
    table_path, output = outside_repository(args.table), outside_repository(args.output_dir)
    evidence_path = outside_repository(args.evidence) if args.evidence else None
    if output.exists() or (evidence_path and evidence_path.exists()):
        raise ValueError("output already exists; choose a new work directory")
    manifest = load_manifest()
    frame = pd.read_parquet(table_path)
    partitions, fill_values = split_table(frame, manifest)
    metadata = write_splits(partitions, fill_values, output, manifest)
    if evidence_path:
        evidence = {
            "schema_version": 1,
            "gate": "model_gate_1b",
            "status": "prepared_not_trained",
            "repository_commit": args.commit,
            "dataset_id": manifest["dataset_id"],
            "manifest_sha256": sha256(MANIFEST_PATH),
            "toolchain_lock_sha256": sha256(ROOT / "uv.lock"),
            "derived_table_sha256": sha256(table_path),
            "split_digest": metadata["split_digest"],
            "seed": manifest["split"]["seed"],
            "features": manifest["candidate_predictors"],
            "label": manifest["label"]["name"],
            "prohibited_predictors_absent": True,
            "row_counts": {"total": len(frame), **metadata["row_counts"]},
            "partition_sha256": metadata["partition_sha256"],
        }
        evidence_path.parent.mkdir(parents=True, exist_ok=True)
        evidence_path.write_text(json.dumps(evidence, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print("frozen split and evidence: passed")


if __name__ == "__main__":
    main()
