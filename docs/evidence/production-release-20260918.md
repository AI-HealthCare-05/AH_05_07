# Production release closeout — 2026-09-18

Status: **PASS / PRODUCTION RELEASE VERIFIED**

## Release identities

- Canonical main at closeout:
  `bb30f4eaaf30065652032b81dece35a126218872`
- Deployed upstream source:
  `ea8ce31bf01fd63b0a9946e74b022520b2776fb7`
- Deployment mirror snapshot:
  `b65d3ab2c37a9ca2bdcaa4ed38f3447d2f1404ab`
- Mirror sync run:
  `35324770506`
- Production Worker:
  `07678494-b593-46ae-940f-d52e3f7d6391`
- Web rollback Worker:
  `b68ef833-00d3-450a-b788-e5de5ecd1e0c`
- Production API revision:
  `bp7-api-feedback-a04e311`
- API traffic:
  `100%`
- API rollback revision:
  `bp7-api-hyeol-cors-0912a`

The current canonical main differs from the deployed upstream source only by the
subsequent asset-review closeout documentation commit. The candidate additions
immediately before deployment remain review-only staging data and do not extend
the active companion runtime registry.

Wrangler reported the Worker deployment source as `Unknown`. Therefore the
source-to-Worker relationship above records the observed mirror sync, deployment
ordering and runtime identity; it is not claimed as native Cloudflare Git
provenance.

## Production build contract

The operator verified the production build values:

- `VITE_SK7_UI_MODE=journey`
- `VITE_SK7_SCENE_MODE=production`
- `VITE_SK7_COMPANION_MODE=production`

No secret value is recorded here.

## Database state

Production Supabase migration history includes:

`20260916124000_structured_recap_feedback`

`public.structured_feedback` exists with RLS enabled.

The migration was already active before this release closeout and was not
reapplied during this task.

## Verification

### Repository confidence

Manual Full Browser E2E:

- run: `35323794321`
- source: `ecf2ce8db52f6f410e4a91f62d5e38f7456b2ebf`
- result: **PASS**

All full-matrix jobs passed, including production Journey UI, production
companion, saved-scene parity, review scenes, authentication boundaries and UI
build matrix.

Changes after that run and before the deployed snapshot were limited to
review-only companion candidate staging/tests; the active production companion
manifest and runtime mapping were unchanged. The following main commit is
documentation-only.

### Public production smoke

The repository deployment-smoke verifier passed against:

- `https://hyeol.app`
- production `bp7-api`

Verified boundaries included web availability, API `/live`, API `/ready` and
browser CORS behavior.

Result: **PASS**

### Signed-in production flow

The operator completed the affected signed-in production flow using the
production Journey/scene configuration.

Verified:

- production Journey presentation
- S02 production scene path
- confirmed-save S05 one-shot presentation behavior
- S10 unified production scene ownership
- no competing production companion ownership on the unified S10 surface
- semantic UI/fallback remained available

Result: **PASS**

Only sanitized pass/fail evidence is retained here. No account identifier,
token, health value or raw product payload is recorded.

## Rollback rehearsal

Baseline production Worker:

`07678494-b593-46ae-940f-d52e3f7d6391`

Rollback Worker:

`b68ef833-00d3-450a-b788-e5de5ecd1e0c`

Procedure and result:

1. Switched production to the rollback Worker.
2. Confirmed rollback Worker as the current version.
3. Ran repository deployment smoke.
4. Smoke result: **PASS**.
5. Restored `07678494-b593-46ae-940f-d52e3f7d6391`.
6. Ran the same deployment smoke.
7. Restore smoke result: **PASS**.
8. Final Worker status confirmed
   `07678494-b593-46ae-940f-d52e3f7d6391` at **100%**.

Rollback/restore rehearsal: **PASS**

## Cloud Run closeout

Cloud Run was not redeployed because there were no API or database source
changes after the already verified structured-feedback production release.

Old revisions were retired after verification.

Final retained revisions:

- production: `bp7-api-feedback-a04e311`
- rollback: `bp7-api-hyeol-cors-0912a`

Final production traffic remains **100%** on
`bp7-api-feedback-a04e311`.

## Release decision

**PRODUCTION RELEASE VERIFIED / CLOSEOUT READY**

No additional Cloudflare, Cloud Run, Supabase, R2, authentication, Model V2 or
production-data mutation is required for this closeout.

This document records observed release evidence. It does not itself deploy,
rollback, rebuild or mutate production.
