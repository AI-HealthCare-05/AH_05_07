# Release contract

## Release identity

Source, build, runtime, data schema, model, verification, and rollback are separate facts. A release identity records, as applicable: upstream source SHA; Issue/PR; CI verification identity; repository-controlled release-input fingerprints; build identity and submitted-source provenance; resolved external build-image digests; API image digest; Cloud Run revision; Cloudflare deployment snapshot/source; Cloudflare Worker version; Supabase migration inventory/checksums; model artifact digest and schema version; public-config fingerprint; verification gates/results; and rollback API revision/image and Worker version. Values are immutable identifiers; secret values are prohibited.

Merged source is not a deployed runtime. Git sync alone does not prove a Cloudflare runtime. A rollback target is a distinct known-good runtime identity. Historical entries stay historical and do not become current merely because they are copied into a ledger. Docs-only commits require no production deployment.

## API release provenance manifest

Each production API release should have a repository-owned immutable provenance manifest. The manifest records historical evidence; it does not redeploy, rebuild, or mutate the recorded runtime.

At minimum, record:

- upstream source commit and tree identity;
- repository-controlled build-input presence/absence and SHA-256 fingerprints;
- the application COPY-input fingerprint used by the Docker build;
- Cloud Build identity, location, status, and submitted-source identity;
- the submitted source archive SHA-256 when Cloud Build uses a storage source;
- whether Cloud Build provenance natively binds the submitted source to a Git commit;
- resolved digests of external build/base images observed for that build;
- immutable API output-image digest;
- Cloud Run revision and only those runtime facts actually re-verified;
- frozen Model V2 artifact/schema identity by reference only;
- verification results and known provenance limitations.

Do not treat an image tag containing a Git SHA as native source provenance. When Cloud Build records only an immutable storage source, preserve that fact and separately record any verified source-content comparison.

Resolved historical digests for mutable Docker references document what a build used; they do not mean the Dockerfile reference itself is pinned, and they do not claim a hermetic or bit-for-bit reproducible build.

Repository-controlled fields must be verifiable offline from local Git objects and the manifest.

Verifier command: `python3 scripts/ops/verify_release_provenance.py <manifest>`

The verifier must require no production credentials or network access and must fail closed when a recorded repository-controlled fingerprint or source identity does not match.

## Current release record — S11

**OPERATOR-VERIFIED PRODUCTION EVIDENCE, WITH R9 READ-ONLY RECHECK.** These rollout facts were supplied and verified during the operator rollout. During the R9 audit, the Cloud Run revision/image identity was independently re-read and confirmed as `bp7-api-s11-f25fddf` with immutable image `sha256:b7c7627a9352f930b5371aa5ecc97b40427987e57585039cace3dd1b5ecb145c`. That R9 recheck did not assert serving-traffic percentage. This documentation change does not redeploy or mutate runtime.

| Plane | Identity |
|---|---|
| Source | `f25fddfc442be63721daae671e4beb267ead5f5f` |
| Deployment mirror snapshot | `e390c343d87f032f278db0df22e9fbfb1bbb0b3a` (records sync of exact upstream source) |
| Cloud Run revision | `bp7-api-s11-f25fddf` |
| API immutable image | `sha256:b7c7627a9352f930b5371aa5ecc97b40427987e57585039cace3dd1b5ecb145c` |
| API provenance manifest | `docs/architecture/release-s11-api.json` |
| Cloudflare Worker | `8975da2f-2162-40ea-adf4-f5187c1cc5f2` |
| Model artifact / schema | `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84` / `model-v2-r1-schema-v1` |
| Approved wording | `입력 기반 위험군 선별 신호` |
| API rollback | `bp7-api-00031-rel` / `sha256:a68b30ef6182f9d13a709008542ad248afd55a74664dc67a1616a5a3c6795ecf` |
| Web rollback | Worker `b5880118-4afe-4259-8ca9-d5157506b65c` |

Operator verification: candidate `/live` and `/ready` 200; OpenAPI product-score present; unauthenticated product-score 401; authenticated synthetic product-score 200; exact product fields only; no numeric score/probability/risk band; invalid synthetic input generic 422 without raw echo; candidate logs with no raw Model V2 field names, Authorization/Bearer marker, or numeric-score marker; production-origin CORS preflight PASS; API activation 100%; production `/live`, `/ready`, and authenticated synthetic product-score PASS; Cloudflare bundle contains endpoint and approved wording; signed-in browser S11 submission PASS; approved wording PASS; numeric exposure absent; under-19 input error PASS.

Rollback compatibility is the current S11 API/web pair above and the prior known-good API/web identities above; preserve the pair as separate identities during recovery.
