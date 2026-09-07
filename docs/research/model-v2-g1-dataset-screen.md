# Model V2 G1 — Korean Dataset Documentation Screen

Status: **documentation screen complete — participant-level raw-data access remains denied**

## 1. Scope

This document executes G1 of:

`docs/research/model-v2-charter.md`

The review is documentation-only.

No participant-level Korean research data was downloaded, opened, inspected, transformed, or modeled.

The frozen V1 validation and held-out test were not used as V2 development or selection evidence.

## 2. Candidate V2 purposes

Two technically distinct research paths were reviewed.

### Path A — Korean cross-sectional screening signal

Purpose:

A same-time, input-based Korean risk-group screening signal using product-collectable predictors and a measurement-based health label.

This is the preferred first V2 path.

It does not claim:

* diagnosis
* future hypertension incidence
* treatment effect
* challenge effect
* causal health improvement

### Path B — Future-event risk research

Purpose:

Prediction of a separately defined future event after a baseline time point.

This requires:

* baseline non-event definition
* explicit event definition
* prediction horizon
* follow-up timing
* loss-to-follow-up/censoring rules
* post-baseline leakage control

Path B is valuable but is not treated as a simple extension of Path A.

## 3. Candidate matrix

| Dataset                             | Cross-sectional screening          | Future-event research           | Current G1 classification                                           | Primary reason                                                                                                                                             |
| ----------------------------------- | ---------------------------------- | ------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KNHANES                             | Strong                             | Weak/current follow-up immature | **eligible for detailed design**                                    | National Korean survey with measured examination data, health-behavior questionnaire, survey weights, and public data documentation                        |
| KoGES                               | Moderate/restricted population     | Strong                          | **eligible for detailed design for a separate future-event path**   | Large Korean longitudinal cohort with repeated survey/examination and follow-up                                                                            |
| NHIS health-screening research data | Potentially strong                 | Potentially very strong         | **partial / research-only pending exact research-DB documentation** | Routine screening includes BP/BMI/lifestyle and longitudinal health utilization, but exact research-variable/access contract needs further official review |
| Community Health Survey             | Weak for current measurement label | Weak                            | **reject for current V2 measurement-label purpose**                 | Strong questionnaire coverage but height/weight are self-reported and no equivalent measured BP examination label was identified                           |

## 4. KNHANES

### Strengths

Official documentation supports:

* nationwide Korean population health survey
* examination plus health questionnaire
* measured height and weight
* measured systolic and diastolic blood pressure
* smoking
* alcohol
* physical activity
* sleep/mental-health-related questionnaire content
* survey weights
* public raw-data user guides and variable documentation

Recent public raw-data releases contain hundreds of response and measurement variables together with survey weights.

### Best role

**Primary V2-A development candidate**

KNHANES is the strongest candidate for defining a Korean-native cross-sectional input/target contract without forcing V1's eight-feature schema onto Korean users.

### Limits

KNHANES has historically been primarily cross-sectional.

A follow-up program has recently begun, but it is not treated as a mature future-event development source for the current V2 research cycle.

A specific survey year or pooled-cycle contract is not selected at G1.

Exact cycle compatibility must be reviewed before G2.

## 5. KoGES

### Strengths

Official documentation supports:

* large Korean cohort
* general population cohorts primarily starting from age 40+
* repeated follow-up
* health and lifestyle questionnaires
* smoking
* alcohol
* physical activity
* measured blood pressure/pulse
* body/clinical examination
* long-term disease follow-up
* research application process and controlled analysis environment

### Best role

**Primary candidate for a separate V2-B future-event research path**

KoGES is structurally better suited than conventional cross-sectional surveys for future-event research.

### Limits for the first V2 product path

* major population cohorts emphasize middle-aged and older adults
* cohort-specific survey items differ
* product-input semantics require exact questionnaire review
* access/application overhead is materially higher than public KNHANES documentation
* it cannot automatically validate a full adult-population product

KoGES may also become a restricted-population external evaluation candidate for Path A if exact feature/target semantics are later established.

## 6. NHIS health-screening research data

### Strengths

The Korean national health-screening program includes:

* measured blood pressure
* height
* weight
* BMI
* smoking-related assessment
* alcohol-related assessment
* exercise/lifestyle assessment
* longitudinal health-service information

This makes NHIS conceptually attractive for a large future-event research program.

### Current blocker

At G1, the exact official research-DB contract required for V2 has not been sufficiently closed.

Before promotion to `eligible for detailed design`, confirm from official research-data documentation:

* exact available examination variables
* questionnaire variable definitions
* repeated-screening identifiers and timing
* claims/outcome linkage
* supported observation years
* research access conditions
* export/output restrictions
* event-date precision
* medication/diagnosis semantics

