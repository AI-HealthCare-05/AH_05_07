from datetime import date
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Header, HTTPException, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from app.dependencies.supabase_auth import (
    SupabaseSession,
    ensure_supabase_auth_configured,
    validate_supabase_access_token,
)
from app.dtos.observations import BloodPressureObservationInput, ChallengeEventInput
from app.services.observation_store import delete_owned_record, insert_owned_record, list_owned_records

observation_router = APIRouter(prefix="/observations", tags=["observations"])


def storage_not_ready() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"code": "observation_storage_not_ready", "message": "Observation storage is not available."},
    )


def owned_record_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "observation_not_found", "message": "Observation record was not found."},
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


def validate_observation_export_window(start_on: date, end_on: date) -> None:
    if end_on < start_on or (end_on - start_on).days > 29:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "observation_export_window_invalid",
                "message": "Export window must span one to thirty days.",
            },
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


@observation_router.delete("/blood-pressure/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_blood_pressure_observation(
    record_id: UUID,
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    try:
        deleted = await delete_owned_record(
            "blood_pressure_observations", record_id, await observation_session(authorization)
        )
    except httpx.HTTPError as error:
        raise storage_not_ready() from error
    if not deleted:
        raise owned_record_not_found()


@observation_router.delete("/challenges/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_challenge_event(
    record_id: UUID,
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    try:
        deleted = await delete_owned_record("challenge_events", record_id, await observation_session(authorization))
    except httpx.HTTPError as error:
        raise storage_not_ready() from error
    if not deleted:
        raise owned_record_not_found()


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


@observation_router.get("/export")
async def export_observations(
    start_on: date,
    end_on: date,
    authorization: Annotated[str | None, Header()] = None,
) -> JSONResponse:
    validate_observation_export_window(start_on, end_on)
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

    return JSONResponse(
        content=jsonable_encoder(
            {
                "start_on": start_on,
                "end_on": end_on,
                "blood_pressure_observations": blood_pressure_observations,
                "challenge_events": challenge_events,
            }
        ),
        headers={"Content-Disposition": f'attachment; filename="bp7-observations-{start_on}-{end_on}.json"'},
    )
