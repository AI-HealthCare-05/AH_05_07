# SK7 Living Companion Platform — North Star Architecture

Status: architecture candidate; no production behavior or deployment authorization
Baseline: `9e0fe2ba9434b6762167dbc349ed29860e6196f3` (resolved from actual `origin/main` when the Phase 0 branch is created)
Program name: **SK7 Transcend**
Platform name: **SK7 Living Companion Platform**

## 1. Purpose

This is not `Companion Runtime v2` and not a larger version of the current
`.companion-runtime-slot`.

The target is a product platform in which one companion can have a persistent
identity across the SK7 journey, occupy a spatial layer that is independent of
screen-local boxes, accept direct manipulation, respond to explicitly enabled
device and camera perception, select deterministic behaviors under competing
inputs, and optionally speak — while the semantic SK7 application continues to
work when every companion capability is unavailable.

The platform includes runtime ownership, spatial contracts, perception,
behavior arbitration, rendering adapters, dialogue adapters, capability
adaptation, authoring/qualification, deterministic replay, performance/privacy
evidence, migration and rollback contracts.

## 2. Non-negotiable invariants

Transcend may replace historical implementation restrictions. It must not erase
actual product and safety boundaries.

The following remain authoritative unless separately versioned and reviewed:

- immutable companion asset identity and current checked-in production activation authority;
- candidate inventory, historical Learning Record evidence, `retain`, `ownerApproval`, and recorded `productionActivation` are not current runtime activation authority;
- Model V2, API, DB, Auth and RLS semantics are outside companion behavior authority;
- health values, risk labels and Model V2 outputs do not become implicit emotional or medical animation/dialogue inputs;
- semantic HTML, forms, navigation and core SK7 tasks remain usable when 3D, WebGL, sensors, camera, perception or dialogue fail;
- camera, microphone and motion sensing are explicit opt-in capabilities and can be stopped independently;
- raw camera/microphone data and landmarks are local/ephemeral by default and are not uploaded or persisted by default;
- reduced-motion, forced-colors and non-drag alternatives are first-class behavior, not post-release patches;
- one actor channel has one active writer/lease at a time;
- human merge remains the final gate; this architecture does not authorize deploy.

## 3. Current-source diagnosis

The current product already contains useful pieces, but ownership is fragmented.

### Legacy companion path

`CompanionRuntimeBoundary` selects an asset and derives screen-specific tactile
and attention behavior, then lazy-loads `CompanionReviewRenderer`. The renderer
owns WebGL renderer creation, GLTF loading, mixer/actions, resize, RAF, tactile
input, look behavior and teardown inside one React effect.

`companionInteraction.ts` derives pointer coordinates and head/body/feet zones
from the canvas rectangle, listens on the parent slot, and constrains the 3D
object around a local home position. That is valid for tactile deformation but
is the wrong long-term world model for moving an actor around the application.

### Scene paths

`SceneShell` chooses between saved-scene and legacy companion ownership, with a
special inline S05 path. `VisualStage` separately owns S02/S10 full-scene
rendering with visibility activation and static fallback. Therefore the current
product is not one small-canvas implementation; it is multiple rendering and
lifecycle paths without one shared logical presence model.

### Layout/test coupling

The default `.companion-runtime-slot` is a small absolute box and S05 has a
larger special-case layout. Several browser tests must wait for remote GLB /
WebGL readiness before they can assert unrelated layout geometry. Long-term
geometry and behavior tests should not require the remote delivery path unless
they are explicitly integration tests.

## 4. North Star architecture

```text
SK7 semantic application
(route / forms / save / reports / auth / accessibility)
                    |
             Companion Host Bridge
                    |
        +-----------+------------+
        | Living Presence Kernel |
        +-----------+------------+
          |       |        |
       Spatial  Behavior  Lifecycle
       Service   Director  / session epochs
          ^       ^        ^
          |       |        |
Pointer/Touch ----+        |
Motion sensors ---+--> Observation Bus
Camera session --> Perception Worker
Keyboard/voice --> Dialogue Input Adapter
                  |
             Intent proposals
                  |
         Policy + Arbitration Gate
                  |
        Authorized Action Plan
          |          |          |
       Root move   Pose/gaze  Dialogue
          |          |          |
          +----- Embodiment ----+
                    |
        Renderer / Scene adapters

Cross-cutting:
asset authorization / consent / accessibility / cancellation /
capability governor / performance budgets / evidence + replay
```

