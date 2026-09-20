import asyncio
from collections.abc import Awaitable, Coroutine
from datetime import date
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, status

from app.apis.v1 import observation_routers
from app.dependencies.supabase_auth import SupabaseSession


@pytest.mark.asyncio
async def test_observation_window_session_uses_remaining_outer_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    observed_authorizations: list[str | None] = []
    observed_timeouts: list[float] = []
    session = SupabaseSession(user_id="session-user", access_token="access-token")

    async def observation_session(authorization: str | None) -> SupabaseSession:
        observed_authorizations.append(authorization)
        return session

    async def bounded_wait(awaitable: Awaitable[SupabaseSession], timeout: float) -> SupabaseSession:
        observed_timeouts.append(timeout)
        return await awaitable

    monkeypatch.setattr(observation_routers, "observation_session", observation_session)
    monkeypatch.setattr(observation_routers, "remaining_observation_read_budget", lambda _deadline: 2.75)
    monkeypatch.setattr(observation_routers.asyncio, "wait_for", bounded_wait)

    result = await observation_routers.observation_window_session("Bearer access-token", 123.0)

    assert result == session
    assert observed_authorizations == ["Bearer access-token"]
    assert observed_timeouts == [2.75]


@pytest.mark.asyncio
async def test_observation_window_session_outer_timeout_maps_to_auth_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def observation_session(_authorization: str | None) -> SupabaseSession:
        return SupabaseSession(user_id="session-user", access_token="access-token")

    async def timed_out_wait(
        awaitable: Coroutine[object, object, SupabaseSession],
        timeout: float,
    ) -> SupabaseSession:
        assert timeout == 1.5
        awaitable.close()
        raise TimeoutError

    monkeypatch.setattr(observation_routers, "observation_session", observation_session)
    monkeypatch.setattr(observation_routers, "remaining_observation_read_budget", lambda _deadline: 1.5)
    monkeypatch.setattr(observation_routers.asyncio, "wait_for", timed_out_wait)

    with pytest.raises(HTTPException) as error:
        await observation_routers.observation_window_session("Bearer access-token", 123.0)

    assert error.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert error.value.detail == {
        "code": "auth_unavailable",
        "message": "Authentication provider is temporarily unavailable.",
    }


@pytest.mark.asyncio
async def test_observation_window_session_preserves_explicit_auth_401(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    auth_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "supabase_session_invalid"},
    )

    async def rejected_session(_authorization: str | None) -> SupabaseSession:
        raise auth_error

    monkeypatch.setattr(observation_routers, "observation_session", rejected_session)
    monkeypatch.setattr(observation_routers, "remaining_observation_read_budget", lambda _deadline: 2.5)

    with pytest.raises(HTTPException) as error:
        await observation_routers.observation_window_session("Bearer rejected-token", 123.0)

    assert error.value is auth_error
    assert error.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert error.value.detail == {"code": "supabase_session_invalid"}


