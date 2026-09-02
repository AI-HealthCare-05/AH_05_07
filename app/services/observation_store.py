from datetime import date

import httpx

from app.core import config
from app.dependencies.supabase_auth import SupabaseSession


async def insert_owned_record(table: str, values: dict[str, object], session: SupabaseSession) -> dict[str, object]:
    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.post(
            f"{config.SUPABASE_URL}/rest/v1/{table}",
            headers={
                "apikey": config.SUPABASE_PUBLISHABLE_KEY,
                "Authorization": f"Bearer {session.access_token}",
                "Prefer": "return=representation",
            },
            json={**values, "user_id": session.user_id},
        )
    response.raise_for_status()
    return response.json()[0]


async def list_owned_records(
    table: str,
    select: str,
    start_on: date,
    end_on: date,
    session: SupabaseSession,
) -> list[dict[str, object]]:
    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.get(
            f"{config.SUPABASE_URL}/rest/v1/{table}",
            headers={
                "apikey": config.SUPABASE_PUBLISHABLE_KEY,
                "Authorization": f"Bearer {session.access_token}",
            },
            params=[
                ("select", select),
                ("observed_on", f"gte.{start_on.isoformat()}"),
                ("observed_on", f"lte.{end_on.isoformat()}"),
                ("order", "observed_on.asc,created_at.asc"),
            ],
        )
    response.raise_for_status()
    return response.json()
