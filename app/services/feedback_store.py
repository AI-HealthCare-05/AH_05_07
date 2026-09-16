import httpx

from app.core import config
from app.dependencies.supabase_auth import SupabaseSession


async def create_owned_feedback(
    surface: str,
    response_value: str,
    session: SupabaseSession,
) -> dict[str, object]:
    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.post(
            f"{config.SUPABASE_URL}/rest/v1/structured_feedback",
            headers={
                "apikey": config.SUPABASE_PUBLISHABLE_KEY,
                "Authorization": f"Bearer {session.access_token}",
                "Prefer": "return=representation",
            },
            params={"select": "id,surface,response,submitted_on,created_at,expires_at"},
            json={
                "user_id": session.user_id,
                "surface": surface,
                "response": response_value,
            },
        )
    response.raise_for_status()
    return response.json()[0]
