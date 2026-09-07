# Model V2 G2-A — KNHANES Raw-data and Schema Audit Contract

Status: **APPROVED 2026-09-07 — bounded KNHANES 2024 schema audit only**

## 1. Purpose

G2-A performs a bounded feasibility audit of KNHANES for the approved V2-A research direction:

**Korean cross-sectional input-based risk-group screening signal**

This gate does not train a model.

## 2. First audit year

The first participant-level audit dataset is:

**KNHANES 2024**

Rationale:

* 2024 public raw data and user guide are officially available
* 2024 completes KNHANES Cycle 9 (2022–2024)
* auditing one year first avoids silently assuming 2022, 2023 and 2024 schemas are identical
* cycle pooling will be a later explicit decision

The first audit must not automatically combine 2022–2024.

## 3. Permitted participant-level access

After G2-A approval, participant-level KNHANES 2024 data may be accessed only for:

* column/schema inventory
* variable types and coding
* cohort eligibility counts
* missing/refused/unknown counts
* candidate target availability
* candidate predictor availability
* repeated/duplicate identifier checks
* survey-design variable availability
* target leakage review
* measurement/question compatibility review

Aggregate summaries may be recorded.

## 4. Prohibited work

G2-A does not permit:

* model fitting
* train/validation/test splitting
* AUROC calculation
* PR-AUC calculation
* Brier calculation
* feature ranking by predictive performance
* hyperparameter search
* model-family comparison
* threshold selection
* calibration fitting
* feature selection based on outcome performance
* use of V1 validation or V1 test
* production serialization
* API activation

## 5. Repository boundary

Participant-level KNHANES files remain outside the Git repository.

Do not commit:

* SAS/SPSS/raw participant files
* extracted participant-level CSV/parquet files
* row-level identifiers
* individual health records

The repository may store only:

* audit code
* schema manifests
* aggregate counts
* non-sensitive variable mappings
* provenance
* documentation

## 6. Initial target audit

G2-A does not freeze the final target.

The audit must identify whether 2024 provides enough documented information to construct candidate measurement-based labels using:

* systolic BP measurements
* diastolic BP measurements
* number/order of repeated BP measurements
* valid/missing measurement status
* medication or known-hypertension fields, if considered

No target formula is selected because it produces a favorable prevalence.

## 7. Predictor audit

V2 does not inherit the V1 eight-feature list.

Candidate product-collectable predictor domains may be inspected, including:

* age
* sex/gender-related survey field, only after semantics are documented
* measured anthropometry
* smoking
* alcohol
* physical activity
* sleep
* other simple non-invasive health/lifestyle inputs

A variable is only a candidate if it is realistically reproducible in the product.

Measured BP and direct BP derivatives are prohibited predictors if BP defines the target.

## 8. Data minimization

Prefer variables that can be collected with low user burden and low privacy risk.

Do not use merely because available:

* identifiers
* direct clinical diagnosis codes with label leakage
* post-measurement variables unavailable at product inference time
* free-text medical history
* detailed sensitive information without a justified product requirement

## 9. Survey-design audit

Record availability and intended role of:

* weights
* strata
* primary sampling units / cluster variables
* examination-specific weights where applicable

G2-A does not decide the final modelling use of survey weights.

That decision must be fixed before model development.

## 10. Age/population audit

Before G3, report counts for at least:

* under 18
* 18–29
* 30–39
* 40–49
* 50–59
* 60–69
* 70–79
* 80+

No final supported product age range is selected from performance.

## 11. Missingness audit

For each candidate predictor and target component, report:

* total eligible rows
* observed count
* missing count
* refused count where distinguishable
* unknown/not-applicable count where distinguishable

Do not collapse these categories into arbitrary model missing values during G2.

## 12. Year-pooling boundary

2022 and 2023 are not included in the first participant-level audit.

After the 2024 schema audit, their official documentation/schema may be compared against 2024.

Pooling may be approved only if:

* target measurements are compatible
* predictor semantics are compatible
* coding is harmonizable without unsupported reinterpretation
* survey-design handling is documented
* cycle/year effects are addressed before modelling

## 13. Audit output

The G2-A deliverable should contain:

1. dataset provenance
2. 2024 file inventory
3. eligible-population counts
4. candidate target-component table
5. candidate product-input table
6. missingness table
7. leakage exclusions
8. survey-design variable inventory
9. unresolved semantic questions
10. recommendation for:

* `proceed to G3 design`
* `need additional documentation`
* `reject current KNHANES path`

No predictive model result belongs in this deliverable.

## 14. Stop rules

Stop G2-A without modelling if:

* required BP measurement data are unavailable or uninterpretable
* a usable target would require unsupported proxy construction
* realistic product predictors cannot be matched to dataset semantics
* data-use terms do not permit the planned research
* participant-level files would have to be committed to Git
* an unexpected leakage path cannot be resolved

## 15. Current state after approval

If G2-A is approved:

* V2-A research direction: approved
* KNHANES development candidate: approved for bounded audit
* first audit year: 2024
* participant-level access: permitted for G2 audit only
* model fitting: prohibited
* feature-performance search: prohibited
* train/validation/test split: prohibited
* V1 test: locked
* production scoring: disabled
* release: not approved
