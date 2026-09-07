# Model V2 G9 — Release Review Result

Status: **PASS_RELEASE_CANDIDATE_READY_PRODUCTION_DISABLED**

## Release posture

- candidate: `logistic_regression`
- production scoring enabled: **False**
- operational threshold approved: **False**
- recalibration approved: **False**

The model remains an `입력 기반 위험군 선별 신호`. This review does
not establish diagnosis, future risk, treatment, prevention, or causal
improvement.

## Gate checks

- `g6_passed`: **True**
- `g7_passed`: **True**
- `g8_passed`: **True**
- `candidate_frozen`: **True**
- `no_post_final_test_repair`: **True**
- `production_serialization_not_yet_done`: **True**

## Frozen performance summary

- G6 weighted AUROC: **0.817072743**
- G7 weighted AUROC: **0.846272426**
- G8 weighted AUROC: **0.833641518**
- G8 weighted Brier: **0.152472852**
- G8 calibration slope: **0.980149811**

## Known limitation carried forward

Older-age subgroup discrimination was weaker in descriptive G6/G7/G8
audits, with the strongest concern in age 80+. This limitation must be
documented in release notes and product guardrails. It must not trigger
post-final-test candidate repair within Model V2.

## Release requirements

- serialize only from frozen G3 development
- record artifact SHA-256 and source commit
- freeze exact 11-feature order and preprocessing
- inference contract tests must pass
- schema validation and safe failure behavior required
- aggregate drift monitoring and rollback required
- explicit release approval required before enabling scoring

## Provenance

- G6 evidence SHA-256: `7025e223e103ed9059b44ebe2b9414c42898b7eb77177f69039d6f33c26023e4`
- G7 evidence SHA-256: `2ae7045b90d1e7d72cdd9120b10c5c4cdf4aac64ab5669362fe0b0a3ffff2bc6`
- G8 evidence SHA-256: `5a8634dc561e68a77bd64b72c13b475f386950c2fac74a994878f56f6f6990cf`

Participant-level development, validation, external, and final-test data
remain outside Git.

A G9 PASS means release-candidate readiness only. Production scoring
remains disabled until artifact/inference/monitoring checks and explicit
release approval are complete.
