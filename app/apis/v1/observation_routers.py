from fastapi import APIRouter, HTTPException, status

from app.dtos.observations import BloodPressureObservationInput, ChallengeEventInput

observation_router = APIRouter(prefix="/observations", tags=["observations"])


def storage_not_ready() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"code": "observation_storage_not_ready", "message": "Observation storage is not available."},
    )


@observation_router.post("/blood-pressure", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
async def create_blood_pressure_observation(payload: BloodPressureObservationInput) -> None:
    del payload
    raise storage_not_ready()


@observation_router.post("/challenges", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
async def create_challenge_event(payload: ChallengeEventInput) -> None:
    del payload
    raise storage_not_ready()
