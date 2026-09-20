"""Small product-surface checks, not a snapshot of every inherited router.

OpenAPI describes declared types; auth decisions, date-window relations and
check-in upsert behavior also need runtime tests. Remote providers are mocked.
"""

import json
from datetime import date, timedelta
from unittest.mock import AsyncMock

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.apis.v1 import observation_routers
from app.core import config
from app.dependencies import supabase_auth
from app.dependencies.supabase_auth import SupabaseSession, get_supabase_session
from app.main import app
from app.services import observation_store

PREFIX = "/api/v1"
RECORD_ID = "11111111-1111-4111-8111-111111111111"
BP_INPUT = {
    "observed_on": "2026-09-21",
    "period": "morning",
    "systolic": 120,
    "diastolic": 80,
}

# This is the submitted product surface, not the total number of application routes.
OPERATIONS = [
    ("get", "/live", "200"),
    ("get", "/ready", "200"),
    ("post", f"{PREFIX}/observations/blood-pressure", "201"),
    ("put", f"{PREFIX}/observations/blood-pressure/{{record_id}}", "200"),
    ("delete", f"{PREFIX}/observations/blood-pressure/{{record_id}}", "204"),
    ("get", f"{PREFIX}/observations/window", "200"),
    ("get", f"{PREFIX}/observations/export", "200"),
    ("post", f"{PREFIX}/observations/challenges/active", "200"),
    ("post", f"{PREFIX}/observations/challenges/active/checkins", "201"),
    ("put", f"{PREFIX}/observations/challenges/checkins/{{record_id}}", "200"),
    ("delete", f"{PREFIX}/observations/challenges/checkins/{{record_id}}", "204"),
    ("post", f"{PREFIX}/observations/challenges", "201"),
    ("delete", f"{PREFIX}/observations/challenges/{{record_id}}", "204"),
    ("post", f"{PREFIX}/risk-signal", "503"),
    ("post", f"{PREFIX}/model-v2/score", "200"),
    ("post", f"{PREFIX}/model-v2/product-score", "200"),
    ("delete", f"{PREFIX}/account", "204"),
    ("post", f"{PREFIX}/feedback", "201"),
]


def resolve_schema(schema: dict[str, object]) -> dict[str, object]:
    while "$ref" in schema:
        ref = schema["$ref"]
        assert isinstance(ref, str) and ref.startswith("#/components/schemas/")
        schema = app.openapi()["components"]["schemas"][ref.rsplit("/", 1)[-1]]
    return schema


@pytest.mark.parametrize(("method", "path", "declared_status"), OPERATIONS)
def test_product_operation_is_declared(
    method: str,
    path: str,
    declared_status: str,
) -> None:
    operation = app.openapi()["paths"][path][method]
    assert declared_status in operation["responses"]
    if declared_status == "204":
        assert "content" not in operation["responses"]["204"]


@pytest.mark.parametrize(
    ("method", "path"),
    [(method, path) for method, path, _ in OPERATIONS if "{record_id}" in path],
)
def test_record_id_is_a_required_uuid_path_parameter(method: str, path: str) -> None:
    parameters = app.openapi()["paths"][path][method]["parameters"]
    record = [parameter for parameter in parameters if parameter["name"] == "record_id"]
    assert len(record) == 1
    assert record[0]["in"] == "path"
    assert record[0]["required"] is True
    assert record[0]["schema"]["type"] == "string"
    assert record[0]["schema"]["format"] == "uuid"


@pytest.mark.parametrize(
    "path",
    [f"{PREFIX}/observations/window", f"{PREFIX}/observations/export"],
)
def test_observation_dates_are_required_query_parameters(path: str) -> None:
    parameters = app.openapi()["paths"][path]["get"]["parameters"]
    query = {parameter["name"]: parameter for parameter in parameters if parameter["in"] == "query"}
    assert set(query) == {"start_on", "end_on"}
    for parameter in query.values():
        assert parameter["required"] is True
        assert parameter["schema"]["format"] == "date"


