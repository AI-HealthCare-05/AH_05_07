from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies.supabase_auth import SupabaseSession, get_supabase_session
from app.dtos.observations import BloodPressureObservationInput, ChallengeEventInput
from app.services.observation_store import insert_owned_record

observation_router = APIRouter(prefix="/observations", tags=["observations"])


def storage_not_ready() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"code": "observation_storage_not_ready", "message": "Observation storage is not available."},
    )


@observation_router.post("/blood-pressure", status_code=status.HTTP_201_CREATED)
async def create_blood_pressure_observation(
    payload: BloodPressureObservationInput,
    session: Annotated[SupabaseSession, Depends(get_supabase_session)],
) -> dict[str, object]:
    try:
        return await insert_owned_record("blood_pressure_observations", payload.model_dump(mode="json"), session)
    except httpx.HTTPError as error:
        raise storage_not_ready() from error


@observation_router.post("/challenges", status_code=status.HTTP_201_CREATED)
async def create_challenge_event(
    payload: ChallengeEventInput,
    session: Annotated[SupabaseSession, Depends(get_supabase_session)],
) -> dict[str, object]:
    try:
        return await insert_owned_record("challenge_events", payload.model_dump(mode="json"), session)
    except httpx.HTTPError as error:
        raise storage_not_ready() from error
