from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.dependencies.supabase_auth import SupabaseSession, get_supabase_session
from app.services.model_v2_inference import (
    EXPECTED_PRODUCT_WORDING,
    EXPECTED_SCHEMA_VERSION,
    ModelV2ArtifactError,
    ModelV2BoundaryError,
    ModelV2DisabledError,
    ModelV2InferenceBoundary,
    ModelV2InputError,
    scoring_enabled,
)
from app.services.model_v2_input_adapter import ModelV2AdapterError, adapt_product_input_v1

model_v2_router = APIRouter(prefix="/model-v2", tags=["model-v2"])


class ModelV2ScoreResponse(BaseModel):
    schema_version: str
    product_wording: str


class ModelV2ErrorDetail(BaseModel):
    code: Literal["model_not_ready", "model_v2_input_invalid"]
    message: str


class ModelV2ErrorResponse(BaseModel):
    detail: ModelV2ErrorDetail


def _model_not_ready() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={
            "code": "model_not_ready",
            "message": "Model V2 scoring is not available.",
        },
    )


def _model_input_invalid() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail={
            "code": "model_v2_input_invalid",
            "message": "Model V2 input values are invalid.",
        },
    )


def _score_semantic_payload(payload: dict[str, Any]) -> ModelV2ScoreResponse:
    if not scoring_enabled():
        raise _model_not_ready()

    try:
        ModelV2InferenceBoundary().score(payload)
    except ModelV2InputError as exc:
        raise _model_input_invalid() from exc
    except (ModelV2DisabledError, ModelV2ArtifactError, ModelV2BoundaryError) as exc:
        raise _model_not_ready() from exc

    return ModelV2ScoreResponse(
        schema_version=EXPECTED_SCHEMA_VERSION,
        product_wording=EXPECTED_PRODUCT_WORDING,
    )


@model_v2_router.post(
    "/score",
    response_model=ModelV2ScoreResponse,
    responses={
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "description": "Model V2 semantic input is invalid.",
            "model": ModelV2ErrorResponse,
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "Model V2 scoring is disabled or unavailable.",
            "model": ModelV2ErrorResponse,
        },
    },
)
async def score_model_v2(
    payload: dict[str, Any],
    _: Annotated[SupabaseSession, Depends(get_supabase_session)],
) -> ModelV2ScoreResponse:
    return _score_semantic_payload(payload)


@model_v2_router.post(
    "/product-score",
    response_model=ModelV2ScoreResponse,
    responses={
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "description": "Model V2 product input is invalid.",
            "model": ModelV2ErrorResponse,
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "Model V2 scoring is disabled or unavailable.",
            "model": ModelV2ErrorResponse,
        },
    },
)
async def score_model_v2_product(
    payload: dict[str, Any],
    _: Annotated[SupabaseSession, Depends(get_supabase_session)],
) -> ModelV2ScoreResponse:
    if not scoring_enabled():
        raise _model_not_ready()

    try:
        semantic_payload = adapt_product_input_v1(payload)
    except ModelV2AdapterError as exc:
        raise _model_input_invalid() from exc

    return _score_semantic_payload(semantic_payload)
