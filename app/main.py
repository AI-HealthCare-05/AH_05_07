from typing import Literal

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel

from app.apis.v1 import v1_routers
from app.core import config
from app.core.config import parse_api_cors_origins
from app.core.db.databases import initialize_tortoise

API_ALLOWED_METHODS = ("GET", "POST", "PUT", "DELETE")
API_EXPOSED_HEADERS = ("Content-Disposition",)
READINESS_CONFIGURATION_FIELDS = ("SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "API_CORS_ORIGINS")


class ValidationErrorDetail(BaseModel):
    code: Literal["validation_error"] = "validation_error"
    message: Literal["Input values are invalid."] = "Input values are invalid."


class ValidationErrorResponse(BaseModel):
    detail: ValidationErrorDetail


class LivenessResponse(BaseModel):
    status: Literal["ok"] = "ok"


class ReadinessResponse(BaseModel):
    status: Literal["ready"] = "ready"


class ReadinessErrorDetail(BaseModel):
    code: Literal["service_not_ready"] = "service_not_ready"
    message: Literal["Required runtime configuration is unavailable."] = (
        "Required runtime configuration is unavailable."
    )


class ReadinessErrorResponse(BaseModel):
    detail: ReadinessErrorDetail


app = FastAPI(
    default_response_class=ORJSONResponse,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    responses={
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "description": "Input values are invalid.",
            "model": ValidationErrorResponse,
        }
    },
)


def required_runtime_configuration_is_available() -> bool:
    return all(str(getattr(config, field_name, "")).strip() for field_name in READINESS_CONFIGURATION_FIELDS)


@app.get("/live", response_model=LivenessResponse)
def get_liveness() -> LivenessResponse:
    return LivenessResponse()


@app.get(
    "/ready",
    response_model=ReadinessResponse,
    responses={
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "Required runtime configuration is unavailable.",
            "model": ReadinessErrorResponse,
        }
    },
)
def get_readiness() -> ReadinessResponse | ORJSONResponse:
    if not required_runtime_configuration_is_available():
        return ORJSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "detail": {
                    "code": "service_not_ready",
                    "message": "Required runtime configuration is unavailable.",
                }
            },
        )

    return ReadinessResponse()


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(_: Request, __: RequestValidationError) -> ORJSONResponse:
    return ORJSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"detail": {"code": "validation_error", "message": "Input values are invalid."}},
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
        allow_methods=API_ALLOWED_METHODS,
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=API_EXPOSED_HEADERS,
    )
initialize_persistence(app)

app.include_router(v1_routers)
