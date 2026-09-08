# Model V2 T2 — Semantic Parity Result

Status: **IMPLEMENTATION_VERIFIED / ARTIFACT PARITY NOT EXECUTED**

Baseline: `533e7bdaa5426777a4ffc4c4f59af9f51d4f1d28` (`origin/main`, checked 2026-09-08).

## Scope

T2 aligns the serving semantic validator and synthetic contract fixtures with the frozen G3 11-feature representation. It does not change the model, feature order, preprocessing, schema, frozen artifact, research evidence, thresholding, risk bands, production routing, web UI, database, or deployment.

Historical R2 remains `PASS_INFERENCE_INTEGRATION_READY_PRODUCTION_DISABLED`. This T2 note does not rewrite or invalidate that historical mechanical-boundary result; it records the later semantic-parity correction required by the product contract.

## Serving validation

Code-level verification covers:

- exact 11 keys; missing and extra keys rejected
- explicit null remains distinguishable from a missing key
- numeric strings rejected rather than coerced
- bool-as-number rejected
- NaN and Infinity rejected
- list/object values rejected
- `walking_days_7d` restricted to whole-day values in `0..7`
- walking/sleep minute domains restricted to `0..1440`
- age restricted to the frozen `>=19` cohort boundary when present
- BMI finite and positive when present
- `sex_knhanes` restricted to numeric `1` / `2`
- exact four smoking categories
- exact seven alcohol-frequency categories
- exact six alcohol-amount categories
- exact six strength categories, including `5_plus_days` as a string category rather than numeric five
- zero walking days requires structural zero walking minutes
- `none_past_year` / `lifetime_nonapplicable` require alcohol amount `none`
- drinking-frequency branches reject contradictory amount `none`

The product-level policy for which explicit unknown/refused answers may ultimately be submitted as null remains unresolved. Technical null support is not a release approval.

## Canonical synthetic fixtures

R1/R2 valid synthetic representations are corrected to G3 canonical categories. A dataset-free source-answer parity fixture is also provided for later T5 adapter work; it contains synthetic source codes only and no participant row.

Local reconstructed unit verification: **75 passed**.

## Five T2 blockers

| Blocker | T2 code status |
| --- | --- |
| `strength_days_7d` numeric validation vs six G3 strings | resolved in proposed validator/tests |
| `sex_knhanes` string fixture vs numeric 1/2 | resolved in proposed validator/fixtures |
| smoking `never` vs `never_smoked` | resolved in proposed validator/fixtures |
| alcohol-frequency raw code string vs semantic enum | resolved in proposed validator/fixtures |
| alcohol-amount raw code string vs semantic enum | resolved in proposed validator/fixtures |

## Frozen artifact parity

Required frozen artifact SHA-256:
`d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`.

The current tool execution environment cannot inspect the user's Mac filesystem and the frozen R1 binary is intentionally outside Git. No artifact was downloaded, regenerated, or reconstructed. Therefore:

- artifact availability in the user's approved local location: **UNVERIFIED**
- artifact SHA check in this T2 execution: **NOT EXECUTED**
- fitted categorical encoder parity: **NOT EXECUTED**

The R2 verifier proposal adds fitted-category metadata checks and direct one-hot transform-path checks. It fails closed if any canonical category is absent, if a noncanonical fitted category other than the explicit `__missing__` sentinel is present, or if a canonical category does not activate its fitted encoder path. It must be run only against an already-local artifact whose SHA matches exactly.

## Safety / release state

- frozen artifact changed: **False**
- schema changed: **False**
- feature order changed: **False**
- preprocessing changed: **False**
- retraining: **0**
- recalibration: **0**
- threshold/risk band: **0**
- participant-level data read: **0**
- validation/final-test access: **0**
- web/UI changes: **0**
- DB changes: **0**
- deploy changes: **0**
- production scoring: **DISABLED**

A final T2 PASS must not be recorded until the already-local approved artifact, if available, passes exact SHA and fitted-category parity verification.
