#!/usr/bin/env python3
"""Build the frozen Model V2 R1 release artifact outside Git."""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import subprocess
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import sklearn
from joblib import dump, load
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from threadpoolctl import threadpool_limits

SEED = 20260907
EXPECTED_DEV_SHA256 = "e56089bcd6dfce076cd41e58e708e44af4dc4281e161c6bacf4115bc9a332adb"
EXPECTED_DEV_ROWS = 4157
EXPECTED_DEV_PSU_GROUPS = 134
REPRO_ATOL = 1e-12

FEATURES = [
    "age_years",
    "sex_knhanes",
    "bmi_from_height_weight",
    "cigarette_smoking_state",
    "alcohol_frequency",
    "alcohol_amount_category",
    "walking_days_7d",
    "walking_minutes_per_active_day",
    "strength_days_7d",
    "weekday_sleep_minutes",
    "weekend_sleep_minutes",
]
NUMERIC = [
    "age_years",
    "bmi_from_height_weight",
    "walking_days_7d",
    "walking_minutes_per_active_day",
    "weekday_sleep_minutes",
    "weekend_sleep_minutes",
]
CATEGORICAL = [
    "sex_knhanes",
    "cigarette_smoking_state",
    "alcohol_frequency",
    "alcohol_amount_category",
    "strength_days_7d",
]

PREPROCESSING_CONFIG = {
    "numeric": {
        "imputer": {"strategy": "median"},
        "scaler": "StandardScaler",
    },
    "categorical": {
        "imputer": {
            "strategy": "constant",
            "fill_value": "__missing__",
            "keep_empty_features": True,
        },
        "encoder": {
            "handle_unknown": "ignore",
            "sparse_output": True,
        },
    },
}
MODEL_CONFIG = {
    "family": "LogisticRegression",
    "penalty": "l2",
    "C": 1.0,
    "solver": "lbfgs",
    "max_iter": 2000,
    "tol": 1e-8,
    "class_weight": None,
    "random_state": SEED,
}
SCHEMA_VERSION = "model-v2-r1-schema-v1"
PRODUCT_WORDING = "입력 기반 위험군 선별 신호"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], text=True).strip()


def outside_repo(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    repo = Path(git("rev-parse", "--show-toplevel")).resolve()
    if resolved == repo or repo in resolved.parents:
        raise SystemExit("STOP: R1 binary output must remain outside Git repository")
    return resolved


def require_clean_checkout() -> str:
    if git("status", "--porcelain", "--untracked-files=all"):
        raise SystemExit("STOP: build R1 only from a clean committed checkout")
    return git("rev-parse", "HEAD")


def make_pipeline() -> Pipeline:
    numeric = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    categorical = Pipeline(
        [
            (
                "imputer",
                SimpleImputer(
                    strategy="constant",
                    fill_value="__missing__",
                    keep_empty_features=True,
                ),
            ),
            (
                "encoder",
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=True,
                ),
            ),
        ]
    )
    preprocess = ColumnTransformer(
        [
            ("numeric", numeric, NUMERIC),
            ("categorical", categorical, CATEGORICAL),
        ]
    )
    model = LogisticRegression(
        penalty="l2",
        C=1.0,
        solver="lbfgs",
        max_iter=2000,
        tol=1e-8,
        class_weight=None,
        random_state=SEED,
    )
    return Pipeline([("preprocess", preprocess), ("model", model)])


def canonicalize_features(frame: pd.DataFrame) -> pd.DataFrame:
    x = frame[FEATURES].copy()
    for column in NUMERIC:
        x[column] = pd.to_numeric(x[column], errors="coerce")
    for column in CATEGORICAL:
        values = x[column].astype("object")
        x[column] = values.where(pd.notna(values), np.nan)
    return x


