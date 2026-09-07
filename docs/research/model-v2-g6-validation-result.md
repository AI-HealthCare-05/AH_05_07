# Model V2 G6 — One-time Frozen Validation Result

Status: **PASS_ADVANCE_TO_G7**

## Scope

- candidate: **`logistic_regression`**
- development rows: **4,157**
- development PSU groups: **134**
- validation rows: **978**
- validation PSU groups: **31**
- final internal test: **not read**
- participant-level validation predictions: **outside Git**

## Provenance

- execution commit: `10c84e5d83eebb6d083e0d66ad0345cfeacb117e`
- development SHA-256: `e56089bcd6dfce076cd41e58e708e44af4dc4281e161c6bacf4115bc9a332adb`
- validation SHA-256: `71774e13e7b994e023253d78f8310a1374610c652644a7a87aeabe88f1c00fd7`
- G3 manifest SHA-256: `a6c07152ce1657f0befe868593a872153bb4063777f2240eb6ddbe25a06dedf9`
- G5 evidence SHA-256: `141a8ebe08f8575d47bb457b9683e6e4b83c46bd0bef10b954141e95c2999ae4`
- G6 config SHA-256: `80a20f4ad6662af392fb715790c6be5c164713c89514492a64997641ed47da40`

## Frozen validation metrics

| Metric | Survey-weighted | Unweighted sensitivity |
| --- | ---: | ---: |
| AUROC | 0.817072743 | 0.810017451 |
| Average precision | 0.663483768 | 0.681319185 |
| Brier score | 0.165866526 | 0.173169549 |

Calibration diagnostics are evaluation-only and were not applied to
predictions:

- weighted calibration intercept: **0.007107598**
- weighted calibration slope: **0.860430337**

## Development reference

- G5 logistic development OOF weighted AUROC: **0.833827446**
- development minus validation AUROC: **0.016754703**

## Frozen gate criteria

- `weighted_validation_auroc_at_least_0_75`: **True**
- `development_minus_validation_auroc_at_most_0_08`: **True**
- `weighted_validation_brier_at_most_0_20`: **True**
- `calibration_slope_finite_positive`: **True**
- `integrity_provenance_reproducibility_lock_checks`: **True**

Overall G6 decision: **PASS_ADVANCE_TO_G7**

These criteria are project gate checks, not claims of clinical validity.

## Reproducibility

- two fresh full-development fits: **True**
- same in-memory frozen validation frame: **True**
- max absolute validation probability difference: **0.000e+00**
- required tolerance: **1.0e-12**
- reproducibility passed: **True**

## Descriptive subgroup audit

Subgroup results were not used for retuning or model selection.

### Sex

| Group | Rows | Weighted AUROC | Weighted AP | Weighted Brier |
| --- | ---: | ---: | ---: | ---: |
| `1.0` | 423 | 0.777952376 | 0.620229177 | 0.186160006 |
| `2.0` | 555 | 0.851380254 | 0.714654583 | 0.146178542 |

### Age

| Group | Rows | Weighted AUROC | Weighted AP | Weighted Brier |
| --- | ---: | ---: | ---: | ---: |
| `19-29` | 104 | 0.943488377 | 0.314107465 | 0.028317933 |
| `30-39` | 105 | 0.741105116 | 0.521883152 | 0.100188305 |
| `40-49` | 147 | 0.753690769 | 0.431944160 | 0.141022776 |
| `50-59` | 190 | 0.675521302 | 0.546917372 | 0.212733261 |
| `60-69` | 190 | 0.629754357 | 0.697874257 | 0.244663657 |
| `70-79` | 168 | 0.591577908 | 0.674968917 | 0.240391763 |
| `80+` | 74 | 0.817231501 | 0.925745316 | 0.174197581 |

## Safety / gate state

- validation used for model change: **False**
- final-test file read: **False**
- feature contract changed: **False**
- model family changed: **False**
- hyperparameter tuning: **False**
- threshold selection: **False**
- recalibration: **False**
- production serialization: **False**

The final internal test remains locked after G6.
