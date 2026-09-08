# Model V2 T4 — Authenticated API Boundary Result

Status: **IMPLEMENTED / PRODUCTION DISABLED**

Starting main: `0e7963d25b8864bb338b4960144a3daffb3b9088`

Issue: `#309`

## Scope

T4 adds a dedicated authenticated Model V2 API boundary while preserving the
existing legacy `/risk-signal` route unchanged.

The new boundary:

- reuses the existing Supabase bearer-session dependency
- requires authentication before Model V2 handling
- keeps `MODEL_V2_SCORING_ENABLED` default-OFF
- returns a stable `model_not_ready` response while disabled
- does not construct the inference boundary while disabled, so the artifact
  path is not resolved, hashed, or loaded
- uses the frozen T2 semantic validator through the existing Model V2
  inference boundary when explicitly enabled in local/test verification
- maps semantic input failures to a stable non-diagnostic validation response
- maps artifact/inference failures to a generic fail-closed response
- does not expose artifact paths, coefficients, preprocessing internals,
  stack traces, thresholds, or risk bands

Product wording remains:

`입력 기반 위험군 선별 신호`

## Invariants

- frozen artifact changed: **False**
- artifact SHA changed: **False**
- schema changed: **False**
- feature set/order changed: **False**
- preprocessing changed: **False**
- retraining: **0**
- recalibration: **0**
- threshold selection: **0**
- risk-band creation: **0**
- participant-level research data access: **0**
- validation/final-test data access: **0**
- artifact download/regeneration: **0**
- web/UI changes: **0**
- DB/schema/migration changes: **0**
- deployment changes: **0**
- production activation: **0**
- production scoring enabled by this change: **False**

The historical R2 result remains
`PASS_INFERENCE_INTEGRATION_READY_PRODUCTION_DISABLED`.

Final test and CI counts are recorded by the PR/CI run; this document does
not authorize production activation.
