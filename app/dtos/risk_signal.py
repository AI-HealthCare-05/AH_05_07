from pydantic import BaseModel, ConfigDict, Field


class RiskSignalInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sex: int = Field(ge=1, le=2)
    age_years: int = Field(ge=18, le=120)
    bmi: float = Field(ge=10, le=80)
    physical_activity_days: int | None = Field(default=None, ge=0, le=7)
    smoking_status: int | None = Field(default=None, ge=1, le=3)
    alcohol_frequency: int | None = Field(default=None, ge=0, le=7)
    sleep_hours: float | None = Field(default=None, ge=0, le=24)


class RiskSignalOutput(BaseModel):
    model_version: str
    signal_probability: float = Field(ge=0, le=1)
    signal_band: str
    disclaimer: str = "입력 기반 위험군 선별 신호이며 진단이나 치료 판단이 아닙니다."
