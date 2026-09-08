import math
from copy import deepcopy

import pytest

from app.services.model_v2_inference import FEATURES, validate_semantic_input
from app.services.model_v2_input_adapter import (
    ADAPTER_VERSION,
    INPUT_FIELDS,
    ModelV2AdapterError,
    adapt_product_input_v1,
)

VALID_INPUT = {
    "age_years": 35,
    "sex_knhanes": 1,
    "height_cm": 170.0,
    "weight_kg": 68.0,
    "cigarette_smoking_state": "never_smoked",
    "alcohol_frequency": "lt_monthly",
    "alcohol_amount_category": "1_2_drinks",
    "walking_days_7d": 4,
    "walking_active_day_hours": 0,
    "walking_active_day_minutes": 40,
    "strength_days_7d": "2_days",
    "weekday_bed_hour": 23,
    "weekday_bed_minute": 30,
    "weekday_wake_hour": 7,
    "weekday_wake_minute": 0,
    "weekend_bed_hour": 22,
    "weekend_bed_minute": 0,
    "weekend_wake_hour": 8,
    "weekend_wake_minute": 0,
}


def adapt(**updates):
    payload = deepcopy(VALID_INPUT)
    payload.update(updates)
    return adapt_product_input_v1(payload)


def test_adapter_version_is_explicit() -> None:
    assert ADAPTER_VERSION == "model-v2-product-input-adapter-v1"


def test_input_contract_is_exact_and_versioned() -> None:
    assert len(INPUT_FIELDS) == 19
    assert tuple(VALID_INPUT) == INPUT_FIELDS


def test_complete_synthetic_payload_maps_to_exact_frozen_features() -> None:
    result = adapt()

    assert tuple(result) == tuple(FEATURES)
    assert result["age_years"] == 35.0
    assert result["sex_knhanes"] == 1
    assert result["cigarette_smoking_state"] == "never_smoked"
    assert result["walking_minutes_per_active_day"] == 40.0
    assert result["weekday_sleep_minutes"] == 450.0
    assert result["weekend_sleep_minutes"] == 600.0
    assert validate_semantic_input(result) == result


def test_bmi_is_derived_without_new_rounding() -> None:
    result = adapt(height_cm=173.2, weight_kg=71.35)
    expected = 71.35 / ((173.2 / 100.0) ** 2)

    assert result["bmi_from_height_weight"] == expected
    assert not math.isclose(result["bmi_from_height_weight"], round(expected, 2), rel_tol=0, abs_tol=1e-12)


def test_cycle9_sleep_adjustment_matches_g3_derivation() -> None:
    result = adapt(
        weekday_bed_hour=23,
        weekday_bed_minute=45,
        weekday_wake_hour=6,
        weekday_wake_minute=15,
        weekend_bed_hour=24,
        weekend_bed_minute=0,
        weekend_wake_hour=8,
        weekend_wake_minute=0,
    )

    assert result["weekday_sleep_minutes"] == 390.0
    assert result["weekend_sleep_minutes"] == 480.0


def test_cycle9_invalid_combination_is_not_replaced_by_generic_elapsed_time() -> None:
    with pytest.raises(ModelV2AdapterError, match="failed frozen semantic validation"):
        adapt(
            weekday_bed_hour=0,
            weekday_bed_minute=0,
            weekday_wake_hour=8,
            weekday_wake_minute=0,
        )


def test_zero_walk_branch_requires_zero_components_and_derives_zero() -> None:
    result = adapt(
        walking_days_7d=0,
        walking_active_day_hours=0,
        walking_active_day_minutes=0,
    )
    assert result["walking_minutes_per_active_day"] == 0.0

    with pytest.raises(ModelV2AdapterError, match="zero walking days"):
        adapt(
            walking_days_7d=0,
            walking_active_day_hours=0,
            walking_active_day_minutes=1,
        )


def test_active_walk_duration_is_derived_from_components() -> None:
    result = adapt(
        walking_days_7d=3,
        walking_active_day_hours=1,
        walking_active_day_minutes=15,
    )
    assert result["walking_minutes_per_active_day"] == 75.0


