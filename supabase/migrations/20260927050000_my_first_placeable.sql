-- Cosmetic preferences have account lifetime, not the health-record retention period.
-- Only the latest operation is retained. This is not a historical receipt ledger.
create table public.placeable_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision between 1 and 9007199254740991),
  schema_version text not null,
  layout_id text not null,
  selection jsonb,
  latest_operation_id uuid not null,
  latest_fingerprint text not null
);

alter table public.placeable_snapshots enable row level security;
create policy "Read own cosmetic snapshot" on public.placeable_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.placeable_snapshots from public, anon, authenticated, service_role;
grant select on public.placeable_snapshots to authenticated;

create function public.placeable_selection_supported(value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  -- CASE avoids applying object-only operators to future scalar/array state.
  select case
    when value is null then true
    when jsonb_typeof(value) <> 'object' then false
    else coalesce(
    value->>'assetId' = 'welcome-pinwheel-v1'
    and value->>'color' in ('coral', 'teal', 'sunflower')
    and value->>'socketId' in ('gate-left', 'gate-right', 'plaza-edge')
    and value - array['assetId', 'color', 'socketId'] = '{}'::jsonb,
    false
  ) end;
$$;

create function public.read_my_placeable()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); result jsonb;
begin
  if owner_id is null then raise sqlstate 'PT401' using message = 'session_required'; end if;
  if not exists(select 1 from auth.users where id = owner_id) then
    raise sqlstate 'PT410' using message = 'owner_deleted';
  end if;
  select jsonb_build_object(
    'revision', revision, 'schemaVersion', schema_version, 'layoutId', layout_id,
    'selection', selection, 'latestOperationId', latest_operation_id, 'latestFingerprint', latest_fingerprint
  ) into result from public.placeable_snapshots where user_id = owner_id;
  return coalesce(result, jsonb_build_object(
    'revision', 0, 'schemaVersion', 'placeable.v1', 'layoutId', 'e1-plaza.v1',
    'selection', null, 'latestOperationId', null, 'latestFingerprint', null
  ));
end;
$$;

create function public.save_my_placeable(
  p_operation_id uuid, p_expected_revision bigint, p_schema_version text,
  p_layout_id text, p_selection jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  previous public.placeable_snapshots%rowtype;
  fingerprint text;
begin
  if owner_id is null then raise sqlstate 'PT401' using message = 'session_required'; end if;
  -- Serialize first writes as well as subsequent writes, and serialize with Auth deletion.
  -- A save cannot create an Auth owner. A deletion after this lock cascades the row away.
  perform 1 from auth.users where id = owner_id for update;
  if not found then raise sqlstate 'PT410' using message = 'owner_deleted'; end if;

  if p_operation_id is null or p_expected_revision is null
    or p_expected_revision < 0 or p_expected_revision > 9007199254740990
    or p_schema_version is distinct from 'placeable.v1' or p_layout_id is distinct from 'e1-plaza.v1'
    or not public.placeable_selection_supported(p_selection) then
    raise sqlstate 'PT422' using message = 'unsupported_snapshot';
  end if;
  -- PostgreSQL 17 (supabase/config.toml) provides pg_catalog.sha256(bytea).
  -- No pgcrypto extension/search_path dependency. Validated enums contain no '|'
  -- or '-' sentinel, so fixed-order UTF-8 fields are unambiguous and key-order independent.
  fingerprint := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    p_expected_revision::text || '|' || p_schema_version || '|' || p_layout_id || '|'
    || coalesce(p_selection->>'assetId', '-') || '|'
    || coalesce(p_selection->>'color', '-') || '|' || coalesce(p_selection->>'socketId', '-'), 'UTF8')), 'hex');

  select * into previous from public.placeable_snapshots where user_id = owner_id;
  if previous.latest_operation_id = p_operation_id then
    if previous.latest_fingerprint = fingerprint then return public.read_my_placeable(); end if;
    raise sqlstate 'PT409' using message = 'operation_changed';
  end if;
  if coalesce(previous.revision, 0) <> p_expected_revision then
    raise sqlstate 'PT409' using message = 'revision_conflict';
  end if;
  -- Future or unrecognized state is readable but cannot be erased by this older client.
  if previous.revision is not null and (
    previous.schema_version <> 'placeable.v1' or previous.layout_id <> 'e1-plaza.v1'
    or not public.placeable_selection_supported(previous.selection)
  ) then raise sqlstate 'PT422' using message = 'unsupported_snapshot'; end if;

  insert into public.placeable_snapshots (
    user_id, revision, schema_version, layout_id, selection, latest_operation_id, latest_fingerprint
  ) values (owner_id, p_expected_revision + 1, p_schema_version, p_layout_id, p_selection, p_operation_id, fingerprint)
  on conflict (user_id) do update set
    revision = excluded.revision, schema_version = excluded.schema_version, layout_id = excluded.layout_id,
    selection = excluded.selection, latest_operation_id = excluded.latest_operation_id,
    latest_fingerprint = excluded.latest_fingerprint;
  return public.read_my_placeable();
end;
$$;

revoke all on function public.placeable_selection_supported(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.read_my_placeable() from public, anon, service_role;
revoke all on function public.save_my_placeable(uuid, bigint, text, text, jsonb) from public, anon, service_role;
grant execute on function public.read_my_placeable() to authenticated;
grant execute on function public.save_my_placeable(uuid, bigint, text, text, jsonb) to authenticated;
