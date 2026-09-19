# Deployment history through 2026-09-18

> HISTORICAL EVIDENCE — NOT CURRENT RUNTIME AUTHORITY
>
> Runtime identities below are valid only for their recorded dates/scopes.
> They must never be treated as the current Worker/API revision without
> fresh control-plane verification.

Preserved from `docs/deployment-ssot.md` at source
`f84cc8529f3021e0e15ad75f339d5bf34fe08307`. Extracted observations keep their
original scope and wording; old “current”, pending, or next-action language is
historical. Current operating instructions are in [Deployment SSOT](../deployment-ssot.md).
No live control plane was inspected during this documentation cleanup.

## Recorded web production evidence — 2026-09-18

The complete source/mirror/Worker/API identities, build configuration, migration
state, verification scope and rollback/restore results are preserved in
[the dedicated release closeout](production-release-20260918.md).
The later [2026-09-19 S11 closeout](s11-production-closeout-20260919.md) records
another rollout. Neither dated observation establishes today's serving identity.

## Previous web production record — 2026-09-14

**OPERATOR-VERIFIED WEB ROLLOUT.** Canonical `main` is
`37fc06d02b78d35a064c8d2f0c74575d4011f96d`; its final change is repository
guidance only. The last runtime-affecting source is
`2626d6ea1804b5faf13098572f3302d14b23db5c` (#498, including #496).

The deployment mirror snapshot is
`1790f5aaf35d3741ea812dca8bc499eab0bc8e46`
(`sync: 37fc06d02b78d35a064c8d2f0c74575d4011f96d`).
Cloudflare Workers Build
`af914237-0723-4491-92c9-341a814aa96f` completed successfully and produced
Worker Version `77fa263d-890a-46b8-a71b-70bb2c23f9f8`.

Operator Safari smoke passed on `https://hyeol.app` and its same-Worker
fallback. The first authenticated observation bootstrap did not reproduce the
previous S13 load failure; S11 walking/alcohol step validation and browser-local
Model V2 completion also passed. This records symptom non-reproduction on this
release, not proof of the historical production failure's exact root cause.

No Cloud Run deployment or Supabase migration was required for this web-only
rollout. Normal S11 Model V2 success performs no feature-bearing inference POST
and has no server fallback; the authenticated server endpoint remains.

## Historical server-inference S11 production evidence

This is a retained server-inference rollout record, not a live inventory. Current API
revision/image/traffic and Worker version/build/source binding must be read from
control planes at release time. [Fast start](../project-handoff.md#fast-start) owns
source-task routing; the record below does not prove deployment of later main.


**OPERATOR-VERIFIED PRODUCTION EVIDENCE (RECORDED ROLLOUT).** Recorded source is `f25fddfc442be63721daae671e4beb267ead5f5f`; the deployment mirror snapshot is `e390c343d87f032f278db0df22e9fbfb1bbb0b3a`; Cloud Run revision is `bp7-api-s11-f25fddf` with immutable image `sha256:b7c7627a9352f930b5371aa5ecc97b40427987e57585039cace3dd1b5ecb145c`; Cloudflare Worker is `8975da2f-2162-40ea-adf4-f5187c1cc5f2`; and Model V2 is `model-v2-r1-schema-v1` with artifact `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84` and wording `입력 기반 위험군 선별 신호`. The API rollback identity is `bp7-api-00031-rel` / `sha256:a68b30ef6182f9d13a709008542ad248afd55a74664dc67a1616a5a3c6795ecf`; the web rollback Worker is `b5880118-4afe-4259-8ca9-d5157506b65c`.

Operator rollout verification recorded candidate `/live`/`/ready` 200, OpenAPI endpoint presence, unauthenticated 401, authenticated synthetic 200, exact two-field output, no numeric exposure, generic non-echoing 422, sanitized candidate logs, CORS preflight, 100% API activation, production health/API checks, bundled endpoint/wording, signed-in browser submission, approved wording, absent numeric result, and under-19 error as PASS. This Codex session has not independently re-read runtime control planes; see [the canonical release contract](../architecture/RELEASE_CONTRACT.md). A documentation commit does not redeploy or re-verify runtime.

## Previous non-model activation record — 2026-09-08

See [account-removal production baseline](../account-removal-production-baseline.md)
for source `9713ed5aab4a4e74b145d79c4d536affab3c010b`, API revision
`bp7-api-00031-rel`, immutable image, Worker version, and server-secret binding.
Issue #355 records activation/rollback/restore success, not actual account deletion.
Earlier dated ledgers below remain historical. No redeployment is required for
this documentation change. Re-read control-plane state before any future operation.

## Cloudflare recovery record — 2026-09-12

Issue #427 records the completed runtime recovery and the source-control guard
that prevents recurrence. No additional Cloudflare mutation is required merely
to merge the guard.

- `hyeol.app` and the canonical `ah-05-07-pages...workers.dev` fallback returned
  HTTP 200 and served the same browser bundle.
- The observed browser bundle SHA-256 was
  `6b96eb534606c34827711828fe2a0eccbdbf5bcec282d4d60cefd2982f592ad7`.
- Sanitized inspection confirmed the expected public API/Supabase configuration
  class and no server-secret key pattern in the browser bundle.
- `www` returned `301`; both legacy Workers returned `308` with path/query
  preservation.
- Cloud Run `/live` and `/ready` returned 200 and browser-origin CORS checks for
  GET/POST/PUT/DELETE passed.
- The redirect-only `ah-05-07-pages-web` version recorded after recovery was
  `7709daae-13ed-45a1-b4f4-741615d8a687`.

## Historical web release and rollback evidence

- Web release commit: `856606a2a230558887e294e44e8fe99186a542a8`.
- Deployment snapshot: `emotigom/ah-05-07-pages` workflow run
  [`33822332784`](https://github.com/emotigom/ah-05-07-pages/actions/runs/33822332784),
  completed successfully on 2026-09-04.
- Worker version recorded at Issue #143:
  `38bb08b6-66ca-4933-8cbe-ee857aa4ece7`.
- Public web/API/CORS smoke and operator-reviewed magic-link/session checks:
  passed, as recorded in Issue #143.
- Cloud Run deployment, Supabase migration, and production record write: not
  performed for this rollout.
- Source baseline when this G4 evidence was reviewed:
  `61ee356e43eeb4f06120af870c4fc2b9ee5f9d41` after the test-only PR #145;
  no runtime deployment is required for that assertion-only change.
- At Issue #143, rollback was unresolved: the recorded `38bb08b6` value was only
  the then-current Worker version prefix and did not establish a distinct
  rollback target.

Issue #151 established a distinct Worker rollback target and a completed
rehearsal: `38bb08b6-66ca-4933-8cbe-ee857aa4ece7` was deployed at 100%,
the public smoke passed, and
`6d100754-7e85-4d43-b466-e7944c61a0c0` was restored at 100% with the same
smoke passing. This historical rehearsal does not close the remaining Gate C
evidence or the upgrade baseline's [O3 clean-release rehearsal](../mvp1-operations-review.md),
which still requires separate approval and execution.

Issue #166 completed a bounded production Cloud Run requests-log review after a
synthetic signed-in refresh. The operator selected the `bp7-api` requests stream
in `asia-northeast3` and found request metadata only: no secret, JWT, user
identifier, request body, or health value was displayed. Do not retain raw log
output, identifiers, query strings, or screenshots as release evidence. Repeat
this review after a logging- or request-path change.

## S3E production rollout evidence — 2026-09-07

The [dedicated S3E rollout record](../s3e-companion-production-rollout.md)
preserves source `30fd65eda8d988804c8af208276934226e0eb67d` (PR #255), build
mode, Worker baseline/activation/rollback/restore identities, public smoke and
runtime boundaries. Mirror sync success was operator-reported; no workflow run
ID or URL was recorded because the repository evidence did not tie a specific
snapshot run to that source SHA.

## S4 O3 API-only release ledger — 2026-09-07

The [dedicated O3 execution record](o3-clean-release-execution.md) preserves
source `3106537d61396b20a18a85cd6d0d74c498a91aab`, Cloud Build and immutable
image identity, API/rollback revisions and traffic, all smoke results, migration
execution/history reconciliation and the immediate `unused_index` INFO finding.
Web was not redeployed in that API-only release.

## Deployed ownership verification — 2026-09-04

The [dedicated ownership verification record](../deployed-rls-verification-plan.md)
preserves Issue #149's migration/RLS/grant preflight, approved synthetic owner
CRUD/export and cross-user/anonymous/action-lock checks, and account cleanup.
That verification did not change migrations, policies, grants or runtime deployments.
