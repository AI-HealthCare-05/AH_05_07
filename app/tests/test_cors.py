from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.testclient import TestClient

from app.main import API_ALLOWED_METHODS


def test_cors_preflight_allows_owned_record_update() -> None:
    origin = "https://ah-05-07-pages.ahnsangkyoon.workers.dev"
    app = Starlette()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin],
        allow_credentials=False,
        allow_methods=API_ALLOWED_METHODS,
        allow_headers=["Authorization", "Content-Type"],
    )

    response = TestClient(app).options(
        "/api/v1/observations/blood-pressure/11111111-1111-1111-1111-111111111111",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "PUT",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )

    assert response.status_code == 200
    assert "PUT" in response.headers["access-control-allow-methods"]
