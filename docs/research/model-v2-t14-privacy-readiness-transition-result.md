# Model V2 T14 — Privacy Notice Resolution and T9 Transition

Status: **PRIVACY_READINESS_PASS / RELEASE_NO_GO / PRODUCTION_DISABLED**

Starting main: `3d4a6609024cc5008343a89c5b3f619fd9bb783c`

Issue: `#338`

T14 notice contract: `model-v2-privacy-notice-resolution-v1`

T9 contract: `model-v2-privacy-readiness-v1`

T14 transition: `model-v2-privacy-readiness-t14-transition-v1`

## Purpose

T14 resolves the sole remaining T9 privacy-readiness blocker by freezing a
machine-checkable user-notice policy and applying a fail-closed T9 transition.

T14 is not a legal/privacy compliance certification. It does not by itself
authorize real-user Model V2 collection or production activation.

## Approved notice semantics

Before any Model V2 input collection, the notice must disclose these input
categories:

- age
- sex
- height/weight
- smoking
- alcohol
- walking/activity
- strength activity
- sleep

The purpose must be stated exactly as:

`입력 기반 위험군 선별 신호`

The notice must state that the signal is not:

- a diagnosis
- a treatment recommendation
- a prevention judgment
- a clinical decision

The current storage status must state:

- Model V2 inputs are not persisted
- Model V2 result/score is not persisted

The notice policy also prohibits use for:

- training or retraining
- advertising or marketing
- profile enrichment
- cross-profile use

Model V2 remains separate from BP observations, challenge data, prior model
outputs, and other users.

Logging/monitoring and analytics must not contain raw Model V2 inputs or
numeric score/result payloads.

## T14 machine-checkable dimensions

1. `input_categories_disclosed`
2. `exact_purpose_disclosed`
3. `non_diagnostic_boundary_disclosed`
4. `no_persistence_status_disclosed`
5. `no_training_retraining_use_approved`
6. `no_ads_marketing_use_approved`
7. `no_profile_enrichment_cross_profile_use_approved`
8. `data_separation_disclosed`
9. `raw_input_logging_prohibited`
10. `raw_score_logging_prohibited`
11. `raw_input_analytics_prohibited`
12. `raw_score_analytics_prohibited`

All 12 current dimensions are `PASS`.

T14 notice-resolution decision: **`PASS`**

## T9 before T14

The preserved pre-T14 T9 snapshot has seven PASS dimensions and one blocker:

- `user_notice_collection_approved = BLOCKED`

Pre-T14 T9 decision: `BLOCKED`

## Exact T9 transition

T9 transitions only if:

- T14 contract version exactly matches
  `model-v2-privacy-notice-resolution-v1`
- T14 decision is `PASS`
- the pre-transition T9 snapshot exactly matches the reviewed baseline

Exactly one T9 dimension changes:

- `user_notice_collection_approved`: `BLOCKED -> PASS`

The other seven T9 dimensions are carried forward unchanged.

Current T9 privacy-readiness decision: **`PASS`**

## Integrated release state after T14

- technical readiness = `PASS`
- product readiness = `PASS`
- privacy readiness = `PASS`
- operational readiness = `BLOCKED`
- explicit activation approval = `False`

T11 release decision remains **`NO_GO`**.

## Remaining blockers

T14 does not resolve:

- T10 production operational owner/approval
- explicit production activation approval

Real-user Model V2 collection remains unauthorized pending a separate explicit
authorization step.

## Preserved boundaries

T14 does not:

- enable `MODEL_V2_SCORING_ENABLED`
- deploy Model V2
- modify production environment variables
- add persistence
- expose numeric score/probability/percentage/threshold/gauge/traffic-light/risk band
- add a qualitative class derived from the hidden score
- change API/UI/DB/model/artifact/schema/preprocessing semantics
- retrain, regenerate, reserialize, upload, or replace the frozen artifact
- invent or assign an operational owner
- grant explicit activation approval
- claim legal/privacy compliance certification
- claim equivalence between product self-report inputs and KNHANES
  measured/administered variables

Production scoring remains **OFF**.

Real-user Model V2 collection remains **unauthorized**.

T14 completion is not production activation.