@pytest.mark.parametrize(
    ("model", "fields"),
    [
        (
            "BloodPressureObservationInput",
            {"observed_on", "period", "systolic", "diastolic"},
        ),
        ("ActiveChallengeSelectionInput", {"action_id"}),
        ("ChallengeCheckinInput", {"observed_on", "status"}),
        ("ChallengeCheckinStatusInput", {"status"}),
        ("ChallengeEventInput", {"observed_on", "action_id", "status"}),
        ("StructuredFeedbackInput", {"surface", "response"}),
    ],
)
def test_typed_product_inputs_do_not_accept_owner_or_lifecycle_fields(
    model: str,
    fields: set[str],
) -> None:
    schema = app.openapi()["components"]["schemas"][model]
    assert set(schema["properties"]) == fields
    assert set(schema["required"]) == fields
    assert schema["additionalProperties"] is False


def test_blood_pressure_and_checkin_input_domains_are_declared() -> None:
    schemas = app.openapi()["components"]["schemas"]
    properties = schemas["BloodPressureObservationInput"]["properties"]
    assert properties["systolic"]["minimum"] == 60
    assert properties["systolic"]["maximum"] == 260
    assert properties["diastolic"]["minimum"] == 30
    assert properties["diastolic"]["maximum"] == 160
    assert set(resolve_schema(properties["period"])["enum"]) == {"morning", "evening"}
    assert set(schemas["ChallengeStatus"]["enum"]) == {"completed", "skipped"}


@pytest.mark.parametrize(
    "path",
    [f"{PREFIX}/model-v2/score", f"{PREFIX}/model-v2/product-score"],
)
def test_model_api_response_remains_two_fields(path: str) -> None:
    operation = app.openapi()["paths"][path]["post"]
    schema = resolve_schema(operation["responses"]["200"]["content"]["application/json"]["schema"])
    assert set(schema["properties"]) == {"schema_version", "product_wording"}
    assert set(schema["required"]) == {"schema_version", "product_wording"}
    assert all(field["type"] == "string" for field in schema["properties"].values())
    assert "422" in operation["responses"] and "503" in operation["responses"]


def test_feedback_receipt_excludes_raw_feedback_and_record_data() -> None:
    operation = app.openapi()["paths"][f"{PREFIX}/feedback"]["post"]
    schema = resolve_schema(operation["responses"]["201"]["content"]["application/json"]["schema"])
    assert set(schema["properties"]) == {"status", "submitted_on"}
    assert schema["properties"]["status"]["const"] == "saved"
    assert schema["properties"]["submitted_on"]["format"] == "date"


def request_arguments(method: str, path: str) -> dict[str, object]:
    if method == "get" and "/observations/" in path:
        return {"params": {"start_on": "2026-09-15", "end_on": "2026-09-21"}}
    if method == "delete":
        return {}
    if "/blood-pressure" in path:
        return {"json": BP_INPUT}
    if path.endswith("/challenges/active"):
        return {"json": {"action_id": "walk-10-minutes"}}
    if path.endswith("/challenges/active/checkins"):
        return {"json": {"observed_on": "2026-09-21", "status": "completed"}}
    if "/challenges/checkins/" in path:
        return {"json": {"status": "skipped"}}
    if path.endswith("/challenges"):
        return {
            "json": {
                "observed_on": "2026-09-21",
                "action_id": "walk-10-minutes",
                "status": "completed",
            }
        }
    if path.endswith("/feedback"):
        return {"json": {"surface": "seven_day_recap", "response": "clear"}}
    return {"json": {}}


PROTECTED_OPERATIONS = [
    (method, path) for method, path, _ in OPERATIONS if path not in {"/live", "/ready", f"{PREFIX}/risk-signal"}
]


