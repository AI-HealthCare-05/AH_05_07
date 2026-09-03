# Gate A acceptance evidence plan

## Purpose

This plan turns PRD acceptance conditions AC-01 through AC-10 into repeatable evidence. A checkbox is complete only when the listed evidence is attached to its Issue or pull request. Browser, API, and Supabase checks use synthetic accounts and synthetic values only.

## Evidence rules

- Keep user identity, model facts, blood-pressure observations, and challenge adherence separate in every fixture, assertion, screenshot, and log.
- Use the exact user-facing wording **입력 기반 위험군 선별 신호** whenever the feature is released.
- Record command, environment, commit, timestamp, and result. Redact JWTs, service-role keys, email addresses, and health values from shared logs or images.
- A manual check is acceptable for a deployment-console action only when its steps and evidence are reproducible. Product behavior needs an automated check whenever its dependencies allow it.

## Acceptance matrix

| AC | Scenario and precondition | Check level | Expected evidence | Current status |
|---|---|---|---|---|
| AC-01 | Synthetic user opens an email link, reloads the page, and visits it in a new tab before session expiry. | Browser E2E + manual production smoke | Session remains available; owned seven-day records load; no access token in capture. | Partial: implemented flow; no automated browser evidence. |
| AC-02 | Fixed normalized baseline input is evaluated twice with one verified model version. | Model unit + API integration | Same result payload and model version; artifact digest and split digest recorded. | Blocked: verified artifact not released. |
| AC-03 | Risk-signal screen is rendered for a verified artifact and for an unavailable artifact. | UI component + browser | Required wording and release disclaimer appear; unavailable artifact shows an honest not-ready state without a score. | Blocked: web flow not connected. |
| AC-04 | Open the BP form, review the measurement checklist, then submit out-of-range values, equal/reversed values, and an unknown field through browser and API. | DTO unit + API integration + browser | The concise checklist appears before the measurement fields without a diagnosis, treatment, prevention, or emergency claim; each invalid payload receives `422`; valid values save once; browser gives a clear correction message. | Partial: checklist, DTO/API, and browser correction mapping exist; deployed browser evidence remains. |
| AC-05 | Synthetic users A and B plus an anonymous request attempt read, change, delete, and export. Seed an expired synthetic owner row without altering the product migration contract. | Supabase integration | Only the unexpired owner can act on its records; expired rows are absent before physical purge; cross-user access returns a non-disclosing result; anonymous requests fail. | Partial: repeatable pgTAP ownership and exact-time retention suites cover the export-source tables; linked-project execution evidence remains. |
| AC-06 | User chooses one action, checks in, then attempts a second action and attempts to replace the first selection. The user also corrects or confirms deletion of a current owned check-in. | Database migration + API integration + browser | Exactly one active seven-day challenge; daily completed/skipped check-in works; check-in status alone can change or be deleted during the active unexpired window; replacement locks after first check-in. | Partial: migration, API, and web flow are implemented; deployed database/RLS and browser evidence remain. |
| AC-07 | Seven-day view contains a model fact, a BP observation, and a challenge check-in. | UI component + browser review | Each fact has its own label and series; no combined outcome or inferred relationship is shown. | Partial: BP and challenge lists are separate; risk-signal view absent. |
| AC-08 | Simulate session expiry, duplicate submission, network timeout, storage failure, and empty window. | API integration + browser | UI distinguishes saved, unsaved, retryable, empty, and re-login states; no uncertain write is presented as saved. | Partial: web maps session, validation, lock, and unconfirmed-persistence states; duplicate and browser scenario suite remain. |
| AC-09 | Build the web client, run the secret-boundary verifier, then inspect representative Cloud Run logs after a synthetic request. | Static scan + deployment review | The verifier rejects service-role/secret markers, JWT-like literals, private-key blocks, and request or BP-value logging in application source; it allows the public Supabase publishable-key boundary. The deployment review confirms no email, request body, or health value appears in logs. | Partial: repeatable source and built-asset verification is in CI; representative production-log review remains manual. |
| AC-10 | Reproduce web/API deployment from the deployment SSOT in a clean environment, run the smoke verifier against public origins, then roll back one revision. | Deployment rehearsal | The synthetic self-test passes in CI; the public smoke command confirms web reachability, `/live`, `/ready`, and CORS without credentials or product data; revision IDs, environment-variable classes, and rollback result are recorded. | Partial: repeatable smoke verifier and deployment SSOT exist; clean rehearsal and rollback evidence remain. |

## Execution order

1. **AC-06** — implement the one-active-challenge data model first because it resolves R-01 and changes API/UI contracts.
2. **AC-05** — run live RLS negative tests before adding broader record controls.
3. **AC-04 and AC-08** — normalize validation, conflict, session, and storage-failure behavior.
4. **AC-09 and AC-10** — add repeatable operational evidence before the pilot expands.
5. **AC-02, AC-03, and AC-07** — connect a risk-signal flow only after the model release gate passes.

## Gate A decision rule

Gate A can be marked complete when the requirements, API contract, architecture/ERD, risk register, and this matrix agree on the current state and next P0 work. Passing every AC is not required for Gate A; the unresolved conditions remain explicit P0 work and must not be represented as complete.
