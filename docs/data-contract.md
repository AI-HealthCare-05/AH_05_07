# Data contract

## Source

Primary candidate: **NHANES 2017–March 2020 Pre-pandemic**. The combined release is nationally representative and documents demographic, examination, questionnaire, dietary, and laboratory modules. [CDC data overview](https://wwwn.cdc.gov/nchs/nhanes/continuousnhanes/default.aspx?Cycle=2017-2020) · [questionnaire index](https://wwwn.cdc.gov/nchs/nhanes/continuousnhanes/questionnaires.aspx?Cycle=2017-2020)

KNHANES remains a Korean-source alternative, subject to its raw-data application and usage guidance. [KDCA portal](https://knhanes.kdca.go.kr/knhanes/main.do)

## Label

`hypertension_risk_group` is a cross-sectional screening label derived only from documented clinical BP criteria and/or recorded hypertension treatment status in the selected release. The product must not call this a future-incidence prediction. User-facing wording is `입력 기반 위험군 선별 신호`.

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