The boxes above are responsibility boundaries. They do not imply microservices
or one process per module. Initial deployment should remain client-side inside
the current web app, with a dedicated perception worker only where measurement
justifies it.

## 5. Presence Kernel

The Presence Kernel owns logical identity and session continuity, not WebGL.

Minimum state:

```ts
type CompanionPresence = {
  sessionEpoch: number;
  actorId: string;
  assetId: string;               // resolved only through authorized membership
  routeEpoch: number;
  mode: "quiet" | "companion" | "play";
  lifecycle: "suspended" | "present" | "transitioning";
  worldPose: WorldPose;
  activeLeases: ActionLeaseSet;
};
```

Logout/account boundaries invalidate the entire session epoch. Route change
invalidates route-owned anchors/obstacles but does not automatically destroy the
logical companion identity.

A stale async result with an older session/route/perception generation must not
reactivate a camera, renderer, speech request or behavior after its owner has
been stopped.

## 6. Arena / Anchor / Actor world model

### Arena

A logical CSS-pixel spatial surface aligned with the currently visible app
viewport. It is not synonymous with a canvas.

The service explicitly distinguishes:

- layout viewport coordinates;
- visual viewport coordinates;
- document coordinates;
- actor-local coordinates;
- WebGL/NDC coordinates;
- camera-image normalized coordinates;
- model-local 3D coordinates.

Transforms between these spaces live in named adapters and are unit-tested.

### Anchor

A semantic place where the companion may rest, enter, leave or pay attention.
An anchor does not define the complete movement boundary.

Examples:

- `today-sidecar`
- `save-success-near-confirmation`
- `recap-observer`
- `safe-dock-bottom-end`

### Actor

The actor contains logical world pose and a projected visual/hit envelope. The
rendering implementation consumes the pose; it does not own the legal movement
space.

### Safe zones

Pages explicitly register important UI geometry instead of allowing the
companion layer to scan every DOM element on every frame.

Hard zones:

- focused input/form area;
- primary CTA/navigation;
- modal/dialog;
- error and important result regions.

Soft zones:

- primary reading text;
- labels/cards where brief overlap may be tolerated only during transitions.

When no valid free region exists, fall back in this order:

1. safe dock;
2. compact companion control/presence indicator;
3. temporary hidden/suspended presentation.

Never force the actor into a hard zone merely to keep it visible.

## 7. Two independent movement layers

Current tactile motion and future world locomotion must not share one offset.

### Root/world motion

Moves the actor through Arena coordinates. This covers user relocation,
autonomous walk/slide transitions and anchor changes.

### Local embodiment motion

Small body deformation around the actor root: grab, stroke response, tilt,
head/body/feet spring, gaze, breathing and animation clips.

The composition order is explicit, e.g.:

```text
world root transform
-> locomotion/root animation
-> authored animation pose
-> tactile offsets
-> look/gaze offsets
-> rendering projection
```

No two subsystems directly overwrite the same transform without arbitration.

## 8. Direct interaction grammar

The transparent application surface must not globally use `touch-action:none`.
Pointer/touch ownership is limited to the actor hit target or an explicitly
entered play/move surface.

Initial product grammar:

- tap: lightweight reaction;
- stroke: local tactile response;
- grab: local tactile deformation;
- explicit move affordance / validated hold: acquire a root-move lease;
- root drag: move actor through Arena coordinates using pointer capture;
- drop: resolve against hard zones and valid anchors;
- cancel/lost capture/route change: revoke lease and restore the last safe pose.

A drag-free single-pointer alternative must produce the same relocation result,
for example `Move companion` -> choose a destination/anchor.

The system must not rely on switching `touch-action` after a gesture has already
begun. Pointer Events defines pan/zoom arbitration from the gesture start.

## 9. Perception architecture

Perception is optional and capability-scoped. It observes bounded facts; it does
not infer medical state, identity or emotion.

