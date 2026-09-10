"""Synthetic-only transient product-input adapter for frozen Model V2 semantics."""

from __future__ import annotations

import math
from collections.abc import Mapping
from typing import Any

from app.services.model_v2_inference import (
    ALCOHOL_AMOUNT_CATEGORIES,
    ALCOHOL_FREQUENCY_CATEGORIES,
    CIGARETTE_SMOKING_CATEGORIES,
    FEATURES,
    NON_DRINKING_FREQUENCIES,
    SEX_KNHANES_CATEGORIES,
    STRENGTH_DAYS_CATEGORIES,
    ModelV2InputError,
    validate_semantic_input,
)

ADAPTER_VERSION = "model-v2-product-input-adapter-v2"

INPUT_FIELDS = (
    "age_years",
    "sex_knhanes",
    "height_cm",
    "weight_kg",
    "cigarette_smoking_state",
    "alcohol_frequency",
    "alcohol_amount_category",
    "walking_days_7d",
    "walking_active_day_hours",
    "walking_active_day_minutes",
    "strength_days_7d",
    "weekday_bed_hour",
    "weekday_bed_minute",
    "weekday_wake_hour",
    "weekday_wake_minute",
    "weekend_bed_hour",
    "weekend_bed_minute",
    "weekend_wake_hour",
    "weekend_wake_minute",
)


class ModelV2AdapterError(ValueError):
    """Raised when the synthetic product-input adapter must fail closed."""


def _require_exact_input_fields(payload: Mapping[str, Any]) -> None:
    keys = set(payload)
    required = set(INPUT_FIELDS)
    missing = sorted(required - keys)
    extra = sorted(keys - required)
    if missing:
        raise ModelV2AdapterError(f"missing required adapter fields: {missing}")
    if extra:
        raise ModelV2AdapterError(f"unexpected adapter fields: {extra}")


def _number(
    name: str,
    value: Any,
    *,
    minimum: float | None = None,
    maximum: float | None = None,
    whole: bool = False,
) -> float:
    if value is None:
        raise ModelV2AdapterError(f"{name}: null is not supported by adapter v1")
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ModelV2AdapterError(f"{name}: expected numeric value")
    result = float(value)
    if not math.isfinite(result):
        raise ModelV2AdapterError(f"{name}: expected finite numeric value")
    if whole and not result.is_integer():
        raise ModelV2AdapterError(f"{name}: expected whole-number value")
    if minimum is not None and result < minimum:
        raise ModelV2AdapterError(f"{name}: below allowed domain")
    if maximum is not None and result > maximum:
        raise ModelV2AdapterError(f"{name}: above allowed domain")
    return result


def _category(name: str, value: Any, allowed: tuple[str, ...]) -> str:
    if value is None:
        raise ModelV2AdapterError(f"{name}: null is not supported by adapter v1")
    if not isinstance(value, str) or value not in allowed:
        raise ModelV2AdapterError(f"{name}: noncanonical category")
    return value


def _sex(value: Any) -> int:
    numeric = _number("sex_knhanes", value)
    if numeric not in SEX_KNHANES_CATEGORIES:
        raise ModelV2AdapterError("sex_knhanes: noncanonical category")
    return int(numeric)


def _derive_bmi(height_cm: float, weight_kg: float) -> float:
    return weight_kg / ((height_cm / 100.0) ** 2)


def _derive_walking_minutes(days: float, hours: float, minutes: float) -> float:
    if days == 0:
        if hours != 0 or minutes != 0:
            raise ModelV2AdapterError(
                "walking duration: zero walking days requires zero active-day hour/minute components"
            )
        return 0.0
    return hours * 60.0 + minutes


def _normalize_product_bedtime_hour(prefix: str, bed_hour: Any) -> float:
    """Map browser ``time`` midnight to the frozen source-clock bedtime form."""
    normalized = _number(f"{prefix}_bed_hour", bed_hour, minimum=0, maximum=24, whole=True)
    # Browser time controls encode midnight as 00:xx. G3's frozen clock
    # derivation represents a midnight bedtime as 24:xx; wake times retain
    # their submitted representation because they have distinct clock meaning.
    return 24.0 if normalized == 0 else normalized


