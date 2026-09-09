# Architecture invariants

This is the repository-local, canonical contract for current and planned work. Status describes evidence in this repository; it is not runtime attestation.

| ID | Statement | Owner / boundary | Enforcement or evidence | State |
|---|---|---|---|---|
| AUTH-01 | A missing or invalid authenticated identity is distinct from an Auth-provider outage. | W API error contract; M consumer | R1 tests and API contract | ENFORCED in source; runtime status is INCONCLUSIVE. |
| AUTH-02 | An obsolete request, session, or token must not invalidate a newer session for the same user. | M session state; W API assumptions | RequestContext user, generation, and token comparison tests | PLANNED |
| AUTH-03 | Completion of an older account deletion must not clear a newer session. | M session state; W deletion boundary | R2 race test | PLANNED |
| AUTH-04 | Admin credentials are permitted only at the explicit account-deletion boundary. | W API/runtime | Secret-boundary checks and route review | ENFORCED in current source; runtime status is INCONCLUSIVE. |
| AUTH-05 | Account deletion targets only the UUID from the authenticated session. | W account-deletion API | Authenticated-session dependency and API tests | ENFORCED in current source; runtime status is INCONCLUSIVE. |
| DATA-01 | Normal product database access preserves the caller JWT and ownership enforcement. | W API; Supabase RLS | API route review, migrations, RLS evidence | ENFORCED in source; deployed state must be independently verified. |
| DATA-02 | Cross-user access is non-disclosing. | W API and RLS | Owned-resource negative tests | ENFORCED in source; deployed state must be independently verified. |
| DATA-03 | Protected ownership is enforced independently of browser behavior. | Supabase RLS | Policies, grants, and synthetic ownership checks | ENFORCED in source; runtime status is INCONCLUSIVE. |
| DATA-04 | Expiry visibility and physical purge are separate guarantees. | Supabase schema/operations | RLS expiry policy and scheduled-purge evidence | PARTIAL — separately evidence each guarantee. |
| DATA-05 | An uncertain write outcome is never silently retried or declared successful. | M client; W API | Error/timeout contract and browser tests | PARTIAL |
| MODEL-01 | Model V2 schema is `model-v2-r1-schema-v1`; product wording is `입력 기반 위험군 선별 신호`. | W API contract | Route response tests and release evidence | ENFORCED in source; runtime evidence is operator-verified in the release contract. |
| MODEL-02 | Frozen Model V2 feature order and semantics are exactly: 1. `age_years`; 2. `sex_knhanes`; 3. `bmi_from_height_weight`; 4. `cigarette_smoking_state`; 5. `alcohol_frequency`; 6. `alcohol_amount_category`; 7. `walking_days_7d`; 8. `walking_minutes_per_active_day`; 9. `strength_days_7d`; 10. `weekday_sleep_minutes`; 11. `weekend_sleep_minutes`. No substitution or reordering is permitted. Approved artifact SHA-256 is `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`. | W inference boundary | Artifact verification and contract tests | ENFORCED in source. |
| MODEL-03 | No retraining, recalibration, model-family replacement, or feature change occurs within Model V2 runtime work. | W model boundary | Review against frozen artifact contract | ENFORCED by contract; future changes require separate approval. |
| MODEL-04 | Product output exposes no numeric score, probability, or risk band. | W API; M rendering | Exact response-shape checks | ENFORCED in source; runtime evidence is operator-verified. |
| MODEL-05 | Raw Model V2 input and result are not persisted; no BP, challenge, prior-model, or other-account joins; no profile enrichment or advertising use. | W API/data boundary | Route, persistence, and telemetry review | ENFORCED in source for the current route; broader runtime evidence is INCONCLUSIVE. |
| MODEL-06A | `/api/v1/model-v2/product-score` product applicability is 19+; the product-score 19+ boundary is enforced in API/product-adapter source, and under-19 behavior was operator-verified in production. | W API/product-adapter contract | Input/response tests and release evidence | ENFORCED in source; under-19 runtime behavior is operator-verified. |
| MODEL-06B | Ages 80+ require an applicability caution. | M web contract | Current web source and tests | ENFORCED in current web source/tests; not independently operator-verified during the latest production smoke; runtime status for this notice is INCONCLUSIVE. |
| MODEL-06C | Product semantics are non-diagnostic. | W API contract; M copy | Current product copy and contracts | ENFORCED in current product copy/contracts; runtime checks are not overclaimed. |
| MODEL-07 | Issue #278 is a separate research track and is out of scope here. | Shared | Issue boundary | ENFORCED by scope. |
| REL-01 | Merged source is not the deployed runtime. | W release authority | Immutable source/build/runtime records | ENFORCED by release documentation process. |
| REL-02 | Source SHA, build identity, API image digest, Cloud Run revision, Cloudflare Worker version, migration state, model artifact identity, verification evidence, and rollback target are separate facts. | W release authority | Release manifest and evidence review | PARTIAL — manifest implementation is R9. |
| REL-03 | Deployment identity is immutable; rollback names a distinct known-good runtime identity. | W operations | Immutable digest/version and rollback drill | PARTIAL — documented evidence exists; R9/R10 extend enforcement. |
| REL-04 | Historical ledger evidence is never silently promoted to current state. | W docs/release authority | Dated records and current/evidence labels | ENFORCED by this contract. |
| REL-05 | Secrets and raw user data never belong in release evidence. | W operations | Sanitized evidence review and secret-boundary checks | ENFORCED by contract; runtime evidence is INCONCLUSIVE. |

`/api/v1/model-v2/score` is an authenticated semantic route, not the S11
product-input route. Its external applicability and null-age contract must not
be silently inferred from `/api/v1/model-v2/product-score`; that question is
INCONCLUSIVE and belongs to future bounded contract work. This note does not
change the frozen Model V2 semantics.
