# Model V2 T20 — Production Rollout Evidence and Operational Monitoring Baseline

Status: **PRODUCTION_STABLE / SCORE_TRANSPORT_HIDDEN / MONITORING_BASELINE_PASS**

Recorded: `2026-09-08`

Issue: `#356`

## Purpose and scope

This document records the observed production rollout evidence and the operational monitoring baseline for the isolated T19 release.

T20 is documentation-only. It does not perform or authorize a production deployment, traffic change, model change, schema change, preprocessing change, authentication change, database action, persistence, analytics, research-data collection, product-wording change, or UI change.

The evidence below is an operational record for the supplied observation window. It is not a claim that errors can never occur, a general privacy or legal compliance certification, or evidence that real-user Model V2 data was collected.

## Repository main and isolated release lineage

The repository baseline used to create this documentation branch is the then-current `origin/main`:

`ea7543259c47020d74181a1c4d95752cae91a9b1`

This is the repository main ancestry after PR #354. It must not be conflated with the separately constructed isolated production release lineage.

The isolated T19 lineage recorded for production is:

- isolated base: `7f201c2e71aa6afd52f71e39c72e9ae9d0c19ff5`
- T19 patch source commit: `743cbc7d6ab5e9e67e6b1f40e84add46069d80a8`
- isolated release commit: `17618731c17f0669e7f37f019e8a38cc8e491002` (`1761873`)
- Cloud Build: `021a98a1-4034-42b6-8a40-e9f7b1ddf147`
- image tag: `asia-northeast3-docker.pkg.dev/ah-05-07-api/bp7/api:t19-isolated-1761873`
- immutable deployed image: `asia-northeast3-docker.pkg.dev/ah-05-07-api/bp7/api@sha256:c2626350a7170df5345ebcd76eadec5a78e87079c9262eae267695f7178935bd`

The patch source commit and the isolated release commit describe different lineage roles: the former identifies the T19 change, while the latter identifies the release assembled from the isolated base for production. The isolated release is the production lineage recorded here; it is not asserted to be an ancestor of the current repository `main`.

## Candidate rejection, rollback, and isolated rebuild

The first T19 production candidate was built from then-current `main`. That candidate also contained the separately merged self-service account-removal change from PR #348. It was rejected because it was a mixed-source candidate and therefore did not satisfy the T19 isolated-release boundary.

Production was rolled back to the previously accepted production state before the isolated rebuild proceeded. The previous production revision recorded by the preceding T18 go-live evidence was `bp7-api-00020-pos`; T20 records the rollback as a release-safety action and does not treat PR #348 account-removal as part of the isolated Model V2 release.

The isolated rebuild then used the isolated base plus the T19 patch, producing release `1761873` and the immutable image digest recorded above. No model artifact was regenerated, retrained, reserialized, downloaded, or modified.

## Zero-traffic candidate verification

The isolated candidate was first accessed through the tagged URL while it carried no production traffic:

`https://t19-isolated-smoke---bp7-api-3v3gl27aza-du.a.run.app`

The candidate verification preserved the production-traffic boundary. The candidate was smoke-tested before the final production revision was accepted.

## Final production state

- Google Cloud project: `ah-05-07-api`
- region: `asia-northeast3`
- Cloud Run service: `bp7-api`
- production URL: `https://bp7-api-3v3gl27aza-du.a.run.app`
- accepted production revision: `bp7-api-00025-jok`
- production traffic: `bp7-api-00025-jok = 100%`
- `latestCreated`: `bp7-api-00025-jok`
- `latestReady`: `bp7-api-00025-jok`
- immutable image digest: `sha256:c2626350a7170df5345ebcd76eadec5a78e87079c9262eae267695f7178935bd`

## Health and authenticated boundary evidence

Health checks on the final production revision:

- `/live`: **HTTP 200**
- `/ready`: **HTTP 200**

Authenticated valid synthetic production smoke:

- HTTP status: **200**
- schema version: `model-v2-r1-schema-v1`
- product wording: **입력 기반 위험군 선별 신호**
- numeric `score` present: **false**
- response keys: `product_wording`, `schema_version`

The frozen inference computation continues to run, but the numeric score is not transported to the authenticated client. No numeric score, probability, percentage, threshold, or risk band is user-visible.

Authenticated malformed synthetic production smoke:

- HTTP status: **422**
- error code: `model_v2_input_invalid`
- numeric `score` present: **false**
- response keys: `detail`

The malformed-input result records the fail-closed boundary. It does not authorize or imply any new data collection or persistence.

## Frozen Model V2 boundaries

- frozen artifact: `model-v2-r1-a.joblib`
- artifact SHA-256: `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`
- schema: `model-v2-r1-schema-v1`
- product wording: **입력 기반 위험군 선별 신호**

The artifact, schema, preprocessing, semantic feature contract, authentication, database, persistence, analytics, research-data collection, and UI remain outside T20 change scope. Production activation does not authorize persistence, analytics, or research collection.

## Operational monitoring baseline

The following values are limited to the inspected production observation window:

- recent 5xx entries: **0** (`recent_5xx_entries=0`)
- recent `ERROR` entries: **0** (`recent_error_entries=0`)
- log entries checked: **43**
- sensitive-log hits: **none** (`sensitive_log_hits=[]`)

The sensitive-log scan used the exact 11 Model V2 input field names plus serialized `"score"` as configured needles. `sensitive_log_hits=[]` means no configured needle was found in the inspected 43 entries only; it is not a universal absence claim.

## Current operational state

The recorded state is:

- **PRODUCTION_STABLE**: the accepted revision is ready and carries 100% of production traffic, with `/live` and `/ready` returning HTTP 200.
- **SCORE_TRANSPORT_HIDDEN**: valid authenticated responses contain only `schema_version` and `product_wording`; malformed responses contain only the error detail boundary, with no `score` key.
- **MONITORING_BASELINE_PASS**: the inspected 43-entry window contained zero recent 5xx entries, zero recent `ERROR` entries, and no configured sensitive-log hits.

This record does not claim that real-user Model V2 data was collected. It also does not imply that PR #348 account-removal was deployed as part of the isolated Model V2 release.
