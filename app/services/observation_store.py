from datetime import date, timedelta
from uuid import UUID

import httpx

from app.core import config
from app.dependencies.supabase_auth import SupabaseSession


class ActiveChallengeMissingError(Exception):
    pass


class OwnedRecordMissingError(Exception):
    pass


class ChallengeSelectionLockedError(Exception):
    pass


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


async def update_owned_record(
    table: str,
    record_id: str,
    values: dict[str, object],
    session: SupabaseSession,
) -> dict[str, object]:
    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.patch(
            f"{config.SUPABASE_URL}/rest/v1/{table}",
            headers={
                "apikey": config.SUPABASE_PUBLISHABLE_KEY,
                "Authorization": f"Bearer {session.access_token}",
                "Prefer": "return=representation",
            },
            params={"id": f"eq.{record_id}"},
            json={**values, "user_id": session.user_id},
        )
    response.raise_for_status()
    records = response.json()
    if not records:
        raise OwnedRecordMissingError
    return records[0]


async def upsert_owned_record(
    table: str,
    values: dict[str, object],
    on_conflict: str,
    session: SupabaseSession,
) -> dict[str, object]:
    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.post(
            f"{config.SUPABASE_URL}/rest/v1/{table}",
            headers={
                "apikey": config.SUPABASE_PUBLISHABLE_KEY,
                "Authorization": f"Bearer {session.access_token}",
                "Prefer": "resolution=merge-duplicates,return=representation",
            },
            params={"on_conflict": on_conflict},
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


async def delete_owned_record(table: str, record_id: UUID, session: SupabaseSession) -> bool:
    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.delete(
            f"{config.SUPABASE_URL}/rest/v1/{table}",
            headers={
                "apikey": config.SUPABASE_PUBLISHABLE_KEY,
                "Authorization": f"Bearer {session.access_token}",
                "Prefer": "return=representation",
            },
            params={"id": f"eq.{record_id}"},
        )
    response.raise_for_status()
    return bool(response.json())


async def get_owned_active_challenge(session: SupabaseSession) -> dict[str, object] | None:
    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.get(
            f"{config.SUPABASE_URL}/rest/v1/active_challenges",
            headers={
                "apikey": config.SUPABASE_PUBLISHABLE_KEY,
                "Authorization": f"Bearer {session.access_token}",
            },
            params=[
                ("select", "id,action_id,starts_on,ends_on,first_checkin_on,status,created_at,expires_at"),
                ("status", "eq.active"),
                ("order", "starts_on.desc"),
                ("limit", "1"),
            ],
        )
    response.raise_for_status()
    records = response.json()
    return records[0] if records else None


async def select_owned_active_challenge(
    action_id: str,
    starts_on: date,
    session: SupabaseSession,
) -> dict[str, object]:
    active_challenge = await get_owned_active_challenge(session)
    if active_challenge:
        ends_on = date.fromisoformat(str(active_challenge["ends_on"]))
        if starts_on <= ends_on:
            if active_challenge["action_id"] == action_id:
                return active_challenge
            if active_challenge["first_checkin_on"] is not None:
                raise ChallengeSelectionLockedError
            try:
                return await update_owned_record(
                    "active_challenges", str(active_challenge["id"]), {"action_id": action_id}, session
                )
            except OwnedRecordMissingError as error:
                raise ActiveChallengeMissingError from error

        try:
            await update_owned_record("active_challenges", str(active_challenge["id"]), {"status": "closed"}, session)
        except OwnedRecordMissingError as error:
            raise ActiveChallengeMissingError from error

    return await insert_owned_record(
        "active_challenges",
        {
            "action_id": action_id,
            "starts_on": starts_on.isoformat(),
            "ends_on": (starts_on + timedelta(days=6)).isoformat(),
        },
        session,
    )


async def create_owned_challenge_checkin(
    observed_on: date,
    status: str,
    session: SupabaseSession,
) -> dict[str, object]:
    active_challenge = await get_owned_active_challenge(session)
    if not active_challenge:
        raise ActiveChallengeMissingError
    return await upsert_owned_record(
        "challenge_checkins",
        {
            "challenge_id": active_challenge["id"],
            "action_id": active_challenge["action_id"],
            "observed_on": observed_on.isoformat(),
            "status": status,
        },
        "user_id,challenge_id,observed_on",
        session,
    )
