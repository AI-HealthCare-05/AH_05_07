from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.dependencies.supabase_auth import SupabaseSession
from app.services.observation_store import insert_owned_record


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
