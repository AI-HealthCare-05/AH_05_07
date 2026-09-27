-- Synthetic only; transaction rolls back. Run on LOCAL/non-production PostgreSQL with pgTAP.
begin;
select plan(14);
insert into auth.users(id) values
  ('10101010-1010-4010-8010-101010101010'), ('20202020-2020-4020-8020-202020202020');
select ok(not has_table_privilege('authenticated', 'public.placeable_snapshots', 'INSERT'), 'no direct insert');
select ok(not has_table_privilege('authenticated', 'public.placeable_snapshots', 'UPDATE'), 'no direct update');
select ok(not has_table_privilege('authenticated', 'public.placeable_snapshots', 'DELETE'), 'no direct delete');
select ok(not has_table_privilege('service_role', 'public.placeable_snapshots', 'INSERT'), 'service role cannot bypass save');
select ok(not has_function_privilege('anon', 'public.save_my_placeable(uuid,bigint,text,text,jsonb)', 'EXECUTE'), 'anonymous save denied');
set local role authenticated;
select set_config('request.jwt.claim.sub', '10101010-1010-4010-8010-101010101010', true);
select is(public.read_my_placeable()->>'revision', '0', 'read does not persist defaults');
select is((public.save_my_placeable('30303030-3030-4030-8030-303030303030', 0, 'placeable.v1', 'e1-plaza.v1',
  '{"assetId":"welcome-pinwheel-v1","color":"coral","socketId":"gate-left"}'))->>'revision', '1', 'first save');
select is((public.save_my_placeable('30303030-3030-4030-8030-303030303030', 0, 'placeable.v1', 'e1-plaza.v1',
  '{"assetId":"welcome-pinwheel-v1","color":"coral","socketId":"gate-left"}'))->>'revision', '1', 'same immutable operation is idempotent');
select throws_ok($$select public.save_my_placeable('30303030-3030-4030-8030-303030303030', 0, 'placeable.v1', 'e1-plaza.v1', null)$$,
  'PT409', 'operation_changed', 'operation cannot change');
select throws_ok($$select public.save_my_placeable('40404040-4040-4040-8040-404040404040', 0, 'placeable.v1', 'e1-plaza.v1', null)$$,
  'PT409', 'revision_conflict', 'stale write rejected');
select is((public.save_my_placeable('50505050-5050-4050-8050-505050505050', 1, 'placeable.v1', 'e1-plaza.v1', null))->>'revision', '2', 'remove increments revision');
select set_config('request.jwt.claim.sub', '20202020-2020-4020-8020-202020202020', true);
select is((select count(*)::integer from public.placeable_snapshots), 0, 'RLS isolates owner');
reset role;
delete from auth.users where id = '10101010-1010-4010-8010-101010101010';
select is((select count(*)::integer from public.placeable_snapshots), 0, 'account cascade removes cosmetics');
set local role authenticated;
select set_config('request.jwt.claim.sub', '10101010-1010-4010-8010-101010101010', true);
select throws_ok($$select public.save_my_placeable('60606060-6060-4060-8060-606060606060', 0, 'placeable.v1', 'e1-plaza.v1', null)$$,
  'PT410', 'owner_deleted', 'late save cannot recreate deleted owner');
select * from finish();
rollback;
