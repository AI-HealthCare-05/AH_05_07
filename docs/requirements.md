# Requirements

SK7 (상균7데이즈) currently provides a seven-day record of home blood-pressure observations and one lifestyle challenge. Authenticated Model V2 production paths provide a versioned **입력 기반 위험군 선별 신호** through the frozen product contract: the product response projects only `schema_version` and `product_wording`, while raw Model V2 input and internal numeric inference results remain transient and are not stored or exposed. The legacy `/api/v1/risk-signal` scaffold remains separately `model_not_ready`. Model output, measured blood pressure, and challenge adherence remain separate facts. The service does not provide diagnosis, treatment, prevention, or causal-improvement claims.

[MVP1 closeout](mvp1-closeout.md) maps these internal requirements to the Talos original requirements and evidence. The current Model V2 product projection and this internal P0 scope do not establish client acceptance of missing future-onset prediction and prediction trends. Talos's external API P95 3-second criterion remains unverified; the small UI timing baseline does not satisfy it.

## Status legend

- **Implemented**: available in the current web/API path.
- **API only**: implemented in the API but not exposed in the web UI.
- **Partial**: part of the accepted contract exists; listed acceptance work remains.
- **Planned**: accepted for the 19-day pilot but not implemented.
- **Scaffold**: code exists but the capability is not released for production use.

For a new requirement or a material revision, start with the
[requirements definition template](requirements-definition-template.md). The
template records proposed scope and evidence; this file remains the current
product-requirements authority after review and merge.

## Functional requirements

| ID | Priority | Status | Actor | Contract | Exception / acceptance |
|---|---|---|---|---|---|
| FR-00 | P0 | Implemented | User | Continue with a Supabase email magic link and restore the browser session after reload. | Expired links and expired sessions must lead to a clear recovery action. |
| FR-01 | P0 | Implemented | User | Submit validated Model V2 product inputs for a versioned 입력 기반 위험군 선별 신호. | Reject missing, out-of-range, extra, or unit-ambiguous inputs. The authenticated S11 product path is `/api/v1/model-v2/product-score`; raw product input and inference result are not persisted. |
| FR-02 | P0 | Implemented | System | Return only `schema_version` and `product_wording` from the frozen Model V2 product contract. | Do not expose or persist numeric score, probability, or band. If Model V2 is disabled, unavailable, or cannot use its artifact boundary, return `503 model_not_ready` without numeric output. The legacy `/api/v1/risk-signal` scaffold remains separately unavailable. |
| FR-03 | P0 | Implemented | User | Record morning/evening systolic and diastolic observations with a measurement checklist. | The web shows a concise pre-measurement guide before the fields; it is not stored, does not block saving, and does not provide diagnosis, treatment, prevention, or emergency guidance. |
| FR-04 | P0 | Implemented | User | Select one walking, sleep, or low-sodium challenge and check in for seven days. | Exactly one `active` challenge is allowed per user; its action can change only before the first check-in, and every check-in must belong to that user and the seven-day window. |
| FR-05 | P0 | Partial | System | Keep the 입력 기반 위험군 선별 신호, measured blood pressure, challenge participation, and legacy records as separate facts across the current, previous, and ended seven-day views. | Living Week trail, day detail/summary, record explorer, and human-readable seven-day report reuse already-read seven-day facts without merging them into a score or causal/improvement conclusion. Model V2 remains separate from BP and challenge history. |
| FR-06 | P1 | Planned | User | Submit structured result feedback for review. | Review data is never an online-training label. |
| FR-07 | P0 | Partial | User | Read, edit, delete, and export only unexpired records owned by the signed-in user. | RLS hides an owned record at its 30-day `expires_at`; daily cron removes it later as physical cleanup. Web connects current owned BP read, edit, explicit-confirmation delete, and selected-seven-day JSON export; current active-challenge check-ins support status-only edit and explicit-confirmation delete. Prior and ended seven-day periods are available for read-only review inside their retained data window. |
| FR-08 | P0 | Partial | System | Present truthful loading, empty, session-expiry, duplicate, network-failure, and retry states. | Web distinguishes successful save, session recovery, input correction, and unconfirmed persistence. Issue #190 gives confirmed-save, confirmed-empty, initial-load failure, stale refresh, and signal-not-ready their own semantic presentation while retaining the no-automatic-retry boundary. Production visual evidence remains. |
| FR-09 | P1 | Planned | System | If measurement demonstrates that a future distinct verified-model workload cannot finish within the accepted request budget, expose a persisted assessment-job lifecycle separately from observations and challenge adherence. | Requires a separate approved product/data contract, an ADR, a measured trigger, PostgreSQL-persisted state/result, idempotency, timeout/retry policy, and a sanitized status contract. Until then, no worker or queue is introduced; this conditional path does not change the frozen Model V2 product contract. |
| FR-10 | P1 | Implemented | User | After two-step confirmation, delete the signed-in user's Auth account and dependent product records, then return the browser to an anonymous state. | `DELETE /api/v1/account` implementation and production activation are complete. The separately approved signed-in synthetic A/B destructive production gate remains unexercised, so that evidence gap must not be presented as verified. |

