from datetime import date
from typing import Annotated

import httpx
from fastapi import APIRouter, Header, HTTPException, status

from app.dependencies.supabase_auth import (
    SupabaseSession,
    ensure_supabase_auth_configured,
    validate_supabase_access_token,
)
from app.dtos.observations import BloodPressureObservationInput, ChallengeEventInput
from app.services.observation_store import insert_owned_record, list_owned_records

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


async def observation_session(authorization: str | None) -> SupabaseSession:
    ensure_supabase_auth_configured()
    return await validate_supabase_access_token(bearer_token_from_header(authorization))


def validate_observation_window(start_on: date, end_on: date) -> None:
    if end_on < start_on or (end_on - start_on).days > 6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "observation_window_invalid", "message": "Observation window must span one to seven days."},
        )


@observation_router.post("/blood-pressure", status_code=status.HTTP_201_CREATED)
async def create_blood_pressure_observation(
    payload: BloodPressureObservationInput,
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    try:
        session = await observation_session(authorization)
        return await insert_owned_record("blood_pressure_observations", payload.model_dump(mode="json"), session)
    except httpx.HTTPError as error:
        raise storage_not_ready() from error


@observation_router.post("/challenges", status_code=status.HTTP_201_CREATED)
async def create_challenge_event(
    payload: ChallengeEventInput,
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    try:
        session = await observation_session(authorization)
        return await insert_owned_record("challenge_events", payload.model_dump(mode="json"), session)
    except httpx.HTTPError as error:
        raise storage_not_ready() from error


@observation_router.get("/window")
async def get_observation_window(
    start_on: date,
    end_on: date,
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    validate_observation_window(start_on, end_on)
    try:
        session = await observation_session(authorization)
        blood_pressure_observations = await list_owned_records(
            "blood_pressure_observations",
            "id,observed_on,period,systolic,diastolic,created_at,expires_at",
            start_on,
            end_on,
            session,
        )
        challenge_events = await list_owned_records(
            "challenge_events",
            "id,observed_on,action_id,status,created_at,expires_at",
            start_on,
            end_on,
            session,
        )
    except httpx.HTTPError as error:
        raise storage_not_ready() from error

    return {
        "start_on": start_on,
        "end_on": end_on,
        "blood_pressure_observations": blood_pressure_observations,
        "challenge_events": challenge_events,
    }
