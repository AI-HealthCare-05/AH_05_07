from typing import Annotated

import httpx
from fastapi import APIRouter, Header, HTTPException, status

from app.dependencies.supabase_auth import ensure_supabase_auth_configured, validate_supabase_access_token
from app.dtos.observations import BloodPressureObservationInput, ChallengeEventInput
from app.services.observation_store import insert_owned_record

observation_router = APIRouter(prefix="/observations", tags=["observations"])


def storage_not_ready() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"code": "observation_storage_not_ready", "message": "Observation storage is not available."},
    )


def bearer_token_from_header(authorization: str | None) -> str:
    scheme, separator, access_token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not separator or not access_token.strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "supabase_session_required"})
    return access_token.strip()


@observation_router.post("/blood-pressure", status_code=status.HTTP_201_CREATED)
async def create_blood_pressure_observation(
    payload: BloodPressureObservationInput,
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    try:
        ensure_supabase_auth_configured()
        session = await validate_supabase_access_token(bearer_token_from_header(authorization))
        return await insert_owned_record("blood_pressure_observations", payload.model_dump(mode="json"), session)
    except httpx.HTTPError as error:
        raise storage_not_ready() from error


@observation_router.post("/challenges", status_code=status.HTTP_201_CREATED)
async def create_challenge_event(
    payload: ChallengeEventInput,
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    try:
        ensure_supabase_auth_configured()
        session = await validate_supabase_access_token(bearer_token_from_header(authorization))
        return await insert_owned_record("challenge_events", payload.model_dump(mode="json"), session)
    except httpx.HTTPError as error:
        raise storage_not_ready() from error
