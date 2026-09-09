# Living Journey review and release gates

Continuation of Issue #390 / draft PR #391. Implementation authorization is recorded in [architecture](scene-architecture.md); it does not satisfy owner visual acceptance or physical-device measurements. Current results are in [implementation status](scene-implementation-status.md). This checklist prepares the remaining work; no production gate is opened by this document.

## Owner visual review — S02/S10 accepted

Review all seven weekdays on S02 and S10, separately at 320, 390 and 1366 CSS px. Use the matching original WebPs in [S02 posters](../web/public/scene-review/s02/v1/) and [S10 posters](../web/public/scene-review/s10/v1/), with the exact file/camera/source mapping in [S02 evidence](evidence/scene-clay-posters.json) and [S10 evidence](evidence/scene-diorama-posters.json). Compare realtime and fallback in the review build, plus 320×568 and intermediate widths 350/351/580/581/768.

For each screen/profile record accepted or changes requested, reviewed source revision, weekday(s), and the concrete reason. Review the bear's face/ears/silhouette, focal landmark hierarchy, neutral composition, clay geometry and palette, and whether any background implies a health or participation outcome. S10 must show today's scenery even while browsing the prior record window. Sunday/Monday must not read as a completion/reset reward. **Owner decision recorded 2026-09-10 KST:** “현재 S02·S10 아트 승인”. This accepts the current S02/S10 art at source commit `37eec04a11a6c51ff728eddd059cc9d1c0b59dc1`, with the unchanged 42 poster identities in the linked evidence. It does not approve future recaptures, physical-device cost, S05 migration release or production activation.

S05 now has a behavior migration candidate using its existing composition; see [S05 migration](scene-s05-migration.md). Its CSS fallback and semantic controls remain the baseline. A small-screen screenshot pass is not an owner art signoff.

## Physical-device measurement — awaiting hardware

On this workstation, `adb devices -l` returned no attached Android device; `xcrun devicectl` was unavailable. Neither finding is a device performance result. Use physical iPhone/iPad Safari and Android Chrome, and record the exact device class, OS/browser version, source/build revision, mode, viewport and DPR. Avoid storing device serials or any personal/product records. Use only a synthetic account/input fixture.

| Measurement | Procedure and required evidence | Acceptance boundary |
| --- | --- | --- |
| Cold and warm delivery | For S02, S10 and S05, record a cleared-cache first visit, same-page return and browser reload separately. Save sanitized request URLs, headers, cache state and encoded response bytes. | First activation target ≤900,000 additional bytes; mobile ceiling ≤1,200,000. Include renderer, loader, GLB, environment, fallback/layers. Whole page and scene totals are separate. Unavailable cross-origin fields remain UNKNOWN. |
| Interaction and main thread | Profile typing/submitting synthetic S04, S05 CTA activation and navigation during cold scene load, hidden recovery and fallback. Capture long tasks, decode, shader/upload work and input-to-paint observations. | No scene-owned blocking of DOM controls, focus or save/recovery. Record timings; no numeric device pass is inferred from local automation. |
| Active motion | Capture S05 clip frame intervals on a physical device, without a simultaneous recording workload unless recorded as a condition. | Candidate stable 30fps mobile during the bounded clip. Idle/hidden/offscreen must have no persistent scene RAF. |
| GPU and memory | Record baseline, peak during cold activation and retained residency after 10 S02/S10/S05/semantic-route cycles. Use supported Safari/Chrome profiling tools; label unavailable GPU fields. | At most one active scene renderer; none after leaving scene routes. No monotonic retained-resource growth. Absolute GPU/peak-memory headroom must be measured and reviewed; no invented threshold. |
| Accessibility | Use VoiceOver/TalkBack, keyboard or switch navigation, OS reduced motion, text scaling/browser zoom and 320px reflow. Repeat with all media blocked. | Heading/status reading order, actionable labels and save/recovery remain equal; no decorative focus target, duplicate confirmation or horizontal page overflow. |
| Cache and recovery | Repeat slow/failed GLB/chunk load, background during persistence/refresh/clip, route return, motion toggles and context loss where supported. | No duplicate S05 celebration, missed-event backlog, automatic write retry or failed-event media retry. Preserve truthful unknown/stale/conflict UI. |

Keep raw traces local if they contain unsanitized browser data. Commit only sanitized aggregate evidence with scope/unknowns stated. Do not label Playwright WebKit or software rendering as physical Safari/Android acceptance.

## Controlled web rollout and rollback — blocked by open gates

1. Retain the recorded S02/S10 owner art acceptance and automated S05 parity evidence, then close the physical-device gates on the exact candidate revision. Check CI on the final PR HEAD. Retain the existing Issue/branch/PR and draft status while any required gate is open.
2. Prepare and review a separately explicit production activation change. `VITE_SK7_SCENE_MODE=production` currently selects no new scene; setting the build variable alone cannot activate this candidate. Do not deploy `review` as a shortcut. Preserve the independent companion production setting.
3. After release authorization and passing gates, squash merge the verified PR into upstream `main`, following [deployment SSOT](deployment-ssot.md#deployment-flow). Record the complete upstream revision, current known-good Worker version, previous build variables and rollback target **at release time**; historical IDs in old documents are not current rollback evidence.
4. Run the existing `Sync deployment branch` workflow in `emotigom/ah-05-07-pages`. Let the existing Cloudflare source build publish the web-only change. Record mirror revision, build configuration and complete Worker version. No direct branch upload, mirror edit, API deployment or database migration belongs to this web-only release.
5. Run the existing public deployment smoke and signed-in synthetic browser checks on the deployed revision. Verify gated-on selected routes and a gated-off build. Confirm separate model output, measured blood pressure and challenge adherence facts and the wording `입력 기반 위험군 선별 신호`.
6. Rehearse restoration of the captured known-good web Worker and verify the synthetic save, fallback, navigation and public smoke again. A variable change requires a new Vite build; it cannot change already-built assets. Stop rollout on failed save semantics, repeated celebration, inaccessible controls, failed asset delivery or unaccepted device cost. Record activation, rollback and any final restore as separate observations.

This increment performs none of these production actions. Asset upload is separate from application activation. API/DB/auth/Model V2 contracts and existing GLB identities remain unchanged.
