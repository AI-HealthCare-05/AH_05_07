# SK7 UI release-boundary candidate — #406

Base: `cd6f2ad8481562fa2a4e91846f49d2a89adc7e46`. Candidate identity is the
linked Draft PR HEAD; this evidence does not approve production activation.
The build contract and runnable previews are in [web README](../../../web/README.md#journey-ui-candidate--issue-406).

## Captures

All `synthetic-*` images are actual Chromium app captures using the existing
E2E session and a tab-memory fixture. Only synthetic values are shown.
`UI=journey`, `SCENE=off`, `COMPANION=production`; S05 uses the existing
production renderer with software WebGL. S02/S10 use existing WebP posters.
The failed-media capture deliberately has no character. A normal-build login
capture is labeled `normal-*`; it has no injected session or API fixture.
No capture is actual auth/API/DB integration or physical-device evidence.

| Screen | 390 | Focused bounds |
| --- | --- | --- |
| S02 | [Today](synthetic-S02-390.png) | [320](synthetic-S02-320.png), [1366](synthetic-S02-1366.png) |
| S04 | [Entry](synthetic-S04-390.png) | Tested keyboard/reflow separately |
| S05 | [Existing companion](synthetic-S05-companion-390.png), [failed media](synthetic-S05-failed-media-390.png) | [320](synthetic-S05-companion-320.png), [1366](synthetic-S05-companion-1366.png) |
| S10 | [Recap](synthetic-S10-390.png) | [1366](synthetic-S10-1366.png) |

[Normal build login boundary](normal-login-390.png). [Capture identities](capture-provenance.json) pin source files, build entries and images.

The S05 framing refresh replaces only the three companion captures above and
adds the focused states below. The other eight original captures retain their
`a5921a1a0e52ff4a7ae34a76cc9c123b98990737` source/build identity in provenance.

| S05 state | 320×568 | 390×844 | 1366×768 |
| --- | --- | --- | --- |
| Neutral / reduced motion | [320](synthetic-S05-companion-neutral-320.png) | [390](synthetic-S05-companion-neutral-390.png) | [1366](synthetic-S05-companion-neutral-1366.png) |
| Celebrate near maximum ear height | [320](synthetic-S05-companion-celebrate-320.png) | [390](synthetic-S05-companion-celebrate-390.png) | [1366](synthetic-S05-companion-celebrate-1366.png) |
| Idle | [320](synthetic-S05-companion-320.png) | [390](synthetic-S05-companion-390.png) | [1366](synthetic-S05-companion-1366.png) |

[320×568 after keyboard scrolling](synthetic-S05-actions-scrolled-320.png)
shows both completion buttons above the fixed navigation. Full-page 320 captures
start at scroll zero, so the fixed navigation overlays content in that snapshot.
Both buttons pass keyboard focus, full viewport visibility, center-point hit
testing and activation checks after scrolling; no action/navigation CSS changed.

Reproduce only the S05 refresh from `web/`, with the static preview running:

```bash
node scripts/capture-ui-candidate.mjs ../docs/evidence/sk7-ui-release --saved-only
```

The capture probe preserves the WebGL buffer for pixel inspection and pauses the
test RAF near one second into each animated clip. It is outside the app build;
runtime playback is unchanged. The E2E framing check separately samples all 239
RAF-rendered celebrate frames plus 241 idle frames (one complete four-second
cycle); screenshots alone are not the complete motion check.

Original full capture command (both previews; not rerun for the S05 refresh):

```bash
node scripts/capture-ui-candidate.mjs ../docs/evidence/sk7-ui-release --normal
```

## Evidence boundaries

- Synthetic suites cover the production/off companion, confirmed save, pending,
  failure, duplicate, unknown write, history/reload/token refresh, DOM/RAF cleanup,
  reduced motion, media failure, keyboard and 320/390/1366 reflow. S10 tests retain
  separate facts, current/prior dates, prior export guidance/disabled actions,
  stale records, details/export and late-response/session guards. S11 tests retain
  transient input/result and no numeric output.
- The normal build explicitly clears all three E2E/evidence variables, uses only
  nonfunctional public test config, rejects fixture/query/session-event bypasses,
  and excludes test authentication/injection code. Its positive auth/UI/S11 test
  uses synthetic browser storage and intercepted API responses. Truly empty data
  still reaches S12. S01/S12 are unchanged, not a new complete redesign.
- Seven separately built flag combinations test unset, journey, legacy and invalid
  UI selection, independent review/production scene policies, URL/storage rejection.
  Pure policy tests cover the full flag matrix including empty/null values.
- S02/S10 static observations: zero WebGL context attempts, canvas, RAF, GLB requests
  and realtime renderer requests. Build output may still contain lazy renderer chunks.
  S05 production uses WebGL and its existing animated idle. Exit checks cover removal
  of DOM canvas and cessation of RAF; native/GPU memory acceptance is not asserted.
- Existing recipe, poster, manifest, GLB, default legacy/review camera and pinned
  review scene source identities are unchanged. The small static-only component uses the existing mapping without
  editing the hash-pinned VisualStage or upgrading review asset status. All 42 poster
  files remain unchanged; no poster recapture or new S05 asset was produced.
- The original S05 ear cutoff was inside the camera, not the parent CSS clip:
  neutral canvas alpha touched the top row at 46 pixels for 320/390 and 54 for
  1366; making the parent overflow visible did not change those bounds. Full
  celebrate also extended beyond the camera's horizontal bounds.
- Only inline journey S05 opts into `framing="journey-s05"`: vertical FOV 34°,
  target y=0.85, with a 192px-wide canvas instead of 160px. The wider canvas keeps
  room for outstretched hands while limiting character shrinkage. Default camera
  FOV 28°, position and target y=0.8 remain intact. Landscape height, actions,
  GLB normalization, clips, gates and save/session lifecycle are unchanged.
- At device scale 1, the complete sampled motion has minimum top/bottom margins
  of 6/13px for 320/390 and 7/15px for 1366. Minimum horizontal margins are 28px
  and 15px respectively. No painted alpha pixels cross the rounded parent clip;
  the character fills at least 83% of canvas height. Neutral also has clear
  margins. These are local Chromium/software WebGL results; no past physical
  device result is transferred to the refreshed candidate.

Current test/CI results and the bounded R0 table belong in this Issue/Draft PR,
not a second SSOT. Physical devices, real network/cache, OS accessibility, full
GPU/peak-memory/performance acceptance, actual integration and release/rollback
execution remain unperformed. No merge, sync, upload, deployment, environment or
traffic change, or new realtime activation is authorized by these captures.
