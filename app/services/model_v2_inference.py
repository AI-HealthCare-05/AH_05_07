"""Fail-closed Model V2 R1 inference boundary.

This module intentionally does not wire itself into the production router.
Production scoring remains disabled until a later explicit release gate.
"""

from __future__ import annotations

import hashlib
import math
import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

EXPECTED_ARTIFACT_SHA256 = "d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84"
EXPECTED_SCHEMA_VERSION = "model-v2-r1-schema-v1"
EXPECTED_PRODUCT_WORDING = "입력 기반 위험군 선별 신호"
ENABLE_ENV = "MODEL_V2_SCORING_ENABLED"
ARTIFACT_ENV = "MODEL_V2_ARTIFACT_PATH"

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

NUMERIC = {
    "age_years",
    "bmi_from_height_weight",
    "walking_days_7d",
    "walking_minutes_per_active_day",
    "weekday_sleep_minutes",
    "weekend_sleep_minutes",
}
CATEGORICAL = {
    "sex_knhanes",
    "cigarette_smoking_state",
    "alcohol_frequency",
    "alcohol_amount_category",
    "strength_days_7d",
}

SEX_KNHANES_CATEGORIES = (1, 2)
CIGARETTE_SMOKING_CATEGORIES = (
    "daily_current",
    "occasional_current",
    "former_currently_not_smoking",
    "never_smoked",
)
ALCOHOL_FREQUENCY_CATEGORIES = (
    "none_past_year",
    "lt_monthly",
    "monthly_once",
    "monthly_2_4",
    "weekly_2_3",
    "weekly_4_plus",
    "lifetime_nonapplicable",
)
ALCOHOL_AMOUNT_CATEGORIES = (
    "1_2_drinks",
    "3_4_drinks",
    "5_6_drinks",
    "7_9_drinks",
    "10_plus_drinks",
    "none",
)
STRENGTH_DAYS_CATEGORIES = (
    "0_days",
    "1_day",
    "2_days",
    "3_days",
    "4_days",
    "5_plus_days",
)
NON_DRINKING_FREQUENCIES = {"none_past_year", "lifetime_nonapplicable"}

CANONICAL_CATEGORIES = {
    "sex_knhanes": SEX_KNHANES_CATEGORIES,
    "cigarette_smoking_state": CIGARETTE_SMOKING_CATEGORIES,
    "alcohol_frequency": ALCOHOL_FREQUENCY_CATEGORIES,
    "alcohol_amount_category": ALCOHOL_AMOUNT_CATEGORIES,
    "strength_days_7d": STRENGTH_DAYS_CATEGORIES,
}


class ModelV2BoundaryError(RuntimeError):
    """Base error for fail-closed Model V2 inference."""


class ModelV2DisabledError(ModelV2BoundaryError):
    """Raised when the runtime switch is disabled."""


class ModelV2ArtifactError(ModelV2BoundaryError):
    """Raised when artifact verification/loading fails."""


class ModelV2InputError(ModelV2BoundaryError):
    """Raised when exact semantic input validation fails."""


@dataclass(frozen=True)
class ModelV2Score:
    score: float
    schema_version: str
    artifact_sha256: str
    product_wording: str


