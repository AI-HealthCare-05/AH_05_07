import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from pydantic import ValidationError

from app.core import config
from app.dependencies.supabase_auth import SupabaseSession, get_supabase_session
from app.dtos.placeable import PlaceableSave, PlaceableSnapshot
from app.main import app
from app.services.placeable_store import placeable_rpc

OWNER = "10101010-1010-4010-8010-101010101010"
PAYLOAD = {
    "operationId": "30303030-3030-4030-8030-303030303030",
    "expectedRevision": 0,
    "schemaVersion": "placeable.v1",
    "layoutId": "e1-plaza.v1",
    "selection": {"assetId": "welcome-pinwheel-v1", "color": "coral", "socketId": "gate-left"},
}
SNAPSHOT = {
    "revision": 1,
    "schemaVersion": "placeable.v1",
    "layoutId": "e1-plaza.v1",
    "selection": PAYLOAD["selection"],
    "latestOperationId": PAYLOAD["operationId"],
    "latestFingerprint": "a" * 64,
}


@pytest.fixture
def session():
    verified = SupabaseSession(OWNER, "synthetic-verified-token")

    async def verified_session():
        return verified

    app.dependency_overrides[get_supabase_session] = verified_session
    yield verified
    app.dependency_overrides.pop(get_supabase_session, None)


@pytest.mark.asyncio
async def test_cosmetic_read_and_save_use_verified_session_and_no_store(session):
    with patch(
        "app.apis.v1.placeable_routers.placeable_rpc", AsyncMock(return_value=PlaceableSnapshot(**SNAPSHOT))
    ) as rpc:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            saved = await client.put("/api/v1/cosmetics/placeable", json=PAYLOAD)
            read = await client.get("/api/v1/cosmetics/placeable")
    assert saved.status_code == read.status_code == 200
    assert saved.json() == read.json() == SNAPSHOT
    assert saved.headers["cache-control"] == read.headers["cache-control"] == "no-store"
    assert rpc.call_args_list[0].args == (session, PlaceableSave(**PAYLOAD))
    assert rpc.call_args_list[1].args == (session, None)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "change",
    [
        {"user_id": OWNER},
        {"expectedRevision": -1},
        {"expectedRevision": True},
        {"expectedRevision": 1.0},
        {"expectedRevision": "1"},
        {"expectedRevision": 9007199254740991},
        {"schemaVersion": "future"},
        {"layoutId": "future"},
        {"operationId": "not-a-uuid"},
        {"selection": {"assetId": "other", "color": "coral", "socketId": "gate-left"}},
        {"selection": {"assetId": "welcome-pinwheel-v1", "color": "blue", "socketId": "gate-left"}},
        {"selection": {"assetId": "welcome-pinwheel-v1", "color": "teal", "socketId": "unsafe"}},
        {"selection": PAYLOAD["selection"] | {"owner": OWNER}},
        {"selection": []},
    ],
)
async def test_closed_cosmetic_write_contract(session, change):
    with patch("app.apis.v1.placeable_routers.placeable_rpc", AsyncMock()) as rpc:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            response = await client.put("/api/v1/cosmetics/placeable", json=PAYLOAD | change)
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"
    assert OWNER not in response.text
    rpc.assert_not_awaited()