```text
explicit user start
  -> permission adapter
  -> CameraSession
  -> frame sampler
  -> Perception Worker
  -> ephemeral landmarks/classifications
  -> temporal observation reducer
  -> Observation Bus
```

Initial order:

1. hand presence and static gesture;
2. temporal wave detector;
3. limited pose observations in an explicit placed-device play mode;
4. face landmarks/blendshapes only when a concrete product behavior requires them.

MediaPipe web video inference calls are synchronous in the documented JS task
APIs and can block the UI thread; camera inference therefore belongs behind a
worker boundary when used continuously.

A static `Open_Palm` classification is not a wave. A wave requires a temporal
trace with continuity, direction changes, confidence/visibility rules and
negative examples for camera motion and tracking loss.

## 10. Device motion and orientation

Device motion/orientation is a separately enabled input source.

Permission adapters feature-detect `requestPermission()` and request it only
from transient user activation when required. Permission success and actual
non-null sensor delivery are separate capability checks.

First product behaviors are bounded presentation effects:

- neutral calibration;
- small lean/balance response;
- bounded gaze adjustment;
- play-mode-only locomotion influence.

Sensor movement never becomes an implicit save/delete/medical decision input.
Users can disable it and receive a non-motion alternative.

## 11. Observation and event schema

External inputs never mutate renderer state directly.

Example normalized observations:

```ts
type CompanionObservation =
  | { kind: "pointer.tap"; at: number; zone: "head" | "body" | "feet" }
  | { kind: "pointer.stroke"; at: number; zone: string; velocity: number }
  | { kind: "actor.move-request"; at: number; target: WorldPoint }
  | { kind: "device.tilt"; at: number; pitch: number; roll: number; quality: number }
  | { kind: "vision.hand"; at: number; gesture: string; confidence: number }
  | { kind: "vision.wave"; at: number; hand: "left" | "right"; confidence: number }
  | { kind: "app.route"; at: number; route: string; epoch: number }
  | { kind: "app.save-confirmed"; at: number; semanticEvent: "record-saved" }
  | { kind: "accessibility.motion-reduced"; at: number; value: boolean };
```

Every observation is associated with the relevant session/route/perception
generation outside or inside the envelope. Stale-generation observations are
dropped before behavior selection.

## 12. Behavior Director and arbitration

The Behavior Director is deterministic by default. It turns observations into
bounded intent proposals, then the arbitration gate authorizes a plan.

Recommended priority:

1. stop/revoke/session invalidation;
2. accessibility and hard UI safety;
3. direct user manipulation;
4. explicit confirmed app events;
5. perception reactions;
6. autonomous ambient behavior.

Behavior uses channel leases instead of one giant enum state machine.

Example channels:

- `root-motion`
- `body-animation`
- `look`
- `tactile`
- `dialogue`
- `audio`

A user root-drag lease preempts autonomous locomotion. A modal can revoke root
motion while allowing a quiet idle pose. Reduced motion can deny animation
leases without destroying logical presence.

Do not begin with a generic behavior-tree framework dependency. First implement
a small typed arbiter and prove that product scenarios need more expressivity.

## 13. Dialogue and optional voice

Dialogue is an adapter, not the authority for physical behavior.

```text
context envelope
-> dialogue policy
-> deterministic/template response when sufficient
-> optional AI adapter for natural phrasing
-> output validator
-> text
-> optional TTS adapter
```

An AI response cannot emit arbitrary asset URLs, JavaScript, API commands or
unbounded physical actions. Physical intents must map to registered action IDs
and pass the same behavior/asset authorization gate as local behaviors.

Speech recognition/TTS support is capability-detected. Text input remains the
portable baseline.

## 14. Rendering strategy: decide by measurement

Do not encode a permanent architecture assumption before the Interaction Lab.

### Option A — movable transparent actor patch

A modest WebGL canvas/render patch follows the actor through Arena coordinates.

Advantages:

- lower fill cost for one character;
- clear DOM overlay integration;
- easy to suspend when hidden.

Risks:

- clipping and visual envelope management;
- scene lighting/depth cannot naturally share a full 3D environment;
- multiple future actors could multiply contexts.

### Option B — persistent shared transparent stage

