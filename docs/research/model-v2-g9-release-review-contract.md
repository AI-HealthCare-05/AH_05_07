# Model V2 G9 — Release Review Contract

Status: **REVIEW_ONLY — PRODUCTION SCORING DISABLED**

## Purpose

G9 is the release-review gate for the frozen Model V2 candidate that passed G8.

G9 does **not** train, tune, recalibrate, threshold, or re-evaluate the model.
It reviews whether the frozen candidate can be packaged for controlled product
integration while preserving the product meaning:

`입력 기반 위험군 선별 신호`

This gate does not establish diagnosis, future risk, treatment, prevention, or
causal improvement.

## Frozen evidence entering G9

- G6: frozen validation PASS
- G7: KNHANES 2023 temporal Korean transportability PASS
- G8: one-time KNHANES 2024 final internal test PASS
- G8 final test is consumed and must not be reused for candidate repair

## Known performance summary

- G6 weighted AUROC: 0.817072743
- G7 weighted AUROC: 0.846272426
- G8 weighted AUROC: 0.833641518
- G8 weighted Brier: 0.152472852
- G8 calibration slope: 0.980149811

## Known subgroup limitation

Descriptive subgroup audits show weaker discrimination in older age bands,
especially age 60+ and most strongly age 80+.

This limitation must be carried into release documentation and product
guardrails. It must not trigger post-final-test model repair within V2.

## G9 review scope

G9 may:

- freeze a model artifact provenance contract
- freeze the exact 11-feature input schema and semantics
- freeze output semantics
- freeze user-facing limitations and non-diagnostic wording
- define monitoring, rollback, and disable conditions
- define production enable prerequisites
- produce a repository-safe release review result

G9 must not:

- change features
- change model family
- change hyperparameters
- select a threshold from G6/G7/G8 performance
- recalibrate from G6/G7/G8
- retrain using validation, external, or final-test participant data
- re-open or reuse the G8 final test
- serialize/enable production scoring before explicit release approval

## Input contract

The release candidate must accept exactly the frozen G3 semantic features:

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

Blood-pressure measurements, hypertension diagnosis/treatment fields,
target-adjacent fields, participant identifiers, survey design fields, prior
scores, challenge adherence, and post-outcome fields remain prohibited as
predictors.

## Output contract

The model output is a continuous probability-like screening score for the
frozen binary cross-sectional target.

It must not be presented as:

- diagnosis
- future-event probability
- treatment recommendation
- prevention effect
- causal improvement
- challenge effect

No operational decision threshold is approved by G9 unless separately defined
under a new prospective contract with independent data.

## Release artifact contract

If G9 passes, the release candidate may be serialized only from the frozen
G3 development data and frozen G4/G5/G6 fit configuration.

The serialized artifact must include or be paired with:

- model format/version
- exact feature order
- exact preprocessing configuration
- model hyperparameters
- training-data provenance hash
- source commit
- artifact SHA-256
- schema/version identifier
- product wording/limitations
- production enable flag defaulting to disabled

No participant-level training, validation, external, or final-test data may be
committed.

## Monitoring and rollback

Before production scoring can be enabled, the product must define:

- input schema validation
- missing/unknown-category handling
- impossible-value rejection rules
- scoring failure behavior
- model version logging
- aggregate input-distribution drift monitoring
- aggregate score-distribution monitoring
- subgroup monitoring where lawful and appropriate
- rollback to disabled scoring
- audit trail for model-version changes

Any material schema drift, unexplained score drift, or safety-boundary breach
must support disabling scoring without requiring a new client release.

## Production enable prerequisites

G9 may conclude that the candidate is release-ready, but production scoring
must remain disabled until all of the following are separately verified:

1. deterministic artifact serialization from frozen development only
2. artifact hash and provenance recorded
3. inference contract tests pass
4. input schema and output wording integrated
5. monitoring and rollback path exist
6. known subgroup limitations are documented
7. explicit product-owner release approval is given

## Allowed G9 decisions

- `PASS_RELEASE_CANDIDATE_READY_PRODUCTION_DISABLED`
- `STOP_RELEASE_REVIEW_BLOCKED`

A PASS does not itself enable production scoring.