@pytest.mark.asyncio
async def test_missing_session_cannot_read_or_write(monkeypatch):
    monkeypatch.setattr(config, "SUPABASE_URL", "https://synthetic.invalid")
    monkeypatch.setattr(config, "SUPABASE_PUBLISHABLE_KEY", "synthetic")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/api/v1/cosmetics/placeable")).status_code == 401
        assert (await client.put("/api/v1/cosmetics/placeable", json=PAYLOAD)).status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "status,expected",
    [
        (401, "session_invalid"),
        (403, "session_invalid"),
        (409, "revision_conflict"),
        (409, "operation_changed"),
        (410, "owner_deleted"),
        (422, "unsupported_snapshot"),
        (503, "save_unknown"),
    ],
)
async def test_no_uncertain_write_is_reported_saved(session, status, expected):
    request = httpx.Request("POST", "https://synthetic.invalid/rpc")
    error = httpx.HTTPStatusError(
        "synthetic",
        request=request,
        response=httpx.Response(
            status,
            request=request,
            json={"code": f"PT{status}", "message": expected, "details": "private upstream payload"},
        ),
    )
    with patch("app.apis.v1.placeable_routers.placeable_rpc", AsyncMock(side_effect=error)):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            response = await client.put("/api/v1/cosmetics/placeable", json=PAYLOAD)
    assert response.status_code == status
    assert response.json()["detail"]["code"] == expected
    assert "private" not in response.text
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
@pytest.mark.parametrize("saving", [False, True])
async def test_store_forwards_user_bearer_to_atomic_rpc_without_owner_or_secret(session, monkeypatch, saving):
    monkeypatch.setattr(config, "SUPABASE_URL", "https://synthetic.invalid")
    monkeypatch.setattr(config, "SUPABASE_PUBLISHABLE_KEY", "synthetic-public")
    monkeypatch.setattr(config, "SUPABASE_SECRET_KEY", "synthetic-secret-must-not-be-used")
    real_client = httpx.AsyncClient

    def handle(request):
        assert request.url.path == f"/rest/v1/rpc/{'save' if saving else 'read'}_my_placeable"
        assert request.headers["authorization"] == "Bearer synthetic-verified-token"
        assert request.headers["apikey"] == "synthetic-public"
        body = json.loads(request.content)
        assert body == (
            {
                "p_operation_id": PAYLOAD["operationId"],
                "p_expected_revision": 0,
                "p_schema_version": "placeable.v1",
                "p_layout_id": "e1-plaza.v1",
                "p_selection": PAYLOAD["selection"],
            }
            if saving
            else {}
        )
        return httpx.Response(200, json=SNAPSHOT)

    with patch(
        "app.services.placeable_store.httpx.AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handle), **kwargs),
    ):
        assert (await placeable_rpc(session, PlaceableSave(**PAYLOAD) if saving else None)).revision == 1


@pytest.mark.parametrize("selection", [None, {"assetId": "future", "extra": [1]}, ["future"], "future", 42, True])
def test_unknown_read_state_is_preserved(selection):
    future = SNAPSHOT | {"schemaVersion": "future", "layoutId": "future", "selection": selection}
    assert PlaceableSnapshot(**future).model_dump(mode="json", by_alias=True) == future


@pytest.mark.parametrize("revision", [True, 1.0, "1", -1, 9007199254740992])
def test_snapshot_revision_is_strict_safe_integer(revision):
    with pytest.raises(ValidationError):
        PlaceableSnapshot(**(SNAPSHOT | {"revision": revision}))


def test_dtos_require_explicit_selection_and_forbid_snapshot_extras():
    with pytest.raises(ValidationError):
        PlaceableSave(**{key: value for key, value in PAYLOAD.items() if key != "selection"})
    with pytest.raises(ValidationError):
        PlaceableSnapshot(**(SNAPSHOT | {"owner": OWNER}))
    assert PlaceableSave(**(PAYLOAD | {"selection": None})).selection is None
    assert PlaceableSave(**(PAYLOAD | {"expectedRevision": 9007199254740990})).expected_revision == 9007199254740990
    assert PlaceableSnapshot(**(SNAPSHOT | {"revision": 9007199254740991})).revision == 9007199254740991


