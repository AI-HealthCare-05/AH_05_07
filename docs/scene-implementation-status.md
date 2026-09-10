# Living Journey Hybrid implementation checkpoint — 2026-09-10

Current checkout: `/Users/gom/Projects/AH_05_07`, branch `codex/living-journey-hybrid`, [Issue #390](https://github.com/AI-HealthCare-05/AH_05_07/issues/390), [draft PR #391](https://github.com/AI-HealthCare-05/AH_05_07/pull/391). Continue these existing artifacts. The restored checkpoint has already been applied and pushed; do not reapply its ZIP or create a duplicate Issue/PR.

This current status supersedes the original local-only/GitHub-403/browser-blocked notes. Historical details remain in Git and `scene-local-resume.md`. The user's original local `scene-next-task-handoff.md` is preserved separately as an untracked historical handoff.

## Completed review implementation

- Shared Seoul date rollover: one App snapshot for semantic dates, current/prior window bounds and both scene screens; midnight, visible-tab recovery and pageshow; fixed fixture dates, unsaved drafts and request/session-generation safeguards. See [date verification](scene-date-rollover.md).
- S02: seven clay landmarks and 21 matching responsive posters. The owner accepted the current S02/S10 art and neutral composition on 2026-09-10 KST; physical-device acceptance remains open. All 21 original R2 file identities are unchanged after recapturing shared source changes. See [S02 workflow](scene-clay-posters.md).
- S10: calendar diorama with one focal landmark/bear, seven desktop landmarks and focal plus one neighbor on mobile. Its 21 responsive posters use independently authored profile cameras. Prior-window selection and changing facts cannot change today's scenery. See [S10 implementation](scene-s10-diorama.md).
- Manifest: 45 assets / 28 recipes, with explicit environment roots, complete geometry dependencies, same-screen weekday/profile fallbacks, exact source/camera/image hashes, public delivery evidence and conservative budgets. Shared stylesheet/presentation changes now require recapture. See [manifest verification](scene-manifest-validation.md).
- S02/S10 failure/resource ownership: one poster on chunk failure, no failed-3D retry on motion-tier changes, one character load across viewport changes, and explicit WebGL context release on route/recipe exit. No perpetual RAF, mixer or new dependency.
- R2: all 42 S02/S10 posters uploaded and registered at `https://sk7-companion.gkrry.com`, verified by exact public bytes/MIME/CORS and existing four-hour cache headers. Authenticated dashboard upload did not change bucket security, CORS or OAuth scopes. Local capture originals are retained for reproducible verification.
- Existing 22 GLBs / 77 species-and-clip pairs remain unchanged. Earlier import-graph, Windows LF and synthetic-viewer timing checks remain in place. API/DB/auth/Model V2 and production S05 contracts are unchanged.

## S05 migration increment

The next bounded increment adds a separate review S05 boundary using the existing bear-lite and CSS/semantic layout. The App issues an ephemeral presentation event only after confirmed persistence and the existing request-generation guard, retains it through refresh, and permits one celebration opportunity. Motion/visibility/route interruptions consume it; failures remain latched for that event. A fixed verified GLB byte cache avoids S05 refetches across successful remounts; parsed resources and WebGL contexts are released on exit. The existing production S05 renderer/resolver remains independent. See [S05 implementation](scene-s05-migration.md) and [remaining release gates](scene-release-gates.md).

The complete S05 review suite passes **35/35**, recorded with exact source hashes in [parity evidence](evidence/scene-s05-parity.json). Existing production S05 passes **5/5** with an added assertion that the new renderer is absent; adjacent navigation/session/reliability/companion/default-off/policy tests pass **31/31**; the unchanged manifest passes **71/71**. TypeScript/Vite production builds pass with the existing large lazy Three chunk warning. The complete S02/S10/date suite passes **52/52** on this increment. These five suites total **194 passing checks**. The owner accepted the current S02/S10 art on 2026-09-10 KST (“현재 S02·S10 아트 승인”), scoped to the unchanged 42 poster identities at source `37eec04a11a6c51ff728eddd059cc9d1c0b59dc1`. Physical Android Chrome has constrained local-preview evidence: real S02/S10 render/cache/context cycles and a touch-triggered S05 one-shot save, all at source `6ccf515206e2c6228db26db34386751c94c1f64a`; see [Android evidence](evidence/scene-android-chrome-sm-a528n.json). A bounded TalkBack inspection on `665e19ba41564bc5f8f2ea88e4e706b9ddfe0183` bound the service, verified S02/S05 focus order and decorative exclusion, and verified S10's semantic order; it did not capture audible output, Touch Explorer swipes or switch access. A user-reported iPhone 17 / iOS 26.5 VoiceOver check passes the S02/S10/S05 semantic sequence and S05 non-repeat behavior at source `56421f8989633152c9c199c124fcd0467ab6e066`; see [iPhone evidence](evidence/scene-ios-voiceover-user-check.json). It does not identify a browser/version or prove realtime 3D. Wi-Fi/cellular, GPU/memory/FPS, TalkBack audible/swipe behavior, iPhone Safari realtime 3D and production acceptance remain open. `xcrun devicectl` is unavailable.

## Android measurement continuation — 2026-09-10

The [repeatable device probe](scene-device-probe.md) adds ten S02/S10/S05 cycles on the physical SM-A528N with Android Chrome 152 and its Adreno 642L renderer. The exact build/probe hashes, per-clip callback intervals, request encodings and retained-heap observations are recorded in [new device evidence](evidence/scene-android-performance.json). The application source remains `b53ad4e83f32c2cbfdf63c053a75249c30733608`; this continuation changes the probe, CI syntax check and documentation only.

Each new synthetic S05 confirmation celebrated once; history return did not replay. All sampled idle periods had zero RAF callbacks, and each semantic exit had zero live WebGL contexts. Browser-emulated reduced motion selected S02/S10 posters and skipped S05 celebration. Frame callbacks were measured on physical hardware without simultaneous video/trace capture; they do not establish presented FPS or GPU headroom.

The final run's ten clips had a p95 interval of approximately 16.7 ms each (largest observed interval 33.4 ms). Cache-disabled selected scene response totals were S02 701,236 / S10 702,645 / S05 687,286 bytes, with gzip observed on the local JavaScript responses; these include CDP protocol overhead and exclude the whole page. Post-GC JS heap rose from 13,020,852 to 14,550,920 bytes (+1,530,068), and the node counter from 581 to 611. Activation long tasks reached 134 ms on S02, 115 ms on S10 and 81 ms on S05; attribution and interaction impact remain unmeasured.

Retained JS heap and DOM-node counters increased across the ten cycles, including a control that removed probe-owned WebGL references and cleared samples before GC. No application leak is inferred from these aggregate counters, but the no-growth memory gate has **not passed**. Retaining-path attribution and absolute GPU/peak-memory review remain required. Physical Safari, OS reduced motion, Wi-Fi/cellular qualification and audible/touch/switch accessibility acceptance remain open. The existing S02/S10 owner art acceptance is unchanged; S05 owner acceptance and production activation are still separate.

## macOS host memory investigation — 2026-09-10

The subsequent [retention investigation](scene-memory-investigation.md) used the connected Android device from the Mac host. It identified the repeated native canvas/context retention through Three 0.185.1's global DFG LUT. Thirty review cycles added 90 detached canvases/lost contexts; the off control added none. S02/S10 and S05 review teardown now release the compiled LUT before renderer properties are discarded, with deduplicated texture/material/geometry/skeleton cleanup. The new weak-reference/forced-GC browser regression passes, and the full S05 suite passes **36/36**.

All 42 recaptured poster records match the prior art byte-for-byte; only the renderer/helper source hashes changed. The [sanitized memory evidence](evidence/scene-android-memory.json) records exact sources/builds and control snapshots. The first corrected Android run was interrupted during cycle 10: nine cycles kept DOM nodes at 146, and its warmed snapshot had no native canvases/WebGL resources, but this is **not a complete post-fix physical pass**. Chrome availability is required for the uninterrupted rerun. Aggregate application JS retention, absolute GPU/peak memory and the remaining release gates stay open. The previous 194-check and Android performance results above are historical results for their recorded revisions. The corrected candidate passes 175 local checks: S05 36, S02/S10/date 52, existing production S05 5, default-off/policy 6, manifest 72 and heap inspector 4. TypeScript/Vite builds pass with the existing lazy Three chunk warning.

## Verification of the S10 increment (historical)

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
| Android Chrome SM-A528N / Android 14 / Chrome 152 | PARTIAL: local-preview S02/S10/S05 behavior, selected transfer/cache/context lifecycle and bounded TalkBack focus order passed; network, GPU/memory/FPS, TalkBack audible/swipe behavior and switch access remain unmeasured |
| iPhone 17 / iOS 26.5 VoiceOver | PARTIAL: S02/S10/S05 semantic/fallback sequence and S05 non-repeat passed; browser/version and realtime 3D were not recorded |
| Physical Safari realtime 3D, GPU/memory/FPS | NOT MEASURED |
| Final owner art acceptance — S02/S10 | ACCEPTED 2026-09-10 KST; current 42 poster identities only |

The full public-delivery run passed 51/52; the added S10 CORS test reused a no-CORS image memory-cache entry and failed. A controlled comparison confirmed a clean CORS request returns the exact public bytes. The test now starts on a page without that image and passes, keeping the same URL/hash/header assertions. Product image delivery and bucket settings were unchanged. Earlier authoring tests exposed 581px clipping; the desktop bear anchor and all seven affected captures were corrected before upload. A too-strict prior-window canvas-identity assertion was narrowed to preserve the existing loading/remount contract while still checking current calendar scenery.

Current CI status belongs to the exact HEAD shown on PR #391. The preceding S10 commit `aaf833219427690a9eaf52481d24a591fa849436` passed all 21 GitHub checks; that result is historical and does not substitute for the new S05 HEAD checks.

S10's conservative planning range is 841,029–844,147 bytes per realtime recipe; the gate is 900,000 bytes. `scene-diorama-r2-network.json` records **699,980–752,515 selected encoded response bytes** over four viewports in local Chromium with ANGLE SwiftShader and public R2 media. These protocol estimates exclude the semantic shell, can include unattributed response overhead, and are not whole-page or physical-device performance acceptance. Exact image bodies are independently hashed. S10 capture counters reach 75 draw calls / 89,654 triangles on desktop; device costs remain unmeasured.

## Gate and remaining work

`VITE_SK7_SCENE_MODE=review` permits the registered S02/S10 scenes and the separate confirmed-event S05 migration candidate. Missing, unknown, off and production modes remain closed. The existing production S05 path controlled by `VITE_SK7_COMPANION_MODE` remains independent. R2 asset upload does not deploy or activate the application. PR #391 remains draft; no merge or rollout is included.

1. S02/S10 owner visual acceptance: **completed** for current art on 2026-09-10 KST. Future art/source recapture changes require a new review.
2. Physical-device and owner acceptance of the S05 review migration. Automated recovery parity is now 35/35; this is not a production release or API write-idempotency guarantee.
3. Finish physical-device acceptance: repeat the corrected Android build without interruption, review remaining aggregate JS growth and GPU/peak-memory/presented FPS, then Wi-Fi/cellular, TalkBack audible/Touch Explorer behavior and switch access; iPhone/iPad Safari realtime 3D, network/GPU/peak-memory/FPS, reduced motion and any remaining input methods; review the recorded Android long-task observations against release criteria. The DFG LUT retention is attributed and corrected; the probes close only their documented bounded checks.
4. Controlled web-only rollout and rollback through the existing upstream-main → deployment-mirror → Cloudflare flow only after release gates pass.

For continuation, inspect the branch/working tree and current PR HEAD, preserve unrelated changes, and read `scene-s05-migration.md` plus `scene-release-gates.md` for the remaining acceptance work. Run checks appropriate to actual changes; do not repeat completed forensic or browser work just to reread the checkpoint. No new services, health inference, dependency or production gate should be introduced to bypass an open acceptance condition.
