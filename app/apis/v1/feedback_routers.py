from datetime import date
from typing import Annotated

import httpx
from fastapi import APIRouter, Header, HTTPException, status

from app.dependencies.supabase_auth import (
    SupabaseSession,
    ensure_supabase_auth_configured,
    validate_supabase_access_token,
)
from app.dtos.feedback import StructuredFeedbackInput, StructuredFeedbackReceipt
from app.services.feedback_store import create_owned_feedback

feedback_router = APIRouter(prefix="/feedback", tags=["feedback"])


def feedback_storage_not_ready() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"code": "feedback_storage_not_ready", "message": "Feedback storage is not available."},
    )


def feedback_already_submitted() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": "feedback_already_submitted",
            "message": "Feedback was already submitted for this surface today.",
        },
    )


def bearer_token_from_header(authorization: str | None) -> str:
    scheme, separator, access_token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not separator or not access_token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "supabase_session_required"},
        )
    return access_token.strip()


async def feedback_session(authorization: str | None) -> SupabaseSession:
    ensure_supabase_auth_configured()
    return await validate_supabase_access_token(bearer_token_from_header(authorization))


@feedback_router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=StructuredFeedbackReceipt,
)
async def create_structured_feedback(
    payload: StructuredFeedbackInput,
    authorization: Annotated[str | None, Header()] = None,
) -> StructuredFeedbackReceipt:
    try:
        session = await feedback_session(authorization)
        record = await create_owned_feedback(
            payload.surface.value,
            payload.response.value,
            session,
        )
    except httpx.HTTPStatusError as error:
        if error.response.status_code == status.HTTP_409_CONFLICT:
            raise feedback_already_submitted() from error
        raise feedback_storage_not_ready() from error
    except httpx.HTTPError as error:
        raise feedback_storage_not_ready() from error

    return StructuredFeedbackReceipt(
        submitted_on=date.fromisoformat(str(record["submitted_on"])),
    )
