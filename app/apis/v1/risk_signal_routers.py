import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, status

from app.core.model_registry import verified_model_is_available
from app.dtos.risk_signal import RiskSignalInput

risk_signal_router = APIRouter(prefix="/risk-signal", tags=["risk-signal"])


@risk_signal_router.post("", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
async def create_risk_signal(payload: RiskSignalInput) -> None:
    del payload
    manifest = json.loads(Path("data/manifest/nhanes_2017_2020.json").read_text(encoding="utf-8"))
    expected_digest = os.getenv("RISK_MODEL_SPLIT_DIGEST", "")
    if verified_model_is_available(manifest["candidate_predictors"], expected_digest):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "model_runner_not_ready", "message": "A verified model runner is not available."},
        )
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"code": "model_not_ready", "message": "A validated model artifact is not available."},
    )
