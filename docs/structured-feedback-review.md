# Structured feedback review

## Purpose

Issue #552 defines the narrow internal review procedure for the first FR-06
structured S10 feedback slice.

This is **not** a product admin API, reviewer dashboard, user-profile browser,
health analysis surface, or model-training pipeline. The existing Supabase
project owner may inspect one fixed aggregate in the Supabase control plane.
No new runtime authorization role, endpoint, RPC, credential, table, cache,
snapshot, or deployed service is introduced.

The result helps prioritize review of S10 wording and presentation. It does not
measure a person's comprehension ability, health change, challenge outcome,
Model V2 quality, or causal effect. Feedback remains review data and is never an
online-training label.

## Reviewer and authorization boundary

The reviewer is an **existing Supabase project owner** using the provider's
control-plane authentication.

Do not:

- grant project-owner access merely so another person can review feedback;
- treat a product Supabase Auth account as a reviewer role;
- add `user_metadata` or `app_metadata` reviewer claims for this procedure;
- add a service-role or other privileged credential to `app/`, `web/`, `ops/`,
  workflow files, browser assets, or logs;
- expose individual `structured_feedback` rows through a new API or RPC.

If a non-owner later needs delegated, restricted review access, reopen the
architecture decision. That is a different protected-boundary change.

## Fixed review window

Each review statement fixes one database time `T = statement_timestamp()` and
derives the Korea calendar date `D`.

The review includes only:

- `surface = 'seven_day_recap'`;
- `submitted_on >= D - 7`;
- `submitted_on < D`;
- `created_at <= T`;
- `expires_at > T`.

Therefore the window is the **seven completed Korea dates before today**. The
current partial Korea date is intentionally excluded. It is not a challenge
window, user-record window, or cohort-health window.

## Allowed output

The review result is one aggregate object with only:

- `surface = 'seven_day_recap'`;
- `timezone = 'Asia/Seoul'`;
- `window_start_on`;
- `window_end_on_exclusive`;
- `as_of`;
- `status = 'ok' | 'empty'`;
- `total_submissions`;
- `counts.clear`;
- `counts.unclear`;
- `counts.hard_to_understand`.

`total_submissions` is a **submission count**, not a unique-user count. A user
may submit on more than one completed date.

Do not break the result down by user, date, account, challenge, blood-pressure
fact, Model V2 fact, or any other dimension. Do not add percentages, rankings,
free text, identifiers, or row lists.

## Operator query

Run this read-only statement in the Supabase SQL Editor. Do not modify it to
return row-level data.

```sql
with review_clock as (
  select
    statement_timestamp() as as_of,
    (timezone('Asia/Seoul', statement_timestamp()))::date as kst_today
),
aggregate_counts as (
  select
    count(*)::bigint as total_submissions,
    count(*) filter (where feedback.response = 'clear')::bigint as clear_count,
    count(*) filter (where feedback.response = 'unclear')::bigint as unclear_count,
    count(*) filter (where feedback.response = 'hard_to_understand')::bigint
      as hard_to_understand_count
  from public.structured_feedback as feedback
  cross join review_clock as clock
  where feedback.surface = 'seven_day_recap'
    and feedback.submitted_on >= clock.kst_today - 7
    and feedback.submitted_on < clock.kst_today
    and feedback.created_at <= clock.as_of
    and feedback.expires_at > clock.as_of
)
select
  'seven_day_recap'::text as surface,
  'Asia/Seoul'::text as timezone,
  clock.kst_today - 7 as window_start_on,
  clock.kst_today as window_end_on_exclusive,
  clock.as_of,
  case when counts.total_submissions = 0 then 'empty' else 'ok' end::text as status,
  counts.total_submissions,
  counts.clear_count as "counts.clear",
  counts.unclear_count as "counts.unclear",
  counts.hard_to_understand_count as "counts.hard_to_understand"
from review_clock as clock
cross join aggregate_counts as counts;
```

The explicit `expires_at > T` condition remains required even if physical purge
is healthy. A physically present expired row must not affect review output.

## Interpretation and handling

Use the counts only to decide whether S10 wording or presentation deserves
review.

Do not interpret the result as:

- number of unique people;
- improvement or deterioration;
- health outcome;
- adherence or challenge performance;
- model quality or model error;
- evidence for training, calibration, thresholding, or retraining;
- external acceptance of FR-06 or Talos scope.

Do not export or persist the result as CSV, a materialized view, a daily
snapshot, a cache, a review record, or a comment table. If the review cannot be
performed now, leave it unavailable rather than reusing an old result as
current.

## Retention and account deletion

The query independently applies `expires_at > T`, so logical expiry does not
depend on the daily purge having already removed the row.

`structured_feedback.user_id` references `auth.users(id) ON DELETE CASCADE`.
After account deletion commits, a subsequent aggregate no longer includes that
account's feedback.

The review procedure does not create a second copy whose lifecycle could outlive
the source row.

## Failure semantics

This procedure has no new HTTP status or product error contract.

- zero matching submissions: return `empty` and three zero counts;
- control-plane sign-in unavailable: review unavailable;
- reviewer lacks project access: access denied;
- table/query/database failure or timeout: review unavailable;
- missing or unexpected output fields: do not treat the result as valid;
- an older result that remains on screen: do not present it as the current
  review.

Do not copy JWTs, row contents, raw SQL errors, or identifiers into review
notes.

## Deferred alternatives

A delegated aggregate RPC remains deferred until a real need exists for a
non-owner reviewer. If that need appears, it requires a separate protected
design covering JWT claim provenance and revocation, database-independent
authorization, function ownership, RLS behavior, `EXECUTE` grants, `search_path`,
small-count inference, and reviewer account compromise.

Individual-row admin APIs and a standalone admin service/dashboard are not
justified by the current requirement.