@pytest.mark.asyncio
async def test_window_auth_and_concurrent_data_share_one_server_deadline(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monotonic_values = iter([100.0, 104.2, 104.5])
    wait_timeouts: list[float] = []
    data_timeouts: list[float] = []
    fanout_started: list[str] = []
    all_started = asyncio.Event()
    session = SupabaseSession(user_id="session-user", access_token="access-token")

    monkeypatch.setattr(
        observation_routers,
        "time",
        SimpleNamespace(monotonic=lambda: next(monotonic_values)),
    )

    async def observation_session(_authorization: str | None) -> SupabaseSession:
        return session

    async def bounded_wait(awaitable: Awaitable[object], timeout: float) -> object:
        wait_timeouts.append(timeout)
        return await awaitable

    class DataClient:
        def __init__(self, timeout: float) -> None:
            data_timeouts.append(timeout)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

    async def wait_for_fanout(name: str) -> None:
        fanout_started.append(name)
        if len(fanout_started) == 3:
            all_started.set()
        await all_started.wait()

    async def list_records(table: str, *_args: object, **_kwargs: object) -> list[dict[str, object]]:
        await wait_for_fanout(table)
        return [{"table": table}]

    async def challenge_window(*_args: object, **_kwargs: object) -> dict[str, object]:
        await wait_for_fanout("challenge_window")
        return {"active_challenge": None, "challenge_checkins": []}

    monkeypatch.setattr(observation_routers, "observation_session", observation_session)
    monkeypatch.setattr(observation_routers.asyncio, "wait_for", bounded_wait)
    monkeypatch.setattr(observation_routers.httpx, "AsyncClient", DataClient)
    monkeypatch.setattr(observation_routers, "list_owned_records", list_records)
    monkeypatch.setattr(observation_routers, "get_owned_challenge_window", challenge_window)

    result = await observation_routers.get_observation_window(
        date(2026, 9, 14),
        date(2026, 9, 20),
        "Bearer access-token",
    )

    assert wait_timeouts == pytest.approx([2.8, 2.5])
    assert data_timeouts[0] == pytest.approx(2.5)
    assert set(fanout_started) == {
        "blood_pressure_observations",
        "challenge_events",
        "challenge_window",
    }
    assert result == {
        "start_on": date(2026, 9, 14),
        "end_on": date(2026, 9, 20),
        "blood_pressure_observations": [{"table": "blood_pressure_observations"}],
        "challenge_events": [{"table": "challenge_events"}],
        "active_challenge": None,
        "challenge_checkins": [],
    }


@pytest.mark.asyncio
async def test_window_exhausted_after_auth_stops_before_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monotonic_values = iter([100.0, 100.0, 107.1])
    data_client_started = False

    monkeypatch.setattr(
        observation_routers,
        "time",
        SimpleNamespace(monotonic=lambda: next(monotonic_values)),
    )

    async def observation_session(_authorization: str | None) -> SupabaseSession:
        return SupabaseSession(user_id="session-user", access_token="access-token")

    class DataClient:
        def __init__(self, timeout: float) -> None:
            nonlocal data_client_started
            del timeout
            data_client_started = True

    monkeypatch.setattr(observation_routers, "observation_session", observation_session)
    monkeypatch.setattr(observation_routers.httpx, "AsyncClient", DataClient)

    with pytest.raises(HTTPException) as error:
        await observation_routers.get_observation_window(
            date(2026, 9, 14),
            date(2026, 9, 20),
            "Bearer access-token",
        )

    assert error.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert error.value.detail["code"] == "observation_storage_not_ready"
    assert data_client_started is False


@pytest.mark.asyncio
async def test_window_fanout_deadline_expiry_maps_to_storage_not_ready(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    remaining_values = iter([4.0, 2.0])
    wait_timeouts: list[float] = []

    async def bounded_wait(awaitable: Awaitable[object], timeout: float) -> object:
        wait_timeouts.append(timeout)
        if len(wait_timeouts) == 1:
            return await awaitable
        assert isinstance(awaitable, asyncio.Future)
        awaitable.cancel()
        try:
            await awaitable
        except asyncio.CancelledError:
            pass
        raise TimeoutError

    async def observation_session(_authorization: str | None) -> SupabaseSession:
        return SupabaseSession(user_id="session-user", access_token="access-token")

    class DataClient:
        def __init__(self, timeout: float) -> None:
            assert timeout == 2.0

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

    async def pending_read(*_args: object, **_kwargs: object) -> None:
        await asyncio.Event().wait()

    monkeypatch.setattr(
        observation_routers,
        "asyncio",
        SimpleNamespace(gather=asyncio.gather, wait_for=bounded_wait),
    )
    monkeypatch.setattr(
        observation_routers,
        "remaining_observation_read_budget",
        lambda _deadline: next(remaining_values),
    )
    monkeypatch.setattr(observation_routers, "observation_session", observation_session)
    monkeypatch.setattr(observation_routers.httpx, "AsyncClient", DataClient)
    monkeypatch.setattr(observation_routers, "list_owned_records", pending_read)
    monkeypatch.setattr(observation_routers, "get_owned_challenge_window", pending_read)

    with pytest.raises(HTTPException) as error:
        await observation_routers.get_observation_window(
            date(2026, 9, 14),
            date(2026, 9, 20),
            "Bearer access-token",
        )

    assert wait_timeouts == [4.0, 2.0]
    assert error.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert error.value.detail["code"] == "observation_storage_not_ready"
