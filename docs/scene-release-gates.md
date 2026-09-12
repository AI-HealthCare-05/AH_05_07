# Living Journey review and release gates

Continuation of Issue #390 / PR #391. Implementation authorization is recorded in [architecture](scene-architecture.md); it does not satisfy physical-device measurements. Current results and completed owner visual acceptance are in [implementation status](scene-implementation-status.md). This checklist prepares the remaining production work; no production gate is opened by this document.

## CURRENT QUALIFICATION — Verification Policy v0.2 (2026-09-13)

This classification is based on upstream `main`
`6abee8f7842fef9f9d2eea83ce7bbfe4a0ad4d16` (PR #465). That SHA is the
classification baseline, not a claim that older device evidence was rerun on it.
Evidence below remains valid only for its recorded revision, environment and
scope. A measurable value is not a release gate unless its failure presents a
realistic risk to user function, correctness, storage meaning, accessibility or
recovery.

### REQUIRED before production scene activation

1. Use a separately explicit, approved activation Issue and PR. Resolve the
   current upstream `main`, identify the exact activation candidate and keep
   `review` out of production. Verify that the intended production-mode mapping
   activates only S02/S10 and the confirmed-save S05 path, while the independent
   companion setting and gated-off behavior remain correct.
2. Pass the repository's required `lint` and `test` CI on the final activation
   PR HEAD and the existing checks directly affected by the
   activation/configuration diff. This classification creates no new test
   requirement and does not require a broad browser matrix by default.
3. On the final candidate, protect the core scene contract: confirmed persistence
   can produce S05 once without replay or automatic write retry; save/recovery and
   navigation remain usable; and GLB, chunk or WebGL failure leaves semantic
   HTML/CSS content and controls available. Existing evidence may be reused while
   those boundaries are unchanged; a changed boundary needs a directly affected
   check.
4. Follow the [deployment flow](deployment-ssot.md#deployment-flow): confirm the
   activation build configuration and single-Worker topology, record exact source,
   mirror and served Worker identities, run public deployment smoke plus the
   signed-in synthetic affected flow, and capture a distinct current known-good
   rollback target. Stop or restore on failed core semantics, inaccessible
   controls or failed fallback, and verify rollback/restore capability.

### CONDITIONAL verification

Require only the item tied to a changed boundary or an observed problem:

- A representative physical-browser/device spot-check when renderer, media,
  motion, viewport, input or semantic interaction behavior changes, or when a
  device-specific failure is observed. Physical iPhone Safari is not inferred
  from Simulator evidence, but lack of a physical iPhone does not indefinitely
  block an otherwise unchanged candidate with a verified semantic fallback.
- VoiceOver, TalkBack audible/touch exploration, switch access, OS reduced motion
  or large text when the activation change directly affects the corresponding
  semantic, focus, input, motion or reflow boundary, or an accessibility problem
  is observed. Test the affected representative condition; an exhaustive
  assistive-technology combination matrix is not routine.
- Absolute GPU/peak memory, retaining-path or presented-frame measurement when
  rendering/resource ownership changes, or crashes, context exhaustion,
  monotonic retained-resource growth, OS termination, visible jank or animation
  failure are observed. Numeric presented FPS and absolute GPU usage are not goals
  by themselves.
- Production-equivalent network/cache checks when chunking, CDN/R2 rules, asset
  identity, cache behavior or recovery code changes, or a delivery failure is
  observed. Wi-Fi and cellular are not automatically two separate blockers.
- Broad browser matrices, 30-cycle probes and poster recaptures only when their
  renderer/resource/art boundary changes. Reuse the exact unchanged evidence
  otherwise.

### DEFERRED / OBSERVATIONAL

- Absolute GPU usage and peak-memory headroom, exact presented FPS, attribution
  of the remaining aggregate JS-heap delta and long-task optimization remain
  useful research. No current evidence shows a crash, context exhaustion,
  monotonic retained native-resource growth or user-visible animation failure;
  the bounded native-resource retention defect was fixed and verified in its
  recorded scope.
- Separate Wi-Fi and cellular runs, a physical-iPhone Safari confidence pass, and
  the full audible/touch/switch accessibility combination remain worthwhile
  observations when available, not unconditional activation blockers.
- Physical proof of PR #462's one-shot stale-chunk recovery is opportunistic at a
  future real cross-deployment. Fresh-load Samsung Internet passed; the former
  R2/CORS/WebGL hypotheses stay expired. Promote this proof only if recovery code
  or deployment cache behavior changes, or the incident recurs.
- Repeating unchanged broad matrices/30-cycle probes or all poster captures, and
  refining the accepted S05 initial placement, do not block activation.

Issue #390 has completed its review-candidate qualification role. Production
activation is protected work and needs its own explicit approval record; it must
not inherit every historical measurement below as a permanent gate. After this
classification is merged, the recommendation is **CLOSE NOW** for Issue #390 and
track only the four REQUIRED activation gates in that separate record.

> **Historical reference notice:** The dated measurements and earlier checklist
> below are retained without upgrading their old `OPEN`, `required` or `blocked`
> wording into current gates. Where they conflict, CURRENT QUALIFICATION above
> governs. Do not rerun them unless a CONDITIONAL trigger applies.

## Samsung Internet qualification update — 2026-09-12–13

Samsung Internet fresh-load S05 is now **PASS** after a refresh restored the bear
and the production bundle was confirmed to contain PR #462's recovery marker. The
incident was deployment version skew: an old entry bundle requested a removed Vite
hashed dynamic chunk, and the SPA fallback returned `index.html` as `text/html`, so
the import failed. GLB fetch, CORS, WebGL2, and the R2/CDN GLB cache rule were
healthy and are expired cause hypotheses.

PR #462 added a one-shot `vite:preloadError` reload recovery; PR #463 aligned the
test contract without changing product behavior. S02/S10 fall back after a second
chunk failure and do not reload indefinitely. An S05 reload does not recreate the
transient save presentation and returns to S02. Physical proof that a future real
cross-deployment skew recovers automatically remains **OPEN**. This result does not
create a new physical Safari pass or close the accessibility, GPU, memory, network,
or other device gates below; [remaining device checks](scene-remaining-device-checks.md)
own those evidence details.

## Review-candidate merge scope — 2026-09-10

After the S05 final visual approval, the user requested merging PR #391. The approved scope is a squash merge of the review candidate after the final commit's required CI and unresolved-review checks pass. The new S02/S10/S05 scenes remain restricted to `VITE_SK7_SCENE_MODE=review`; missing/off/unknown/production modes do not activate them. The shared S04 control-font correction is included. Remaining device measurements below are retained as production-activation conditions. This merge request supersedes the earlier draft/no-merge checkpoint; it does not authorize a deployment-mirror sync, runtime rollout or a scene gate change.

## Owner visual review — S02/S10 and current S05 candidate accepted

Review all seven weekdays on S02 and S10, separately at 320, 390 and 1366 CSS px. Use the matching original WebPs in [S02 posters](../web/public/scene-review/s02/v1/) and [S10 posters](../web/public/scene-review/s10/v1/), with the exact file/camera/source mapping in [S02 evidence](evidence/scene-clay-posters.json) and [S10 evidence](evidence/scene-diorama-posters.json). Compare realtime and fallback in the review build, plus 320×568 and intermediate widths 350/351/580/581/768.

For each screen/profile record accepted or changes requested, reviewed source revision, weekday(s), and the concrete reason. Review the bear's face/ears/silhouette, focal landmark hierarchy, neutral composition, clay geometry and palette, and whether any background implies a health or participation outcome. S10 must show today's scenery even while browsing the prior record window. Sunday/Monday must not read as a completion/reset reward. **Owner decision recorded 2026-09-10 KST:** “현재 S02·S10 아트 승인”. This accepts the current S02/S10 art at source commit `37eec04a11a6c51ff728eddd059cc9d1c0b59dc1`, with the unchanged 42 poster identities in the linked evidence. It does not approve future recaptures, physical-device cost, S05 migration release or production activation.

S05 now has a behavior migration candidate using its existing composition; see [S05 migration](scene-s05-migration.md). Its CSS fallback and semantic controls remain the baseline. A small-screen screenshot pass is not an owner art signoff.

**S05 owner decision recorded 2026-09-10 KST:** after the smartphone HTTPS review, the user explicitly gave final approval of the current position-fix candidate. The exact [user decision](evidence/scene-phone-user-check.json) accepts a slightly awkward initial animation position and defers its refinement until after this PR. The reviewed candidate's source/build identities are pinned by [HTTPS evidence](evidence/scene-phone-review-https-smoke.json). This closes current S05 owner visual acceptance; the deferred polish does not hold that acceptance open.

## Physical-device measurement — Android partial, iOS Simulator evidence

Android Chrome is now observed on a Samsung SM-A528N / Android 14 / Chrome 152.0.7977.82 in portrait at 384 × 718 CSS px and DPR 2.8125. The exact sanitized results are in [Android evidence](evidence/scene-android-chrome-sm-a528n.json): S02/S10 reached the realtime renderer without horizontal overflow; cache-disabled selected activation requests were 702,216 and 702,702 bytes; R2 GLB/poster responses used disk cache on ordinary revisits; ten S02/S10-to-semantic cycles left no live renderer/context after exit. A synthetic S04 value saved through Android touch input reached S05, celebrated once, settled idle, and did not replay on history return. Samsung TalkBack 14.5.00.14 was also bound: keyboard focus moved from the S02/S05 headings to their actions without selecting decorative scenes, and S10 exposed its period control, record lanes and refresh action in semantic order. The service was then removed and the prior disabled state restored. This focus-order evidence does not establish audible output or Touch Explorer swipe behavior. The original render/cache source revision is `6ccf515206e2c6228db26db34386751c94c1f64a`; the TalkBack focus inspection ran at `665e19ba41564bc5f8f2ea88e4e706b9ddfe0183`.

The [repeatable Android probe](scene-device-probe.md) now adds ten full S02/S10/S05 cycles, measured S05 RAF intervals, zero idle RAF callbacks, zero contexts after exit, history-return non-repeat and browser-emulated reduced motion at application source `b53ad4e83f32c2cbfdf63c053a75249c30733608`; see [performance evidence](evidence/scene-android-performance.json). This records real Adreno rendering and callback scheduling, not presented-frame/GPU/peak-memory acceptance. Aggregate retained JS heap and node counts increased despite clearing probe samples and removing retained WebGL references. Attribute this growth using retaining-path analysis before accepting the no-growth gate; it is neither a confirmed application leak nor a memory pass. The script uses keyboard activation for synthetic save and does not add touch-access or audible-screen-reader acceptance.

The user reported an iPhone 17 / iOS 26.5 **Simulator** VoiceOver pass for S02, S10, and S05; the exact sanitized scope is in [iPhone VoiceOver evidence](evidence/scene-ios-voiceover-user-check.json). Headings, controls, and the S05 non-repeat behavior passed, while decorative scenes did not receive focus. The browser/version and Web Inspector renderer state were not captured, and the shown S02/S10 visual was reported as not appearing full 3D. The user explicitly corrected the device provenance to the same Simulator on 2026-09-10. This records Simulator semantic/fallback accessibility only; it does not establish physical Safari or realtime-3D acceptance.

The later [memory investigation](scene-memory-investigation.md) supersedes the un-attributed canvas-growth question: Three's module-global DFG LUT retained 90 additional lost native contexts/canvases across 30 review cycles, while the off control retained none. The review renderers now dispose that LUT before discarding renderer properties. Mac Chromium's new garbage-collection regression and full 36-case S05 suite pass. The corrected Android build at `0f35db18b1f0ffdce5ff76b199380b4b3ee68642` subsequently completed five warmup plus 30 measured cycles: all exits had zero live contexts/canvases, and all three 0/10/30 snapshots had zero native canvas/WebGL objects. DOM nodes/documents/event listeners stayed at 146/1/189. The earlier interrupted run stays marked incomplete; the new complete run passes the bounded retained-scene-resource check. JS heap increased by 488,276 bytes, so aggregate JS growth and absolute GPU/peak-memory acceptance remain open. Recapturing all 42 posters produced identical poster records, preserving the existing art identities without recording a new owner decision.

Android evidence is USB-local-preview evidence, not Wi-Fi/cellular acceptance. Chrome's application PSS could not isolate this page from the user's other browser tabs, and GPU/peak-memory/frame-rate values remain unknown. TalkBack was disabled before and restored disabled after the bounded focus-order inspection; the system animation scales were unchanged. `xcrun devicectl` remains unavailable. Avoid storing device serials or any personal/product records; use only a synthetic account/input fixture.

The [post-fix presentation probe](evidence/scene-android-performance-after-fix.json) completed ten additional cycles on the corrected source with legacy companion production mode enabled. It revalidated S05 one-shot/non-repeat, zero idle RAF, zero exited live contexts and browser-emulated reduced motion. Including the disposal chunk, selected cold response bytes were 702,441 / 704,431 / 687,833 for S02/S10/S05. RAF p95 was about 16.7 ms, with a 16.9 ms maximum; this is not presented FPS. Activation long tasks reached 153/129/76 ms and remain unattributed. Aggregate JS heap still grew while DOM nodes stayed fixed. This does not close the remaining interaction, total-memory or network-delivery gates below.

| Measurement | Procedure and required evidence | Acceptance boundary |
| --- | --- | --- |
| Cold and warm delivery | For S02, S10 and S05, record a cleared-cache first visit, same-page return and browser reload separately. Save sanitized request URLs, headers, cache state and encoded response bytes. | First activation target ≤900,000 additional bytes; mobile ceiling ≤1,200,000. Include renderer, loader, GLB, environment, fallback/layers. Whole page and scene totals are separate. Unavailable cross-origin fields remain UNKNOWN. |
| Interaction and main thread | Profile typing/submitting synthetic S04, S05 CTA activation and navigation during cold scene load, hidden recovery and fallback. Capture long tasks, decode, shader/upload work and input-to-paint observations. | No scene-owned blocking of DOM controls, focus or save/recovery. Record timings; no numeric device pass is inferred from local automation. |
| Active motion | Capture S05 clip frame intervals on a physical device, without a simultaneous recording workload unless recorded as a condition. | Candidate stable 30fps mobile during the bounded clip. Idle/hidden/offscreen must have no persistent scene RAF. |
| GPU and memory | Record baseline, peak during cold activation and retained residency after 10 S02/S10/S05/semantic-route cycles. Use supported Safari/Chrome profiling tools; label unavailable GPU fields. | At most one active scene renderer; none after leaving scene routes. No monotonic retained-resource growth. Absolute GPU/peak-memory headroom must be measured and reviewed; no invented threshold. |
| Accessibility | Use VoiceOver/TalkBack, keyboard or switch navigation, OS reduced motion, text scaling/browser zoom and 320px reflow. Repeat with all media blocked. | Heading/status reading order, actionable labels and save/recovery remain equal; no decorative focus target, duplicate confirmation or horizontal page overflow. |
| Cache and recovery | Repeat slow/failed GLB/chunk load, background during persistence/refresh/clip, route return, motion toggles and context loss where supported. | No duplicate S05 celebration, missed-event backlog, automatic write retry or failed-event media retry. Preserve truthful unknown/stale/conflict UI. |

The [remaining-device continuation](scene-remaining-device-checks.md) now records offline JS/native heap accounting and Simulator Safari realtime rendering. It also records the user-requested S05 position correction and five targeted local browser checks. These do not close physical iPhone, Android input-latency, OS accessibility or real-network gates. The modified S05 composition has received the owner acceptance recorded above; S02/S10's existing art acceptance remains unchanged.

Keep raw traces local if they contain unsanitized browser data. Commit only sanitized aggregate evidence with scope/unknowns stated. Do not label Playwright WebKit or software rendering as physical Safari/Android acceptance.

After the smartphone HTTPS links were provided, the user reported “모두 정상 작동입니다!” on 2026-09-10 and subsequently gave final S05 visual approval. The [manual user report](evidence/scene-phone-user-check.json) records both decisions and the deferred placement polish. Device/browser identification and individual accessibility/network conditions have not been supplied. This report adds manual feedback without converting unmeasured device costs or the preview's no-store/same-origin GLB delivery into production acceptance. No Android repeat or CI check was rerun for this documentation update.

## Historical controlled web rollout and rollback checklist

1. Retain the recorded S02/S10 and S05 owner art acceptance and automated S05 parity evidence, then close the physical-device gates on the exact activation candidate revision. The review-only implementation may merge under the separate scope above; a later production-activation PR remains draft while its required release gates are open. Verify CI on each final PR HEAD.
2. Prepare and review a separately explicit production activation change. `VITE_SK7_SCENE_MODE=production` currently selects no new scene; setting the build variable alone cannot activate this candidate. Do not deploy `review` as a shortcut. Preserve the independent companion production setting.
3. After release authorization and passing gates, squash merge the verified PR into upstream `main`, following [deployment SSOT](deployment-ssot.md#deployment-flow). Record the complete upstream revision, current known-good Worker version, previous build variables and rollback target **at release time**; historical IDs in old documents are not current rollback evidence.
4. Run the existing `Sync deployment branch` workflow in `emotigom/ah-05-07-pages`. Let the existing Cloudflare source build publish the web-only change. Record mirror revision, build configuration and complete Worker version. No direct branch upload, mirror edit, API deployment or database migration belongs to this web-only release.
5. Run the existing public deployment smoke and signed-in synthetic browser checks on the deployed revision. Verify gated-on selected routes and a gated-off build. Confirm separate model output, measured blood pressure and challenge adherence facts and the wording `입력 기반 위험군 선별 신호`.
6. Rehearse restoration of the captured known-good web Worker and verify the synthetic save, fallback, navigation and public smoke again. A variable change requires a new Vite build; it cannot change already-built assets. Stop rollout on failed save semantics, repeated celebration, inaccessible controls, failed asset delivery or unaccepted device cost. Record activation, rollback and any final restore as separate observations.

The review-candidate merge performs none of these production actions. Asset upload is separate from application activation. API/DB/auth/Model V2 contracts and existing GLB identities remain unchanged.
