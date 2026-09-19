import asyncio
from datetime import date
from unittest.mock import AsyncMock, patch

import pytest

from app.apis.v1.observation_routers import get_observation_window
from app.dependencies.supabase_auth import SupabaseSession


@pytest.mark.asyncio
async def test_observation_window_can_mix_same_challenge_from_incompatible_moments() -> None:
    challenge_id = "synthetic-challenge-id"
    session = SupabaseSession(user_id="synthetic-user-id", access_token="synthetic-token")
    state: dict[str, object] = {
        "active_action": "walk-10-minutes",
        "checkins": [],
    }
    active_read_done = asyncio.Event()
    mutation_done = asyncio.Event()

    async def read_active(
        owner: SupabaseSession,
        client: object | None = None,
    ) -> dict[str, object]:
        assert owner == session
        assert client is not None
        snapshot = {
            "id": challenge_id,
            "action_id": state["active_action"],
            "starts_on": "2026-09-12",
            "ends_on": "2026-09-18",
            "first_checkin_on": None,
            "status": "active",
        }
        active_read_done.set()
        return snapshot

    async def read_records(
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
        if table == "challenge_checkins":
            await mutation_done.wait()
            return [dict(item) for item in state["checkins"]]  # type: ignore[arg-type]
        return []

    async def commit_selection_and_first_checkin() -> None:
        await active_read_done.wait()
        state["active_action"] = "sleep-routine"
        state["checkins"] = [
            {
                "id": "synthetic-checkin-id",
                "challenge_id": challenge_id,
                "action_id": "sleep-routine",
                "observed_on": "2026-09-12",
                "status": "completed",
            }
        ]
        mutation_done.set()

    with (
        patch(
            "app.apis.v1.observation_routers.observation_session",
            new=AsyncMock(return_value=session),
        ),
        patch(
            "app.apis.v1.observation_routers.get_owned_active_challenge",
            side_effect=read_active,
        ),
        patch(
            "app.apis.v1.observation_routers.list_owned_records",
            side_effect=read_records,
        ),
    ):
        mutation = asyncio.create_task(commit_selection_and_first_checkin())
        result = await get_observation_window(
            date(2026, 9, 12),
            date(2026, 9, 18),
            "Bearer synthetic-token",
        )
        await mutation

    active = result["active_challenge"]
    checkins = result["challenge_checkins"]

    assert isinstance(active, dict)
    assert isinstance(checkins, list)
    assert len(checkins) == 1
    assert state["active_action"] == "sleep-routine"

    checkin = checkins[0]
    assert active["id"] == checkin["challenge_id"] == challenge_id
    assert active["action_id"] == "walk-10-minutes"
    assert checkin["action_id"] == "sleep-routine"
    assert active["action_id"] != checkin["action_id"]
