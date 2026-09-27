from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response

from app.dependencies.supabase_auth import SupabaseSession, get_supabase_session
from app.dtos.placeable import PlaceableSave, PlaceableSnapshot
from app.services.placeable_store import placeable_rpc

placeable_router = APIRouter(prefix="/cosmetics/placeable", tags=["cosmetics"])
VerifiedSession = Annotated[SupabaseSession, Depends(get_supabase_session)]


def rpc_rejection(response: httpx.Response) -> str | None:
    """Only recognize our fixed database errors; never expose upstream payloads."""
    if response.status_code in (401, 403):
        return "session_invalid"
    try:
        body = response.json()
    except ValueError:
        return None
    if not isinstance(body, dict):
        return None
    allowed = {
        (409, "PT409", "revision_conflict"),
        (409, "PT409", "operation_changed"),
        (410, "PT410", "owner_deleted"),
        (422, "PT422", "unsupported_snapshot"),
    }
    return next(
        (
            reason
            for status, code, reason in allowed
            if response.status_code == status and body.get("code") == code and body.get("message") == reason
        ),
        None,
    )


async def exchange(session: SupabaseSession, payload: PlaceableSave | None = None) -> PlaceableSnapshot:
    try:
        return await placeable_rpc(session, payload)
    except httpx.HTTPStatusError as error:
        reason = rpc_rejection(error.response)
        if reason is not None:
            raise HTTPException(
                status_code=error.response.status_code, detail={"code": reason}, headers={"Cache-Control": "no-store"}
            ) from error
        raise HTTPException(
            status_code=503,
            detail={"code": "save_unknown" if payload else "read_unavailable"},
            headers={"Cache-Control": "no-store"},
        ) from error
    except (httpx.HTTPError, ValueError) as error:
        # Transport and decoding failures are not evidence that a write failed.
        raise HTTPException(
            status_code=503,
            detail={"code": "save_unknown" if payload else "read_unavailable"},
            headers={"Cache-Control": "no-store"},
        ) from error


@placeable_router.get("", response_model=PlaceableSnapshot)
async def read_placeable(session: VerifiedSession, response: Response) -> PlaceableSnapshot:
    response.headers["Cache-Control"] = "no-store"
    return await exchange(session)


@placeable_router.put("", response_model=PlaceableSnapshot)
async def save_placeable(payload: PlaceableSave, session: VerifiedSession, response: Response) -> PlaceableSnapshot:
    response.headers["Cache-Control"] = "no-store"
    return await exchange(session, payload)
