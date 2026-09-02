from datetime import date
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ObservationPeriod(StrEnum):
    MORNING = "morning"
    EVENING = "evening"


class BloodPressureObservationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    observed_on: date
    period: ObservationPeriod
    systolic: int = Field(ge=60, le=260)
    diastolic: int = Field(ge=30, le=160)

    @model_validator(mode="after")
    def validate_pressure_order(self) -> "BloodPressureObservationInput":
        if self.systolic <= self.diastolic:
            raise ValueError("systolic must be greater than diastolic")
        return self


class ChallengeStatus(StrEnum):
    COMPLETED = "completed"
    SKIPPED = "skipped"


class ChallengeEventInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    observed_on: date
    action_id: str = Field(pattern=r"^[a-z0-9-]{1,40}$")
    status: ChallengeStatus


class ActiveChallengeSelectionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action_id: str = Field(pattern=r"^[a-z0-9-]{1,40}$")


class ChallengeCheckinInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    observed_on: date
    status: ChallengeStatus