### Current role

**partial / research-only pending documentation**

No NHIS raw/research data access is approved.

## 7. Community Health Survey

### Strengths

The survey provides broad Korean population questionnaire coverage including:

* smoking
* alcohol
* physical activity
* sleep
* health-care use
* diagnosed chronic-disease history

It is valuable for population behavior and Korean questionnaire/UX research.

### Current mismatch

Current documentation describes self-reported height and weight and does not establish an examination-based BP label equivalent to the intended measurement-based Path A target.

### Current role

**reject for the current V2 measurement-label model**

It may be used later as:

* questionnaire wording reference
* population behavior context
* non-model epidemiologic research

but not as the primary model-development dataset for the current target concept.

## 8. G1 recommended V2 direction

The preferred first Model V2 research path is:

**Path A — Korean cross-sectional screening signal**

The preferred development-data candidate is:

**KNHANES**

This choice is based on structural suitability and documentation availability, not model performance.

No model has been trained and no candidate feature set has been evaluated.

## 9. Why Path A is first

Path A allows V2 to fix the central V1 problem at its source:

**product-native Korean input semantics**

rather than adapting Korean users to a U.S. NHANES feature contract.

It also permits a measurement-based Korean target without requiring a claims-based or long-horizon event definition.

Path B remains scientifically important, but it should begin as a separate longitudinal research contract rather than delaying or contaminating Path A.

## 10. External-evaluation strategy

Using another random portion of the same KNHANES development pool is internal evaluation, not external validation.

The preferred hierarchy is:

1. frozen internal development/validation/test roles within the approved KNHANES design;
2. temporal evaluation on a separately reserved compatible KNHANES cycle where justified;
3. independent/restricted-population Korean evaluation using KoGES or another institutionally distinct source if exact target and input semantics can be established;
4. broader external Korean validation before product-release claims.

A KoGES result limited to age 40+ must not be generalized automatically to younger adults.

## 11. Target direction for G2/G3

G1 recommends investigating a target based on same-time Korean examination measurements.

The exact target is **not frozen yet**.

Before G3, documentation must decide:

* which BP measurements are used
* repeat-measure averaging rule
* medication/known-diagnosis role
* target threshold definition
* whether the label means measured elevated BP, a broader hypertension-related state, or another explicitly named screening construct

The eventual user-facing model output must not be called a diagnosis.

## 12. Predictor design principle

V2 does not inherit the V1 eight-feature list.

Candidate predictors are selected only after Korean dataset and product semantics review.

A predictor must satisfy all of:

* available with documented meaning in the approved development dataset
* realistically collectible in the intended product
* semantically reproducible between research and product
* not target leakage
* appropriate under data-minimization/privacy constraints

Measured BP or direct BP derivatives cannot be predictors if they define the target.

## 13. Major blockers before G2

The following remain open:

* final Path A target wording
* supported product age range
* exact KNHANES cycle or cycle pool
* Korean sex/gender input concept, if used
* product questionnaire burden
* exact smoking/alcohol/activity/sleep candidate semantics
* measured vs self-reported anthropometry policy
* survey-weight role in development and evaluation
* cycle pooling and survey-design handling
* medication/diagnosis contribution to target definition
* independent external-evaluation dataset
* minimum sample/event and precision plan

These questions must not be resolved by looking at model performance first.

## 14. G1 outcome

### Path A

Research purpose:

**recommended**

Development candidate:

**KNHANES — eligible for detailed design**

### Path B

Research purpose:

**preserved as a separate future research track**

Development candidate:

**KoGES — eligible for detailed design for longitudinal research**

### NHIS

**partial / research-only pending exact official research-DB contract**

### Community Health Survey

**reject for current measurement-label model development**

## 15. Current executable state

After G1 documentation review:

* V1 candidate: frozen
* V1 test: locked
* V2 preferred research path: Path A, proposed
* V2 development candidate: KNHANES, proposed
* exact V2 target: not frozen
* exact V2 features: not frozen
* exact KNHANES cycle: not selected
* V2 raw-data access: denied
* V2 model fitting: denied
* V2 validation: not created
* V2 final test: not created
* production scoring: disabled
* release: not approved

## 16. Next gate

The next gate is:

**G2 — KNHANES raw-data/schema audit**

G2 may begin only after explicit human approval of the G1 direction.

G2 permits only:

* approved KNHANES participant-level schema/data audit
* cohort feasibility counts
* missingness/schema inspection
* target/predictor availability verification

G2 does **not** permit:

* model fitting
* feature selection by performance
* validation comparison
* hyperparameter tuning
* calibration
* threshold optimization
* production serialization
* API activation
