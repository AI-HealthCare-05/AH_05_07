from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from app.main import app


class TestRiskSignalAPI(TestCase):
    payload = {"sex": 1, "age_years": 40, "bmi": 23.5, "sleep_hours": 7}

    async def test_returns_model_not_ready_without_verified_artifact(self) -> None:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/risk-signal", json=self.payload)

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert response.json()["detail"]["code"] == "model_not_ready"

    async def test_rejects_unknown_input_fields(self) -> None:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/risk-signal", json={**self.payload, "systolic_bp": 130})

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
