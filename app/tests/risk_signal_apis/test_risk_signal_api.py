"""The unreleased legacy input contract must never reach a model artifact."""

from unittest.mock import patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from starlette import status

from app.apis.v1.risk_signal_routers import risk_signal_router

app = FastAPI()
app.include_router(risk_signal_router, prefix="/api/v1")
PAYLOAD = {"sex": 1, "age_years": 40, "bmi": 23.5, "sleep_hours": 7}


@pytest.mark.asyncio
async def test_returns_model_not_ready_without_verified_artifact() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/risk-signal", json=PAYLOAD)
    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert response.json()["detail"]["code"] == "model_not_ready"


@pytest.mark.asyncio
async def test_rejects_unknown_input_fields() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/risk-signal", json={**PAYLOAD, "systolic_bp": 130})
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


@pytest.mark.asyncio
async def test_artifact_configuration_cannot_bypass_unreviewed_input_semantics(monkeypatch) -> None:
    monkeypatch.setenv("RISK_MODEL_METADATA", "synthetic-metadata.json")
    monkeypatch.setenv("RISK_MODEL_ARTIFACT", "synthetic-artifact.joblib")
    monkeypatch.setenv("RISK_MODEL_SPLIT_DIGEST", "a" * 64)
    with patch("app.core.model_runner.VerifiedModelRunner", side_effect=AssertionError("must not load an artifact")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/risk-signal",
                json={
                    **PAYLOAD,
                    "physical_activity_days": 7,
                    "smoking_status": 3,
                    "alcohol_frequency": 7,
                },
            )
    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert response.json()["detail"]["code"] == "model_not_ready"
    assert "signal_probability" not in response.json()
