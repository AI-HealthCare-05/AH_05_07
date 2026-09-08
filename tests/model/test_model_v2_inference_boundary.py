from pathlib import Path

import pytest

from app.services.model_v2_inference import (
    ALCOHOL_AMOUNT_CATEGORIES,
    ALCOHOL_FREQUENCY_CATEGORIES,
    CIGARETTE_SMOKING_CATEGORIES,
    FEATURES,
    STRENGTH_DAYS_CATEGORIES,
    ModelV2ArtifactError,
    ModelV2DisabledError,
    ModelV2InputError,
    load_verified_artifact,
    validate_semantic_input,
)


def valid_payload() -> dict[str, object]:
    return {
        "age_years": 35,
        "sex_knhanes": 1,
        "bmi_from_height_weight": 23.5,
        "cigarette_smoking_state": "never_smoked",
        "alcohol_frequency": "lt_monthly",
        "alcohol_amount_category": "1_2_drinks",
        "walking_days_7d": 4,
        "walking_minutes_per_active_day": 40,
        "strength_days_7d": "2_days",
        "weekday_sleep_minutes": 420,
        "weekend_sleep_minutes": 480,
    }


def test_exact_feature_contract() -> None:
    payload = valid_payload()
    assert list(payload) == FEATURES
    clean = validate_semantic_input(payload)
    assert clean["age_years"] == 35.0
    assert clean["sex_knhanes"] == 1
    assert clean["strength_days_7d"] == "2_days"


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


def test_explicit_null_remains_distinct_from_missing() -> None:
    payload = valid_payload()
    payload["bmi_from_height_weight"] = None
    payload["weekday_sleep_minutes"] = None
    clean = validate_semantic_input(payload)
    assert clean["bmi_from_height_weight"] is None
    assert clean["weekday_sleep_minutes"] is None


@pytest.mark.parametrize("value", [1, 1.0, 2, 2.0])
def test_canonical_sex_categories_accepted(value: object) -> None:
    payload = valid_payload()
    payload["sex_knhanes"] = value
    assert validate_semantic_input(payload)["sex_knhanes"] == value


@pytest.mark.parametrize("value", CIGARETTE_SMOKING_CATEGORIES)
def test_canonical_smoking_categories_accepted(value: str) -> None:
    payload = valid_payload()
    payload["cigarette_smoking_state"] = value
    assert validate_semantic_input(payload)["cigarette_smoking_state"] == value


@pytest.mark.parametrize("value", ALCOHOL_FREQUENCY_CATEGORIES)
def test_canonical_alcohol_frequency_categories_accepted(value: str) -> None:
    payload = valid_payload()
    payload["alcohol_frequency"] = value
    if value in {"none_past_year", "lifetime_nonapplicable"}:
        payload["alcohol_amount_category"] = "none"
    assert validate_semantic_input(payload)["alcohol_frequency"] == value


@pytest.mark.parametrize("value", ALCOHOL_AMOUNT_CATEGORIES)
def test_canonical_alcohol_amount_categories_accepted(value: str) -> None:
    payload = valid_payload()
    payload["alcohol_amount_category"] = value
    if value == "none":
        payload["alcohol_frequency"] = "none_past_year"
    assert validate_semantic_input(payload)["alcohol_amount_category"] == value


