# Gate A data boundary and risk register

## Audit basis

- Baseline: `main` commit `9a1f228` after PR #100
- Scope: Supabase observation storage, API, web flow, existing tests, and model-release boundary
- Owner: Ahn Sangkyoon
- Status: Gate A D3 audit; this document records current evidence and does not claim a risk is closed before its listed closure evidence exists.

## Current persisted entities

| Entity | Current storage | Ownership and retention | Accepted target gap |
|---|---|---|---|
| Blood-pressure observation | `blood_pressure_observations` | `auth.users.id`, RLS, 30-day expiry, daily purge | Preserve the owned update/delete and recent-seven-day export controls. |
| Legacy challenge event | `challenge_events` | `auth.users.id`, RLS, 30-day expiry, daily purge | Retain only as a readable legacy record until expiry; do not use it to select the active challenge. |
| Active challenge | `active_challenges` | `auth.users.id`, RLS, one active row per user, 30-day expiry, daily purge | Verify deployed RLS and trigger behavior with two synthetic users. |
| Challenge check-in | `challenge_checkins` | Same user as active challenge, RLS, one date per challenge, seven-day trigger boundary, 30-day expiry | Verify deployed trigger and upsert behavior with synthetic data. |
| Risk-signal result | No product record is currently persisted | No released result without a verified artifact | Add versioned result storage only after the release gate passes. |

The legacy `challenge_events` table alone cannot enforce one active challenge because it allows different action IDs on the same day. The active-challenge and check-in tables establish that product rule without rewriting retained legacy records.

## Data handling classes

| Class | Allowed example | Handling rule |
|---|---|---|
| Restricted product record | Supabase user UUID, observation date/period/values, action ID, status, created/expiry timestamps | Send only with the caller's JWT; store in RLS-protected structured tables; retain for the documented period; support owned deletion and export. |
| Restricted model fact | Model version, artifact digest, input completeness, result band/probability after release | Keep separate from observations and adherence; no release until artifact verification passes. |
| Operational configuration | Public API URL, Supabase URL, publishable client key | Expose only values intended for the browser; never place a service-role key in the client or repository. |
| Public demo asset | Synthetic screenshot, licensed tutorial image, presentation video | Keep provenance and lifecycle metadata; never use an identifiable product record. |
| Prohibited | Name, contact, free-text health history, original document, raw device export, JWT, service-role key | Do not collect, persist, log, upload to R2, commit, or show in a demo. |

## Current controls and evidence

| Control | Evidence | Current limitation |
|---|---|---|
| Caller identity | API validates the Supabase access token and uses the resulting user ID for writes. | Signed-in recovery/browser automation remains separate evidence. |
| Row ownership | Issue #149 Phase B passed anonymous denial, owner CRUD/export, cross-user non-disclosure, and active-challenge first-check-in lock with two synthetic accounts; cleanup completed. | Deployed expired-row evidence and automated browser coverage remain separate. |
| Browser key boundary | Web build uses the Supabase publishable key and caller JWT. | Bundle and deployment-variable checks are not automated. |
| Input bounds | Database constraints and API DTO validation limit period, ranges, status, and action ID. | A visible checklist supports consistent measurement conditions but cannot verify real-world conditions or prove adherence to the guide. |
| Duplicate prevention | Unique keys cover user/date/period for BP and user/date/action for challenge events. | A clear conflict/update experience is absent. |
| Retention | RLS excludes every owned product row at `expires_at`; database triggers assign the 30-day deadline and reject extension; pg_cron purges daily. | Production migration evidence remains required before this control is claimed in the deployed project. |
| Model release gate | Risk-signal route returns not-ready without a verified artifact. | Artifact, metadata, split digest, and repeatability evidence are not complete. |

## Active risk register

| ID | Risk | Priority | Evidence | Mitigation | Closure evidence |
|---|---|---|---|---|---|
| R-01 | A legacy challenge-event record could be mistaken for the active seven-day challenge. | P0 | `challenge_events` remains only for the previous flow; new tables, API, and UI use `active_challenges` plus `challenge_checkins`; Issue #149 Phase B passed the normal-path first-check-in lock and cross-user non-disclosure. | Keep the legacy route API-only and add browser evidence for current check-in status edit/delete. | Current owned check-in edit/delete browser evidence is retained without exposing synthetic values. |
| R-02 | JWT/RLS ownership is configured but has no deployed two-user and anonymous negative test. | Resolved | Issue #149 Phase B passed anonymous `401` denial, synthetic owner CRUD/export, cross-user non-disclosure, action lock, and cleanup. | Preserve the local pgTAP contract and repeat this sanitized exercise after any ownership-policy or access-path change. | A later contract-affecting release has equivalent sanitized two-user and anonymous evidence. |
| R-03 | The 30-day lifecycle could be represented as purge-only rather than access-bound. | P0 | Forward migration adds `expires_at > now()` to all four ownership policies and server-enforces the insert deadline; local pgTAP covers denied expired access and attempted extension. | Apply the reviewed migration through the production migration gate and retain the daily jobs only for physical cleanup. | Linked production migration history, policy inspection, and synthetic verification show expired rows are unavailable before the next purge. |
| R-04 | A browser update or delete control could imply that a user can rewrite challenge history or another user's record. | P0 | Check-in update accepts only `status`; record ID is resolved through caller JWT and RLS. | Keep date, action, challenge link, and owner immutable; permit controls only for the current unexpired active challenge; require explicit confirmation for delete and preserve a non-disclosing missing-record response. | API and browser checks show only a current owned check-in status changes or is deleted. |
| R-05 | A verified risk-signal artifact is not yet available. | P0 | Route is intentionally not ready. | Complete manifest, feature-availability and leakage audit, frozen split, model comparison, artifact metadata, and repeatability check. | Versioned result is returned only after every release-gate check passes. |
| R-06 | Error shapes differ between FastAPI validation and application errors. | P0 | Validation returns a FastAPI detail array; application errors use `detail.code`. | Define and test one web-facing error normalization contract. | Invalid input, expired session, conflict, storage failure, and unknown failure show stable recovery states. |
| R-07 | Operational logging and browser bundle boundary are documented but not fully audited. | P0 | The repository verifier checks application source and built browser assets for forbidden credential markers, JWT-like literals, private-key blocks, and request/BP-value logging. It cannot inspect production logs. | Keep the verifier in CI and perform a representative Cloud Run log review after a synthetic request. | Verifier passes; review report shows no secret, JWT, email, request body, or health-value exposure in representative logs. |
| R-08 | A process outage, readiness failure, or CORS mismatch can be confused with a browser or record-storage issue. | P0 | `/live` and `/ready` have automated checks; the deployment smoke verifier checks public web reachability, health payloads, and CORS preflight without sending credentials or product data. | Run the verifier after releases; keep liveness separate from configuration readiness and do not expose configuration values or product records. | Local self-test and public smoke command pass; healthy and configuration-unready responses remain independently verified. |

## Gate A closure order

1. Keep D2 documentation alignment completed through PR #100.
2. Keep this risk register current as each P0 item receives its own Issue and short branch.
3. Convert AC-01 through AC-10 into automated or manual test evidence, starting with R-02 and R-01.
4. Close Gate A only when the ERD, data-handling classes, requirements, API contract, and this register have no unresolved contradiction.

## Explicit non-claims

- The service presents an **입력 기반 위험군 선별 신호** only when its release gate is satisfied.
- Blood-pressure observations, model facts, and challenge adherence remain separate records.
- A completed challenge event is not evidence of a change in an observation.
