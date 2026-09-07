# Model V2 R2 — Inference Integration Result

Status: **PASS_INFERENCE_INTEGRATION_READY_PRODUCTION_DISABLED**

## Frozen artifact

- artifact: `model-v2-r1-a.joblib`
- SHA-256:
  `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`
- schema version: `model-v2-r1-schema-v1`
- product wording: `입력 기반 위험군 선별 신호`
- production scoring enabled: **False**

## Verification

- artifact exists: **True**
- artifact SHA matches frozen R1: **True**
- scoring disabled blocks before artifact access: **True**
- missing artifact fails closed: **True**
- artifact SHA mismatch fails closed: **True**
- schema version mismatch rejected: **True**
- exact feature order frozen: **True**
- missing required field rejected: **True**
- extra field rejected: **True**
- impossible age rejected: **True**
- impossible walking days rejected: **True**
- negative walking minutes rejected: **True**
- strength days above 5 rejected: **True**
- sleep above 1440 rejected: **True**
- nonpositive BMI rejected: **True**
- valid missing values score safely: **True**
- unknown categorical values score safely: **True**
- repeated inference identical: **True**
- score remains within [0, 1]: **True**
- audit artifact SHA matches: **True**
- schema version matches: **True**
- product wording matches: **True**
- legacy production route remains `model_not_ready`: **True**
- production scoring disabled: **True**
- operational threshold applied: **False**
- risk band created: **False**
- participant-level research data read during R2: **False**

## Runtime boundary

R2 adds a fail-closed Model V2 inference boundary only.

The production `/risk-signal` route remains disabled and continues to return
`model_not_ready`.

The runtime switch defaults to disabled. When disabled, Model V2 artifact loading
and inference do not occur.

A PASS means integration readiness only. It does not authorize production scoring.

## Governance deviation carried forward

During G8 preflight, SHA-256 integrity hashing opened and read the final-test
file bytes before explicit G8 consumption approval.

No Parquet parsing, participant rows, target values/prevalence, predictions,
or performance metrics were accessed.

No candidate, feature, model-family, hyperparameter, threshold, or recalibration
decision was informed by this hash-only read.

Formal G8 consumption subsequently created its marker before Parquet parsing
and remained one-time.

This is retained as a governance/protocol deviation and is not treated as
statistical performance leakage.

## Known limitation

Older-age subgroup discrimination remains weaker in descriptive audits,
especially age 80+.

This limitation remains visible and was not used for post-final-test Model V2
repair.

## Exit decision

`PASS_INFERENCE_INTEGRATION_READY_PRODUCTION_DISABLED`

Production scoring remains disabled.
