"""Use the declared feature types and frozen training-only missing values."""

from typing import Any

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


def make_preprocessor(manifest: dict[str, Any], fill_values: dict[str, float]) -> ColumnTransformer:
    transforms = []
    for name in manifest["candidate_predictors"]:
        spec = manifest["predictor_specs"][name]
        steps = [("impute", SimpleImputer(strategy="constant", fill_value=fill_values[name], keep_empty_features=True))]
        if spec["kind"] == "categorical":
            categories = sorted([manifest["preprocessing"]["categorical_missing"], *spec["valid_values"]])
            steps.append(
                ("onehot", OneHotEncoder(categories=[categories], handle_unknown="error", sparse_output=False))
            )
        transforms.append((name, Pipeline(steps), [name]))
    return ColumnTransformer(transforms, remainder="drop")
