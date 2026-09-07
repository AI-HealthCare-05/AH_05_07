# Model V2 G2 — KNHANES 2024 Schema and Feasibility Audit

Status: **G2 audit complete — proceed to G3 design only; model fitting remains prohibited**

## 1. Scope

This document closes the bounded G2-A audit for the approved Model V2-A Korean cross-sectional screening research path.

The audit used KNHANES 2024 annual main database metadata and aggregate counts only.

No participant-level record is stored in this repository.

## 2. Source

- file: `hn24_all.sas7bdat`
- rows: **6,997**
- columns: **813**
- SHA-256: `ff74cb84432cb1f10ba63d1a3aba54215ef38e47afef29547f83127aea9fc47f`
- participant-level source remains outside Git

The earlier nutrition-detail file `hn24_24rc` was identified as the wrong sub-database and excluded from the strict main-DB audit.

## 3. Safety boundary verification

- `participant_values_written`: **False**
- `model_fitting_performed`: **False**
- `split_performed`: **False**
- `performance_metrics_computed`: **False**
- `feature_ranking_performed`: **False**
- `calibration_performed`: **False**
- `threshold_selection_performed`: **False**

Therefore G2 contains no model-selection evidence.

## 4. Blood-pressure and target components

- `HE_sbp1` — 1차 수축기 혈압
- `HE_dbp1` — 1차 이완기 혈압
- `HE_sbp2` — 2차 수축기 혈압
- `HE_dbp2` — 2차 이완기 혈압
- `HE_sbp3` — 3차 수축기 혈압
- `HE_dbp3` — 3차 이완기 혈압
- `HE_sbp` — 최종 수축기 혈압(2,3차 평균)
- `HE_dbp` — 최종 이완기 혈압(2,3차 평균)

`HE_sbp` and `HE_dbp` are labeled as final systolic/diastolic pressure values derived from the second and third measurements.

`HE_HP` is retained as the preferred **target candidate**, not a predictor. Its exact category-code contract must be copied from the official 2024 user guide/codebook and frozen in G3 before any modelling.

Because hypertension diagnosis/treatment/medication variables are target-adjacent and may participate in the official hypertension-state definition, they are excluded from predictors.

### Target/leakage availability

| Variable | Status | Official label | Non-null | Missing |
| --- | --- | --- | ---: | ---: |
| `HE_HP` | present | 고혈압 유병여부 | 5,955 | 1,042 (14.9%) |
| `HE_sbp` | present | 최종 수축기 혈압(2,3차 평균) | 6,737 | 260 (3.7%) |
| `HE_dbp` | present | 최종 이완기 혈압(2,3차 평균) | 6,737 | 260 (3.7%) |
| `DI1_dg` | present | 고혈압 의사진단 여부 | 6,988 | 9 (0.1%) |
| `DI1_pr` | present | 고혈압 현재 유병 여부 | 6,988 | 9 (0.1%) |
| `DI1_pt` | present | 고혈압 치료 | 6,988 | 9 (0.1%) |
| `DI1_2` | present | 혈압조절제 복용 | 6,988 | 9 (0.1%) |

## 5. Predictor leakage exclusions

The following must not be candidate predictors for the current BP-related target design:

- `HE_sbp1`
- `HE_dbp1`
- `HE_sbp2`
- `HE_dbp2`
- `HE_sbp3`
- `HE_dbp3`
- `HE_sbp`
- `HE_dbp`
- `HE_HP`
- `DI1_dg`
- `DI1_pr`
- `DI1_pt`
- `DI1_2`

This includes direct BP measurements, the derived hypertension state, and current diagnosis/treatment/medication variables.

## 6. Product-input feasibility candidates

These variables are feasibility candidates only. G2 does not select a final feature set.

