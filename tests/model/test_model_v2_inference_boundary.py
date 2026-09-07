from pathlib import Path

import pytest

from app.services.model_v2_inference import (
    FEATURES,
    ModelV2ArtifactError,
    ModelV2DisabledError,
    ModelV2InputError,
    load_verified_artifact,
    validate_semantic_input,
)


def valid_payload() -> dict[str, object]:
    return {
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
    }


def test_exact_feature_contract() -> None:
    payload = valid_payload()
    assert list(payload) == FEATURES
    assert validate_semantic_input(payload)["age_years"] == 35.0


def test_missing_feature_rejected() -> None:
    payload = valid_payload()
    payload.pop("age_years")
    with pytest.raises(ModelV2InputError):
        validate_semantic_input(payload)


def test_extra_feature_rejected() -> None:
    payload = valid_payload()
    payload["extra"] = 1
    with pytest.raises(ModelV2InputError):
        validate_semantic_input(payload)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("age_years", 18),
        ("bmi_from_height_weight", 0),
        ("walking_days_7d", 8),
        ("walking_minutes_per_active_day", -1),
        ("strength_days_7d", 6),
        ("weekday_sleep_minutes", 1441),
        ("weekend_sleep_minutes", -1),
    ],
)
def test_impossible_numeric_values_rejected(field: str, value: object) -> None:
    payload = valid_payload()
    payload[field] = value
    with pytest.raises(ModelV2InputError):
        validate_semantic_input(payload)


def test_disabled_prevents_artifact_access(tmp_path: Path) -> None:
    path = tmp_path / "missing.joblib"
    with pytest.raises(ModelV2DisabledError):
        load_verified_artifact(path, enabled=False)


def test_enabled_missing_artifact_fails_closed(tmp_path: Path) -> None:
    path = tmp_path / "missing.joblib"
    with pytest.raises(ModelV2ArtifactError):
        load_verified_artifact(path, enabled=True)
