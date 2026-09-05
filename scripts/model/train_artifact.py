"""Train one local logistic baseline and write verified artifact metadata."""

import argparse
import hashlib
import json
from pathlib import Path

import joblib
import pandas as pd
from preprocessing import make_preprocessor
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

parser = argparse.ArgumentParser()
parser.add_argument("split_dir", type=Path)
parser.add_argument("artifact", type=Path)
parser.add_argument("metadata", type=Path)
parser.add_argument("--version", required=True)
args = parser.parse_args()

manifest = json.loads(Path("data/manifest/nhanes_2017_2020.json").read_text(encoding="utf-8"))
split_metadata = json.loads((args.split_dir / "split_metadata.json").read_text(encoding="utf-8"))
if (
    split_metadata.get("semantics_version") != manifest["semantics_version"]
    or split_metadata.get("features") != manifest["candidate_predictors"]
):
    raise ValueError("split metadata does not match the versioned feature semantics")
features = manifest["candidate_predictors"]
target = manifest["label"]["name"]
train = pd.read_parquet(args.split_dir / "train.parquet")

model = Pipeline(
    [
        ("preprocess", make_preprocessor(manifest, split_metadata["fill_values"])),
        ("model", LogisticRegression(max_iter=2000)),
    ]
)
model.fit(train[features], train[target])
args.artifact.parent.mkdir(parents=True, exist_ok=True)
joblib.dump(model, args.artifact)
artifact_hash = hashlib.sha256(args.artifact.read_bytes()).hexdigest()
args.metadata.write_text(
    json.dumps(
        {
            "model_version": args.version,
            "split_digest": split_metadata["split_digest"],
            "features": features,
            "artifact_sha256": artifact_hash,
        },
        indent=2,
    ),
    encoding="utf-8",
)
print(f"artifact sha256: {artifact_hash}")
