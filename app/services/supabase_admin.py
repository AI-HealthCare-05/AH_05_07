from uuid import UUID

import httpx

from app.core import config


class SupabaseAdminNotConfiguredError(Exception):
    pass


class SupabaseAdminRequestError(Exception):
    def __init__(self, category: str) -> None:
        super().__init__(category)
        self.category = category


async def delete_auth_user(user_id: str) -> None:
    """Hard-delete exactly the Auth user identified by the validated session."""
    if not config.SUPABASE_URL or not config.SUPABASE_SECRET_KEY:
        raise SupabaseAdminNotConfiguredError
    try:
        target_id = UUID(user_id)
    except ValueError as error:
        raise SupabaseAdminRequestError("invalid_identity") from error

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.delete(
                f"{config.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users/{target_id}",
                headers={
                    "apikey": config.SUPABASE_SECRET_KEY,
                    "Authorization": f"Bearer {config.SUPABASE_SECRET_KEY}",
                },
            )
    except httpx.TimeoutException as error:
        raise SupabaseAdminRequestError("timeout") from error
    except httpx.HTTPError as error:
        raise SupabaseAdminRequestError("transport") from error

    if response.status_code not in (200, 204):
        raise SupabaseAdminRequestError("upstream")
