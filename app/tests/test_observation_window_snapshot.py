from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.apis.v1.observation_routers import get_observation_window
from app.dependencies.supabase_auth import SupabaseSession
from app.services.observation_store import get_owned_challenge_window


@pytest.mark.asyncio
async def test_get_owned_challenge_window_uses_one_authenticated_rpc() -> None:
    session = SupabaseSession(user_id="session-user-id", access_token="session-token")
    snapshot = {
        "active_challenge": {
            "id": "challenge-id",
            "action_id": "sleep-routine",
        },
        "challenge_checkins": [
            {
                "id": "checkin-id",
                "challenge_id": "challenge-id",
                "action_id": "sleep-routine",
                "observed_on": "2026-09-12",
                "status": "completed",
            }
        ],
    }
    response = MagicMock()
    response.json.return_value = snapshot
    client = MagicMock()
    client.post = AsyncMock(return_value=response)

    result = await get_owned_challenge_window(
        date(2026, 9, 12),
        date(2026, 9, 18),
        session,
        client,
    )

    assert result == snapshot
    request = client.post.await_args
    assert request.args[0].endswith("/rest/v1/rpc/get_owned_challenge_window")
    assert request.kwargs["headers"]["Authorization"] == "Bearer session-token"
    assert request.kwargs["json"] == {
        "p_start_on": "2026-09-12",
        "p_end_on": "2026-09-18",
    }


@pytest.mark.asyncio
async def test_observation_window_reads_challenge_facts_from_one_snapshot_boundary() -> None:
    session = SupabaseSession(user_id="session-user-id", access_token="session-token")
    blood_pressure = [{"id": "bp-id", "observed_on": "2026-09-12"}]
    legacy = [{"id": "legacy-id", "observed_on": "2026-09-12"}]
    challenge_snapshot = {
        "active_challenge": {
            "id": "challenge-id",
            "action_id": "sleep-routine",
            "starts_on": "2026-09-12",
            "ends_on": "2026-09-18",
            "first_checkin_on": "2026-09-12",
            "status": "active",
        },
        "challenge_checkins": [
            {
                "id": "checkin-id",
                "challenge_id": "challenge-id",
                "action_id": "sleep-routine",
                "observed_on": "2026-09-12",
                "status": "completed",
            }
        ],
    }
    record_tables: list[str] = []

    async def list_records(
        table: str,
        select: str,
        start_on: date,
        end_on: date,
        owner: SupabaseSession,
        client: object | None = None,
    ) -> list[dict[str, object]]:
        del select, start_on, end_on
        assert owner == session
        assert client is not None
        record_tables.append(table)
        if table == "blood_pressure_observations":
            return blood_pressure
        if table == "challenge_events":
            return legacy
        raise AssertionError(f"unexpected independent fan-in table: {table}")

    snapshot_read = AsyncMock(return_value=challenge_snapshot)

    with (
        patch(
            "app.apis.v1.observation_routers.observation_session",
            new=AsyncMock(return_value=session),
        ),
        patch(
            "app.apis.v1.observation_routers.list_owned_records",
            side_effect=list_records,
        ),
        patch(
            "app.apis.v1.observation_routers.get_owned_challenge_window",
            new=snapshot_read,
        ),
    ):
        result = await get_observation_window(
            date(2026, 9, 12),
            date(2026, 9, 18),
            "Bearer session-token",
        )

    assert record_tables == ["blood_pressure_observations", "challenge_events"]
    snapshot_read.assert_awaited_once()
    assert snapshot_read.await_args.args[:3] == (
        date(2026, 9, 12),
        date(2026, 9, 18),
        session,
    )
    assert result["active_challenge"] == challenge_snapshot["active_challenge"]
    assert result["challenge_checkins"] == challenge_snapshot["challenge_checkins"]
    assert result["active_challenge"]["action_id"] == result["challenge_checkins"][0]["action_id"]