def load_development(path: Path) -> pd.DataFrame:
    path = path.expanduser().resolve()
    if sha256(path) != EXPECTED_DEV_SHA256:
        raise SystemExit("STOP: development SHA-256 mismatch")
    frame = pd.read_parquet(path)
    required = {
        "v2_hypertension_state",
        "wt_itvex",
        "kstrata",
        "psu",
        *FEATURES,
    }
    missing = sorted(required - set(frame.columns))
    if missing:
        raise SystemExit(f"STOP: development columns missing: {missing}")
    if len(frame) != EXPECTED_DEV_ROWS:
        raise SystemExit(f"STOP: expected {EXPECTED_DEV_ROWS} development rows")
    groups = int(frame[["kstrata", "psu"]].drop_duplicates().shape[0])
    if groups != EXPECTED_DEV_PSU_GROUPS:
        raise SystemExit(f"STOP: expected {EXPECTED_DEV_PSU_GROUPS} PSU groups")
    return frame


def fit_once(frame: pd.DataFrame) -> Pipeline:
    x = canonicalize_features(frame)
    y = frame["v2_hypertension_state"].astype(int).to_numpy()
    weight = frame["wt_itvex"].astype(float).to_numpy()
    weight = weight / float(weight.mean())

    pipeline = make_pipeline()
    pipeline.fit(x, y, model__sample_weight=weight)
    return pipeline


def package_payload(pipeline: Pipeline, source_commit: str) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "product_wording": PRODUCT_WORDING,
        "production_scoring_enabled": False,
        "feature_order": FEATURES,
        "numeric_features": NUMERIC,
        "categorical_features": CATEGORICAL,
        "preprocessing_config": PREPROCESSING_CONFIG,
        "model_config": MODEL_CONFIG,
        "training": {
            "source": "G3 development only",
            "rows": EXPECTED_DEV_ROWS,
            "psu_groups": EXPECTED_DEV_PSU_GROUPS,
            "sha256": EXPECTED_DEV_SHA256,
        },
        "source_commit": source_commit,
        "pipeline": pipeline,
    }


def runtime_versions() -> dict[str, str]:
    return {
        "python": platform.python_version(),
        "numpy": np.__version__,
        "pandas": pd.__version__,
        "scikit_learn": sklearn.__version__,
        "joblib": joblib.__version__,
    }


def inference_fixture() -> pd.DataFrame:
    # Synthetic/non-participant fixture for release-contract verification only.
    return pd.DataFrame(
        [
            {
                "age_years": 35,
                "sex_knhanes": "1.0",
                "bmi_from_height_weight": 23.5,
                "cigarette_smoking_state": "never",
                "alcohol_frequency": "2.0",
                "alcohol_amount_category": "1.0",
                "walking_days_7d": 4,
                "walking_minutes_per_active_day": 40,
                "strength_days_7d": 2,
                "weekday_sleep_minutes": 420,
                "weekend_sleep_minutes": 480,
            },
            {
                "age_years": 72,
                "sex_knhanes": "2.0",
                "bmi_from_height_weight": np.nan,
                "cigarette_smoking_state": "__unknown_r1_fixture__",
                "alcohol_frequency": pd.NA,
                "alcohol_amount_category": pd.NA,
                "walking_days_7d": 1,
                "walking_minutes_per_active_day": 20,
                "strength_days_7d": 0,
                "weekday_sleep_minutes": np.nan,
                "weekend_sleep_minutes": 390,
            },
        ],
        columns=FEATURES,
    )


def predict(payload: dict[str, Any], frame: pd.DataFrame) -> np.ndarray:
    pipeline = payload["pipeline"]
    return pipeline.predict_proba(canonicalize_features(frame))[:, 1]