One viewport-sized renderer contains the companion and projects around semantic
DOM content.

Advantages:

- one long-lived WebGL context;
- natural world-coordinate movement and future multi-actor/effects;
- one renderer lifetime across routes.

Risks:

- fill/battery cost on mobile;
- pointer and DOM layering complexity;
- integrating scene-local depth/lighting remains non-trivial.

### Option C — scene-owned 3D with presence transfer

Existing full scenes own embodiment when entering a qualified 3D scene; a
presence host owns it elsewhere. Logical state transfers across render owners.

Advantages:

- best integration for S02/S10 environment scenes;
- avoids drawing duplicate companion owners.

Risks:

- owner-transfer protocol is complex;
- bad transitions can reload GLBs or replay animations;
- test matrix grows unless ownership is explicit.

### Phase 0 decision rule

Build the same Interaction Lab scenario with A and B, and model the owner
transfer needed for C. Compare:

- main-thread blocking;
- GPU/frame time;
- battery/thermal proxy over sustained use;
- visual clipping;
- DOM safe-zone accuracy;
- route transition continuity;
- context loss/recovery;
- accessibility layering;
- implementation complexity.

Select the production backend after measurements, not aesthetic preference.

OffscreenCanvas is a candidate optimization, not a prerequisite. Keep DOM
measurement and permissions on the main thread; move rendering off-thread only
if compatibility and profiling justify it.

## 15. Cross-route persistence

Create a stable `CompanionPresenceHost` above route/screen ownership. Route
content registers anchors and safety zones through the host bridge.

Persistent identity does not require immortal GPU resources. Separate:

- identity/session continuity;
- behavior state continuity;
- world pose continuity;
- decoded asset cache;
- renderer/context lifetime.

When render ownership changes:

```text
prepare new owner
-> freeze/revoke conflicting leases
-> old owner quiesce
-> transfer logical pose/action snapshot
-> new owner acquire
-> reveal
-> release old GPU resources when safe
```

If transfer fails, retain the semantic application and fall back to the last
safe static/hidden companion state.

## 16. Capability governor

The governor chooses independent capabilities rather than one global “quality
level”.

Dimensions include:

- renderer: static / WebGL / future WebGPU where verified;
- target FPS and DPR cap;
- camera perception off / low-rate / full-rate;
- active perception task set;
- motion sensors enabled/disabled;
- dialogue text / optional speech;
- ambient autonomy frequency.

Inputs:

- explicit user preferences;
- feature detection and actual initialization success;
- frame-time and inference latency;
- visibility;
- battery/thermal proxy where available;
- Compute Pressure only as an optional signal, never a required dependency.

WebGPU and Compute Pressure are not universal baselines in 2026; fallbacks are
part of the architecture.

## 17. Initial measurable budgets

These are acceptance targets for experiments, not claims about current product.

- direct manipulation first visual response: p95 <= 100 ms once asset is ready;
- authorized observation -> behavior start: p95 <= 200 ms, excluding perception acquisition latency;
- camera perception initial target: 10–15 inference samples/sec with latest-frame dropping;
- rendering target: 60 fps where sustainable, graceful 30 fps mode, static fallback below that;
- no unbounded inference queue: at most current + one replaceable pending frame;
- route-transition stress: 100 transitions without duplicate actor owners or unbounded context growth;
- sustained interaction session: 20 minutes without progressive listener/RAF/resource growth;
- core touch/form latency must not regress when perception is enabled;
- raw camera/mic network egress: zero by default and verifiable in automated network audit.

## 18. Accessibility and user control

- `prefers-reduced-motion` can preserve presence while denying nonessential movement;
- motion-actuation features have equivalent controls and can be disabled;
- drag operations provide a non-drag single-pointer alternative;
- interactive targets meet WCAG target-size/spacing requirements;
- companion visual layers remain outside reading order unless a deliberate semantic control is exposed;
- forced-colors/high-contrast paths do not depend on the 3D character to convey core state;
- camera/sensor controls expose active/paused/stopped state and a one-action stop control.

## 19. Testing and evidence architecture

Separate five confidence layers.

### Pure deterministic contracts

No browser, network or GLB:

