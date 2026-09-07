# Model V2 R1 — Deterministic Release Artifact Result

Status: **PASS_ARTIFACT_READY_FOR_INTEGRATION_PRODUCTION_DISABLED**

## Artifact

- serialization state: `BYTE_IDENTICAL`
- canonical artifact: `model-v2-r1-a.joblib`
- canonical artifact SHA-256: `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`
- source commit: `0dc67faa0e1c25ecc44e90c9a749c2df3f77d352`
- training SHA-256: `e56089bcd6dfce076cd41e58e708e44af4dc4281e161c6bacf4115bc9a332adb`
- production scoring enabled: **False**

## Verification

- `manifest_valid`: **True**
- `artifact_hashes_match_manifest`: **True**
- `exact_feature_order`: **True**
- `production_disabled`: **True**
- `valid_and_missing_unknown_fixture_scores`: **True**
- `serialized_inference_equivalent`: **True**
- `missing_required_feature_rejected`: **True**
- `age_below_19_rejected`: **True**
- `walking_days_above_7_rejected`: **True**
- `negative_walking_minutes_rejected`: **True**
- `strength_days_above_5_rejected`: **True**
- `sleep_above_1440_rejected`: **True**
- `nonpositive_bmi_rejected`: **True**
- `unknown_categorical_allowed`: **True**
- `missing_values_allowed`: **True**

- max absolute serialized inference difference: **0.000e+00**
- required tolerance: **1.000e-12**

## Safety

- training source: frozen G3 development only
- G6 validation participant data read: **False**
- G7 external participant data read: **False**
- G8 final-test participant data read: **False**
- threshold selection: **False**
- recalibration: **False**
- production scoring enabled: **False**

## Known limitation

Older-age subgroup discrimination is weaker in descriptive audits,
especially age 80+. This is carried forward as a release limitation and
was not used for post-final-test Model V2 repair.

Binary artifacts and full verification evidence remain outside Git.

A PASS means artifact readiness for integration only. Production scoring
remains disabled.
