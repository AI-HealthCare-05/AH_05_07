# Model V2 G7-A — KNHANES 2023 External Compatibility Screen

Status: **contract mapping revision after metadata-only schema finding**

## 1. Finding that triggered this revision

The first metadata-only audit of `hn23_all.sas7bdat` found that KNHANES 2023
does not contain the 2024 sleep clock-time source variables:

- `BP16_11`, `BP16_12`, `BP16_13`, `BP16_14`
- `BP16_21`, `BP16_22`, `BP16_23`, `BP16_24`

No participant rows, target prevalence, predictions, or performance were
accessed before this revision.

The KNHANES 9th-cycle documentation states that:

- 2022–2023 use direct average sleep-duration fields `BP16_1`, `BP16_2`;
- 2024 uses bed/wake clock-time fields from which sleep duration is derived.

Therefore KNHANES 2023 is not an exact source-instrument replication of the 2024
feature contract.

## 2. G7 interpretation

G7 will be treated as a **temporal Korean transportability evaluation with a
predeclared sleep-measurement instrument shift**, not as an exact
same-instrument temporal replication.

This distinction must remain visible in all G7 result documentation.

## 3. Frozen external harmonization

All non-sleep source mappings remain identical to the G3 contract.

For KNHANES 2023 only:

- `weekday_sleep_minutes` <- `BP16_1 * 60`
- `weekend_sleep_minutes` <- `BP16_2 * 60`
- `BP16_1` values `88`, `99`, or missing -> missing
- `BP16_2` values `88`, `99`, or missing -> missing

No clipping, interpolation, imputation, rescaling, or performance-driven mapping
change is allowed before model preprocessing.

The frozen model itself is unchanged:

- exact G3 11 semantic features
- `logistic_regression`
- exact G4/G5/G6 model and preprocessing configuration
- no refitting choice based on external performance

The measurement difference is solely in the external source-to-feature
harmonization for the two sleep-duration features.

## 4. Required KNHANES 2023 columns

Predictor sources:

- `age`
- `sex`
- `HE_ht`, `HE_wt`
- `BS1_1`, `BS3_1`
- `BD1_11`, `BD2_1`
- `BE3_31`, `BE3_32`, `BE3_33`
- `BE5_1`
- `BP16_1`, `BP16_2`

Target/cohort/survey:

- `ID`
- `HE_HP`
- `HE_prg`
- `wt_itvex`
- `kstrata`
- `psu`

Leakage guards:

- `HE_sbp1`, `HE_dbp1`
- `HE_sbp2`, `HE_dbp2`
- `HE_sbp3`, `HE_dbp3`
- `HE_sbp`, `HE_dbp`
- `DI1_dg`, `DI1_ag`, `DI1_pr`, `DI1_pt`, `DI1_2`

## 5. Expected 2023/2024 sleep-instrument difference

The following 2024 source variables are **not required** in KNHANES 2023 and
their absence is expected:

- `BP16_11`, `BP16_12`, `BP16_13`, `BP16_14`
- `BP16_21`, `BP16_22`, `BP16_23`, `BP16_24`

Their absence must be recorded as an expected instrument difference, not as a
missing-required-column failure.

## 6. Evidence boundary

Still allowed in G7-A:

- official documentation
- SAS metadata only
- column names and labels
- SHA-256

Still prohibited:

- participant-level values
- target prevalence
- model fitting
- predictions
- performance metrics
- subgroup performance

## 7. Revised G7-A decision

Approve KNHANES 2023 only if:

1. every revised required source/target/survey/leakage column is present;
2. `BP16_1` and `BP16_2` are present;
3. no other semantic incompatibility is identified;
4. participant-level values/performance remain uninspected.

Decision values remain:

- `APPROVE_KNHANES_2023_FOR_G7`
- `NEEDS_CONTRACT_MAPPING_REVISION`
- `REJECT_KNHANES_2023_FOR_G7`

An approval means “approved for the predeclared transportability evaluation with
sleep-measurement shift.” It does not mean same-instrument equivalence.

## 8. Still locked

- KNHANES 2024 final internal test: 804 rows / 27 PSU groups
- V1 validation/test
