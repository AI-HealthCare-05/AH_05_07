# Android scene measurement

This is the repeatable, bounded device probe for Issue #390 / draft PR #391. It uses the installed Playwright dependency and a connected Android Chrome target. It creates and closes one dedicated tab, uses synthetic API responses in that tab, and leaves other tabs, browser-wide cache, OS motion settings and accessibility services alone. No production API writes or deployment are involved.

## Run

Use an authorized Android device with USB debugging enabled, Chrome open and the screen unlocked. Keep it in the foreground during measurement. Build from the candidate revision:

```sh
VITE_API_BASE_URL=http://e2e.invalid VITE_SK7_E2E_MODE=1 VITE_SK7_SCENE_MODE=review VITE_SK7_COMPANION_MODE=production npm --prefix web run build
npm --prefix web run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

In another terminal, connect the device to this local preview and Chrome inspection endpoint, then choose a local output path:

```sh
adb reverse tcp:4173 tcp:4173
adb forward tcp:9222 localabstract:chrome_devtools_remote
node web/scripts/measure-scene-android.mjs /private/tmp/scene-android-probe.json
```

Review the JSON before copying it into `docs/evidence`. `completed: true` means the bounded probe completed its assertions. It is not release approval. Failures after page setup record their phase and synthetic-page state; connection/setup failures exit before creating evidence. Do not substitute a partial run for complete evidence. The output pins the source revision, probe hash and exact built files. Afterward, stop the preview and remove the two ADB mappings if they were created for this run.

The dedicated test document requests a Screen Wake Lock, released on navigation or tab closure. It does not change the phone's timeout or accessibility settings. Interruptions from other phone use invalidate an incomplete run; resume with a fresh dedicated tab when Chrome is available.

## Retaining-path comparison

Use `web/scripts/profile-scene-memory.mjs` for the memory investigation, separately from frame timing. Build `review` and `off` variants from the same source with `VITE_SK7_COMPANION_MODE=off`, into separate directories. Serve only the variant currently being measured on port 4173; leave the other build intact. The script expects the unlocked physical Android Chrome target and ADB mappings above.

```sh
VITE_API_BASE_URL=http://e2e.invalid VITE_SK7_E2E_MODE=1 VITE_SK7_SCENE_MODE=review VITE_SK7_COMPANION_MODE=off npm --prefix web run build -- --outDir /private/tmp/scene-memory-review
npm --prefix web run preview -- --outDir /private/tmp/scene-memory-review --host 127.0.0.1 --port 4173 --strictPort
```

In another terminal:

```sh
node web/scripts/profile-scene-memory.mjs review /private/tmp/scene-memory-review /private/tmp/scene-heap-review 30
node web/scripts/inspect-scene-heap.mjs /private/tmp/scene-heap-review/review-0.heapsnapshot /private/tmp/scene-heap-review/review-30.heapsnapshot /private/tmp/scene-heap-review/summary.json
```

Repeat with mode `off`, using separate build/output directories and restarting the preview. Use separate checkouts/builds when comparing revisions. The probe records five warmup cycles followed by 30 measured S02/S10/S05 cycles, forced-GC metrics at every semantic exit, and snapshots at measured cycles 0/10/30. Off mode waits 4.5 seconds in S05 to approximate clip duration; this is a resource-retention control, not a timing comparison. Browser warmup, JIT, history and the profiler can affect aggregate JS heap in both variants.

Source-file and built-file hashes identify an uncommitted candidate; build it from those sources before running. Verify the reported build is the one served. Raw snapshots have owner-only file permissions and must stay in a private local directory. The inspector emits class counts and at most 12 sanitized canvas paths, suppressing source/string values, page URLs and DOM attributes. Inspect the summary before committing it. A shortest non-weak retaining path is one route, not a dominator proof or GPU-memory measurement. Native canvases/contexts must be distinguished from their JavaScript prototypes.

## What the probe establishes

- S02/S10 realtime readiness and visible normal-motion S05 confirmation; one celebration on each new confirmed synthetic save and no replay on history return.
- Existing RAF callback intervals during ten S05 clips. There is no additional sampling RAF, video recording or full browser trace during these clips. The observer itself adds some measurement overhead; intervals measure callback scheduling, not hardware presentation or display FPS.
- No continuing RAF callbacks during a 500 ms idle sample. Context creation/loss events count live WebGL contexts, without retaining models or contexts in the probe. Frame and long-task samples are discarded after each semantic exit, before the heap observation.
- Ten S02 → semantic exit → S10 → semantic exit → S05 → semantic exit cycles. Target-scoped JS heap metrics are recorded after forced GC at each exit, including a warmed baseline. These values measure retained JavaScript heap, not isolated process PSS, peak memory or GPU memory. A stable retained heap does not establish absolute device headroom.
- Separate target-cache-disabled activation requests and ordinary warm requests. The browser's shared cache is never cleared. Only allowlisted scene URLs and non-sensitive cache/content headers are recorded, including the actual content encoding. CDP `encodedDataLength` may include protocol overhead. USB-local application delivery does not qualify whole-page Wi-Fi/cellular or production delivery.
- Browser-emulated reduced motion on the physical device. S02/S10 use posters; S05 consumes the event without a celebration. This does not establish OS reduced-motion behavior.

Navigation between cycle screens uses the App's existing history handler with the synthetic session's history state preserved. The form fields and exit buttons use browser input; save uses the button's Enter-key activation to avoid Android CDP mouse hit-testing errors while the software keyboard closes. This run does not add new touch-access evidence. All API responses are fixed synthetic fixtures, so this measures presentation behavior and resource lifetime rather than server latency or write idempotency.

## Remaining human/device checks

The probe cannot close Wi-Fi/cellular whole-page delivery, GPU/peak-process-memory, actual presented-frame, shader/decode attribution, TalkBack audible/Touch Explorer/switch input, or physical Safari gates. It does not alter system settings to manufacture OS accessibility evidence. Follow [release gates](scene-release-gates.md) for these checks and owner S05 acceptance. Keep the PR draft and the production scene gate closed while required acceptance is incomplete.