| Variable | Status | Official label | Non-null | Missing |
| --- | --- | --- | ---: | ---: |
| `age` | present | 나이 | 6,997 | 0 (0.0%) |
| `sex` | present | 성별 | 6,997 | 0 (0.0%) |
| `HE_ht` | present | 신장 | 6,881 | 116 (1.7%) |
| `HE_wt` | present | 체중 | 6,956 | 41 (0.6%) |
| `HE_BMI` | present | 체질량지수 | 6,881 | 116 (1.7%) |
| `BS3_1` | present | 현재 일반담배(궐련) 흡연 여부 | 6,988 | 9 (0.1%) |
| `BD1_11` | present | 1년간 음주빈도 | 6,988 | 9 (0.1%) |
| `BD2_14` | present | 한번에 마시는 음주량(잔) | 6,988 | 9 (0.1%) |
| `BE3_31` | present | 1주일간 걷기 일수 | 6,988 | 9 (0.1%) |
| `BE3_32` | present | 걷기 지속 시간(시간) | 6,988 | 9 (0.1%) |
| `BE3_33` | present | 걷기 지속 시간(분) | 6,988 | 9 (0.1%) |
| `BE5_1` | present | 1주일간 근력운동 일수 | 6,988 | 9 (0.1%) |
| `pa_aerobic` | present | 유산소 신체활동 실천율 | 5,483 | 1,514 (21.6%) |
| `BP16_1` | absent | — | — | — |
| `BP16_2` | absent | — | — | — |

### Current interpretation

- `age`: strong product-native candidate.
- `sex`: candidate only if the product input preserves the KNHANES survey meaning; do not silently reinterpret it as gender identity.
- `HE_ht` + `HE_wt`: preferred product-facing anthropometry inputs; BMI can be calculated identically in product code.
- `HE_BMI`: research convenience field; product parity requires deriving BMI from product-entered height/weight rather than asking users for BMI.
- `BS3_1`: compact current-cigarette-smoking candidate.
- `BD1_11` + `BD2_14`: compact drinking frequency/amount candidates.
- walking / strength / aerobic activity candidates remain to be reduced to the smallest semantically reproducible questionnaire contract.
- `BP16_1` / `BP16_2`: sleep-duration candidates if present and confirmed by the official codebook.

## 7. Age feasibility

| Age band | Count |
| --- | ---: |
| under_18 | 925 |
| 18_29 | 749 |
| 30_39 | 643 |
| 40_49 | 935 |
| 50_59 | 1,128 |
| 60_69 | 1,280 |
| 70_79 | 911 |
| 80_plus | 426 |

G2 does not choose a supported product age range from predictive performance.

## 8. Survey design

Available survey-design fields include:

- `psu`
- `wt_hs`
- `wt_itvex`
- `wt_ntr`
- `wt_pft`
- `wt_tot`
- `wt_pfnt`
- `kstrata`

The modelling/evaluation role of survey weights, strata and PSU is deferred to the G3 statistical design contract.

## 9. G2 decision

**Proceed to G3 design.**

G2 establishes that KNHANES 2024 is structurally suitable for the V2-A design because:

- repeated and final BP measurements are present;
- a hypertension-state target candidate is present;
- realistic non-invasive product inputs are available;
- survey-design fields are available;
- the dataset covers a broad age range;
- leakage-prone diagnosis/treatment/medication fields can be explicitly excluded.

## 10. G3 must freeze before modelling

G3 must explicitly freeze:

1. exact cohort eligibility and age range;
2. exact `HE_HP` category-code mapping from the official 2024 guide;
3. binary target definition and excluded/missing categories;
4. predictor list and exact Korean product-question semantics;
5. BMI research/product parity rule;
6. survey-weight / strata / PSU handling;
7. missing/refused/not-applicable handling;
8. development / validation / final-test roles;
9. physical/logical protection of the new V2 final test;
10. metric hierarchy before any model-family comparison.

Until G3 is merged:

- model fitting: **prohibited**
- train/validation/test split: **prohibited**
- feature ranking by outcome performance: **prohibited**
- calibration/threshold tuning: **prohibited**
- V1 validation/test reuse: **prohibited**
- production scoring: **disabled**

_Generated from aggregate G2 audit outputs on 2026-09-07._
