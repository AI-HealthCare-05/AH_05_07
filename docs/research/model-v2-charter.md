# SK7 Korean-compatible Model V2 — Clean-room Research Charter

Status: **design only — no raw-data access, model fitting, validation, or test access approved**

## 1. Purpose

Model V2 is a new Korean-compatible model research line.

It does not modify, continue tuning, or rescue the frozen V1 HGB/CatBoost research candidate.

The repository-level user-facing claim boundary remains:

**입력 기반 위험군 선별 신호**

unless a separately approved V2 target contract establishes a different supported research purpose.

V2 must not be presented as diagnosis, treatment guidance, prevention effect, causal improvement, or challenge effect.

## 2. Clean-room boundary

V2 starts from `main`.

The previous branch:

`research/model-rnd-mac-20260907`

is historical evidence only.

V2 must not use the following as development or selection data:

* V1 consumed validation
* V1 locked held-out test
* V1 validation-derived model ranking
* V1 calibration observations
* V1 subgroup observations
* V1 model-selection outcome

V1 HGB, CatBoost, EBM, LR, XGBoost, LightGBM, RF and ExtraTrees results may be cited only as historical research context.

They do not establish the V2 model family, features, thresholds, calibration method, or winner.

The V1 held-out test remains locked and is **not the V2 test**.

## 3. V2 target must be re-established

The V1 target name and construction are not inherited automatically.

Before participant-level data access, V2 must choose and document one research purpose.

### Cross-sectional path

A same-time Korean screening signal may be researched if a Korean dataset provides an appropriate measurement-based label and product-compatible predictors.

### Future-event path

Future hypertension incidence or another future event requires genuinely longitudinal data with:

* disease/event definition
* baseline non-event definition
* prediction horizon
* event date or interval
* follow-up handling
* censoring/loss-to-follow-up rules

A cross-sectional label must never be renamed into a future-risk target.

### Intervention/change path

Challenge effect, treatment effect, lifestyle effect, or causal improvement is outside the default V2 scope.

Such a claim requires a separate causal/repeated-measure research contract.

## 4. Korean product semantics first

V2 must not begin by forcing Korean users into the V1 eight-feature schema.

The sequence is:

product question/measurement semantics
→ candidate Korean dataset semantics
→ documented equivalence
→ feature contract
→ model research

A field is not accepted merely because its name looks similar.

Unknown, refused, ambiguous, unsupported, or semantically incompatible product states must be explicitly defined before inference implementation.

No profile field, identifier, free text, challenge result, or prior model score may be silently converted into a model feature.

## 5. Feature-selection boundary

The V2 predictor set is not selected yet.

Predictors must be justified before validation by:

* intended use
* measurement/question meaning
* realistic product collection
* availability in the approved development data
* target-leakage review
* privacy/data-minimization review

Features must not be added or removed simply because validation performance improves.

If blood-pressure measurements define the V2 label, those measurements and direct derivatives cannot also be predictors.

## 6. Data-source strategy

Initial documentation candidates may include Korean national or cohort datasets such as KNHANES and KoGES.

Their inclusion here does not mean they are approved.

Before raw-data access, each candidate must be reviewed for:

* population and recruitment
* survey/measurement dates
* target/label feasibility
* predictor/question semantics
* measurement protocols
* missing and refused states
* repeated participants
* sampling/weights
* access and permitted research use
* compatibility with the intended product population

Candidate states are:

`eligible for detailed design`
`partial / research-only`
`reject for current V2 purpose`

Raw data is not accessed merely to see whether a candidate “works.”

## 7. Data-role separation

Before model fitting, every participant-level record must receive a pre-defined role.

At minimum, V2 must distinguish:

development/training
model-selection validation
final internal test
external evaluation, when available

A final test cannot be used for:

* feature selection
* model-family selection
* hyperparameter tuning
* threshold selection
* calibration fitting
* calibration-method selection

If the final test is exposed, it cannot later become a development set.

## 8. Identity and leakage control

Where repeated measurements or longitudinal data exist, the same person must not cross incompatible train/validation/test roles.

Potential leakage through:

* participant identifiers
* repeated visits
* downstream diagnosis fields
* label-derived measurements
* post-baseline information

must be reviewed before splitting.

Identifiers are used only for controlled split/leakage checks where necessary and are not predictors.

## 9. Privacy and repository boundary

Real clinical records, names, contacts, original personal documents, or free-text medical histories must not be committed to the repository.

Participant-level research data stays outside the Git repository.

The repository may contain only:

* code
* schemas/contracts
* small non-sensitive manifests
* aggregate evidence
* reproducibility metadata
* documentation

Logs must not contain individual health inputs.

## 10. Split contract before modelling

The V2 split algorithm must be frozen before model-family comparison.

The contract must state:

* eligible population
* exclusions
* unit of splitting
* stratification, if any
* random seed
* train/validation/test proportions
* repeated-person handling
* external-evaluation role

The final test must be physically or logically protected from routine model-development scripts.

## 11. Metric contract before validation

Metric roles must be decided before observing V2 validation performance.

The plan must cover:

* discrimination
* class-imbalance-sensitive performance
* probability error/calibration
* subgroup reporting
* unavailable/small/single-class subgroup behavior
* uncertainty/precision reporting
* false-positive and false-negative consequences

No pass threshold may be reverse-engineered from observed validation results.

## 12. Calibration contract

Calibration is not automatic.

Model fitting, calibration fitting, calibration selection and final evaluation must have explicit data roles.

Validation or final test cannot simultaneously be claimed as an independent calibration evaluation after being used to fit or select that calibration.

An uncalibrated score must not be presented as a clinically calibrated absolute probability.

## 13. Bounded model search

V2 begins with an approved baseline after the data and split contracts are frozen.

Any broader model-family screen must be:

* finite
* documented in advance
* train-only or otherwise pre-specified
* reproducible
* closed before final validation

Model-family exploration must not continue until validation produces a desired winner.

## 14. Research gates

### G0 — Charter and intended-use contract

This document approved and merged.

### G1 — Korean dataset documentation eligibility

No participant-level access.

### G2 — Raw-data/schema audit

Only after G1 approval.

No model fitting.

### G3 — Cohort, target, feature and split freeze

Final internal test created and locked.

### G4 — Baseline reproducibility

Baseline only.

### G5 — Bounded development/model-family research

No final-test access.

### G6 — Frozen validation comparison

Validation is consumed after this gate.

### G7 — External Korean evaluation

Independent where feasible and appropriately pre-specified.

### G8 — One-time final internal test

Requires a separate explicit approval and complete pre-test freeze.

### G9 — Product/release review

Separate from research success.

No gate automatically activates production scoring.

## 15. Current executable state

After this charter is created:

* V1 research candidate: frozen
* V1 held-out test: locked
* V2 target: not yet selected
* V2 feature set: not yet selected
* V2 dataset: not yet approved
* V2 participant-level data access: denied
* V2 model fitting: denied
* V2 validation: not created
* V2 test: not created
* production model: not selected
* product scoring: disabled
* release: not approved

## 16. First permitted next action

The next permitted action is:

**documentation-only comparison of Korean candidate datasets against candidate V2 research purposes.**

No raw dataset download or participant-level inspection occurs during that step.