@pytest.mark.asyncio
@pytest.mark.parametrize(("method", "path"), PROTECTED_OPERATIONS)
async def test_every_product_operation_rejects_missing_session_before_provider_io(
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    path: str,
) -> None:
    monkeypatch.setattr(config, "SUPABASE_URL", "https://supabase.invalid")
    monkeypatch.setattr(config, "SUPABASE_PUBLISHABLE_KEY", "synthetic-public-key")
    send = AsyncMock(side_effect=AssertionError("Missing credentials must not reach a provider."))
    monkeypatch.setattr(AsyncClient, "get", send)
    monkeypatch.setattr(AsyncClient, "post", send)
    monkeypatch.setattr(AsyncClient, "patch", send)
    monkeypatch.setattr(AsyncClient, "delete", send)
    # request() still reaches the in-process app; provider convenience calls are sentinels.
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.request(
            method,
            path.replace("{record_id}", RECORD_ID),
            **request_arguments(method, path),
        )

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "supabase_session_required"
    send.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "path"),
    [(method, path) for method, path, _ in OPERATIONS if "{record_id}" in path],
)
async def test_invalid_record_uuid_has_normalized_validation_response(
    method: str,
    path: str,
) -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.request(
            method,
            path.replace("{record_id}", "invalid-record-id"),
            **request_arguments(method, path),
        )
    assert response.status_code == 422
    assert response.json() == {
        "detail": {
            "code": "validation_error",
            "message": "Input values are invalid.",
        }
    }
    assert "invalid-record-id" not in response.text


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("path", "maximum_days", "error_code"),
    [
        (f"{PREFIX}/observations/window", 7, "observation_window_invalid"),
        (f"{PREFIX}/observations/export", 30, "observation_export_window_invalid"),
    ],
)
@pytest.mark.parametrize("case", ["single-day", "maximum-span", "too-wide", "reversed"])
async def test_inclusive_date_window_edges_at_http_boundary(
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    maximum_days: int,
    error_code: str,
    case: str,
) -> None:
    start = date(2026, 9, 1)
    offsets = {
        "single-day": 0,
        "maximum-span": maximum_days - 1,
        "too-wide": maximum_days,
        "reversed": -1,
    }
    end = start + timedelta(days=offsets[case])
    session = SupabaseSession(user_id=RECORD_ID, access_token="synthetic-token")
    auth = AsyncMock(return_value=session)
    window_auth = AsyncMock(return_value=session)
    records = AsyncMock(return_value=[])
    snapshot = AsyncMock(return_value={"active_challenge": None, "challenge_checkins": []})
    monkeypatch.setattr(observation_routers, "observation_session", auth)
    monkeypatch.setattr(observation_routers, "observation_window_session", window_auth)
    monkeypatch.setattr(observation_routers, "list_owned_records", records)
    monkeypatch.setattr(observation_routers, "get_owned_challenge_window", snapshot)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            path,
            params={"start_on": start.isoformat(), "end_on": end.isoformat()},
            headers={"Authorization": "Bearer synthetic-token"},
        )

    if case in {"single-day", "maximum-span"}:
        assert response.status_code == 200
        assert response.json()["start_on"] == start.isoformat()
        assert response.json()["end_on"] == end.isoformat()
        assert auth.await_count + window_auth.await_count == 1
        assert records.await_count == 2
        assert snapshot.await_count == 1
        if path.endswith("/export"):
            assert response.headers["cache-control"] == "no-store"
    else:
        assert response.status_code == 422
        assert response.json()["detail"]["code"] == error_code
        auth.assert_not_awaited()
        window_auth.assert_not_awaited()
        records.assert_not_awaited()
        snapshot.assert_not_awaited()


@pytest.mark.asyncio
async def test_legacy_risk_signal_stays_unavailable_for_valid_input() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            f"{PREFIX}/risk-signal",
            json={"sex": 1, "age_years": 35, "bmi": 23.5},
        )
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "model_not_ready"
    assert set(response.json()) == {"detail"}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("provider_status", "malformed_success", "expected_status", "expected_code"),
    [
        (401, False, 401, "supabase_session_invalid"),
        (403, False, 401, "supabase_session_invalid"),
        (429, False, 503, "auth_unavailable"),
        (500, False, 503, "auth_unavailable"),
        (200, False, 503, "auth_unavailable"),
        (200, True, 503, "auth_unavailable"),
    ],
    ids=[
        "rejected",
        "forbidden",
        "rate-limited",
        "unavailable",
        "invalid-identity",
        "invalid-json",
    ],
)
async def test_auth_rejection_is_not_confused_with_provider_unavailability(
    monkeypatch: pytest.MonkeyPatch,
    provider_status: int,
    malformed_success: bool,
    expected_status: int,
    expected_code: str,
) -> None:
    monkeypatch.setattr(config, "SUPABASE_URL", "https://supabase.invalid")
    monkeypatch.setattr(config, "SUPABASE_PUBLISHABLE_KEY", "synthetic-public-key")
    requests: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        assert request.method == "GET"
        assert request.url.path == "/auth/v1/user", "Uncertain/rejected auth must not reach product data."
        if malformed_success:
            return httpx.Response(
                provider_status,
                content="synthetic-invalid-provider-json",
            )
        return httpx.Response(
            provider_status,
            json={"unexpected": "synthetic-provider-payload"},
        )

    transport = httpx.MockTransport(handle)

    def upstream_client(*args: object, **kwargs: object) -> AsyncClient:
        return AsyncClient(*args, **kwargs, transport=transport)

    monkeypatch.setattr(supabase_auth.httpx, "AsyncClient", upstream_client)
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            f"{PREFIX}/observations/challenges/active",
            json={"action_id": "walk-10-minutes"},
            headers={"Authorization": "Bearer synthetic-token"},
        )

    assert response.status_code == expected_status
    assert response.json()["detail"]["code"] == expected_code
    assert len(requests) == 1
    assert "synthetic-provider-payload" not in response.text
    assert "synthetic-invalid-provider-json" not in response.text
    assert "synthetic-token" not in response.text
    if expected_status == 401:
        assert response.json() == {"detail": {"code": "supabase_session_invalid"}}


