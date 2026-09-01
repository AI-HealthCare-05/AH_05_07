"""Compare the contracted baseline models on frozen local splits."""

import argparse
import json
from pathlib import Path

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

parser = argparse.ArgumentParser()
parser.add_argument("split_dir", type=Path)
parser.add_argument("result", type=Path)
args = parser.parse_args()

manifest = json.loads(Path("data/manifest/nhanes_2017_2020.json").read_text(encoding="utf-8"))
features, target = manifest["candidate_predictors"], manifest["label"]["name"]
train = pd.read_parquet(args.split_dir / "train.parquet")
validation = pd.read_parquet(args.split_dir / "validation.parquet")
numeric = [name for name in features if pd.api.types.is_numeric_dtype(train[name])]
categorical = [name for name in features if name not in numeric]
preprocess = ColumnTransformer(
    [
        ("numeric", SimpleImputer(strategy="median"), numeric),
        (
            "categorical",
            Pipeline(
                [
                    ("impute", SimpleImputer(strategy="most_frequent")),
                    ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                ]
            ),
            categorical,
        ),
    ]
)

models = {
    "logistic_regression": LogisticRegression(max_iter=2000),
    "histogram_gradient_boosting": HistGradientBoostingClassifier(random_state=manifest["split"]["seed"]),
}
results = {}
for name, model in models.items():
    pipeline = Pipeline([("preprocess", preprocess), ("model", model)])
    pipeline.fit(train[features], train[target])
    probability = pipeline.predict_proba(validation[features])[:, 1]
    results[name] = {
        "auroc": roc_auc_score(validation[target], probability),
        "pr_auc": average_precision_score(validation[target], probability),
        "brier": brier_score_loss(validation[target], probability),
    }

args.result.write_text(json.dumps(results, indent=2), encoding="utf-8")
print(json.dumps(results, indent=2))
