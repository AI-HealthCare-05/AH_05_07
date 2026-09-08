# AC-10 web clean-release rehearsal — Phase A preflight

- **Date:** 2026-09-08
- **Issue:** #316
- **Phase:** A — read-only/local preflight only
- **Source baseline:** `dc83c9ed60ffd3caece47c028a3d0546f40c6de6` (`origin/main` after the start-of-work fetch)
- **Branch/source relationship:** `ops/ac10-web-clean-release-rehearsal` was aligned with the source baseline before this documentation-only change; no Issue-specific commit was present at the start.

## Clean checkout and build controls

| Check | Result | Sanitized note |
| --- | --- | --- |
| Fresh exact-SHA checkout | PASS | Checkout resolved to the source baseline above. |
| Clean worktree | PASS | No tracked or untracked changes at checkout start. |
| Initial `web/node_modules` absent | PASS | No existing dependency tree was present. |
| Initial `web/dist` absent | PASS | No existing browser build artifact was present. |
| Initial local `.env` absent | PASS | No local environment file was present in the fresh checkout. |
| `npm ci` | PASS | Lockfile-based install completed in the fresh checkout. |
| Required production public-variable classes available | **BLOCKED** | `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and the SSOT-required companion mode class were not available in the execution environment. No values were guessed or generated. |
| Production-equivalent `npm run build` | **BLOCKED** | Not claimed because the required production public-variable classes were unavailable. |
| Public-safe placeholder build control | PASS | `npm run build` completed with non-production placeholder values; this is repository self-test evidence, not production-equivalent build evidence. |
| Generated browser secret boundary | PASS | Existing `scripts/ci/verify_secret_boundary.py` self-test and generated `web/dist` verification passed. No secret value was retained. |
| Deployment-smoke self-test | PASS | `python scripts/ci/verify_deployment_smoke.py --self-test` passed. This was a local control test, not production smoke. |

## Deployment mirror read-only preflight

- **Result:** PASS
- **Repository:** `emotigom/ah-05-07-pages`
- **Workflow:** `Sync deployment branch` in `.github/workflows/sync-upstream.yml`
- **Upstream/ref:** `AI-HealthCare-05/AH_05_07`, `main`
- **Snapshot behavior:** fresh upstream checkout; upstream `.github/workflows` excluded; only the mirror sync workflow is retained.
- **Worker configuration boundary:** the workflow does not generate or overwrite `web/wrangler.jsonc`; the production Worker name remains source-owned as `ah-05-07-pages`.
- **Current mirror snapshot SHA:** `17fa53605c92f7b8af5993f34dcce9e68d060a61`
- **Current mirror commit message:** `sync: a320191`
- **Sync workflow execution:** NOT RUN

## Cloudflare read-only inventory

- **Inventory commands:** read-only `wrangler deployments status` and `wrangler versions list` commands were used.
- **Current Worker complete version:** `2e3c04cb-a323-4074-83cf-6a8911526bf8` at 100% in the deployment status.
- **Distinct previous complete rollback candidate:** BLOCKED — the returned version list entries were preview versions; no distinct previous complete candidate was safely confirmed.
- **Inventory result:** current version observed; rollback-candidate gate BLOCKED.
- **Raw JSON, credentials, account metadata, author metadata, and headers:** not retained.

## Phase A boundary and disposition

- **Phase B readiness:** **BLOCKED** — production public build-variable classes were unavailable and a distinct complete rollback candidate was not confirmed.
- **AC-10 status:** remains **Partial**. Phase A does not complete AC-10 and does not authorize Phase B.
- **Production traffic changes:** 0
- **Production account actions:** 0
- **Product/health data writes:** 0
- **API deployment:** 0
- **DB/RLS/migration changes:** 0
- **AI Model actions:** 0
- **Worker deployment, rollback, and restore:** NOT RUN
- **Production public smoke:** NOT RUN

Phase B production rehearsal requires separate explicit owner approval.

## Phase A.5 — operator clean-build unblock

- **Execution type:** operator-executed clean reproduction
- **Clean-build source SHA:** `dc83c9ed60ffd3caece47c028a3d0546f40c6de6`
- **Production public build-variable classes available:** PASS
- **Clean worktree:** PASS
- **`web/node_modules` initially absent:** PASS
- **`web/dist` initially absent:** PASS
- **`npm ci`:** PASS
- **Production-equivalent build:** PASS
- **Generated secret boundary:** PASS
- **Production traffic changes:** 0
- **Deployment mirror sync:** NOT RUN
- **Worker deployment:** NOT RUN
- **Rollback:** NOT RUN
- **Restore:** NOT RUN

The earlier production-variable and rollback-candidate BLOCKED history is retained above and was subsequently resolved for the clean-build baseline recorded here.

## Phase A.5 — read-only rollback candidate resolution

- **Current active complete Worker version:** `34c9ab45-4896-4c49-9842-8de9bacca483`
- **Most recent distinct previous real production deployment:** `2e3c04cb-a323-4074-83cf-6a8911526bf8`
- **Complete previous version:** `2e3c04cb-a323-4074-83cf-6a8911526bf8`
- **Previous candidate preview-only:** NO — it was listed as a 100% deployment; version detail identified it as a Wrangler-uploaded version. Preview capability does not make it preview-only.
- **Candidate distinct from current:** PASS
- **Candidate identity verification:** PASS — full UUID matched and identity was unambiguous.
- **Raw JSON and sensitive metadata:** not retained.

Original Phase A blockers resolved for baseline `dc83c9ed60ffd3caece47c028a3d0546f40c6de6`.

**Phase B gate:** rollback candidate READY; latest-main clean-build refresh REQUIRED immediately before Phase B.

AC-10 remains **Partial**. Phase B production rehearsal still requires separate explicit owner approval.

## Phase B — first source-race failure

- **Workflow run:** `34186498061`
- **Mirror snapshot:** `39abf269a0f062ed78999f849be5c97eddc1503a`
- **Mirror message:** `sync: 70d3a2e`
- **Result:** the snapshot did not map to the approved source freeze, so the normal Phase B path was stopped. This failed-attempt history is retained; no second sync was used to conceal it.

## Phase B — delayed deployment recovery

- **Delayed mismatched Worker:** `ae67f59a-9f57-438d-955c-573d1b1367d8`
- **Safety restore:** `34c9ab45-4896-4c49-9842-8de9bacca483` restored to 100%.
- **Safety smoke:** PASS.

## Phase B — final successful rerun

- **Approved source:** `0fa4684cd098ee0d3594f03d40126b15bf0ad022`
- **Source freeze:** PASS immediately before sync and immediately before workflow dispatch; `origin/main` matched exactly.
- **Latest-main clean reproduction:** PASS — detached exact-source checkout, clean `npm ci`, and `npm run build` exit 0. No production public-variable values were retained.
- **Mirror pre-sync:** `39abf269a0f062ed78999f849be5c97eddc1503a` — `sync: 70d3a2e`
- **Mirror workflow:** `34187377748` — [workflow run](https://github.com/emotigom/ah-05-07-pages/actions/runs/34187377748) — SUCCESS.
- **Mirror snapshot:** `96d893f19e5daed0b45e972bf957b0336094dad2` — `sync: 0fa4684`.
- **PRE_DEPLOY_WORKER:** `34c9ab45-4896-4c49-9842-8de9bacca483` at 100% before deployment.
- **NEW_WORKER:** `026fafcb-b8e8-45ed-a331-ee2d3279e3f7`, identified after the successful mirror mapping and active at 100%.
- **Activation smoke:** PASS.
- **Rollback runtime:** `34c9ab45-4896-4c49-9842-8de9bacca483` at 100%.
- **Rollback smoke:** PASS.
- **Restored runtime:** `026fafcb-b8e8-45ed-a331-ee2d3279e3f7` at 100%, using the already-created version.
- **Final smoke:** PASS.
- **Final production:** `026fafcb-b8e8-45ed-a331-ee2d3279e3f7` at 100%.
- **Post-rerun delayed runtime observation:** `de2d96be-2649-4ccc-800a-362a92d1e636` appeared at 100% during a later read-only final-state recheck. No smoke was run against that unplanned version; the already-created `NEW_WORKER` was restored exactly to 100% and the identical final smoke passed again. A stability recheck continued to show `NEW_WORKER` at 100%.

### Phase B boundaries

- **API deployment:** 0
- **DB/RLS/migration changes:** 0
- **Account actions:** 0
- **Product/health data writes:** 0
- **AI Model actions:** 0
- **Raw Wrangler JSON, tokens, VITE values, account metadata, and product data:** not retained.

**AC-10 web clean-release rehearsal = COMPLETE.**
