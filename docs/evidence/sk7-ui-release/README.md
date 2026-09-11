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

Reproduce from `web/`, with both preview commands running:

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
- Existing recipe, poster, manifest, GLB, camera and pinned review source identities
  are unchanged. The small static-only component uses the existing mapping without
  editing the hash-pinned VisualStage or upgrading review asset status. All 42 poster
  files remain unchanged; no poster recapture or new S05 asset was produced.
- S05 inherits the production renderer's camera/clip framing (including the tight
  top edge of the ears in these captures). The wrapper changes only placement and
  available display size. Camera/GLB adjustment and exact-device visual acceptance
  remain outside this candidate; no past device PASS is transferred to this layout.

Current test/CI results and the bounded R0 table belong in this Issue/Draft PR,
not a second SSOT. Physical devices, real network/cache, OS accessibility, full
GPU/peak-memory/performance acceptance, actual integration and release/rollback
execution remain unperformed. No merge, sync, upload, deployment, environment or
traffic change, or new realtime activation is authorized by these captures.
