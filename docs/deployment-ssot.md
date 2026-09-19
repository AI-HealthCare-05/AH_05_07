# Deployment SSOT

## Authority and runtime currentness

Canonical source is `AI-HealthCare-05/AH_05_07` `main`.
`emotigom/ah-05-07-pages` is a derived deployment snapshot, not development or
product authority. Merged source is not deployed runtime; mirror sync is not
Cloudflare build or deployment proof.

Read the serving Worker/source/build configuration and API revision/image/traffic
from live control planes at release time, with compatible rollback identities.
Historical evidence never becomes current runtime merely by remaining on `main`.
**No live Cloudflare/API control plane was checked during this documentation
cleanup; no current Worker version or API revision is asserted here.**
[AGENTS.md](../AGENTS.md) owns contribution/verification policy; the
[release contract](architecture/RELEASE_CONTRACT.md) owns release identity.

## Production topology

| Endpoint / service | Owner and required behavior |
| --- | --- |
| `https://hyeol.app` | `ah-05-07-pages`, the sole application Worker; upstream `web/wrangler.jsonc` owns its configuration. |
| `https://ah-05-07-pages.ahnsangkyoon.workers.dev` | Operational fallback for the same Worker, not a second application target. |
| `https://www.hyeol.app/*` | Zone-level `301` to `https://hyeol.app/*`, preserving path/query. |
| Legacy `ah-05-07-pages-web...workers.dev/*` | Redirect-only `308` to `https://hyeol.app/*`, preserving path/query; Git-disconnected, no application domain/build. Source is `ops/legacy-pages-web-redirect/`. |
| Cloud Run | `bp7-api` in `asia-northeast3`; primary browser origin `https://hyeol.app`. |
| Supabase | Auth and PostgreSQL RLS ownership; browser receives only public configuration/publishable key. |

Only `ah-05-07-pages` may connect to the deployment mirror. Before a release,
verify that sync cannot fan out to a legacy Worker. Public origin, Supabase Auth
redirect URLs and API CORS origins must agree; verify explicitly maintained
fallbacks. New browser methods require matching CORS preflight coverage.

## Mirror ownership

Fix code, docs and `web/wrangler.jsonc` upstream. Copied README/AGENTS/docs are
snapshots. The sole intentional mirror-owned control file is
`.github/workflows/sync-upstream.yml`; inspect it at release time.

The manual `Sync deployment branch` workflow accepts a full 40-hex
`upstream_sha`, verifies the resolved checkout and snapshots upstream except
`.git` and `.github/workflows`, retaining its control workflow. It creates a
parentless `sync: <source SHA>` commit and force-pushes mirror `main`, so mirror
SHA differs from source SHA. Use reviewed source reachable from canonical main.

The recorded control workflow is manual, with no scheduled trigger. Re-read it
before a release; Cloudflare may independently watch mirror main for builds.
Record source SHA, mirror SHA and sync run separately from build/runtime proof.
Do not sync merely to refresh docs. Workflow/schedule/build-behavior changes need
a separate scoped operations decision.

## Release classification

Classify actual production-artifact/configuration effects, not just path names.

| Change | Required production action |
| --- | --- |
| DB schema used by a release (`supabase/migrations/**`) | Complete the migration gate before dependent callers. |
| API artifact/runtime configuration (`app/**`, API build/config) | Build/deploy a new `bp7-api` revision; verify affected API flow. |
| Web production bundle/assets/build configuration | Sync the reviewed upstream SHA to the mirror, then verify Cloudflare build and served Worker. |
| Test/dev-only with no production artifact effect | No runtime deployment. |
| Docs-only | **NO PRODUCTION DEPLOYMENT.** No mirror sync, Cloudflare build, Cloud Run deploy, migration or production smoke solely for documentation. |

## Build configuration

`VITE_*` variables are public build configuration, embedded in browser assets.
Required values are `VITE_API_BASE_URL` (public API origin without trailing slash),
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never put secrets in
`VITE_*`, browser assets or the mirror. Server credentials stay server-only;
`SUPABASE_SECRET_KEY` binds only to the API after the deployment owner approves
that secret change, never to Cloudflare, logs, fixtures or API responses.

