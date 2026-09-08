from pathlib import Path

MIGRATIONS = Path(__file__).parents[2] / "supabase" / "migrations"


def test_account_removal_uses_existing_auth_cascade_contract_without_migration():
    lifecycle = (MIGRATIONS / "20260902020059_create_observation_lifecycle.sql").read_text(encoding="utf-8").lower()
    challenge = (MIGRATIONS / "20260902142005_active_seven_day_challenges.sql").read_text(encoding="utf-8").lower()

    assert lifecycle.count("references auth.users(id) on delete cascade") >= 2
    assert "references public.active_challenges(id, user_id)" in challenge
    assert "user_id uuid not null references auth.users(id) on delete cascade" in challenge


def test_same_email_is_not_an_account_owner_key():
    account_router = (Path(__file__).parents[2] / "app" / "apis" / "v1" / "account_routers.py").read_text(
        encoding="utf-8"
    )
    admin_service = (Path(__file__).parents[2] / "app" / "services" / "supabase_admin.py").read_text(encoding="utf-8")

    assert "email" not in account_router.lower()
    assert "user_id" in admin_service
    assert "SUPABASE_SECRET_KEY" in admin_service
