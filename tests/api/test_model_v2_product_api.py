from typing import Any

import pytest
from fastapi import FastAPI, HTTPException, status
from fastapi.testclient import TestClient

from app.apis.v1 import model_v2_routers
from app.dependencies.supabase_auth import SupabaseSession, get_supabase_session
from app.services.model_v2_inference import ModelV2Score, validate_semantic_input

VALID_PRODUCT_PAYLOAD: dict[str, Any] = {
    "age_years": 35,
    "sex_knhanes": 1,
    "height_cm": 170,
    "weight_kg": 68,
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
    "weekend_bed_hour": 23,
    "weekend_bed_minute": 30,
    "weekend_wake_hour": 8,
    "weekend_wake_minute": 0,
}


def _app() -> FastAPI:
    application = FastAPI()
    application.include_router(model_v2_routers.model_v2_router, prefix="/api/v1")
    return application


async def _authenticated_session() -> SupabaseSession:
    return SupabaseSession(user_id="synthetic-user", access_token="synthetic-token")


async def _unauthenticated_session() -> SupabaseSession:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "supabase_session_required"},
    )


def test_product_score_requires_authentication() -> None:
    application = _app()
    application.dependency_overrides[get_supabase_session] = _unauthenticated_session

    response = TestClient(application).post(
        "/api/v1/model-v2/product-score",
        json=VALID_PRODUCT_PAYLOAD,
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_product_score_uses_server_adapter_and_hides_numeric_score(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    application = _app()
    application.dependency_overrides[get_supabase_session] = _authenticated_session
    monkeypatch.setattr(model_v2_routers, "scoring_enabled", lambda: True)

    seen: dict[str, Any] = {}

    class SyntheticBoundary:
        def score(self, payload: dict[str, Any]) -> ModelV2Score:
            seen.update(payload)
            validate_semantic_input(payload)
            return ModelV2Score(
                score=0.42,
                schema_version="model-v2-r1-schema-v1",
                artifact_sha256="not-exposed-by-api",
                product_wording="입력 기반 위험군 선별 신호",
            )

    monkeypatch.setattr(model_v2_routers, "ModelV2InferenceBoundary", SyntheticBoundary)

    response = TestClient(application).post(
        "/api/v1/model-v2/product-score",
        json=VALID_PRODUCT_PAYLOAD,
    )

    assert response.status_code == status.HTTP_200_OK
    assert seen["bmi_from_height_weight"] == pytest.approx(68 / 1.7**2)
    assert seen["walking_minutes_per_active_day"] == 40
    assert response.json() == {
        "schema_version": "model-v2-r1-schema-v1",
        "product_wording": "입력 기반 위험군 선별 신호",
    }
    assert "score" not in response.json()


@pytest.mark.parametrize(
    "updates",
    [
        {"age_years": 18},
        {"alcohol_frequency": "none_past_year", "alcohol_amount_category": "3_4_drinks"},
        {"walking_days_7d": 0, "walking_active_day_minutes": 10},
    ],
)
def test_product_score_invalid_product_input_is_generic_422(
    monkeypatch: pytest.MonkeyPatch,
    updates: dict[str, Any],
) -> None:
    application = _app()
    application.dependency_overrides[get_supabase_session] = _authenticated_session
    monkeypatch.setattr(model_v2_routers, "scoring_enabled", lambda: True)

    payload = {**VALID_PRODUCT_PAYLOAD, **updates}
    response = TestClient(application).post(
        "/api/v1/model-v2/product-score",
        json=payload,
    )

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert response.json() == {
        "detail": {
            "code": "model_v2_input_invalid",
            "message": "Model V2 input values are invalid.",
        }
    }


def test_product_score_disabled_path_does_not_touch_adapter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    application = _app()
    application.dependency_overrides[get_supabase_session] = _authenticated_session
    monkeypatch.setattr(model_v2_routers, "scoring_enabled", lambda: False)

    def must_not_adapt(_: dict[str, Any]) -> dict[str, Any]:
        raise AssertionError("disabled product route touched adapter")

    monkeypatch.setattr(model_v2_routers, "adapt_product_input_v1", must_not_adapt)

    response = TestClient(application).post(
        "/api/v1/model-v2/product-score",
        json=VALID_PRODUCT_PAYLOAD,
    )

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
