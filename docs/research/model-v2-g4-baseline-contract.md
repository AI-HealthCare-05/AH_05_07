# Model V2 G4 — Development-only Baseline Reproducibility Contract

Status: **G4 permitted after merged G3; development role only**

## 1. Purpose

G4 establishes the first reproducible baseline for Model V2-A.

This gate is not a model-family competition and is not a release decision.
It answers one question only:

> Can the frozen G3 feature/target contract produce the same development-only
> baseline result when the entire procedure is repeated from scratch?

## 2. Allowed data

Only the frozen G3 development role may be read:

- rows: 4,157
- source role file: `development/development.parquet`
- target: `v2_hypertension_state`
- frozen 11-feature contract
- survey metadata: `wt_itvex`, `kstrata`, `psu`

The development file must be verified against the external G3 split manifest.

## 3. Locked data

The following remain prohibited:

- G3 validation: 978 rows, locked until G6
- G3 final internal test: 804 rows, locked until explicit G8 approval
- V1 validation
- V1 held-out test

The G4 runner must fail closed if the supplied development path contains
`locked-validation` or `locked-final-test`.

## 4. Frozen baseline family

Exactly one model family is allowed in G4:

- scikit-learn `LogisticRegression`
- L2 regularization
- `C = 1.0`
- solver: `lbfgs`
- `max_iter = 2000`
- `tol = 1e-8`
- no `class_weight`
- no hyperparameter search

Survey weights are passed to model fitting after normalization to mean 1 inside
each training fold. This preserves relative survey weights without allowing their
absolute scale to redefine the effective regularization strength.

## 5. Frozen feature roles

Numeric:

1. `age_years`
2. `bmi_from_height_weight`
3. `walking_days_7d`
4. `walking_minutes_per_active_day`
5. `weekday_sleep_minutes`
6. `weekend_sleep_minutes`

Categorical:

1. `sex_knhanes`
2. `cigarette_smoking_state`
3. `alcohol_frequency`
4. `alcohol_amount_category`
5. `strength_days_7d`

No feature may be added, removed, or reinterpreted in G4.

## 6. Frozen preprocessing

Preprocessing is fitted inside each development fold only.

Numeric pipeline:

- median imputation
- standardization

Categorical pipeline:

- constant missing category `__missing__`
- one-hot encoding
- unseen fold category: ignored at transform time

No target-derived preprocessing is allowed.

No missing-indicator feature is added in G4 because the G3 contract freezes
exactly 11 semantic model inputs.

## 7. Development-only resampling

Use:

- `StratifiedGroupKFold`
- 5 folds
- group: canonical `(kstrata, psu)`
- shuffle: true
- random seed: `20260907`

A PSU may appear in only one held-out fold.

The same folds are reused by all future G5 development-family comparisons unless
a documented semantic defect forces a new pre-validation contract revision.

## 8. Fitting weights and evaluation weights

Training:

- raw `wt_itvex`
- normalize within each training fold by dividing by its positive mean
- pass normalized weights only to `LogisticRegression.fit`

Evaluation:

- use raw held-out `wt_itvex`
- survey-weighted metrics are primary/secondary as frozen in G3

`wt_itvex`, `kstrata`, and `psu` are never predictors.

## 9. Metrics

Primary development OOF metric:

- survey-weighted AUROC

Secondary development OOF metrics:

- survey-weighted average precision / PR-AUC
- survey-weighted Brier score

Sensitivity/descriptive only:

- unweighted AUROC
- unweighted average precision / PR-AUC
- unweighted Brier score

No operational classification threshold is selected.
No calibration model is fit in G4.
No subgroup winner/loser decision is made in G4.

## 10. Reproducibility rule

The complete 5-fold OOF procedure is executed twice from scratch using the same
frozen configuration.

Required:

- fold assignments identical
- all OOF predictions finite and in `[0, 1]`
- every development row receives exactly one OOF prediction
- maximum absolute prediction difference between run 1 and run 2 <= `1e-12`
- aggregate metrics agree within numerical precision

Failure of this rule stops G4.

## 11. Evidence boundary

Participant-level OOF predictions stay outside Git.

Repository-safe evidence may contain only:

- input file/hash
- G3 manifest hash
- code/config hash
- development row count
- development PSU count
- fold row/PSU counts
- aggregate development-only metrics
- reproducibility maximum absolute difference
- OOF canonical digest
- safety flags

No participant IDs, row-level predictions, validation outcomes, or final-test
outcomes may be committed.

## 12. Output

External work directory:

`~/Projects/sk7-rnd-data/model-v2-g4/knhanes-2024/logistic-baseline-v1/`

Expected participant-level external file:

- `oof-predictions.parquet`

Expected aggregate external file:

- `g4-baseline-evidence.json`

Expected repository-safe document:

- `docs/research/model-v2-g4-baseline-result.md`

## 13. G4 exit

G4 completes only when:

- baseline contract is merged
- development input hash is verified
- two-run reproducibility passes
- aggregate OOF baseline metrics are documented
- validation is not accessed
- final test is not accessed
- no threshold/calibration/model-family selection occurs
- production scoring remains disabled

After G4, G5 may perform a **bounded** model-family screen using the development
role and the same frozen development resampling design.
