# Model V2 T5 — Synthetic-only Input Adapter Result

Status: **IMPLEMENTED / SYNTHETIC-ONLY / PRODUCTION DISABLED**

Starting main: `6cbb522d5a0c03a4df5d842a6f885c225e599874`

Issue: `#314`

Adapter version: `model-v2-product-input-adapter-v1`

## Scope

T5 adds one transient, in-memory adapter that converts a complete synthetic
product-input payload to the frozen eleven-feature Model V2 semantic payload.

T5 does not:

- authorize real-user health-data collection
- add or change an HTTP endpoint
- persist adapter input or derived features
- add browser persistence or analytics
- join BP, challenge, check-in, user ID, or prior model output
- load or inspect the frozen artifact
- enable inference or production scoring
- decide continuous-score visibility, missing-value policy, or 80+ product handling

## Adapter-v1 input

The input contains exactly 19 fields:

1. `age_years`
2. `sex_knhanes`
3. `height_cm`
4. `weight_kg`
5. `cigarette_smoking_state`
6. `alcohol_frequency`
7. `alcohol_amount_category`
8. `walking_days_7d`
9. `walking_active_day_hours`
10. `walking_active_day_minutes`
11. `strength_days_7d`
12. `weekday_bed_hour`
13. `weekday_bed_minute`
14. `weekday_wake_hour`
15. `weekday_wake_minute`
16. `weekend_bed_hour`
17. `weekend_bed_minute`
18. `weekend_wake_hour`
19. `weekend_wake_minute`

Adapter v1 is complete-input only. Missing keys, extra keys, null,
unknown/refused placeholders, numeric strings, booleans as numbers, non-finite
numbers, noncanonical categories, and invalid structural combinations fail
closed.

Age establishes the frozen lower cohort boundary (`>=19`) without inventing an
upper cutoff or an 80+ top-code/exclusion rule.

## Frozen derivations preserved

BMI:

`weight_kg / (height_cm / 100) ** 2`

No new rounding is introduced.

Walking active-day duration:

`walking_active_day_hours * 60 + walking_active_day_minutes`

Zero walking days require both duration components to be zero and derive
`walking_minutes_per_active_day=0`.

Sleep reproduces the G3 Cycle 9 adjustment exactly for weekday and weekend
clocks:

1. require whole hours `0..24`
2. require whole minutes `0..59`
3. independently add 24 to bed/wake hours in `1..12`
4. convert each clock to minutes
5. subtract bed from wake
6. add 1440 if the duration is negative

The adapter then passes the derived payload through the unchanged T2
`validate_semantic_input()` boundary. The returned mapping is rebuilt in exact
frozen feature order.

## Semantic output

Exactly the frozen eleven keys are returned:

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

## Invariants

- frozen artifact changed: **False**
- artifact access required by adapter/tests: **False**
- artifact SHA changed: **False**
- schema changed: **False**
- feature order changed: **False**
- preprocessing changed: **False**
- T2 semantic validator changed: **False**
- T4 API behavior changed: **False**
- legacy route changed: **False**
- retraining/recalibration: **0**
- threshold/risk-band creation: **0**
- participant-level research-data access: **0**
- validation/final-test access: **0**
- artifact regeneration/download: **0**
- persistence/DB/migration changes: **0**
- web/UI changes: **0**
- deployment changes: **0**
- production activation: **0**

Production scoring remains disabled by default. T5 completion is not approval
for real-user collection, score visibility, product release, or production
activation.

Final test/lint counts are recorded by the PR/CI run.
