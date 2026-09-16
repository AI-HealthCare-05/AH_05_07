BEGIN;

SELECT plan(10);

CREATE TEMP TABLE structured_feedback_review_clock (
  as_of timestamptz not null,
  kst_today date not null
);

INSERT INTO structured_feedback_review_clock (as_of, kst_today)
VALUES ('2026-09-16 12:00:00+09'::timestamptz, date '2026-09-16');

INSERT INTO auth.users (id, email)
VALUES
  ('81000000-0000-0000-0000-000000000001', 'synthetic-review-01@example.com'),
  ('81000000-0000-0000-0000-000000000002', 'synthetic-review-02@example.com'),
  ('81000000-0000-0000-0000-000000000003', 'synthetic-review-03@example.com'),
  ('81000000-0000-0000-0000-000000000004', 'synthetic-review-04@example.com'),
  ('81000000-0000-0000-0000-000000000005', 'synthetic-review-05@example.com'),
  ('81000000-0000-0000-0000-000000000006', 'synthetic-review-06@example.com'),
  ('81000000-0000-0000-0000-000000000007', 'synthetic-review-07@example.com'),
  ('81000000-0000-0000-0000-000000000008', 'synthetic-review-08@example.com'),
  ('81000000-0000-0000-0000-000000000009', 'synthetic-review-09@example.com'),
  ('81000000-0000-0000-0000-000000000010', 'synthetic-review-10@example.com'),
  ('81000000-0000-0000-0000-000000000011', 'synthetic-review-11@example.com');

INSERT INTO public.structured_feedback (
  user_id,
  surface,
  response,
  submitted_on,
  created_at,
  expires_at
)
VALUES
  -- Seven valid submissions in [D-7, D). User 01 contributes twice on two dates.
  ('81000000-0000-0000-0000-000000000001', 'seven_day_recap', 'clear',
    date '2026-09-09', '2026-09-09 09:00:00+09', '2026-10-09 09:00:00+09'),
  ('81000000-0000-0000-0000-000000000001', 'seven_day_recap', 'unclear',
    date '2026-09-10', '2026-09-10 09:00:00+09', '2026-10-10 09:00:00+09'),
  ('81000000-0000-0000-0000-000000000002', 'seven_day_recap', 'clear',
    date '2026-09-15', '2026-09-15 09:00:00+09', '2026-10-15 09:00:00+09'),
  ('81000000-0000-0000-0000-000000000003', 'seven_day_recap', 'unclear',
    date '2026-09-14', '2026-09-14 09:00:00+09', '2026-10-14 09:00:00+09'),
  ('81000000-0000-0000-0000-000000000004', 'seven_day_recap', 'hard_to_understand',
    date '2026-09-13', '2026-09-13 09:00:00+09', '2026-10-13 09:00:00+09'),
  ('81000000-0000-0000-0000-000000000005', 'seven_day_recap', 'hard_to_understand',
    date '2026-09-12', '2026-09-12 09:00:00+09', '2026-10-12 09:00:00+09'),
  ('81000000-0000-0000-0000-000000000011', 'seven_day_recap', 'clear',
    date '2026-09-11', '2026-09-11 09:00:00+09', '2026-10-11 09:00:00+09'),

  -- Excluded: current partial Korea date.
  ('81000000-0000-0000-0000-000000000006', 'seven_day_recap', 'clear',
    date '2026-09-16', '2026-09-16 09:00:00+09', '2026-10-16 09:00:00+09'),

  -- Excluded: older than the completed seven-day window.
  ('81000000-0000-0000-0000-000000000007', 'seven_day_recap', 'unclear',
    date '2026-09-08', '2026-09-08 09:00:00+09', '2026-10-08 09:00:00+09'),

  -- Excluded exactly at logical expiry boundary T.
  ('81000000-0000-0000-0000-000000000008', 'seven_day_recap', 'clear',
    date '2026-09-11', '2026-09-11 08:00:00+09', '2026-09-16 12:00:00+09'),

  -- Excluded even though the expired row is still physically present.
  ('81000000-0000-0000-0000-000000000009', 'seven_day_recap', 'unclear',
    date '2026-09-10', '2026-09-10 08:00:00+09', '2026-09-16 11:59:59+09'),

  -- Excluded because it was not yet created at T.
  ('81000000-0000-0000-0000-000000000010', 'seven_day_recap', 'hard_to_understand',
    date '2026-09-14', '2026-09-16 12:00:01+09', '2026-10-14 09:00:00+09');