## Non-functional requirements

| ID | Priority | Status | Contract | Acceptance evidence |
|---|---|---|---|---|
| NFR-01 | P0 | Partial | Publish a versioned latency and load baseline before freezing a P95 target. | Sanitized pre/post-index initial and warm measurements in [observation-load-baseline.md](observation-load-baseline.md); expand the sample before setting a target. |
| NFR-02 | P0 | Planned | Equal normalized input plus model version returns equal output. | Repeated-input test against the immutable artifact. |
| NFR-03 | P0 | Partial | Training and validation remain disjoint; compare at least two models and multiple metrics. | Split digest, experiment manifest, model card, and leakage audit. |
| NFR-04 | P0 | Implemented | Supabase JWT and RLS isolate every user's rows. | Issue #149 Phase B passed approved synthetic two-user owner CRUD/export, cross-user non-disclosure, anonymous denial, and cleanup without retaining identifiers or values. |
| NFR-05 | P0 | Implemented boundary | Real PHI and identifying content are out of scope. | Synthetic demo data; request bodies and health values absent from logs. |
| NFR-06 | P0 | Partial | Application code, deployment mirror, Cloudflare Worker, Cloud Run API, and Supabase roles follow the deployment SSOT. | Prior rollback/restore evidence exists; clean-environment deployed reproduction remains under the closeout operations plan. |
| NFR-07 | P0 | Implemented | Expose separate liveness and configuration-readiness checks without sensitive details. | Automated tests for healthy and configuration-unready states; production smoke remains. |
| NFR-08 | P1 | Partial | Complete the core flow on mobile and desktop with keyboard-visible focus and adequate contrast. | Issue #190 implements the shared token layer, 44 px controls, visible focus, reduced-motion fallback, 320 px/mobile/desktop reflow, and S01–S14 semantic structure. Canonical viewport captures, 200% zoom review, contrast review, and production visual QA remain under the [visual production contract](visual-production-contract.md). |
| NFR-09 | P1 | Planned | Adopt asynchronous model processing only when an ADR and measured latency, duration, or reliability need justify it. | The ADR records the threshold, producer/consumer responsibility, persisted job state, retry/idempotency/timeout behavior, result retention, and security/log boundary. Redis or a separate worker is not a default requirement. |

## Scope order

### P0 — pilot contract

- Frozen Model V2 input-based risk-group screening signal with the approved two-field product projection; keep the legacy risk-signal scaffold separate and honestly unavailable
- One active seven-day challenge and daily check-ins
- BP observation checklist, create/read/edit/delete/export
- Separated seven-day view with non-causal trend presentation, empty states, and evidence captures
- Failure recovery, health checks, RLS negative tests, observability, deployment evidence
- Requirements, ERD, API specification, wireframe, demo, and presentation consistency

### P1 — after P0

- Complete the separately approved production synthetic verification gap for self-service account removal and keep the data-retention explanation current
- Structured feedback review flow
- Accessibility and onboarding hardening
- Conditional asynchronous model-job path only after the ADR and measured requirement
- Public R2 asset provenance and lifecycle

### P2 — only if schedule remains safe

- Explanatory image, video, and audio assets
- Reminders, richer visualization, multilingual or device-integration exploration

## Evaluation evidence

| Evaluation area | Evidence |
|---|---|
| Planning | This file, PRD, UX flow, architecture, visual production contract, Issue #99 |
| AI | Model card, split manifest, leakage audit, repeated-input test |
| API | Generated OpenAPI, integration tests, error-contract tests, latency report |
| Security | RLS policies, two-user negative tests, secret/log review |
| Operations | Deployment SSOT, health checks, revision and rollback evidence |
| Collaboration | Issues, short branches, pull requests, Actions, release tags |