- coordinate transforms;
- safe-zone placement;
- path/anchor choice;
- action arbitration and lease preemption;
- stale-generation rejection;
- temporal gesture trace reducers;
- capability governor decisions.

### DOM/browser interaction

Local deterministic actor surrogate:

- pointer capture and cancel;
- scroll vs drag arbitration;
- VisualViewport/keyboard geometry;
- route continuity;
- alternative move controls;
- modal/focus safety zones.

### Renderer integration

Local/controlled asset path where possible:

- GLB/mixer/animation ownership;
- context loss/fallback;
- A/B rendering backend measurements;
- owner transfer and no duplicate actor.

### External delivery confidence

Small bounded tests for immutable deployed asset URL/CORS/byte identity. Do not
make every geometry test depend on this layer.

### Physical-device evidence

Representative iOS Safari and Android Chromium for:

- sensor permission/delivery;
- camera lifecycle;
- touch/scroll behavior;
- sustained frame/inference performance;
- keyboard/VisualViewport interaction;
- thermal/battery observations.

Every recorded trace should identify source version, device/browser, capability
set and whether it is synthetic or physical evidence.

## 20. Privacy and threat boundaries

Threats to test explicitly:

- permission prompt after user already cancelled;
- old worker result after a new route/account/session;
- camera track remaining live after UI says stopped;
- accidental raw-frame network request/logging;
- landmark/event persistence through telemetry;
- prompt/dialogue output attempting unregistered physical action;
- background/hidden-tab work continuing unexpectedly;
- gesture spoofing/low-confidence perception causing destructive app actions.

Perception observations may drive presentation/play only unless an explicit,
separately reviewed product contract authorizes more. They do not authorize
medical, account, save/delete or security decisions.

## 21. Legacy restrictions to retire

These are candidates for removal/replacement, not protected invariants:

- actor movement bounded by the render slot;
- `screen -> fixed small slot` as the primary companion location model;
- permanent screen-specific tactile disablement when a capability/interaction contract can replace it;
- S05-specific canvas-size/FOV patches as the long-term placement mechanism;
- route visit == companion identity lifetime;
- every companion geometry test waiting on remote GLB/WebGL readiness;
- historical “do not redesign renderer/controller” scope notes being treated as permanent platform constraints.

Each retirement still requires a replacement contract and migration evidence.

## 22. Repository module proposal

Names are provisional; responsibility matters more than folder count.

```text
web/src/companion-platform/
  presence/
    companionPresence.ts
    companionSession.ts
    companionHostBridge.ts
  spatial/
    worldCoordinates.ts
    companionArena.ts
    companionAnchors.ts
    companionSafeZones.ts
    companionPlacement.ts
  behavior/
    companionObservations.ts
    companionArbiter.ts
    companionLeases.ts
    companionActions.ts
  input/
    pointerAdapter.ts
    deviceMotionAdapter.ts
  perception/
    perceptionSession.ts
    perceptionProtocol.ts
    perception.worker.ts
    temporalGestures.ts
  embodiment/
    embodimentPort.ts
    legacyCompanionAdapter.ts
    sceneCompanionAdapter.ts
  capability/
    companionCapabilities.ts
    companionGovernor.ts
  dialogue/
    dialoguePort.ts
    localDialogue.ts

web/src/components/transcend/
  CompanionPresenceHost.tsx
  CompanionInteractionLab.tsx

web/e2e/
  transcend-interaction-lab.spec.ts
  transcend-presence-contract.spec.ts
```

Do not create this entire tree in one PR. Add modules only when a Phase slice
needs them.

Existing asset authority remains under current `ui/companion*` / scene registry
until a separately reviewed migration proves an equivalent or stronger boundary.

## 23. Migration roadmap

### Phase 0 — Architecture + adversarial review

Docs only. Codex and Kimi independently challenge source assumptions, lifecycle,
performance, interaction ambiguity and privacy. No production changes.

### Phase 1 — Transcend Interaction Lab

Isolated, non-production route/tool. One active lite asset. Introduce world
coordinates, safe zones, actor relocation, non-drag alternative and stable
presence across two synthetic route states. Compare movable-patch vs shared-stage
rendering with identical scenarios.

### Phase 2 — Presence Host foundation

