from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from app.main import app


class TestObservationAPI(TestCase):
    async def test_returns_storage_not_ready_for_valid_observation(self) -> None:
        payload = {"observed_on": "2026-09-02", "period": "morning", "systolic": 120, "diastolic": 80}
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/observations/blood-pressure", json=payload)

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert response.json()["detail"]["code"] == "observation_storage_not_ready"

    async def test_rejects_unknown_observation_field(self) -> None:
        payload = {
            "observed_on": "2026-09-02",
            "period": "morning",
            "systolic": 120,
            "diastolic": 80,
            "note": "free text",
        }
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/observations/blood-pressure", json=payload)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
