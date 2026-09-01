"""Freeze preprocessing statistics and row splits for one derived table."""

import argparse
import hashlib
import json
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

parser = argparse.ArgumentParser()
parser.add_argument("table", type=Path)
parser.add_argument("output_dir", type=Path)
args = parser.parse_args()

manifest = json.loads(Path("data/manifest/nhanes_2017_2020.json").read_text(encoding="utf-8"))
target = manifest["label"]["name"]
seed = manifest["split"]["seed"]
frame = pd.read_parquet(args.table)
features = manifest["candidate_predictors"]

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
for name, partition in {"train": train, "validation": validation, "test": test}.items():
    partition.sort_values("SEQN").to_parquet(args.output_dir / f"{name}.parquet", index=False)

digest_input = "\n".join(
    f"{name}:{','.join(map(str, sorted(partition.SEQN.tolist())))}"
    for name, partition in {"train": train, "validation": validation, "test": test}.items()
)
metadata = {
    "seed": seed,
    "features": features,
    "fill_values": fill_values,
    "split_digest": hashlib.sha256(digest_input.encode()).hexdigest(),
}
(args.output_dir / "split_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
print(f"split digest: {metadata['split_digest']}")
