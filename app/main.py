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


class ValidationErrorDetail(BaseModel):
    code: Literal["validation_error"] = "validation_error"
    message: Literal["Input values are invalid."] = "Input values are invalid."


class ValidationErrorResponse(BaseModel):
    detail: ValidationErrorDetail


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
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
initialize_persistence(app)

app.include_router(v1_routers)
