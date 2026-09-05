"""Freeze preprocessing statistics and row splits for one derived table."""

import argparse
import hashlib
import json
import re
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

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

manifest_path = Path("data/manifest/nhanes_2017_2020.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
target = manifest["label"]["name"]
seed = manifest["split"]["seed"]
frame = pd.read_parquet(args.table)
features = manifest["candidate_predictors"]
prohibited = set(manifest["label"]["prohibited_predictors"])
assert not prohibited & set(frame.columns)

train, holdout = train_test_split(frame, test_size=0.3, random_state=seed, stratify=frame[target])
validation, test = train_test_split(holdout, test_size=0.5, random_state=seed, stratify=holdout[target])

fill_values: dict[str, float | str] = {}
for feature in features:
    if pd.api.types.is_numeric_dtype(train[feature]):
        fill_values[feature] = float(train[feature].median())
    else:
        fill_values[feature] = "__MISSING__"
    for partition in (train, validation, test):
        partition[feature] = partition[feature].fillna(fill_values[feature])

args.output_dir.mkdir(parents=True, exist_ok=True)
partitions = {"train": train, "validation": validation, "test": test}
partition_paths: dict[str, Path] = {}
for name, partition in partitions.items():
    path = args.output_dir / f"{name}.parquet"
    partition.sort_values("SEQN").to_parquet(path, index=False)
    partition_paths[name] = path

digest_input = "\n".join(
    f"{name}:{','.join(map(str, sorted(partition.SEQN.tolist())))}" for name, partition in partitions.items()
)
metadata = {
    "seed": seed,
    "features": features,
    "fill_values": fill_values,
    "split_digest": hashlib.sha256(digest_input.encode()).hexdigest(),
    "row_counts": {name: len(partition) for name, partition in partitions.items()},
    "partition_sha256": {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in partition_paths.items()},
}
(args.output_dir / "split_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
print(f"split digest: {metadata['split_digest']}")

if args.evidence:
    evidence = {
        "schema_version": 1,
        "gate": "model_gate_1b",
        "status": "prepared_not_trained",
        "repository_commit": args.commit,
        "dataset_id": manifest["dataset_id"],
        "manifest_sha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
        "toolchain_lock_sha256": hashlib.sha256(Path("uv.lock").read_bytes()).hexdigest(),
        "derived_table_sha256": hashlib.sha256(args.table.read_bytes()).hexdigest(),
        "split_digest": metadata["split_digest"],
        "seed": seed,
        "features": features,
        "label": target,
        "prohibited_predictors_absent": True,
        "row_counts": {"total": len(frame), **metadata["row_counts"]},
        "partition_sha256": metadata["partition_sha256"],
    }
    args.evidence.parent.mkdir(parents=True, exist_ok=True)
    args.evidence.write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    print(f"sanitized evidence: {args.evidence}")
