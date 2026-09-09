# Recovery contract

Issue #387 / R10 defines the recovery boundary for the current SK7
architecture.

This document is a repository recovery contract. It is not a claim that every
provider-managed recovery mechanism is currently enabled, nor is it approval
for a production restore.

Canonical R10 baseline:

`bd5a80cad4e8428f39b97c2f0c5a4e2dee728182`

## Recovery principles

Release rollback, schema reconstruction, and data recovery are different
operations.

- Runtime rollback restores a known-good deployed application identity.
- Schema reconstruction recreates repository-owned database objects and policy.
- Data recovery restores state that existed before a destructive or corrupting
  event.
- Product retention is not backup retention.
- A migration repository is not a backup of user rows or Auth identities.
- A successful local reconstruction is not a production managed-backup restore.
- Secrets and raw user data must not be copied into repository recovery evidence.

Unknown or unavailable facts remain explicit. They are not converted into
assumed RPO or RTO values.

## Recovery matrix

| Surface | Recovery authority | Current recovery point | Verification | RPO / data-loss meaning | RTO state |
|---|---|---|---|---|---|
| Repository source | Git commit history and canonical `main` | Exact immutable source SHA | R9 release provenance and repository history | Not a user-data RPO | No numeric target required for source identity |
| API runtime | Immutable Cloud Run revision/image plus release provenance | Current S11 identity and distinct known-good rollback identity | Existing API activation / rollback / restore rehearsal | Stateless runtime rollback does not restore lost database state | Rollback path verified; numeric production recovery-time objective not established by R10 |
| Web runtime | Deployment mirror, Cloudflare Worker version, and distinct known-good rollback Worker | Current S11 Worker and prior known-good Worker | Existing web clean-release / rollback / restore rehearsal | Stateless runtime rollback does not restore lost database/Auth state | Rollback path verified; numeric production recovery-time objective not established by R10 |
| Supabase schema / RLS / scheduled-job definitions | Versioned migrations plus repository tests | Canonical migration inventory at the selected source SHA | R10 isolated synthetic reconstruction PASS | Repository definitions can be reconstructed; this does not restore user rows | Local reconstruction observed; not a production RTO measurement |
| Supabase product rows | Provider-managed backup/restore or a separately approved data-copy strategy | **NONE observed on 2026-09-09** | Read-only Supabase Dashboard observation: current project is Free Plan and project backups are not included | **Finite provider-managed RPO: NOT ESTABLISHED** | **NOT MEASURED** because no managed restore point is currently available |
| Supabase Auth identities | Provider-supported recovery mechanism; exact project-specific recovery semantics remain provider-dependent | No current managed restore point was observed | Current Free Plan / backup observation only | **Finite managed RPO: NOT ESTABLISHED**; Auth-specific restore semantics remain **INCONCLUSIVE** | **NOT MEASURED** |
| Purge schedules / retention policy | Repository migrations and operational runbook | Versioned definitions | Migrations, pgTAP, and R8 purge-health evidence | Definitions are reconstructable; historical cron execution state is not a data backup | Local reconstruction only |
| Runtime configuration / secrets | Authorized provider configuration and secret owners | Secret values are intentionally absent from repository evidence | Secret-boundary contract | Secret value recovery is not established by Git history; exact recovery responsibility remains operational | **INCONCLUSIVE** unless separately verified without exposing values |
| Frozen Model V2 contract | Release contract, schema identity, and approved artifact SHA-256 | `model-v2-r1-schema-v1` / `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84` | Existing artifact identity verification | Repository evidence identifies the required artifact, but independent recovery/version-retention of the external artifact bytes is **INCONCLUSIVE** | **INCONCLUSIVE** |

## Supabase production backup state

Read-only operator inspection on 2026-09-09 established:

- production project: `ah-05-07-prod`
- project ref: `fglyixpysarmxfxwcgby`
- region: `ap-northeast-2`
- project status at inspection: `ACTIVE_HEALTHY`
- plan shown by the Dashboard: Free Plan
- scheduled managed project backups: not included on the current plan
- PITR: not active; the Dashboard presents it as a paid-plan capability
- current managed restore point observed: none

No restore, upgrade, backup enablement, database write, Auth mutation, or other
production mutation was performed during this inspection.

This state must not be translated into an assumed `24h`, `7d`, or other finite
RPO. There is no evidence supporting such a value for the current project.

## RPO contract

### Stateless application identities

For Git source, immutable API runtime identity, and immutable web runtime
identity, a user-data RPO is not the correct metric. Recovery selects an exact
known-good identity.

### Product database and Auth state

Required production data RPO:

`NOT SET — CURRENT RESIDUAL RISK ACCEPTED 2026-09-09`

Current provider-managed data recovery state:

`NO MANAGED RESTORE POINT — FINITE RPO NOT ESTABLISHED`

Reason:

The current production Supabase project has no observed managed backup or PITR
restore point.

R10 does not automatically upgrade the project, enable PITR, introduce custom
backups, duplicate production data, or create a replication service merely to
make the audit appear complete.

If the owner requires a finite production data RPO, that requirement must be
stated explicitly and then compared with provider capabilities, cost, privacy,
retention, and restore semantics before a recovery strategy is changed.

