import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, status

from app.core.model_artifact import load_verified_metadata
from app.core.model_registry import verified_model_is_available
from app.core.model_runner import VerifiedModelRunner
from app.dtos.risk_signal import RiskSignalInput, RiskSignalOutput

risk_signal_router = APIRouter(prefix="/risk-signal", tags=["risk-signal"])


@risk_signal_router.post("", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
async def create_risk_signal(payload: RiskSignalInput) -> RiskSignalOutput:
    manifest = json.loads(Path("data/manifest/nhanes_2017_2020.json").read_text(encoding="utf-8"))
    expected_digest = os.getenv("RISK_MODEL_SPLIT_DIGEST", "")
    if verified_model_is_available(manifest["candidate_predictors"], expected_digest):
        metadata = load_verified_metadata(
            Path(os.environ["RISK_MODEL_METADATA"]), manifest["candidate_predictors"], expected_digest
        )
        runner = VerifiedModelRunner(Path(os.environ["RISK_MODEL_ARTIFACT"]), metadata)
        values = {
            "RIAGENDR": payload.sex,
            "RIDAGEYR": payload.age_years,
            "BMXBMI": payload.bmi,
            "PAQ605": payload.physical_activity_days,
            "PAQ620": payload.physical_activity_days,
            "SMQ020": payload.smoking_status,
            "ALQ101": payload.alcohol_frequency,
            "SLD012": payload.sleep_hours,
        }
        probability = runner.predict_probability(values)
        return RiskSignalOutput(
            model_version=metadata.model_version,
            signal_probability=probability,
            signal_band="elevated" if probability >= 0.5 else "lower",
        )
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"code": "model_not_ready", "message": "A validated model artifact is not available."},
    )