CREATE TEMP VIEW structured_feedback_review_contract AS
WITH review_clock AS (
  SELECT as_of, kst_today
  FROM structured_feedback_review_clock
),
aggregate_counts AS (
  SELECT
    count(*)::bigint AS total_submissions,
    count(*) FILTER (WHERE feedback.response = 'clear')::bigint AS clear_count,
    count(*) FILTER (WHERE feedback.response = 'unclear')::bigint AS unclear_count,
    count(*) FILTER (WHERE feedback.response = 'hard_to_understand')::bigint
      AS hard_to_understand_count
  FROM public.structured_feedback AS feedback
  CROSS JOIN review_clock AS clock
  WHERE feedback.surface = 'seven_day_recap'
    AND feedback.submitted_on >= clock.kst_today - 7
    AND feedback.submitted_on < clock.kst_today
    AND feedback.created_at <= clock.as_of
    AND feedback.expires_at > clock.as_of
)
SELECT
  'seven_day_recap'::text AS surface,
  'Asia/Seoul'::text AS timezone,
  clock.kst_today - 7 AS window_start_on,
  clock.kst_today AS window_end_on_exclusive,
  clock.as_of,
  CASE WHEN counts.total_submissions = 0 THEN 'empty' ELSE 'ok' END::text AS status,
  counts.total_submissions,
  counts.clear_count AS "counts.clear",
  counts.unclear_count AS "counts.unclear",
  counts.hard_to_understand_count AS "counts.hard_to_understand"
FROM review_clock AS clock
CROSS JOIN aggregate_counts AS counts;

SELECT is(
  (
    SELECT array_agg(attribute.attname::text ORDER BY attribute.attnum)
    FROM pg_attribute AS attribute
    WHERE attribute.attrelid = 'structured_feedback_review_contract'::regclass
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  ),
  ARRAY[
    'surface',
    'timezone',
    'window_start_on',
    'window_end_on_exclusive',
    'as_of',
    'status',
    'total_submissions',
    'counts.clear',
    'counts.unclear',
    'counts.hard_to_understand'
  ]::text[],
  'review output contains only the approved aggregate fields'
);

SELECT results_eq(
  $$
    SELECT surface, timezone, window_start_on, window_end_on_exclusive, status
    FROM structured_feedback_review_contract
  $$,
  $$
    VALUES (
      'seven_day_recap'::text,
      'Asia/Seoul'::text,
      date '2026-09-09',
      date '2026-09-16',
      'ok'::text
    )
  $$,
  'review uses the fixed surface and seven completed Korea dates'
);

SELECT results_eq(
  $$
    SELECT total_submissions, "counts.clear", "counts.unclear", "counts.hard_to_understand"
    FROM structured_feedback_review_contract
  $$,
  $$
    VALUES (7::bigint, 3::bigint, 2::bigint, 2::bigint)
  $$,
  'review counts only eligible submissions by the three fixed responses'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.structured_feedback AS feedback
    CROSS JOIN structured_feedback_review_clock AS clock
    WHERE feedback.user_id = '81000000-0000-0000-0000-000000000001'
      AND feedback.submitted_on >= clock.kst_today - 7
      AND feedback.submitted_on < clock.kst_today
      AND feedback.created_at <= clock.as_of
      AND feedback.expires_at > clock.as_of
  ),
  2,
  'submission count does not silently become a unique-user count'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.structured_feedback AS feedback
    CROSS JOIN structured_feedback_review_clock AS clock
    WHERE feedback.user_id = '81000000-0000-0000-0000-000000000008'
      AND feedback.expires_at = clock.as_of
  ),
  'an exactly-expired synthetic row exists for the boundary test'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.structured_feedback AS feedback
    CROSS JOIN structured_feedback_review_clock AS clock
    WHERE feedback.user_id = '81000000-0000-0000-0000-000000000009'
      AND feedback.expires_at < clock.as_of
  ),
  'a physically present expired synthetic row exists before purge'
);

SELECT is(
  (SELECT total_submissions::integer FROM structured_feedback_review_contract),
  7,
  'exactly-expired, unpurged-expired, today, old, and future-created rows do not affect the aggregate'
);

DELETE FROM auth.users
WHERE id = '81000000-0000-0000-0000-000000000011';

SELECT results_eq(
  $$
    SELECT total_submissions, "counts.clear", "counts.unclear", "counts.hard_to_understand"
    FROM structured_feedback_review_contract
  $$,
  $$
    VALUES (6::bigint, 2::bigint, 2::bigint, 2::bigint)
  $$,
  'account deletion removes its contribution from the next aggregate'
);

UPDATE structured_feedback_review_clock
SET
  as_of = '2027-01-08 12:00:00+09'::timestamptz,
  kst_today = date '2027-01-08';

SELECT results_eq(
  $$
    SELECT status, total_submissions, "counts.clear", "counts.unclear", "counts.hard_to_understand"
    FROM structured_feedback_review_contract
  $$,
  $$
    VALUES ('empty'::text, 0::bigint, 0::bigint, 0::bigint, 0::bigint)
  $$,
  'empty review is explicit and returns zero counts rather than a failure-shaped result'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_class
    WHERE relname IN (
      'structured_feedback_review_snapshot',
      'structured_feedback_review_cache',
      'structured_feedback_daily_aggregate'
    )
      AND relpersistence <> 't'
  ),
  0,
  'the review test does not require a persisted aggregate object'
);

SELECT * FROM finish();
ROLLBACK;
