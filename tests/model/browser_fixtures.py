#!/usr/bin/env python3
"""Deterministic synthetic inputs only. No recorded predictions or participant data."""

from __future__ import annotations

import json
import math
import random
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from app.services.model_v2_inference import CANONICAL_CATEGORIES, FEATURES  # noqa: E402
from app.services.model_v2_input_adapter import INPUT_FIELDS  # noqa: E402

PRODUCT_BASE = {
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


def fixtures() -> list[dict[str, Any]]:  # noqa: C901 - explicit synthetic coverage enumerator
    cases: list[dict[str, Any]] = []

    def add(name: str, kind: str, value: Any) -> None:
        cases.append({"name": name, "kind": kind, "input": deepcopy(value)})

    source_cases = json.loads((REPO_ROOT / "tests/fixtures/model_v2_t2_source_answer_parity.json").read_text())
    semantic_base = source_cases[0]["semantic_payload"]
    for case in source_cases:
        add(f"source-{case['name']}", "semantic", case["semantic_payload"])
    add("product-base", "product", PRODUCT_BASE)
    add("semantic-all-null", "semantic", dict.fromkeys(FEATURES))
    for kind, base, names in [("semantic", semantic_base, FEATURES), ("product", PRODUCT_BASE, INPUT_FIELDS)]:
        for name in names:
            add(f"{kind}-null-{name}", kind, {**base, name: None})
            missing = dict(base)
            del missing[name]
            add(f"{kind}-missing-{name}", kind, missing)
        add(f"{kind}-extra-bp", kind, {**base, "systolic_bp": 120})
        for index, invalid in enumerate([None, [], "invalid", True]):
            add(f"{kind}-bad-container-{index}", kind, invalid)
        for name, values in CANONICAL_CATEGORIES.items():
            for index, value in enumerate(values):
                row = {**base, name: value}
                if name == "alcohol_frequency" and value in {"none_past_year", "lifetime_nonapplicable"}:
                    row["alcohol_amount_category"] = "none"
                if name == "alcohol_amount_category" and value == "none":
                    row["alcohol_frequency"] = "none_past_year"
                add(f"{kind}-category-{name}-{index}", kind, row)
            for index, value in enumerate(["__missing__", "unknown", True, {}, []]):
                add(f"{kind}-invalid-category-{name}-{index}", kind, {**base, name: value})

    bounds = {
        "age_years": [18, 19, 80, 110, -1, "35", True],
        "bmi_from_height_weight": [0, -0.1, 1e-12, 23.1234567890123, 70, "23", False],
        "walking_days_7d": [-1, 0, 7, 8, 2.5, "4", True],
        "walking_minutes_per_active_day": [-1, 0, 1440, 1441, "40", False],
        "weekday_sleep_minutes": [-1, 0, 1440, 1441, "480", True],
        "weekend_sleep_minutes": [-1, 0, 1440, 1441, "480", False],
    }
    for name, values in bounds.items():
        for index, value in enumerate(values):
            row = {**semantic_base, name: value}
            if name == "walking_days_7d" and value == 0:
                row["walking_minutes_per_active_day"] = 0
            add(f"semantic-numeric-{name}-{index}", "semantic", row)
    for index, update in enumerate(
        [
            {"walking_days_7d": 0, "walking_minutes_per_active_day": 1},
            {"walking_days_7d": 0, "walking_minutes_per_active_day": None},
            {"alcohol_frequency": "none_past_year", "alcohol_amount_category": "1_2_drinks"},
            {"alcohol_frequency": "lt_monthly", "alcohol_amount_category": "none"},
        ]
    ):
        add(f"semantic-contradiction-{index}", "semantic", {**semantic_base, **update})

    sleep_edges = [
        (0, 0, 8, 0),
        (0, 30, 8, 30),
        (24, 0, 8, 0),
        (23, 0, 0, 0),
        (8, 0, 16, 0),
        (12, 59, 13, 0),
        (0, 0, 24, 0),
        (24, 59, 0, 0),
        (23, 0, 23, 0),
        (25, 0, 8, 0),
        (23, 60, 8, 0),
        (23.5, 0, 8, 0),
    ]
    for prefix in ["weekday", "weekend"]:
        for index, (bh, bm, wh, wm) in enumerate(sleep_edges):
            update = {
                f"{prefix}_bed_hour": bh,
                f"{prefix}_bed_minute": bm,
                f"{prefix}_wake_hour": wh,
                f"{prefix}_wake_minute": wm,
            }
            add(f"product-sleep-{prefix}-{index}", "product", {**PRODUCT_BASE, **update})
    for index, update in enumerate(
        [
            {"walking_days_7d": 0, "walking_active_day_hours": 0, "walking_active_day_minutes": 0},
            {"walking_days_7d": 0, "walking_active_day_hours": 0, "walking_active_day_minutes": 1},
            {"walking_active_day_hours": 24, "walking_active_day_minutes": 0},
            {"walking_active_day_hours": 24, "walking_active_day_minutes": 1},
            {"height_cm": 173.2, "weight_kg": 71.35},
            {"height_cm": 0},
            {"weight_kg": -1},
            {"height_cm": "170"},
            {"height_cm": 1e-200},
            {"height_cm": 1e200},
            {"weight_kg": True},
            {"age_years": 18},
        ]
    ):
        add(f"product-edge-{index}", "product", {**PRODUCT_BASE, **update})

    # Independent oracle inputs: the reported pow-vs-multiply overflow and
    # adjacent representable operands, plus divisor and quotient boundaries.
    height = 6.621714930447641e-86
    weight = 7.882364614993977e133
    for hi, h in enumerate([math.nextafter(height, 0), height, math.nextafter(height, math.inf)]):
        for wi, w in enumerate([math.nextafter(weight, 0), weight, math.nextafter(weight, math.inf)]):
            add(f"bmi-overflow-neighbour-{hi}-{wi}", "product", {**PRODUCT_BASE, "height_cm": h, "weight_kg": w})
    for index, (h, w) in enumerate(
        [
            (100, math.ulp(0.0)),  # positive subnormal quotient
            (200, math.ulp(0.0)),  # quotient rounds to zero
            (100, math.nextafter(sys.float_info.max, 0)),
            (math.ulp(0.0), 1),  # conversion/divisor underflow
            (1e-160, math.ulp(0.0)),  # divisor underflow
            (1e-159, math.ulp(0.0)),  # nonzero subnormal divisor
            (1e156, 1),  # divisor overflow
            (1e155, 1),  # finite large divisor, subnormal quotient
            (1e155, math.ulp(0.0)),  # quotient underflow
        ]
    ):
        add(f"bmi-range-boundary-{index}", "product", {**PRODUCT_BASE, "height_cm": h, "weight_kg": w})

    rng = random.Random(20260913)
    for index in range(192):
        row = dict(PRODUCT_BASE)
        row.update(
            age_years=rng.randint(19, 110),
            height_cm=rng.uniform(140, 205),
            weight_kg=rng.uniform(40, 150),
            walking_days_7d=rng.randint(0, 7),
        )
        row["walking_active_day_hours"] = rng.randint(0, 5) if row["walking_days_7d"] else 0
        row["walking_active_day_minutes"] = rng.randint(0, 59) if row["walking_days_7d"] else 0
        for name, values in CANONICAL_CATEGORIES.items():
            row[name] = rng.choice(values)
        if row["alcohol_frequency"] in {"none_past_year", "lifetime_nonapplicable"}:
            row["alcohol_amount_category"] = "none"
        elif row["alcohol_amount_category"] == "none":
            row["alcohol_amount_category"] = "1_2_drinks"
        for prefix in ["weekday", "weekend"]:
            row[f"{prefix}_bed_hour"] = rng.randint(0, 24)
            row[f"{prefix}_wake_hour"] = rng.randint(0, 24)
            row[f"{prefix}_bed_minute"] = rng.randint(0, 59)
            row[f"{prefix}_wake_minute"] = rng.randint(0, 59)
        add(f"product-seeded-{index}", "product", row)
    return cases


if __name__ == "__main__":
    json.dump(fixtures(), sys.stdout, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
