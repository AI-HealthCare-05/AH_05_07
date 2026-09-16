from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport, AsyncClient, Request, Response

from app.dependencies.supabase_auth import SupabaseSession
from app.main import app

SESSION = SupabaseSession(user_id="feedback-user-id", access_token="feedback-token")


@pytest.mark.asyncio
async def test_structured_feedback_returns_minimal_receipt() -> None:
    stored = {
        "id": "feedback-id",
        "surface": "seven_day_recap",
        "response": "clear",
        "submitted_on": "2026-09-16",
        "created_at": "2026-09-16T12:00:00Z",
        "expires_at": "2026-10-16T12:00:00Z",
    }

    with (
        patch("app.apis.v1.feedback_routers.feedback_session", AsyncMock(return_value=SESSION)),
        patch(
            "app.apis.v1.feedback_routers.create_owned_feedback",
            AsyncMock(return_value=stored),
        ) as create_feedback,
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/feedback",
                headers={"Authorization": "Bearer feedback-token"},
                json={"surface": "seven_day_recap", "response": "clear"},
            )

    assert response.status_code == 201
    assert response.json() == {"status": "saved", "submitted_on": "2026-09-16"}
    create_feedback.assert_awaited_once_with("seven_day_recap", "clear", SESSION)


@pytest.mark.asyncio
async def test_structured_feedback_rejects_extra_fields_without_echoing_them() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/feedback",
            json={
                "surface": "seven_day_recap",
                "response": "clear",
                "note": "free text should never be accepted",
            },
        )

    assert response.status_code == 422
    assert response.json() == {"detail": {"code": "validation_error", "message": "Input values are invalid."}}
    assert "free text should never be accepted" not in response.text


@pytest.mark.asyncio
async def test_structured_feedback_maps_same_day_duplicate_to_stable_conflict() -> None:
    request = Request("POST", "https://example.invalid/rest/v1/structured_feedback")
    conflict = httpx.HTTPStatusError(
        "duplicate",
        request=request,
        response=Response(409, request=request),
    )

    with (
        patch("app.apis.v1.feedback_routers.feedback_session", AsyncMock(return_value=SESSION)),
        patch(
            "app.apis.v1.feedback_routers.create_owned_feedback",
            AsyncMock(side_effect=conflict),
        ),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/feedback",
                headers={"Authorization": "Bearer feedback-token"},
                json={"surface": "seven_day_recap", "response": "unclear"},
            )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "feedback_already_submitted"


@pytest.mark.asyncio
async def test_structured_feedback_storage_failure_never_claims_saved() -> None:
    request = Request("POST", "https://example.invalid/rest/v1/structured_feedback")
    failure = httpx.ConnectError("offline", request=request)

    with (
        patch("app.apis.v1.feedback_routers.feedback_session", AsyncMock(return_value=SESSION)),
        patch(
            "app.apis.v1.feedback_routers.create_owned_feedback",
            AsyncMock(side_effect=failure),
        ),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/feedback",
                headers={"Authorization": "Bearer feedback-token"},
                json={"surface": "seven_day_recap", "response": "hard_to_understand"},
            )

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "feedback_storage_not_ready"
    assert "saved" not in response.text.lower()


def test_structured_feedback_openapi_has_exact_request_and_receipt_models() -> None:
    operation = app.openapi()["paths"]["/api/v1/feedback"]["post"]

    assert operation["requestBody"]["content"]["application/json"]["schema"]["$ref"] == (
        "#/components/schemas/StructuredFeedbackInput"
    )
    assert operation["responses"]["201"]["content"]["application/json"]["schema"]["$ref"] == (
        "#/components/schemas/StructuredFeedbackReceipt"
    )
