# Account-removal production baseline — 2026-09-08

Scope: non-model reconciliation of the operator handoff and
[Issue #355 final ledger](https://github.com/AI-HealthCare-05/AH_05_07/issues/355).
GitHub source/issue records were read; cloud control planes were not independently
re-inspected by this documentation pass. Treat these as dated deployment evidence,
not a live runtime pointer.

| Record | Accepted handoff value |
| --- | --- |
| Source | `9713ed5aab4a4e74b145d79c4d536affab3c010b` |
| Implementation | PR #348, merge `d5c5469fd8bd2090267abb14325ad6dcfaeb81fa`, included in source |
| API | `bp7-api`, `asia-northeast3`, `bp7-api-00031-rel`, 100% traffic |
| Image digest | `sha256:a68b30ef6182f9d13a709008542ad248afd55a74664dc67a1616a5a3c6795ecf` |
| Rehearsed rollback | `bp7-api-00029-zur`; final restore to `bp7-api-00031-rel` |
| Worker | `ah-05-07-pages`, `84c290eb-3fca-4d9d-9378-01070af3a8ea`, 100% traffic |
| Supabase | `ah-05-07-prod`, `fglyixpysarmxfxwcgby`, reported `ACTIVE_HEALTHY` |
| Server-only binding | `SUPABASE_SECRET_KEY -> supabase-secret-key:1` |

Design #342, implementation #346 / #348, and activation #355 are complete.
Identity is validated Supabase Auth `auth.users.id`; deletion uses the server-side
Admin route through `DELETE /api/v1/account`. The browser implements two-step
confirmation, lost-response recovery, and account-bound state cleanup.

The operator ledger reports no-traffic, live/ready, OpenAPI route, DELETE CORS,
unauthenticated rejection, activation, rollback, restore, and final smoke PASS.
Web HTTP and account-route bundle presence also passed. These checks do not prove
authenticated deletion, cascade cleanup, old-token denial, or browser cleanup.

During #355: Auth accounts created/deleted 0, product rows written/deleted 0,
migrations 0, DB/RLS/grant changes 0. No secret value is included here.

## Current boundaries

- Actual production deletion: **NOT EXERCISED**. Follow the
  [separate synthetic gate](account-removal-synthetic-gate.md).
- #238 is closed with first-round decisions recorded. O1/O3 and submitted-package
  results remain their historical evidence; P95 remains EXECUTED / NOT PASSED.
- Other model commits in this source are an opaque shared baseline. Obtain a
  dated handoff from the model owner before integrating current model status.
- Do not deploy an older account-only build over this unified source.
- No implementation, deployment, cloud configuration, data mutation, model action,
  or production test was performed by this documentation reconciliation.

## Short handoff contract

For the next chat provide only: baseline SHA; completed work ID; evidence links;
unverified items; owner decisions; next task ID. Detailed logs remain at their
original location. Do not paste credentials, tokens, identities, or health rows.
Next task: review synthetic-gate scope and obtain explicit execution approval.
