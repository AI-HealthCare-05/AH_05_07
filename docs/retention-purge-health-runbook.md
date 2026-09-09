# Retention purge health runbook

## Purpose

This runbook verifies the operational health of the scheduled physical cleanup
for expired product records.

The retention boundary has two layers:

1. RLS makes expired records inaccessible at their server-enforced `expires_at`.
2. `pg_cron` performs subsequent physical cleanup.

A purge-health failure is therefore an operational cleanup problem to
investigate. It is not, by itself, evidence that expired rows became accessible.

## Scope

Expected jobs:

| Job | Expected schedule |
| --- | --- |
| `purge-expired-observation-records` | `17 0 * * *` |
| `purge-expired-active-challenges` | `19 0 * * *` |

Health evidence is limited to metadata from:

- `cron.job`
- `cron.job_run_details`

Do not read or export application/product rows for this check.

Do not mutate cron configuration, retention deadlines, RLS policies, or
application data as part of verification.

## Health contract

A verification passes only when all of the following are true for both jobs:

- each expected job exists exactly once;
- `active = true`;
- the configured schedule exactly matches the repository contract;
- at least one recent execution is present;
- the latest execution succeeded;
- the latest successful execution ended no more than 30 hours before
  `checked_at`;
- no non-`succeeded` execution appears within the preceding 30 hours.

The 30-hour freshness window is the expected 24-hour daily cadence plus a
6-hour operational grace period.

The evidence includes up to seven recent runs per job for operator-readable
history.

Separately, the SQL query counts every non-`succeeded` execution within the
preceding 30 hours in `recent_non_succeeded_count_30h`. This aggregate is not
limited to the seven displayed runs. Verification requires the count to be
exactly `0`, preventing a recent failed execution from being hidden by seven
newer successful runs.

A recovered non-`succeeded` execution older than 30 hours that remains visible
in the recent-run history is reported as a warning rather than a current-health
failure.

Exactly 30 hours is still inside the current-health window:

- latest success age `<= 30h`: PASS for freshness;
- non-`succeeded` run age `<= 30h`: FAIL.

## Generate read-only evidence

Run:

`scripts/ops/query_retention_purge_health.sql`

against the target Supabase/Postgres environment using an operator-controlled
SQL session.

The query is read-only and returns one JSON value with schema:

`retention-purge-health-evidence-v1`

It does not include application rows, identities, credentials,
`return_message`, or product health values.

Do not commit production evidence to the repository. Save it to a temporary
local file when verification is required.

## Verify evidence offline

Example on Windows PowerShell:

```powershell
$evidencePath = Join-Path $env:TEMP 'retention-purge-health-evidence.json'

python scripts/ci/verify_retention_purge_health.py $evidencePath
```

Expected PASS output:

```text
retention purge health evidence verified; no network access
```

The verifier performs no network or database access.

Its internal contract can be tested independently with:

```powershell
python scripts/ci/verify_retention_purge_health.py --self-test
```

Expected output:

```text
retention purge health verifier self-test passed; no network access
```

## Failure interpretation

Treat these conditions as purge-health failures:

- an expected job is missing or duplicated;
- an expected job is inactive;
- its schedule changed;
- no recent execution is available;
- the latest execution did not succeed;
- the latest success is older than 30 hours;
- a non-`succeeded` execution occurred within the last 30 hours.

Do not respond to a verification failure by immediately changing retention or
cron configuration.

First classify the failure as one of:

- metadata/configuration drift;
- scheduler execution failure;
- database/permission or evidence-access failure;
- verifier/evidence-contract failure.

## Read-only failure diagnosis

If an execution failure is present, an operator may inspect cron metadata with
a read-only query such as:

```sql
select
  j.jobname,
  r.status,
  r.start_time,
  r.end_time,
  r.return_message
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where j.jobname in (
  'purge-expired-observation-records',
  'purge-expired-active-challenges'
)
order by r.start_time desc
limit 20;
```

`return_message` is for operator diagnosis only and is intentionally excluded
from the portable health evidence schema.

Do not inspect product-row contents merely to diagnose cron health.

## Escalation boundary

A purge-health failure does not authorize a production mutation.

Before changing a job, migration, retention rule, or RLS policy:

1. preserve the failed read-only evidence;
2. identify whether the problem is repository code, production configuration,
   permissions, or the database scheduler;
3. determine whether expired rows remain protected by the exact-time RLS
   boundary;
4. create or update the relevant tracked issue;
5. obtain separate production-change approval.

## Current verification record

On 2026-09-09, the production metadata inspected for Issue #383 showed:

- both expected jobs active;
- both expected schedules matched;
- all inspected recent executions succeeded;
- both latest successful runs were well within the 30-hour freshness window;
- the repository verifier accepted the generated production evidence.

This is a point-in-time verification, not continuous monitoring or an alerting
system.

## Non-goals

This runbook does not introduce:

- continuous monitoring infrastructure;
- Prometheus or Grafana;
- a new alerting service;
- changes to purge SQL;
- changes to the 30-day retention contract;
- changes to RLS;
- product-row inspection;
- production deployment.