# Model V2 T2 — Semantic Parity Result

Status: **PASS — SEMANTIC PARITY VERIFIED / PRODUCTION DISABLED**

Baseline: `533e7bdaa5426777a4ffc4c4f59af9f51d4f1d28`.

## Scope

T2 aligns the Model V2 serving semantic validator and synthetic contract
fixtures with the frozen G3 11-feature representation.

T2 does not change:

- model family
- frozen feature set or order
- preprocessing
- artifact
- schema version
- calibration
- thresholds
- risk bands
- historical G6-G9 / R1 / R2 / R3 evidence
- production routing
- web/UI
- database
- deployment

Historical R2 remains:

`PASS_INFERENCE_INTEGRATION_READY_PRODUCTION_DISABLED`

This T2 result records the later semantic-parity verification required by
the Round 2 product contract. It does not rewrite the historical R2 result.

## Serving validation

Verified behavior includes:

- exact 11 keys
- missing keys rejected
- extra keys rejected
- explicit null remains distinct from a missing key
- numeric strings rejected rather than coerced
- bool-as-number rejected
- NaN and Infinity rejected
- list/object values rejected
- `walking_days_7d` restricted to whole values in `0..7`
- walking/sleep minute domains restricted to `0..1440`
- age restricted to the frozen `>=19` cohort boundary when present
- BMI finite and positive when present
- `sex_knhanes` restricted to numeric `1` / `2`
- exact four smoking categories
- exact seven alcohol-frequency categories
- exact six alcohol-amount categories
- exact six strength categories
- zero walking days requires zero walking minutes
- `none_past_year` / `lifetime_nonapplicable` require alcohol amount `none`
- drinking-frequency branches reject contradictory amount `none`

The broader product policy for explicit unknown/refused answers remains
outside T2. Technical null support is not production approval.

## Canonical synthetic fixtures

R1/R2 synthetic valid fixtures use the frozen G3 canonical representations.

A dataset-free source-answer parity fixture is included for later adapter work.
It contains synthetic source answers only and no participant-level row.

Local T2 boundary tests:

- **79 passed**

Repository CI after the T2 implementation commit:

- lint: **PASS**
- formatting: **PASS**
- relevant repository checks: **PASS**

## Five T2 blockers

| Blocker | Result |
| --- | --- |
| `strength_days_7d` numeric validation vs six G3 strings | **RESOLVED** |
| `sex_knhanes` string fixture vs numeric 1/2 | **RESOLVED** |
| smoking `never` vs `never_smoked` | **RESOLVED** |
| alcohol-frequency raw code string vs semantic enum | **RESOLVED** |
| alcohol-amount raw code string vs semantic enum | **RESOLVED** |

## Frozen artifact verification

Frozen R1 artifact SHA-256:

`d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`

Verification result:

- artifact exists: **True**
- exact frozen SHA match: **True**
- schema version: `model-v2-r1-schema-v1`
- exact feature order frozen: **True**
- fitted categories match G3 semantics: **True**
- canonical categories activate their fitted encoder paths: **True**
- repeated inference absolute difference: `0.000e+00`
- score remains within `[0, 1]`: **True**
- artifact SHA mismatch fails closed: **True**
- missing artifact fails closed: **True**
- schema mismatch rejected: **True**
- production-disabled boundary blocks scoring: **True**

No artifact was downloaded, regenerated, retrained, rewritten, or
re-serialized during T2.

## Fitted categorical parity

### `sex_knhanes`

Canonical:

- `1`
- `2`

Fitted:

- `1.0`
- `2.0`

Canonical identity parity: **PASS**  
Canonical transform-path parity: **PASS**

### `cigarette_smoking_state`

Canonical categories:

- `daily_current`
- `occasional_current`
- `former_currently_not_smoking`
- `never_smoked`

All canonical categories are present in the fitted encoder and activate
their expected fitted paths.

Result: **PASS**

### `alcohol_frequency`

Canonical categories:

- `none_past_year`
- `lt_monthly`
- `monthly_once`
- `monthly_2_4`
- `weekly_2_3`
- `weekly_4_plus`
- `lifetime_nonapplicable`

All canonical categories are present in the fitted encoder and activate
their expected fitted paths.

Result: **PASS**

### `alcohol_amount_category`

Canonical categories:

- `1_2_drinks`
- `3_4_drinks`
- `5_6_drinks`
- `7_9_drinks`
- `10_plus_drinks`
- `none`

All canonical categories are present in the fitted encoder and activate
their expected fitted paths.

Result: **PASS**

### `strength_days_7d`

Canonical categories:

- `0_days`
- `1_day`
- `2_days`
- `3_days`
- `4_days`
- `5_plus_days`

All canonical categories are present in the fitted encoder and activate
their expected fitted paths.

Result: **PASS**

The fitted categorical pipeline also contains the frozen preprocessing
sentinel `__missing__` where applicable. This is not treated as a product
input category.

## Fail-closed / safety checks

Verified:

- missing required field rejected: **True**
- extra field rejected: **True**
- impossible age rejected: **True**
- impossible walking days rejected: **True**
- fractional walking days rejected: **True**
- negative walking minutes rejected: **True**
- noncanonical numeric strength value rejected: **True**
- noncanonical string sex value rejected: **True**
- sleep above 1440 rejected: **True**
- nonpositive BMI rejected: **True**
- unknown category rejected: **True**
- repeated inference identical: **True**

## Release state

- frozen artifact changed: **False**
- schema changed: **False**
- feature order changed: **False**
- preprocessing changed: **False**
- retraining: **0**
- recalibration: **0**
- threshold selection: **0**
- risk-band creation: **0**
- participant-level research data read: **0**
- validation/final-test participant data access: **0**
- web/UI changes: **0**
- DB changes: **0**
- deployment changes: **0**
- production scoring enabled: **False**

Product wording remains:

`입력 기반 위험군 선별 신호`

## T2 decision

**PASS**

The frozen Model V2 serving semantics now match the G3 semantic contract,
the exact approved R1 artifact passes fitted-category and transform-path
parity verification, and production scoring remains disabled.

T2 is ready to merge. This does not authorize T4 production activation or
any public scoring route.
