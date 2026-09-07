"""Fail-closed Model V2 R1 inference boundary.

This module intentionally does not wire itself into the production router.
Production scoring remains disabled until a later explicit release gate.
"""

from __future__ import annotations

import hashlib
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


def _coerce_optional_float(name: str, value: Any) -> float | None:
    if value is None:
        return None
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise ModelV2InputError(f"{name}: expected numeric value or null") from exc

    import math

    if not math.isfinite(result):
        raise ModelV2InputError(f"{name}: non-finite numeric value")
    return result


def validate_semantic_input(payload: Mapping[str, Any]) -> dict[str, Any]:
    _require_exact_keys(payload)
    clean = dict(payload)

    numeric_values = {name: _coerce_optional_float(name, clean[name]) for name in NUMERIC}

    def bounds(
        name: str,
        *,
        low: float | None = None,
        high: float | None = None,
        open_low: bool = False,
    ) -> None:
        value = numeric_values[name]
        if value is None:
            return
        if low is not None:
            violates = value <= low if open_low else value < low
            if violates:
                raise ModelV2InputError(f"{name}: below allowed domain")
        if high is not None and value > high:
            raise ModelV2InputError(f"{name}: above allowed domain")

    bounds("age_years", low=19)
    bounds("bmi_from_height_weight", low=0, open_low=True)
    bounds("walking_days_7d", low=0, high=7)
    bounds("walking_minutes_per_active_day", low=0, high=1440)
    bounds("weekday_sleep_minutes", low=0, high=1440)
    bounds("weekend_sleep_minutes", low=0, high=1440)

    # strength_days_7d is frozen as a categorical predictor, but its semantic
    # domain remains an encoded 0..5 day count.
    strength = _coerce_optional_float("strength_days_7d", clean["strength_days_7d"])
    if strength is not None and not (0 <= strength <= 5):
        raise ModelV2InputError("strength_days_7d: outside allowed domain")

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
