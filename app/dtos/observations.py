from datetime import date
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class ObservationPeriod(StrEnum):
    MORNING = "morning"
    EVENING = "evening"


class BloodPressureObservationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    observed_on: date
    period: ObservationPeriod
    systolic: int = Field(ge=60, le=260)
    diastolic: int = Field(ge=30, le=160)


class ChallengeStatus(StrEnum):
    COMPLETED = "completed"
    SKIPPED = "skipped"


class ChallengeEventInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    observed_on: date
    action_id: str = Field(pattern=r"^[a-z0-9-]{1,40}$")
    status: ChallengeStatus
