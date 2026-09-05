# Gate A acceptance evidence plan

## Purpose

This plan turns PRD acceptance conditions AC-01 through AC-10 into repeatable evidence. A checkbox is complete only when the listed evidence is attached to its Issue or pull request. Browser, API, and Supabase checks use synthetic accounts and synthetic values only.

## Evidence rules

- Keep user identity, model facts, blood-pressure observations, and challenge adherence separate in every fixture, assertion, screenshot, and log.
- Use the exact user-facing wording **입력 기반 위험군 선별 신호** whenever the feature is released.
- Record command, environment, commit, timestamp, and result. Redact JWTs, service-role keys, email addresses, and health values from shared logs or images.
- A manual check is acceptable for a deployment-console action only when its steps and evidence are reproducible. Product behavior needs an automated check whenever its dependencies allow it.
- Visual changes follow the [visual production contract](visual-production-contract.md): use its canonical synthetic fixtures, fixed locale/timezone, responsive baselines, accessibility checks, and sanitized evidence. Loading, confirmed-empty, stale-data, conflict, and unknown-mutation-outcome states remain distinct.

## Acceptance matrix

| AC | Scenario and precondition | Check level | Expected evidence | Current status |
|---|---|---|---|---|
| AC-01 | Synthetic user opens an email link, reloads the page, and visits it in a new tab before session expiry. | Browser E2E + manual production smoke | Session remains available; owned seven-day records load; no access token in capture. | Implemented evidence: Issue #143 records a passed operator-reviewed magic-link and session-refresh check; Issue #169 adds a synthetic signed-in `401` recovery transition with no real token; Issue #180 defines the [sanitized operator checklist](email-link-session-verification.md); Issue #182 records the 2026-09-04 Chrome synthetic-account result: email-link sign-in, reload, and same-browser new tab passed, while expired/invalid recovery was not run. |
| AC-02 | Fixed normalized baseline input is evaluated twice with one verified model version. | Model unit + API integration | Same result payload and model version; artifact digest and split digest recorded. | Blocked: verified artifact not released. Issue #208 has user-approved prepared_not_trained evidence and a Windows operator report in [the Gate 1B evidence record](model-gate-1b-evidence.md); [approved internal validation](model-comparison-evidence.md) and [published uncertainty](model-uncertainty-evidence.md) exist; the [release matrix](model-release-readiness.md) still blocks model release and promotion. |
| AC-03 | Risk-signal screen is rendered for a verified artifact and for an unavailable artifact. | UI component + browser | Required wording and release disclaimer appear; unavailable artifact shows an honest not-ready state without a score. | Partial: Issue #190 connects S11 as a dedicated unavailable-artifact screen with the canonical term, disclaimer, and no score, probability, or band. A verified artifact path remains blocked by the model release gate. |
| AC-04 | Open the BP form, review the measurement checklist, then submit out-of-range values, equal/reversed values, and an unknown field through browser and API. | DTO unit + API integration + browser | The concise checklist appears before the measurement fields without a diagnosis, treatment, prevention, or emergency claim; each invalid payload receives `422`; valid values save once; browser gives a clear correction message. | Partial: checklist and DTO/API mapping exist; Issue #169 adds a signed-in browser assertion that invalid input is blocked before a save request. Deployed browser evidence remains. |
| AC-05 | Synthetic users A and B plus an anonymous request attempt read, change, delete, and export. Seed an expired synthetic owner row without altering the product migration contract. | Supabase integration | Only the unexpired owner can act on its records; expired rows are absent before physical purge; cross-user access returns a non-disclosing result; anonymous requests fail. | Partial: Issue #149 Phase B passed anonymous denial, owner CRUD/export, and cross-user non-disclosure through the normal product path; synthetic accounts and records were removed. Deployed expired-row evidence remains separate. |
| AC-06 | User chooses one action, checks in, then attempts a second action and attempts to replace the first selection. The user also corrects or confirms deletion of a current owned check-in. | Database migration + API integration + browser | Exactly one active seven-day challenge; daily completed/skipped check-in works; check-in status alone can change or be deleted during the active unexpired window; replacement locks after first check-in. | Partial: Issue #149 Phase B passed the signed-in first-check-in action lock and cross-user non-disclosure. Issue #174 adds synthetic-browser evidence for status-only edit plus cancel-before-delete and confirmed-delete/reload; deployed owner-flow evidence remains separate. |
| AC-07 | Seven-day view contains a model fact, a BP observation, and a challenge check-in. | UI component + browser review | At the visual-contract baselines, each fact has its own label and lane; no combined outcome or inferred relationship is shown through wording, order, color, or connection. | Partial: Issues #184–#188 establish deterministic separate lanes, current/prior read-only behavior, and focused detail. Issue #190 distributes them across S07 Today detail, S08/S09 records, S10 recap, and S11 signal status while preserving their separation. The verified model fact, canonical viewport captures, and production visual QA remain. |
| AC-08 | Simulate session expiry, duplicate submission, network timeout, storage failure, empty window, and failed refresh with prior data. | API integration + browser | UI distinguishes initial loading, confirmed empty, stale refresh, saved, unsaved, conflict, unknown mutation outcome, retryable failure, and re-login states; no uncertain write is presented as saved. | Partial: Issues #169–#178 cover signed-in recovery, duplicate blocking, stale retention, mutation confirmation, normalized storage failure, the shared eight-second timeout, preserved draft, and no automatic retry. Issue #190 adds dedicated S05 confirmed-save, S12 confirmed-empty, and S13 initial-failure screens; S05 is unreachable from a URL alone and appears only after a confirmed mutation response. Real email-link and production visual coverage remain separate. |
| AC-09 | Build the web client, run the secret-boundary verifier, then inspect representative Cloud Run logs after a synthetic request. | Static scan + deployment review | The verifier rejects service-role/secret markers, JWT-like literals, private-key blocks, and request or BP-value logging in application source; it allows the public Supabase publishable-key boundary. The deployment review confirms no email, request body, or health value appears in logs. | Implemented boundary: CI retains the source and built-asset verifier; Issue #166 completed the bounded manual review of the production Cloud Run requests stream. Only the absence result is retained. |
| AC-10 | Reproduce web/API deployment from the deployment SSOT in a clean environment, run the smoke verifier against public origins, then roll back one revision. | Deployment rehearsal | The synthetic self-test passes in CI; the public smoke command confirms web reachability, `/live`, `/ready`, and CORS without credentials or product data; revision IDs, environment-variable classes, and rollback result are recorded. | Partial: Issue #151 verified rollback to `38bb08b6-66ca-4933-8cbe-ee857aa4ece7`, restore to `6d100754-7e85-4d43-b466-e7944c61a0c0`, and passed public smoke after both actions; the clean-environment rehearsal remains. |

