from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.dependencies.supabase_auth import SupabaseSession
from app.services.feedback_store import create_owned_feedback


@pytest.mark.asyncio
async def test_feedback_store_sends_only_structured_values_with_session_identity() -> None:
    response = MagicMock()
    response.json.return_value = [
        {
            "id": "feedback-id",
            "surface": "seven_day_recap",
            "response": "clear",
            "submitted_on": "2026-09-16",
            "created_at": "2026-09-16T12:00:00Z",
            "expires_at": "2026-10-16T12:00:00Z",
        }
    ]
    client = MagicMock()
    client.post = AsyncMock(return_value=response)
    client_context = MagicMock()
    client_context.__aenter__ = AsyncMock(return_value=client)
    client_context.__aexit__ = AsyncMock(return_value=None)
    session = SupabaseSession(user_id="session-user-id", access_token="session-token")

    with patch("app.services.feedback_store.httpx.AsyncClient", return_value=client_context):
        record = await create_owned_feedback("seven_day_recap", "clear", session)

    assert record["surface"] == "seven_day_recap"
    assert client.post.await_args.kwargs["headers"]["Authorization"] == "Bearer session-token"
    assert client.post.await_args.kwargs["params"] == {
        "select": "id,surface,response,submitted_on,created_at,expires_at"
    }
    assert client.post.await_args.kwargs["json"] == {
        "user_id": "session-user-id",
        "surface": "seven_day_recap",
        "response": "clear",
    }
    assert "submitted_on" not in client.post.await_args.kwargs["json"]
    assert "expires_at" not in client.post.await_args.kwargs["json"]