@pytest.mark.asyncio
@pytest.mark.parametrize("method", ["get", "put"])
@pytest.mark.parametrize(
    "failure", ["timeout", "transport", "response_loss", "json", "shape", "revision", "502", "409"]
)
async def test_transport_and_unrecognized_responses_stay_unknown_without_retry(session, monkeypatch, method, failure):
    monkeypatch.setattr(config, "SUPABASE_URL", "https://synthetic.invalid")
    monkeypatch.setattr(config, "SUPABASE_PUBLISHABLE_KEY", "synthetic-public")
    real_client = httpx.AsyncClient
    calls = []

    def handle(request):
        calls.append(request)
        if failure == "timeout":
            raise httpx.ReadTimeout("synthetic timeout", request=request)
        if failure == "transport":
            raise httpx.ConnectError("synthetic transport", request=request)
        if failure == "response_loss":
            # The DB may have committed before the connection drops.
            raise httpx.RemoteProtocolError("synthetic response loss", request=request)
        if failure == "json":
            return httpx.Response(200, content=b"truncated")
        if failure == "shape":
            return httpx.Response(200, json={})
        if failure == "revision":
            return httpx.Response(200, json=SNAPSHOT | {"revision": True})
        return httpx.Response(int(failure), json={"message": "private upstream payload"})

    async with real_client(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        with patch(
            "app.services.placeable_store.httpx.AsyncClient",
            lambda **kwargs: real_client(transport=httpx.MockTransport(handle), **kwargs),
        ):
            response = await client.request(
                method, "/api/v1/cosmetics/placeable", **({"json": PAYLOAD} if method == "put" else {})
            )
    assert response.status_code == 503
    assert response.json() == {"detail": {"code": "save_unknown" if method == "put" else "read_unavailable"}}
    assert response.headers["cache-control"] == "no-store"
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_unplaced_save_and_future_read_roundtrip(session, monkeypatch):
    monkeypatch.setattr(config, "SUPABASE_URL", "https://synthetic.invalid")
    monkeypatch.setattr(config, "SUPABASE_PUBLISHABLE_KEY", "synthetic-public")
    real_client = httpx.AsyncClient
    future = SNAPSHOT | {"schemaVersion": "future", "layoutId": "future", "selection": ["unknown", {"x": 1}]}

    def handle(request):
        if request.url.path.endswith("save_my_placeable"):
            assert json.loads(request.content)["p_selection"] is None
            return httpx.Response(200, json=SNAPSHOT | {"selection": None})
        return httpx.Response(200, json=future)

    async with real_client(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        with patch(
            "app.services.placeable_store.httpx.AsyncClient",
            lambda **kwargs: real_client(transport=httpx.MockTransport(handle), **kwargs),
        ):
            saved = await client.put("/api/v1/cosmetics/placeable", json=PAYLOAD | {"selection": None})
            read = await client.get("/api/v1/cosmetics/placeable")
    assert saved.status_code == read.status_code == 200
    assert saved.json()["selection"] is None
    assert read.json() == future


@pytest.mark.parametrize("keepsake", [None, "plaza-ribbon-v1", "quiet-moon-v1", "garden-leaf-v1"])
@pytest.mark.parametrize("pinwheel", [None, PAYLOAD["selection"]])
async def test_v2_layout_roundtrip_uses_same_verified_rpc(session, monkeypatch, keepsake, pinwheel):
    monkeypatch.setattr(config, "SUPABASE_URL", "https://synthetic.invalid")
    monkeypatch.setattr(config, "SUPABASE_PUBLISHABLE_KEY", "synthetic-public")
    payload = PAYLOAD | {
        "expectedRevision": 9,
        "schemaVersion": "placeable.v2",
        "layoutId": "e1-plaza.v2",
        "selection": {"pinwheel": pinwheel, "keepsake": keepsake},
    }
    snapshot = SNAPSHOT | {key: payload[key] for key in ("schemaVersion", "layoutId", "selection")} | {"revision": 10}
    real_client = httpx.AsyncClient

    def handle(request):
        assert request.headers["authorization"] == "Bearer synthetic-verified-token"
        assert request.url.path == "/rest/v1/rpc/save_my_placeable"
        assert json.loads(request.content)["p_selection"] == payload["selection"]
        assert json.loads(request.content)["p_expected_revision"] == 9
        return httpx.Response(200, json=snapshot)

    async with real_client(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        with patch(
            "app.services.placeable_store.httpx.AsyncClient",
            lambda **kwargs: real_client(transport=httpx.MockTransport(handle), **kwargs),
        ):
            response = await client.put("/api/v1/cosmetics/placeable", json=payload)
    assert response.status_code == 200
    assert response.json() == snapshot


@pytest.mark.parametrize(
    "selection",
    [
        None,
        {},
        {"pinwheel": None},
        {"pinwheel": None, "keepsake": "walk-10-minutes"},
        {"pinwheel": None, "keepsake": "future"},
        {"pinwheel": None, "keepsake": "__proto__"},
        {"pinwheel": None, "keepsake": {"assetId": "quiet-moon-v1"}},
        {"pinwheel": None, "keepsake": "quiet-moon-v1", "completed": True},
        {"pinwheel": PAYLOAD["selection"] | {"color": "future"}, "keepsake": None},
    ],
)
def test_v2_closed_layout_rejects_forged_and_domain_payloads(selection):
    with pytest.raises(ValidationError):
        PlaceableSave(
            **(PAYLOAD | {"schemaVersion": "placeable.v2", "layoutId": "e1-plaza.v2", "selection": selection})
        )


@pytest.mark.parametrize("schema,layout", [("placeable.v1", "e1-plaza.v2"), ("placeable.v2", "e1-plaza.v1")])
def test_versions_cannot_be_mixed(schema, layout):
    with pytest.raises(ValidationError):
        PlaceableSave(**(PAYLOAD | {"schemaVersion": schema, "layoutId": layout}))
