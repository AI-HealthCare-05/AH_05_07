"""Compare the contracted baseline models on frozen local splits."""

import argparse
import json
from pathlib import Path

import pandas as pd
from preprocessing import make_preprocessor
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.pipeline import Pipeline

parser = argparse.ArgumentParser()
parser.add_argument("split_dir", type=Path)
parser.add_argument("result", type=Path)
args = parser.parse_args()

manifest = json.loads(Path("data/manifest/nhanes_2017_2020.json").read_text(encoding="utf-8"))
features, target = manifest["candidate_predictors"], manifest["label"]["name"]
train = pd.read_parquet(args.split_dir / "train.parquet")
validation = pd.read_parquet(args.split_dir / "validation.parquet")
split_metadata = json.loads((args.split_dir / "split_metadata.json").read_text(encoding="utf-8"))
if (
    split_metadata.get("semantics_version") != manifest["semantics_version"]
    or split_metadata.get("features") != manifest["candidate_predictors"]
):
    raise ValueError("split metadata does not match the versioned feature semantics")

models = {
    "logistic_regression": LogisticRegression(max_iter=2000),
    "histogram_gradient_boosting": HistGradientBoostingClassifier(random_state=manifest["split"]["seed"]),
}
results = {}
for name, model in models.items():
    pipeline = Pipeline([("preprocess", make_preprocessor(manifest, split_metadata["fill_values"])), ("model", model)])
    pipeline.fit(train[features], train[target])
    probability = pipeline.predict_proba(validation[features])[:, 1]
    results[name] = {
        "auroc": roc_auc_score(validation[target], probability),
        "pr_auc": average_precision_score(validation[target], probability),
        "brier": brier_score_loss(validation[target], probability),
    }

args.result.write_text(json.dumps(results, indent=2), encoding="utf-8")
print(json.dumps(results, indent=2))
