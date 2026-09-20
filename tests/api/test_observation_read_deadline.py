import asyncio
from collections.abc import Awaitable
from datetime import date
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, status

from app.apis.v1 import observation_routers
from app.core import config
from app.dependencies import supabase_auth
from app.dependencies.supabase_auth import SupabaseSession


class SuccessfulAuthResponse:
    status_code = status.HTTP_200_OK

    @staticmethod
    def json() -> dict[str, str]:
        return {"id": "11111111-1111-4111-8111-111111111111"}


@pytest.mark.asyncio
async def test_auth_validator_keeps_five_second_default(monkeypatch: pytest.MonkeyPatch) -> None:
    observed_timeouts: list[float] = []

    class AuthClient:
        def __init__(self, timeout: float) -> None:
            observed_timeouts.append(timeout)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def get(self, *_args: object, **_kwargs: object) -> SuccessfulAuthResponse:
            return SuccessfulAuthResponse()

    monkeypatch.setattr(config, "SUPABASE_URL", "https://supabase.test")
    monkeypatch.setattr(config, "SUPABASE_PUBLISHABLE_KEY", "publishable-test-key")
    monkeypatch.setattr(supabase_auth.httpx, "AsyncClient", AuthClient)

    session = await supabase_auth.validate_supabase_access_token("access-token")

    assert observed_timeouts == [5.0]
    assert session == SupabaseSession(
        user_id="11111111-1111-4111-8111-111111111111",
        access_token="access-token",
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("provider_status", [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
async def test_bounded_auth_explicit_rejection_stays_401(
    monkeypatch: pytest.MonkeyPatch,
    provider_status: int,
) -> None:
    class RejectedAuthResponse:
        status_code = provider_status

    class AuthClient:
        def __init__(self, timeout: float) -> None:
            assert timeout == 2.5

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def get(self, *_args: object, **_kwargs: object) -> RejectedAuthResponse:
            return RejectedAuthResponse()

    monkeypatch.setattr(config, "SUPABASE_URL", "https://supabase.test")
    monkeypatch.setattr(config, "SUPABASE_PUBLISHABLE_KEY", "publishable-test-key")
    monkeypatch.setattr(supabase_auth.httpx, "AsyncClient", AuthClient)

    with pytest.raises(HTTPException) as error:
        await supabase_auth.validate_supabase_access_token("rejected-token", timeout_seconds=2.5)

    assert error.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert error.value.detail == {"code": "supabase_session_invalid"}


@pytest.mark.asyncio
async def test_window_auth_and_concurrent_data_share_one_server_deadline(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monotonic_values = iter([100.0, 104.2, 104.5])
    auth_timeouts: list[float] = []
    data_timeouts: list[float] = []
    fanout_started: list[str] = []
    all_started = asyncio.Event()
    session = SupabaseSession(user_id="session-user", access_token="access-token")

    monkeypatch.setattr(
        observation_routers,
        "time",
        SimpleNamespace(monotonic=lambda: next(monotonic_values)),
    )

    async def observation_session(_authorization: str | None, timeout_seconds: float = 5.0) -> SupabaseSession:
        auth_timeouts.append(timeout_seconds)
        return session

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
    monkeypatch.setattr(observation_routers.httpx, "AsyncClient", DataClient)
    monkeypatch.setattr(observation_routers, "list_owned_records", list_records)
    monkeypatch.setattr(observation_routers, "get_owned_challenge_window", challenge_window)

    result = await observation_routers.get_observation_window(
        date(2026, 9, 14),
        date(2026, 9, 20),
        "Bearer access-token",
    )

    assert auth_timeouts[0] == pytest.approx(2.8)
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
async def test_window_auth_deadline_expiry_stays_auth_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    async def timed_out_session(*_args: object, **_kwargs: object) -> SupabaseSession:
        raise TimeoutError

    monkeypatch.setattr(observation_routers, "observation_session", timed_out_session)

    with pytest.raises(HTTPException) as error:
        await observation_routers.get_observation_window(
            date(2026, 9, 14),
            date(2026, 9, 20),
            "Bearer access-token",
        )

    assert error.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert error.value.detail == {
        "code": "auth_unavailable",
        "message": "Authentication provider is temporarily unavailable.",
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

    async def observation_session(_authorization: str | None, timeout_seconds: float = 5.0) -> SupabaseSession:
        assert timeout_seconds == 5.0
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

    async def observation_session(_authorization: str | None, timeout_seconds: float = 5.0) -> SupabaseSession:
        assert timeout_seconds == 4.0
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
