from httpx import ASGITransport, AsyncClient
from starlette import status

from app import main


async def test_liveness_does_not_require_runtime_configuration() -> None:
    async with AsyncClient(transport=ASGITransport(app=main.app), base_url="http://test") as client:
        response = await client.get("/live")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ok"}


async def test_health_routes_are_exposed_in_openapi() -> None:
    async with AsyncClient(transport=ASGITransport(app=main.app), base_url="http://test") as client:
        response = await client.get("/api/openapi.json")

    assert response.status_code == status.HTTP_200_OK
    assert {"/live", "/ready"} <= set(response.json()["paths"])


async def test_readiness_reports_ready_with_required_runtime_configuration(monkeypatch) -> None:
    monkeypatch.setattr(main.config, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(main.config, "SUPABASE_PUBLISHABLE_KEY", "public-key")
    monkeypatch.setattr(main.config, "API_CORS_ORIGINS", "https://app.example.com")

    async with AsyncClient(transport=ASGITransport(app=main.app), base_url="http://test") as client:
        response = await client.get("/ready")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ready"}


async def test_readiness_hides_missing_runtime_configuration(monkeypatch) -> None:
    monkeypatch.setattr(main.config, "SUPABASE_URL", "")
    monkeypatch.setattr(main.config, "SUPABASE_PUBLISHABLE_KEY", "public-key")
    monkeypatch.setattr(main.config, "API_CORS_ORIGINS", "https://app.example.com")

    async with AsyncClient(transport=ASGITransport(app=main.app), base_url="http://test") as client:
        response = await client.get("/ready")

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert response.json() == {
        "detail": {"code": "service_not_ready", "message": "Required runtime configuration is unavailable."}
    }
