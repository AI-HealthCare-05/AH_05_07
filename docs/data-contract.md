# Data contract

## Source

Primary candidate: **NHANES 2017–March 2020 Pre-pandemic**. The combined release is nationally representative and documents demographic, examination, questionnaire, dietary, and laboratory modules. [CDC data overview](https://wwwn.cdc.gov/nchs/nhanes/continuousnhanes/default.aspx?Cycle=2017-2020) · [questionnaire index](https://wwwn.cdc.gov/nchs/nhanes/continuousnhanes/questionnaires.aspx?Cycle=2017-2020)

KNHANES remains a Korean-source alternative, subject to its raw-data application and usage guidance. [KDCA portal](https://knhanes.kdca.go.kr/knhanes/main.do)

## Label

`hypertension_risk_group` is the current cross-sectional BP-threshold research label: mean available positive finite oscillometric systolic readings >=130 OR diastolic readings >=80. At least one valid reading in each component is required; all other rows are excluded. Recorded treatment status is not used by this version. The product must not call this a future-incidence prediction. User-facing wording is `입력 기반 위험군 선별 신호`.

## Feature allowlist

- age band, sex, BMI/anthropometrics
- smoking, alcohol, physical activity, sleep, diet-behavior items
- selected non-identifying socioeconomic fields only when documented and available at inference

## Feature denylist

- every BP reading or BP-derived aggregate used to construct the label
- diagnosis, medication, or treatment fields that define or trivially reveal the label
- identifiers, dates, free text, original documents, and unavailable-at-inference fields

## Split and evaluation

- Freeze a row-level train/validation/test split before model selection; preserve a split digest.
- Compare logistic regression against histogram gradient boosting.
- Publish AUROC, PR-AUC, Brier score, calibration, and subgroup results.
- Repeated normalized input with the same model artifact must produce the same output.

## Gate

Implementation begins only after the exact release files, variable names, derivation code, missing-value policy, and license/usage record are committed under `data/manifest/`. A failed feature-availability or leakage audit blocks training.

Run `uv run --group ai python scripts/data/audit_schema.py /local/path/to/raw` after downloading the listed files outside the repository. The audit checks the join key and the minimum variables needed for the label and first predictor set; it does not copy source data into Git.

Follow `docs/model-gate-1b-runbook.md` for the canonical manifest audit,
seven-module schema audit, derived-table, frozen-split, and sanitized-evidence
sequence. Merging that contract does not mark Gate 1B complete; an operator must
run it against the manually obtained public release and review the allowlisted
evidence first.

## Version 2 preparation semantics

The versioned source-to-input mapping and deliberate scope choices are in
[data-feature-semantics.md](data-feature-semantics.md) and ADR-0003. The manifest
owns explicit feature types, valid/missing codes, population bounds, and split
ratios. The analyzed cohort is adults with recorded age 18..80 (80 is the
source's top code), available BP in both components, and BMI 10..80. The BMI
bound is the existing SK7 input scope, not a CDC exclusion rule. Questionnaire
absence is retained as missing; it does not imply a negative answer.

Categorical missing values use an explicit -1 level. Continuous missing values
use only the training median; an entirely missing continuous training column
blocks preparation. The model scripts share one encoder based on manifest types
and the frozen fill values; numeric storage dtype never decides category meaning.

No survey weighting or complex-sample variance estimation is implemented.
The resulting unweighted cohort and metrics cannot claim US population
representativeness, Korean-user validity, or future incidence prediction.
Existing raw-array artifacts must not be reused with version 2 preprocessing.
The API stays explicitly unavailable until a reviewed input adapter and complete
model evaluation/promotion evidence exist.
