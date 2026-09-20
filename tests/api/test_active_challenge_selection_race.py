"""Selection races fail closed without silently creating another challenge."""

import json
from datetime import date

import httpx
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.apis.v1 import observation_routers
from app.core import config
from app.main import app
from app.services import observation_store

TODAY = date(2026, 9, 21)
USER_ID = "11111111-1111-4111-8111-111111111111"
CHALLENGE_ID = "22222222-2222-4222-8222-222222222222"
TOKEN = "synthetic-session-token"
PATH = "/api/v1/observations/challenges/active"


@pytest.fixture
def selection_app(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    monkeypatch.setattr(config, "SUPABASE_URL", "https://supabase.invalid")
    monkeypatch.setattr(config, "SUPABASE_PUBLISHABLE_KEY", "synthetic-public-key")
    monkeypatch.setattr(observation_routers, "korea_today", lambda: TODAY)
    return app


def mock_upstream(
    monkeypatch: pytest.MonkeyPatch,
    *,
    ends_on: str,
    patch_status: int = 200,
) -> list[httpx.Request]:
    requests: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        assert request.headers["authorization"] == f"Bearer {TOKEN}"
        if request.url.path == "/auth/v1/user":
            assert request.method == "GET"
            return httpx.Response(200, json={"id": USER_ID})
        assert request.url.path == "/rest/v1/active_challenges"
        if request.method == "GET":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": CHALLENGE_ID,
                        "action_id": "walk-10-minutes",
                        "ends_on": ends_on,
                        "first_checkin_on": None,
                    }
                ],
            )
        assert request.method == "PATCH", "A lost row must not trigger an automatic insert or retry."
        return httpx.Response(patch_status, json=[])

    transport = httpx.MockTransport(handle)

    def upstream_client(*args: object, **kwargs: object) -> AsyncClient:
        return AsyncClient(*args, **kwargs, transport=transport)

    monkeypatch.setattr(observation_store.httpx, "AsyncClient", upstream_client)
    return requests


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("ends_on", "expected_update"),
    [
        ("2026-09-27", {"action_id": "sleep-routine", "user_id": USER_ID}),
        ("2026-09-20", {"status": "closed", "user_id": USER_ID}),
    ],
    ids=["choice-update-row-disappears", "close-ended-row-disappears"],
)
async def test_selection_lost_row_returns_existing_conflict_without_retry(
    selection_app: FastAPI,
    monkeypatch: pytest.MonkeyPatch,
    ends_on: str,
    expected_update: dict[str, str],
) -> None:
    requests = mock_upstream(monkeypatch, ends_on=ends_on)
    async with AsyncClient(
        transport=ASGITransport(app=selection_app, raise_app_exceptions=False),
        base_url="http://test",
    ) as client:
        response = await client.post(
            PATH,
            json={"action_id": "sleep-routine"},
            headers={"Authorization": f"Bearer {TOKEN}"},
        )

    assert response.status_code == 409
    assert response.json() == {
        "detail": {
            "code": "active_challenge_required",
            "message": "Select a seven-day challenge before recording today.",
        }
    }
    assert [request.method for request in requests] == ["GET", "GET", "PATCH"]
    assert json.loads(requests[-1].content) == expected_update
    assert requests[-1].url.params["id"] == f"eq.{CHALLENGE_ID}"
    assert TOKEN not in response.text
    assert USER_ID not in response.text
    assert CHALLENGE_ID not in response.text


@pytest.mark.asyncio
@pytest.mark.parametrize("upstream_status", [400, 500, 503])
async def test_selection_storage_failures_are_not_missing_row_conflicts(
    selection_app: FastAPI,
    monkeypatch: pytest.MonkeyPatch,
    upstream_status: int,
) -> None:
    requests = mock_upstream(
        monkeypatch,
        ends_on="2026-09-27",
        patch_status=upstream_status,
    )
    async with AsyncClient(
        transport=ASGITransport(app=selection_app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            PATH,
            json={"action_id": "sleep-routine"},
            headers={"Authorization": f"Bearer {TOKEN}"},
        )

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "observation_storage_not_ready"
    assert [request.method for request in requests] == ["GET", "GET", "PATCH"]
