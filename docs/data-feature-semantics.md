# NHANES feature semantics — preparation version 2

Reviewed against CDC/NCHS codebooks on 2026-09-05. The manifest is executable;
this table explains the source meanings and the input contract required before
release. Source choices are preserved, not quietly substituted with new questions.

| Predictor | Source meaning | Preparation | Required future input / current mismatch |
| --- | --- | --- | --- |
| RIAGENDR | Recorded sex code 1/2 | Categorical, missing=-1 | Versioned 1/2 source mapping; not inferred from identity |
| RIDAGEYR | Age at screening; 80 means 80+ | Numeric; restrict to adult 18..80 coded values | Adult age; explicitly top-code 80+ before inference |
| BMXBMI | Measured BMI in kg/m² | Numeric; include 10..80 to match existing SK7 input scope | BMI with measurement/unit provenance; missing or out-of-scope blocks inclusion |
| PAQ605 | Vigorous work, unpaid work, chores or yard activity, at least 10 continuous minutes | 1 yes / 2 no; 7 and 9 become missing; categorical | A matching work/chores question; exercise days cannot populate this |
| PAQ620 | Moderate work/chores activity, at least 10 continuous minutes | Same categorical policy | Separate matching question; cannot duplicate exercise days |
| SMQ020 | At least 100 cigarettes across lifetime | Same categorical policy | Lifetime history; current smoking status is not equivalent |
| ALQ111 | Ever at least one alcoholic drink, excluding small tastes/sips | Same categorical policy | Lifetime history; drinking frequency and ALQ101 are not aliases |
| SLD012 | Weekday/workday main sleeping period derived from usual sleep/wake times, rounded to half-hours | One categorical level per released value; missing=-1 | Matching main-period question and explicit rounding/end-category mapping; not total daily sleep including naps |

SLD012=2 means less than 3 hours; 14 means 14 hours or more. The intermediate
released values are 3, 3.5, ... 13.5. One-hot encoding avoids treating either end
category as an exact duration. These values are not recoded as refusal/unknown.
Age=80 likewise remains a top-coded source value, not an exact age for every row.

Sources: [DEMO](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_DEMO.htm),
[BMX](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_BMX.htm),
[PAQ](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_PAQ.htm),
[SMQ](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_SMQ.htm),
[ALQ](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_ALQ.htm),
[SLQ](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_SLQ.htm).

## Label and joins

[BPXO](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_BPXO.htm)
provides three oscillometric readings per component. Version 2 requires at least
one positive finite systolic AND one positive finite diastolic reading. A row
missing either component is excluded even when the other component is elevated.
This conservative, explicit choice trades sample size for consistent label
availability. Thresholds remain the existing >=130 / >=80 contract. Missing BP
is never imputed and never interpreted as label 0. This is not a diagnosis label
or a treatment-aware definition; treated participants with lower measured BP
can have label 0 under this research target.

Validate positive integer, nonmissing, unique SEQN in every module before joins.
Start from eligible adult demographics and left-join other modules one-to-one.
Then apply BP and BMI eligibility. Missing questionnaire rows stay eligible with
missing responses. Unexpected questionnaire values fail preparation rather than
being silently interpreted. Sort by SEQN before splitting and writing, so source
row order cannot change split membership. SEQN and BP values are never predictors.

## Release barrier

The legacy API DTO has exercise days, current smoking status, alcohol frequency,
and generic sleep hours. It is not equivalent to this source schema. The API now
returns `503 model_not_ready` even if artifact environment variables are set;
the invalid mapping has been removed. The DTO is retained for compatibility
while the endpoint remains unavailable. Releasing a versioned questionnaire,
strict normalization adapter, metadata semantics version, fitted preprocessing,
and reviewed artifact is a separate feature. No product input agreement or
clinical generalization is claimed by successful data preparation.
