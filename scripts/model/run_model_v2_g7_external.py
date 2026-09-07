#!/usr/bin/env python3
"""Model V2 G7 one-time KNHANES 2023 transportability evaluation."""

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
MIN_EXTERNAL_AUROC = 0.75
MAX_G6_MINUS_EXTERNAL_AUROC = 0.08
MAX_EXTERNAL_BRIER = 0.20

EXPECTED_DEVELOPMENT_ROWS = 4157
EXPECTED_DEVELOPMENT_PSUS = 134
EXPECTED_EXTERNAL_SOURCE_NAME = "hn23_all.sas7bdat"
EXPECTED_EXTERNAL_SOURCE_SHA256 = "62b3a67bd1a86fb459c78b404735a182ec0fe03cd4d35f7420d665b5b1e2741c"

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

PREPARED_COLUMNS = [
    "ID",
    "v2_hypertension_state",
    *FEATURES,
    "wt_itvex",
    "kstrata",
    "psu",
]

RAW_COLUMNS = [
    "ID",
    "age",
    "sex",
    "HE_prg",
    "HE_HP",
    "HE_ht",
    "HE_wt",
    "BS1_1",
    "BS3_1",
    "BD1_11",
    "BD2_1",
    "BE3_31",
    "BE3_32",
    "BE3_33",
    "BE5_1",
    "BP16_1",
    "BP16_2",
    "wt_itvex",
    "kstrata",
    "psu",
]

