# Model V2 T12 — Product Policy Resolution Result

Status: **PRODUCT_POLICY_RESOLUTION_PASS / T8 HISTORICAL SNAPSHOT BLOCKED / PRODUCTION DISABLED**

Starting main: `8a479fa0aefb9e0dce945cce9fde51c4d77d77d0`

Issue: `#332`

Contract version: `model-v2-product-policy-resolution-v1`

T12 resolves the product-policy questions that blocked T8. It does not rewrite
the historical T8 snapshot and does not authorize production activation or
real-user collection.

## Resolution dimensions

T12 defines eight machine-checkable dimensions:

1. `age_19_plus_policy_approved`
2. `age_80_plus_disclosure_approved`
3. `no_upper_cutoff_invention_approved`
4. `self_report_non_equivalence_approved`
5. `product_applicability_limitation_approved`
6. `non_diagnostic_wording_approved`
7. `hidden_score_policy_preserved`
8. `data_separation_preserved`

Each accepts only `PASS`, `BLOCKED`, or `NOT_REVIEWED`.

Resolution is `PASS` only when all eight dimensions are `PASS`. Any blocked or
not-reviewed dimension produces `BLOCKED`; missing, extra, or unknown fields
are rejected.

## Current T12 snapshot

All eight dimensions are `PASS`.

Final T12 product-policy resolution: **`PASS`**

This means the policy questions have a reviewed resolution contract. It does
not mean that T8, T9, T10, or T11 automatically change state.

## Approved age applicability policy

- Candidate use remains age 19+.
- Age below 19 is ineligible.
- Missing age cannot establish 19+ eligibility.
- No upper age cutoff is invented.
- Age 80+ is not automatically excluded.
- Age 80+ is not silently top-coded by the product policy.
- For age 80+, user-facing/product policy must state that applicability is less
  certain because the research/model-development basis does not establish the
  same level of support for that age range.
- The age 80+ disclosure must not claim invalidity, diagnosis, treatment,
  prevention, or causal meaning.
- Age alone must not be transformed into a risk class or score explanation.

## Approved research-to-product applicability policy

Product height, weight, smoking, alcohol, walking, strength, and sleep inputs
are self-reported or user-entered product inputs.

The KNHANES source variables used during model development included measured
and/or administered survey inputs.

**Equivalence between product self-report/user-entered inputs and KNHANES
source measurements/administered variables is not established.**

Product use is permitted only under this explicit limitation-of-applicability
policy. The product must not state or imply:

- that self-reported/user-entered inputs reproduce KNHANES measurement quality
- that equivalence has been established
- that the self-report workflow has clinical validation
- that the output is an individual prognosis

Any future equivalence or validation claim requires separate evidence and
review.

## Required user-facing semantic policy

The product-facing content must preserve these meanings:

- the result is based on information the user enters
- self-reported/user-entered values may differ from measurements or
  administered survey responses used in the model-development research source
- the result is only an `입력 기반 위험군 선별 신호`
- it is not a diagnosis, treatment recommendation, prevention judgment, or
  clinical decision
- for age 80+, applicability is less certain and the result must be interpreted
  with additional caution

T12 freezes these semantics, not a final UI layout.

## Hidden-score policy

T12 preserves the existing result-visibility policy:

- no numeric score
- no probability or percentage
- no threshold or gauge
- no traffic-light presentation
- no risk band
- no qualitative class derived from the hidden numeric score

## Data separation

Model V2 inputs/results remain separate from:

- blood-pressure observations
- challenge selection/check-ins
- prior model outputs
- other users' data

No automatic join, silent feature completion, or combined health profile is
authorized.

## Interaction with T8 and T11

T12 intentionally does not rewrite `CURRENT_T8_READINESS`.

Therefore the historical T8 snapshot remains:

- `age_applicability_approved = BLOCKED`
- `research_product_applicability_approved = BLOCKED`
- T8 final product readiness = `BLOCKED`

T12 provides reviewed, machine-checkable policy evidence for a later dedicated
T8 readiness-transition task.

Because T8 remains `BLOCKED`, T11 remains `NO_GO`.

## Remaining release blockers

After T12:

- T9 privacy readiness remains `BLOCKED`
- real-user Model V2 collection remains unauthorized
- T10 operational readiness remains `BLOCKED`
- production operational owner/approval remains unresolved
- explicit activation approval remains absent
- T11 release decision remains `NO_GO`

## Unchanged boundaries

T12 does not:

- enable `MODEL_V2_SCORING_ENABLED`
- deploy Model V2
- modify production environment variables
- authorize real-user Model V2 collection
- expose numeric scores
- change API/UI/DB/model/artifact/schema/preprocessing semantics
- add persistence
- load, regenerate, reserialize, upload, or replace the frozen artifact
- rewrite T8/T9/T10/T11 current snapshots
- grant explicit activation approval

Production scoring remains **OFF**.

Real-user Model V2 collection remains **unauthorized**.

T12 completion is not production activation.
