# Model V2 G3 — KNHANES 2024 Cohort / Target / Feature / Split Freeze

Status: **APPROVED 2026-09-07 — G3 design and split creation only**

## 1. Research purpose
Model V2-A is a Korean cross-sectional **입력 기반 위험군 선별 신호** research path.
It is not diagnosis, future-event risk prediction, treatment guidance, causal effect estimation, or challenge-effect estimation.

## 2. Approved source
- dataset: KNHANES 2024 annual main database
- file: `hn24_all.sas7bdat`
- source SHA-256: `ff74cb84432cb1f10ba63d1a3aba54215ef38e47afef29547f83127aea9fc47f`
- participant-level source remains outside Git
- V1 validation/test remain excluded
- 2022/2023 pooling remains unapproved

## 3. Cohort freeze
Include only participants satisfying all:
1. `age >= 19`
2. `HE_HP in {1,2,3,4}`
3. non-missing `ID`
4. non-missing `kstrata`
5. non-missing `psu`
6. positive non-missing `wt_itvex`
7. not explicitly currently pregnant (`HE_prg != 1`)

Missing predictors do not exclude a participant.

## 4. Target freeze
Official Cycle 9 semantics:
- `HE_HP = 1`: 정상
- `HE_HP = 2`: 주의혈압
- `HE_HP = 3`: 고혈압 전단계
- `HE_HP = 4`: 고혈압

Binary target `v2_hypertension_state`:
- positive: `HE_HP == 4`
- negative: `HE_HP in {1,2,3}`

This is a current cross-sectional state target, not future incidence.

## 5. Permanent leakage exclusions
Never use as predictors:
`HE_sbp1`, `HE_dbp1`, `HE_sbp2`, `HE_dbp2`, `HE_sbp3`, `HE_dbp3`,
`HE_sbp`, `HE_dbp`, `HE_HP`, `DI1_dg`, `DI1_ag`, `DI1_pr`, `DI1_pt`, `DI1_2`,
participant identifiers, split-role fields, survey-design identifiers, prior model scores,
challenge results, or post-outcome information.

`wt_itvex`, `kstrata`, `psu` are statistical-design metadata only.

## 6. Frozen feature contract
Exactly 11 model features:

1. `age_years` <- `age`
2. `sex_knhanes` <- `sex`
3. `bmi_from_height_weight` <- `HE_ht`, `HE_wt`
4. `cigarette_smoking_state` <- `BS1_1`, `BS3_1`
5. `alcohol_frequency` <- `BD1_11`
6. `alcohol_amount_category` <- `BD2_1`
7. `walking_days_7d` <- `BE3_31`
8. `walking_minutes_per_active_day` <- `BE3_32`, `BE3_33`
9. `strength_days_7d` <- `BE5_1`
10. `weekday_sleep_minutes` <- `BP16_11`, `BP16_12`, `BP16_13`, `BP16_14`
11. `weekend_sleep_minutes` <- `BP16_21`, `BP16_22`, `BP16_23`, `BP16_24`

No feature may be added or removed because later performance improves.

### BMI parity
`bmi = weight_kg / (height_cm / 100) ** 2`

Training and product serving must use the same formula and documented numeric representation.

### Alcohol correction
`BD2_14` is not used because it is a numeric follow-up for the highest amount category, not a general amount field.
Use `BD2_1` instead.

### Sleep
2024 uses bed/wake clock-time fields; direct `BP16_1`/`BP16_2` sleep-hour fields are not the 2024 contract.
Derived sleep duration must follow official midnight-crossing logic.

## 7. Missing / structural state policy
Keep distinct:
- observed
- structural non-applicable / branch skip
- unknown/refused/missing

Do not collapse them blindly.
Unknown/refused sentinels become missing.
Structural non-drinking/non-smoking states remain semantic categories where supported.
Zero walking duration is structural zero only when walking-days says no walking.
Sleep duration is missing if any required time component is unavailable.
BMI is missing if height/weight is unavailable or non-positive.
No complete-case filtering at G3.

## 8. Survey design freeze
Use:
- weight: `wt_itvex`
- stratum: `kstrata`
- cluster: `psu`

None are predictors.
Population-level evaluation should report survey-weighted estimates when appropriate.
Unweighted results may be reported only as labeled sensitivity/descriptive analyses.

## 9. Split freeze
Split unit: `(kstrata, psu)`.

No PSU cluster may cross roles.

For each unique `(kstrata, psu)`:
1. canonical key = `SK7-V2-G3-20260907|<kstrata>|<psu>`
2. SHA-256
3. first 16 hex digits -> uniform `[0,1)`
4. assign:
   - `<0.70` development
   - `0.70–<0.85` validation
   - `>=0.85` final internal test

The split does not inspect model performance or target prevalence.

## 10. Role protection
- development: permitted in G4/G5
- validation: locked until G6
- final internal test: locked until separately approved G8
- external evaluation: separate future Korean source

Participant-level role files remain outside Git.
Repository stores only code, aggregate counts, hashes, and reproducibility metadata.

The canonical G3 output root is **create-once**. The split-preparation script must
fail closed if that root already contains role files; it must never delete or
overwrite frozen validation or final-test data. Reproducibility checks must use
a separate fresh `--output-root`.

## 11. Metric-role freeze
Before any performance is observed:
- primary: survey-weighted AUROC
- secondary: survey-weighted average precision / PR-AUC
- secondary: survey-weighted Brier score
- calibration intercept/slope when appropriate
- labeled unweighted sensitivity analyses

Fixed subgroups:
- sex categories
- age 19–29, 30–39, 40–49, 50–59, 60–69, 70–79, 80+

No operational threshold is selected in G3.
Final test cannot be used for threshold selection.

## 12. G3 completion criteria
G3 is complete when:
- this contract is committed
- deterministic split implementation is committed
- development/validation/final-test roles are created outside Git
- validation and final test are physically separated and read-only
- repository-safe split manifest exists
- no model fitting occurred
- no validation/final-test performance was inspected
- production scoring remains disabled

After merge, only G4 baseline reproducibility on development is permitted.
