import httpx
import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from starlette import status

from app.apis.v1 import account_routers
from app.core import config
from app.dependencies import supabase_auth
from app.dependencies.supabase_auth import SupabaseSession, get_supabase_session
from app.main import app
from app.services import supabase_admin

CALLER_ID = "11111111-1111-4111-8111-111111111111"
OTHER_ID = "22222222-2222-4222-8222-222222222222"


@pytest.fixture
def supabase_runtime(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(config, "SUPABASE_URL", "https://supabase.test")
    monkeypatch.setattr(config, "SUPABASE_PUBLISHABLE_KEY", "publishable-test-key")
    monkeypatch.setattr(config, "SUPABASE_SECRET_KEY", "admin-test-secret")
    yield


async def request_account_delete(**kwargs):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        return await client.request("DELETE", "/api/v1/account", **kwargs)


class FakeAuthResponse:
    def __init__(self, status_code: int, payload: object):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


class FakeAuthClient:
    def __init__(self, response: FakeAuthResponse | None = None, error: Exception | None = None):
        self.response = response
        self.error = error

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    async def get(self, *_args, **_kwargs):
        if self.error is not None:
            raise self.error
        return self.response


def mock_auth_provider(monkeypatch: pytest.MonkeyPatch, *, response=None, error=None):
    monkeypatch.setattr(
        supabase_auth.httpx,
        "AsyncClient",
        lambda timeout: FakeAuthClient(response=response, error=error),
    )


@pytest.mark.asyncio
async def test_no_auth_returns_401(supabase_runtime):
    response = await request_account_delete()

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {"detail": {"code": "supabase_session_required"}}


@pytest.mark.asyncio
async def test_invalid_supabase_token_returns_401(supabase_runtime, monkeypatch):
    async def invalid_token(_: str) -> SupabaseSession:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "supabase_session_invalid"})

    monkeypatch.setattr(supabase_auth, "validate_supabase_access_token", invalid_token)

    response = await request_account_delete(headers={"Authorization": "Bearer invalid-token"})

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_mocked_supabase_user_401_denies_access_token(supabase_runtime, monkeypatch):
    class DeletedUserResponse:
        status_code = status.HTTP_401_UNAUTHORIZED

        def json(self):
            return {"message": "invalid token"}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def get(self, *_args, **_kwargs):
            return DeletedUserResponse()

    monkeypatch.setattr(supabase_auth.httpx, "AsyncClient", lambda timeout: FakeClient())

    with pytest.raises(HTTPException) as error:
        await supabase_auth.validate_supabase_access_token("old-access-token")

    assert error.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert error.value.detail == {"code": "supabase_session_invalid"}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"code": "bad_jwt", "message": "JWT signature rejected", "access_token": "upstream-bad-jwt-token"},
        {
            "code": "session_not_found",
            "message": "Session no longer exists",
            "access_token": "upstream-missing-session-token",
        },
        {"code": "user_not_found", "message": "User no longer exists", "access_token": "upstream-missing-user-token"},
    ],
)
async def test_mocked_supabase_user_403_rejections_deny_access_token(supabase_runtime, monkeypatch, payload):
    mock_auth_provider(monkeypatch, response=FakeAuthResponse(status.HTTP_403_FORBIDDEN, payload))

    with pytest.raises(HTTPException) as error:
        await supabase_auth.validate_supabase_access_token("secret-access-token")

    assert error.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert error.value.detail == {"code": "supabase_session_invalid"}


@pytest.mark.asyncio
async def test_valid_supabase_token_returns_authenticated_session(supabase_runtime, monkeypatch):
    mock_auth_provider(
        monkeypatch,
        response=FakeAuthResponse(status.HTTP_200_OK, {"id": CALLER_ID, "email": "provider@example.test"}),
    )

    session = await supabase_auth.validate_supabase_access_token("access-token")

    assert session == SupabaseSession(user_id=CALLER_ID, access_token="access-token")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "error_type",
    [httpx.ReadTimeout, httpx.ConnectError],
)
async def test_auth_transport_failures_are_not_invalid_sessions(supabase_runtime, monkeypatch, error_type):
    mock_auth_provider(monkeypatch, error=error_type("provider failure"))

    with pytest.raises(HTTPException) as error:
        await supabase_auth.validate_supabase_access_token("secret-access-token")

    assert error.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert error.value.detail == {
        "code": "auth_unavailable",
        "message": "Authentication provider is temporarily unavailable.",
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("status_code", [status.HTTP_429_TOO_MANY_REQUESTS, 500, 502, 503, 400])
async def test_auth_non_rejection_responses_are_dependency_unavailable(supabase_runtime, monkeypatch, status_code):
    mock_auth_provider(
        monkeypatch,
        response=FakeAuthResponse(
            status_code,
            {"message": "provider-internal-detail", "access_token": "upstream-token"},
        ),
    )

    with pytest.raises(HTTPException) as error:
        await supabase_auth.validate_supabase_access_token("secret-access-token")

    assert error.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert error.value.detail == {
        "code": "auth_unavailable",
        "message": "Authentication provider is temporarily unavailable.",
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"message": "provider-internal-detail", "access_token": "upstream-token"},
        ValueError("malformed provider response"),
        ["unexpected", "shape"],
    ],
)
async def test_malformed_auth_success_response_is_dependency_unavailable(supabase_runtime, monkeypatch, payload):
    mock_auth_provider(monkeypatch, response=FakeAuthResponse(status.HTTP_200_OK, payload))

    with pytest.raises(HTTPException) as error:
        await supabase_auth.validate_supabase_access_token("secret-access-token")

    assert error.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert error.value.detail == {
        "code": "auth_unavailable",
        "message": "Authentication provider is temporarily unavailable.",
    }


