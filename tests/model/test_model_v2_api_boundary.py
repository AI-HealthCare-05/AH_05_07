from typing import Any

import pytest
from fastapi import FastAPI, HTTPException, status
from fastapi.testclient import TestClient

from app.apis.v1 import model_v2_routers
from app.dependencies.supabase_auth import SupabaseSession, get_supabase_session
from app.services.model_v2_inference import ModelV2Score, validate_semantic_input

VALID_PAYLOAD: dict[str, Any] = {
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


def test_model_v2_route_requires_existing_auth_boundary() -> None:
    application = _app()
    application.dependency_overrides[get_supabase_session] = _unauthenticated_session

    response = TestClient(application).post("/api/v1/model-v2/score", json=VALID_PAYLOAD)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"]["code"] == "supabase_session_required"


def test_default_off_does_not_construct_inference_boundary(monkeypatch: pytest.MonkeyPatch) -> None:
    application = _app()
    application.dependency_overrides[get_supabase_session] = _authenticated_session

    monkeypatch.setattr(model_v2_routers, "scoring_enabled", lambda: False)

    class BoundaryMustNotBeConstructed:
        def __init__(self) -> None:
            raise AssertionError("disabled route touched the artifact boundary")

    monkeypatch.setattr(model_v2_routers, "ModelV2InferenceBoundary", BoundaryMustNotBeConstructed)

    response = TestClient(application).post("/api/v1/model-v2/score", json=VALID_PAYLOAD)

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert response.json() == {
        "detail": {
            "code": "model_not_ready",
            "message": "Model V2 scoring is not available.",
        }
    }


def test_enabled_path_uses_frozen_semantic_validator(monkeypatch: pytest.MonkeyPatch) -> None:
    application = _app()
    application.dependency_overrides[get_supabase_session] = _authenticated_session
    monkeypatch.setattr(model_v2_routers, "scoring_enabled", lambda: True)

    class SyntheticBoundary:
        def score(self, payload: dict[str, Any]) -> ModelV2Score:
            validate_semantic_input(payload)
            return ModelV2Score(
                score=0.42,
                schema_version="model-v2-r1-schema-v1",
                artifact_sha256="not-exposed-by-api",
                product_wording="입력 기반 위험군 선별 신호",
            )

    monkeypatch.setattr(model_v2_routers, "ModelV2InferenceBoundary", SyntheticBoundary)

    response = TestClient(application).post("/api/v1/model-v2/score", json=VALID_PAYLOAD)

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "score": 0.42,
        "schema_version": "model-v2-r1-schema-v1",
        "product_wording": "입력 기반 위험군 선별 신호",
    }


def test_enabled_path_rejects_malformed_semantic_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    application = _app()
    application.dependency_overrides[get_supabase_session] = _authenticated_session
    monkeypatch.setattr(model_v2_routers, "scoring_enabled", lambda: True)

    class SyntheticBoundary:
        def score(self, payload: dict[str, Any]) -> ModelV2Score:
            validate_semantic_input(payload)
            raise AssertionError("invalid payload unexpectedly passed validation")

    monkeypatch.setattr(model_v2_routers, "ModelV2InferenceBoundary", SyntheticBoundary)

    malformed = dict(VALID_PAYLOAD)
    malformed["sex_knhanes"] = "1.0"

    response = TestClient(application).post("/api/v1/model-v2/score", json=malformed)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert response.json() == {
        "detail": {
            "code": "model_v2_input_invalid",
            "message": "Model V2 input values are invalid.",
        }
    }


def test_enabled_artifact_failure_is_generic_and_fail_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    application = _app()
    application.dependency_overrides[get_supabase_session] = _authenticated_session
    monkeypatch.setattr(model_v2_routers, "scoring_enabled", lambda: True)

    from app.services.model_v2_inference import ModelV2ArtifactError

    class FailingBoundary:
        def __init__(self) -> None:
            raise ModelV2ArtifactError("/secret/path/model.joblib")

    monkeypatch.setattr(model_v2_routers, "ModelV2InferenceBoundary", FailingBoundary)

    response = TestClient(application).post("/api/v1/model-v2/score", json=VALID_PAYLOAD)

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert response.json() == {
        "detail": {
            "code": "model_not_ready",
            "message": "Model V2 scoring is not available.",
        }
    }
    assert "secret" not in response.text
    assert "joblib" not in response.text
