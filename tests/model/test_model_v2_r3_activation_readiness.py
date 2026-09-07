from pathlib import Path

from app.services.model_v2_inference import (
    ENABLE_ENV,
    EXPECTED_ARTIFACT_SHA256,
    EXPECTED_PRODUCT_WORDING,
    EXPECTED_SCHEMA_VERSION,
    FEATURES,
)


def test_r3_frozen_constants() -> None:
    assert ENABLE_ENV == "MODEL_V2_SCORING_ENABLED"
    assert EXPECTED_ARTIFACT_SHA256 == ("d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84")
    assert EXPECTED_SCHEMA_VERSION == "model-v2-r1-schema-v1"
    assert EXPECTED_PRODUCT_WORDING == "입력 기반 위험군 선별 신호"
    assert FEATURES == [
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


def test_production_route_remains_fail_closed() -> None:
    source = Path("app/apis/v1/risk_signal_routers.py").read_text(encoding="utf-8")
    assert '"code": "model_not_ready"' in source
    assert "ModelV2InferenceBoundary" not in source


def test_r3_contract_keeps_production_disabled() -> None:
    source = Path("docs/research/model-v2-r3-activation-readiness-contract.md").read_text(encoding="utf-8")
    assert "PRODUCTION SCORING DISABLED" in source
    assert "A PASS does not authorize production scoring." in source
    assert "G8" in source
    assert "80+" in source
