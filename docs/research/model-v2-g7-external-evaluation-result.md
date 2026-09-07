# Model V2 G7 — KNHANES 2023 Temporal Korean Transportability Result

Status: **PASS_ADVANCE_TO_G8_REVIEW**

## Interpretation

This is a temporal Korean transportability evaluation with a
predeclared sleep-measurement instrument shift. It is not an exact
same-instrument replication and is not an independent-source
external validation.

The model remains an `입력 기반 위험군 선별 신호`; this result does
not establish diagnosis, future risk, treatment, prevention, or
causal improvement.

## Frozen candidate

- candidate: `logistic_regression`
- fit set: full G3 development only
- development rows: **4,157**
- development PSU groups: **134**
- G6 validation labels used for fitting: **False**
- threshold selection: **False**
- recalibration: **False**
- model/feature/hyperparameter changes: **False**

## External cohort

- source: `hn23_all.sas7bdat`
- source SHA-256: `62b3a67bd1a86fb459c78b404735a182ec0fe03cd4d35f7420d665b5b1e2741c`
- eligible external rows: **5,789**
- external PSU groups: **192**

Sleep harmonization was frozen before performance access:

- `weekday_sleep_minutes = BP16_1 * 60`
- `weekend_sleep_minutes = BP16_2 * 60`
- `88` / `99` -> missing

## External performance

| Metric | Survey-weighted | Unweighted sensitivity |
| --- | ---: | ---: |
| AUROC | 0.846272426 | 0.828832399 |
| Average precision | 0.664753404 | 0.684667327 |
| Brier score | 0.140987492 | 0.158568350 |

- calibration intercept: **-0.039904082**
- calibration slope: **1.047284625**
- G6 weighted validation AUROC reference: **0.817072743**
- G6 validation minus external AUROC: **-0.029199683**

## Frozen G7 gate

- `weighted_external_auroc_at_least_0_75`: **True**
- `g6_validation_minus_external_auroc_at_most_0_08`: **True**
- `weighted_external_brier_at_most_0_20`: **True**
- `calibration_slope_finite_positive`: **True**
- `integrity_provenance_reproducibility_safety_checks`: **True**

Decision: **PASS_ADVANCE_TO_G8_REVIEW**

A STOP decision is terminal for this candidate at G7 and must not
be repaired using external-performance feedback.

## Reproducibility

- two fresh full-development fits: **True**
- max absolute probability difference: **0.000e+00**
- required tolerance: **1.000e-12**
- reproducibility passed: **True**

## Descriptive subgroup audit

Subgroup results are descriptive only and were not used for
selection, tuning, threshold choice, or recalibration.

### Sex

| Sex code | Rows | Weighted AUROC | Weighted AP | Weighted Brier |
| --- | ---: | ---: | ---: | ---: |
| 1.0 | 2,526 | 0.826994899 | 0.659856386 | 0.151986662 |
| 2.0 | 3,263 | 0.865127233 | 0.670626685 | 0.130087332 |

### Age

| Age band | Rows | Weighted AUROC | Weighted AP | Weighted Brier |
| --- | ---: | ---: | ---: | ---: |
| 19-29 | 600 | 0.645518214 | 0.035172351 | 0.017489218 |
| 30-39 | 645 | 0.783086754 | 0.293916200 | 0.053412463 |
| 40-49 | 959 | 0.753476187 | 0.425480032 | 0.123255018 |
| 50-59 | 1,099 | 0.672072759 | 0.517688855 | 0.204751930 |
| 60-69 | 1,316 | 0.683022047 | 0.643801528 | 0.224530053 |
| 70-79 | 875 | 0.641913698 | 0.766840351 | 0.214776901 |
| 80+ | 295 | 0.563718997 | 0.818274034 | 0.178518653 |

## Safety

- external performance used for model change: **False**
- G6 validation participant data read: **False**
- KNHANES 2024 final-test file read: **False**
- V1 validation/test used: **False**
- production serialization: **False**

Participant-level external cohort, predictions, and full evidence
remain outside Git.

KNHANES 2024 final internal test remains locked until explicit G8
approval.

## Provenance

- execution commit: `baf4791cfc4ed3aafa8b4c781e24fbd2f8189d5b`
- config SHA-256: `ed39cad81474169a40900e6263e79df825509ef5120cdd5525015a1ab244a237`
- development SHA-256: `e56089bcd6dfce076cd41e58e708e44af4dc4281e161c6bacf4115bc9a332adb`
- G3 manifest SHA-256: `a6c07152ce1657f0befe868593a872153bb4063777f2240eb6ddbe25a06dedf9`
- G5 evidence SHA-256: `141a8ebe08f8575d47bb457b9683e6e4b83c46bd0bef10b954141e95c2999ae4`
- G6 evidence SHA-256: `7025e223e103ed9059b44ebe2b9414c42898b7eb77177f69039d6f33c26023e4`
- G7-A evidence SHA-256: `04d3df131a08e386aa75bff7188b90d30ad1c1d9611229e90efbb30dade7b606`