## Execution order

Issue #225 consolidates the current gaps in [MVP1 closeout](mvp1-closeout.md), records
[local synthetic validation](mvp1-validation.md), and prepares [O1/O2/O3 operations](mvp1-operations-review.md).
Local browser/API/pgTAP/build evidence does not close the deployed gaps in the matrix.
The user's question-screen operation/display review is not input semantics or model approval.

1. **AC-04, AC-06, and AC-08** — retain signed-in browser evidence; do not extend the AC-01 result into forced expiry or token inspection.
2. **AC-05** — add separately approved deployed expired-row evidence; do not alter production time or retained records during this work.
3. **AC-10** — complete the documented clean-environment deployment rehearsal.
4. **AC-02, AC-03, and AC-07** — connect a risk-signal flow only after the model release gate passes.

The preparation prerequisite for step 4 is recorded in [approved Gate 1B evidence](model-gate-1b-evidence.md): 7,944 rows and matching two-run digests at the recorded execution commit. User publication approval is recorded separately from the Windows operator report and CI validation. Issue #208 is closed after PR #212 merge; model release requirements remain open.

## Gate A decision rule

Gate A can be marked complete when the requirements, API contract, architecture/ERD, risk register, and this matrix agree on the current state and next P0 work. Passing every AC is not required for Gate A; the unresolved conditions remain explicit P0 work and must not be represented as complete.

## Preparation semantics prerequisite

Preparation version 2 has approved preparation evidence. Before AC-02/03/07
model release work, the product input semantics still require review.
The single CLI and `tests/data` cover missing/partial BP, questionnaire special
codes, sleep end categories, source joins, manifest split ratios, train-only
imputation, source-order repeatability, XPT ingestion and failure/no-overwrite
behavior. The API regression confirms that artifact configuration alone cannot
bypass the missing input semantics agreement. These synthetic checks are separate
from the approved actual Gate 1B operator report; neither establishes product input equivalence or release readiness.

## Gate 1B closure and next implementation

PR #212 merged at `04ab996ba68c852fdf3f47ca94101294bd849f00`; its Windows/Linux
committed-evidence and synthetic checks plus general CI all passed. All #208
preparation/publication conditions were confirmed and the Issue was closed on
user instruction. The
approved evidence remains unchanged and `prepared_not_trained`, not model complete.
Issue #213 implements the bounded synthetic-tested train/validation comparison
path in `docs/model-comparison-runbook.md` and is complete through PR #214.
The later actual train/validation report is in `docs/model-comparison-evidence.md`.
AC-02/03/07 remain incomplete: conditional uncertainty limits, calibration and subgroup limitations,
external/Korean-user validation and quality/release criteria remain unresolved.
No test evaluation, serialization, promotion, adapter/UI change or deployment
is claimed.

## Current model evidence and release contract

Implementation #217 is complete through PR #218, merged at
`65ec302886cd6bcf288194ad2e2b6639e6f867a1`, with Windows/Linux synthetic CI passing.
The separately approved local uncertainty execution succeeded at that commit.
Publication #219 is complete through PR #220, merged at
`64aca180aab940a731c322fcf22693a5ec58d756`, with all 14 CI checks passing.
Both Issues are closed for their own scopes, not all model validation or release.
Prior comparison publication #215 remains complete via PR #216
(`b77f2ce3c81c620dcef4074fca60faaa88a8b5e7`). Approved JSON and execution records
are preserved in the [comparison](model-comparison-evidence.md) and
[uncertainty](model-uncertainty-evidence.md) reports.

Exploratory conditional intervals now exist: overall AP improvement is supported,
while overall AUROC/Brier difference intervals include zero. The status remains
`exploratory_uncertainty_not_promoted`. These pointwise intervals do not establish
training stability, multiplicity control, NHANES survey inference or Korean-user
validity. JSON verifier checks do not independently recalculate real-prediction
intervals. Older-age performance, calibration, external/Korean validation and
explicit release criteria remain unresolved.

Issue #221 completed its documentation scope in PR #222: [draft model card](model-card.md),
[unsupported input mappings and question drafts](model-input-adapter-contract.md),
and [readiness matrix and separately approved one-time test protocol](model-release-readiness.md).
Named reviewers, supported population, justified quality criteria, final model,
preprocessing and signal thresholds are not yet approved. No actual model/test
execution or product change is part of the question review package. Issue #223 adds
[CDC source comparison and a synthetic-only local review screen](input-question-review.md);
translation, measurement equivalence and adapter support remain pending. The API remains
model_not_ready; evidence, CONFIGs and lock are unchanged.
