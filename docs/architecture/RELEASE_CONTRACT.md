# Release contract

## Release identity

Source, build, runtime, data schema, model, verification, and rollback are separate facts. A release identity records, as applicable: upstream source SHA; Issue/PR; CI verification identity; future lockfile/config fingerprints; API image digest; Cloud Run revision; Cloudflare deployment snapshot/source; Cloudflare Worker version; Supabase migration inventory/checksums; model artifact digest and schema version; public-config fingerprint; verification gates/results; and rollback API revision/image and Worker version. Values are immutable identifiers; secret values are prohibited.

Merged source is not a deployed runtime. Git sync alone does not prove a Cloudflare runtime. A rollback target is a distinct known-good runtime identity. Historical entries stay historical and do not become current merely because they are copied into a ledger. Docs-only commits require no production deployment.

## Current release record — S11

**OPERATOR-VERIFIED PRODUCTION EVIDENCE.** These rollout facts were supplied and verified during the operator rollout. This Codex session has not independently re-read the control plane; that status is **INCONCLUSIVE**. This documentation commit does not redeploy or re-verify runtime.

| Plane | Identity |
|---|---|
| Source | `f25fddfc442be63721daae671e4beb267ead5f5f` |
| Deployment mirror snapshot | `e390c343d87f032f278db0df22e9fbfb1bbb0b3a` (records sync of exact upstream source) |
| Cloud Run revision | `bp7-api-s11-f25fddf` |
| API immutable image | `sha256:b7c7627a9352f930b5371aa5ecc97b40427987e57585039cace3dd1b5ecb145c` |
| Cloudflare Worker | `8975da2f-2162-40ea-adf4-f5187c1cc5f2` |
| Model artifact / schema | `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84` / `model-v2-r1-schema-v1` |
| Approved wording | `입력 기반 위험군 선별 신호` |
| API rollback | `bp7-api-00031-rel` / `sha256:a68b30ef6182f9d13a709008542ad248afd55a74664dc67a1616a5a3c6795ecf` |
| Web rollback | Worker `b5880118-4afe-4259-8ca9-d5157506b65c` |

Operator verification: candidate `/live` and `/ready` 200; OpenAPI product-score present; unauthenticated product-score 401; authenticated synthetic product-score 200; exact product fields only; no numeric score/probability/risk band; invalid synthetic input generic 422 without raw echo; candidate logs with no raw Model V2 field names, Authorization/Bearer marker, or numeric-score marker; production-origin CORS preflight PASS; API activation 100%; production `/live`, `/ready`, and authenticated synthetic product-score PASS; Cloudflare bundle contains endpoint and approved wording; signed-in browser S11 submission PASS; approved wording PASS; numeric exposure absent; under-19 input error PASS.

Rollback compatibility is the current S11 API/web pair above and the prior known-good API/web identities above; preserve the pair as separate identities during recovery.
