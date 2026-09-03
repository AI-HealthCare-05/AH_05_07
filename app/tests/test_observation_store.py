import json
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import httpx
import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.apis.v1.observation_routers import (
    export_observations,
    update_blood_pressure_observation,
    validate_observation_export_window,
    validate_observation_window,
)
from app.dependencies.supabase_auth import SupabaseSession
from app.dtos.observations import BloodPressureObservationInput
from app.main import app
from app.services.observation_store import (
    ChallengeSelectionLockedError,
    OwnedRecordMissingError,
    create_owned_challenge_checkin,
    delete_owned_record,
    insert_owned_record,
    list_owned_records,
    select_owned_active_challenge,
    update_owned_record,
)


@pytest.mark.asyncio
async def test_request_validation_error_hides_submitted_values() -> None:
    payload = {"observed_on": "2026-09-03", "period": "morning", "systolic": 80, "diastolic": 80}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.put(
            "/api/v1/observations/blood-pressure/11111111-1111-1111-1111-111111111111",
            json=payload,
        )

    assert response.status_code == 422
    assert response.json() == {"detail": {"code": "validation_error", "message": "Input values are invalid."}}
    assert "input" not in response.text
    assert "80" not in response.text


def test_openapi_documents_normalized_validation_error() -> None:
    response = app.openapi()["paths"]["/api/v1/observations/blood-pressure/{record_id}"]["put"]["responses"]["422"]

    assert response["description"] == "Input values are invalid."
    assert response["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/ValidationErrorResponse"


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
    active_challenge = {"id": "active-challenge-id", "action_id": "walk-10-minutes"}
    challenge_checkins = [{"id": "checkin-id", "observed_on": "2026-09-02"}]

    with (
        patch("app.apis.v1.observation_routers.observation_session", new=AsyncMock(return_value=session)),
        patch(
            "app.apis.v1.observation_routers.list_owned_records",
            new=AsyncMock(side_effect=[blood_pressure_observations, challenge_events, challenge_checkins]),
        ),
        patch(
            "app.apis.v1.observation_routers.get_owned_active_challenge", new=AsyncMock(return_value=active_challenge)
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
        "active_challenge": active_challenge,
        "challenge_checkins": challenge_checkins,
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


@pytest.mark.asyncio
async def test_update_owned_record_uses_session_identity_and_returns_its_row() -> None:
    response = MagicMock()
    response.json.return_value = [{"id": "record-id", "user_id": "session-user-id", "systolic": 121}]
    client = MagicMock()
    client.patch = AsyncMock(return_value=response)
    client_context = MagicMock()
    client_context.__aenter__ = AsyncMock(return_value=client)
    client_context.__aexit__ = AsyncMock(return_value=None)
    session = SupabaseSession(user_id="session-user-id", access_token="session-token")

    with patch("app.services.observation_store.httpx.AsyncClient", return_value=client_context):
        record = await update_owned_record(
            "blood_pressure_observations",
            "record-id",
            {"systolic": 121, "user_id": "client-supplied-id"},
            session,
        )

    assert record["user_id"] == "session-user-id"
    assert client.patch.await_args.kwargs["params"] == {"id": "eq.record-id"}
    assert client.patch.await_args.kwargs["json"]["user_id"] == "session-user-id"


@pytest.mark.asyncio
async def test_update_blood_pressure_returns_not_found_without_disclosing_ownership() -> None:
    session = SupabaseSession(user_id="session-user-id", access_token="session-token")

    with (
        patch("app.apis.v1.observation_routers.observation_session", new=AsyncMock(return_value=session)),
        patch(
            "app.apis.v1.observation_routers.update_owned_record",
            new=AsyncMock(side_effect=OwnedRecordMissingError),
        ),
    ):
        with pytest.raises(HTTPException) as error:
            await update_blood_pressure_observation(
                UUID("11111111-1111-1111-1111-111111111111"),
                BloodPressureObservationInput(
                    observed_on=date(2026, 9, 2), period="morning", systolic=120, diastolic=80
                ),
                "Bearer session-token",
            )

    assert error.value.status_code == 404
    assert error.value.detail["code"] == "observation_not_found"


@pytest.mark.asyncio
async def test_update_blood_pressure_returns_a_stable_conflict_code() -> None:
    session = SupabaseSession(user_id="session-user-id", access_token="session-token")
    request = httpx.Request("PATCH", "https://example.supabase.co/rest/v1/blood_pressure_observations")
    response = httpx.Response(409, request=request)
    conflict = httpx.HTTPStatusError("duplicate observation", request=request, response=response)

    with (
        patch("app.apis.v1.observation_routers.observation_session", new=AsyncMock(return_value=session)),
        patch("app.apis.v1.observation_routers.update_owned_record", new=AsyncMock(side_effect=conflict)),
    ):
        with pytest.raises(HTTPException) as error:
            await update_blood_pressure_observation(
                UUID("11111111-1111-1111-1111-111111111111"),
                BloodPressureObservationInput(
                    observed_on=date(2026, 9, 2), period="morning", systolic=120, diastolic=80
                ),
                "Bearer session-token",
            )

    assert error.value.status_code == 409
    assert error.value.detail["code"] == "observation_conflict"


@pytest.mark.asyncio
async def test_select_active_challenge_changes_choice_before_first_checkin() -> None:
    session = SupabaseSession(user_id="session-user-id", access_token="session-token")
    active_challenge = {
        "id": "active-challenge-id",
        "action_id": "walk-10-minutes",
        "starts_on": "2026-09-02",
        "ends_on": "2026-09-08",
        "first_checkin_on": None,
    }
    replacement = {**active_challenge, "action_id": "sleep-routine"}

    with (
        patch(
            "app.services.observation_store.get_owned_active_challenge",
            new=AsyncMock(return_value=active_challenge),
        ),
        patch(
            "app.services.observation_store.update_owned_record", new=AsyncMock(return_value=replacement)
        ) as update_record,
    ):
        result = await select_owned_active_challenge("sleep-routine", date(2026, 9, 2), session)

    assert result == replacement
    assert update_record.await_args.args[0:3] == (
        "active_challenges",
        "active-challenge-id",
        {"action_id": "sleep-routine"},
    )


@pytest.mark.asyncio
async def test_select_active_challenge_rejects_replacement_after_first_checkin() -> None:
    session = SupabaseSession(user_id="session-user-id", access_token="session-token")
    active_challenge = {
        "id": "active-challenge-id",
        "action_id": "walk-10-minutes",
        "starts_on": "2026-09-02",
        "ends_on": "2026-09-08",
        "first_checkin_on": "2026-09-02",
    }

    with patch(
        "app.services.observation_store.get_owned_active_challenge",
        new=AsyncMock(return_value=active_challenge),
    ):
        with pytest.raises(ChallengeSelectionLockedError):
            await select_owned_active_challenge("sleep-routine", date(2026, 9, 2), session)


@pytest.mark.asyncio
async def test_create_challenge_checkin_uses_the_active_challenge_and_session_identity() -> None:
    session = SupabaseSession(user_id="session-user-id", access_token="session-token")
    active_challenge = {"id": "active-challenge-id", "action_id": "walk-10-minutes"}
    saved_checkin = {"id": "checkin-id", "challenge_id": "active-challenge-id"}

    with (
        patch(
            "app.services.observation_store.get_owned_active_challenge",
            new=AsyncMock(return_value=active_challenge),
        ),
        patch(
            "app.services.observation_store.upsert_owned_record", new=AsyncMock(return_value=saved_checkin)
        ) as upsert_record,
    ):
        result = await create_owned_challenge_checkin(date(2026, 9, 2), "completed", session)

    assert result == saved_checkin
    assert upsert_record.await_args.args == (
        "challenge_checkins",
        {
            "challenge_id": "active-challenge-id",
            "action_id": "walk-10-minutes",
            "observed_on": "2026-09-02",
            "status": "completed",
        },
        "user_id,challenge_id,observed_on",
        session,
    )
