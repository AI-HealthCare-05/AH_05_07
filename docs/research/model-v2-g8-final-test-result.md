# Model V2 G8 — KNHANES 2024 Final Internal Test Result

Status: **PASS_ADVANCE_TO_G9_RELEASE_REVIEW**

## Interpretation

This is the one-time final internal test of the frozen Model V2 candidate.

The model remains an `입력 기반 위험군 선별 신호`; this result does not
establish diagnosis, future risk, treatment, prevention, or causal
improvement.

Final-test performance was not used for model, feature, threshold,
calibration, family, or hyperparameter changes.

## Frozen candidate

- candidate: `logistic_regression`
- fit set: full G3 development only
- development rows: **4,157**
- development PSU groups: **134**
- G6 validation participant labels used for fitting: **False**
- G7 external participant data used for fitting: **False**
- threshold selection: **False**
- recalibration: **False**
- feature/model/hyperparameter changes: **False**

## Final internal test

- final-test rows: **804**
- final-test PSU groups: **27**
- final-test SHA-256: `99b1bdfa5589f51a1a589a51ec09acfb3690fedb12f4db9c1fa4f584dea8fc01`

## Final-test performance

| Metric | Survey-weighted | Unweighted sensitivity |
| --- | ---: | ---: |
| AUROC | 0.833641518 | 0.810954869 |
| Average precision | 0.647760897 | 0.670480003 |
| Brier score | 0.152472852 | 0.171339104 |

- calibration intercept: **-0.095896584**
- calibration slope: **0.980149811**
- G6 weighted validation AUROC reference: **0.817072743**
- G6 validation minus final-test AUROC: **-0.016568775**

## Frozen G8 gate

- `weighted_final_auroc_at_least_0_75`: **True**
- `g6_validation_minus_final_auroc_at_most_0_08`: **True**
- `weighted_final_brier_at_most_0_20`: **True**
- `calibration_slope_finite_positive`: **True**
- `reproducibility_passed`: **True**

Decision: **PASS_ADVANCE_TO_G9_RELEASE_REVIEW**

A STOP decision is terminal for this frozen candidate at G8 and must
not be repaired using final-test feedback.

## Reproducibility

- two fresh full-development fits: **True**
- max absolute probability difference: **0.000e+00**
- required tolerance: **1.000e-12**
- reproducibility passed: **True**

## Descriptive subgroup audit

Subgroup results are descriptive only and were not used for selection,
tuning, threshold choice, recalibration, or candidate repair.

### Sex

| Sex code | Rows | Weighted AUROC | Weighted AP | Weighted Brier |
| --- | ---: | ---: | ---: | ---: |
| 1.0 | 324 | 0.794318572 | 0.602786999 | 0.172922389 |
| 2.0 | 480 | 0.867427681 | 0.701709402 | 0.133359354 |

### Age

| Age band | Rows | Weighted AUROC | Weighted AP | Weighted Brier |
| --- | ---: | ---: | ---: | ---: |
| 19-29 | 85 | 0.884865460 | 0.111388073 | 0.015087703 |
| 30-39 | 73 | 0.853494075 | 0.397855129 | 0.083442042 |
| 40-49 | 98 | 0.782322501 | 0.539924718 | 0.112104491 |
| 50-59 | 145 | 0.735672135 | 0.627583758 | 0.194250600 |
| 60-69 | 193 | 0.635594413 | 0.538691692 | 0.239594746 |
| 70-79 | 149 | 0.655500520 | 0.765518096 | 0.219150350 |
| 80+ | 61 | 0.533409755 | 0.766124560 | 0.214226583 |

## Safety

- consumption marker created before final-test parsing: **True**
- G6 validation participant data read: **False**
- G7 external participant data used for fit: **False**
- V1 validation/test used: **False**
- final-test performance used for model change: **False**
- threshold selection: **False**
- recalibration: **False**
- production serialization: **False**

Participant-level final-test cohort, predictions, and full evidence
remain outside Git.

Production scoring remains disabled pending separate G9 release review.

## Provenance

- execution commit: `0527ddd34d46f260438befac39ba994902827e83`
- config SHA-256: `e6f7ebc8fe810e735d8281af8acbc1dd86e46da97e8b49db3014fbbe40901a0d`
- development SHA-256: `e56089bcd6dfce076cd41e58e708e44af4dc4281e161c6bacf4115bc9a332adb`
- final-test SHA-256: `99b1bdfa5589f51a1a589a51ec09acfb3690fedb12f4db9c1fa4f584dea8fc01`
- G3 manifest SHA-256: `a6c07152ce1657f0befe868593a872153bb4063777f2240eb6ddbe25a06dedf9`
- G6 evidence SHA-256: `7025e223e103ed9059b44ebe2b9414c42898b7eb77177f69039d6f33c26023e4`
- G7 evidence SHA-256: `2ae7045b90d1e7d72cdd9120b10c5c4cdf4aac64ab5669362fe0b0a3ffff2bc6`
- G7 decision: `PASS_ADVANCE_TO_G8_REVIEW`
