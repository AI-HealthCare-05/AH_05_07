from dataclasses import dataclass
from typing import Annotated

import httpx
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core import config

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class SupabaseSession:
    user_id: str
    access_token: str


async def get_supabase_session(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer_scheme)],
) -> SupabaseSession:
    if not config.SUPABASE_URL or not config.SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "observation_storage_not_ready", "message": "Observation storage is not available."},
        )
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "supabase_session_required"})

    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.get(
            f"{config.SUPABASE_URL}/auth/v1/user",
            headers={"apikey": config.SUPABASE_PUBLISHABLE_KEY, "Authorization": f"Bearer {credentials.credentials}"},
        )
    if response.status_code != status.HTTP_200_OK or not response.json().get("id"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "supabase_session_invalid"})
    return SupabaseSession(user_id=response.json()["id"], access_token=credentials.credentials)