CONFIG: dict[str, Any] = {
    "gate": "Model V2 G7",
    "candidate": "logistic_regression",
    "seed": SEED,
    "external_evaluation_type": ("temporal_korean_transportability_with_predeclared_sleep_measurement_shift"),
    "external_source": {
        "filename": EXPECTED_EXTERNAL_SOURCE_NAME,
        "sha256": EXPECTED_EXTERNAL_SOURCE_SHA256,
    },
    "external_sleep_harmonization": {
        "weekday_sleep_minutes": "BP16_1 * 60",
        "weekend_sleep_minutes": "BP16_2 * 60",
        "missing_codes": [88, 99],
        "performance_driven": False,
    },
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
    "evaluation_weight": "raw_external_wt_itvex",
    "repro_atol": REPRO_ATOL,
    "gate_criteria": {
        "weighted_external_auroc_min": MIN_EXTERNAL_AUROC,
        "g6_validation_minus_external_auroc_max": MAX_G6_MINUS_EXTERNAL_AUROC,
        "weighted_external_brier_max": MAX_EXTERNAL_BRIER,
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


def guard_development_path(path: Path) -> Path:
    resolved = outside_repo(path)
    lowered = {part.lower() for part in resolved.parts}
    if "locked-final-test" in lowered or resolved.name == "final-test.parquet":
        raise SystemExit("STOP: G7 may not access the final internal test")
    if "locked-validation" in lowered or resolved.name == "validation.parquet":
        raise SystemExit("STOP: G7 does not use G6 validation participant data")
    if resolved.name != "development.parquet":
        raise SystemExit("STOP: expected development.parquet")
    return resolved


def guard_external_source(path: Path) -> Path:
    resolved = outside_repo(path)
    lowered = {part.lower() for part in resolved.parts}
    if "locked-final-test" in lowered or resolved.name == "final-test.parquet":
        raise SystemExit("STOP: G7 external source path points at final-test material")
    if resolved.name != EXPECTED_EXTERNAL_SOURCE_NAME:
        raise SystemExit(f"STOP: expected external source {EXPECTED_EXTERNAL_SOURCE_NAME}")
    return resolved


def num(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def derive_bmi(height: pd.Series, weight: pd.Series) -> pd.Series:
    height_num, weight_num = num(height), num(weight)
    result = pd.Series(float("nan"), index=height_num.index)
    ok = (height_num > 0) & (weight_num > 0)
    result.loc[ok] = weight_num.loc[ok] / ((height_num.loc[ok] / 100.0) ** 2)
    return result


def derive_smoking(bs1: pd.Series, bs3: pd.Series) -> pd.Series:
    lifetime = num(bs1)
    current = num(bs3)
    result = pd.Series(pd.NA, index=lifetime.index, dtype="string")
    result.loc[current == 1] = "daily_current"
    result.loc[current == 2] = "occasional_current"
    result.loc[current == 3] = "former_currently_not_smoking"
    result.loc[result.isna() & (lifetime == 3)] = "never_smoked"
    return result


def derive_alcohol_frequency(series: pd.Series) -> pd.Series:
    values = num(series)
    result = pd.Series(pd.NA, index=values.index, dtype="string")
    labels = {
        1: "none_past_year",
        2: "lt_monthly",
        3: "monthly_once",
        4: "monthly_2_4",
        5: "weekly_2_3",
        6: "weekly_4_plus",
        8: "lifetime_nonapplicable",
    }
    for code, label in labels.items():
        result.loc[values == code] = label
    return result


def derive_alcohol_amount(
    frequency: pd.Series,
    amount: pd.Series,
) -> pd.Series:
    freq, amt = num(frequency), num(amount)
    result = pd.Series(pd.NA, index=freq.index, dtype="string")
    labels = {
        1: "1_2_drinks",
        2: "3_4_drinks",
        3: "5_6_drinks",
        4: "7_9_drinks",
        5: "10_plus_drinks",
    }
    for code, label in labels.items():
        result.loc[amt == code] = label
    result.loc[freq.isin([1, 8])] = "none"
    return result


def derive_walk_days(series: pd.Series) -> pd.Series:
    values = num(series)
    result = pd.Series(float("nan"), index=values.index)
    for code in range(1, 9):
        result.loc[values == code] = float(code - 1)
    return result


def derive_walk_minutes(
    days: pd.Series,
    hours: pd.Series,
    minutes: pd.Series,
) -> pd.Series:
    d, h, m = num(days), num(hours), num(minutes)
    h = h.mask(h.isin([88, 99]))
    m = m.mask(m.isin([88, 99]))
    result = pd.Series(float("nan"), index=d.index)
    result.loc[d == 1] = 0.0
    ok = d.isin(range(2, 9)) & h.notna() & m.notna() & (h >= 0) & m.between(0, 59)
    result.loc[ok] = h.loc[ok] * 60.0 + m.loc[ok]
    return result


def derive_strength(series: pd.Series) -> pd.Series:
    values = num(series)
    result = pd.Series(pd.NA, index=values.index, dtype="string")
    mapping = {
        1: "0_days",
        2: "1_day",
        3: "2_days",
        4: "3_days",
        5: "4_days",
        6: "5_plus_days",
    }
    for code, label in mapping.items():
        result.loc[values == code] = label
    return result


def derive_2023_sleep_hours(series: pd.Series) -> pd.Series:
    values = num(series)
    values = values.mask(values.isin([88, 99]))
    return values * 60.0


def validate_development(frame: pd.DataFrame) -> None:
    if len(frame) != EXPECTED_DEVELOPMENT_ROWS:
        raise SystemExit("STOP: development row count mismatch")
    if list(frame.columns) != PREPARED_COLUMNS:
        raise SystemExit("STOP: development columns/order violate frozen G3 contract")
    if frame["ID"].isna().any() or frame["ID"].duplicated().any():
        raise SystemExit("STOP: invalid development participant IDs")
    target = num(frame["v2_hypertension_state"])
    if target.isna().any() or set(target.unique()) != {0, 1}:
        raise SystemExit("STOP: invalid development target")
    weight = num(frame["wt_itvex"])
    if weight.isna().any() or (weight <= 0).any():
        raise SystemExit("STOP: invalid development survey weights")
    if frame["kstrata"].isna().any() or frame["psu"].isna().any():
        raise SystemExit("STOP: missing development survey-design fields")
    psus = frame[["kstrata", "psu"]].drop_duplicates().shape[0]
    if int(psus) != EXPECTED_DEVELOPMENT_PSUS:
        raise SystemExit("STOP: development PSU count mismatch")


def validate_external(frame: pd.DataFrame) -> None:
    if frame.empty:
        raise SystemExit("STOP: empty external cohort")
    if list(frame.columns) != PREPARED_COLUMNS:
        raise SystemExit("STOP: external columns/order violate frozen semantic contract")
    if frame["ID"].isna().any() or frame["ID"].duplicated().any():
        raise SystemExit("STOP: invalid external participant IDs")
    target = num(frame["v2_hypertension_state"])
    if target.isna().any() or not set(target.unique()).issubset({0, 1}):
        raise SystemExit("STOP: invalid external target")
    if set(target.unique()) != {0, 1}:
        raise SystemExit("STOP: external cohort does not contain both target classes")
    weight = num(frame["wt_itvex"])
    if weight.isna().any() or (weight <= 0).any():
        raise SystemExit("STOP: invalid external survey weights")
    if frame["kstrata"].isna().any() or frame["psu"].isna().any():
        raise SystemExit("STOP: missing external survey-design fields")


def validate_g3_manifest(manifest: dict[str, Any]) -> None:
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


def load_aggregate_json(
    path: Path,
    *,
    expected_gate: str,
    expected_status: str | None = None,
) -> tuple[dict[str, Any], Path]:
    file_path = outside_repo(path)
    data = json.loads(file_path.read_text(encoding="utf-8"))
    if data.get("gate") != expected_gate:
        raise SystemExit(f"STOP: expected {expected_gate} evidence")
    if expected_status is not None and data.get("status") != expected_status:
        raise SystemExit(f"STOP: unexpected {expected_gate} evidence status")
    return data, file_path


def validate_g5_evidence(
    g5: dict[str, Any],
    *,
    development_sha256: str,
) -> None:
    if g5.get("g6_development_nomination") != "logistic_regression":
        raise SystemExit("STOP: G5 nomination is not logistic_regression")
    if g5.get("provenance", {}).get("development_sha256") != development_sha256:
        raise SystemExit("STOP: G5 evidence belongs to different development data")


def validate_g6_evidence(
    g6: dict[str, Any],
    *,
    development_sha256: str,
) -> None:
    if g6.get("candidate") != "logistic_regression":
        raise SystemExit("STOP: G6 candidate changed")
    if g6.get("gate_decision", {}).get("decision") != "PASS_ADVANCE_TO_G7":
        raise SystemExit("STOP: G6 did not pass")
    if g6.get("provenance", {}).get("development_sha256") != development_sha256:
        raise SystemExit("STOP: G6 evidence belongs to different development data")
    if g6.get("safety", {}).get("final_test_file_read") is not False:
        raise SystemExit("STOP: G6 final-test safety state is invalid")


def validate_g7a_evidence(
    g7a: dict[str, Any],
) -> None:
    if g7a.get("decision") != "APPROVE_KNHANES_2023_FOR_G7":
        raise SystemExit("STOP: G7-A did not approve KNHANES 2023")
    if g7a.get("participant_values_accessed") is not False:
        raise SystemExit("STOP: G7-A participant-value safety state is invalid")
    if g7a.get("performance_accessed") is not False:
        raise SystemExit("STOP: G7-A performance safety state is invalid")
    if g7a.get("source", {}).get("sha256") != EXPECTED_EXTERNAL_SOURCE_SHA256:
        raise SystemExit("STOP: G7-A source hash does not match G7 contract")


def load_validated_development(
    development_path: Path,
    manifest_path: Path,
) -> tuple[pd.DataFrame, dict[str, Any], Path, str]:
    development_path = guard_development_path(development_path)
    manifest_path = outside_repo(manifest_path)

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    validate_g3_manifest(manifest)

    expected_dev_hash = manifest["files"]["development"]["sha256"]
    actual_dev_hash = sha256(development_path)
    if actual_dev_hash != expected_dev_hash:
        raise SystemExit("STOP: development hash does not match G3 manifest")

    development = pd.read_parquet(development_path)
    validate_development(development)
    return development, manifest, manifest_path, actual_dev_hash


def validate_external_source_file(
    source_path: Path,
) -> str:
    if not source_path.exists() or not source_path.is_file():
        raise SystemExit("STOP: KNHANES 2023 source file is missing")

    actual_source_hash = sha256(source_path)
    if actual_source_hash != EXPECTED_EXTERNAL_SOURCE_SHA256:
        raise SystemExit("STOP: KNHANES 2023 source hash mismatch")
    return actual_source_hash


def build_preflight_provenance(
    *,
    development_sha256: str,
    manifest_path: Path,
    g5_path: Path,
    g6_path: Path,
    g7a_path: Path,
    external_source_sha256: str,
) -> dict[str, str]:
    return {
        "development_sha256": development_sha256,
        "g3_manifest_sha256": sha256(manifest_path),
        "g5_evidence_sha256": sha256(g5_path),
        "g6_evidence_sha256": sha256(g6_path),
        "g7a_evidence_sha256": sha256(g7a_path),
        "external_source_sha256": external_source_sha256,
    }


def load_preflight_inputs(
    development_path: Path,
    manifest_path: Path,
    g5_evidence_path: Path,
    g6_evidence_path: Path,
    g7a_evidence_path: Path,
    external_source_path: Path,
) -> tuple[
    pd.DataFrame,
    dict[str, Any],
    dict[str, Any],
    dict[str, Any],
    dict[str, Any],
    dict[str, str],
]:
    source_path = guard_external_source(external_source_path)

    (
        development,
        manifest,
        manifest_path,
        actual_dev_hash,
    ) = load_validated_development(
        development_path,
        manifest_path,
    )

    g5, g5_path = load_aggregate_json(
        g5_evidence_path,
        expected_gate="Model V2 G5",
        expected_status="bounded_development_family_screen_complete",
    )
    validate_g5_evidence(
        g5,
        development_sha256=actual_dev_hash,
    )

    g6, g6_path = load_aggregate_json(
        g6_evidence_path,
        expected_gate="Model V2 G6",
        expected_status="frozen_validation_consumed",
    )
    validate_g6_evidence(
        g6,
        development_sha256=actual_dev_hash,
    )

    g7a, g7a_path = load_aggregate_json(
        g7a_evidence_path,
        expected_gate="Model V2 G7-A",
        expected_status="revised_metadata_only_schema_screen_complete",
    )
    validate_g7a_evidence(g7a)

    actual_source_hash = validate_external_source_file(source_path)

    provenance = build_preflight_provenance(
        development_sha256=actual_dev_hash,
        manifest_path=manifest_path,
        g5_path=g5_path,
        g6_path=g6_path,
        g7a_path=g7a_path,
        external_source_sha256=actual_source_hash,
    )
    return development, manifest, g5, g6, g7a, provenance


def prepare_external_cohort(source_path: Path) -> pd.DataFrame:
    try:
        import pyreadstat
    except ImportError as exc:
        raise SystemExit(
            "STOP: pyreadstat is required only for external SAS consumption; run with `uv run --with pyreadstat ...`"
        ) from exc

    raw, _ = pyreadstat.read_sas7bdat(
        str(source_path),
        usecols=RAW_COLUMNS,
    )
    if raw["ID"].isna().any() or raw["ID"].duplicated().any():
        raise SystemExit("STOP: invalid source participant IDs")

    age = num(raw["age"])
    hp = num(raw["HE_HP"])
    weight = num(raw["wt_itvex"])
    pregnancy = num(raw["HE_prg"])

    eligible = (
        (age >= 19)
        & hp.isin([1, 2, 3, 4])
        & raw["ID"].notna()
        & raw["kstrata"].notna()
        & raw["psu"].notna()
        & weight.notna()
        & (weight > 0)
        & (pregnancy != 1)
    )
    cohort = raw.loc[eligible].copy()
    if cohort.empty:
        raise SystemExit("STOP: empty G7 external cohort")

    out = pd.DataFrame(index=cohort.index)
    out["ID"] = cohort["ID"].astype(str)
    out["v2_hypertension_state"] = (num(cohort["HE_HP"]) == 4).astype("int8")
    out["age_years"] = num(cohort["age"])
    sex = num(cohort["sex"])
    out["sex_knhanes"] = sex.where(sex.isin([1, 2]))
    out["bmi_from_height_weight"] = derive_bmi(
        cohort["HE_ht"],
        cohort["HE_wt"],
    )
    out["cigarette_smoking_state"] = derive_smoking(
        cohort["BS1_1"],
        cohort["BS3_1"],
    )
    out["alcohol_frequency"] = derive_alcohol_frequency(cohort["BD1_11"])
    out["alcohol_amount_category"] = derive_alcohol_amount(
        cohort["BD1_11"],
        cohort["BD2_1"],
    )
    out["walking_days_7d"] = derive_walk_days(cohort["BE3_31"])
    out["walking_minutes_per_active_day"] = derive_walk_minutes(
        cohort["BE3_31"],
        cohort["BE3_32"],
        cohort["BE3_33"],
    )
    out["strength_days_7d"] = derive_strength(cohort["BE5_1"])
    out["weekday_sleep_minutes"] = derive_2023_sleep_hours(cohort["BP16_1"])
    out["weekend_sleep_minutes"] = derive_2023_sleep_hours(cohort["BP16_2"])
    out["wt_itvex"] = num(cohort["wt_itvex"])
    out["kstrata"] = cohort["kstrata"]
    out["psu"] = cohort["psu"]

    out = out[PREPARED_COLUMNS].copy()
    validate_external(out)
    return out


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
    return Pipeline(
        [
            ("preprocess", preprocess),
            ("model", model),
        ]
    )


def fit_predict(
    development: pd.DataFrame,
    external: pd.DataFrame,
) -> np.ndarray:
    x_dev = canonicalize_features(development)
    x_external = canonicalize_features(external)
    y_dev = development["v2_hypertension_state"].astype(int).to_numpy()

    train_weight = development["wt_itvex"].astype(float).to_numpy()
    train_weight = train_weight / float(train_weight.mean())

    pipeline = make_pipeline()
    pipeline.fit(
        x_dev,
        y_dev,
        model__sample_weight=train_weight,
    )
    probability = pipeline.predict_proba(x_external)[:, 1]
    if not np.isfinite(probability).all() or (probability < 0).any() or (probability > 1).any():
        raise SystemExit("STOP: invalid external probabilities")
    return probability


def metrics(
    y: np.ndarray,
    probability: np.ndarray,
    weight: np.ndarray | None,
) -> dict[str, float]:
    return {
        "auroc": float(roc_auc_score(y, probability, sample_weight=weight)),
        "average_precision": float(
            average_precision_score(
                y,
                probability,
                sample_weight=weight,
            )
        ),
        "brier": float(
            brier_score_loss(
                y,
                probability,
                sample_weight=weight,
            )
        ),
    }


def calibration_diagnostics(
    y: np.ndarray,
    probability: np.ndarray,
    weight: np.ndarray,
) -> dict[str, Any]:
    epsilon = np.finfo(np.float64).eps
    clipped = np.clip(
        probability,
        epsilon,
        1.0 - epsilon,
    )
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
    return {
        "intercept": float(diagnostic.intercept_[0]),
        "slope": float(diagnostic.coef_[0, 0]),
        "evaluation_only_not_recalibration": True,
    }


def safe_weighted_subgroup_metrics(
    frame: pd.DataFrame,
    probability: np.ndarray,
    mask: np.ndarray,
) -> dict[str, Any]:
    y = frame.loc[mask, "v2_hypertension_state"].astype(int).to_numpy()
    weight = frame.loc[mask, "wt_itvex"].astype(float).to_numpy()
    probability_subset = probability[mask]

    result: dict[str, Any] = {
        "rows": int(mask.sum()),
        "weighted_brier": (
            float(
                brier_score_loss(
                    y,
                    probability_subset,
                    sample_weight=weight,
                )
            )
            if len(y)
            else None
        ),
        "both_classes_present": (len(np.unique(y)) == 2 if len(y) else False),
    }
    if result["both_classes_present"]:
        result["weighted_auroc"] = float(
            roc_auc_score(
                y,
                probability_subset,
                sample_weight=weight,
            )
        )
        result["weighted_average_precision"] = float(
            average_precision_score(
                y,
                probability_subset,
                sample_weight=weight,
            )
        )
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
    external_metrics: dict[str, float],
    calibration: dict[str, Any],
    g6_validation_auroc: float,
) -> dict[str, Any]:
    external_auroc = external_metrics["auroc"]
    external_brier = external_metrics["brier"]
    slope = float(calibration["slope"])

    criteria = {
        "weighted_external_auroc_at_least_0_75": (external_auroc >= MIN_EXTERNAL_AUROC),
        "g6_validation_minus_external_auroc_at_most_0_08": (
            g6_validation_auroc - external_auroc <= MAX_G6_MINUS_EXTERNAL_AUROC
        ),
        "weighted_external_brier_at_most_0_20": (external_brier <= MAX_EXTERNAL_BRIER),
        "calibration_slope_finite_positive": (np.isfinite(slope) and slope > 0),
        "integrity_provenance_reproducibility_safety_checks": True,
    }
    passed = all(criteria.values())
    return {
        "criteria": criteria,
        "passed": passed,
        "decision": ("PASS_ADVANCE_TO_G8_REVIEW" if passed else "STOP_EXTERNAL_TRANSPORTABILITY_GATE_FAILED"),
    }


def write_consumption_marker(
    output: Path,
    *,
    commit: str,
    source_path: Path,
) -> Path:
    marker = output / "EXTERNAL_CONSUMPTION_MARKER.json"
    marker.write_text(
        json.dumps(
            {
                "gate": "Model V2 G7",
                "state": "external_consumption_started",
                "created_at_utc": datetime.now(UTC).isoformat(),
                "execution_commit": commit,
                "external_filename": source_path.name,
                "external_sha256": EXPECTED_EXTERNAL_SOURCE_SHA256,
                "warning": ("Do not delete this directory to repeat external-performance-driven evaluation."),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return marker


def run_preflight(args: argparse.Namespace) -> int:
    (
        development,
        _manifest,
        _g5,
        g6,
        _g7a,
        provenance,
    ) = load_preflight_inputs(
        args.development,
        args.g3_manifest,
        args.g5_evidence,
        args.g6_evidence,
        args.g7a_evidence,
        args.external_source,
    )

    g6_auroc = float(g6["validation_metrics"]["survey_weighted"]["auroc"])
    if not np.isfinite(g6_auroc):
        raise SystemExit("STOP: invalid G6 validation AUROC")

    print("=== Model V2 G7 preflight ===")
    print("candidate: logistic_regression")
    print("development rows:", len(development))
    print("development/G3/G5/G6/G7-A provenance: PASS")
    print(
        "external source SHA-256:",
        provenance["external_source_sha256"],
    )
    print("G6 weighted validation AUROC:", f"{g6_auroc:.9f}")
    print("external participant rows read: False")
    print("external target prevalence accessed: False")
    print("external performance accessed: False")
    print("final-test file read: False")
    print("PRECHECK PASS — commit contract/runner before consumption")
    return 0


def consume_external(args: argparse.Namespace) -> int:
    if git("status", "--porcelain", "--untracked-files=all"):
        raise SystemExit("STOP: consume G7 only from a clean committed checkout")

    commit = git("rev-parse", "HEAD")
    (
        development,
        _manifest,
        _g5,
        g6,
        _g7a,
        provenance,
    ) = load_preflight_inputs(
        args.development,
        args.g3_manifest,
        args.g5_evidence,
        args.g6_evidence,
        args.g7a_evidence,
        args.external_source,
    )

    source_path = guard_external_source(args.external_source)
    output = outside_repo(args.output)
    if output.exists():
        raise SystemExit("STOP: G7 output path already exists; do not repeat external evaluation")

    output.mkdir(parents=True, exist_ok=False)
    marker = write_consumption_marker(
        output,
        commit=commit,
        source_path=source_path,
    )

    # Participant-level KNHANES 2023 access begins only after marker creation.
    external = prepare_external_cohort(source_path)

    with threadpool_limits(limits=1):
        probability_1 = fit_predict(development, external)
        probability_2 = fit_predict(development, external)

    max_abs_diff = float(np.max(np.abs(probability_1 - probability_2)))
    if max_abs_diff > REPRO_ATOL:
        raise SystemExit(f"STOP: G7 reproducibility failed after external consumption: {max_abs_diff}")

    if git("rev-parse", "HEAD") != commit or git("status", "--porcelain", "--untracked-files=all"):
        raise SystemExit("STOP: checkout changed during G7 external evaluation")

    y = external["v2_hypertension_state"].astype(int).to_numpy()
    weight = external["wt_itvex"].astype(float).to_numpy()

    weighted = metrics(y, probability_1, weight)
    unweighted = metrics(y, probability_1, None)
    calibration = calibration_diagnostics(
        y,
        probability_1,
        weight,
    )

    g6_validation_auroc = float(g6["validation_metrics"]["survey_weighted"]["auroc"])
    gate = build_gate_decision(
        weighted,
        calibration,
        g6_validation_auroc,
    )

    cohort_path = output / "external-cohort.parquet"
    external.to_parquet(cohort_path, index=False)

    predictions_path = output / "external-predictions.parquet"
    pd.DataFrame(
        {
            "ID": external["ID"].astype(str),
            "probability": probability_1,
        }
    ).to_parquet(predictions_path, index=False)

    provenance.update(
        {
            "consumption_marker_sha256": sha256(marker),
            "external_cohort_sha256": sha256(cohort_path),
        }
    )

    evidence = {
        "schema_version": 1,
        "gate": "Model V2 G7",
        "status": "external_transportability_consumed",
        "created_at_utc": datetime.now(UTC).isoformat(),
        "execution_commit": commit,
        "config": CONFIG,
        "config_sha256": canonical_json_sha256(CONFIG),
        "candidate": "logistic_regression",
        "evaluation_type": ("temporal_korean_transportability_with_predeclared_sleep_measurement_shift"),
        "provenance": provenance,
        "development_rows": int(len(development)),
        "development_psu_groups": int(development[["kstrata", "psu"]].drop_duplicates().shape[0]),
        "external_rows": int(len(external)),
        "external_psu_groups": int(external[["kstrata", "psu"]].drop_duplicates().shape[0]),
        "g6_validation_reference": {
            "weighted_auroc": g6_validation_auroc,
            "used_for_fitting": False,
            "used_only_for_predeclared_gate_comparison": True,
        },
        "external_metrics": {
            "survey_weighted": weighted,
            "unweighted_sensitivity": unweighted,
            "calibration": calibration,
        },
        "subgroups": subgroup_audit(
            external,
            probability_1,
        ),
        "reproducibility": {
            "two_fresh_full_development_fits": True,
            "same_in_memory_external_frame": True,
            "max_abs_probability_difference": max_abs_diff,
            "required_atol": REPRO_ATOL,
            "passed": True,
        },
        "gate_decision": gate,
        "external_cohort_file": {
            "filename": cohort_path.name,
            "sha256": sha256(cohort_path),
            "participant_level": True,
            "committable": False,
        },
        "external_predictions_file": {
            "filename": predictions_path.name,
            "sha256": sha256(predictions_path),
            "participant_level": True,
            "committable": False,
        },
        "safety": {
            "external_consumed_once_in_g7_event": True,
            "external_used_for_model_change": False,
            "g6_validation_participant_data_read": False,
            "g6_validation_labels_used_for_fitting": False,
            "final_test_file_read": False,
            "final_test_performance_accessed": False,
            "v1_validation_or_test_used": False,
            "feature_contract_changed": False,
            "model_family_changed": False,
            "hyperparameter_tuning_performed": False,
            "threshold_selection_performed": False,
            "recalibration_performed": False,
            "production_serialization_performed": False,
            "sleep_mapping_changed_after_performance_access": False,
        },
    }

    evidence_path = output / "g7-external-evidence.json"
    evidence_path.write_text(
        json.dumps(
            evidence,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print("=== Model V2 G7 KNHANES 2023 transportability evaluation ===")
    print("candidate: logistic_regression")
    print("external rows:", len(external))
    print(
        "external PSU groups:",
        evidence["external_psu_groups"],
    )
    print("weighted AUROC:", f"{weighted['auroc']:.9f}")
    print(
        "weighted AP:",
        f"{weighted['average_precision']:.9f}",
    )
    print("weighted Brier:", f"{weighted['brier']:.9f}")
    print(
        "calibration intercept:",
        f"{calibration['intercept']:.9f}",
    )
    print(
        "calibration slope:",
        f"{calibration['slope']:.9f}",
    )
    print(
        "G6 validation AUROC reference:",
        f"{g6_validation_auroc:.9f}",
    )
    print("repro max abs diff:", f"{max_abs_diff:.3e}")
    print("G7 decision:", gate["decision"])
    print("evidence:", evidence_path)
    print("final-test file read: False")
    print("threshold selection: False")
    print("recalibration: False")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--development",
        type=Path,
        required=True,
    )
    parser.add_argument(
        "--external-source",
        type=Path,
        required=True,
    )
    parser.add_argument(
        "--g3-manifest",
        type=Path,
        required=True,
    )
    parser.add_argument(
        "--g5-evidence",
        type=Path,
        required=True,
    )
    parser.add_argument(
        "--g6-evidence",
        type=Path,
        required=True,
    )
    parser.add_argument(
        "--g7a-evidence",
        type=Path,
        required=True,
    )
    parser.add_argument("--output", type=Path)

    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--preflight-only",
        action="store_true",
    )
    mode.add_argument(
        "--consume-external",
        action="store_true",
    )
    args = parser.parse_args()

    if args.preflight_only:
        return run_preflight(args)

    if args.output is None:
        raise SystemExit("STOP: --output is required with --consume-external")
    return consume_external(args)


if __name__ == "__main__":
    raise SystemExit(main())
