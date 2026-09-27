-- Synthetic local/non-production only. Existing v1 contract runs alongside this file.
begin;
select plan(22);
insert into auth.users(id) values ('10101010-1010-4010-8010-101010101010');
select ok(not has_function_privilege('authenticated', 'public.placeable_snapshot_supported(text,text,jsonb)', 'EXECUTE'), 'helper not an exposed RPC');
set local role authenticated;
select set_config('request.jwt.claim.sub', '10101010-1010-4010-8010-101010101010', true);
select is(public.read_my_placeable()->>'schemaVersion', 'placeable.v1', 'absent row remains legacy unplaced without migration');
select is((public.save_my_placeable('30303030-3030-4030-8030-303030303030', 0, 'placeable.v1', 'e1-plaza.v1',
  '{"assetId":"welcome-pinwheel-v1","color":"coral","socketId":"gate-left"}'))->>'revision', '1', 'legacy pinwheel save');
select is((public.save_my_placeable('40404040-4040-4040-8040-404040404040', 1, 'placeable.v2', 'e1-plaza.v2',
  '{"pinwheel":{"assetId":"welcome-pinwheel-v1","color":"coral","socketId":"gate-left"},"keepsake":"plaza-ribbon-v1"}'))->>'revision', '2', 'explicit migration increments same revision');
select is(public.read_my_placeable()->'selection'->'pinwheel'->>'color', 'coral', 'pinwheel coexists');
select is(public.read_my_placeable()->'selection'->>'keepsake', 'plaza-ribbon-v1', 'cosmetic identity only');
select is(public.read_my_placeable()->>'latestFingerprint', encode(sha256(convert_to('1|placeable.v2|e1-plaza.v2|welcome-pinwheel-v1|coral|gate-left|plaza-ribbon-v1','UTF8')),'hex'), 'v2 fingerprint parity');
select is((public.save_my_placeable('40404040-4040-4040-8040-404040404040', 1, 'placeable.v2', 'e1-plaza.v2',
  '{"keepsake":"plaza-ribbon-v1","pinwheel":{"socketId":"gate-left","color":"coral","assetId":"welcome-pinwheel-v1"}}'))->>'revision', '2', 'lost response retry is idempotent despite key ordering');
select throws_ok($$select public.save_my_placeable('40404040-4040-4040-8040-404040404040', 1, 'placeable.v2', 'e1-plaza.v2', '{"pinwheel":null,"keepsake":null}')$$, 'PT409', 'operation_changed', 'receipt cannot change');
select throws_ok($$select public.save_my_placeable('50505050-5050-4050-8050-505050505050', 1, 'placeable.v2', 'e1-plaza.v2', '{"pinwheel":null,"keepsake":null}')$$, 'PT409', 'revision_conflict', 'stale context conflicts');
select throws_ok($$select public.save_my_placeable('50505050-5050-4050-8050-505050505050', 2, 'placeable.v1', 'e1-plaza.v1', null)$$, 'PT422', 'unsupported_snapshot', 'old client cannot downgrade v2');
select throws_ok($$select public.save_my_placeable('50505050-5050-4050-8050-505050505050', 2, 'placeable.v2', 'e1-plaza.v2', '{"pinwheel":null,"keepsake":"walk-10-minutes"}')$$, 'PT422', 'unsupported_snapshot', 'challenge identity rejected');
select throws_ok($$select public.save_my_placeable('50505050-5050-4050-8050-505050505050', 2, 'placeable.v2', 'e1-plaza.v2', '{"pinwheel":null,"keepsake":"forged"}')$$, 'PT422', 'unsupported_snapshot', 'forged asset rejected');
select throws_ok($$select public.save_my_placeable('50505050-5050-4050-8050-505050505050', 2, 'placeable.v2', 'e1-plaza.v2', '{"pinwheel":null,"keepsake":null,"completed":true}')$$, 'PT422', 'unsupported_snapshot', 'domain fields rejected');
select throws_ok($$select public.save_my_placeable('50505050-5050-4050-8050-505050505050', 2, 'placeable.v2', 'e1-plaza.v2', '{"keepsake":null}')$$, 'PT422', 'unsupported_snapshot', 'missing slot cannot silently remove pinwheel');
select is((public.save_my_placeable('50505050-5050-4050-8050-505050505050', 2, 'placeable.v2', 'e1-plaza.v2',
  '{"pinwheel":{"assetId":"welcome-pinwheel-v1","color":"coral","socketId":"gate-left"},"keepsake":"quiet-moon-v1"}'))->'selection'->>'keepsake', 'quiet-moon-v1', 'replace');
select is((public.save_my_placeable('60606060-6060-4060-8060-606060606060', 3, 'placeable.v2', 'e1-plaza.v2',
  '{"pinwheel":{"assetId":"welcome-pinwheel-v1","color":"coral","socketId":"gate-left"},"keepsake":"garden-leaf-v1"}'))->'selection'->>'keepsake', 'garden-leaf-v1', 'third allowed motif');
select is((public.save_my_placeable('70707070-7070-4070-8070-707070707070', 4, 'placeable.v2', 'e1-plaza.v2',
  '{"pinwheel":{"assetId":"welcome-pinwheel-v1","color":"coral","socketId":"gate-left"},"keepsake":null}'))->'selection'->'keepsake', 'null'::jsonb, 'explicit removal retains layout');
reset role;
update public.placeable_snapshots set selection = '{"pinwheel":null,"keepsake":"future-asset"}' where user_id = '10101010-1010-4010-8010-101010101010';
set local role authenticated;
select is(public.read_my_placeable()->'selection'->>'keepsake', 'future-asset', 'unknown asset preserved on read');
select throws_ok($$select public.save_my_placeable('80808080-8080-4080-8080-808080808080', 5, 'placeable.v2', 'e1-plaza.v2', '{"pinwheel":null,"keepsake":null}')$$, 'PT422', 'unsupported_snapshot', 'unknown stored asset cannot be overwritten');
reset role;
delete from auth.users where id = '10101010-1010-4010-8010-101010101010';
select is((select count(*)::integer from public.placeable_snapshots), 0, 'owner deletion cascades v2 snapshot');
set local role authenticated;
select throws_ok($$select public.save_my_placeable('80808080-8080-4080-8080-808080808080', 0, 'placeable.v2', 'e1-plaza.v2', '{"pinwheel":null,"keepsake":"quiet-moon-v1"}')$$, 'PT410', 'owner_deleted', 'late v2 save cannot recreate owner');
select * from finish();
rollback;