@pytest.mark.parametrize("value", STRENGTH_DAYS_CATEGORIES)
def test_all_six_canonical_strength_categories_accepted(value: str) -> None:
    payload = valid_payload()
    payload["strength_days_7d"] = value
    assert validate_semantic_input(payload)["strength_days_7d"] == value


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("age_years", 18),
        ("bmi_from_height_weight", 0),
        ("walking_days_7d", -1),
        ("walking_days_7d", 8),
        ("walking_days_7d", 2.5),
        ("walking_minutes_per_active_day", -1),
        ("walking_minutes_per_active_day", 1441),
        ("weekday_sleep_minutes", -1),
        ("weekday_sleep_minutes", 1441),
        ("weekend_sleep_minutes", -1),
        ("weekend_sleep_minutes", 1441),
    ],
)
def test_impossible_numeric_values_rejected(field: str, value: object) -> None:
    payload = valid_payload()
    payload[field] = value
    with pytest.raises(ModelV2InputError):
        validate_semantic_input(payload)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("sex_knhanes", "1.0"),
        ("sex_knhanes", True),
        ("sex_knhanes", 3),
        ("strength_days_7d", 2),
        ("strength_days_7d", "2"),
        ("strength_days_7d", "unknown"),
        ("cigarette_smoking_state", "never"),
        ("alcohol_frequency", "2.0"),
        ("alcohol_amount_category", "1.0"),
        ("age_years", True),
        ("bmi_from_height_weight", True),
        ("walking_days_7d", True),
        ("walking_minutes_per_active_day", True),
        ("weekday_sleep_minutes", True),
        ("weekend_sleep_minutes", False),
        ("age_years", "35"),
        ("walking_days_7d", "4"),
        ("walking_minutes_per_active_day", "40"),
        ("weekday_sleep_minutes", "420"),
        ("bmi_from_height_weight", float("nan")),
        ("weekend_sleep_minutes", float("inf")),
        ("age_years", []),
        ("bmi_from_height_weight", {}),
        ("cigarette_smoking_state", []),
        ("alcohol_frequency", {}),
    ],
)
def test_noncanonical_type_or_category_rejected(field: str, value: object) -> None:
    payload = valid_payload()
    payload[field] = value
    with pytest.raises(ModelV2InputError):
        validate_semantic_input(payload)


def test_zero_walking_days_requires_structural_zero_minutes() -> None:
    payload = valid_payload()
    payload["walking_days_7d"] = 0
    payload["walking_minutes_per_active_day"] = 0
    assert validate_semantic_input(payload)["walking_minutes_per_active_day"] == 0.0

    payload["walking_minutes_per_active_day"] = 1
    with pytest.raises(ModelV2InputError):
        validate_semantic_input(payload)

    payload["walking_minutes_per_active_day"] = None
    with pytest.raises(ModelV2InputError):
        validate_semantic_input(payload)


@pytest.mark.parametrize("frequency", ["none_past_year", "lifetime_nonapplicable"])
def test_non_drinking_branch_requires_none_amount(frequency: str) -> None:
    payload = valid_payload()
    payload["alcohol_frequency"] = frequency
    payload["alcohol_amount_category"] = "none"
    assert validate_semantic_input(payload)["alcohol_amount_category"] == "none"

    payload["alcohol_amount_category"] = "1_2_drinks"
    with pytest.raises(ModelV2InputError):
        validate_semantic_input(payload)


def test_drinking_branch_rejects_none_amount() -> None:
    payload = valid_payload()
    payload["alcohol_frequency"] = "lt_monthly"
    payload["alcohol_amount_category"] = "none"
    with pytest.raises(ModelV2InputError):
        validate_semantic_input(payload)



def test_payload_container_must_be_mapping() -> None:
    with pytest.raises(ModelV2InputError):
        validate_semantic_input([])  # type: ignore[arg-type]

def test_disabled_prevents_artifact_access(tmp_path: Path) -> None:
    path = tmp_path / "missing.joblib"
    with pytest.raises(ModelV2DisabledError):
        load_verified_artifact(path, enabled=False)


def test_enabled_missing_artifact_fails_closed(tmp_path: Path) -> None:
    path = tmp_path / "missing.joblib"
    with pytest.raises(ModelV2ArtifactError):
        load_verified_artifact(path, enabled=True)


def test_synthetic_source_answer_parity_fixtures_are_canonical() -> None:
    import json

    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "model_v2_t2_source_answer_parity.json"
    cases = json.loads(fixture_path.read_text(encoding="utf-8"))
    assert {case["name"] for case in cases} == {
        "active_walking_and_drinking",
        "structural_no_walk_and_no_drink",
    }
    for case in cases:
        semantic_payload = case["semantic_payload"]
        assert list(semantic_payload) == FEATURES
        assert validate_semantic_input(semantic_payload) == {
            **semantic_payload,
            "age_years": float(semantic_payload["age_years"]),
            "bmi_from_height_weight": float(semantic_payload["bmi_from_height_weight"]),
            "walking_days_7d": float(semantic_payload["walking_days_7d"]),
            "walking_minutes_per_active_day": float(semantic_payload["walking_minutes_per_active_day"]),
            "weekday_sleep_minutes": float(semantic_payload["weekday_sleep_minutes"]),
            "weekend_sleep_minutes": float(semantic_payload["weekend_sleep_minutes"]),
        }
