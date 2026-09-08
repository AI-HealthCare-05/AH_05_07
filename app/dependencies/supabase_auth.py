from dataclasses import dataclass
from typing import Annotated

import httpx
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core import config

bearer_scheme = HTTPBearer(auto_error=False)

AUTH_UNAVAILABLE_DETAIL = {
    "code": "auth_unavailable",
    "message": "Authentication provider is temporarily unavailable.",
}


@dataclass(frozen=True)
class SupabaseSession:
    user_id: str
    access_token: str


async def get_supabase_session(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer_scheme)],
) -> SupabaseSession:
    ensure_supabase_auth_configured()
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "supabase_session_required"})

    return await validate_supabase_access_token(credentials.credentials)


def ensure_supabase_auth_configured() -> None:
    if not config.SUPABASE_URL or not config.SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "observation_storage_not_ready", "message": "Observation storage is not available."},
        )


def auth_unavailable() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=AUTH_UNAVAILABLE_DETAIL.copy(),
    )


async def validate_supabase_access_token(access_token: str) -> SupabaseSession:
    ensure_supabase_auth_configured()

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(
                f"{config.SUPABASE_URL}/auth/v1/user",
                headers={"apikey": config.SUPABASE_PUBLISHABLE_KEY, "Authorization": f"Bearer {access_token}"},
            )
    except httpx.HTTPError as error:
        raise auth_unavailable() from error

    if response.status_code == status.HTTP_401_UNAUTHORIZED:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "supabase_session_invalid"})

    if response.status_code != status.HTTP_200_OK:
        raise auth_unavailable()

    try:
        payload = response.json()
    except (TypeError, ValueError) as error:
        raise auth_unavailable() from error

    if not isinstance(payload, dict) or not isinstance(payload.get("id"), str) or not payload["id"]:
        raise auth_unavailable()

    return SupabaseSession(user_id=payload["id"], access_token=access_token)
