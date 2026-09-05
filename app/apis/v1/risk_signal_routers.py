from fastapi import APIRouter, HTTPException, status

from app.dtos.risk_signal import RiskSignalInput, RiskSignalOutput

risk_signal_router = APIRouter(prefix="/risk-signal", tags=["risk-signal"])


@risk_signal_router.post("", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
async def create_risk_signal(payload: RiskSignalInput) -> RiskSignalOutput:
    # The legacy DTO is not semantically equivalent to the NHANES predictors.
    # An artifact alone must never enable the old days/status/frequency mapping.
    # Release requires a versioned input adapter and the reviewed model gate.
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"code": "model_not_ready", "message": "A validated model artifact is not available."},
    )
