BEGIN;

SELECT plan(25);

INSERT INTO auth.users (id, email)
VALUES
  ('33333333-3333-3333-3333-333333333333', 'synthetic-owner@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'synthetic-other@example.com');

SET LOCAL ROLE anon;

SELECT throws_ok(
  $$SELECT * FROM public.blood_pressure_observations$$,
  '42501',
  NULL,
  'anon cannot read blood-pressure observations'
);

SELECT throws_ok(
  $$SELECT * FROM public.challenge_events$$,
  '42501',
  NULL,
  'anon cannot read legacy challenge events'
);

SELECT throws_ok(
  $$SELECT * FROM public.active_challenges$$,
  '42501',
  NULL,
  'anon cannot read active challenges'
);

SELECT throws_ok(
  $$SELECT * FROM public.challenge_checkins$$,
  '42501',
  NULL,
  'anon cannot read challenge check-ins'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

SELECT results_eq(
  $$
    INSERT INTO public.blood_pressure_observations
      (id, user_id, observed_on, period, systolic, diastolic)
    VALUES
      ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', '2026-09-02', 'morning', 120, 80)
    RETURNING id
  $$,
  ARRAY['aaaaaaaa-0000-0000-0000-000000000001'::uuid],
  'owner can create a synthetic blood-pressure observation'
);

SELECT results_eq(
  $$
    INSERT INTO public.challenge_events
      (id, user_id, observed_on, action_id, status)
    VALUES
      ('aaaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', '2026-09-02', 'walk-10-minutes', 'completed')
    RETURNING id
  $$,
  ARRAY['aaaaaaaa-0000-0000-0000-000000000002'::uuid],
  'owner can create a synthetic legacy challenge event'
);

SELECT results_eq(
  $$
    INSERT INTO public.active_challenges
      (id, user_id, action_id, starts_on, ends_on)
    VALUES
      ('aaaaaaaa-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'walk-10-minutes', '2026-09-02', '2026-09-08')
    RETURNING id
  $$,
  ARRAY['aaaaaaaa-0000-0000-0000-000000000003'::uuid],
  'owner can select a synthetic active challenge'
);

SELECT results_eq(
  $$
    INSERT INTO public.challenge_checkins
      (id, challenge_id, user_id, action_id, observed_on, status)
    VALUES
      ('aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'walk-10-minutes', '2026-09-02', 'completed')
    RETURNING id
  $$,
  ARRAY['aaaaaaaa-0000-0000-0000-000000000004'::uuid],
  'owner can create a synthetic challenge check-in'
);

SET LOCAL ROLE anon;

SELECT throws_ok(
  $$
    UPDATE public.blood_pressure_observations
    SET systolic = 121
    WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'
  $$,
  '42501',
  NULL,
  'anon cannot change an owner blood-pressure observation'
);

SELECT throws_ok(
  $$
    DELETE FROM public.challenge_events
    WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002'
  $$,
  '42501',
  NULL,
  'anon cannot delete an owner legacy challenge event'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

SELECT is_empty(
  $$SELECT * FROM public.blood_pressure_observations$$,
  'another user cannot read the owner blood-pressure observation'
);

SELECT is_empty(
  $$SELECT * FROM public.challenge_events$$,
  'another user cannot read the owner legacy challenge event'
);

SELECT is_empty(
  $$SELECT * FROM public.active_challenges$$,
  'another user cannot read the owner active challenge'
);

SELECT is_empty(
  $$SELECT * FROM public.challenge_checkins$$,
  'another user cannot read the owner challenge check-in'
);

SELECT is_empty(
  $$
    UPDATE public.blood_pressure_observations
    SET systolic = 121
    WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'
    RETURNING id
  $$,
  'another user cannot change the owner blood-pressure observation'
);

SELECT is_empty(
  $$
    UPDATE public.challenge_events
    SET status = 'skipped'
    WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002'
    RETURNING id
  $$,
  'another user cannot change the owner legacy challenge event'
);

SELECT is_empty(
  $$
    UPDATE public.active_challenges
    SET action_id = 'sleep-routine'
    WHERE id = 'aaaaaaaa-0000-0000-0000-000000000003'
    RETURNING id
  $$,
  'another user cannot change the owner active challenge'
);

SELECT is_empty(
  $$
    UPDATE public.challenge_checkins
    SET status = 'skipped'
    WHERE id = 'aaaaaaaa-0000-0000-0000-000000000004'
    RETURNING id
  $$,
  'another user cannot change the owner challenge check-in'
);

SELECT is_empty(
  $$
    DELETE FROM public.blood_pressure_observations
    WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'
    RETURNING id
  $$,
  'another user cannot delete the owner blood-pressure observation'
);

SELECT is_empty(
  $$
    DELETE FROM public.challenge_events
    WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002'
    RETURNING id
  $$,
  'another user cannot delete the owner legacy challenge event'
);

SELECT is_empty(
  $$
    DELETE FROM public.active_challenges
    WHERE id = 'aaaaaaaa-0000-0000-0000-000000000003'
    RETURNING id
  $$,
  'another user cannot delete the owner active challenge'
);

SELECT is_empty(
  $$
    DELETE FROM public.challenge_checkins
    WHERE id = 'aaaaaaaa-0000-0000-0000-000000000004'
    RETURNING id
  $$,
  'another user cannot delete the owner challenge check-in'
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
  'another user export-source query returns no owner records'
);

SELECT throws_ok(
  $$
    INSERT INTO public.blood_pressure_observations
      (user_id, observed_on, period, systolic, diastolic)
    VALUES
      ('33333333-3333-3333-3333-333333333333', '2026-09-03', 'evening', 119, 79)
  $$,
  '42501',
  NULL,
  'another user cannot create a blood-pressure observation for the owner'
);

SELECT results_eq(
  $$
    SELECT count(*)::integer
    FROM public.blood_pressure_observations
  $$,
  ARRAY[0],
  'denied writes do not expose or alter owner blood-pressure records'
);

SELECT * FROM finish();
ROLLBACK;
