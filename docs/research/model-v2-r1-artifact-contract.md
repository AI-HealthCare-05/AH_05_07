# Model V2 R1 — Deterministic Release Artifact Contract

Status: **PACKAGING ONLY — PRODUCTION SCORING DISABLED**

## Purpose

R1 packages the frozen Model V2 candidate after G9.

R1 does not select, tune, recalibrate, threshold, or re-evaluate the model.
It may fit the already-frozen pipeline only on the frozen G3 development split
for the purpose of serialization.

Product meaning remains:

`입력 기반 위험군 선별 신호`

The artifact must not be presented as diagnosis, future-event probability,
treatment recommendation, prevention effect, causal improvement, or challenge
effect.

## Frozen training input

Only:

- G3 development parquet
- 4,157 rows
- 134 PSU groups
- frozen development SHA-256:
  `e56089bcd6dfce076cd41e58e708e44af4dc4281e161c6bacf4115bc9a332adb`

R1 must not read participant-level G6 validation, G7 external, or G8 final-test
data.

## Frozen 11-feature schema

In exact order:

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

Numeric:

- `age_years`
- `bmi_from_height_weight`
- `walking_days_7d`
- `walking_minutes_per_active_day`
- `strength_days_7d`
- `weekday_sleep_minutes`
- `weekend_sleep_minutes`

Categorical:

- `sex_knhanes`
- `cigarette_smoking_state`
- `alcohol_frequency`
- `alcohol_amount_category`

## Frozen preprocessing

Numeric:

- `SimpleImputer(strategy="median")`
- `StandardScaler()`

Categorical:

- `SimpleImputer(strategy="constant", fill_value="__missing__", keep_empty_features=True)`
- `OneHotEncoder(handle_unknown="ignore", sparse_output=True)`

## Frozen model

`LogisticRegression`:

- penalty: `l2`
- C: `1.0`
- solver: `lbfgs`
- max_iter: `2000`
- tol: `1e-8`
- class_weight: `None`
- random_state: `20260907`

Training sample weights are `wt_itvex` normalized to mean 1.0.

## Artifact package

Binary artifacts remain outside Git.

R1 writes:

- `model-v2-r1-a.joblib`
- `model-v2-r1-b.joblib`
- `model-v2-r1-manifest.json`
- `model-v2-r1-verification.json`

The manifest records:

- schema/version
- feature order
- preprocessing/model config
- training-data SHA-256
- source commit
- Python / NumPy / pandas / scikit-learn / joblib versions
- artifact SHA-256
- production enabled: false
- product wording and limitations

## Determinism contract

Two fresh pipeline objects are independently fit from the same frozen
development split with one BLAS thread.

Required:

- prediction max absolute difference <= 1e-12

Preferred:

- byte-identical joblib SHA-256

If joblib bytes are not identical while inference is identical within tolerance,
R1 records `DETERMINISTIC_INFERENCE_EQUIVALENCE` and retains artifact A as the
canonical candidate. This is allowed by Issue #295 but production remains
disabled.

## Input contract checks

R1 verifies:

- exact required feature names
- no extra feature is required for inference
- finite numeric values when supplied
- age must be >= 19
- walking days must be in [0, 7]
- walking minutes must be in [0, 1440]
- strength days must be in [0, 5]
- weekday/weekend sleep minutes must be in [0, 1440]
- BMI must be > 0 when supplied

Missing values are allowed because the frozen preprocessing explicitly imputes
them.

Unknown categorical values are allowed because the frozen encoder uses
`handle_unknown="ignore"`.

## Exit decisions

- `PASS_ARTIFACT_READY_FOR_INTEGRATION_PRODUCTION_DISABLED`
- `STOP_RELEASE_ARTIFACT_GATE_FAILED`

A PASS does not enable production scoring.
