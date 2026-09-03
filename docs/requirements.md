# Requirements

SK7 (상균7데이즈) provides a versioned **입력 기반 위험군 선별 신호** and a seven-day record of home blood-pressure observations and one lifestyle challenge. Model output, measured blood pressure, and challenge adherence remain separate facts. The service does not provide diagnosis, treatment, prevention, or causal-improvement claims.

## Status legend

- **Implemented**: available in the current web/API path.
- **API only**: implemented in the API but not exposed in the web UI.
- **Partial**: part of the accepted contract exists; listed acceptance work remains.
- **Planned**: accepted for the 19-day pilot but not implemented.
- **Scaffold**: code exists but the capability is not released for production use.

## Functional requirements

| ID | Priority | Status | Actor | Contract | Exception / acceptance |
|---|---|---|---|---|---|
| FR-00 | P0 | Implemented | User | Continue with a Supabase email magic link and restore the browser session after reload. | Expired links and expired sessions must lead to a clear recovery action. |
| FR-01 | P0 | Planned | User | Submit baseline demographic and lifestyle inputs for a versioned risk assessment. | Reject missing, out-of-range, extra, or unit-ambiguous inputs. |
| FR-02 | P0 | Scaffold | System | Return risk band, probability, model version, and disclaimer only from a verified model artifact. | Return no provisional score when artifact, metadata, or split digest validation fails. |
| FR-03 | P0 | Partial | User | Record morning/evening systolic and diastolic observations with a measurement checklist. | Creation and seven-day read are implemented; checklist, edit, and web delete remain. |
| FR-04 | P0 | Implemented | User | Select one walking, sleep, or low-sodium challenge and check in for seven days. | Exactly one `active` challenge is allowed per user; its action can change only before the first check-in, and every check-in must belong to that user and the seven-day window. |
| FR-05 | P0 | Partial | System | Show risk signal, measured blood pressure, and challenge adherence as separate series. | Current web separates BP and challenge lists; risk signal and trend presentation remain. |
| FR-06 | P1 | Planned | User | Submit structured result feedback for review. | Review data is never an online-training label. |
| FR-07 | P0 | API only | User | Read, edit, delete, and export only records owned by the signed-in user. | BP edit, delete, and 30-day JSON export APIs exist; web controls remain. |
| FR-08 | P0 | Partial | System | Present truthful loading, empty, session-expiry, duplicate, network-failure, and retry states. | Web distinguishes successful save, session recovery, input correction, and unconfirmed persistence; duplicate and browser scenario evidence remain. |

## Non-functional requirements

| ID | Priority | Status | Contract | Acceptance evidence |
|---|---|---|---|---|
| NFR-01 | P0 | Planned | Publish a versioned latency and load baseline before freezing a P95 target. | Reproducible command, environment, sample size, and report. |
| NFR-02 | P0 | Planned | Equal normalized input plus model version returns equal output. | Repeated-input test against the immutable artifact. |
| NFR-03 | P0 | Partial | Training and validation remain disjoint; compare at least two models and multiple metrics. | Split digest, experiment manifest, model card, and leakage audit. |
| NFR-04 | P0 | Partial | Supabase JWT and RLS isolate every user's rows. | Two-user and anonymous negative integration tests; unauthorized row disclosure is zero. |
| NFR-05 | P0 | Implemented boundary | Real PHI and identifying content are out of scope. | Synthetic demo data; request bodies and health values absent from logs. |
| NFR-06 | P0 | Implemented | Application code, deployment mirror, Cloudflare Worker, Cloud Run API, and Supabase roles follow the deployment SSOT. | Fresh deployment and rollback performed from the documented procedure. |
| NFR-07 | P0 | Planned | Expose separate liveness and readiness checks without sensitive details. | Automated tests for healthy and dependency-unready states. |
| NFR-08 | P1 | Planned | Complete the core flow on mobile and desktop with keyboard-visible focus and adequate contrast. | Accessibility checklist and browser evidence. |

## Scope order

### P0 — pilot contract

- Verified input-based risk-group screening signal or an honest not-ready state
- One active seven-day challenge and daily check-ins
- BP observation checklist, create/read/edit/delete/export
- Separated seven-day view
- Failure recovery, health checks, RLS negative tests, observability, deployment evidence
- Requirements, ERD, API specification, wireframe, demo, and presentation consistency

### P1 — after P0

- Account closure and data-retention explanation
- Structured feedback review flow
- Accessibility and onboarding hardening
- Public R2 asset provenance and lifecycle

### P2 — only if schedule remains safe

- Explanatory image, video, and audio assets
- Reminders, richer visualization, multilingual or device-integration exploration

## Evaluation evidence

| Evaluation area | Evidence |
|---|---|
| Planning | This file, PRD, UX flow, architecture, Issue #99 |
| AI | Model card, split manifest, leakage audit, repeated-input test |
| API | Generated OpenAPI, integration tests, error-contract tests, latency report |
| Security | RLS policies, two-user negative tests, secret/log review |
| Operations | Deployment SSOT, health checks, revision and rollback evidence |
| Collaboration | Issues, short branches, pull requests, Actions, release tags |
