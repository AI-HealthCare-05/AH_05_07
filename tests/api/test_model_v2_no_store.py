"""Synthetic requests through the production app, without DB lifespan or network I/O."""

from collections.abc import Iterator
from typing import Any
from unittest.mock import Mock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.apis.v1 import model_v2_routers
from app.core import config
from app.dependencies import supabase_auth
from app.main import app
from app.services.model_v2_inference import (
    ModelV2ArtifactError,
    ModelV2BoundaryError,
    ModelV2DisabledError,
    ModelV2Score,
    validate_semantic_input,
)

SEMANTIC_PAYLOAD = {
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
PRODUCT_PAYLOAD = {
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
    "weekend_bed_hour": 0,
    "weekend_bed_minute": 0,
    "weekend_wake_hour": 8,
    "weekend_wake_minute": 0,
}
MODEL_NOT_READY = {
    "detail": {"code": "model_not_ready", "message": "Model V2 scoring is not available."},
}
INPUT_INVALID = {
    "detail": {"code": "model_v2_input_invalid", "message": "Model V2 input values are invalid."},
}
VALIDATION_ERROR = {
    "detail": {"code": "validation_error", "message": "Input values are invalid."},
}


@pytest.fixture(params=["score", "product-score"])
def endpoint(request: pytest.FixtureRequest) -> tuple[str, dict[str, Any]]:
    payload = SEMANTIC_PAYLOAD if request.param == "score" else PRODUCT_PAYLOAD
    return f"/api/v1/model-v2/{request.param}", dict(payload)


@pytest.fixture
def auth_provider(monkeypatch: pytest.MonkeyPatch) -> Mock:
    monkeypatch.setattr(config, "SUPABASE_URL", "https://supabase.test")
    monkeypatch.setattr(config, "SUPABASE_PUBLISHABLE_KEY", "synthetic-publishable-key")
    provider = Mock(return_value=httpx.Response(200, json={"id": "synthetic-user"}))
    async_client = httpx.AsyncClient
    monkeypatch.setattr(
        supabase_auth.httpx,
        "AsyncClient",
        lambda **kwargs: async_client(transport=httpx.MockTransport(provider), **kwargs),
    )
    return provider


@pytest.fixture
def boundary(monkeypatch: pytest.MonkeyPatch) -> Mock:
    def synthetic_score(payload: dict[str, Any]) -> ModelV2Score:
        validate_semantic_input(payload)
        return ModelV2Score(
            score=0.42,
            schema_version="model-v2-r1-schema-v1",
            artifact_sha256="synthetic-artifact-not-exposed",
            product_wording="입력 기반 위험군 선별 신호",
        )

    factory = Mock()
    factory.return_value.score.side_effect = synthetic_score
    monkeypatch.setattr(model_v2_routers, "scoring_enabled", lambda: True)
    monkeypatch.setattr(model_v2_routers, "ModelV2InferenceBoundary", factory)
    return factory


@pytest.fixture
def client(auth_provider: Mock, boundary: Mock) -> Iterator[TestClient]:
    # Do not enter the lifespan: only HTTP middleware, dependencies and handlers run.
    client = TestClient(app, headers={"Authorization": "Bearer synthetic-token"})
    yield client
    client.close()


def assert_no_store(response: httpx.Response, status_code: int, body: dict[str, Any]) -> None:
    assert response.status_code == status_code
    assert response.json() == body
    assert response.headers.get_list("cache-control") == ["no-store"]
    assert response.headers["content-type"] == "application/json"
    assert int(response.headers["content-length"]) == len(response.content)


def test_success_preserves_two_field_response(client: TestClient, endpoint, boundary: Mock) -> None:
    path, payload = endpoint
    response = client.post(path, json=payload)

    assert_no_store(
        response,
        200,
        {"schema_version": "model-v2-r1-schema-v1", "product_wording": "입력 기반 위험군 선별 신호"},
    )
    boundary.return_value.score.assert_called_once()


@pytest.mark.parametrize("authorization", [None, "Basic synthetic-token"])
def test_missing_bearer_preserves_401(client: TestClient, endpoint, auth_provider: Mock, boundary: Mock, authorization):
    client.headers.pop("Authorization")
    if authorization is not None:
        client.headers["Authorization"] = authorization
    path, payload = endpoint

    assert_no_store(client.post(path, json=payload), 401, {"detail": {"code": "supabase_session_required"}})
    auth_provider.assert_not_called()
    boundary.assert_not_called()


@pytest.mark.parametrize("provider_status", [401, 403])
def test_invalid_session_preserves_401(
    client: TestClient, endpoint, auth_provider: Mock, boundary: Mock, provider_status
):
    auth_provider.return_value = httpx.Response(provider_status, json={"message": "synthetic-provider-detail"})
    path, payload = endpoint

    assert_no_store(client.post(path, json=payload), 401, {"detail": {"code": "supabase_session_invalid"}})
    boundary.assert_not_called()


@pytest.mark.parametrize("failure", ["unavailable", "timeout", "malformed"])
def test_auth_service_failure_preserves_503(client: TestClient, endpoint, auth_provider: Mock, boundary: Mock, failure):
    if failure == "timeout":
        auth_provider.side_effect = httpx.ReadTimeout("synthetic-provider-detail")
    elif failure == "malformed":
        auth_provider.return_value = httpx.Response(200, text="synthetic-invalid-json")
    else:
        auth_provider.return_value = httpx.Response(503, json={"message": "synthetic-provider-detail"})
    path, payload = endpoint

    assert_no_store(
        client.post(path, json=payload),
        503,
        {"detail": {"code": "auth_unavailable", "message": "Authentication provider is temporarily unavailable."}},
    )
    boundary.assert_not_called()


def test_missing_auth_configuration_preserves_503(
    client: TestClient, endpoint, auth_provider: Mock, boundary: Mock, monkeypatch
):
    monkeypatch.setattr(config, "SUPABASE_URL", "")
    path, payload = endpoint

    assert_no_store(
        client.post(path, json=payload),
        503,
        {"detail": {"code": "observation_storage_not_ready", "message": "Observation storage is not available."}},
    )
    auth_provider.assert_not_called()
    boundary.assert_not_called()


@pytest.mark.parametrize("body", ["", "{", "[]", '"synthetic-scalar"', "null"])
def test_app_validation_handler_preserves_generic_422(client: TestClient, endpoint, boundary: Mock, body):
    path, _ = endpoint

    response = client.post(path, content=body, headers={"Content-Type": "application/json"})

    assert_no_store(response, 422, VALIDATION_ERROR)
    boundary.assert_not_called()


def test_invalid_model_input_preserves_generic_422(client: TestClient, endpoint):
    path, payload = endpoint
    payload["sex_knhanes"] = "synthetic-invalid-input"

    assert_no_store(client.post(path, json=payload), 422, INPUT_INVALID)


def test_disabled_scoring_skips_adapter_and_artifact(client: TestClient, endpoint, boundary: Mock, monkeypatch):
    monkeypatch.setattr(model_v2_routers, "scoring_enabled", lambda: False)
    adapter = Mock(side_effect=AssertionError("disabled route touched adapter"))
    monkeypatch.setattr(model_v2_routers, "adapt_product_input_v2", adapter)
    path, payload = endpoint

    assert_no_store(client.post(path, json=payload), 503, MODEL_NOT_READY)
    adapter.assert_not_called()
    boundary.assert_not_called()


@pytest.mark.parametrize("error_type", [ModelV2ArtifactError, ModelV2DisabledError, ModelV2BoundaryError])
@pytest.mark.parametrize("failure_stage", ["construction", "scoring"])
def test_model_service_errors_preserve_generic_503(
    client: TestClient, endpoint, boundary: Mock, error_type, failure_stage
):
    error = error_type("/synthetic/private/artifact.joblib")
    if failure_stage == "construction":
        boundary.side_effect = error
    else:
        boundary.return_value.score.side_effect = error
    path, payload = endpoint

    assert_no_store(client.post(path, json=payload), 503, MODEL_NOT_READY)


@pytest.mark.parametrize(
    ("method", "path", "status_code", "body"),
    [
        ("GET", "/live", 200, {"status": "ok"}),
        (
            "GET",
            "/ready",
            503,
            {"detail": {"code": "service_not_ready", "message": "Required runtime configuration is unavailable."}},
        ),
        ("POST", "/api/v1/risk-signal", 422, VALIDATION_ERROR),
        ("POST", "/api/v1/model-v2/score-extra", 404, {"detail": "Not Found"}),
        ("GET", "/api/v1/model-v2/score", 405, {"detail": "Method Not Allowed"}),
        ("GET", "/api/v1/model-v2/product-score", 405, {"detail": "Method Not Allowed"}),
    ],
)
def test_other_paths_and_methods_keep_existing_cache_policy(
    client: TestClient, monkeypatch, method, path, status_code, body
):
    monkeypatch.setattr(config, "API_CORS_ORIGINS", "")
    response = client.request(method, path)

    assert response.status_code == status_code
    assert response.json() == body
    assert "cache-control" not in response.headers