def _env_enabled(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def scoring_enabled() -> bool:
    return _env_enabled(os.getenv(ENABLE_ENV))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _require_exact_keys(payload: Mapping[str, Any]) -> None:
    keys = set(payload)
    required = set(FEATURES)
    missing = sorted(required - keys)
    extra = sorted(keys - required)
    if missing:
        raise ModelV2InputError(f"missing required Model V2 features: {missing}")
    if extra:
        raise ModelV2InputError(f"unexpected Model V2 features: {extra}")


def _validate_optional_number(name: str, value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ModelV2InputError(f"{name}: expected numeric value or null")
    result = float(value)
    if not math.isfinite(result):
        raise ModelV2InputError(f"{name}: non-finite numeric value")
    return result


def _validate_optional_string_category(name: str, value: Any, allowed: tuple[str, ...]) -> None:
    if value is None:
        return
    if not isinstance(value, str) or value not in allowed:
        raise ModelV2InputError(f"{name}: noncanonical category")


def _validate_optional_sex_category(value: Any) -> None:
    if value is None:
        return
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ModelV2InputError("sex_knhanes: expected numeric category 1 or 2 or null")
    numeric = float(value)
    if not math.isfinite(numeric) or numeric not in SEX_KNHANES_CATEGORIES:
        raise ModelV2InputError("sex_knhanes: noncanonical category")


def _validate_numeric_domains(numeric_values: Mapping[str, float | None]) -> None:
    bounds = {
        "age_years": (19, None, False),
        "bmi_from_height_weight": (0, None, True),
        "walking_days_7d": (0, 7, False),
        "walking_minutes_per_active_day": (0, 1440, False),
        "weekday_sleep_minutes": (0, 1440, False),
        "weekend_sleep_minutes": (0, 1440, False),
    }
    for name, (low, high, open_low) in bounds.items():
        value = numeric_values[name]
        if value is None:
            continue
        if low is not None:
            violates_low = value <= low if open_low else value < low
            if violates_low:
                raise ModelV2InputError(f"{name}: below allowed domain")
        if high is not None and value > high:
            raise ModelV2InputError(f"{name}: above allowed domain")

    walking_days = numeric_values["walking_days_7d"]
    if walking_days is not None and not walking_days.is_integer():
        raise ModelV2InputError("walking_days_7d: expected whole-day count")


def _validate_categorical_domains(clean: Mapping[str, Any]) -> None:
    _validate_optional_sex_category(clean["sex_knhanes"])
    categorical_validators = (
        (
            "cigarette_smoking_state",
            CIGARETTE_SMOKING_CATEGORIES,
        ),
        ("alcohol_frequency", ALCOHOL_FREQUENCY_CATEGORIES),
        ("alcohol_amount_category", ALCOHOL_AMOUNT_CATEGORIES),
        ("strength_days_7d", STRENGTH_DAYS_CATEGORIES),
    )
    for name, allowed in categorical_validators:
        _validate_optional_string_category(name, clean[name], allowed)


def _validate_structural_consistency(
    clean: Mapping[str, Any], numeric_values: Mapping[str, float | None]
) -> None:
    walking_days = numeric_values["walking_days_7d"]
    walking_minutes = numeric_values["walking_minutes_per_active_day"]
    if walking_days == 0 and walking_minutes != 0:
        raise ModelV2InputError(
            "walking_minutes_per_active_day: zero walking days requires structural zero minutes"
        )

    alcohol_frequency = clean["alcohol_frequency"]
    alcohol_amount = clean["alcohol_amount_category"]
    if alcohol_frequency in NON_DRINKING_FREQUENCIES and alcohol_amount != "none":
        raise ModelV2InputError("alcohol_amount_category: non-drinking branch requires none")
    if (
        alcohol_frequency is not None
        and alcohol_frequency not in NON_DRINKING_FREQUENCIES
        and alcohol_amount == "none"
    ):
        raise ModelV2InputError("alcohol_amount_category: none contradicts drinking frequency")


def validate_semantic_input(payload: Mapping[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, Mapping):
        raise ModelV2InputError("Model V2 payload must be a mapping")

    _require_exact_keys(payload)
    clean = dict(payload)
    numeric_values = {name: _validate_optional_number(name, clean[name]) for name in NUMERIC}

    _validate_numeric_domains(numeric_values)
    _validate_categorical_domains(clean)
    _validate_structural_consistency(clean, numeric_values)

    for name, value in numeric_values.items():
        clean[name] = value

    return clean


def _canonicalize_frame(payload: Mapping[str, Any]):
    # Heavy ML dependencies are imported only after the runtime switch and
    # artifact verification path are engaged.
    import numpy as np
    import pandas as pd

    frame = pd.DataFrame([dict(payload)], columns=FEATURES)
    for name in NUMERIC:
        frame[name] = pd.to_numeric(frame[name], errors="coerce")
    for name in CATEGORICAL:
        values = frame[name].astype("object")
        frame[name] = values.where(pd.notna(values), np.nan)
    return frame


def _resolve_artifact_path(artifact_path: str | Path | None) -> Path:
    raw_path = artifact_path if artifact_path is not None else os.getenv(ARTIFACT_ENV)
    if not raw_path:
        raise ModelV2ArtifactError("Model V2 artifact path is not configured")

    path = Path(raw_path).expanduser().resolve()
    if not path.is_file():
        raise ModelV2ArtifactError("Model V2 artifact file is unavailable")
    return path


def _load_artifact_payload(path: Path) -> dict[str, Any]:
    actual_sha = sha256(path)
    if actual_sha != EXPECTED_ARTIFACT_SHA256:
        raise ModelV2ArtifactError("Model V2 artifact SHA-256 mismatch")

    try:
        import joblib

        artifact = joblib.load(path)
    except Exception as exc:
        raise ModelV2ArtifactError("Model V2 artifact loading failed") from exc

    if not isinstance(artifact, dict):
        raise ModelV2ArtifactError("Model V2 artifact payload is not a mapping")
    return artifact


def _validate_artifact_payload(artifact: dict[str, Any]) -> None:
    if artifact.get("schema_version") != EXPECTED_SCHEMA_VERSION:
        raise ModelV2ArtifactError("Model V2 schema version mismatch")
    if artifact.get("feature_order") != FEATURES:
        raise ModelV2ArtifactError("Model V2 feature order mismatch")
    if artifact.get("product_wording") != EXPECTED_PRODUCT_WORDING:
        raise ModelV2ArtifactError("Model V2 product wording mismatch")
    if artifact.get("production_scoring_enabled") is not False:
        raise ModelV2ArtifactError("Frozen R1 production flag is not disabled")

    pipeline = artifact.get("pipeline")
    if pipeline is None or not callable(getattr(pipeline, "predict_proba", None)):
        raise ModelV2ArtifactError("Model V2 frozen pipeline cannot score")


def load_verified_artifact(
    artifact_path: str | Path | None = None,
    *,
    enabled: bool | None = None,
) -> dict[str, Any]:
    if enabled is None:
        enabled = scoring_enabled()
    if not enabled:
        raise ModelV2DisabledError("Model V2 scoring is disabled")

    path = _resolve_artifact_path(artifact_path)
    artifact = _load_artifact_payload(path)
    _validate_artifact_payload(artifact)
    return artifact


class ModelV2InferenceBoundary:
    def __init__(
        self,
        artifact_path: str | Path | None = None,
        *,
        enabled: bool | None = None,
    ) -> None:
        self._artifact = load_verified_artifact(artifact_path, enabled=enabled)

    @property
    def audit_metadata(self) -> dict[str, str]:
        return {
            "schema_version": EXPECTED_SCHEMA_VERSION,
            "artifact_sha256": EXPECTED_ARTIFACT_SHA256,
            "product_wording": EXPECTED_PRODUCT_WORDING,
        }

    def score(self, payload: Mapping[str, Any]) -> ModelV2Score:
        clean = validate_semantic_input(payload)
        frame = _canonicalize_frame(clean)
        try:
            probability = float(self._artifact["pipeline"].predict_proba(frame)[0, 1])
        except Exception as exc:
            raise ModelV2BoundaryError("Model V2 inference failed") from exc

        if not 0.0 <= probability <= 1.0:
            raise ModelV2BoundaryError("Model V2 inference returned an invalid score")

        return ModelV2Score(
            score=probability,
            schema_version=EXPECTED_SCHEMA_VERSION,
            artifact_sha256=EXPECTED_ARTIFACT_SHA256,
            product_wording=EXPECTED_PRODUCT_WORDING,
        )