Introduce a stable host and host bridge while production screens retain current
presentation. Prove one logical actor and deterministic route epochs. No sensors.

### Phase 3 — First production spatial migration

Choose one low-risk surface. Replace slot confinement with the selected backend,
preserving asset activation and semantic UI. Old path remains rollback.

### Phase 4 — Device motion

Explicit opt-in permission/capability adapter and bounded lean/balance behavior.
No camera.

### Phase 5 — Camera hand interaction

Explicit camera play session, worker inference, temporal wave, local-only network
audit, hard stop/revoke behavior. One gesture is enough for first release.

### Phase 6 — Behavior + dialogue composition

Typed arbiter, richer behavior recipes, contextual deterministic dialogue, then
optional natural-language adapter behind output/action validation.

### Phase 7 — Render-owner transfer / full-scene integration

Unify logical presence across standalone actor and S02/S10-style scene owners.
Prove no duplicate owner, GLB replay or action replay.

### Phase 8 — Expanded perception/native bridge only if evidence requires it

Pose/face, richer voice, native shell/device bridge are conditional extensions,
not prerequisites for the web North Star.

## 24. Phase 1 — first implementation slice

The first code PR after architecture review is an **Interaction Lab**, not a
rewrite of `CompanionReviewRenderer` or all screens.

Acceptance criteria:

1. one current active lite companion is resolved through existing authority;
2. actor world position is independent of the render canvas local tactile offset;
3. actor can be relocated between at least two safe anchors;
4. direct drag works without blocking page scroll outside the actor/move surface;
5. a non-drag move control achieves the same placements;
6. hard zones are never covered after drop resolution;
7. two synthetic route states preserve logical identity and safe world pose;
8. stop/reset disposes listeners/RAF/render resources deterministically;
9. no camera, motion sensor, AI dialogue, API/DB/Auth/Model V2 or deployment change;
10. A and B render strategies emit comparable metrics and the PR does not claim a production winner before measurement.

## 25. Abort criteria

Stop the implementation slice instead of widening scope if:

- current active asset identity cannot be resolved without weakening activation authority;
- a global transparent overlay must disable normal page scroll/zoom to make the prototype work;
- two render owners for one logical actor cannot be prevented;
- route transition requires replaying confirmed S05 effects or mutating product state;
- the prototype requires camera/sensors to demonstrate basic relocation;
- pure spatial/arbitration tests cannot be separated from remote GLB/network;
- core form/navigation accessibility regresses;
- measured full-screen rendering or movable-patch rendering is unsustainable and no safe fallback exists;
- implementation starts creating a generic engine/framework without a tested product need.

## 26. Rollback

Every migration phase keeps the previous production presentation available until
the new phase is accepted. Feature flags/gates select presentation, but flags do
not become asset activation authority.

A rollback returns rendering/interaction ownership to the previous path and
invalidates new platform leases/sessions. It does not rewrite immutable assets,
Learning Records, Model V2 or application data.

## 27. External technology evidence used for this architecture

Primary references to re-check at implementation time:

- W3C Pointer Events: https://www.w3.org/TR/pointerevents3/ and current draft
- MDN DeviceOrientation permission: https://developer.mozilla.org/docs/Web/API/DeviceOrientationEvent/requestPermission_static
- MDN DeviceMotion permission: https://developer.mozilla.org/docs/Web/API/DeviceMotionEvent/requestPermission_static
- MDN getUserMedia: https://developer.mozilla.org/docs/Web/API/MediaDevices/getUserMedia
- Google AI Edge Gesture Recognizer Web: https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer/web_js
- Google AI Edge Pose Landmarker Web: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- Google AI Edge Face Landmarker Web: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js
- MDN OffscreenCanvas: https://developer.mozilla.org/docs/Web/API/OffscreenCanvas
- MDN WebGPU: https://developer.mozilla.org/docs/Web/API/WebGPU_API
- MDN Compute Pressure: https://developer.mozilla.org/docs/Web/API/Compute_Pressure_API
- WCAG 2.2: https://www.w3.org/TR/WCAG22/

Support and behavior must be feature-detected and revalidated on the actual
release browser/device matrix; documentation availability is not a device-level
PASS.
