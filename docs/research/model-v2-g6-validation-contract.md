# Model V2 G6 — One-time Frozen Validation Contract

Status: **G6 contract must be committed before frozen validation is consumed**

## 1. Purpose

G6 performs the first one-time model-selection evaluation on the frozen KNHANES
2024 validation role.

The candidate is already fixed by G5:

- family: `logistic_regression`
- exact frozen G3 11-feature contract
- exact G4/G5 preprocessing semantics
- exact G4/G5 survey-weight fitting semantics

G6 does not reopen model-family or feature selection.

## 2. Training role

Fit exactly once per reproducibility run on the full frozen development role:

- rows: 4,157
- PSU groups: 134
- normalized training weight: `wt_itvex / mean(wt_itvex)`
- preprocessing fitted on development only

The two reproducibility runs must each construct a fresh preprocessor and model.

## 3. Frozen validation role

Validation:

- rows: 978
- PSU groups: 31
- exact file: `locked-validation/validation.parquet`
- participant-level predictions remain outside Git

The validation role may not be consumed until this contract and the G6 runner
have been committed.

The runner provides two distinct modes:

1. `--preflight-only`
   - never reads validation parquet contents
   - checks development/G3/G5 provenance and validation path metadata only
2. `--consume-validation`
   - explicit one-time gate action
   - creates a consumption marker before reading validation contents
   - verifies the validation file SHA-256 against G3
   - performs the fixed evaluation

Do not delete the G6 output directory and repeat validation-driven evaluation.

## 4. Still locked

The G3 final internal test remains prohibited:

- rows: 804
- PSU groups: 27
- gate: G8 only

V1 validation and held-out test remain prohibited.

## 5. Fixed model

`LogisticRegression`:

- L2
- `C=1.0`
- `solver=lbfgs`
- `max_iter=2000`
- `tol=1e-8`
- no class weighting
- seed `20260907`

The preprocessing representation must match the G4/G5 logistic path:

- numeric median imputation + standardization
- categorical constant `__missing__` + one-hot encoding
- `OneHotEncoder(sparse_output=True)`
- default `ColumnTransformer` sparse-threshold semantics

## 6. Metrics

Primary:

- survey-weighted validation AUROC

Secondary:

- survey-weighted validation average precision
- survey-weighted validation Brier score
- survey-weighted calibration intercept
- survey-weighted calibration slope

Sensitivity/descriptive:

- unweighted AUROC
- unweighted average precision
- unweighted Brier

Calibration intercept/slope are **evaluation diagnostics only**. They are
estimated from the fixed validation predictions and are never used to modify,
recalibrate, transform, or select predictions.

No operational threshold is selected.

## 7. Subgroup audit

Descriptive only and never used to retune the model.

Sex:

- every observed `sex_knhanes` category

Age:

- 19–29
- 30–39
- 40–49
- 50–59
- 60–69
- 70–79
- 80+

For each subgroup record row count and survey-weighted Brier score.
Weighted AUROC and average precision are recorded only when both target classes
are present; otherwise discrimination metrics are suppressed.

## 8. Frozen decision rule

Advance to G7 only if all are true:

1. weighted validation AUROC >= `0.75`
2. G5 development weighted OOF AUROC minus validation AUROC <= `0.08`
3. weighted validation Brier <= `0.20`
4. calibration slope is finite and > `0`
5. integrity, provenance, reproducibility, and lock checks pass

These are project gate criteria, not claims of clinical validity.

If G6 fails, record the failure and stop. Validation feedback must not be used
to repair the candidate.

## 9. Reproducibility

Within the single G6 consumption event:

- read frozen validation once into memory
- construct and fit the full-development pipeline twice from scratch
- predict the same in-memory validation frame twice
- max absolute probability difference <= `1e-12`

Both runs use deterministic single-thread execution.

## 10. Prohibited after validation consumption

No:

- feature changes
- family changes
- hyperparameter tuning
- validation-driven model iteration
- threshold selection
- recalibration
- final-test access
- production serialization

## 11. Evidence boundary

Participant-level validation predictions stay outside Git.

Repository-safe evidence may contain:

- source hashes
- G5 evidence hash and nominated family
- config hash
- aggregate validation metrics
- subgroup aggregate metrics
- calibration diagnostics
- reproducibility diagnostics
- gate criteria and PASS/STOP result
- safety flags

No participant IDs or row-level predictions may be committed.

## 12. External output

Default:

`~/Projects/sk7-rnd-data/model-v2-g6/knhanes-2024/logistic-validation-v1/`

Files:

- `VALIDATION_CONSUMPTION_MARKER.json`
- `validation-predictions.parquet` — participant-level, outside Git
- `g6-validation-evidence.json` — aggregate external evidence

Repository-safe result:

- `docs/research/model-v2-g6-validation-result.md`

## 13. Exit

G6 exits with exactly one of:

- `PASS_ADVANCE_TO_G7`
- `STOP_VALIDATION_GATE_FAILED`

The final internal test remains locked either way.