Workers Builds set `WORKERS_CI=1`; prebuild rejects missing/invalid public values
without printing them. URL values must be HTTPS origins without credentials,
path, query or fragment. Browser keys must be publishable or legacy `anon`, never
`sb_secret_...` or `service_role`. The guard is a no-op outside Workers Builds.
Save public variables before rebuilding; an old static bundle cannot acquire them.

Model V2 prebuild uses `verify-model-v2-assets.mjs --deployment-snapshot`: pinned
asset/manifest, complete canonical seal and guarded source hashes remain required.
Only intentionally omitted `.github/workflows/**` comparisons are excluded;
missing runtime/Python/evidence files or resolution competitors fail closed.
Canonical verification uses `--history --fetch-source`, including canonical CI
and Git identity. Both retain [ADR-0008](adr/0008-s11-verifiable-local-inference.md)'s
reviewed-local-run trust limit; neither proves deployed runtime or independent
execution attestation.

## Deployment flow

1. Resolve the exact verified, merged canonical `main` SHA.
2. Classify the release's DB/API/web effects using the table above.
3. Complete required migrations first, before any dependent API or web release.
4. Deploy the API only if its production artifact or runtime configuration changed.
5. Sync the web mirror only if its production artifact/configuration changed,
   using the exact reviewed `upstream_sha` after the mirror/topology preflight.
6. Independently verify the actual Cloudflare build, public configuration and
   serving Worker; verify the API revision/image/traffic for an API release.
7. Run public deployment smoke for web, `/live`, `/ready` and browser CORS methods.
8. Verify the affected signed-in production flow using synthetic data, including
   API/database access only after its migration gate passes.
9. Record sanitized, immutable source/snapshot/build/runtime and check evidence.
10. Preserve a complete, distinct previous Worker/API revision and rollback result.
    Capture the compatible rollback target before execution and retain it through
    verification. Do not use the manual static-file uploader for source releases.

Public smoke command (after the required releases, from Cloud Shell):

```bash
python3 scripts/ci/verify_deployment_smoke.py \
  --web-base-url "https://hyeol.app" \
  --api-base-url "https://bp7-api-292436735548.asia-northeast3.run.app"
```

This dependency-free command sends no authentication or product data. Public
smoke is not a substitute for signed-in verification or rollback rehearsal.

## Supabase migration gate

Git merge, CI, Cloud Run and Cloudflare deployment do not execute repository SQL
against production. Until remote migration history is reconciled and a linked
CLI release procedure is reviewed, use operator-mediated Supabase SQL Editor
execution.

1. Identify the earliest unapplied migration; review tables, policies, grants,
   triggers and scheduled jobs.
2. Execute only that migration; wait for success and stop at the first SQL error.
   Never retry by pasting the whole migrations directory.
3. Record filename, execution time, operator and sanitized result in the Issue/PR.
4. Use synthetic data to verify objects, constraints/triggers, RLS, authenticated
   grants and ownership policies. Grants and RLS are separate checks.
5. Only then deploy/verify dependent API/web callers. Record the consuming runtime,
   signed-in capability check and ownership-negative check when access changed.

Do not use `supabase db push` as a recovery shortcut with unknown remote history.
First compare `supabase migration list --linked`; deliberately review/reconcile
history before enabling CLI/CI release. Preserve chronological successful
migration evidence; a healthy web build does not prove the required DB schema.

## Rollback and evidence

Keep a distinct known-good, immutable previous Worker version and/or API
revision/image. Record source/Issue/PR, verification identity, mirror/run, build
and public-config fingerprint, runtime, relevant migration evidence and rollback
rehearsal result per the [release contract](architecture/RELEASE_CONTRACT.md).
Re-read compatible targets at release time; do not infer them from dated ledgers.
Runtime rollback, schema reconstruction and data recovery remain separate under
[the recovery contract](architecture/RECOVERY_CONTRACT.md).

Retain sanitized outcomes only: no credentials, tokens, identities, health
values, request bodies or raw logs. Recheck safe logging after a logging/request
path change. Preserve previous runtime targets until verification passes.

## Historical evidence

- [S11 production closeout — 2026-09-19](evidence/s11-production-closeout-20260919.md)
- [Production release — 2026-09-18](evidence/production-release-20260918.md)
- [O3 clean release execution](evidence/o3-clean-release-execution.md)
- [O1 production execution](evidence/o1-production-execution.md)
- [Deployment history through 2026-09-18](evidence/deployment-history-through-20260918.md)
