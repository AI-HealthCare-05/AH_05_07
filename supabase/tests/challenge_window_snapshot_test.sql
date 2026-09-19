BEGIN;
SELECT plan(10);

INSERT INTO auth.users (id, email)
VALUES
  ('10101010-1010-4010-8010-101010101010', 'snapshot-owner@example.com'),
  ('20202020-2020-4020-8020-202020202020', 'snapshot-other@example.com');

SET LOCAL session_replication_role = replica;

INSERT INTO public.active_challenges (
  id, user_id, action_id, starts_on, ends_on, first_checkin_on, status, expires_at
)
VALUES
  (
    '30303030-3030-4030-8030-303030303030',
    '10101010-1010-4010-8010-101010101010',
    'walk-10-minutes',
    (timezone('Asia/Seoul', now()))::date,
    (timezone('Asia/Seoul', now()))::date + 6,
    (timezone('Asia/Seoul', now()))::date,
    'active',
    now() + interval '30 days'
  ),
  (
    '40404040-4040-4040-8040-404040404040',
    '20202020-2020-4020-8020-202020202020',
    'sleep-routine',
    (timezone('Asia/Seoul', now()))::date,
    (timezone('Asia/Seoul', now()))::date + 6,
    null,
    'active',
    now() + interval '30 days'
  );

INSERT INTO public.challenge_checkins (
  id, challenge_id, user_id, action_id, observed_on, status, expires_at
)
VALUES
  (
    '50505050-5050-4050-8050-505050505050',
    '30303030-3030-4030-8030-303030303030',
    '10101010-1010-4010-8010-101010101010',
    'walk-10-minutes',
    (timezone('Asia/Seoul', now()))::date,
    'completed',
    now() + interval '30 days'
  ),
  (
    '60606060-6060-4060-8060-606060606060',
    '30303030-3030-4030-8030-303030303030',
    '10101010-1010-4010-8010-101010101010',
    'walk-10-minutes',
    (timezone('Asia/Seoul', now()))::date + 1,
    'skipped',
    now() - interval '1 second'
  );

SET LOCAL session_replication_role = origin;

SELECT is(
  (SELECT provolatile::text
   FROM pg_proc
   WHERE oid = 'public.get_owned_challenge_window(date,date)'::regprocedure),
  's',
  'challenge window function is STABLE and therefore uses one calling-query snapshot'
);

SELECT is(
  (SELECT prosecdef::text
   FROM pg_proc
   WHERE oid = 'public.get_owned_challenge_window(date,date)'::regprocedure),
  'false',
  'challenge window function is SECURITY INVOKER'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.get_owned_challenge_window(date,date)',
    'EXECUTE'
  ),
  'authenticated may execute the challenge window function'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.get_owned_challenge_window(date,date)',
    'EXECUTE'
  ),
  'anon has no execute grant on the challenge window function'
);

SET LOCAL ROLE anon;

SELECT throws_ok(
  $$
    SELECT public.get_owned_challenge_window(
      (timezone('Asia/Seoul', now()))::date,
      (timezone('Asia/Seoul', now()))::date + 6
    )
  $$,
  '42501',
  NULL,
  'anon cannot execute the challenge window function'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '10101010-1010-4010-8010-101010101010';

SELECT is(
  public.get_owned_challenge_window(
    (timezone('Asia/Seoul', now()))::date,
    (timezone('Asia/Seoul', now()))::date + 6
  )->'active_challenge'->>'action_id',
  'walk-10-minutes',
  'owner reads its active challenge through the snapshot function'
);

SELECT is(
  jsonb_array_length(
    public.get_owned_challenge_window(
      (timezone('Asia/Seoul', now()))::date,
      (timezone('Asia/Seoul', now()))::date + 6
    )->'challenge_checkins'
  ),
  1,
  'existing retention RLS hides the expired owner check-in'
);

SELECT is(
  public.get_owned_challenge_window(
    (timezone('Asia/Seoul', now()))::date,
    (timezone('Asia/Seoul', now()))::date + 6
  )->'challenge_checkins'->0->>'action_id',
  'walk-10-minutes',
  'visible owner check-in retains the matching challenge action'
);

SET LOCAL request.jwt.claim.sub = '20202020-2020-4020-8020-202020202020';

SELECT is(
  public.get_owned_challenge_window(
    (timezone('Asia/Seoul', now()))::date,
    (timezone('Asia/Seoul', now()))::date + 6
  )->'active_challenge'->>'action_id',
  'sleep-routine',
  'another authenticated user sees only its own active challenge'
);

SELECT is(
  jsonb_array_length(
    public.get_owned_challenge_window(
      (timezone('Asia/Seoul', now()))::date,
      (timezone('Asia/Seoul', now()))::date + 6
    )->'challenge_checkins'
  ),
  0,
  'another authenticated user does not receive the owner check-ins'
);

SELECT * FROM finish();
ROLLBACK;
