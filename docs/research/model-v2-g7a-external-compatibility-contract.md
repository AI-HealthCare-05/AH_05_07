# Model V2 G7-A — KNHANES 2023 External Compatibility Screen

Status: **documentation + schema-only screening; no participant-level outcome/performance access**

## Purpose

Determine whether KNHANES 2023 can serve as the temporally separate Korean
external evaluation dataset for Model V2-A without changing the frozen G3
feature/target semantics.

## Evidence boundary

Allowed in G7-A:

- official KNHANES 2023 guide/code documentation
- SAS file metadata and column names
- variable labels
- file SHA-256
- schema compatibility checks

Prohibited in G7-A:

- participant-level values
- target prevalence
- model fitting
- prediction
- AUROC/AP/Brier/calibration
- subgroup performance
- performance-driven mapping changes

## Frozen Model V2-A mapping to verify

Predictor sources:

- `age_years` <- `age`
- `sex_knhanes` <- `sex`
- `bmi_from_height_weight` <- `HE_ht`, `HE_wt`
- `cigarette_smoking_state` <- `BS1_1`, `BS3_1`
- `alcohol_frequency` <- `BD1_11`
- `alcohol_amount_category` <- `BD2_1`
- `walking_days_7d` <- `BE3_31`
- `walking_minutes_per_active_day` <- `BE3_32`, `BE3_33`
- `strength_days_7d` <- `BE5_1`
- `weekday_sleep_minutes` <- `BP16_11`, `BP16_12`, `BP16_13`, `BP16_14`
- `weekend_sleep_minutes` <- `BP16_21`, `BP16_22`, `BP16_23`, `BP16_24`

Target:

- `v2_hypertension_state` <- `HE_HP == 4`

Cohort/survey:

- adult age >= 19
- explicit current pregnancy exclusion: `HE_prg == 1`
- positive `wt_itvex`
- present `kstrata`, `psu`

Leakage fields that must remain excluded:

- `HE_sbp1`, `HE_dbp1`
- `HE_sbp2`, `HE_dbp2`
- `HE_sbp3`, `HE_dbp3`
- `HE_sbp`, `HE_dbp`
- `HE_HP`
- `DI1_dg`, `DI1_ag`, `DI1_pr`, `DI1_pt`, `DI1_2`

## Documentation findings to freeze before schema inspection

The KNHANES 9th-cycle documentation identifies 2023 as the second year of the
same 2022–2024 cycle. The documented semantics relevant to Model V2-A are
compatible with the frozen 2024 contract:

- `wt_itvex` is the health interview/examination survey weight.
- `kstrata` and `psu` are the complex-survey stratum and primary sampling unit.
- `HE_HP` uses categories 1 normal, 2 elevated-attention, 3 pre-hypertension,
  4 hypertension, with hypertension based on final SBP/DBP or antihypertensive
  medication.
- `HE_prg` is current pregnancy status.
- `HE_sbp1/2/3`, `HE_dbp1/2/3`, `HE_sbp`, `HE_dbp` and
  `DI1_dg/ag/pr/pt/2` remain target-adjacent leakage.
- walking uses `BE3_31/32/33`.
- strength uses `BE5_1`.
- sleep clock-time fields use `BP16_11..14` and `BP16_21..24` with 88/99
  missing codes.
- alcohol frequency/amount retain `BD1_11` and `BD2_1`.
- cigarette lifetime/current state retain `BS1_1` and `BS3_1`.

No G7-A documentation finding currently requires a feature or target semantic
change. The final G7-A decision is withheld until the actual KNHANES 2023 main
database metadata confirms all required columns.

## Schema-only decision

The schema audit produces exactly one decision:

- `APPROVE_KNHANES_2023_FOR_G7`
- `NEEDS_CONTRACT_MAPPING_REVISION`

`REJECT_KNHANES_2023_FOR_G7` is reserved for a documented fundamental semantic
incompatibility, not a missing local file.

A schema approval authorizes preparation of a separate G7 participant-level
evaluation contract. It does **not** authorize model fitting or external
performance evaluation by itself.

## Still locked

- KNHANES 2024 final internal test: 804 rows / 27 PSU groups
- V1 validation/test
