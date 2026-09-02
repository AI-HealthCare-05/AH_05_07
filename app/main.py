from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app.apis.v1 import v1_routers
from app.core import config
from app.core.config import parse_api_cors_origins
from app.core.db.databases import initialize_tortoise

app = FastAPI(
    default_response_class=ORJSONResponse, docs_url="/api/docs", redoc_url="/api/redoc", openapi_url="/api/openapi.json"
)


def initialize_persistence(application: FastAPI) -> None:
    if config.ENABLE_LEGACY_MYSQL:
        initialize_tortoise(application)


cors_origins = parse_api_cors_origins(config.API_CORS_ORIGINS)
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
initialize_persistence(app)

app.include_router(v1_routers)
