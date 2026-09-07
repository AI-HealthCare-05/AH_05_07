from pathlib import Path


def test_legacy_risk_signal_route_remains_model_not_ready() -> None:
    source = Path("app/apis/v1/risk_signal_routers.py").read_text(encoding="utf-8")
    assert "status_code=status.HTTP_503_SERVICE_UNAVAILABLE" in source
    assert '"code": "model_not_ready"' in source
    assert "ModelV2InferenceBoundary" not in source