Any recovery strategy that introduces new data-copy semantics requires the
architecture decision process before implementation.

## RTO contract

Required production database/Auth RTO:

`NOT SET — CURRENT RESIDUAL RISK ACCEPTED 2026-09-09`

Observed production managed-restore RTO:

`NOT MEASURED`

There is currently no managed restore point against which a production data
restore time can be measured.

Existing API and web rollback rehearsals prove the application runtime rollback
paths, but those exercises are not a database/Auth RTO measurement.

The R10 isolated synthetic reconstruction also must not be reported as a
production RTO result.

## Isolated reconstruction evidence

R10 executed an isolated synthetic reconstruction on macOS without production
credentials or production data.

Source:

`bd5a80cad4e8428f39b97c2f0c5a4e2dee728182`

Toolchain:

- Python environment: `3.13.14`
- Node: `24.11.0`
- uv: `0.12.8`
- Supabase CLI: `2.116.0`
- Docker: `29.7.2`
- Docker endpoint: local Unix socket only

External local evidence run:

`issue-387-20260909-193015`

The report is intentionally retained outside the repository. Its absolute
operator-local path is not part of this contract; integrity is anchored by the
report SHA-256 below.

Report SHA-256:

`c15fc534d0b9564bb1381a42f2215881b841f6a57ffa63742f4453c3de2bc9ae`

Report size:

`22650` bytes

Verified outcomes include:

- frozen Python dependency installation
- clean web dependency installation and build
- web secret-boundary verification
- isolated Supabase initialization
- repository migrations applied to the isolated stack
- ownership / active-challenge / exact-time-retention pgTAP suites PASS
- built web/API smoke PASS
- synthetic owner CRUD/export PASS
- cross-user read/write denial PASS
- anonymous access contract PASS
- duplicate and invalid-input contracts PASS
- first-check-in challenge lock PASS
- status-only check-in edit/delete PASS
- model-not-ready `503` contract PASS
- bounded local PostgREST failure normalized and recovered
- preserved source bytes PASS
- no unexpected stage failure

Cleanup:

- owned synthetic container count: `0`
- owned synthetic volume count: `0`
- pre-existing running containers preserved
- raw logs retained: `false`
- credentials or row exports retained: `false`

This proves that repository-owned application/schema/policy definitions can be
reconstructed in an isolated synthetic environment. It does not prove that
production user data or Auth identities can be restored.

## Production restore drill disposition

Current disposition:

`DEFERRED — NO CURRENT MANAGED RESTORE POINT; SEPARATE OWNER APPROVAL REQUIRED`

A destructive/full production restore is not an R10 acceptance requirement in
the current state.

Reasons:

1. existing API and web rollback/restore paths are already rehearsed;
2. the current production database has no observed managed backup/PITR restore
   point;
3. forcing a production restore would add risk without proving a currently
   available data-recovery path;
4. isolated reconstruction already verifies repository-owned reconstruction
   without copying production data.

If a finite production data RPO is later adopted and a managed recovery point
exists, a provider-supported restore drill may be designed under a separate
approval gate. It must not use real production data in an unmanaged local or
disposable environment.

## Prohibited recovery shortcuts

Do not:

- treat the 30-day product retention period as backup retention;
- treat migration history as a copy of user data;
- use `supabase db push` as an incident-recovery shortcut without reconciling
  migration history;
- claim that API/web rollback restores deleted identities or rows;
- export secret values into Git, Issues, CI artifacts, or recovery evidence;
- copy real production user/Auth/health data into the local isolated drill;
- enable PITR, paid backup features, or a custom backup platform merely to close
  R10;
- change or replace the frozen Model V2 artifact;
- persist Model V2 inputs/results or join them with BP/challenge/prior-result or
  other-account data.

## Owner decision gate

Owner decision recorded on 2026-09-09:

`ACCEPT CURRENT RESIDUAL RISK`

The owner explicitly accepts the current project-stage residual risk:

- no managed database/Auth restore point is currently observed;
- no finite managed production-data RPO is established;
- no managed production restore RTO has been measured.

This decision resolves the R10 owner gate and allows R10 to close.

It does **not**:

- make production user rows or Auth identities recoverable;
- establish a finite production RPO or RTO;
- constitute a backup or restore SLA;
- authorize a Supabase plan upgrade, PITR, custom backup, replication, or
  production restore;
- authorize any R12 topology expansion.

A future requirement for a finite production RPO or RTO reopens the recovery
strategy review before any provider, cost, privacy, retention, or data-copy
change is made.

## R10 acceptance boundary

R10 status:

`COMPLETE — CURRENT RESIDUAL RISK ACCEPTED BY OWNER ON 2026-09-09`

The acceptance criteria are:

1. release rollback and data recovery are explicitly separated;
2. recovery authorities and current recovery points are identified;
3. unavailable recovery points remain explicit rather than assumed;
4. current achievable data RPO is truthfully classified;
5. the owner decision on required production data RPO/RTO is recorded without
   inferring unsupported numeric values;
6. isolated reconstruction is reproducible and evidence-backed;
7. production managed restore is explicitly performed or explicitly deferred
   with a reason;
8. no production mutation, real-user data copy, secret export, or Model V2
   semantic change was required for the audit.

R10 does not authorize R12 topology expansion.
