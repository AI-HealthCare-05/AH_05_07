import httpx

from app.core import config
from app.dependencies.supabase_auth import SupabaseSession
from app.dtos.placeable import PlaceableSave, PlaceableSnapshot


async def placeable_rpc(session: SupabaseSession, payload: PlaceableSave | None = None) -> PlaceableSnapshot:
    """Forward the verified user's token, never a service key or a caller-supplied owner."""
    name = "read_my_placeable" if payload is None else "save_my_placeable"
    body = (
        {}
        if payload is None
        else {
            "p_operation_id": str(payload.operation_id),
            "p_expected_revision": payload.expected_revision,
            "p_schema_version": payload.schema_version,
            "p_layout_id": payload.layout_id,
            "p_selection": payload.selection.model_dump(by_alias=True) if payload.selection else None,
        }
    )
    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.post(
            f"{config.SUPABASE_URL.rstrip('/')}/rest/v1/rpc/{name}",
            headers={"apikey": config.SUPABASE_PUBLISHABLE_KEY, "Authorization": f"Bearer {session.access_token}"},
            json=body,
        )
    response.raise_for_status()
    return PlaceableSnapshot.model_validate(response.json())
