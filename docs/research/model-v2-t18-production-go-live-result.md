# Model V2 T18 — Production Go-Live Result

Status: **PRODUCTION_LIVE / POST_SWITCH_SMOKE_PASS**

Starting main: `69e24534002188ab15114de509513f1de6da1f64`

Issue: `#351`

## Authorization

The operator explicitly approved real-user go-live and production traffic migration to the previously verified Model V2 production candidate.

This approval is limited to go-live and production traffic. It does not by itself create authorization for database persistence, analytics, research-data collection, or any other separate data-use purpose.

## Production state

- Google Cloud project: `ah-05-07-api`
- Cloud Run service: `bp7-api`
- region: `asia-northeast3`
- production revision: `bp7-api-00020-pos`
- production traffic: **100%**
- rollback revision retained: `bp7-api-00014-jeq`
- rollback command: `gcloud run services update-traffic bp7-api --region asia-northeast3 --to-revisions bp7-api-00014-jeq=100`

## Health verification

Post-switch production checks:

- `/live`: **HTTP 200**
- `/ready`: **HTTP 200**

## Authenticated production smoke

A valid synthetic request was sent through an authenticated Supabase user session to the production Model V2 endpoint.

Result:

- HTTP status: **200**
- schema: `model-v2-r1-schema-v1`
- product wording: `입력 기반 위험군 선별 신호`
- score field: present in the API transport response
- numeric score value: intentionally not recorded

A malformed authenticated synthetic request was then sent.

Result:

- HTTP status: **422**
- error code: `model_v2_input_invalid`

This confirms that the production route accepts a valid authenticated synthetic request and rejects incomplete semantic input.

## Production logging boundary

The production revision log window was inspected after the post-switch smoke.

- revision: `bp7-api-00020-pos`
- entries checked: **59**
- configured raw-input field-name hits: **none**
- serialized `"score"` response-key hits: **none**

This is evidence for the inspected operational window only. It is not a general privacy, security, medical, or legal compliance certification.

## Frozen model boundary

T18 does not alter the frozen Model V2 artifact or its semantics.

Frozen artifact SHA-256 remains:

`d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`

No retraining, regeneration, reserialization, schema change, feature-order change, or preprocessing change occurred in this task.

## Result

T18 production go-live: **PASS**

Current technical state:

- T11 release readiness: **GO**
- T17 production candidate verification: **PASS**
- T18 production traffic migration: **COMPLETE**
- production revision: `bp7-api-00020-pos`
- production traffic: **100%**
- production health checks: **PASS**
- authenticated synthetic scoring: **PASS**
- malformed-input fail-closed check: **PASS**
- inspected production logging boundary: **PASS**
- rollback target: **AVAILABLE**

## Preserved boundaries

The following remain separate from this go-live record unless independently authorized and implemented:

- database persistence of Model V2 inputs or outputs
- analytics/profile enrichment
- research participant data collection
- new user-visible numeric risk presentation
- derived qualitative risk classes
- changes to model/schema/preprocessing semantics
- any diagnostic, treatment, preventive, or causal interpretation

The product term remains **입력 기반 위험군 선별 신호**.