def build(args: argparse.Namespace) -> int:
    source_commit = require_clean_checkout()
    output = outside_repo(args.output)
    if output.exists():
        raise SystemExit("STOP: R1 output path already exists")
    output.mkdir(parents=True, exist_ok=False)

    development = load_development(args.development)

    with threadpool_limits(limits=1):
        pipeline_a = fit_once(development)
        pipeline_b = fit_once(development)

    fixture = inference_fixture()
    pa = pipeline_a.predict_proba(canonicalize_features(fixture))[:, 1]
    pb = pipeline_b.predict_proba(canonicalize_features(fixture))[:, 1]
    max_fit_diff = float(np.max(np.abs(pa - pb)))
    if max_fit_diff > REPRO_ATOL:
        raise SystemExit(f"STOP: two fresh fits differ by {max_fit_diff}")

    artifact_a = output / "model-v2-r1-a.joblib"
    artifact_b = output / "model-v2-r1-b.joblib"
    dump(package_payload(pipeline_a, source_commit), artifact_a, compress=0, protocol=5)
    dump(package_payload(pipeline_b, source_commit), artifact_b, compress=0, protocol=5)

    sha_a = sha256(artifact_a)
    sha_b = sha256(artifact_b)

    loaded_a = load(artifact_a)
    loaded_b = load(artifact_b)
    pred_a = predict(loaded_a, fixture)
    pred_b = predict(loaded_b, fixture)
    max_loaded_diff = float(np.max(np.abs(pred_a - pred_b)))
    if max_loaded_diff > REPRO_ATOL:
        raise SystemExit(f"STOP: serialized artifacts differ in inference by {max_loaded_diff}")

    serialization_state = "BYTE_IDENTICAL" if sha_a == sha_b else "DETERMINISTIC_INFERENCE_EQUIVALENCE"

    manifest = {
        "gate": "Model V2 R1",
        "status": "artifact_built_production_disabled",
        "schema_version": SCHEMA_VERSION,
        "candidate": "logistic_regression",
        "product_wording": PRODUCT_WORDING,
        "production_scoring_enabled": False,
        "feature_order": FEATURES,
        "numeric_features": NUMERIC,
        "categorical_features": CATEGORICAL,
        "preprocessing_config": PREPROCESSING_CONFIG,
        "model_config": MODEL_CONFIG,
        "training": {
            "development_only": True,
            "rows": EXPECTED_DEV_ROWS,
            "psu_groups": EXPECTED_DEV_PSU_GROUPS,
            "sha256": EXPECTED_DEV_SHA256,
            "sample_weight_normalization": "wt_itvex / mean(wt_itvex)",
        },
        "source_commit": source_commit,
        "runtime_versions": runtime_versions(),
        "artifact_a": {"filename": artifact_a.name, "sha256": sha_a},
        "artifact_b": {"filename": artifact_b.name, "sha256": sha_b},
        "canonical_artifact": artifact_a.name,
        "canonical_artifact_sha256": sha_a,
        "serialization_state": serialization_state,
        "reproducibility": {
            "two_fresh_fits": True,
            "max_abs_fixture_probability_diff_before_serialization": max_fit_diff,
            "max_abs_fixture_probability_diff_after_serialization": max_loaded_diff,
            "required_atol": REPRO_ATOL,
            "passed": True,
        },
        "safety": {
            "g6_validation_participant_data_read": False,
            "g7_external_participant_data_read": False,
            "g8_final_test_participant_data_read": False,
            "threshold_selection": False,
            "recalibration": False,
            "feature_change": False,
            "model_family_change": False,
            "hyperparameter_change": False,
            "production_scoring_enabled": False,
            "participant_level_files_committable": False,
        },
        "known_limitations": {
            "older_age_discrimination_weaker": True,
            "strongest_concern_age_80_plus": True,
            "subgroup_metrics_descriptive_only": True,
        },
    }

    manifest_path = output / "model-v2-r1-manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("=== Model V2 R1 artifact build ===")
    print("development rows:", len(development))
    print("development PSU groups:", EXPECTED_DEV_PSU_GROUPS)
    print("artifact A SHA-256:", sha_a)
    print("artifact B SHA-256:", sha_b)
    print("serialization state:", serialization_state)
    print("fit reproducibility max abs diff:", f"{max_fit_diff:.3e}")
    print("loaded artifact max abs diff:", f"{max_loaded_diff:.3e}")
    print("production scoring enabled: False")
    print("manifest:", manifest_path)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--development", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    return build(ap.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
