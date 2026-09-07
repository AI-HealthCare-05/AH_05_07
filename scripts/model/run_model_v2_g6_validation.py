#!/usr/bin/env python3
"""Model V2 G6 one-time frozen validation runner."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from threadpoolctl import threadpool_limits

SEED = 20260907
REPRO_ATOL = 1e-12
MIN_VALIDATION_AUROC = 0.75
MAX_AUROC_DROP = 0.08
MAX_VALIDATION_BRIER = 0.20
EXPECTED_DEVELOPMENT_ROWS = 4157
EXPECTED_VALIDATION_ROWS = 978
EXPECTED_DEVELOPMENT_PSUS = 134
EXPECTED_VALIDATION_PSUS = 31

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

CONFIG: dict[str, Any] = {
    "gate": "Model V2 G6",
    "candidate": "logistic_regression",
    "seed": SEED,
    "preprocessing": {
        "numeric": ["median_imputation", "standardization"],
        "categorical": [
            "constant___missing__",
            "one_hot_handle_unknown_ignore",
        ],
        "column_transformer_sparse_threshold": "default_0.3",
    },
    "model": {
        "family": "LogisticRegression",
        "penalty": "l2",
        "C": 1.0,
        "solver": "lbfgs",
        "max_iter": 2000,
        "tol": 1e-8,
        "class_weight": None,
    },
    "training_weight": "wt_itvex_normalized_to_full_development_mean_1",
    "evaluation_weight": "raw_validation_wt_itvex",
    "repro_atol": REPRO_ATOL,
    "gate_criteria": {
        "weighted_validation_auroc_min": MIN_VALIDATION_AUROC,
        "development_minus_validation_auroc_max": MAX_AUROC_DROP,
        "weighted_validation_brier_max": MAX_VALIDATION_BRIER,
        "calibration_slope_must_be_finite_positive": True,
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


def repo_root() -> Path:
    return Path(git("rev-parse", "--show-toplevel")).resolve()


def outside_repo(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    root = repo_root()
    if resolved == root or root in resolved.parents:
        raise SystemExit("STOP: participant-level model data/evidence must remain outside Git")
    return resolved


def guard_non_final_test_path(path: Path) -> Path:
    resolved = outside_repo(path)
    lowered = {part.lower() for part in resolved.parts}
    if "locked-final-test" in lowered or resolved.name == "final-test.parquet":
        raise SystemExit("STOP: G6 may not access the final internal test")
    return resolved


def guard_development_path(path: Path) -> Path:
    resolved = guard_non_final_test_path(path)
    if resolved.name != "development.parquet":
        raise SystemExit("STOP: expected development.parquet")
    return resolved


def guard_validation_path(path: Path) -> Path:
    resolved = guard_non_final_test_path(path)
    lowered = {part.lower() for part in resolved.parts}
    if resolved.name != "validation.parquet":
        raise SystemExit("STOP: expected validation.parquet")
    if "locked-validation" not in lowered:
        raise SystemExit("STOP: validation must come from frozen locked-validation path")
    return resolved


def validate_g3_manifest(manifest: dict[str, Any]) -> None:
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


def validate_common_frame(
    frame: pd.DataFrame,
    *,
    expected_rows: int,
    expected_psus: int,
    role: str,
) -> None:
    if len(frame) != expected_rows:
        raise SystemExit(f"STOP: {role} row count mismatch")
    if list(frame.columns) != REQUIRED:
        raise SystemExit(f"STOP: {role} columns/order violate frozen G3 contract")
    if frame["ID"].isna().any() or frame["ID"].duplicated().any():
        raise SystemExit(f"STOP: invalid {role} participant IDs")

    target = pd.to_numeric(frame["v2_hypertension_state"], errors="coerce")
    if target.isna().any() or not set(target.unique()).issubset({0, 1}):
        raise SystemExit(f"STOP: invalid {role} binary target")
    if len(set(target.unique())) != 2:
        raise SystemExit(f"STOP: {role} does not contain both target classes")

    weights = pd.to_numeric(frame["wt_itvex"], errors="coerce")
    if weights.isna().any() or (weights <= 0).any():
        raise SystemExit(f"STOP: invalid {role} survey weights")
    if frame["kstrata"].isna().any() or frame["psu"].isna().any():
        raise SystemExit(f"STOP: missing {role} survey-design fields")

    psus = frame[["kstrata", "psu"]].drop_duplicates().shape[0]
    if int(psus) != expected_psus:
        raise SystemExit(f"STOP: {role} PSU count mismatch")


def load_preflight_inputs(
    development_path: Path,
    manifest_path: Path,
    g5_evidence_path: Path,
) -> tuple[pd.DataFrame, dict[str, Any], dict[str, Any], dict[str, str]]:
    development = guard_development_path(development_path)
    manifest_file = outside_repo(manifest_path)
    g5_file = outside_repo(g5_evidence_path)

    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    validate_g3_manifest(manifest)

    if int(manifest["role_rows"]["development"]) != EXPECTED_DEVELOPMENT_ROWS:
        raise SystemExit("STOP: frozen development row count changed")
    if int(manifest["role_rows"]["validation"]) != EXPECTED_VALIDATION_ROWS:
        raise SystemExit("STOP: frozen validation row count changed")

    expected_dev_hash = manifest["files"]["development"]["sha256"]
    actual_dev_hash = sha256(development)
    if actual_dev_hash != expected_dev_hash:
        raise SystemExit("STOP: development hash does not match G3 manifest")

    development_frame = pd.read_parquet(development)
    validate_common_frame(
        development_frame,
        expected_rows=EXPECTED_DEVELOPMENT_ROWS,
        expected_psus=EXPECTED_DEVELOPMENT_PSUS,
        role="development",
    )

    g5 = json.loads(g5_file.read_text(encoding="utf-8"))
    if g5.get("gate") != "Model V2 G5":
        raise SystemExit("STOP: not Model V2 G5 evidence")
    if g5.get("status") != "bounded_development_family_screen_complete":
        raise SystemExit("STOP: G5 family screen is incomplete")
    if g5.get("g6_development_nomination") != "logistic_regression":
        raise SystemExit("STOP: G5 did not nominate logistic_regression")
    if g5.get("provenance", {}).get("development_sha256") != actual_dev_hash:
        raise SystemExit("STOP: G5 evidence belongs to different development data")

    provenance = {
        "development_sha256": actual_dev_hash,
        "g3_manifest_sha256": sha256(manifest_file),
        "g5_evidence_sha256": sha256(g5_file),
    }
    return development_frame, manifest, g5, provenance


def canonicalize_features(frame: pd.DataFrame) -> pd.DataFrame:
    features = frame[FEATURES].copy()
    for name in NUMERIC:
        features[name] = pd.to_numeric(features[name], errors="coerce")
    for name in CATEGORICAL:
        values = features[name].astype("object")
        features[name] = values.where(pd.notna(values), np.nan)
    return features


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


def fit_predict(
    development: pd.DataFrame,
    validation: pd.DataFrame,
) -> np.ndarray:
    x_dev = canonicalize_features(development)
    x_val = canonicalize_features(validation)
    y_dev = development["v2_hypertension_state"].astype(int).to_numpy()
    train_weight = development["wt_itvex"].astype(float).to_numpy()
    train_weight = train_weight / float(train_weight.mean())

    pipeline = make_pipeline()
    pipeline.fit(
        x_dev,
        y_dev,
        model__sample_weight=train_weight,
    )
    probability = pipeline.predict_proba(x_val)[:, 1]
    if not np.isfinite(probability).all() or (probability < 0).any() or (probability > 1).any():
        raise SystemExit("STOP: invalid validation probabilities")
    return probability


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


def calibration_diagnostics(
    y: np.ndarray,
    probability: np.ndarray,
    weight: np.ndarray,
) -> dict[str, float]:
    epsilon = np.finfo(np.float64).eps
    clipped = np.clip(probability, epsilon, 1.0 - epsilon)
    logit = np.log(clipped / (1.0 - clipped)).reshape(-1, 1)

    diagnostic = LogisticRegression(
        C=np.inf,
        solver="lbfgs",
        max_iter=2000,
        tol=1e-10,
        class_weight=None,
        random_state=SEED,
    )
    diagnostic.fit(logit, y, sample_weight=weight)
    intercept = float(diagnostic.intercept_[0])
    slope = float(diagnostic.coef_[0, 0])
    return {
        "intercept": intercept,
        "slope": slope,
        "evaluation_only_not_recalibration": True,
    }


def safe_weighted_subgroup_metrics(
    frame: pd.DataFrame,
    probability: np.ndarray,
    mask: np.ndarray,
) -> dict[str, Any]:
    y = frame.loc[mask, "v2_hypertension_state"].astype(int).to_numpy()
    w = frame.loc[mask, "wt_itvex"].astype(float).to_numpy()
    p = probability[mask]

    result: dict[str, Any] = {
        "rows": int(mask.sum()),
        "weighted_brier": float(brier_score_loss(y, p, sample_weight=w)),
        "both_classes_present": len(np.unique(y)) == 2,
    }
    if result["both_classes_present"]:
        result["weighted_auroc"] = float(roc_auc_score(y, p, sample_weight=w))
        result["weighted_average_precision"] = float(average_precision_score(y, p, sample_weight=w))
    else:
        result["weighted_auroc"] = None
        result["weighted_average_precision"] = None
    return result


def subgroup_audit(
    frame: pd.DataFrame,
    probability: np.ndarray,
) -> dict[str, Any]:
    result: dict[str, Any] = {"sex": {}, "age": {}}

    sex_values = frame["sex_knhanes"].astype(str)
    for value in sorted(sex_values.unique()):
        mask = (sex_values == value).to_numpy()
        result["sex"][value] = safe_weighted_subgroup_metrics(
            frame,
            probability,
            mask,
        )

    age = pd.to_numeric(frame["age_years"], errors="coerce")
    age_ranges = [
        ("19-29", 19, 29),
        ("30-39", 30, 39),
        ("40-49", 40, 49),
        ("50-59", 50, 59),
        ("60-69", 60, 69),
        ("70-79", 70, 79),
        ("80+", 80, None),
    ]
    for label, lower, upper in age_ranges:
        if upper is None:
            mask = (age >= lower).to_numpy()
        else:
            mask = ((age >= lower) & (age <= upper)).to_numpy()
        result["age"][label] = safe_weighted_subgroup_metrics(
            frame,
            probability,
            mask,
        )
    return result


def build_gate_decision(
    validation_metrics: dict[str, float],
    calibration: dict[str, float],
    development_auroc: float,
) -> dict[str, Any]:
    validation_auroc = validation_metrics["auroc"]
    brier = validation_metrics["brier"]
    slope = calibration["slope"]

    criteria = {
        "weighted_validation_auroc_at_least_0_75": (validation_auroc >= MIN_VALIDATION_AUROC),
        "development_minus_validation_auroc_at_most_0_08": (development_auroc - validation_auroc <= MAX_AUROC_DROP),
        "weighted_validation_brier_at_most_0_20": (brier <= MAX_VALIDATION_BRIER),
        "calibration_slope_finite_positive": (np.isfinite(slope) and slope > 0),
        "integrity_provenance_reproducibility_lock_checks": True,
    }
    passed = all(criteria.values())
    return {
        "criteria": criteria,
        "passed": passed,
        "decision": ("PASS_ADVANCE_TO_G7" if passed else "STOP_VALIDATION_GATE_FAILED"),
    }


def write_consumption_marker(
    output: Path,
    *,
    commit: str,
    validation_path: Path,
) -> Path:
    marker = output / "VALIDATION_CONSUMPTION_MARKER.json"
    marker.write_text(
        json.dumps(
            {
                "gate": "Model V2 G6",
                "state": "validation_consumption_started",
                "created_at_utc": datetime.now(UTC).isoformat(),
                "execution_commit": commit,
                "validation_filename": validation_path.name,
                "warning": ("Do not delete this directory to repeat validation-driven evaluation."),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return marker


def run_preflight(
    development: Path,
    manifest: Path,
    g5_evidence: Path,
    validation: Path,
) -> int:
    load_preflight_inputs(development, manifest, g5_evidence)
    validation_path = guard_validation_path(validation)

    if not validation_path.exists() or not validation_path.is_file():
        raise SystemExit("STOP: frozen validation file is missing")

    print("=== Model V2 G6 preflight ===")
    print("development/G3/G5 provenance: PASS")
    print("candidate: logistic_regression")
    print("validation path contract: PASS")
    print("validation contents read: False")
    print("final-test file read: False")
    print("PRECHECK PASS — commit contract/runner before consumption")
    return 0


def consume_validation(args: argparse.Namespace) -> int:
    if git("status", "--porcelain", "--untracked-files=all"):
        raise SystemExit("STOP: consume G6 only from a clean committed checkout")

    commit = git("rev-parse", "HEAD")
    development, manifest, g5, provenance = load_preflight_inputs(
        args.development,
        args.g3_manifest,
        args.g5_evidence,
    )
    validation_path = guard_validation_path(args.validation)
    output = outside_repo(args.output)

    if output.exists():
        raise SystemExit("STOP: G6 output path already exists; do not repeat validation")
    output.mkdir(parents=True, exist_ok=False)
    marker = write_consumption_marker(
        output,
        commit=commit,
        validation_path=validation_path,
    )

    expected_validation_hash = manifest["files"]["validation"]["sha256"]
    actual_validation_hash = sha256(validation_path)
    if actual_validation_hash != expected_validation_hash:
        raise SystemExit("STOP: validation hash mismatch after consumption marker was written")

    validation = pd.read_parquet(validation_path)
    validate_common_frame(
        validation,
        expected_rows=EXPECTED_VALIDATION_ROWS,
        expected_psus=EXPECTED_VALIDATION_PSUS,
        role="validation",
    )

    with threadpool_limits(limits=1):
        probability_1 = fit_predict(development, validation)
        probability_2 = fit_predict(development, validation)

    max_abs_diff = float(np.max(np.abs(probability_1 - probability_2)))
    if max_abs_diff > REPRO_ATOL:
        raise SystemExit(f"STOP: G6 reproducibility failed after validation consumption: {max_abs_diff}")

    if git("rev-parse", "HEAD") != commit or git("status", "--porcelain", "--untracked-files=all"):
        raise SystemExit("STOP: checkout changed during G6 validation")

    y = validation["v2_hypertension_state"].astype(int).to_numpy()
    w = validation["wt_itvex"].astype(float).to_numpy()
    weighted = metrics(y, probability_1, w)
    unweighted = metrics(y, probability_1, None)
    calibration = calibration_diagnostics(y, probability_1, w)

    development_auroc = float(g5["models"]["logistic_regression"]["weighted"]["auroc"])
    gate = build_gate_decision(
        weighted,
        calibration,
        development_auroc,
    )

    predictions_path = output / "validation-predictions.parquet"
    pd.DataFrame(
        {
            "ID": validation["ID"].astype(str),
            "probability": probability_1,
        }
    ).to_parquet(predictions_path, index=False)

    provenance.update(
        {
            "validation_sha256": actual_validation_hash,
            "consumption_marker_sha256": sha256(marker),
        }
    )

    evidence = {
        "schema_version": 1,
        "gate": "Model V2 G6",
        "status": "frozen_validation_consumed",
        "created_at_utc": datetime.now(UTC).isoformat(),
        "execution_commit": commit,
        "config": CONFIG,
        "config_sha256": canonical_json_sha256(CONFIG),
        "candidate": "logistic_regression",
        "provenance": provenance,
        "development_rows": int(len(development)),
        "development_psu_groups": int(development[["kstrata", "psu"]].drop_duplicates().shape[0]),
        "validation_rows": int(len(validation)),
        "validation_psu_groups": int(validation[["kstrata", "psu"]].drop_duplicates().shape[0]),
        "development_oof_reference": {
            "weighted_auroc": development_auroc,
            "source": "G5 development OOF evidence",
        },
        "validation_metrics": {
            "survey_weighted": weighted,
            "unweighted_sensitivity": unweighted,
            "calibration": calibration,
        },
        "subgroups": subgroup_audit(validation, probability_1),
        "reproducibility": {
            "two_fresh_full_development_fits": True,
            "same_in_memory_validation_frame": True,
            "max_abs_probability_difference": max_abs_diff,
            "required_atol": REPRO_ATOL,
            "passed": True,
        },
        "gate_decision": gate,
        "external_predictions_file": {
            "filename": predictions_path.name,
            "sha256": sha256(predictions_path),
            "participant_level": True,
            "committable": False,
        },
        "safety": {
            "validation_consumed_once_in_g6_event": True,
            "validation_used_for_model_change": False,
            "final_test_file_read": False,
            "final_test_performance_accessed": False,
            "v1_validation_or_test_used": False,
            "feature_contract_changed": False,
            "model_family_changed": False,
            "hyperparameter_tuning_performed": False,
            "threshold_selection_performed": False,
            "recalibration_performed": False,
            "production_serialization_performed": False,
        },
    }

    evidence_path = output / "g6-validation-evidence.json"
    evidence_path.write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("=== Model V2 G6 one-time frozen validation ===")
    print("candidate: logistic_regression")
    print("validation rows:", len(validation))
    print("validation PSU groups:", evidence["validation_psu_groups"])
    print("weighted AUROC:", f"{weighted['auroc']:.9f}")
    print("weighted AP:", f"{weighted['average_precision']:.9f}")
    print("weighted Brier:", f"{weighted['brier']:.9f}")
    print("calibration intercept:", f"{calibration['intercept']:.9f}")
    print("calibration slope:", f"{calibration['slope']:.9f}")
    print("development OOF AUROC:", f"{development_auroc:.9f}")
    print("repro max abs diff:", f"{max_abs_diff:.3e}")
    print("G6 decision:", gate["decision"])
    print("evidence:", evidence_path)
    print("final-test file read: False")
    print("threshold selection: False")
    print("recalibration: False")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--development", type=Path, required=True)
    parser.add_argument("--validation", type=Path, required=True)
    parser.add_argument("--g3-manifest", type=Path, required=True)
    parser.add_argument("--g5-evidence", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--preflight-only", action="store_true")
    mode.add_argument("--consume-validation", action="store_true")
    args = parser.parse_args()

    if args.preflight_only:
        return run_preflight(
            args.development,
            args.g3_manifest,
            args.g5_evidence,
            args.validation,
        )

    if args.output is None:
        raise SystemExit("STOP: --output is required with --consume-validation")
    return consume_validation(args)


if __name__ == "__main__":
    raise SystemExit(main())
