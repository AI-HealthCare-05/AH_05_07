# Model V2 G4 — Development-only Baseline Reproducibility Result

Status: **PASS — reproducible development-only baseline**

## Scope

- model family: L2 logistic regression only
- development rows: **4,157**
- development PSU groups: **134**
- validation: **not read**
- final internal test: **not read**
- V1 validation/test: **not used**

## Provenance

- execution commit: `7a58742da29334e1ade50dacc25504ae2a2dfd2b`
- development SHA-256: `e56089bcd6dfce076cd41e58e708e44af4dc4281e161c6bacf4115bc9a332adb`
- external G3 manifest SHA-256: `a6c07152ce1657f0befe868593a872153bb4063777f2240eb6ddbe25a06dedf9`
- G4 config SHA-256: `6778b381c225581f068f0e62d6f4e5af597b13485f3d6e0f2a225ed99b2334ac`
- OOF canonical digest: `65e22b433d80dc005e4e5ced383a5f1ea544ee8125d1d61fdfb8b8ed67e59de9`

Participant-level OOF predictions remain outside Git.

## Development OOF metrics

| Metric | Survey-weighted | Unweighted sensitivity |
| --- | ---: | ---: |
| AUROC | 0.833827446 | 0.826138872 |
| Average precision / PR-AUC | 0.649285400 | 0.686879547 |
| Brier score | 0.149434450 | 0.161618134 |

These are **development-only** baseline results and are not validation,
final-test, external-evaluation, or release evidence.

## Fold audit

| Fold | Rows | PSU groups | Weighted AUROC | Weighted AP | Weighted Brier |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 819 | 27 | 0.812729163 | 0.631951463 | 0.158937601 |
| 1 | 841 | 27 | 0.835030679 | 0.664113958 | 0.152869441 |
| 2 | 827 | 27 | 0.854080882 | 0.667745171 | 0.137825810 |
| 3 | 840 | 28 | 0.823737570 | 0.640276357 | 0.153210277 |
| 4 | 830 | 25 | 0.844778871 | 0.654827387 | 0.144109694 |

## Reproducibility

- complete procedure executed twice: **True**
- fold assignments identical: **True**
- max absolute OOF probability difference: **0.000e+00**
- required tolerance: **1.0e-12**
- reproducibility passed: **True**

## Safety / gate state

- `development_only`: **True**
- `validation_file_read`: **False**
- `validation_performance_accessed`: **False**
- `final_test_file_read`: **False**
- `final_test_performance_accessed`: **False**
- `v1_validation_or_test_used`: **False**
- `feature_ranking_performed`: **False**
- `model_family_comparison_performed`: **False**
- `hyperparameter_search_performed`: **False**
- `threshold_selection_performed`: **False**
- `calibration_fitting_performed`: **False**
- `production_serialization_performed`: **False**

No operational threshold was selected and no calibration model was fit.
No model-family winner was selected in G4.

After G4 merge, G5 may begin bounded development-only family screening
using the frozen G3 features and the same G4 development resampling design.
