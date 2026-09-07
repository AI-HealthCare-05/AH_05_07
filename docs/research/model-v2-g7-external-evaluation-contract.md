# Model V2 G7 — KNHANES 2023 Temporal Korean Transportability Evaluation

Status: **contract frozen before participant-level KNHANES 2023 access**

Issue: #289

## Purpose

Evaluate the already-frozen Model V2-A candidate on temporally separate Korean
data from KNHANES 2023.

This is a **temporal Korean transportability evaluation with a predeclared
sleep-measurement instrument shift**. It is not an exact same-instrument
replication and is not an independent-source external validation.

The product semantics remain:

> 입력 기반 위험군 선별 신호

This gate does not support diagnosis, future-risk, treatment, prevention, or
causal-improvement claims.

## Frozen candidate

- family: `logistic_regression`
- fit data: full G3 development set only
- 4,157 development rows / 134 PSU groups
- exact G3 11 semantic features
- exact G4/G5/G6 preprocessing and logistic-regression configuration
- no G6 validation labels used for fitting
- no threshold selection
- no recalibration
- no feature/family/hyperparameter changes

## KNHANES 2023 source

- file: `hn23_all.sas7bdat`
- SHA-256:
  `62b3a67bd1a86fb459c78b404735a182ec0fe03cd4d35f7420d665b5b1e2741c`
- G7-A decision: `APPROVE_KNHANES_2023_FOR_G7`

Participant-level external data remain outside Git.

## Cohort

Apply the frozen G3 eligibility semantics:

1. `age >= 19`
2. `HE_HP` in `{1, 2, 3, 4}`
3. `ID` present
4. `kstrata` present
5. `psu` present
6. `wt_itvex` present and positive
7. exclude explicit current pregnancy: `HE_prg == 1`

Missing candidate predictors do not exclude participants.

## Target

`v2_hypertension_state`:

- positive: `HE_HP == 4`
- negative: `HE_HP in {1, 2, 3}`

The target is same-time hypertension-state semantics used only for evaluating
the input-based screening signal.

## Frozen 11 semantic features

1. `age_years` <- `age`
2. `sex_knhanes` <- `sex`
3. `bmi_from_height_weight` <- `HE_ht`, `HE_wt`
4. `cigarette_smoking_state` <- `BS1_1`, `BS3_1`
5. `alcohol_frequency` <- `BD1_11`
6. `alcohol_amount_category` <- `BD2_1`
7. `walking_days_7d` <- `BE3_31`
8. `walking_minutes_per_active_day` <- `BE3_31/32/33`
9. `strength_days_7d` <- `BE5_1`
10. `weekday_sleep_minutes`
11. `weekend_sleep_minutes`

All non-sleep source-to-feature derivations remain the frozen G3 semantics.

### Predeclared KNHANES 2023 sleep harmonization

KNHANES 2023 uses direct average sleep-duration fields rather than the 2024
bed/wake clock-time fields.

For G7 only:

- `weekday_sleep_minutes = BP16_1 * 60`
- `weekend_sleep_minutes = BP16_2 * 60`
- `BP16_1` values `88`, `99`, or missing -> missing
- `BP16_2` values `88`, `99`, or missing -> missing

No clipping, interpolation, rescaling beyond hours-to-minutes, or
performance-driven harmonization is allowed.

## Permanent leakage exclusions

The following never become predictors:

- `HE_sbp1`, `HE_dbp1`
- `HE_sbp2`, `HE_dbp2`
- `HE_sbp3`, `HE_dbp3`
- `HE_sbp`, `HE_dbp`
- `HE_HP`
- `DI1_dg`, `DI1_ag`, `DI1_pr`, `DI1_pt`, `DI1_2`
- identifiers
- survey-design fields
- split roles
- prior scores
- challenge/adherence fields
- post-outcome fields

## Evaluation metrics

Primary:

- survey-weighted AUROC

Secondary:

- survey-weighted average precision
- survey-weighted Brier score
- weighted calibration intercept
- weighted calibration slope

Labeled sensitivity analyses:

- unweighted AUROC
- unweighted average precision
- unweighted Brier score

Descriptive subgroups only:

- sex categories
- age 19–29
- age 30–39
- age 40–49
- age 50–59
- age 60–69
- age 70–79
- age 80+

Subgroups are descriptive and cannot trigger model changes.

## Frozen G7 decision criteria

All criteria were fixed before participant-level external access:

1. weighted external AUROC >= 0.75
2. G6 weighted validation AUROC minus weighted external AUROC <= 0.08
3. weighted external Brier <= 0.20
4. weighted calibration slope is finite and positive
5. integrity, provenance, reproducibility, and safety checks pass

PASS decision:

`PASS_ADVANCE_TO_G8_REVIEW`

Failure decision:

`STOP_EXTERNAL_TRANSPORTABILITY_GATE_FAILED`

A failure is documented as-is. External results must not be used to repair,
retune, recalibrate, remap, or select the model.

## Reproducibility

Within the single G7 consumption event:

- prepare the external cohort once in memory;
- perform two fresh fits from the same frozen development frame;
- predict twice on the same in-memory external cohort;
- maximum absolute probability difference must be <= `1e-12`.

## Consumption boundary

### `--preflight-only`

May read:

- G3 development participant data
- G3/G5/G6/G7-A aggregate evidence
- repository state
- source path existence and source file hash

Must not read:

- participant-level KNHANES 2023 values
- KNHANES 2024 final-test values

The raw SAS file may be byte-hashed but must not be parsed for rows.

### `--consume-external`

Requires:

- clean committed checkout
- fresh, nonexistent output directory
- consumption marker written **before** participant-level KNHANES 2023 parsing

The event may then read the required 2023 columns exactly once to prepare the
external cohort.

Participant-level outputs remain outside Git:

- prepared external cohort
- external predictions
- full G7 evidence JSON

## Still prohibited

- G6 validation-driven iteration
- validation-label reuse for fitting
- operational threshold selection
- recalibration
- feature changes
- hyperparameter tuning
- family changes
- production serialization
- V1 validation/test reuse
- KNHANES 2024 final internal test access

## G8 lock

KNHANES 2024 final internal test remains locked until a separate explicit G8
approval.
