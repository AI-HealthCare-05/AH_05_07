"""Offline migration contracts. Live PostgreSQL behavior is covered by the companion pgTAP file."""

from pathlib import Path

SQL = (Path(__file__).parents[2] / "supabase/migrations/20260927050000_my_first_placeable.sql").read_text().lower()


def test_snapshot_owner_cascade_and_restricted_direct_writes():
    assert "user_id uuid primary key references auth.users(id) on delete cascade" in SQL
    assert "enable row level security" in SQL
    assert "using ((select auth.uid()) = user_id)" in SQL
    assert "revoke all on public.placeable_snapshots from public, anon, authenticated, service_role" in SQL
    assert "grant select on public.placeable_snapshots to authenticated" in SQL
    assert "grant insert" not in SQL and "grant update" not in SQL and "grant delete" not in SQL


def test_atomic_save_serializes_first_write_and_owner_deletion():
    save = SQL.split("create function public.save_my_placeable", 1)[1]
    assert "security definer set search_path = ''" in save
    assert "owner_id uuid := auth.uid()" in save
    lock = save.index("from auth.users where id = owner_id for update")
    missing = save.index("if not found then raise sqlstate 'pt410'")
    revision = save.index("coalesce(previous.revision, 0) <> p_expected_revision")
    write = save.index("insert into public.placeable_snapshots")
    assert lock < missing < revision < write
    assert "insert into auth.users" not in save
    assert "revision = excluded.revision" in save and "latest_fingerprint = excluded.latest_fingerprint" in save
    assert "p_expected_revision + 1" in save


def test_latest_receipt_is_fingerprinted_and_unknown_state_cannot_be_overwritten():
    assert "previous.latest_operation_id = p_operation_id" in SQL
    assert "previous.latest_fingerprint = fingerprint" in SQL
    assert "pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(" in SQL
    assert "previous.schema_version <> 'placeable.v1'" in SQL
    assert "not public.placeable_selection_supported(previous.selection)" in SQL
    assert "p_owner" not in SQL
    assert SQL.count("create table") == 1


def test_future_scalar_selection_is_rejected_without_object_operator_error():
    helper = SQL.split("create function public.placeable_selection_supported", 1)[1].split("$$;", 1)[0]
    assert "when jsonb_typeof(value) <> 'object' then false" in helper
    assert helper.index("when jsonb_typeof(value)") < helper.index("value - array")


def test_rpc_grants_and_safe_integer_bounds():
    assert "revision between 1 and 9007199254740991" in SQL
    assert "p_expected_revision > 9007199254740990" in SQL
    for signature in ("read_my_placeable()", "save_my_placeable(uuid, bigint, text, text, jsonb)"):
        assert f"revoke all on function public.{signature} from public, anon, service_role" in SQL
        assert f"grant execute on function public.{signature} to authenticated" in SQL
    assert "set search_path = ''" in SQL


def test_keepsake_evolves_same_row_and_blocks_downgrade():
    root = Path(__file__).parents[2]
    sql = next((root / "supabase/migrations").glob("*_my_first_keepsake.sql")).read_text().lower()
    assert "create table" not in sql
    assert "create or replace function public.save_my_placeable" in sql
    assert "from auth.users where id = owner_id for update" in sql
    assert "previous.schema_version = 'placeable.v2' and p_schema_version <> 'placeable.v2'" in sql
    assert (
        "not public.placeable_snapshot_supported(previous.schema_version, previous.layout_id, previous.selection)"
        in sql
    )
    assert "value ?& array['pinwheel', 'keepsake']" in sql
    assert "value - array['pinwheel', 'keepsake'] = '{}'::jsonb" in sql
    assert "p_expected_revision + 1" in sql
    assert "previous.latest_fingerprint = fingerprint" in sql
