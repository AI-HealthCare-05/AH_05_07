# Model V2 G5 — Bounded Development-only Family Screen Result

Status: **PASS — bounded development-only family screen complete**

## Scope

- development rows: **4,157**
- development PSU groups: **134**
- validation: **not read**
- final internal test: **not read**
- V1 validation/test: **not used**
- participant-level OOF predictions: **outside Git**

## Provenance

- execution commit: `4546192b09856a3504688eb19727201b51b5c831`
- development SHA-256: `e56089bcd6dfce076cd41e58e708e44af4dc4281e161c6bacf4115bc9a332adb`
- G3 manifest SHA-256: `a6c07152ce1657f0befe868593a872153bb4063777f2240eb6ddbe25a06dedf9`
- G4 evidence SHA-256: `9d0d99fa6a2a758b9acf71bd1ba830cccfb91e70d3a8f31fb0ce0bc9d4e8834c`
- G4 OOF canonical digest: `65e22b433d80dc005e4e5ced383a5f1ea544ee8125d1d61fdfb8b8ed67e59de9`
- G5 config SHA-256: `e4c553aa0fb49e3d2e82f5bca8ec1e59af1045819359a4221ba0a99d490d2b61`
- G4 logistic OOF digest reproduced: **True**

## Development OOF aggregate metrics

| Model | Weighted AUROC | Weighted AP | Weighted Brier |
| --- | ---: | ---: | ---: |
| `logistic_regression` | 0.833827446 | 0.649285400 | 0.149434450 |
| `histogram_gradient_boosting` | 0.819289036 | 0.615399914 | 0.155974245 |
| `random_forest` | 0.820827804 | 0.619137726 | 0.159147714 |
| `extra_trees` | 0.801565932 | 0.591549269 | 0.171857324 |

These are development-only results. They are not G6 validation evidence,
G7 external evaluation, G8 final-test evidence, or release approval.

## Predeclared guardrails versus logistic baseline

| Challenger | AUROC Δ | AP Δ | Brier Δ | Fold AUROC wins | Pass |
| --- | ---: | ---: | ---: | ---: | --- |
| `histogram_gradient_boosting` | -0.014538410 | -0.033885486 | +0.006539795 | 0/5 | **False** |
| `random_forest` | -0.012999642 | -0.030147675 | +0.009713265 | 0/5 | **False** |
| `extra_trees` | -0.032261514 | -0.057736131 | +0.022422874 | 0/5 | **False** |

## G6 development nomination

- nominated family: **`logistic_regression`**
- nomination is development-only and must be evaluated separately at G6.

## Reproducibility

- two complete four-family screens: **True**
- fold assignments identical: **True**
- `logistic_regression` max absolute probability difference: **0.000e+00** (pass: **True**)
- `histogram_gradient_boosting` max absolute probability difference: **0.000e+00** (pass: **True**)
- `random_forest` max absolute probability difference: **0.000e+00** (pass: **True**)
- `extra_trees` max absolute probability difference: **0.000e+00** (pass: **True**)

## Safety / gate state

- development only: **True**
- validation file read: **False**
- final-test file read: **False**
- adaptive hyperparameter search: **False**
- threshold selection: **False**
- calibration fitting: **False**
- production serialization: **False**

G6 remains a separate gate. Validation must stay locked until an explicit
G6 approval and pre-validation contract are complete.