@pytest.mark.asyncio
async def test_checkin_post_uses_owned_upsert_request_and_retains_201(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verify the emitted PostgREST contract, not actual PostgreSQL uniqueness."""
    session = SupabaseSession(user_id=RECORD_ID, access_token="synthetic-token")
    challenge_id = "22222222-2222-4222-8222-222222222222"
    checkin_id = "33333333-3333-4333-8333-333333333333"
    monkeypatch.setattr(config, "SUPABASE_URL", "https://supabase.invalid")
    monkeypatch.setattr(config, "SUPABASE_PUBLISHABLE_KEY", "synthetic-public-key")
    monkeypatch.setattr(
        observation_routers,
        "observation_session",
        AsyncMock(return_value=session),
    )
    monkeypatch.setattr(
        observation_store,
        "get_owned_active_challenge",
        AsyncMock(
            return_value={
                "id": challenge_id,
                "action_id": "walk-10-minutes",
            }
        ),
    )
    requests: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        assert request.method == "POST"
        assert request.url.path == "/rest/v1/challenge_checkins"
        assert request.headers["authorization"] == "Bearer synthetic-token"
        assert request.headers["prefer"] == ("resolution=merge-duplicates,return=representation")
        assert request.url.params["on_conflict"] == ("user_id,challenge_id,observed_on")
        values = json.loads(request.content)
        assert set(values) == {
            "challenge_id",
            "action_id",
            "user_id",
            "observed_on",
            "status",
        }
        assert values["user_id"] == session.user_id
        assert values["challenge_id"] == challenge_id
        assert values["action_id"] == "walk-10-minutes"
        return httpx.Response(201, json=[{"id": checkin_id, **values}])

    transport = httpx.MockTransport(handle)

    def upstream_client(*args: object, **kwargs: object) -> AsyncClient:
        return AsyncClient(*args, **kwargs, transport=transport)

    monkeypatch.setattr(observation_store.httpx, "AsyncClient", upstream_client)
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        for checkin_status in ("completed", "skipped"):
            response = await client.post(
                f"{PREFIX}/observations/challenges/active/checkins",
                json={"observed_on": "2026-09-21", "status": checkin_status},
                headers={"Authorization": "Bearer synthetic-token"},
            )
            assert response.status_code == 201
            assert response.json()["id"] == checkin_id
            assert response.json()["status"] == checkin_status

    assert len(requests) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "path",
    [f"{PREFIX}/model-v2/score", f"{PREFIX}/model-v2/product-score"],
)
@pytest.mark.parametrize("body", ["[]", '{"unfinished":'])
async def test_model_request_shape_errors_use_generic_validation_and_no_store(
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    body: str,
) -> None:
    async def synthetic_session() -> SupabaseSession:
        return SupabaseSession(user_id=RECORD_ID, access_token="synthetic-token")

    monkeypatch.setitem(
        app.dependency_overrides,
        get_supabase_session,
        synthetic_session,
    )
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            path,
            content=body,
            headers={"Content-Type": "application/json"},
        )

    assert response.status_code == 422
    assert response.json() == {
        "detail": {
            "code": "validation_error",
            "message": "Input values are invalid.",
        }
    }
    assert response.headers["cache-control"] == "no-store"
    assert "unfinished" not in response.text
