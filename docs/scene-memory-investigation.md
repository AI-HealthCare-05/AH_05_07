# Scene renderer retention investigation — 2026-09-10

Issue #390 / draft PR #391. The host is macOS; the physical target is Samsung SM-A528N, Android 14, Chrome 152. This follows the increasing DOM-node count in the earlier [Android performance probe](evidence/scene-android-performance.json). All API responses and form inputs are synthetic. The device probe creates and closes its own Chrome tab, with companion mode off in both control builds.

## Finding and fix

At source `2c9185fddaecc57066a9c8529b9b91c8fbeae489`, five warmup S02/S10/S05 cycles left 15 native canvases and 15 native WebGL2 contexts reachable after forced GC. Thirty further cycles left 105 of each: one additional retained canvas/context per scene visit. DOM canvases and live contexts were zero at every semantic exit, so those earlier checks missed retained, lost contexts. The off control retained zero native canvases and kept its DOM-node count at 141 throughout all 30 cycles.

The review heap's shortest non-weak retaining paths led from a Three module's singleton DFG LUT through its source/texture state to native WebGL textures, contexts and detached canvases. The singleton also held 105 texture-dispose listeners after 105 renderer visits. In pinned Three 0.185.1, `WebGLRenderer.dispose()` discards its properties but does not dispose this module-global LUT. It is not one of the ordinary texture maps found by traversing materials.

The shared `disposeScene` helper obtains the actual compiled `dfgLUT` uniform from the renderer's material properties and disposes the texture before material/renderer properties are discarded. S02/S10 and the S05 review renderer now use it on final teardown. Geometry, materials, ordinary textures and skeletons are deduplicated before disposal. Responsive S10 environment replacement disposes only that environment's own resources. The existing production companion implementation is unchanged.

This workaround depends on the pinned renderer's internal uniform layout. The browser regression checks actual garbage collection using weak canvas references and CDP forced GC across repeat S02/S10/S05 visits; context loss alone is insufficient. Re-run it when upgrading Three. `Texture.dispose()` also invalidates any other renderer's copy of the shared LUT, which Three can re-upload on its next draw. Current selected scene ownership permits at most one scene renderer. A future simultaneous-renderer design requires separate review.

## Visual identity

All 42 S02/S10 posters were recaptured after this lifecycle change. Their complete poster records—including SHA-256, dimensions, projected bounds, draw calls and triangle counts—are identical to the prior approved captures. Only capture source hashes changed to identify the modified renderer and new disposal helper. No GLB, camera, light, geometry, palette, poster binary, public object or production gate changed. Existing owner acceptance remains scoped to the unchanged art identities.

The first CI run exposed a Windows checkout issue: the new helper lacked the existing `eol=lf` rule. A local `core.autocrlf=true` checkout reproduced a hash mismatch only for that file. Adding its `.gitattributes` entry made all nine S10/shared capture source hashes identical in the same checkout simulation. The source bytes and poster identities did not change.

## Recorded results

The [sanitized evidence](evidence/scene-android-memory.json) pins each build/probe and the candidate source hashes. Both controls and the corrected build at `0f35db18b1f0ffdce5ff76b199380b4b3ee68642` completed five warmup plus 30 measured cycles. The earlier interrupted candidate attempt remains in the evidence as incomplete; the new run supplies the complete physical result.

| Run | Post-GC DOM nodes | Native canvases in heap snapshots | Post-GC JS heap bytes |
| --- | --- | --- | --- |
| Before fix, review, 30 cycles | 160 → 250 | 15 → 105 | 7,365,464 → 8,555,832 |
| Off control, 30 cycles | 141 → 141 | 0 → 0 | 3,240,524 → 3,591,652 |
| Fixed candidate, complete 30 cycles | 146 → 146 | 0 at cycles 0, 10 and 30 | 7,201,840 → 7,690,116 |

The corrected physical run created 105 contexts across 105 scene visits, with zero live contexts and zero DOM canvases at every sampled semantic exit. Native canvases and native WebGL objects were absent from all three heap snapshots. All 31 exit samples kept one document, 146 DOM nodes and 189 event listeners. The previously attributed DFG LUT retention did not recur. This closes the bounded scene-resource retention check. The separate Mac Chromium suite passed 36/36, including the three-cycle S02/S10/S05 forced-GC regression.

Aggregate JS heap increased by 488,276 bytes. Snapshot comparisons also show growth in browser performance-timing records, including long-frame, long-task, resource and layout-shift entries; that observation does not fully attribute the aggregate. Full application-memory stability and absolute GPU/peak-process memory acceptance therefore remain open.

## Post-fix presentation and delivery check

The same application source also completed the [ten-cycle presentation probe](evidence/scene-android-performance-after-fix.json), separately from heap snapshots, with scene review and legacy companion production modes enabled. Each new S05 confirmation celebrated once, history return did not replay, every idle sample had zero RAF callbacks, and every exit had zero live contexts. Browser-emulated reduced motion selected calendar posters and consumed S05 without celebration. All ten clips had p95 RAF intervals of approximately 16.7 ms; the maximum observed interval was approximately 16.9 ms. These are callback intervals, not measured presented FPS.

Cache-disabled selected response totals, including the new disposal chunk, were S02 **702,441**, S10 **704,431** and S05 **687,833** bytes. The disposal chunk contributed 887 CDP encoded bytes per cold activation, including protocol overhead. This remains USB-local selected-resource delivery, not whole-page Wi-Fi/cellular qualification. Activation long tasks reached 153 ms on S02, 129 ms on S10 and 76 ms on S05; shader/decode/input impact is not attributed. This separate probe's DOM-node counter stayed at 579, while aggregate JS heap rose 13,049,080 → 14,219,972 bytes. Its different warmup/instrumentation prevents treating those heap values as the 30-cycle profile's continuation.

## Measurement limits

Raw heap snapshots stay in private local temporary files with owner-only permissions. Shared evidence contains sanitized counts, hashes and a representative retaining path; no browser history values, page source, record content or device serials. A shortest non-weak path identifies a retaining route, not a dominator or GPU-byte measurement.

Aggregate retained JavaScript heap includes JIT, navigation history, application state and profiler overhead. The off control also grew in JS heap while retaining no native canvases. Removing the attributed renderer retention does not establish absolute GPU/process-memory headroom, frame presentation, all application memory behavior or release approval. Phone interruptions invalidate incomplete runs. Follow the [probe procedure](scene-device-probe.md) and [remaining release gates](scene-release-gates.md).
