#!/usr/bin/env python3
"""Model V2 G4 development-only reproducible logistic-regression baseline."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from threadpoolctl import threadpool_limits

SEED = 20260907
N_SPLITS = 5
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

REQUIRED = [
    "ID",
    "v2_hypertension_state",
    *FEATURES,
    "wt_itvex",
    "kstrata",
    "psu",
]

CONFIG = {
    "gate": "Model V2 G4",
    "seed": SEED,
    "n_splits": N_SPLITS,
    "splitter": "StratifiedGroupKFold",
    "group": ["kstrata", "psu"],
    "numeric_preprocessing": ["median_imputation", "standardization"],
    "categorical_preprocessing": [
        "constant___missing__",
        "one_hot_handle_unknown_ignore",
    ],
    "baseline": {
        "family": "LogisticRegression",
        "penalty": "l2",
        "C": 1.0,
        "solver": "lbfgs",
        "max_iter": 2000,
        "tol": 1e-8,
        "class_weight": None,
    },
    "fit_weight": "wt_itvex_normalized_to_training_fold_mean_1",
    "evaluation_weight": "raw_wt_itvex",
    "repro_atol": REPRO_ATOL,
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def canonical_json_sha256(value: object) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(payload).hexdigest()


def git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def outside_repo(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    repo = Path(git("rev-parse", "--show-toplevel")).resolve()
    if resolved == repo or repo in resolved.parents:
        raise SystemExit("STOP: participant-level G4 path must remain outside Git")
    return resolved


def guard_development_path(path: Path) -> Path:
    resolved = outside_repo(path)
    lowered = {part.lower() for part in resolved.parts}
    if "locked-validation" in lowered or "locked-final-test" in lowered:
        raise SystemExit("STOP: G4 may not read locked validation/final-test paths")
    if resolved.name != "development.parquet":
        raise SystemExit("STOP: expected the frozen G3 development.parquet")
    return resolved


def validate_manifest_safety(manifest: dict) -> None:
    if manifest.get("gate") != "Model V2 G3":
        raise SystemExit("STOP: not a Model V2 G3 manifest")

    safety = manifest.get("safety", {})
    required_false = [
        "participant_ids_in_manifest",
        "validation_target_distribution_written",
        "final_test_target_distribution_written",
        "model_fitting_performed",
        "performance_metrics_computed",
        "validation_performance_accessed",
        "final_test_performance_accessed",
    ]
    if any(safety.get(key) is not False for key in required_false):
        raise SystemExit("STOP: G3 manifest safety state is not frozen-safe")


def validate_development_contract(
    frame: pd.DataFrame,
    expected_rows: int,
) -> None:
    if len(frame) != expected_rows:
        raise SystemExit("STOP: development dataframe row count mismatch")

    if list(frame.columns) != REQUIRED:
        raise SystemExit("STOP: development columns/order do not match frozen G3 output contract")

    if frame["ID"].isna().any() or frame["ID"].duplicated().any():
        raise SystemExit("STOP: invalid development participant IDs")

    target = pd.to_numeric(frame["v2_hypertension_state"], errors="coerce")
    if target.isna().any() or set(target.unique()) != {0, 1}:
        raise SystemExit("STOP: invalid binary development target")

    weights = pd.to_numeric(frame["wt_itvex"], errors="coerce")
    if weights.isna().any() or (weights <= 0).any():
        raise SystemExit("STOP: invalid development survey weights")

    if frame["kstrata"].isna().any() or frame["psu"].isna().any():
        raise SystemExit("STOP: missing development survey-design groups")


def load_and_verify(development: Path, manifest_path: Path) -> tuple[pd.DataFrame, dict[str, str]]:
    development = guard_development_path(development)
    manifest_path = outside_repo(manifest_path)

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    validate_manifest_safety(manifest)

    expected_rows = int(manifest["role_rows"]["development"])
    expected_hash = manifest["files"]["development"]["sha256"]
    actual_hash = sha256(development)

    if expected_rows != 4157:
        raise SystemExit(f"STOP: frozen G3 development row count changed: {expected_rows}")
    if actual_hash != expected_hash:
        raise SystemExit("STOP: development file hash does not match G3 manifest")

    frame = pd.read_parquet(development)
    validate_development_contract(frame, expected_rows)

    return frame, {
        "development_sha256": actual_hash,
        "g3_manifest_sha256": sha256(manifest_path),
    }


def canonicalize_features(frame: pd.DataFrame) -> pd.DataFrame:
    x = frame[FEATURES].copy()
    for name in NUMERIC:
        x[name] = pd.to_numeric(x[name], errors="coerce")
    for name in CATEGORICAL:
        values = x[name].astype("object")
        x[name] = values.where(pd.notna(values), np.nan)
    return x


def make_pipeline() -> Pipeline:
    numeric = Pipeline(
        [
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
        ]
    )
    categorical = Pipeline(
        [
            (
                "impute",
                SimpleImputer(
                    strategy="constant",
                    fill_value="__missing__",
                    keep_empty_features=True,
                ),
            ),
            (
                "onehot",
                OneHotEncoder(handle_unknown="ignore", sparse_output=True),
            ),
        ]
    )
    preprocess = ColumnTransformer(
        [
            ("numeric", numeric, NUMERIC),
            ("categorical", categorical, CATEGORICAL),
        ],
        remainder="drop",
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


def build_folds(frame: pd.DataFrame) -> np.ndarray:
    y = frame["v2_hypertension_state"].astype(int).to_numpy()
    groups = (frame["kstrata"].astype(str).str.strip() + "|" + frame["psu"].astype(str).str.strip()).to_numpy()

    splitter = StratifiedGroupKFold(
        n_splits=N_SPLITS,
        shuffle=True,
        random_state=SEED,
    )
    fold_id = np.full(len(frame), -1, dtype=np.int8)

    for fold, (_, heldout) in enumerate(splitter.split(np.zeros(len(frame)), y, groups=groups)):
        if (fold_id[heldout] != -1).any():
            raise SystemExit("STOP: duplicate development fold assignment")
        fold_id[heldout] = fold

    if (fold_id < 0).any():
        raise SystemExit("STOP: incomplete development fold assignment")

    cluster_fold_counts = pd.DataFrame({"group": groups, "fold": fold_id}).groupby("group")["fold"].nunique()
    if int(cluster_fold_counts.max()) != 1:
        raise SystemExit("STOP: a G3 PSU crosses G4 OOF folds")

    return fold_id


def fit_oof(frame: pd.DataFrame, fold_id: np.ndarray) -> np.ndarray:
    x = canonicalize_features(frame)
    y = frame["v2_hypertension_state"].astype(int).to_numpy()
    weights = frame["wt_itvex"].astype(float).to_numpy()

    probabilities = np.full(len(frame), np.nan, dtype=np.float64)

    with threadpool_limits(limits=1):
        for fold in range(N_SPLITS):
            heldout = fold_id == fold
            train = ~heldout

            if len(np.unique(y[train])) != 2 or len(np.unique(y[heldout])) != 2:
                raise SystemExit(f"STOP: fold {fold} does not contain both classes")

            train_weight = weights[train].copy()
            mean_weight = float(train_weight.mean())
            if not np.isfinite(mean_weight) or mean_weight <= 0:
                raise SystemExit("STOP: invalid fold training-weight mean")
            train_weight /= mean_weight

            pipeline = make_pipeline()
            pipeline.fit(
                x.loc[train],
                y[train],
                model__sample_weight=train_weight,
            )
            values = pipeline.predict_proba(x.loc[heldout])[:, 1]

            if not np.isfinite(values).all() or (values < 0).any() or (values > 1).any():
                raise SystemExit("STOP: invalid OOF probability")

            probabilities[heldout] = values

    if not np.isfinite(probabilities).all():
        raise SystemExit("STOP: incomplete OOF probabilities")
    return probabilities


def metrics(y: np.ndarray, p: np.ndarray, w: np.ndarray | None) -> dict[str, float]:
    return {
        "auroc": float(roc_auc_score(y, p, sample_weight=w)),
        "average_precision": float(average_precision_score(y, p, sample_weight=w)),
        "brier": float(brier_score_loss(y, p, sample_weight=w)),
    }


def oof_digest(ids: pd.Series, folds: np.ndarray, probabilities: np.ndarray) -> str:
    h = hashlib.sha256()
    for participant_id, fold, probability in zip(
        ids.astype(str),
        folds,
        probabilities,
        strict=True,
    ):
        h.update(f"{participant_id}\t{int(fold)}\t{float(probability):.17g}\n".encode())
    return h.hexdigest()


def fold_summary(
    frame: pd.DataFrame,
    folds: np.ndarray,
    probabilities: np.ndarray,
) -> list[dict]:
    y = frame["v2_hypertension_state"].astype(int).to_numpy()
    w = frame["wt_itvex"].astype(float).to_numpy()
    summaries = []

    for fold in range(N_SPLITS):
        mask = folds == fold
        psus = frame.loc[mask, ["kstrata", "psu"]].drop_duplicates()
        summaries.append(
            {
                "fold": fold,
                "rows": int(mask.sum()),
                "psu_groups": int(len(psus)),
                "weighted": metrics(y[mask], probabilities[mask], w[mask]),
            }
        )
    return summaries


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--development", type=Path, required=True)
    parser.add_argument("--g3-manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    if git("status", "--porcelain", "--untracked-files=all"):
        raise SystemExit("STOP: run G4 only from a clean committed checkout")

    commit = git("rev-parse", "HEAD")
    development = guard_development_path(args.development)
    manifest = outside_repo(args.g3_manifest)
    output = outside_repo(args.output)

    if output.exists():
        raise SystemExit("STOP: G4 output path already exists")
    output.mkdir(parents=True, exist_ok=False)

    frame, provenance = load_and_verify(development, manifest)

    folds_1 = build_folds(frame)
    probabilities_1 = fit_oof(frame, folds_1)

    folds_2 = build_folds(frame)
    probabilities_2 = fit_oof(frame, folds_2)

    if not np.array_equal(folds_1, folds_2):
        raise SystemExit("STOP: development fold assignments are not reproducible")

    max_abs_diff = float(np.max(np.abs(probabilities_1 - probabilities_2)))
    if max_abs_diff > REPRO_ATOL:
        raise SystemExit(f"STOP: OOF reproducibility exceeded tolerance: {max_abs_diff}")

    if git("rev-parse", "HEAD") != commit or git("status", "--porcelain", "--untracked-files=all"):
        raise SystemExit("STOP: checkout changed during G4 execution")

    y = frame["v2_hypertension_state"].astype(int).to_numpy()
    w = frame["wt_itvex"].astype(float).to_numpy()

    oof = pd.DataFrame(
        {
            "ID": frame["ID"].astype(str),
            "fold": folds_1.astype(int),
            "probability": probabilities_1,
        }
    )
    oof_path = output / "oof-predictions.parquet"
    oof.to_parquet(oof_path, index=False)

    evidence = {
        "schema_version": 1,
        "gate": "Model V2 G4",
        "status": "reproducible_development_baseline",
        "created_at_utc": datetime.now(UTC).isoformat(),
        "execution_commit": commit,
        "config": CONFIG,
        "config_sha256": canonical_json_sha256(CONFIG),
        "provenance": provenance,
        "development_rows": int(len(frame)),
        "development_psu_groups": int(frame[["kstrata", "psu"]].drop_duplicates().shape[0]),
        "folds": fold_summary(frame, folds_1, probabilities_1),
        "oof_metrics": {
            "survey_weighted": metrics(y, probabilities_1, w),
            "unweighted_sensitivity": metrics(y, probabilities_1, None),
        },
        "reproducibility": {
            "two_full_runs": True,
            "fold_assignments_identical": True,
            "max_abs_probability_difference": max_abs_diff,
            "required_atol": REPRO_ATOL,
            "passed": True,
        },
        "oof_canonical_sha256": oof_digest(
            frame["ID"],
            folds_1,
            probabilities_1,
        ),
        "external_oof_file": {
            "filename": oof_path.name,
            "sha256": sha256(oof_path),
            "participant_level": True,
            "committable": False,
        },
        "safety": {
            "development_only": True,
            "validation_file_read": False,
            "validation_performance_accessed": False,
            "final_test_file_read": False,
            "final_test_performance_accessed": False,
            "v1_validation_or_test_used": False,
            "feature_ranking_performed": False,
            "model_family_comparison_performed": False,
            "hyperparameter_search_performed": False,
            "threshold_selection_performed": False,
            "calibration_fitting_performed": False,
            "production_serialization_performed": False,
        },
    }

    evidence_path = output / "g4-baseline-evidence.json"
    evidence_path.write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    weighted = evidence["oof_metrics"]["survey_weighted"]
    print("=== Model V2 G4 development-only baseline ===")
    print("development rows:", len(frame))
    print("development PSU groups:", evidence["development_psu_groups"])
    print("weighted AUROC:", f"{weighted['auroc']:.9f}")
    print("weighted AP:", f"{weighted['average_precision']:.9f}")
    print("weighted Brier:", f"{weighted['brier']:.9f}")
    print("repro max abs diff:", f"{max_abs_diff:.3e}")
    print("evidence:", evidence_path)
    print("validation file read: False")
    print("final-test file read: False")
    print("model-family comparison: False")
    print("threshold selection: False")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