def _derive_sleep_minutes(
    prefix: str,
    bed_hour: Any,
    bed_minute: Any,
    wake_hour: Any,
    wake_minute: Any,
) -> float:
    bh = _number(f"{prefix}_bed_hour", bed_hour, minimum=0, maximum=24, whole=True)
    bm = _number(f"{prefix}_bed_minute", bed_minute, minimum=0, maximum=59, whole=True)
    wh = _number(f"{prefix}_wake_hour", wake_hour, minimum=0, maximum=24, whole=True)
    wm = _number(f"{prefix}_wake_minute", wake_minute, minimum=0, maximum=59, whole=True)

    # Exact G3 Cycle 9 clock adjustment: independently shift hours 1..12.
    if 1 <= bh <= 12:
        bh += 24
    if 1 <= wh <= 12:
        wh += 24

    duration = (wh * 60.0 + wm) - (bh * 60.0 + bm)
    if duration < 0:
        duration += 1440.0
    return duration


def adapt_product_input_v2(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Convert one complete synthetic adapter-v2 payload to frozen 11-feature semantics."""
    if not isinstance(payload, Mapping):
        raise ModelV2AdapterError("adapter payload must be a mapping")

    _require_exact_input_fields(payload)

    age = _number("age_years", payload["age_years"], minimum=19)
    sex = _sex(payload["sex_knhanes"])
    height = _number("height_cm", payload["height_cm"], minimum=0)
    weight = _number("weight_kg", payload["weight_kg"], minimum=0)
    if height <= 0:
        raise ModelV2AdapterError("height_cm: must be positive")
    if weight <= 0:
        raise ModelV2AdapterError("weight_kg: must be positive")

    smoking = _category(
        "cigarette_smoking_state",
        payload["cigarette_smoking_state"],
        CIGARETTE_SMOKING_CATEGORIES,
    )
    alcohol_frequency = _category(
        "alcohol_frequency",
        payload["alcohol_frequency"],
        ALCOHOL_FREQUENCY_CATEGORIES,
    )
    alcohol_amount = _category(
        "alcohol_amount_category",
        payload["alcohol_amount_category"],
        ALCOHOL_AMOUNT_CATEGORIES,
    )
    if alcohol_frequency in NON_DRINKING_FREQUENCIES:
        if alcohol_amount != "none":
            raise ModelV2AdapterError("alcohol_amount_category: non-drinking branch requires none")
    elif alcohol_amount == "none":
        raise ModelV2AdapterError("alcohol_amount_category: none contradicts drinking frequency")

    walking_days = _number(
        "walking_days_7d",
        payload["walking_days_7d"],
        minimum=0,
        maximum=7,
        whole=True,
    )
    walking_hours = _number(
        "walking_active_day_hours",
        payload["walking_active_day_hours"],
        minimum=0,
        maximum=24,
        whole=True,
    )
    walking_minutes = _number(
        "walking_active_day_minutes",
        payload["walking_active_day_minutes"],
        minimum=0,
        maximum=59,
        whole=True,
    )
    walking_duration = _derive_walking_minutes(walking_days, walking_hours, walking_minutes)

    strength = _category(
        "strength_days_7d",
        payload["strength_days_7d"],
        STRENGTH_DAYS_CATEGORIES,
    )

    semantic = {
        "age_years": age,
        "sex_knhanes": sex,
        "bmi_from_height_weight": _derive_bmi(height, weight),
        "cigarette_smoking_state": smoking,
        "alcohol_frequency": alcohol_frequency,
        "alcohol_amount_category": alcohol_amount,
        "walking_days_7d": walking_days,
        "walking_minutes_per_active_day": walking_duration,
        "strength_days_7d": strength,
        "weekday_sleep_minutes": _derive_sleep_minutes(
            "weekday",
            _normalize_product_bedtime_hour("weekday", payload["weekday_bed_hour"]),
            payload["weekday_bed_minute"],
            payload["weekday_wake_hour"],
            payload["weekday_wake_minute"],
        ),
        "weekend_sleep_minutes": _derive_sleep_minutes(
            "weekend",
            _normalize_product_bedtime_hour("weekend", payload["weekend_bed_hour"]),
            payload["weekend_bed_minute"],
            payload["weekend_wake_hour"],
            payload["weekend_wake_minute"],
        ),
    }

    try:
        clean = validate_semantic_input(semantic)
    except ModelV2InputError as exc:
        raise ModelV2AdapterError("adapter output failed frozen semantic validation") from exc

    return {name: clean[name] for name in FEATURES}
