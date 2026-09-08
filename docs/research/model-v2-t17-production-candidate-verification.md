# Model V2 T17 — Production Candidate Verification

Status: **PRODUCTION_CANDIDATE_VERIFIED / REAL_USER_GO_LIVE_NOT_AUTHORIZED**

Starting main: `7f201c2e71aa6afd52f71e39c72e9ae9d0c19ff5`

Issue: `#349`

## Runtime topology

- Google Cloud project: `ah-05-07-api`
- Cloud Run service: `bp7-api`
- region: `asia-northeast3`
- production revision during verification: `bp7-api-00014-jeq`
- production traffic during verification: **100%**
- candidate revision: `bp7-api-00020-pos`
- candidate tag: `t17-smoke-v2`
- candidate traffic during verification: **0%**

## Frozen artifact evidence

- artifact: `model-v2-r1-a.joblib`
- verified SHA-256: `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`
- private bucket: `ah-05-07-api-model-v2-artifacts`
- runtime service account: `bp7-runtime@ah-05-07-api.iam.gserviceaccount.com`
- bucket role: `roles/storage.objectViewer`
- read-only mount: `/models/model-v2`
- `MODEL_V2_ARTIFACT_PATH=/models/model-v2/model-v2-r1-a.joblib`
- `MODEL_V2_SCORING_ENABLED=true` on the zero-traffic candidate

The artifact was not retrained, regenerated, reserialized, or stored in the Git repository.

## Candidate verification

A fresh API image built from current `main` was deployed as the zero-traffic candidate revision `bp7-api-00020-pos`.

Verified route:

`/api/v1/model-v2/score`

Authenticated synthetic valid request:

- HTTP status: **200**
- schema: `model-v2-r1-schema-v1`
- product wording: `입력 기반 위험군 선별 신호`

The numeric score is intentionally not recorded here.

Malformed synthetic request:

- HTTP status: **422**
- incomplete semantic input rejected as expected

## Logging boundary

After the synthetic smoke:

- candidate log entries checked: **34**
- configured raw-input field-name hits: **none**
- serialized `"score"` response-key hits: **none**

This is operational evidence for the observed smoke window, not a general privacy or legal compliance certification.

## Production traffic preservation

Throughout verification:

- `bp7-api-00014-jeq` retained **100%** production traffic
- `bp7-api-00020-pos` remained at **0%**
- candidate access was limited to the `t17-smoke-v2` tagged URL

## Result

T17 production-candidate verification: **PASS**

Current state:

- T11 release readiness: **GO**
- T17 production candidate: **VERIFIED**
- candidate runtime scoring switch: **ON**
- production user traffic to candidate: **0%**
- real-user Model V2 collection: **NOT AUTHORIZED**
- real-user go-live: **NOT AUTHORIZED**

## Preserved boundaries

T17 does not authorize real-user collection or go-live, does not migrate production traffic, does not add persistence or analytics, does not change API/UI/model/schema/preprocessing semantics, does not expose numeric risk information in the user-facing UI, and does not retrain/regenerate/reserialize the frozen artifact.
