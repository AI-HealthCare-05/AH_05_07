BEGIN;

SELECT plan(12);

INSERT INTO auth.users (id, email)
VALUES
  ('66666666-6666-6666-6666-666666666666', 'synthetic-feedback-owner@example.com'),
  ('77777777-7777-7777-7777-777777777777', 'synthetic-feedback-other@example.com');

SET LOCAL ROLE anon;

SELECT throws_ok(
  $$SELECT id, surface, response, submitted_on FROM public.structured_feedback$$,
  '42501',
  NULL,
  'anon cannot read structured feedback'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';

SELECT lives_ok(
  $$
    INSERT INTO public.structured_feedback (user_id, surface, response)
    VALUES ('66666666-6666-6666-6666-666666666666', 'seven_day_recap', 'clear')
  $$,
  'owner can create one structured feedback row'
);

SELECT results_eq(
  $$
    SELECT submitted_on
    FROM public.structured_feedback
    WHERE surface = 'seven_day_recap'
  $$,
  ARRAY[(timezone('Asia/Seoul', now()))::date],
  'submitted_on is derived from the Korea server date'
);

SELECT ok(
  (
    SELECT
      created_at > now() - interval '1 minute'
      AND expires_at > now() + interval '29 days'
      AND expires_at < now() + interval '31 days'
    FROM public.structured_feedback
    WHERE surface = 'seven_day_recap'
  ),
  'created_at and expires_at use server-controlled defaults'
);

SELECT throws_ok(
  $$
    INSERT INTO public.structured_feedback (user_id, surface, response, submitted_on)
    VALUES ('66666666-6666-6666-6666-666666666666', 'seven_day_recap', 'unclear', '2000-01-01')
  $$,
  '42501',
  NULL,
  'authenticated clients cannot supply submitted_on'
);

SELECT throws_ok(
  $$
    INSERT INTO public.structured_feedback (user_id, surface, response)
    VALUES ('66666666-6666-6666-6666-666666666666', 'seven_day_recap', 'unclear')
  $$,
  '23505',
  NULL,
  'one feedback row per user surface and submitted day'
);

SELECT throws_ok(
  $$UPDATE public.structured_feedback SET response = 'unclear' WHERE surface = 'seven_day_recap'$$,
  '42501',
  NULL,
  'authenticated clients cannot update structured feedback'
);

SELECT throws_ok(
  $$DELETE FROM public.structured_feedback WHERE surface = 'seven_day_recap'$$,
  '42501',
  NULL,
  'authenticated clients cannot delete structured feedback'
);

SET LOCAL request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';

SELECT is_empty(
  $$SELECT id FROM public.structured_feedback$$,
  'another user cannot read owner feedback'
);

SELECT throws_ok(
  $$
    INSERT INTO public.structured_feedback (user_id, surface, response)
    VALUES ('66666666-6666-6666-6666-666666666666', 'seven_day_recap', 'hard_to_understand')
  $$,
  '42501',
  NULL,
  'another user cannot create feedback for the owner'
);

RESET ROLE;
SET LOCAL session_replication_role = replica;

UPDATE public.structured_feedback
SET expires_at = now() - interval '1 second'
WHERE user_id = '66666666-6666-6666-6666-666666666666';

SET LOCAL session_replication_role = origin;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';

SELECT is_empty(
  $$SELECT id FROM public.structured_feedback$$,
  'owner cannot read expired structured feedback'
);

RESET ROLE;

DELETE FROM auth.users
WHERE id = '66666666-6666-6666-6666-666666666666';

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.structured_feedback
    WHERE user_id = '66666666-6666-6666-6666-666666666666'
  ),
  0,
  'account deletion cascades to structured feedback'
);

SELECT * FROM finish();
ROLLBACK;
