# Living Journey Hybrid implementation checkpoint — 2026-09-10

Current checkout: `/Users/gom/Projects/AH_05_07`, branch `codex/living-journey-hybrid`, [Issue #390](https://github.com/AI-HealthCare-05/AH_05_07/issues/390), [draft PR #391](https://github.com/AI-HealthCare-05/AH_05_07/pull/391). Continue these existing artifacts. The restored checkpoint has already been applied and pushed; do not reapply its ZIP or create a duplicate Issue/PR.

This current status supersedes the original local-only/GitHub-403/browser-blocked notes. Historical details remain in Git and `scene-local-resume.md`. The user's original local `scene-next-task-handoff.md` is preserved separately as an untracked historical handoff.

## Completed review implementation

- Shared Seoul date rollover: one App snapshot for semantic dates, current/prior window bounds and both scene screens; midnight, visible-tab recovery and pageshow; fixed fixture dates, unsaved drafts and request/session-generation safeguards. See [date verification](scene-date-rollover.md).
- S02: seven clay landmarks and 21 matching responsive posters. Geometry and neutral bear composition remain review candidates. All 21 original R2 file identities are unchanged after recapturing shared source changes. See [S02 workflow](scene-clay-posters.md).
- S10: calendar diorama with one focal landmark/bear, seven desktop landmarks and focal plus one neighbor on mobile. Its 21 responsive posters use independently authored profile cameras. Prior-window selection and changing facts cannot change today's scenery. See [S10 implementation](scene-s10-diorama.md).
- Manifest: 45 assets / 28 recipes, with explicit environment roots, complete geometry dependencies, same-screen weekday/profile fallbacks, exact source/camera/image hashes, public delivery evidence and conservative budgets. Shared stylesheet/presentation changes now require recapture. See [manifest verification](scene-manifest-validation.md).
- Failure/resource ownership: one poster on chunk failure, no failed-3D retry on motion-tier changes, one character load across viewport changes, and explicit WebGL context release on route/recipe exit. No perpetual RAF, mixer or new dependency.
- R2: all 42 S02/S10 posters uploaded and registered at `https://sk7-companion.gkrry.com`, verified by exact public bytes/MIME/CORS and existing four-hour cache headers. Authenticated dashboard upload did not change bucket security, CORS or OAuth scopes. Local capture originals are retained for reproducible verification.
- Existing 22 GLBs / 77 species-and-clip pairs remain unchanged. Earlier import-graph, Windows LF and synthetic-viewer timing checks remain in place. API/DB/auth/Model V2 and production S05 contracts are unchanged.

## Verification of the S10 increment

| Check | Result |
| --- | --- |
| Manifest rejection/registration suite | 71 PASS |
| Independent Draft 2020-12 schema and manifest | PASS |
| TypeScript / Vite production build | PASS; existing large lazy Three chunk warning retained |
| S02/S10/date Chromium review suite | 52 cases pass across full run and targeted correction |
| Default-off and policy | 6 PASS |
| Existing production S05 regression | 5 PASS |
| S10 public GET identity / MIME / CORS / cache | 21/21 PASS; S02's existing 21 identities retained |
| Master widths | Seven weekdays, realtime and poster, at 320/390/1366px on each screen |
| Intermediate widths | 350/351/580/581/768px focal bounds and poster scale |
| Physical Safari/Android, GPU/memory/FPS, final art acceptance | NOT MEASURED / NOT ACCEPTED |

The full public-delivery run passed 51/52; the added S10 CORS test reused a no-CORS image memory-cache entry and failed. A controlled comparison confirmed a clean CORS request returns the exact public bytes. The test now starts on a page without that image and passes, keeping the same URL/hash/header assertions. Product image delivery and bucket settings were unchanged. Earlier authoring tests exposed 581px clipping; the desktop bear anchor and all seven affected captures were corrected before upload. A too-strict prior-window canvas-identity assertion was narrowed to preserve the existing loading/remount contract while still checking current calendar scenery.

Current CI status belongs to the exact HEAD shown on PR #391. The preceding S02 commit `6e68338207537ab232779ccf0202d26f381a6178` passed all 21 GitHub checks; that result is historical and does not substitute for the new S10 HEAD checks.

S10's conservative planning range is 841,029–844,147 bytes per realtime recipe; the gate is 900,000 bytes. `scene-diorama-r2-network.json` records **699,980–752,515 selected encoded response bytes** over four viewports in local Chromium with ANGLE SwiftShader and public R2 media. These protocol estimates exclude the semantic shell, can include unattributed response overhead, and are not whole-page or physical-device performance acceptance. Exact image bodies are independently hashed. S10 capture counters reach 75 draw calls / 89,654 triangles on desktop; device costs remain unmeasured.

## Gate and remaining work

`VITE_SK7_SCENE_MODE=review` permits the registered S02/S10 scenes. Missing, unknown, off and production modes remain closed. Existing `VITE_SK7_COMPANION_MODE` and S05 are independent. R2 asset upload does not deploy or activate the application. PR #391 remains draft; no merge or rollout is included.

1. Final owner visual review of S02/S10 clay art and neutral composition.
2. S05 migration parity: confirmed persistence and exactly-once behavior across timeout/unknown/409/retry/remount/back/reduced-motion/hidden/fallback cases. Existing S05 tests alone do not complete this migration.
3. Physical Safari/Android performance and accessibility, including interaction responsiveness, decode/shader/main-thread cost, GPU/peak memory and cache behavior.
4. Controlled web-only rollout and rollback through the existing upstream-main → deployment-mirror → Cloudflare flow only after release gates pass.

For continuation, inspect the branch/working tree and current PR HEAD, preserve unrelated changes, and read `scene-s10-diorama.md` plus the contract for the next bounded increment. Run checks appropriate to actual changes; do not repeat completed forensic or browser work just to reread the checkpoint. No new services, health inference, dependency or production gate should be introduced to bypass an open acceptance condition.
