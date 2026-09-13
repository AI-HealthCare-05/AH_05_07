#!/usr/bin/env python3
"""Export only the hash-verified frozen model; never fit or read participant data."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

import numpy as np  # noqa: E402
from sklearn.compose import ColumnTransformer  # noqa: E402
from sklearn.impute import SimpleImputer  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.pipeline import Pipeline  # noqa: E402
from sklearn.preprocessing import OneHotEncoder, StandardScaler  # noqa: E402

from app.services.model_v2_inference import (  # noqa: E402
    CANONICAL_CATEGORIES,
    EXPECTED_ARTIFACT_SHA256,
    EXPECTED_PRODUCT_WORDING,
    EXPECTED_SCHEMA_VERSION,
    FEATURES,
    load_verified_artifact,
)

NUMERIC_NAMES = [
    "age_years",
    "bmi_from_height_weight",
    "walking_days_7d",
    "walking_minutes_per_active_day",
    "weekday_sleep_minutes",
    "weekend_sleep_minutes",
]
CATEGORICAL_NAMES = list(CANONICAL_CATEGORIES)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(f"unsupported frozen structure: {message}")


def float_vector(value: Any, length: int, name: str) -> list[float]:
    require(isinstance(value, np.ndarray), name)
    require(value.shape == (length,) and value.dtype == np.float64, name)
    require(bool(np.isfinite(value).all()), name)
    return [float(item) for item in value]


def inspect_frozen(payload: dict[str, Any]) -> dict[str, Any]:
    """Reject shapes/options this small representation cannot reproduce."""
    require(payload.get("numeric_features") == NUMERIC_NAMES, "numeric feature order")
    require(payload.get("categorical_features") == CATEGORICAL_NAMES, "categorical feature order")
    pipeline = payload["pipeline"]
    require(type(pipeline) is Pipeline, "pipeline type")
    require([name for name, _ in pipeline.steps] == ["preprocess", "model"], "pipeline steps")
    preprocess, model = pipeline.named_steps["preprocess"], pipeline.named_steps["model"]
    require(type(preprocess) is ColumnTransformer, "preprocessor type")
    require(preprocess.remainder == "drop" and preprocess.transformer_weights is None, "column composition")
    require(preprocess.sparse_output_ is False, "fitted dense output")
    require(list(preprocess.feature_names_in_) == FEATURES, "fitted input order")
    require(len(preprocess.transformers_) == 2, "transformer count")
    for (name, transformer, columns), expected_name, expected_columns in zip(
        preprocess.transformers_, ["numeric", "categorical"], [NUMERIC_NAMES, CATEGORICAL_NAMES], strict=True
    ):
        require(name == expected_name and list(columns) == expected_columns, "transformer columns")
        require(type(transformer) is Pipeline, "transformer pipeline")
    numeric = preprocess.named_transformers_["numeric"]
    categorical = preprocess.named_transformers_["categorical"]
    require([name for name, _ in numeric.steps] == ["imputer", "scaler"], "numeric steps")
    require([name for name, _ in categorical.steps] == ["imputer", "encoder"], "categorical steps")
    numeric_imputer, scaler = numeric.named_steps["imputer"], numeric.named_steps["scaler"]
    categorical_imputer, encoder = categorical.named_steps["imputer"], categorical.named_steps["encoder"]
    for imputer in [numeric_imputer, categorical_imputer]:
        require(type(imputer) is SimpleImputer, "imputer type")
        require(isinstance(imputer.missing_values, float) and math.isnan(imputer.missing_values), "missing sentinel")
        require(imputer.add_indicator is False, "imputer indicator")
    require(numeric_imputer.strategy == "median" and numeric_imputer.keep_empty_features is False, "numeric imputer")
    require(type(scaler) is StandardScaler and scaler.with_mean and scaler.with_std, "scaler")
    require(
        categorical_imputer.strategy == "constant"
        and categorical_imputer.fill_value == "__missing__"
        and categorical_imputer.keep_empty_features is True,
        "categorical imputer",
    )
    require(list(categorical_imputer.statistics_) == ["__missing__"] * 5, "fitted categorical fill")
    require(type(encoder) is OneHotEncoder, "encoder type")
    require(
        encoder.handle_unknown == "ignore"
        and encoder.sparse_output is True
        and encoder.drop is None
        and encoder.drop_idx_ is None
        and encoder.categories == "auto"
        and encoder.min_frequency is None
        and encoder.max_categories is None
        and encoder.dtype == np.float64,
        "encoder options",
    )
    require(len(encoder.categories_) == 5, "encoder input width")
    categories = [
        [item.item() if isinstance(item, np.generic) else item for item in values] for values in encoder.categories_
    ]
    require([len(values) for values in categories] == [2, 5, 8, 7, 7], "fitted category widths")
    for index, (name, values) in enumerate(zip(CATEGORICAL_NAMES, categories, strict=True)):
        expected = set(CANONICAL_CATEGORIES[name]) | ({"__missing__"} if index else set())
        require(set(values) == expected, "fitted category coverage")
        require(
            all(isinstance(value, (int, float)) and not isinstance(value, bool) for value in values)
            if index == 0
            else all(isinstance(value, str) for value in values),
            "category types",
        )
    require(type(model) is LogisticRegression, "model type")
    expected_options = {
        "penalty": "l2",
        "C": 1.0,
        "solver": "lbfgs",
        "max_iter": 2000,
        "tol": 1e-8,
        "class_weight": None,
        "random_state": 20260907,
        "fit_intercept": True,
    }
    require(all(getattr(model, name) == value for name, value in expected_options.items()), "model options")
    require(model.classes_.tolist() == [0, 1] and model.n_features_in_ == 35, "model classes/width")
    require(model.coef_.shape == (1, 35), "coefficient shape")
    scale = float_vector(scaler.scale_, 6, "scale")
    require(all(value > 0 for value in scale), "positive scale")
    return {
        "format": "sk7-model-v2-local-v1",
        "canonical_sha256": EXPECTED_ARTIFACT_SHA256,
        "schema_version": EXPECTED_SCHEMA_VERSION,
        "product_wording": EXPECTED_PRODUCT_WORDING,
        "feature_order": FEATURES,
        "numeric": {
            "names": NUMERIC_NAMES,
            "median": float_vector(numeric_imputer.statistics_, 6, "median"),
            "mean": float_vector(scaler.mean_, 6, "mean"),
            "scale": scale,
        },
        "categorical": {"names": CATEGORICAL_NAMES, "categories": categories, "fill": "__missing__"},
        "linear": {
            "weights": float_vector(model.coef_[0], 35, "coefficients"),
            "intercept": float_vector(model.intercept_, 1, "intercept")[0],
            "classes": [0, 1],
        },
    }


def stable_json(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n"
    ).encode("utf-8")


def export(artifact: Path, output: Path) -> dict[str, Any]:
    output = output.expanduser().resolve()
    require(output != REPO_ROOT and REPO_ROOT not in output.parents, "output must be outside repository")
    # Verify the pinned binary before deserializing it; no rebuild or fitting occurs.
    representation = inspect_frozen(load_verified_artifact(artifact, enabled=True))
    encoded = stable_json(representation)
    manifest = {
        "format": "sk7-model-v2-local-manifest-v1",
        "artifact": "model.json",
        "sha256": hashlib.sha256(encoded).hexdigest(),
        "bytes": len(encoded),
        "canonical_sha256": EXPECTED_ARTIFACT_SHA256,
    }
    output.mkdir(parents=True, exist_ok=True)
    for name in ["model.json", "manifest.json"]:
        require(not (output / name).exists(), f"refusing to overwrite {name}")
    (output / "model.json").write_bytes(encoded)
    (output / "manifest.json").write_bytes(stable_json(manifest))
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(export(args.artifact, args.output), ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