def test_walk_duration_above_frozen_semantic_domain_is_rejected() -> None:
    with pytest.raises(ModelV2AdapterError, match="failed frozen semantic validation"):
        adapt(
            walking_days_7d=1,
            walking_active_day_hours=24,
            walking_active_day_minutes=1,
        )


@pytest.mark.parametrize("frequency", ["none_past_year", "lifetime_nonapplicable"])
def test_non_drinking_branch_requires_none_amount(frequency: str) -> None:
    result = adapt(alcohol_frequency=frequency, alcohol_amount_category="none")
    assert result["alcohol_amount_category"] == "none"

    with pytest.raises(ModelV2AdapterError, match="non-drinking branch requires none"):
        adapt(alcohol_frequency=frequency, alcohol_amount_category="1_2_drinks")


def test_drinking_frequency_rejects_none_amount() -> None:
    with pytest.raises(ModelV2AdapterError, match="none contradicts drinking frequency"):
        adapt(alcohol_frequency="monthly_once", alcohol_amount_category="none")


@pytest.mark.parametrize("field", INPUT_FIELDS)
def test_null_is_rejected_for_every_adapter_field(field: str) -> None:
    with pytest.raises(ModelV2AdapterError):
        adapt(**{field: None})


def test_age_below_19_is_rejected_without_inventing_upper_cutoff() -> None:
    with pytest.raises(ModelV2AdapterError, match="age_years"):
        adapt(age_years=18)

    assert adapt(age_years=121)["age_years"] == 121.0


@pytest.mark.parametrize("value", ["1", "1.0", True])
def test_sex_non_numeric_or_bool_rejected(value) -> None:
    with pytest.raises(ModelV2AdapterError, match="sex_knhanes"):
        adapt(sex_knhanes=value)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("cigarette_smoking_state", "never"),
        ("alcohol_frequency", "2.0"),
        ("alcohol_amount_category", "1.0"),
        ("strength_days_7d", 2),
    ],
)
def test_noncanonical_categories_rejected(field: str, value) -> None:
    with pytest.raises(ModelV2AdapterError):
        adapt(**{field: value})


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("age_years", "35"),
        ("height_cm", float("nan")),
        ("weight_kg", float("inf")),
        ("walking_days_7d", [4]),
        ("walking_active_day_minutes", {"minutes": 40}),
    ],
)
def test_invalid_numeric_representations_rejected(field: str, value) -> None:
    with pytest.raises(ModelV2AdapterError):
        adapt(**{field: value})


def test_fractional_walking_days_rejected() -> None:
    with pytest.raises(ModelV2AdapterError, match="whole-number"):
        adapt(walking_days_7d=3.5)


def test_sleep_clock_components_are_strict_whole_numbers() -> None:
    with pytest.raises(ModelV2AdapterError, match="whole-number"):
        adapt(weekday_bed_hour=23.5)

    with pytest.raises(ModelV2AdapterError, match="above allowed domain"):
        adapt(weekend_wake_minute=60)


def test_missing_and_extra_adapter_fields_rejected() -> None:
    missing = deepcopy(VALID_INPUT)
    missing.pop("weight_kg")
    with pytest.raises(ModelV2AdapterError, match="missing required"):
        adapt_product_input_v1(missing)

    extra = deepcopy(VALID_INPUT)
    extra["user_id"] = "synthetic-user"
    with pytest.raises(ModelV2AdapterError, match="unexpected adapter fields"):
        adapt_product_input_v1(extra)


def test_non_mapping_adapter_payload_rejected() -> None:
    with pytest.raises(ModelV2AdapterError, match="must be a mapping"):
        adapt_product_input_v1(["not", "a", "mapping"])


def test_repeated_adapter_calls_are_deterministic() -> None:
    first = adapt()
    second = adapt()
    assert first == second


def test_adapter_does_not_require_artifact_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MODEL_V2_ARTIFACT_PATH", raising=False)
    monkeypatch.delenv("MODEL_V2_SCORING_ENABLED", raising=False)

    result = adapt()

    assert tuple(result) == tuple(FEATURES)
