BEGIN;
SELECT plan(8);

INSERT INTO auth.users (id, email)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.com');

SET LOCAL ROLE anon;

SELECT throws_ok(
  $$SELECT * FROM public.active_challenges$$,
  '42501',
  NULL,
  'anon cannot read active challenges'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

SELECT results_eq(
  $$
    INSERT INTO public.active_challenges (id, user_id, action_id, starts_on, ends_on)
    VALUES (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-1111-1111-111111111111',
      'walk-10-minutes',
      '2026-09-02',
      '2026-09-08'
    )
    RETURNING action_id
  $$,
  ARRAY['walk-10-minutes'],
  'owner can select one active challenge'
);

SELECT results_eq(
  $$
    INSERT INTO public.challenge_checkins (challenge_id, user_id, action_id, observed_on, status)
    VALUES (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-1111-1111-111111111111',
      'walk-10-minutes',
      '2026-09-02',
      'completed'
    )
    RETURNING status
  $$,
  ARRAY['completed'],
  'owner can create an in-window check-in'
);

SELECT throws_ok(
  $$
    UPDATE public.active_challenges
    SET action_id = 'sleep-routine'
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  $$,
  'P0001',
  'challenge_selection_locked',
  'first check-in locks the selected action'
);

SET LOCAL request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

SELECT is_empty(
  $$SELECT * FROM public.active_challenges$$,
  'another user cannot read the owner challenge'
);

SELECT throws_ok(
  $$
    INSERT INTO public.challenge_checkins (challenge_id, user_id, action_id, observed_on, status)
    VALUES (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-1111-1111-111111111111',
      'walk-10-minutes',
      '2026-09-03',
      'skipped'
    )
  $$,
  '42501',
  NULL,
  'another user cannot create the owner check-in'
);

SELECT is_empty(
  $$
    UPDATE public.active_challenges
    SET status = 'closed'
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    RETURNING status
  $$,
  'another user cannot close the owner challenge'
);

SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

SELECT results_eq(
  $$
    SELECT first_checkin_on::text
    FROM public.active_challenges
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  $$,
  ARRAY['2026-09-02'],
  'the first check-in remains recorded after denied writes'
);

SELECT * FROM finish();
ROLLBACK;