@pytest.mark.asyncio
async def test_auth_unavailable_api_response_is_stable_and_sanitized(supabase_runtime, monkeypatch):
    mock_auth_provider(
        monkeypatch,
        response=FakeAuthResponse(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            {"message": "provider-internal-detail", "access_token": "upstream-token"},
        ),
    )

    response = await request_account_delete(headers={"Authorization": "Bearer secret-access-token"})

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert response.json() == {
        "detail": {
            "code": "auth_unavailable",
            "message": "Authentication provider is temporarily unavailable.",
        }
    }
    assert b"secret-access-token" not in response.content
    assert b"upstream-token" not in response.content
    assert b"provider-internal-detail" not in response.content


@pytest.mark.asyncio
async def test_supabase_403_api_response_is_invalid_session_and_sanitized(supabase_runtime, monkeypatch):
    mock_auth_provider(
        monkeypatch,
        response=FakeAuthResponse(
            status.HTTP_403_FORBIDDEN,
            {
                "code": "bad_jwt",
                "message": "provider rejected upstream token",
                "access_token": "upstream-secret-token",
            },
        ),
    )

    response = await request_account_delete(headers={"Authorization": "Bearer client-secret-token"})

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {"detail": {"code": "supabase_session_invalid"}}
    assert b"bad_jwt" not in response.content
    assert b"provider rejected upstream token" not in response.content
    assert b"upstream-secret-token" not in response.content
    assert b"client-secret-token" not in response.content


@pytest.mark.asyncio
async def test_authenticated_delete_targets_only_validated_caller_and_returns_empty_204(supabase_runtime, monkeypatch):
    target_ids: list[str] = []

    async def authenticated_session() -> SupabaseSession:
        return SupabaseSession(user_id=CALLER_ID, access_token="access-token")

    async def fake_delete_auth_user(user_id: str) -> None:
        target_ids.append(user_id)

    app.dependency_overrides[get_supabase_session] = authenticated_session
    monkeypatch.setattr(account_routers, "delete_auth_user", fake_delete_auth_user)
    try:
        response = await request_account_delete(
            params={"user_id": OTHER_ID, "email": "other@example.test"},
            json={"user_id": OTHER_ID, "email": "other@example.test"},
            headers={"Authorization": "Bearer access-token"},
        )
    finally:
        app.dependency_overrides.pop(get_supabase_session, None)

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert response.content == b""
    assert target_ids == [CALLER_ID]
    assert OTHER_ID.encode() not in response.content
    assert b"example.test" not in response.content


@pytest.mark.asyncio
async def test_missing_secret_fails_closed_without_response_details(monkeypatch):
    monkeypatch.setattr(config, "SUPABASE_URL", "https://supabase.test")
    monkeypatch.setattr(config, "SUPABASE_SECRET_KEY", "")

    async def authenticated_session() -> SupabaseSession:
        return SupabaseSession(user_id=CALLER_ID, access_token="access-token")

    app.dependency_overrides[get_supabase_session] = authenticated_session
    try:
        response = await request_account_delete(headers={"Authorization": "Bearer access-token"})
    finally:
        app.dependency_overrides.pop(get_supabase_session, None)

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert response.json() == {
        "detail": {"code": "account_deletion_not_ready", "message": "Account deletion is not available."}
    }
    assert b"admin-test-secret" not in response.content
    assert CALLER_ID.encode() not in response.content


@pytest.mark.asyncio
async def test_admin_failure_is_privacy_safe(supabase_runtime, monkeypatch):
    async def authenticated_session() -> SupabaseSession:
        return SupabaseSession(user_id=CALLER_ID, access_token="access-token")

    async def failed_delete(_: str) -> None:
        raise supabase_admin.SupabaseAdminRequestError("upstream")

    app.dependency_overrides[get_supabase_session] = authenticated_session
    monkeypatch.setattr(account_routers, "delete_auth_user", failed_delete)
    try:
        response = await request_account_delete(headers={"Authorization": "Bearer access-token"})
    finally:
        app.dependency_overrides.pop(get_supabase_session, None)

    assert response.status_code == status.HTTP_502_BAD_GATEWAY
    assert response.json() == {
        "detail": {"code": "account_deletion_failed", "message": "Account deletion could not be completed."}
    }
    assert CALLER_ID.encode() not in response.content
    assert b"admin-test-secret" not in response.content


@pytest.mark.asyncio
async def test_admin_helper_uses_exact_caller_uuid_and_server_only_secret(monkeypatch):
    calls: list[tuple[str, dict[str, str]]] = []

    class FakeResponse:
        status_code = status.HTTP_204_NO_CONTENT

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def delete(self, url: str, headers: dict[str, str]):
            calls.append((url, headers))
            return FakeResponse()

    monkeypatch.setattr(config, "SUPABASE_URL", "https://supabase.test/")
    monkeypatch.setattr(config, "SUPABASE_SECRET_KEY", "admin-test-secret")
    monkeypatch.setattr(supabase_admin.httpx, "AsyncClient", lambda timeout: FakeClient())

    await supabase_admin.delete_auth_user(CALLER_ID)

    assert calls == [
        (
            f"https://supabase.test/auth/v1/admin/users/{CALLER_ID}",
            {"apikey": "admin-test-secret"},
        )
    ]


def test_account_route_has_no_target_or_email_parameters():
    route = next(route for route in app.routes if getattr(route, "path", None) == "/api/v1/account")

    assert route.methods == {"DELETE"}
    assert route.dependant.query_params == []
    assert route.dependant.body_params == []
