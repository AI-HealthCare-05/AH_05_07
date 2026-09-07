#!/usr/bin/env python3
"""Model V2 G5 bounded development-only model-family screen."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    ExtraTreesClassifier,
    HistGradientBoostingClassifier,
    RandomForestClassifier,
)
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
AUROC_MARGIN = 0.005
AP_TOL = 0.005
BRIER_TOL = 0.005
TIE_TOL = 1e-6

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

MODEL_ORDER = [
    "logistic_regression",
    "histogram_gradient_boosting",
    "random_forest",
    "extra_trees",
]

CONFIG: dict[str, Any] = {
    "gate": "Model V2 G5",
    "seed": SEED,
    "n_splits": N_SPLITS,
    "splitter": "StratifiedGroupKFold",
    "group": ["kstrata", "psu"],
    "numeric_preprocessing": ["median_imputation", "standardization"],
    "categorical_preprocessing": [
        "constant___missing__",
        "one_hot_handle_unknown_ignore",
    ],
    "training_weight": "wt_itvex_normalized_to_training_fold_mean_1",
    "evaluation_weight": "raw_wt_itvex",
    "repro_atol": REPRO_ATOL,
    "nomination": {
        "auroc_min_improvement": AUROC_MARGIN,
        "average_precision_max_degradation": AP_TOL,
        "brier_max_degradation": BRIER_TOL,
        "minimum_fold_auroc_wins": 3,
        "tie_tolerance": TIE_TOL,
    },
    "models": {
        "logistic_regression": {
            "family": "LogisticRegression",
            "penalty": "l2",
            "C": 1.0,
            "solver": "lbfgs",
            "max_iter": 2000,
            "tol": 1e-8,
            "class_weight": None,
        },
        "histogram_gradient_boosting": {
            "family": "HistGradientBoostingClassifier",
            "learning_rate": 0.05,
            "max_iter": 200,
            "max_leaf_nodes": 15,
            "min_samples_leaf": 20,
            "l2_regularization": 1.0,
        },
        "random_forest": {
            "family": "RandomForestClassifier",
            "n_estimators": 500,
            "max_depth": 8,
            "min_samples_leaf": 10,
            "max_features": "sqrt",
            "class_weight": None,
            "n_jobs": 1,
        },
        "extra_trees": {
            "family": "ExtraTreesClassifier",
            "n_estimators": 500,
            "max_depth": 8,
            "min_samples_leaf": 10,
            "max_features": "sqrt",
            "bootstrap": False,
            "class_weight": None,
            "n_jobs": 1,
        },
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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
        raise SystemExit("STOP: participant-level model data/evidence must remain outside Git")
    return resolved


def guard_participant_path(path: Path, expected_name: str) -> Path:
    resolved = outside_repo(path)
    lowered = {part.lower() for part in resolved.parts}
    if "locked-validation" in lowered or "locked-final-test" in lowered:
        raise SystemExit("STOP: G5 may not read locked validation/final-test paths")
    if resolved.name != expected_name:
        raise SystemExit(f"STOP: expected {expected_name}")
    return resolved


def validate_manifest_safety(manifest: dict[str, Any]) -> None:
    if manifest.get("gate") != "Model V2 G3":
        raise SystemExit("STOP: not a Model V2 G3 manifest")
    required_false = [
        "participant_ids_in_manifest",
        "validation_target_distribution_written",
        "final_test_target_distribution_written",
        "model_fitting_performed",
        "performance_metrics_computed",
        "validation_performance_accessed",
        "final_test_performance_accessed",
    ]
    safety = manifest.get("safety", {})
    if any(safety.get(key) is not False for key in required_false):
        raise SystemExit("STOP: G3 manifest safety state is not frozen-safe")


def validate_frame(frame: pd.DataFrame, expected_rows: int) -> None:
    if len(frame) != expected_rows:
        raise SystemExit("STOP: development dataframe row count mismatch")
    if list(frame.columns) != REQUIRED:
        raise SystemExit("STOP: development columns/order do not match frozen G3 contract")
    if frame["ID"].isna().any() or frame["ID"].duplicated().any():
        raise SystemExit("STOP: invalid development participant IDs")

    target = pd.to_numeric(frame["v2_hypertension_state"], errors="coerce")
    if target.isna().any() or set(target.unique()) != {0, 1}:
        raise SystemExit("STOP: invalid binary development target")

    weights = pd.to_numeric(frame["wt_itvex"], errors="coerce")
    if weights.isna().any() or (weights <= 0).any():
        raise SystemExit("STOP: invalid development survey weights")

    if frame["kstrata"].isna().any() or frame["psu"].isna().any():
        raise SystemExit("STOP: missing development survey-design fields")


def load_inputs(
    development_path: Path,
    g3_manifest_path: Path,
    g4_evidence_path: Path,
) -> tuple[pd.DataFrame, dict[str, Any], dict[str, str]]:
    development = guard_participant_path(development_path, "development.parquet")
    manifest_path = outside_repo(g3_manifest_path)
    g4_path = outside_repo(g4_evidence_path)

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    validate_manifest_safety(manifest)

    expected_rows = int(manifest["role_rows"]["development"])
    expected_hash = manifest["files"]["development"]["sha256"]
    actual_hash = sha256(development)

    if expected_rows != 4157:
        raise SystemExit("STOP: frozen development row count changed")
    if actual_hash != expected_hash:
        raise SystemExit("STOP: development hash does not match G3 manifest")

    frame = pd.read_parquet(development)
    validate_frame(frame, expected_rows)

    g4 = json.loads(g4_path.read_text(encoding="utf-8"))
    if g4.get("gate") != "Model V2 G4":
        raise SystemExit("STOP: not Model V2 G4 evidence")
    if g4.get("status") != "reproducible_development_baseline":
        raise SystemExit("STOP: G4 baseline did not pass")
    if g4.get("provenance", {}).get("development_sha256") != actual_hash:
        raise SystemExit("STOP: G4 evidence belongs to different development data")

    provenance = {
        "development_sha256": actual_hash,
        "g3_manifest_sha256": sha256(manifest_path),
        "g4_evidence_sha256": sha256(g4_path),
        "g4_oof_canonical_sha256": g4["oof_canonical_sha256"],
    }
    return frame, g4, provenance


def canonicalize_features(frame: pd.DataFrame) -> pd.DataFrame:
    features = frame[FEATURES].copy()
    for name in NUMERIC:
        features[name] = pd.to_numeric(features[name], errors="coerce")
    for name in CATEGORICAL:
        values = features[name].astype("object")
        features[name] = values.where(pd.notna(values), np.nan)
    return features


def make_preprocessor(
    sparse_output: bool,
    *,
    sparse_threshold: float | None = None,
) -> ColumnTransformer:
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
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=sparse_output,
                ),
            ),
        ]
    )
    kwargs: dict[str, Any] = {}
    if sparse_threshold is not None:
        kwargs["sparse_threshold"] = sparse_threshold
    return ColumnTransformer(
        [
            ("numeric", numeric, NUMERIC),
            ("categorical", categorical, CATEGORICAL),
        ],
        remainder="drop",
        **kwargs,
    )


def make_logistic() -> LogisticRegression:
    return LogisticRegression(
        penalty="l2",
        C=1.0,
        solver="lbfgs",
        max_iter=2000,
        tol=1e-8,
        class_weight=None,
        random_state=SEED,
    )


def make_hgb() -> HistGradientBoostingClassifier:
    return HistGradientBoostingClassifier(
        learning_rate=0.05,
        max_iter=200,
        max_leaf_nodes=15,
        min_samples_leaf=20,
        l2_regularization=1.0,
        random_state=SEED,
    )


def make_rf() -> RandomForestClassifier:
    return RandomForestClassifier(
        n_estimators=500,
        max_depth=8,
        min_samples_leaf=10,
        max_features="sqrt",
        class_weight=None,
        n_jobs=1,
        random_state=SEED,
    )


def make_extra_trees() -> ExtraTreesClassifier:
    return ExtraTreesClassifier(
        n_estimators=500,
        max_depth=8,
        min_samples_leaf=10,
        max_features="sqrt",
        bootstrap=False,
        class_weight=None,
        n_jobs=1,
        random_state=SEED,
    )


def model_factories() -> dict[str, Callable[[], Any]]:
    return {
        "logistic_regression": make_logistic,
        "histogram_gradient_boosting": make_hgb,
        "random_forest": make_rf,
        "extra_trees": make_extra_trees,
    }


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
            raise SystemExit("STOP: duplicate fold assignment")
        fold_id[heldout] = fold

    if (fold_id < 0).any():
        raise SystemExit("STOP: incomplete fold assignment")

    cluster_folds = pd.DataFrame({"group": groups, "fold": fold_id}).groupby("group")["fold"].nunique()
    if int(cluster_folds.max()) != 1:
        raise SystemExit("STOP: a PSU crosses G5 folds")
    return fold_id


def fit_one_model(
    name: str,
    factory: Callable[[], Any],
    frame: pd.DataFrame,
    fold_id: np.ndarray,
) -> np.ndarray:
    x = canonicalize_features(frame)
    y = frame["v2_hypertension_state"].astype(int).to_numpy()
    weights = frame["wt_itvex"].astype(float).to_numpy()
    probabilities = np.full(len(frame), np.nan, dtype=np.float64)
    dense = name == "histogram_gradient_boosting"

    for fold in range(N_SPLITS):
        heldout = fold_id == fold
        train = ~heldout
        if len(np.unique(y[train])) != 2 or len(np.unique(y[heldout])) != 2:
            raise SystemExit(f"STOP: fold {fold} lacks both classes")

        if name == "logistic_regression":
            # Preserve the exact G4 representation semantics:
            # OneHotEncoder(sparse_output=True) plus ColumnTransformer's
            # default sparse_threshold=0.3.
            preprocessor = make_preprocessor(sparse_output=True)
        else:
            preprocessor = make_preprocessor(
                sparse_output=not dense,
                sparse_threshold=0.0 if dense else 1.0,
            )
        train_x = preprocessor.fit_transform(x.loc[train])
        heldout_x = preprocessor.transform(x.loc[heldout])
        if dense:
            train_x = np.asarray(train_x)
            heldout_x = np.asarray(heldout_x)

        train_weight = weights[train].copy()
        mean_weight = float(train_weight.mean())
        if not np.isfinite(mean_weight) or mean_weight <= 0:
            raise SystemExit("STOP: invalid training weight mean")
        train_weight /= mean_weight

        model = factory()
        model.fit(train_x, y[train], sample_weight=train_weight)
        values = model.predict_proba(heldout_x)[:, 1]
        if not np.isfinite(values).all() or (values < 0).any() or (values > 1).any():
            raise SystemExit(f"STOP: invalid OOF probability for {name}")
        probabilities[heldout] = values

    if not np.isfinite(probabilities).all():
        raise SystemExit(f"STOP: incomplete OOF predictions for {name}")
    return probabilities


def run_screen(
    frame: pd.DataFrame,
    fold_id: np.ndarray,
) -> dict[str, np.ndarray]:
    predictions: dict[str, np.ndarray] = {}
    with threadpool_limits(limits=1):
        for name in MODEL_ORDER:
            predictions[name] = fit_one_model(
                name,
                model_factories()[name],
                frame,
                fold_id,
            )
    return predictions


def metrics(
    y: np.ndarray,
    probability: np.ndarray,
    weight: np.ndarray | None,
) -> dict[str, float]:
    return {
        "auroc": float(roc_auc_score(y, probability, sample_weight=weight)),
        "average_precision": float(average_precision_score(y, probability, sample_weight=weight)),
        "brier": float(brier_score_loss(y, probability, sample_weight=weight)),
    }


def model_report(
    frame: pd.DataFrame,
    fold_id: np.ndarray,
    probability: np.ndarray,
) -> dict[str, Any]:
    y = frame["v2_hypertension_state"].astype(int).to_numpy()
    w = frame["wt_itvex"].astype(float).to_numpy()
    folds = []
    for fold in range(N_SPLITS):
        mask = fold_id == fold
        folds.append(
            {
                "fold": fold,
                "rows": int(mask.sum()),
                "psu_groups": int(frame.loc[mask, ["kstrata", "psu"]].drop_duplicates().shape[0]),
                "weighted": metrics(y[mask], probability[mask], w[mask]),
            }
        )
    return {
        "weighted": metrics(y, probability, w),
        "unweighted_sensitivity": metrics(y, probability, None),
        "folds": folds,
    }


def oof_digest(
    ids: pd.Series,
    folds: np.ndarray,
    probability: np.ndarray,
) -> str:
    digest = hashlib.sha256()
    for participant_id, fold, value in zip(
        ids.astype(str),
        folds,
        probability,
        strict=True,
    ):
        digest.update(f"{participant_id}\t{int(fold)}\t{float(value):.17g}\n".encode())
    return digest.hexdigest()


def compare_reproducibility(
    first: dict[str, np.ndarray],
    second: dict[str, np.ndarray],
) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for name in MODEL_ORDER:
        maximum = float(np.max(np.abs(first[name] - second[name])))
        result[name] = {
            "max_abs_probability_difference": maximum,
            "required_atol": REPRO_ATOL,
            "passed": maximum <= REPRO_ATOL,
        }
    if not all(item["passed"] for item in result.values()):
        raise SystemExit("STOP: G5 reproducibility tolerance failed")
    return result


def fold_auroc_wins(
    baseline: dict[str, Any],
    challenger: dict[str, Any],
) -> int:
    return sum(
        challenger_fold["weighted"]["auroc"] > baseline_fold["weighted"]["auroc"]
        for baseline_fold, challenger_fold in zip(
            baseline["folds"],
            challenger["folds"],
            strict=True,
        )
    )


def guardrail_summary(
    baseline: dict[str, Any],
    challenger: dict[str, Any],
) -> dict[str, Any]:
    base = baseline["weighted"]
    trial = challenger["weighted"]
    wins = fold_auroc_wins(baseline, challenger)
    return {
        "weighted_auroc_delta": trial["auroc"] - base["auroc"],
        "weighted_average_precision_delta": (trial["average_precision"] - base["average_precision"]),
        "weighted_brier_delta": trial["brier"] - base["brier"],
        "fold_auroc_wins_vs_logistic": wins,
        "passes": (
            trial["auroc"] - base["auroc"] >= AUROC_MARGIN
            and trial["average_precision"] - base["average_precision"] >= -AP_TOL
            and trial["brier"] - base["brier"] <= BRIER_TOL
            and wins >= 3
        ),
    }


def choose_candidate(
    reports: dict[str, dict[str, Any]],
) -> tuple[str, dict[str, dict[str, Any]]]:
    baseline = reports["logistic_regression"]
    guardrails: dict[str, dict[str, Any]] = {}
    eligible = []

    for name in MODEL_ORDER[1:]:
        guardrails[name] = guardrail_summary(baseline, reports[name])
        if guardrails[name]["passes"]:
            eligible.append(name)

    if not eligible:
        return "logistic_regression", guardrails

    eligible.sort(
        key=lambda name: (
            reports[name]["weighted"]["auroc"],
            -reports[name]["weighted"]["brier"],
            reports[name]["weighted"]["average_precision"],
        ),
        reverse=True,
    )
    leader = eligible[0]

    if len(eligible) > 1:
        first = reports[leader]["weighted"]
        second_name = eligible[1]
        second = reports[second_name]["weighted"]
        if abs(first["auroc"] - second["auroc"]) < TIE_TOL:
            tied = sorted(
                [leader, second_name],
                key=lambda name: (
                    reports[name]["weighted"]["brier"],
                    -reports[name]["weighted"]["average_precision"],
                ),
            )
            leader = tied[0]

    return leader, guardrails


def write_oof(
    path: Path,
    frame: pd.DataFrame,
    fold_id: np.ndarray,
    predictions: dict[str, np.ndarray],
) -> None:
    payload: dict[str, Any] = {
        "ID": frame["ID"].astype(str),
        "fold": fold_id.astype(int),
    }
    for name in MODEL_ORDER:
        payload[f"probability__{name}"] = predictions[name]
    pd.DataFrame(payload).to_parquet(path, index=False)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--development", type=Path, required=True)
    parser.add_argument("--g3-manifest", type=Path, required=True)
    parser.add_argument("--g4-evidence", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    if git("status", "--porcelain", "--untracked-files=all"):
        raise SystemExit("STOP: run G5 only from a clean committed checkout")

    commit = git("rev-parse", "HEAD")
    output = outside_repo(args.output)
    if output.exists():
        raise SystemExit("STOP: G5 output path already exists")
    output.mkdir(parents=True, exist_ok=False)

    frame, _g4, provenance = load_inputs(
        args.development,
        args.g3_manifest,
        args.g4_evidence,
    )
    fold_first = build_folds(frame)
    first = run_screen(frame, fold_first)

    logistic_digest = oof_digest(
        frame["ID"],
        fold_first,
        first["logistic_regression"],
    )
    if logistic_digest != provenance["g4_oof_canonical_sha256"]:
        raise SystemExit("STOP: G4 logistic OOF canonical digest was not reproduced")

    fold_second = build_folds(frame)
    if not np.array_equal(fold_first, fold_second):
        raise SystemExit("STOP: G5 fold assignments are not reproducible")
    second = run_screen(frame, fold_second)
    reproducibility = compare_reproducibility(first, second)

    if git("rev-parse", "HEAD") != commit or git("status", "--porcelain", "--untracked-files=all"):
        raise SystemExit("STOP: checkout changed during G5 execution")

    reports = {name: model_report(frame, fold_first, first[name]) for name in MODEL_ORDER}
    nomination, guardrails = choose_candidate(reports)

    oof_path = output / "oof-family-screen.parquet"
    write_oof(oof_path, frame, fold_first, first)

    evidence = {
        "schema_version": 1,
        "gate": "Model V2 G5",
        "status": "bounded_development_family_screen_complete",
        "created_at_utc": datetime.now(UTC).isoformat(),
        "execution_commit": commit,
        "config": CONFIG,
        "config_sha256": canonical_json_sha256(CONFIG),
        "provenance": provenance,
        "development_rows": int(len(frame)),
        "development_psu_groups": int(frame[["kstrata", "psu"]].drop_duplicates().shape[0]),
        "g4_logistic_digest_reproduced": True,
        "models": reports,
        "guardrails_vs_logistic": guardrails,
        "g6_development_nomination": nomination,
        "nomination_is_validation_evidence": False,
        "reproducibility": {
            "two_full_runs": True,
            "fold_assignments_identical": True,
            "models": reproducibility,
        },
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
            "feature_contract_changed": False,
            "adaptive_hyperparameter_search_performed": False,
            "threshold_selection_performed": False,
            "calibration_fitting_performed": False,
            "production_serialization_performed": False,
        },
    }

    evidence_path = output / "g5-family-screen-evidence.json"
    evidence_path.write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("=== Model V2 G5 bounded development-only family screen ===")
    for name in MODEL_ORDER:
        weighted = reports[name]["weighted"]
        print(
            f"{name}: AUROC={weighted['auroc']:.9f} "
            f"AP={weighted['average_precision']:.9f} "
            f"Brier={weighted['brier']:.9f}"
        )
    print("G4 logistic digest reproduced: True")
    print("G6 development nomination:", nomination)
    print("evidence:", evidence_path)
    print("validation file read: False")
    print("final-test file read: False")
    print("threshold selection: False")
    print("calibration fitting: False")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
