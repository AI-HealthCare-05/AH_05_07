# Model V2 R2 — Inference Integration Contract

Status: **INTEGRATION ONLY — PRODUCTION SCORING DISABLED**

Issue: #297

## Purpose

R2 integrates the frozen R1 artifact behind a fail-closed inference boundary.

R2 does not retrain, tune, recalibrate, threshold, or re-evaluate Model V2.
It does not enable the production risk-signal route.

The product meaning remains:

`입력 기반 위험군 선별 신호`

The score must not be presented as diagnosis, future-event probability,
treatment recommendation, prevention effect, causal improvement, or challenge
effect.

## Frozen R1 artifact

- canonical artifact: `model-v2-r1-a.joblib`
- SHA-256:
  `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`
- schema version: `model-v2-r1-schema-v1`
- product wording: `입력 기반 위험군 선별 신호`
- production enabled in artifact payload: `False`

The binary artifact remains outside Git.

## Exact inference schema

The boundary accepts exactly these 11 semantic fields, in this order:

1. `age_years`
2. `sex_knhanes`
3. `bmi_from_height_weight`
4. `cigarette_smoking_state`
5. `alcohol_frequency`
6. `alcohol_amount_category`
7. `walking_days_7d`
8. `walking_minutes_per_active_day`
9. `strength_days_7d`
10. `weekday_sleep_minutes`
11. `weekend_sleep_minutes`

The existing legacy `RiskSignalInput` DTO is not semantically equivalent and
must not be automatically mapped into this schema.

## Runtime switch

R2 defines one explicit process-level switch:

`MODEL_V2_SCORING_ENABLED`

Default: disabled.

When disabled, the runtime must not load or execute the model.

R2 does not change the existing production `/risk-signal` route, which remains
fail-closed with `model_not_ready`.

## Artifact load contract

When and only when scoring is explicitly enabled, the boundary must:

1. require an artifact path;
2. require the exact frozen SHA-256;
3. load the artifact;
4. require schema version `model-v2-r1-schema-v1`;
5. require exact feature order;
6. require product wording;
7. require `production_scoring_enabled == False` in the frozen artifact payload;
8. require a `predict_proba`-capable frozen pipeline.

Any failure rejects loading and no score is produced.

The artifact's own `production_scoring_enabled=False` is preserved as immutable
provenance. R2's runtime switch only permits integration testing; it is not a
production-enable approval.

## Input validation

Missing values are allowed where the frozen preprocessing supports imputation.
A field itself must still be present in the request.

Numeric values, when supplied, must be finite.

Domains:

- `age_years >= 19`
- `bmi_from_height_weight > 0`
- `walking_days_7d` in `[0, 7]`
- `walking_minutes_per_active_day` in `[0, 1440]`
- `strength_days_7d` in `[0, 5]`
- weekday/weekend sleep minutes in `[0, 1440]`

Unknown categorical values may pass through only because the frozen encoder has
`handle_unknown="ignore"`.

Extra fields are rejected.

## Output contract

The boundary returns only:

- continuous score in `[0, 1]`
- model/schema version
- artifact SHA-256
- product wording

R2 does not create a risk band and does not apply any operational threshold.

## Required verification

R2 must verify against the real frozen R1 artifact:

- scoring disabled -> no artifact load / no inference
- artifact missing -> fail closed
- artifact SHA mismatch -> fail closed
- schema version mismatch -> fail closed
- exact feature order required
- missing required field -> reject
- extra field -> reject
- impossible numeric value -> reject
- valid missing values -> score
- unknown categorical value -> score safely
- repeated inference -> identical score
- score remains within `[0, 1]`
- reported artifact SHA matches frozen R1 SHA
- legacy production route remains `model_not_ready`
- no validation/external/final-test participant data accessed
- no participant-level research data committed

## Governance deviation carried forward

During G8 preflight, the final-test file was opened/read at byte level once for
SHA-256 integrity hashing before formal consume approval.

No parquet parsing, participant rows, target values, predictions, or performance
were accessed during that pre-consumption operation.

No candidate, feature, model-family, hyperparameter, threshold, or recalibration
decision was informed by that read.

This is retained as a governance/protocol deviation in the release audit trail.

## Known limitation

Older-age subgroup discrimination is weaker in descriptive audits, especially
age 80+. This remains a release limitation and must not trigger post-final-test
Model V2 repair.

## Exit decisions

- `PASS_INFERENCE_INTEGRATION_READY_PRODUCTION_DISABLED`
- `STOP_INFERENCE_INTEGRATION_FAILED`

A PASS does not enable production scoring.
