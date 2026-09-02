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
