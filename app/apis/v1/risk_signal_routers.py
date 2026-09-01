from fastapi import APIRouter, HTTPException, status

from app.dtos.risk_signal import RiskSignalInput

risk_signal_router = APIRouter(prefix="/risk-signal", tags=["risk-signal"])


@risk_signal_router.post("", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
async def create_risk_signal(payload: RiskSignalInput) -> None:
    del payload
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"code": "model_not_ready", "message": "A validated model artifact is not available."},
    )
