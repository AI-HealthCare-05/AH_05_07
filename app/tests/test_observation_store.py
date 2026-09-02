import json
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.apis.v1.observation_routers import (
    export_observations,
    validate_observation_export_window,
    validate_observation_window,
)
from app.dependencies.supabase_auth import SupabaseSession
from app.services.observation_store import delete_owned_record, insert_owned_record, list_owned_records


@pytest.mark.asyncio
async def test_insert_owned_record_uses_session_identity() -> None:
    response = MagicMock()
    response.json.return_value = [{"id": "record-id", "user_id": "session-user-id"}]
    client = MagicMock()
    client.post = AsyncMock(return_value=response)
    client_context = MagicMock()
    client_context.__aenter__ = AsyncMock(return_value=client)
    client_context.__aexit__ = AsyncMock(return_value=None)
    session = SupabaseSession(user_id="session-user-id", access_token="session-token")

    with patch("app.services.observation_store.httpx.AsyncClient", return_value=client_context):
        record = await insert_owned_record(
            "blood_pressure_observations",
            {"observed_on": "2026-09-02", "user_id": "client-supplied-id"},
            session,
        )

    assert record == {"id": "record-id", "user_id": "session-user-id"}
    assert client.post.await_args.kwargs["headers"]["Authorization"] == "Bearer session-token"
    assert client.post.await_args.kwargs["json"]["user_id"] == "session-user-id"


@pytest.mark.asyncio
async def test_list_owned_records_uses_session_token_and_observation_window() -> None:
    response = MagicMock()
    response.json.return_value = [{"id": "record-id", "observed_on": "2026-09-02"}]
    client = MagicMock()
    client.get = AsyncMock(return_value=response)
    client_context = MagicMock()
    client_context.__aenter__ = AsyncMock(return_value=client)
    client_context.__aexit__ = AsyncMock(return_value=None)
    session = SupabaseSession(user_id="session-user-id", access_token="session-token")

    with patch("app.services.observation_store.httpx.AsyncClient", return_value=client_context):
        records = await list_owned_records(
            "blood_pressure_observations",
            "id,observed_on",
            date(2026, 9, 1),
            date(2026, 9, 7),
            session,
        )

    assert records == [{"id": "record-id", "observed_on": "2026-09-02"}]
    assert client.get.await_args.kwargs["headers"]["Authorization"] == "Bearer session-token"
    assert client.get.await_args.kwargs["params"] == [
        ("select", "id,observed_on"),
        ("observed_on", "gte.2026-09-01"),
        ("observed_on", "lte.2026-09-07"),
        ("order", "observed_on.asc,created_at.asc"),
    ]


def test_rejects_observation_window_longer_than_seven_days() -> None:
    with pytest.raises(HTTPException) as error:
        validate_observation_window(date(2026, 9, 1), date(2026, 9, 8))

    assert error.value.status_code == 422
    assert error.value.detail["code"] == "observation_window_invalid"


def test_rejects_observation_export_window_longer_than_thirty_days() -> None:
    with pytest.raises(HTTPException) as error:
        validate_observation_export_window(date(2026, 9, 1), date(2026, 10, 1))

    assert error.value.status_code == 422
    assert error.value.detail["code"] == "observation_export_window_invalid"


@pytest.mark.asyncio
async def test_export_observations_sets_json_attachment_header() -> None:
    session = SupabaseSession(user_id="session-user-id", access_token="session-token")
    blood_pressure_observations = [{"id": "blood-pressure-id", "observed_on": "2026-09-02"}]
    challenge_events = [{"id": "challenge-id", "observed_on": "2026-09-02"}]

    with (
        patch("app.apis.v1.observation_routers.observation_session", new=AsyncMock(return_value=session)),
        patch(
            "app.apis.v1.observation_routers.list_owned_records",
            new=AsyncMock(side_effect=[blood_pressure_observations, challenge_events]),
        ),
    ):
        response = await export_observations(date(2026, 9, 1), date(2026, 9, 7), "Bearer session-token")

    assert (
        response.headers["content-disposition"] == 'attachment; filename="bp7-observations-2026-09-01-2026-09-07.json"'
    )
    assert json.loads(response.body) == {
        "start_on": "2026-09-01",
        "end_on": "2026-09-07",
        "blood_pressure_observations": blood_pressure_observations,
        "challenge_events": challenge_events,
    }


@pytest.mark.asyncio
async def test_delete_owned_record_returns_false_when_row_is_not_visible() -> None:
    response = MagicMock()
    response.json.return_value = []
    client = MagicMock()
    client.delete = AsyncMock(return_value=response)
    client_context = MagicMock()
    client_context.__aenter__ = AsyncMock(return_value=client)
    client_context.__aexit__ = AsyncMock(return_value=None)
    session = SupabaseSession(user_id="session-user-id", access_token="session-token")
    record_id = UUID("11111111-1111-1111-1111-111111111111")

    with patch("app.services.observation_store.httpx.AsyncClient", return_value=client_context):
        deleted = await delete_owned_record("blood_pressure_observations", record_id, session)

    assert not deleted
    assert client.delete.await_args.kwargs["headers"]["Authorization"] == "Bearer session-token"
    assert client.delete.await_args.kwargs["params"] == {"id": f"eq.{record_id}"}
