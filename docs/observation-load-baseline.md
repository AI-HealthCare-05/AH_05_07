# Observation-window load baseline

## Scope and boundary

This is a sanitized, manual browser baseline for the signed-in recent-seven-day
observation window. It uses a synthetic account only. No account identifier,
email address, JWT, observation value, export, request/response body, or raw
browser log is retained.

## 2026-09-04 baseline

| Scenario | Samples (seconds) | Median | Interpretation |
| --- | --- | ---: | --- |
| First signed-in load | 7.0, 1.5, 1.1 | 1.5 | One cold/initialization outlier was observed; do not set a target from this small sample. |
| Refresh while signed in | 1.5, 1.2, 1.1 | 1.2 | Warm-path reference before the index release. |

Method: use the normal signed-in browser path and stop timing when the recent
seven-day list is visibly complete. This measures user-visible loading, not an
API-only benchmark. Repeat with the same method after the separately approved
production migration and record only aggregate timings.

## Post-index measurement

After the operator applied the reviewed index through the Supabase migration
gate, the same synthetic-account manual method recorded the following samples.

| Scenario | Samples (seconds) | Median | Interpretation |
| --- | --- | ---: | --- |
| First signed-in load | 3.0, 1.5, 1.0 | 1.5 | The cold/initialization sample improved from 7.0 to 3.0 seconds; the small manual sample is not a P95 target. |
| Refresh while signed in | 1.5, 1.2, 1.2 | 1.2 | Warm-path results remain within the original 1.1–1.5 second range. |

The deployed index is `challenge_checkins_challenge_user_idx` on
`(challenge_id, user_id)`. The prior missing-foreign-key-index Advisor finding
is resolved. A newly created index can initially appear as unused until normal
queries accumulate usage; that informational notice is not a removal signal.

## Index review

Supabase Performance Advisor, checked on 2026-09-04, reports that the composite
foreign key `challenge_checkins_challenge_user_fkey` has no covering index. The
repository already indexes `(user_id, observed_on desc)` but not
`(challenge_id, user_id)`. The additive migration
`20260904090000_add_challenge_checkins_challenge_user_index.sql` adds that
covering index. It does not change RLS, grants, rows, API responses, or the
ownership contract.

Production application was completed through the operator-mediated migration
gate before the post-index measurement above. Future schema changes still use
the same gate; a merged file alone never changes Supabase.
