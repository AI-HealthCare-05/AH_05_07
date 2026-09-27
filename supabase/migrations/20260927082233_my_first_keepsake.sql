-- E4 evolves the existing row/RPC. No rewrite/backfill: v1 remains readable and
-- writable until an explicit v2 save. Revision and latest receipt stay continuous.
create function public.placeable_snapshot_supported(schema_version text, layout_id text, value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(case
    when schema_version = 'placeable.v1' and layout_id = 'e1-plaza.v1'
      then public.placeable_selection_supported(value)
    when schema_version = 'placeable.v2' and layout_id = 'e1-plaza.v2' then
      case when jsonb_typeof(value) <> 'object' then false else
        value ?& array['pinwheel', 'keepsake']
        and value - array['pinwheel', 'keepsake'] = '{}'::jsonb
        and public.placeable_selection_supported(nullif(value->'pinwheel', 'null'::jsonb))
        and (value->'keepsake' = 'null'::jsonb
          or (jsonb_typeof(value->'keepsake') = 'string'
            and value->>'keepsake' in ('plaza-ribbon-v1', 'quiet-moon-v1', 'garden-leaf-v1')))
      end
    else false end, false);
$$;
revoke all on function public.placeable_snapshot_supported(text, text, jsonb) from public, anon, authenticated, service_role;

create or replace function public.save_my_placeable(
  p_operation_id uuid, p_expected_revision bigint, p_schema_version text,
  p_layout_id text, p_selection jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  previous public.placeable_snapshots%rowtype;
  fingerprint text;
  pinwheel jsonb;
begin
  if owner_id is null then raise sqlstate 'PT401' using message = 'session_required'; end if;
  -- Serialize first writes as well as subsequent writes, and serialize with Auth deletion.
  -- A save cannot create an Auth owner. A deletion after this lock cascades the row away.
  perform 1 from auth.users where id = owner_id for update;
  if not found then raise sqlstate 'PT410' using message = 'owner_deleted'; end if;

  if p_operation_id is null or p_expected_revision is null
    or p_expected_revision < 0 or p_expected_revision > 9007199254740990
    or not public.placeable_snapshot_supported(p_schema_version, p_layout_id, p_selection) then
    raise sqlstate 'PT422' using message = 'unsupported_snapshot';
  end if;
  -- PostgreSQL 17 (supabase/config.toml) provides pg_catalog.sha256(bytea).
  -- No pgcrypto extension/search_path dependency. Validated enums contain no '|'
  -- or '-' sentinel, so fixed-order UTF-8 fields are unambiguous and key-order independent.
  pinwheel := case when p_schema_version = 'placeable.v2' then nullif(p_selection->'pinwheel', 'null'::jsonb) else p_selection end;
  fingerprint := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    p_expected_revision::text || '|' || p_schema_version || '|' || p_layout_id || '|'
    || coalesce(pinwheel->>'assetId', '-') || '|'
    || coalesce(pinwheel->>'color', '-') || '|' || coalesce(pinwheel->>'socketId', '-')
    || case when p_schema_version = 'placeable.v2' then '|' || coalesce(p_selection->>'keepsake', '-') else '' end, 'UTF8')), 'hex');

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
    not public.placeable_snapshot_supported(previous.schema_version, previous.layout_id, previous.selection)
    or (previous.schema_version = 'placeable.v2' and p_schema_version <> 'placeable.v2')
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

