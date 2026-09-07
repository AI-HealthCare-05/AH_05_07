# Model V2 R3 — Activation Readiness Result

Status: **PASS_ACTIVATION_READINESS_PRODUCTION_DISABLED**

Issue: #299

## Frozen release

- canonical artifact: `model-v2-r1-a.joblib`
- SHA-256:
  `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`
- schema version: `model-v2-r1-schema-v1`
- product wording: `입력 기반 위험군 선별 신호`
- R2 inference boundary: completed
- production scoring enabled: **False**

## R3 readiness verification

The activation-readiness verifier passed.

Verified conditions include:

- frozen artifact SHA remains exact
- frozen 11-feature schema remains exact
- runtime default remains disabled
- disabled state blocks artifact loading/inference
- production `/risk-signal` route remains `model_not_ready`
- no silent legacy DTO mapping exists
- no operational threshold exists
- no risk-band logic exists in the Model V2 boundary
- schema version is available for audit
- artifact SHA-256 is available for audit
- product wording is available for audit
- fail-closed behavior remains intact
- rollback remains available through the single runtime switch
- binary model artifact remains outside Git
- no participant-level research dataset is committed
- no participant-level research data was read during R3
- known older-age limitation remains documented
- G8 governance deviation remains documented
- production enable requires a separate explicit approval/gate

## Product safety

The output remains:

`입력 기반 위험군 선별 신호`

It is not a diagnosis, treatment recommendation, prevention claim,
causal-improvement claim, future-event certainty, or challenge-effect estimate.

No operational threshold or risk band was introduced in R3.

## Governance deviation carried forward

During G8 preflight, SHA-256 integrity hashing opened and read the final-test
file bytes before explicit G8 consumption approval.

No Parquet parsing, participant rows, target values/prevalence, predictions,
or performance metrics were accessed.

No candidate, feature, model-family, hyperparameter, threshold, or
recalibration decision was informed by this hash-only read.

Formal G8 consumption subsequently created its marker before Parquet parsing
and remained one-time.

This remains recorded as a governance/protocol deviation and is not treated
as statistical performance leakage.

## Known limitation

Older-age subgroup discrimination remains weaker in descriptive audits,
especially age 80+.

No post-final-test repair was performed in response to this observation.

## Exit decision

`PASS_ACTIVATION_READINESS_PRODUCTION_DISABLED`

This PASS establishes activation readiness only.

Production scoring remains disabled and requires a separate explicit
production-enable decision.
