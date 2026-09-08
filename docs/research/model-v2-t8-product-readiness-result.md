# Model V2 T8 — Product Readiness Contract Result

Status: **PRODUCT_READINESS_BLOCKED / PRODUCTION DISABLED**

Starting main: `0282e3eefa60568ff25413a87ae2ce19c0afa3f4`

Issue: `#322`

Contract version: `model-v2-product-readiness-v1`

## Readiness dimensions

T8 defines six product-readiness dimensions:

1. `product_term_approved`
2. `result_visibility_approved`
3. `age_applicability_approved`
4. `missing_policy_approved`
5. `research_product_applicability_approved`
6. `data_separation_approved`

Each dimension accepts only:

- `PASS`
- `BLOCKED`
- `NOT_REVIEWED`

The final product-readiness decision is:

- `PASS`
- `BLOCKED`

The evaluator returns `PASS` only when all six dimensions are `PASS`. Any
`BLOCKED` or `NOT_REVIEWED` dimension produces `BLOCKED`. Missing, extra, or
unknown fields are rejected.

## Current T8 snapshot

- product term: `PASS`
- result visibility: `PASS`
- age applicability: `BLOCKED`
- missing/unknown/refused policy: `PASS`
- research/product applicability: `BLOCKED`
- data separation: `PASS`

Final product readiness: **`BLOCKED`**

## Product term

The approved product term remains:

`입력 기반 위험군 선별 신호`

T8 does not authorize diagnosis, treatment, prevention, causal, improvement, or
certainty claims.

## Result visibility

Numeric score display remains not approved for users.

T8 does not authorize:

- probability or percentage display
- thresholds
- gauges or traffic-light presentation
- low/medium/high risk bands
- translating a hidden numeric score into a qualitative risk class

The T6 `result_available_not_user_visible` state remains synthetic/test-only
unless separately approved.

## Age applicability

The current product candidate is limited to age 19+.

- age under 19 is outside the product candidate
- missing age cannot establish eligibility
- no upper age cutoff is invented
- age 80+ is not silently excluded or top-coded

However, weaker evidence in the 80+ subgroup still requires approved user-facing
applicability wording before release. Because that wording is not approved in
T8, `age_applicability_approved` remains `BLOCKED`.

## Missing / unknown / refused policy

The current product candidate uses a complete-input-only policy.

- missing key: reject
- null: reject at the current product-input boundary
- explicit unknown/refused: not accepted for scoring
- invalid or impossible entry: correction required
- structural zero/none branches follow frozen T5 adapter semantics
- UI answers are not imputed
- invalid/unknown/refused answers are not silently converted to null, median, or zero

Broader missingness support requires a separately versioned adapter and review.

## Research/product applicability

Self-reported product height, weight, and lifestyle answers are not established
as equivalent to KNHANES measured/administered inputs.

Product copy must not claim equivalence. This gap remains a release blocker
unless separately reviewed and accepted, so
`research_product_applicability_approved` remains `BLOCKED`.

## Data separation

Model V2 input/result remains separate from:

- blood-pressure observations
- challenge selection/check-ins
- prior model outputs
- other users

No automatic join or inference from those records is authorized.

## T7 interaction

T8 does not rewrite T7 readiness constants.

At T8 completion:

- T7 `product_readiness` remains `NOT_REVIEWED`
- T7 final activation decision remains `NO_GO`
- production scoring remains disabled

A later explicit integration/approval task is required before T7 product
readiness may change.

## Unchanged boundaries

- production scoring enabled: **False**
- deployment performed: **False**
- runtime environment modified: **False**
- real-user Model V2 collection authorized: **False**
- numeric score exposed: **False**
- threshold/risk band created: **False**
- API semantics changed: **False**
- S11 production scoring wiring changed: **False**
- DB/schema/migration changed: **False**
- browser persistence added: **False**
- frozen artifact/model/schema/preprocessing changed: **False**
- T2 inference semantics changed: **False**
- T4 API semantics changed: **False**
- T5 adapter semantics changed: **False**
- T6 result-state visibility policy changed: **False**
- T7 current activation state changed: **False**

T8 completion is not product release or production activation.
