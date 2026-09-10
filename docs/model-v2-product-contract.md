# Model V2 Product Contract

Status: **PROPOSED / PRODUCTION DISABLED**

Round 2, PHASE 0, Task T1 · [Issue #302](https://github.com/AI-HealthCare-05/AH_05_07/issues/302)

Repository evidence baseline: `33189dc7c502173608bdee6b3392390952820140`
(`origin/main`, checked 2026-09-08). This is the single current entry point for
Model V2 product scope; proposed product behavior below is not shipped behavior
or release authorization. Task IDs follow the supplied Round-2 T1 brief. No
separate Master Design file was found in the tracked repository at this baseline.

## 1. Purpose

This contract owns the product-facing Model V2 boundary: frozen input semantics,
user-visible result boundaries, data use, missing/eligibility policy, and release
gates. It carries forward evidence without turning research PASS, inference
readiness, product readiness, and production activation into one status.

Research performance remains with the G6–G9 evidence. This document does not
authorize training, artifact reconstruction, model comparison, threshold
creation, risk bands, recalibration, or production enablement. T1 changes
documentation only.

## 2. Lifecycle status matrix

| Stage | Recorded decision | What it proves | What it does NOT prove |
| --- | --- | --- | --- |
| [G6](research/model-v2-g6-validation-result.md) | `PASS_ADVANCE_TO_G7` | Frozen validation gate passed | Product applicability or release approval |
| [G7](research/model-v2-g7-external-evaluation-result.md) | `PASS_ADVANCE_TO_G8_REVIEW` | KNHANES 2023 temporal Korean transportability gate passed, with declared sleep instrument shift | Independent-source external validation or same-instrument replication |
| [G8](research/model-v2-g8-final-test-result.md) | `PASS_ADVANCE_TO_G9_RELEASE_REVIEW` | One-time frozen final internal test gate passed | Permission to reuse final test, repair the candidate, or activate production |
| [G9](research/model-v2-g9-release-review-result.md) | `PASS_RELEASE_CANDIDATE_READY_PRODUCTION_DISABLED` | Research release-candidate review passed | Artifact integration, product readiness, or production activation |
| [R1](research/model-v2-r1-artifact-result.md) | `PASS_ARTIFACT_READY_FOR_INTEGRATION_PRODUCTION_DISABLED` | Deterministic frozen artifact recorded as `BYTE_IDENTICAL`, ready for integration | Semantic parity of every product input or product release approval |
| [R2](research/model-v2-r2-inference-result.md) | `PASS_INFERENCE_INTEGRATION_READY_PRODUCTION_DISABLED` | Recorded inference boundary checks passed | Resolution of the semantic parity blockers in section 5 or an active public Model V2 API |
| [R3](research/model-v2-r3-activation-readiness-result.md) | `PASS_ACTIVATION_READINESS_PRODUCTION_DISABLED` | Recorded activation-readiness checks passed | Production activation approved, complete product integration, or authorized real-user data collection |
| Product integration | No completion decision recorded; S11 remains not ready | Current UX provides an honest unavailable state | T2/T4/T5/T6 and downstream product gates complete |
| Production activation | **DISABLED**; separate explicit decision required | Repository route remains fail-closed | Production-active status from any research/readiness PASS |

G6/G7/G8/G9 and R1/R2/R3 are completed historical gates. R3 PASS is explicitly
not “production activation approved.” Technical readiness is not a release GO.
This T1 review did not probe a deployed service or read its configuration.

## 3. Frozen invariants

The [G3 freeze](research/model-v2-g3-freeze-contract.md), its
[semantic derivation source](../scripts/data/prepare_model_v2_g3_split.py),
[R1 result](research/model-v2-r1-artifact-result.md),
[R1 build source](../scripts/model/build_model_v2_r1_artifact.py), and latest
[R3 result](research/model-v2-r3-activation-readiness-result.md) establish:

- Exactly **11 semantic features**, with the order in section 4. No additions,
  removals, reordered model columns, or legacy substitutions.
- Schema version: `model-v2-r1-schema-v1`.
- Frozen artifact: `model-v2-r1-a.joblib`.
- Artifact SHA-256: `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`.
- R1 artifact source commit: `0dc67faa0e1c25ecc44e90c9a749c2df3f77d352`.
- Frozen family: `logistic_regression` / `LogisticRegression`; `penalty=l2`,
  `C=1.0`, `solver=lbfgs`, `max_iter=2000`, `tol=1e-8`, `class_weight=None`,
  `random_state=20260907`.
- Numeric preprocessing: median imputation, then `StandardScaler`. Categorical
  preprocessing: constant `__missing__`, `keep_empty_features=True`, then
  `OneHotEncoder(handle_unknown="ignore", sparse_output=True)`. Frozen fitted
  preprocessing is retained; the UI cannot invent imputed user answers.
- Product wording: **`입력 기반 위험군 선별 신호`**, confirmed by R3 and
  [the inference boundary](../app/services/model_v2_inference.py).
- Frozen artifact payload `production_scoring_enabled=False`; runtime default
  OFF. No operational threshold, no risk band, no retraining or recalibration.

These identities are copied from repository text, not recalculated from the
binary. R1/R2/R3 agree on SHA/schema. G9's
`production_serialization_not_yet_done=True` and G8's pending-G9 language are
historical stage snapshots, superseded for current artifact/release state by
R1–R3; they are retained unchanged. The categorical conflicts below remain
unresolved and must not be hidden by the later PASS labels.

## 4. Exact semantic input contract

Rows below are the **exact 11-feature order**. Canonical types describe the G3
derived model values, not the permissive R2 validator and not an approved future
wire DTO. Sex is a numeric-coded categorical feature; strength is a string
categorical feature. The other six numeric features remain numeric.

`N` means a present key may carry null only through the reviewed missing-value
adapter described in section 6. It does not authorize submitting an unanswered
draft or establish product eligibility with missing age. Derived-source names
are schema metadata only; no source records were accessed for T1.

| Feature key | Source semantic meaning | Canonical type | Canonical category / representation | Derived from | Null behavior | Structural skip | Prohibited substitutions |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `age_years` | Survey age in years | Number | Finite years; cohort `>=19` | `age` | N; unknown age does not establish eligibility | None | Legacy `>=18` acceptance; inferred age |
| `sex_knhanes` | KNHANES survey sex code | Numeric-coded category | Numeric `1` / `2` (numeric `1.0` / `2.0`); G3 preserves survey codes | `sex` | N; codes outside 1/2 become missing in G3 | None | String `"1.0"` / `"2.0"`, free-form identity labels, silent recoding |
| `bmi_from_height_weight` | BMI derived from measured height and weight | Number | `weight_kg / (height_cm / 100) ** 2`; finite positive value, no new rounding | `HE_ht`, `HE_wt` | N if source missing or non-positive in G3; invalid product entry requires correction | None | Legacy BMI silently mapped; BP; UI median; undocumented units/rounding |
| `cigarette_smoking_state` | Lifetime/current cigarette smoking branches | String category | `daily_current`, `occasional_current`, `former_currently_not_smoking`, `never_smoked` | `BS1_1`, `BS3_1`: current 1/2/3 maps to first three; unresolved current plus lifetime 3 maps to `never_smoked` | N for unresolved branches, unknown/refused | Supported never-smoking branch remains `never_smoked` | `never`, generic 1–3 status, treating lifetime 1 (<100 cigarettes) as never, other tobacco use |
| `alcohol_frequency` | Past-year drinking frequency / lifetime non-applicability | String category | `none_past_year`, `lt_monthly`, `monthly_once`, `monthly_2_4`, `weekly_2_3`, `weekly_4_plus`, `lifetime_nonapplicable` | `BD1_11` codes 1/2/3/4/5/6/8 respectively | N for unmapped unknown/refused | Code 8 remains `lifetime_nonapplicable` | `"2.0"`, raw code strings, generic drinking days per week |
| `alcohol_amount_category` | Usual amount per drinking occasion | String category | `1_2_drinks`, `3_4_drinks`, `5_6_drinks`, `7_9_drinks`, `10_plus_drinks`, `none` | `BD2_1` 1–5 maps to first five; `BD1_11` 1/8 overrides to `none` | N for unresolved amount outside explicit non-drinking | Explicit non-drinking gives `none` | `"1.0"`, raw code strings, `BD2_14` highest-category follow-up, arbitrary volume conversion |
| `walking_days_7d` | Walking days in the prior seven days | Number (whole-day count) | `0`–`7`; source code minus 1 | `BE3_31` codes 1–8 | N for unknown/refused | Source 1 is observed zero days | Challenge check-ins, generic activity days, fractional day counts |
| `walking_minutes_per_active_day` | Walking duration on an active day | Number | `hours * 60 + minutes`; R2 domain `[0,1440]` | `BE3_31`, `BE3_32`, `BE3_33` | N unless no-walk branch or both valid time components exist; 88/99 missing | `BE3_31=1` → `0` minutes | Weekly total, daily average across inactive days, challenge completion, blank → zero |
| `strength_days_7d` | Strength exercise frequency in prior seven days | String category | `0_days`, `1_day`, `2_days`, `3_days`, `4_days`, `5_plus_days` | `BE5_1` 1/2/3/4/5/6 respectively | N for unmapped unknown/refused | Zero is explicit `0_days` | Numeric 0–5, fractional count, treating `5_plus_days` as exactly five; **KNOWN BLOCKER — T2** |
| `weekday_sleep_minutes` | Weekday bed/wake-derived sleep duration | Number | Clock derivation below, minutes; R2 domain `[0,1440]` | `BP16_11`, `BP16_12`, `BP16_13`, `BP16_14` | N if any component unavailable/invalid | None; unanswered is not zero sleep | Direct 2023 `BP16_1` hours as 2024 semantics, challenge adherence, silent unit conversion |
| `weekend_sleep_minutes` | Weekend bed/wake-derived sleep duration | Number | Same clock derivation, minutes; R2 domain `[0,1440]` | `BP16_21`, `BP16_22`, `BP16_23`, `BP16_24` | N if any component unavailable/invalid | None; unanswered is not zero sleep | Direct 2023 `BP16_2` hours as 2024 semantics, weekday copying, challenge adherence |

Frozen sleep derivation masks each 88/99 component; valid hours are 0–24 and
minutes 0–59. For each bed/wake hour independently, add 24 for hours 1–12,
convert to minutes, subtract bed from wake, and add 1440 if negative. Preserve
this G3 Cycle 9 clock adjustment; a future adapter must demonstrate parity and
handle invalid combinations explicitly. G7's declared 2023 direct-hours
harmonization is evaluation context, not a substitute product input contract.

The versioned product adapter normalizes only browser bedtime `00:xx` to the
source-compatible bedtime `24:xx` form before that frozen derivation. Browser
wake `00:xx` remains unchanged because its clock meaning is distinct.

## 5. Known semantic parity blockers

All five are **KNOWN BLOCKER — T2**, established by static comparison of G3
derivations with [R2 validation](../app/services/model_v2_inference.py) and its
[synthetic fixture](../scripts/model/verify_model_v2_r2_integration.py).

| Concern | Current mismatch | Required T2 resolution |
| --- | --- | --- |
| Strength | G3 emits the six strings above. R2 calls `_coerce_optional_float` and checks 0–5, rejecting canonical strings; fixture uses numeric `2`. Strength remains in `CATEGORICAL`, and the local float is not assigned back to `clean`. | Validate exact canonical categories and demonstrate serving parity; numeric range checks are not semantic validation |
| Sex | G3 derives numeric 1/2; fixture uses string `"1.0"`. R2 preserves categorical objects without canonical category/type validation. | Preserve numeric survey semantics and verify representation parity |
| Smoking | G3 uses `never_smoked`; fixture uses `never`. No enum validation/mapping exists in R2. | Exact four-category contract and corrected synthetic evidence |
| Alcohol frequency | G3 uses semantic labels such as `lt_monthly`; fixture uses `"2.0"`. | Exact seven-category contract; no raw-code string pass-through |
| Alcohol amount | G3 uses semantic labels such as `1_2_drinks`; fixture uses `"1.0"`. | Exact six-category contract including structural `none` |

**INFERENCE, not measured in T1:** because the frozen encoder uses
`handle_unknown="ignore"`, noncanonical categories may be ignored and still
produce a score, so successful scoring need not prove semantic parity. The
historical R2 result records unknown-category scoring checks, but T1 did not
load the encoder, inspect fitted categories, score mismatched inputs, or measure
their effects. Do not present a predicted score effect as a measured result.

T2 must also address strict types, whole walking-day counts, and cross-field
branch consistency: R2 float coercion and independent bounds do not establish
these product guarantees. T1 does not repair validators, fixtures, research,
or the frozen artifact, and does not invalidate or rewrite historical PASS records.

## 6. Missing / unknown / structural skip

| State | Product boundary |
| --- | --- |
| A. Missing key | Reject: missing key is not null. All 11 keys are required at the semantic boundary. |
| B. Unanswered draft | Keep transient and incomplete; never automatically serialize as null to obtain a result. |
| C. Explicit unknown/refused | Only an approved, versioned adapter may map the explicit state to null where frozen preprocessing supports it. Unknown enum strings are not an approved unknown-answer mechanism. |
| D. Structural skip | Preserve the source branch: explicit no-walk → walking minutes 0; explicit non-drinking → amount `none`; supported non-smoking/lifetime non-applicability remains its semantic category. |
| E. Impossible/invalid | Reject or ask for correction before submission. Do not silently turn invalid user entries into missing values just because G3 source cleaning did so. |

Do not infer values from BP, challenge/check-in, prior model outputs, or other
users. Do not fill UI answers with a mean/median. Null support in frozen
preprocessing is an inference capability, not approval of arbitrary missingness
for user-visible results. Allowed missing fields/combinations and applicability
disclosure remain unresolved product decisions before T5/T6 release.

## 7. Eligibility / applicability

The G3 cohort includes age 19+, defined target codes, nonmissing participant and
survey-design identifiers, positive survey weight, and no explicit current
pregnancy. Those are research selection facts, not eleven additional product
inputs or authorization to collect identifiers or pregnancy history. Missing
predictors did not exclude research participants. Under-19 use is outside this
cohort; missing age cannot establish the 19+ boundary.

G9/R1/R3 carry weaker older-age discrimination, especially the 80+ subgroup.
This limitation must appear in release/product guardrails. **UNRESOLVED
DECISION:** age 80+ wording and applicability handling; T1 does not invent an
80+ exclusion, an upper age cutoff, or repair the candidate.

Self-reported product height/weight and lifestyle answers differ from survey
measurement and administration. Evidence does not establish equivalence merely
because the feature names match. Product eligibility checks and disclosure of
research-cohort differences require review before release. The output is an
`입력 기반 위험군 선별 신호`, not a diagnosis, treatment outcome, or certainty
about a future event. The target is cross-sectional, not future incidence.

## 8. User-visible result contract

Approved product wording is **`입력 기반 위험군 선별 신호`**. Current S11
remains an honest unavailable state. No provisional score is permitted.

**UNRESOLVED DECISION: continuous score visibility.** R2 internally returns a
continuous score in `[0,1]`, schema/model identity, artifact SHA, and wording;
that technical output does not approve exposing a score to general users.
Display precision and score explanation are also unresolved.

Prohibited output labels/claims include `저위험/중위험/고위험`, `정상/비정상`,
`안전/위험`, diagnosis, treatment effect, improvement, prevention success,
“challenge 때문에 좋아짐,” or “혈압 때문에 risk가 바뀜.” No operational
threshold exists: no traffic-light, gauge, risk band, or equivalent color/position
classification may be created. Thresholds/bands are not open product decisions.

## 9. Result / data persistence

The Round-2 proposal is a transient S11 input draft and transient result:

| Data / destination | Proposed Model V2 boundary |
| --- | --- |
| S11 draft and derived features | In memory for the current interaction only; no model-feature DB storage |
| Model result | Transient only; no result DB storage or score history |
| Browser persistence | No feature/score `localStorage` or other persistent browser storage; no recovery across reload/authentication through stored drafts |
| URL/query, analytics | No features or scores; navigation-only `screen` state is separate |

This document does not authorize or claim a persistence implementation.
[Visual draft policy](visual-production-contract.md) already defaults to memory
only. Existing Auth session storage and existing BP/challenge retention do not
authorize model-feature/result persistence.

**KNOWN PRODUCT CONTRACT CONFLICT — T4/T5/T6, release reconciliation T16:**
[requirements](requirements.md) FR-01 still points to a V1 eight-feature adapter;
FR-02 describes probability/risk band; FR-05 plans signal series; conditional
FR-09 plans persisted jobs/results. These are not authority for a V2 band,
history, or storage. [UX flow](ux-flow.md)'s accepted-P0 diagram places model
input/result before challenge, unlike its current independent navigation.
Reconcile those future-facing requirements in their implementing tasks; preserve
their historical evidence. No active V2 persistence is established by these
plans, and this T1 document does not introduce a worker or queue.

## 10. Product independence

BP observation, challenge/check-in, and Model V2 signal are three separate facts.
No automatic BP or challenge input join, no model-result link to BP trends, and
no model-based challenge success/failure judgment is permitted. BP that defines
the training label must never become a predictor: that is target leakage.
G3's exclusions also cover target/diagnosis-related fields, identifiers,
survey-design metadata, prior scores, and post-outcome information.

Model input is optional for the core record product. BP recording, challenge,
history, and export remain available without it, subject to their existing
authentication, ownership, and retention rules. Sharing a date grid cannot imply
correlation, causation, or a combined health outcome.

## 11. API product boundary

The [legacy router](../app/apis/v1/risk_signal_routers.py) returns HTTP
`503` / `model_not_ready` for a valid legacy request; invalid bodies can fail
DTO validation before the handler. Its message still says an artifact is not
available, although R1 now records one. This stale explanation is not evidence
that the artifact is absent. The [legacy DTO](../app/dtos/risk_signal.py),
including `signal_band`, is not Model V2 product authority and has no silent V2
mapping. R3 completion did not wire V2 into the public route.

**T4:** the future versioned Model V2 product API is not implemented or assigned
an endpoint here. Its required boundaries are authenticated access, exact V2
schema, strict validation after T2 parity, no legacy silent mapping, default OFF,
disabled-before-load, `no-store`, safe errors, no `user_id` in the body, and no
BP/challenge input. Authentication establishes ownership server-side. Neither
internal score metadata nor safe errors may expose raw feature/score payloads,
artifact paths, or infrastructure details to users. T4 must specify safe error
copy and caching behavior; this document does not claim they already exist.

## 12. Privacy / data-use boundary

**REAL-USER HEALTH DATA EXPANSION: UNRESOLVED / NOT AUTHORIZED BY THIS DOCUMENT.**

[README](../README.md) limits processing to synthetic demo data;
[AGENTS.md](../AGENTS.md) prohibits storing real clinical records, names,
contacts, original documents, and free-text medical histories. Merging T1 is
not approval to collect real health information.

| Data | Purpose / boundary |
| --- | --- |
| Email | Auth only; not copied into product-record tables or model inputs, per [Auth contract](auth-contract.md) |
| BP/challenge | Existing product path and [observation lifecycle](observation-data-lifecycle.md); synthetic-only scope remains |
| Model feature draft | Proposed transient model-input path only; no secondary research/training use |
| Model score | Proposed transient result only; no history, analytics, or training label |

Raw feature/score logging and request-body logging are prohibited, including in
errors, analytics, traces, shared evidence, and debugging output. Do not store
original documents or free-text histories. [Secret-boundary verification](secret-boundary-verification.md)
is static evidence, not a guarantee about every future runtime log. T15 must
demonstrate safe technical observability without sensitive payload capture.

Existing record retention remains 30-day server-enforced access expiry plus
daily physical cleanup. Auth deletion must revoke sessions and remove owned
records; the supported account-deletion request path and responsible operator
remain a product operations decision, not an inferred Model V2 capability.

## 13. Operations boundary / release gates

Technical model enabled/disabled state, artifact SHA/schema identity, load
status, and readiness are observable implementation facts. None is production
release authorization. The R2 switch `MODEL_V2_SCORING_ENABLED` defaults OFF and
blocks before artifact access; the frozen payload remains disabled provenance.
T1 does not change either switch or route.

| Future gate | Required product evidence |
| --- | --- |
| T2 semantic parity | Resolve section 5 against frozen semantics |
| T4 authenticated API | Exact schema, strict validation, safe errors, no-store, default OFF |
| T5 input | Approved adapter, missing/structural/eligibility behavior, transient draft |
| T6 result UI | Approved visibility/copy/precision/disclosure, separate facts, no bands/history |
| T10 CI | Required product contract checks; T1 adds no CI/tooling |
| T15 observability | Sanitized technical states and safe failure monitoring; no raw features/scores |
| T16 release package | Immutable source/artifact/schema evidence, limitations, resolved product conflicts, rollback plan |
| T17 QA | Product and failure-boundary verification |
| T18 UAT | Explicit acceptance of the scoped product behavior |
| T19 explicit GO | Separate production-enable decision with accountable release authorization |
| T20 release | Approved release execution and verification, separately recorded from GO |

These are future requirements, not completed gates. Follow the
[deployment SSOT](deployment-ssot.md) for source/runtime separation and release
classification. This documentation-only PR needs no deployment. T15/T16/T19/T20
must not reinterpret readiness telemetry as permission to enable scoring.

## 14. Current / historical authority map

Authority is concern-specific. Use the latest release evidence for current
lifecycle state, G3 derivations for frozen semantics, and this entry point for
V2 product boundaries. Preserve conflicts explicitly rather than applying a
single chronological override to every concern.

| Concern | Current authority | Historical only / scope limit |
| --- | --- | --- |
| Model feature semantics | [V2 G3](research/model-v2-g3-freeze-contract.md) and [derivations](../scripts/data/prepare_model_v2_g3_split.py) | [V1 adapter draft](model-input-adapter-contract.md) is not a V2 mapping |
| Performance and limitations | [G6](research/model-v2-g6-validation-result.md), [G7](research/model-v2-g7-external-evaluation-result.md), [G8](research/model-v2-g8-final-test-result.md), [G9](research/model-v2-g9-release-review-result.md) | Frozen evidence, not product release approval; V1 research is historical for V2 |
| Artifact | [R1](research/model-v2-r1-artifact-result.md), identity reaffirmed in R3 | G9 serialization-pending snapshot |
| Inference/readiness | [R2 contract](research/model-v2-r2-inference-contract.md), [R2 result](research/model-v2-r2-inference-result.md), [R3](research/model-v2-r3-activation-readiness-result.md) | Completed checks do not resolve T2 blockers or activate production |
| V2 product scope | [This contract](model-v2-product-contract.md) | V1 [release-readiness](model-release-readiness.md) and legacy DTO do not define V2 outputs |
| Core product / UX | [Requirements](requirements.md), [UX](ux-flow.md), [visual contract](visual-production-contract.md), [journey](../web/src/ui/journey.ts) | V1/planned model portions have the conflicts in section 9; current S11 remains not ready |
| Auth / data use | [Auth](auth-contract.md), [lifecycle](observation-data-lifecycle.md), [secret boundary](secret-boundary-verification.md), README/AGENTS | Existing record retention is not Model V2 storage permission |
| Release / prior operations | [Deployment SSOT](deployment-ssot.md), [operations final state](mvp1-operations-review.md) | Prior O1/O3, O2 and P95 evidence is not Round-2 GO |

## 15. Do not reopen

Round-2 productization does not reopen G8 final test, G6/G7/G9, R1/R2/R3,
previous V1 research, old submission, O1/O3, or O2/P95 historical decisions.
T2 is serving semantic-parity work; it is not research reopening or permission
to reconstruct the artifact. No historical evidence is deleted or modified.

Carry forward R3's governance record: G8 preflight opened/read final-test bytes
for hashing before consumption approval; no parsing, participant rows, target
values, predictions, or metrics were accessed then. The record identifies a
governance/protocol deviation, not statistical performance leakage; formal G8
consumption subsequently remained one-time. T1 does not repeat that access.

[Prior operations](mvp1-operations-review.md) remain O1/O3 COMPLETE / VERIFIED;
O2 alternate evidence accepted without production natural-expiry PASS; API P95
operator verification EXECUTED / NOT PASSED, with `/window` P95 uncomputed and
additional rerun prohibited. Future Round-2 gates do not rewrite those outcomes.

T1 verification is documentation-only: whitespace/diff, local links, exact
feature count/order and canonical categories, SHA/schema text, lifecycle decision
wording, and scope review. No model execution, artifact binary access,
participant-level reads, final-test access/hash/re-evaluation, research changes,
runtime/API/web/DB changes, deployment, or R2 mutation is authorized by T1.

## Unresolved product decisions

1. Whether Round 2 finishes as a synthetic-only pilot or real-user use receives
   a separate review. This contract authorizes no real-user expansion.
2. Whether the continuous model score is visible to general users at all.
3. If visible, approve wording, precision, permitted missing inputs/combinations,
   and applicability disclosure, including self-report versus survey measurement
   and research-cohort differences. Missing age cannot establish eligibility.
4. How to express and handle the 80+ limitation, without silently adding an
   exclusion or changing the frozen candidate.
5. Who owns account-deletion support and the user request/fulfillment path,
   while preserving the existing session-revocation and record-removal contract.

Thresholds and risk bands are excluded from this decision list. There is no
current plan to create them. Resolving these decisions alone does not satisfy
the technical/product gates or authorize production activation.
