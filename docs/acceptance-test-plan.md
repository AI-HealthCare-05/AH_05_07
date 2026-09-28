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
| AC-02 | Fixed normalized baseline input is evaluated twice with one verified model version. | Model unit + API integration | Same result payload and model version; artifact digest and split digest recorded. | **Partial:** the frozen Model V2 artifact is released and build-pinned browser/runtime parity is enforced. The current browser path and API projection are available, but Issue #873 did not perform a fresh two-run end-to-end acceptance against the external artifact; NFR-02 therefore remains Planned for that exact gap. |
| AC-03 | Risk-signal screen is rendered for a verified artifact and for an unavailable artifact. | UI component + browser | Required wording and release disclaimer appear; unavailable artifact shows an honest not-ready state without a score. | **Complete for the current product contract:** signed-in S11 computes the verified frozen artifact browser-locally and, during the #396 window, shows the transient continuous research/development preview with its limitations and privacy cue. Unavailable execution remains fail-closed. Issue #873 verified the current production result and continuation without a feature-bearing inference request or persistence. |
| AC-04 | Open the BP form, review the measurement checklist, then submit out-of-range values, equal/reversed values, and an unknown field through browser and API. | DTO unit + API integration + browser | The concise checklist appears before the measurement fields without a diagnosis, treatment, prevention, or emergency claim; each invalid payload receives `422`; valid values save once; browser gives a clear correction message. | Partial: checklist and DTO/API mapping exist; Issue #169 adds a signed-in browser assertion that invalid input is blocked before a save request. Deployed browser evidence remains. |
| AC-05 | Synthetic users A and B plus an anonymous request attempt read, change, delete, and export. Seed an expired synthetic owner row without altering the product migration contract. | Supabase integration | Only the unexpired owner can act on its records; expired rows are absent before physical purge; cross-user access returns a non-disclosing result; anonymous requests fail. | **Complete:** Issue #149 Phase B passed anonymous denial, Synthetic A owner CRUD/export, Synthetic B cross-user non-disclosure, challenge ownership/first-check-in lock, and cleanup. Local exact-time retention pgTAP evidence covers expired-row invisibility, immutable expiry, and export exclusion. The owner-approved deployed synthetic expiry exercise verifies physical presence plus owner invisibility before purge, with rollback and zero residual synthetic Auth/BP rows in [the sanitized evidence](evidence/ac05-deployed-expiry-invisibility.md). |
| AC-06 | User chooses one action, checks in, then attempts a second action and attempts to replace the first selection. The user also corrects or confirms deletion of a current owned check-in. | Database migration + API integration + browser | Exactly one active seven-day challenge; daily completed/skipped check-in works; check-in status alone can change or be deleted during the active unexpired window; replacement locks after first check-in. | Partial: Issue #149 Phase B passed the signed-in first-check-in action lock and cross-user non-disclosure. Issue #174 adds synthetic-browser evidence for status-only edit plus cancel-before-delete and confirmed-delete/reload; deployed owner-flow evidence remains separate. |
| AC-07 | Seven-day view contains a model fact, a BP observation, and a challenge check-in. | UI component + browser review | At the visual-contract baselines, each fact has its own label and lane; no combined outcome or inferred relationship is shown through wording, order, color, or connection. | **Complete for the current contract:** focused current-source tests cover current/prior/ended periods, legacy read-only behavior, mixed-fact Living Week/report output, and separate S07/S08/S09/S10/S11 lanes. Issue #873 matched that source to production and verified the representative BP and Model V2 journey without combined scoring or causal wording. The optional challenge production path was not exercised in this RC. |
| AC-08 | Simulate session expiry, duplicate submission, network timeout, storage failure, empty window, and failed refresh with prior data. | API integration + browser | UI distinguishes initial loading, confirmed empty, stale refresh, saved, unsaved, conflict, unknown mutation outcome, retryable failure, and re-login states; no uncertain write is presented as saved. | **Complete for the current recovery contract:** current-source coverage distinguishes initial load, confirmed empty, stale read, known rejection, uncertain mutation, session expiry, explicit retry, saved and unsaved states without automatic retry. Issue #873 verified production S05/S12 and the production-bundle S13 recovery presentation, including narrow/200% text, visible focus, forced colors, and fixed-navigation clearance. Natural session expiry was not forced during the RC run. |
| AC-09 | Build the web client, run the secret-boundary verifier, then inspect representative Cloud Run logs after a synthetic request. | Static scan + deployment review | The verifier rejects service-role/secret markers, JWT-like literals, private-key blocks, and request or BP-value logging in application source; it allows the public Supabase publishable-key boundary. The deployment review confirms no email, request body, or health value appears in logs. | Implemented boundary: CI retains the source and built-asset verifier; Issue #166 completed the bounded manual review of the production Cloud Run requests stream. Only the absence result is retained. |
| AC-10 | Reproduce web/API deployment from the deployment SSOT in a clean environment, run the smoke verifier against public origins, then roll back one revision. | Deployment rehearsal | The synthetic self-test passes in CI; the public smoke command confirms web reachability, `/live`, `/ready`, and CORS without credentials or product data; revision IDs, environment-variable classes, and rollback result are recorded. | **Complete:** O3 [sanitized execution evidence](evidence/o3-clean-release-execution.md) records the API clean-release evidence. [AC-10 web evidence](evidence/ac10-web-clean-release-execution.md) records the approved source freeze, successful mirror sync, new Worker activation smoke, exact-version rollback and rollback smoke, restore, final smoke, and final 100% traffic. API deployment, DB/RLS/migration changes, account actions, product/health data writes, and AI Model actions were `0`. |

## Current execution authority

Issue #873 is the current RC verification record. It binds the reviewed canonical
source to the parentless deployment snapshot, successful Cloudflare build, serving
Worker version, public API revision, public smoke, bounded signed-in synthetic
journey, and representative responsive/accessibility sanity. Raw account, token,
health-value, response-body, and screenshot evidence is intentionally not retained.

The remaining current acceptance gaps are narrow:

1. **AC-02** — run the exact repeated-input acceptance against the frozen external
   artifact before changing NFR-02; existing artifact/unit parity is not relabelled.
2. **AC-04** — the RC verified a valid production save, not the full deployed invalid-
   input matrix.
3. **AC-06** — the optional production challenge journey was not selected in the RC;
   current source and ownership coverage remain unchanged.
4. The separately approved destructive production account-deletion A/B gate remains
   unexecuted. Issue #873 checked only its two-step scope copy and recovery presentation.
5. No manual screen-reader or platform-AT acceptance run was performed.

## Current Model V2 acceptance

The [Model V2 product contract](model-v2-product-contract.md#current-authority) and
open Issue #396 own current behavior. The frozen Model V2 path is released: signed-in
S11 validates the 19-field product input, computes browser-locally from the build-
pinned artifact, and exposes the current result and continuation without a feature-
bearing inference POST or persistence. The authenticated API remains the separate
two-field `schema_version` plus `product_wording` projection; the legacy risk-signal
route remains separately unavailable.

The numeric research/development preview is authorized only from **2026-09-17 through
2026-10-17 KST**. At **2026-10-18 00:00 KST**, S11 returns to non-numeric output unless
a separate human decision extends the window. The value is not a probability,
percentage, percentile, threshold, band, diagnosis, normal/abnormal result, severity,
future-incidence estimate, or treatment/prevention effect. It is not persisted, and
this acceptance plan authorizes no additional Model V2 research.
