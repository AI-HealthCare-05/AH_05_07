from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import PlainTextResponse
from starlette.testclient import TestClient

from app.main import API_ALLOWED_METHODS, API_EXPOSED_HEADERS


def test_cors_preflight_allows_owned_record_update() -> None:
    origin = "https://ah-05-07-pages.ahnsangkyoon.workers.dev"
    app = Starlette()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin],
        allow_credentials=False,
        allow_methods=API_ALLOWED_METHODS,
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=API_EXPOSED_HEADERS,
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


def test_cors_exposes_export_filename_to_the_browser() -> None:
    origin = "https://ah-05-07-pages.ahnsangkyoon.workers.dev"
    app = Starlette()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin],
        allow_credentials=False,
        allow_methods=API_ALLOWED_METHODS,
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=API_EXPOSED_HEADERS,
    )

    @app.route("/api/v1/observations/export")
    async def export_file(_request):
        return PlainTextResponse("{}", headers={"Content-Disposition": 'attachment; filename="records.json"'})

    response = TestClient(app).get("/api/v1/observations/export", headers={"Origin": origin})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-expose-headers"] == "Content-Disposition"
