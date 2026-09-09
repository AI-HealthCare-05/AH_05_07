BEGIN;
SELECT plan(8);

INSERT INTO auth.users (id, email)
VALUES
  (
    '33333333-3333-3333-3333-333333333333',
    'boundary-start-date@example.com'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'boundary-delete@example.com'
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'boundary-expired@example.com'
  ),
  (
    '66666666-6666-4666-8666-666666663791',
    'boundary-ended-unlocked@example.com'
  );

-- Historical fixture for RED 3/4.
-- Build an already-ended challenge without depending on the public write path.
SET LOCAL session_replication_role = replica;

INSERT INTO public.active_challenges (
  id, user_id, action_id, starts_on, ends_on, first_checkin_on
)
VALUES (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '55555555-5555-5555-5555-555555555555',
  'walk-10-minutes',
  (timezone('Asia/Seoul', now()))::date - 7,
  (timezone('Asia/Seoul', now()))::date - 1,
  (timezone('Asia/Seoul', now()))::date - 7
);

INSERT INTO public.challenge_checkins (
  id, challenge_id, user_id, action_id, observed_on, status
)
VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '55555555-5555-5555-5555-555555555555',
  'walk-10-minutes',
  (timezone('Asia/Seoul', now()))::date - 7,
  'completed'
);

-- Historical ended challenge with no first check-in for RED 5.
INSERT INTO public.active_challenges (
  id, user_id, action_id, starts_on, ends_on, status
)
VALUES (
  '77777777-7777-4777-8777-777777773791',
  '66666666-6666-4666-8666-666666663791',
  'walk-10-minutes',
  (timezone('Asia/Seoul', now()))::date - 7,
  (timezone('Asia/Seoul', now()))::date - 1,
  'active'
);

SET LOCAL session_replication_role = origin;
SET LOCAL ROLE authenticated;

-- RED 1: direct Data API semantics must not allow an arbitrary start date.
SET LOCAL request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

SELECT throws_ok(
  $$
    INSERT INTO public.active_challenges (
      id, user_id, action_id, starts_on, ends_on
    )
    VALUES (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '33333333-3333-3333-3333-333333333333',
      'walk-10-minutes',
      (timezone('Asia/Seoul', now()))::date + 1,
      (timezone('Asia/Seoul', now()))::date + 7
    )
  $$,
  'P0001',
  NULL,
  'authenticated direct write cannot start a challenge on an arbitrary date'
);

-- RED 2: first check-in locks the challenge lifecycle against direct DELETE.
SET LOCAL request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

INSERT INTO public.active_challenges (
  id, user_id, action_id, starts_on, ends_on
)
VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '44444444-4444-4444-4444-444444444444',
  'walk-10-minutes',
  (timezone('Asia/Seoul', now()))::date,
  (timezone('Asia/Seoul', now()))::date + 6
);

INSERT INTO public.challenge_checkins (
  id, challenge_id, user_id, action_id, observed_on, status
)
VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '44444444-4444-4444-4444-444444444444',
  'walk-10-minutes',
  (timezone('Asia/Seoul', now()))::date,
  'completed'
);

SELECT throws_ok(
  $$
    DELETE FROM public.active_challenges
    WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  $$,
  'P0001',
  NULL,
  'authenticated direct delete cannot bypass the first-checkin challenge lock'
);

-- RED 3: an ended challenge check-in is no longer editable.
SET LOCAL request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';

SELECT throws_ok(
  $$
    UPDATE public.challenge_checkins
    SET status = 'skipped'
    WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
  $$,
  'P0001',
  NULL,
  'authenticated direct update cannot edit a check-in after its challenge window ended'
);

-- RED 4: the same ended check-in cannot be deleted directly either.
SELECT throws_ok(
  $$
    DELETE FROM public.challenge_checkins
    WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
  $$,
  'P0001',
  NULL,
  'authenticated direct delete cannot remove a check-in after its challenge window ended'
);

-- RED 5: an ended challenge cannot have its selection changed directly,
-- even if no first check-in was ever recorded.
SET LOCAL request.jwt.claim.sub = '66666666-6666-4666-8666-666666663791';

SELECT throws_ok(
  $$
    UPDATE public.active_challenges
    SET action_id = 'sleep-routine'
    WHERE id = '77777777-7777-4777-8777-777777773791'
  $$,
  'P0001',
  NULL,
  'authenticated direct update cannot change the selection after the challenge window ended'
);

-- Positive compatibility: a current challenge may change selection before
-- its first check-in.
SET LOCAL request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

INSERT INTO public.active_challenges (
  id, user_id, action_id, starts_on, ends_on
)
VALUES (
  '88888888-8888-4888-8888-888888883791',
  '33333333-3333-3333-3333-333333333333',
  'walk-10-minutes',
  (timezone('Asia/Seoul', now()))::date,
  (timezone('Asia/Seoul', now()))::date + 6
);

SELECT results_eq(
  $$
    UPDATE public.active_challenges
    SET action_id = 'sleep-routine'
    WHERE id = '88888888-8888-4888-8888-888888883791'
    RETURNING action_id
  $$,
  ARRAY['sleep-routine'],
  'authenticated owner can change the current challenge selection before the first check-in'
);

INSERT INTO public.challenge_checkins (
  id, challenge_id, user_id, action_id, observed_on, status
)
VALUES (
  '99999999-9999-4999-8999-999999993791',
  '88888888-8888-4888-8888-888888883791',
  '33333333-3333-3333-3333-333333333333',
  'sleep-routine',
  (timezone('Asia/Seoul', now()))::date,
  'completed'
);

SELECT results_eq(
  $$
    UPDATE public.challenge_checkins
    SET status = 'skipped'
    WHERE id = '99999999-9999-4999-8999-999999993791'
    RETURNING status
  $$,
  ARRAY['skipped'],
  'authenticated owner can update a check-in inside the current editable challenge window'
);

SELECT results_eq(
  $$
    DELETE FROM public.challenge_checkins
    WHERE id = '99999999-9999-4999-8999-999999993791'
    RETURNING id
  $$,
  ARRAY['99999999-9999-4999-8999-999999993791'::uuid],
  'authenticated owner can delete a check-in inside the current editable challenge window'
);

SELECT * FROM finish();
ROLLBACK;
