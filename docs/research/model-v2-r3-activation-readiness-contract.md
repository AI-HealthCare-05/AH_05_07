# Model V2 R3 — Activation Readiness Contract

Status: **READINESS REVIEW ONLY — PRODUCTION SCORING DISABLED**

Issue: #299

## Purpose

R3 reviews whether the frozen Model V2 release is technically and governably
ready for a future, separate production-enable decision.

R3 does not enable production scoring and does not change the model.

## Frozen release

- R1 canonical artifact: `model-v2-r1-a.joblib`
- SHA-256:
  `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`
- R2 inference boundary: completed
- schema version: `model-v2-r1-schema-v1`
- product wording: `입력 기반 위험군 선별 신호`

## Prohibited changes

R3 must not:

- retrain
- change features
- change preprocessing
- change model family
- change hyperparameters
- recalibrate
- select an operational threshold
- create a risk band
- read G6/G7/G8 participant-level data
- repair the model using final-test observations
- enable the production `/risk-signal` route
- set production scoring enabled by default

## Readiness checks

R3 verifies:

- frozen artifact SHA remains exact
- frozen 11-feature schema remains exact
- runtime switch default is disabled
- disabled state prevents artifact loading
- production route remains `model_not_ready`
- legacy DTO is not silently mapped to Model V2
- no operational threshold or risk-band logic exists in Model V2 boundary
- audit metadata exposes schema version, artifact SHA, and product wording
- artifact/hash/schema failures remain fail-closed
- rollback remains possible through the single runtime switch
- binary artifact remains outside Git
- no participant-level research data is committed
- known older-age limitation remains documented
- G8 protocol deviation remains documented
- production enable requires a separate explicit approval/gate

## Product safety

The output meaning remains:

`입력 기반 위험군 선별 신호`

It must not be represented as diagnosis, treatment recommendation, disease
prevention, causal improvement, future-event certainty, or challenge effect.

## Governance deviation

During G8 preflight, SHA-256 integrity hashing opened/read final-test file bytes
before explicit G8 consumption approval.

No Parquet parsing, participant rows, target values/prevalence, predictions,
or performance metrics were accessed.

No model-selection, feature, hyperparameter, threshold, or recalibration
decision was informed by that hash-only read.

This remains a documented governance/protocol deviation.

## Known limitation

Older-age subgroup discrimination remains weaker in descriptive audits,
especially age 80+.

This limitation must remain visible and must not trigger post-final-test repair.

## Exit decisions

- `PASS_ACTIVATION_READINESS_PRODUCTION_DISABLED`
- `STOP_ACTIVATION_READINESS_FAILED`

A PASS does not authorize production scoring.
