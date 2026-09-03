BEGIN;

SELECT plan(17);

INSERT INTO auth.users (id, email)
VALUES ('55555555-5555-5555-5555-555555555555', 'synthetic-retention-owner@example.com');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';

INSERT INTO public.blood_pressure_observations
  (id, user_id, observed_on, period, systolic, diastolic, expires_at)
VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', '2026-09-03', 'morning', 120, 80, now() + interval '365 days');

INSERT INTO public.challenge_events
  (id, user_id, observed_on, action_id, status, expires_at)
VALUES
  ('bbbbbbbb-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', '2026-09-03', 'walk-10-minutes', 'completed', now() + interval '365 days');

INSERT INTO public.active_challenges
  (id, user_id, action_id, starts_on, ends_on, expires_at)
VALUES
  ('bbbbbbbb-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555555', 'walk-10-minutes', '2026-09-03', '2026-09-09', now() + interval '365 days');

INSERT INTO public.challenge_checkins
  (id, challenge_id, user_id, action_id, observed_on, status, expires_at)
VALUES
  ('bbbbbbbb-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555555', 'walk-10-minutes', '2026-09-03', 'completed', now() + interval '365 days');

SELECT ok(
  (SELECT expires_at > now() + interval '29 days' AND expires_at < now() + interval '31 days'
   FROM public.blood_pressure_observations
   WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'blood-pressure insert ignores a caller-supplied retention extension'
);

SELECT ok(
  (SELECT expires_at > now() + interval '29 days' AND expires_at < now() + interval '31 days'
   FROM public.challenge_events
   WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'legacy challenge insert ignores a caller-supplied retention extension'
);

SELECT ok(
  (SELECT expires_at > now() + interval '29 days' AND expires_at < now() + interval '31 days'
   FROM public.active_challenges
   WHERE id = 'bbbbbbbb-0000-0000-0000-000000000003'),
  'active-challenge insert ignores a caller-supplied retention extension'
);

SELECT ok(
  (SELECT expires_at > now() + interval '29 days' AND expires_at < now() + interval '31 days'
   FROM public.challenge_checkins
   WHERE id = 'bbbbbbbb-0000-0000-0000-000000000004'),
  'challenge-checkin insert ignores a caller-supplied retention extension'
);

SELECT throws_ok(
  $$UPDATE public.blood_pressure_observations SET expires_at = now() + interval '365 days' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  'P0001',
  'observation_retention_immutable',
  'blood-pressure retention cannot be extended after insert'
);

SELECT throws_ok(
  $$UPDATE public.challenge_events SET expires_at = now() + interval '365 days' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
  'P0001',
  'observation_retention_immutable',
  'legacy challenge retention cannot be extended after insert'
);

SELECT throws_ok(
  $$UPDATE public.active_challenges SET expires_at = now() + interval '365 days' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000003'$$,
  'P0001',
  'challenge_lifecycle_fields_immutable',
  'active-challenge retention cannot be extended after insert'
);

SELECT throws_ok(
  $$UPDATE public.challenge_checkins SET expires_at = now() + interval '365 days' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000004'$$,
  'P0001',
  'challenge_checkin_lifecycle_fields_immutable',
  'challenge-checkin retention cannot be extended after insert'
);

RESET ROLE;
SET LOCAL session_replication_role = replica;

UPDATE public.blood_pressure_observations SET expires_at = now() - interval '1 second' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
UPDATE public.challenge_events SET expires_at = now() - interval '1 second' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002';
UPDATE public.active_challenges SET expires_at = now() - interval '1 second' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000003';
UPDATE public.challenge_checkins SET expires_at = now() - interval '1 second' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000004';

SET LOCAL session_replication_role = origin;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';

SELECT is_empty(
  $$SELECT id FROM public.blood_pressure_observations WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  'owner cannot read an expired blood-pressure observation'
);

SELECT is_empty(
  $$SELECT id FROM public.challenge_events WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
  'owner cannot read an expired legacy challenge event'
);

SELECT is_empty(
  $$SELECT id FROM public.active_challenges WHERE id = 'bbbbbbbb-0000-0000-0000-000000000003'$$,
  'owner cannot read an expired active challenge'
);

SELECT is_empty(
  $$SELECT id FROM public.challenge_checkins WHERE id = 'bbbbbbbb-0000-0000-0000-000000000004'$$,
  'owner cannot read an expired challenge check-in'
);

SELECT is_empty(
  $$UPDATE public.blood_pressure_observations SET systolic = 121 WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001' RETURNING id$$,
  'owner cannot update an expired blood-pressure observation'
);

SELECT is_empty(
  $$DELETE FROM public.challenge_events WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002' RETURNING id$$,
  'owner cannot delete an expired legacy challenge event'
);

SELECT is_empty(
  $$UPDATE public.active_challenges SET status = 'closed' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000003' RETURNING id$$,
  'owner cannot update an expired active challenge'
);

SELECT is_empty(
  $$DELETE FROM public.challenge_checkins WHERE id = 'bbbbbbbb-0000-0000-0000-000000000004' RETURNING id$$,
  'owner cannot delete an expired challenge check-in'
);

SELECT is_empty(
  $$
    SELECT record_kind
    FROM (
      SELECT 'blood_pressure_observation'::text AS record_kind FROM public.blood_pressure_observations
      UNION ALL
      SELECT 'challenge_event'::text AS record_kind FROM public.challenge_events
      UNION ALL
      SELECT 'active_challenge'::text AS record_kind FROM public.active_challenges
      UNION ALL
      SELECT 'challenge_checkin'::text AS record_kind FROM public.challenge_checkins
    ) AS export_source
  $$,
  'expired records are absent from the owner export source'
);

SELECT * FROM finish();
ROLLBACK;
