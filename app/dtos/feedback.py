from datetime import date
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict


class FeedbackSurface(StrEnum):
    SEVEN_DAY_RECAP = "seven_day_recap"


class FeedbackResponse(StrEnum):
    CLEAR = "clear"
    UNCLEAR = "unclear"
    HARD_TO_UNDERSTAND = "hard_to_understand"


class StructuredFeedbackInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    surface: FeedbackSurface
    response: FeedbackResponse


class StructuredFeedbackReceipt(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["saved"] = "saved"
    submitted_on: date
