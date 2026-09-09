# S05 confirmed-save review migration

Issue #390 · draft PR #391 · `codex/living-journey-hybrid`. This increment adds an S05 migration candidate behind **only** `VITE_SK7_SCENE_MODE=review`. The default/off/unknown/production scene gate stays closed. Existing `resolveProductionCompanion`, `CompanionRuntimeBoundary`, production renderer and `VITE_SK7_COMPANION_MODE` retain their independent contract. When both modes are configured, a confirmed S05 event has one review visual owner.

## Persistence and presentation ownership

The two existing S05 mutation paths—blood-pressure create/update and active-challenge check-in—issue an in-memory presentation opportunity only after their existing API promise succeeds and the session/request-generation guard passes. It receives no response object, values, status, record ID or account ID. A local serial exists only as a React remount key. Nothing is written to history, storage, logs or telemetry.

The App holds this opportunity through the existing window refresh. It presents it at the existing confirmed-save navigation point. Timeout, network/unknown outcome, malformed JSON and 409 do not create it. A window read cannot manufacture confirmation, even if a timed-out write later appears in the list. The existing explicit retry behavior is unchanged; a separately confirmed retry gets a fresh opportunity. This is presentation deduplication, not a new API exactly-once or write-idempotency guarantee.

The event's synchronous claim can succeed once. Route exit, hidden/offscreen state and reduced motion consume unused opportunities. App-level visibility and motion listeners also cover the interval between confirmed persistence and the end of the window refresh. Returning to a route, changing the viewport or lifting reduced motion cannot replay the event. Session replacement and the existing S05 exit CTAs clear it; page reload starts without a confirmed event. A successful save followed by a failed refresh retains the existing saved message and separate stale-data notice.

## Renderer and fallback

`SavedSceneBoundary` owns visibility, the 12-second readiness timeout and a failure latch carried by the event. Chunk, GLB, byte identity, WebGL and context failures use the existing CSS checkmark, semantic heading and CTAs. There is no second poster, announcement or API retry. Interrupted loading remains failed for that event, including return navigation. A new confirmed event may try again.

`SavedSceneRenderer` uses the existing registered bear-lite (`COMPANION-R2-001`, 518,636 bytes), existing camera/light/slot composition and `celebrate`/`idle` clips. It verifies exact bytes and SHA-256 before parsing. One successful raw GLB buffer is cached in memory across S05 visits. This fixed public asset cache contains no user data; parsed models, mixers and GPU resources are visit-owned. Pending fetches abort on exit; late parsed models are disposed. No asset revision, external service or dependency is added.

Visible normal-motion confirmation plays the approved celebration once, bounded by clip duration plus a 500ms timeout, then samples a neutral idle frame. Idle, hidden, offscreen and reduced-motion states have no perpetual RAF. Motion/visibility changes and resizing retain the renderer and model. DPR is capped at 1.25. Exit disposes geometry/materials/textures, uncaches the mixer root and explicitly releases the WebGL context.

The S02/S10 manifest remains 45 assets / 28 recipes. Their calendar recipes, capture inputs and all 42 published poster identities are unchanged. S05 intentionally uses the existing companion asset register and current S05 slot; it does not enter the calendar recipe selector or borrow a calendar poster. This parity increment does not claim a larger S05 composition or new art acceptance.

## Verification

Run from the repository root:

```sh
CI=1 npm --prefix web run test:e2e:saved-scene
CI=1 npm --prefix web run test:e2e:production:on
npm --prefix web run test:scene-manifest
```

The first command builds a production preview with the scene review gate and legacy companion production gate both set, checking exclusive ownership. It uses synthetic API fixtures and public R2 bear bytes. Tests cover confirmation versus pending persistence/refresh; timeout/unknown/409/invalid JSON and explicit retry; stale refresh recovery; new confirmed events; route remount/back/forward/reload; reduced motion and visibility before save, during loading, playback and refresh; asset/chunk/context/readiness failure; context disposal; keyboard access, small-screen bounds and CSS zoom reflow. The final full run passed 35/35 cases; [sanitized parity evidence](evidence/scene-s05-parity.json) pins the tested source hashes and results. Current CI and adjacent regressions belong in [implementation status](scene-implementation-status.md).

Automated Chromium with ANGLE SwiftShader establishes browser behavior only. Screenshots, draw-call counts or synthetic RAF observations do not establish physical Safari/Android GPU, memory, frame-rate, screen-reader or physical-device visual acceptance. The owner accepted the current S02/S10 art separately on 2026-09-10 KST. See [remaining release gates](scene-release-gates.md). PR remains draft; no merge, deployment or production activation is included.
