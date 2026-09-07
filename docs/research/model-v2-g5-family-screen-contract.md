# Model V2 G5 — Bounded Development-only Family Screen Contract

Status: **G5 development-only family screening**

## 1. Purpose

G5 compares a small, predeclared set of model families using only the frozen
KNHANES 2024 development role.

G5 is not validation, external evaluation, final testing, calibration, threshold
selection, or release approval.

## 2. Allowed data

Only the frozen G3 development role may be read:

- rows: 4,157
- PSU groups: 134
- target: `v2_hypertension_state`
- exact frozen G3 11-feature contract
- statistical design fields: `wt_itvex`, `kstrata`, `psu`

The G4 baseline evidence must also be supplied so the runner can prove that the
logistic-regression OOF predictions reproduce the G4 canonical digest before any
family comparison result is accepted.

## 3. Locked data

Still prohibited:

- G3 validation: 978 rows — locked until G6
- G3 final internal test: 804 rows — locked until explicit G8 approval
- V1 validation
- V1 held-out test

The runner fails closed if any supplied participant-level path contains
`locked-validation` or `locked-final-test`.

## 4. Frozen resampling

Reuse the G4 design exactly:

- `StratifiedGroupKFold`
- 5 folds
- group: canonical `(kstrata, psu)`
- shuffle: true
- seed: `20260907`

A PSU may occur in only one held-out fold.

## 5. Frozen preprocessing

The semantic preprocessing is the same as G4 and is fitted inside each
development training fold only.

Numeric:

- median imputation
- standardization

Categorical:

- constant missing category `__missing__`
- one-hot encoding
- unseen fold category ignored

Matrix representation may be sparse for models that support it and dense for
histogram gradient boosting. This representation difference does not change the
semantic feature contract.

## 6. Candidate families and fixed configurations

Exactly four families are allowed.

### 6.1 Logistic regression — G4 baseline

- L2
- `C=1.0`
- `solver=lbfgs`
- `max_iter=2000`
- `tol=1e-8`
- no class weighting
- seed `20260907`

### 6.2 Histogram gradient boosting

- `learning_rate=0.05`
- `max_iter=200`
- `max_leaf_nodes=15`
- `min_samples_leaf=20`
- `l2_regularization=1.0`
- seed `20260907`

### 6.3 Random forest

- `n_estimators=500`
- `max_depth=8`
- `min_samples_leaf=10`
- `max_features=sqrt`
- no class weighting
- `n_jobs=1`
- seed `20260907`

### 6.4 Extra Trees

- `n_estimators=500`
- `max_depth=8`
- `min_samples_leaf=10`
- `max_features=sqrt`
- no bootstrap
- no class weighting
- `n_jobs=1`
- seed `20260907`

No model family or hyperparameter may be added, removed, or changed after G5
performance is seen without a new pre-validation contract revision.

## 7. Training weights

For every family:

- raw `wt_itvex`
- normalize inside each training fold to mean 1
- pass normalized weights to model fitting

`wt_itvex`, `kstrata`, and `psu` are never predictors.

## 8. Metrics

Primary:

- survey-weighted development OOF AUROC

Secondary:

- survey-weighted average precision / PR-AUC
- survey-weighted Brier score

Sensitivity/descriptive:

- unweighted AUROC
- unweighted average precision / PR-AUC
- unweighted Brier

Fold-level weighted AUROC/AP/Brier are recorded as aggregate evidence.

## 9. Predeclared nomination rule

The G4 logistic baseline is the default G6 nomination.

A more complex family may replace it only if all conditions hold:

1. overall weighted AUROC improves by at least `0.005`;
2. overall weighted average precision is no worse by more than `0.005`;
3. overall weighted Brier is no worse by more than `0.005`;
4. weighted fold AUROC is greater than logistic regression in at least 3 of 5
   frozen folds.

If more than one complex family satisfies all guardrails, nominate the one with
the highest overall weighted AUROC. If the AUROC difference is less than
`1e-6`, prefer lower weighted Brier, then higher weighted average precision.

This is a development nomination only. It is not validation evidence.

## 10. Reproducibility

The complete four-family OOF screen is executed twice from scratch.

Required:

- identical fold assignments
- finite probabilities in `[0,1]`
- exactly one OOF prediction per development row per model
- max absolute probability difference per family <= `1e-12`
- G4 logistic OOF canonical digest reproduced exactly

Failure stops G5.

## 11. Evidence boundary

Participant-level OOF predictions remain outside Git.

Repository-safe evidence may contain only:

- input and manifest hashes
- G4 evidence hash and canonical digest comparison
- config hash
- development row / PSU counts
- fold aggregate counts and metrics
- aggregate model metrics and deltas
- nomination rule outcome
- reproducibility diagnostics
- safety flags

No participant IDs or row-level predictions may be committed.

## 12. External output

Default external directory:

`~/Projects/sk7-rnd-data/model-v2-g5/knhanes-2024/family-screen-v1/`

Files:

- `oof-family-screen.parquet` — participant-level, outside Git
- `g5-family-screen-evidence.json` — aggregate external evidence

Repository-safe result:

- `docs/research/model-v2-g5-family-screen-result.md`

## 13. Prohibited actions

G5 must not:

- access validation
- access final test
- reuse V1 validation/test
- add or remove features
- perform adaptive hyperparameter search
- select an operational threshold
- fit a calibration model
- serialize or activate a production model
- claim diagnosis, treatment, prevention, future risk, or causal improvement

## 14. Exit

G5 completes only when all four fixed families are reproducibly evaluated on
development OOF predictions, the G4 baseline is reproduced, aggregate evidence
is documented, and at most one candidate is nominated for the separate G6
validation gate.
