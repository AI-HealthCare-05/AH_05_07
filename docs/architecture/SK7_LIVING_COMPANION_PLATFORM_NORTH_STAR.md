# SK7 Living Companion Platform — North Star Architecture

Status: architecture candidate — Revision 2 after clean-room Phase 1 gate; no production behavior or deployment authorization
Baseline: `9e0fe2ba9434b6762167dbc349ed29860e6196f3` (resolved from actual `origin/main` when the Phase 0 branch is created)
Program name: **SK7 Transcend**
Platform name: **SK7 Living Companion Platform**

Revision 2 closes the three blocking ambiguities found by the clean-room Phase 1
gate without shrinking the North Star. It makes the Lab non-deployable by
construction, replaces per-registration Arena revisioning with one immutable
atomic `ArenaSnapshot`, and separates `world-root` pose-write fencing from the
Lab renderer backend's mount/reveal authority. Phase 1 remains an isolated
experiment; later perception/dialogue/production-owner-transfer directions are
unchanged and are not authorized by this revision.

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
actual product, privacy, accessibility, data or activation boundaries.

The following remain authoritative unless separately versioned and reviewed:

- immutable companion asset identity and current checked-in production activation authority;
- candidate inventory, historical Learning Record evidence, `retain`, `ownerApproval`, and recorded `productionActivation` are not current runtime activation authority;
- Model V2, API, DB, Auth and RLS semantics are outside companion behavior authority;
- health values, risk labels and Model V2 outputs do not become implicit emotional or medical animation/dialogue inputs;
- semantic HTML, forms, navigation and core SK7 tasks remain usable when 3D, WebGL, sensors, camera, perception or dialogue fail;
- camera, microphone and motion sensing are explicit opt-in capabilities and can be stopped independently;
- any future raw camera/microphone frames and derived landmarks have an explicit zero-egress / no-persistence contract unless a separately reviewed feature says otherwise;
- reduced-motion, forced-colors and non-drag alternatives are first-class behavior, not post-release patches;
- no output transform/state may have multiple unfenced authoritative writers;
- S05 saved-scene one-shot consumption is not replayed or reconstructed by Transcend;
- human merge remains the final gate; this architecture does not authorize deploy.

Phase 1 adds one fenced `world-root` lease only. This does **not** authorize a
generic arbiter, behavior-tree framework, worker, sensor stack, AI/LLM, new
dependency, server or production render-owner migration.

## 3. Current-source diagnosis

The current product already contains useful pieces, but ownership is fragmented
across host policy, three rendering paths and slot-local interaction.

### Legacy companion path

`App` and `companion.ts` determine semantic selection and whether a full-scene
owner suppresses the legacy companion. `SceneShell` then chooses saved-scene
versus legacy placement. `CompanionRuntimeBoundary` performs runtime admission,
looks up the applicable descriptor and derives the legacy interaction/look
activation flags before lazy-loading `CompanionReviewRenderer`.

`CompanionReviewRenderer` owns WebGL renderer creation, GLTF loading,
mixer/actions, resize, RAF, tactile input, look behavior and teardown inside one
construction effect. The boundary must not be generalized into a future
all-purpose host-policy owner merely because it currently resolves a descriptor.

`companionInteraction.ts` derives pointer coordinates and head/body/feet zones
from the canvas rectangle, listens on the parent slot, and constrains the 3D
object around a local home position. That is valid for local tactile deformation
but is the wrong long-term world model for relocating an actor around the
application.

### Scene paths

`SceneShell` chooses between saved-scene and legacy companion ownership, with a
special inline S05 path. `VisualStage` separately owns S02/S10 full-scene
rendering with visibility activation and static fallback. Therefore the current
product is not one small-canvas implementation; it is multiple rendering and
lifecycle paths without one shared logical presence model.

Current host policy already tries to enforce one dynamic character owner for
S02/S10. A migration must preserve that product invariant before it generalizes
ownership.

### Layout, clipping and test coupling

The default `.companion-runtime-slot` is a small absolute box and S05 has a
larger special-case layout/FOV. The slot itself is not universally clipped by
`overflow:hidden`; actual confinement is a combination of canvas projection,
local-home numeric clamps, ancestor clipping/stacking and scene-specific
boundaries. Merely changing CSS overflow is therefore not a world-movement
architecture.

Some slot/action-envelope integration tests (not every geometry test) wait for
remote GLB/WebGL readiness before asserting non-overlap or related geometry.
Long-term pure geometry and behavior contracts should not require the remote
delivery path unless they are explicitly renderer/delivery integration tests.

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

The Presence Kernel owns logical identity and session continuity, not WebGL and
not live lease authority.

Minimum logical snapshot:

```ts
type CompanionPresence = {
  sessionEpoch: number;
  actorId: string;
  assetId: string;               // authorized identity, never inferred from candidate/history
  mode: "quiet" | "companion" | "play";
  lifecycle: "suspended" | "present" | "transitioning";
  placementIntent: PlacementIntent | null;
};
```

Live route/arena generations, renderer incarnations and lease tokens are
runtime-owned fencing state rather than persisted logical presence:

```ts
type CompanionRuntimeEpochs = {
  sessionEpoch: number;
  routeEpoch: number;
  arenaRevision: number;
  rendererGeneration: number;
};
```

Logout/account boundaries invalidate the entire session epoch. Route change
invalidates route-owned anchors/obstacles and revokes route-scoped movement, but
does not automatically destroy the logical companion identity.

Cross-route continuity preserves **placement intent** (for example an anchor
role plus normalized preference), not stale CSS-pixel coordinates. The new route
must resolve a fresh safe pose against its current Arena revision.

A stale async result with older session/route/arena/renderer/perception
generation must not reactivate a camera, renderer, speech request, lease or
behavior after its owner has been stopped.

## 6. Arena / Anchor / Actor world model

### Arena

The long-term architecture distinguishes all required spaces, but Phase 1 uses
one explicit canonical Arena contract instead of pretending they are already
interchangeable.

For the Interaction Lab, the canonical space is the current visual viewport in
CSS pixels. Geometry is consumed only through one immutable snapshot:

```ts
type ArenaRevision = number;
type RouteEpoch = number;

type ArenaPoint = {
  space: "visual-viewport-css-px";
  revision: ArenaRevision;
  x: number;
  y: number;
};

type ArenaRect = {
  space: "visual-viewport-css-px";
  revision: ArenaRevision;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PlacementIntent = {
  preferredRole: string | null;
  preferredAnchorId?: string;
  normalizedOffset?: { x: number; y: number }; // clamped 0..1 preference only
  fallbackOrder: readonly ("anchor" | "dock" | "control" | "hidden")[];
};

type CompanionAnchor = {
  id: string;
  routeEpoch: RouteEpoch;
  arenaRevision: ArenaRevision;
  role: string;
  priority: number;
  region: ArenaRect;
};

type ResolvedPose = {
  routeEpoch: RouteEpoch;
  arenaRevision: ArenaRevision;
  point: ArenaPoint;
  anchorId: string | null;
  source: "anchor" | "dock" | "fallback";
};

type ArenaSnapshot = {
  space: "visual-viewport-css-px";
  routeEpoch: RouteEpoch;
  revision: ArenaRevision;
  viewport: ArenaRect;
  anchors: readonly CompanionAnchor[];
  hardZones: readonly ArenaRect[];
};
```

The origin is the current `VisualViewport` top-left expressed in CSS pixels.
Adapters explicitly translate between document/layout coordinates, the tagged
Arena coordinate, actor-local coordinates and renderer/NDC coordinates.

#### Atomic snapshot rule

Anchor/hard-zone providers expose **untagged measured geometry** to one snapshot
builder. A geometry-invalidating event schedules a rebuild; the builder chooses
exactly one next `ArenaRevision` and stamps the viewport, every retained Anchor,
every hard zone and every newly resolved pose with that same revision before the
snapshot becomes current.

Registering Anchor B after Anchor A therefore does **not** make A stale by
itself. The provider set changes, then one complete snapshot containing A and B
is published atomically. The previous snapshot remains immutable until it is
replaced. No consumer may combine geometry from two revisions.

A snapshot rebuild is required when placement-relevant geometry changes,
including:

- visual viewport resize/scroll or virtual-keyboard geometry;
- layout/document scroll affecting registered geometry;
- Lab synthetic route change;
- anchor provider registration/unregistration;
- hard-zone provider or geometry changes;
- explicit Lab reset.

Every world-root write and placement resolution carries `routeEpoch` plus
`ArenaRevision`; stale epochs/revisions fail without mutation. Within one
snapshot, Anchor selection is deterministic: higher `priority` first, then
lexicographic `id` as the tie-breaker.

The Phase 1 route transition order is explicit:

```text
revoke current world-root lease
-> advance routeEpoch
-> retire the old ArenaSnapshot
-> measure the new route providers
-> atomically publish one new ArenaSnapshot
-> resolve carried PlacementIntent against that snapshot
-> apply anchor -> dock -> control -> hidden fallback
```

Cross-route continuity preserves `PlacementIntent`, not raw CSS pixels or a
stale `ResolvedPose`. Long-term production integration may choose another
canonical space only through a separately reviewed contract and migration.

### Anchor

An Anchor is a route-scoped semantic placement opportunity contained by one
`ArenaSnapshot`; it is not a permanent pixel location and not the actor's
complete movement boundary.

Route change or explicit unregister changes the provider set and requires a new
snapshot. A preferred role/id/normalized preference may survive as
`PlacementIntent`, but old Anchor geometry and old resolved pose do not.

Examples:

- `today-sidecar`
- `save-success-near-confirmation`
- `recap-observer`
- `safe-dock-bottom-end`

### Actor

The Actor has a world root, renderer-local embodiment and **separate envelopes**:

- conservative visual/action envelope used for hard-zone placement;
- hit envelope used for tactile admission;
- optional move handle/envelope used for relocation;
- embodiment profile/version used by deterministic placement tests.

The visual envelope includes the maximum qualified action envelope required by
the Lab scenario; it is not inferred from one idle frame alone. The rendering
implementation consumes world pose; it does not own the legal movement space.

### Safe zones

Pages/Lab routes explicitly register important UI geometry instead of allowing
the companion layer to scan every DOM element on every frame.

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

The North Star keeps deterministic arbitration as a long-term responsibility,
but stimulus names are not assumed to be disjoint output channels.

Current tactile behavior can both deform the model root and request authored
animation, while look is an additive skeleton modification. Therefore future
leases map to **authoritative output resources/composition stages**, not simply
to inputs such as `tactile`.

Long-term candidate output channels include:

- `world-root`;
- `embodiment-root-local`;
- `skeleton-base`;
- `skeleton-additive-look`;
- `dialogue`;
- `audio`.

The renderer/embodiment composer owns the final deterministic composition order.
Inputs propose bounded intents; they do not directly gain transform authority.

Recommended intent priority remains:

1. stop/revoke/session invalidation;
2. accessibility and hard UI safety;
3. direct user manipulation;
4. explicit confirmed app events;
5. perception reactions;
6. autonomous ambient behavior.

### Phase 1 arbitration contract

Phase 1 implements **one fenced `world-root` lease only** for Lab relocation.
It fences authoritative world-pose writes; it does **not** authorize renderer
mounting, visibility or reveal.

Minimum lease identity:

```ts
type WorldRootLease = {
  token: string;
  sessionEpoch: number;
  routeEpoch: number;
  arenaRevision: ArenaRevision;
  owner: string;
  acquisitionOrder: number;
};
```

`acquire`, `renew`, `write` and `release` are exact-token operations. A request
with stale session/route/revision/token returns failure without mutating the
current lease or pose. If token T2 replaces T1, `release(T1)` must not clear T2
(ABA-safe release). Publishing a new `ArenaSnapshot` revokes the prior
world-root lease before the new revision accepts writes; an old-revision write
can never carry forward implicitly.

Route change, Lab stop/reset, hard-zone invalidation requiring re-placement and
session replacement revoke the applicable world-root lease. Tie-breaking for
competing Lab relocation requests is deterministic.

#### Renderer backend authority is separate

Phase 1 A/B comparison uses a **Lab-local sequential backend selector**, not a
second generic lease. The selector owns mount/reveal lifecycle only:

```text
select A or B
-> run scenario
-> stop and await the Lab teardown barrier
-> assert task-owned resource counters are drained
-> unmount old backend
-> mount exactly one new backend
-> run the same scenario
```

At no point may A and B both be mounted/visible. The selector has no production
owner-transfer semantics and cannot write world pose; the `world-root` lease has
no renderer mount/reveal semantics. Future production render-owner transfer may
use a separately reviewed activation token as described in section 15.

Do not introduce a generic behavior tree, multi-channel lease framework,
renderer-ownership framework, dialogue/audio arbitration or production Behavior
Director in Phase 1. Add those only after measured product scenarios require
them.

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
The descriptions below are **hypotheses to measure**, not proven repository
advantages.

### Option A — movable transparent actor patch

A modest WebGL canvas/render patch follows the actor through Arena coordinates.

Hypotheses to test:

- lower fill cost for one character;
- straightforward DOM-overlay placement;
- easier actor-local suspension.

Risks to test:

- ancestor/canvas clipping and action-envelope management;
- layout/compositing cost while moving the surface;
- scene lighting/depth cannot naturally share a full 3D environment;
- multiple future actors could multiply contexts.

### Option B — persistent shared transparent stage

One viewport-sized renderer contains the companion and projects around semantic
DOM content.

Hypotheses to test:

- one long-lived context can simplify cross-route embodiment;
- world-coordinate movement and future multi-actor/effects may be simpler;
- one renderer can own Lab embodiment for the full synthetic route session.

Risks to test:

- fill/battery/thermal cost on mobile;
- pointer/DOM layering complexity;
- context loss affects the whole Lab embodiment;
- integrating scene-local depth/lighting remains non-trivial.

### Option C — scene-owned 3D with presence transfer

Existing full scenes own embodiment when entering a qualified 3D scene; a
presence host owns it elsewhere. Logical state transfers across render owners.

This remains a **North Star model only** in Phase 1. It is not implemented by the
Lab.

Potential benefits to validate later:

- stronger S02/S10 environment integration;
- avoidance of duplicate standalone + scene character owners.

Risks:

- owner-transfer race;
- GLB/animation replay;
- duplicate active writers;
- route-transition disappearance;
- expanded integration test matrix.

### Phase 1 A/B measurement protocol

Run the **same** scenario against A and B with no preselected winner. Record at
minimum:

- source SHA and Lab build identity;
- browser/OS/device descriptor used for the run;
- viewport, visual viewport and DPR;
- cold vs warm asset/context condition;
- identical authorized asset and animation scenario;
- identical input trace and timing clock;
- frame/long-task samples;
- created/live context count and draw activity;
- main-thread blocking;
- clipping and hard-zone outcomes;
- native scroll/zoom preservation;
- route transition continuity;
- reset/cleanup result;
- implementation complexity notes.

Performance numbers in this document are experimental targets until a baseline
and this protocol exist; they are not current-product facts or release gates.

OffscreenCanvas is a candidate optimization, not a prerequisite. Keep DOM
measurement and permissions on the main thread; move rendering off-thread only
if compatibility and profiling justify it.

## 15. Cross-route persistence

The North Star may eventually use a stable `CompanionPresenceHost` above
route/screen ownership, but Phase 1 does **not** add that production host.

Persistent identity does not require immortal GPU resources. Separate:

- identity/session continuity;
- placement intent;
- route/Arena geometry;
- behavior state continuity;
- decoded asset cache;
- renderer/context lifetime.

Cross-route movement preserves placement intent and resolves a fresh safe pose
for the new route; it does not preserve raw pixel position unconditionally.

For a later render-owner transfer, distinguish **prepared** from **active**:

```text
allocate/load prepared owner (no write/reveal authority)
-> freeze/revoke conflicting active leases
-> old owner quiesce
-> acquire fenced activation token for new owner
-> transfer logical snapshot
-> new owner write/reveal
-> old owner release resources
```

Resource preparation may overlap, but only one fenced active token may write or
reveal the actor. A stale old-token release cannot revoke the new owner.

If transfer fails, retain the semantic application and fall back to the last
safe static/hidden companion state. Option C transfer is not implemented in
Phase 1.

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

These are **experimental targets**, not claims about current product and not
Phase 1 release gates until a baseline exists.

Initial hypotheses:

- direct manipulation first visual response: p95 <= 100 ms once asset is ready;
- authorized observation -> behavior start: p95 <= 200 ms, excluding perception acquisition latency;
- camera perception future target: 10–15 inference samples/sec with latest-frame dropping;
- rendering target: 60 fps where sustainable, graceful 30 fps mode, static fallback below that;
- no unbounded inference queue: at most current + one replaceable pending frame;
- route-transition stress: 100 transitions without duplicate actor owners or unbounded context growth;
- sustained interaction session: 20 minutes without progressive listener/RAF/resource growth;
- core touch/form latency must not regress when perception is enabled;
- future raw camera/mic network egress: zero unless a separately reviewed feature explicitly authorizes otherwise.

Before any target is used as a gate, record:

- exact browser/OS/device and power condition;
- viewport/DPR;
- warm/cold asset/context state;
- scenario and input trace;
- sample count and percentile method;
- baseline vs candidate result;
- pass/fallback interpretation.

Phase 1 A/B uses the common measurement protocol in section 14 and reports the
measurements without declaring a production backend in advance.

## 18. Accessibility and user control

- `prefers-reduced-motion` can preserve presence while denying nonessential movement;
- motion-actuation features have equivalent controls and can be disabled;
- drag operations provide a non-drag single-pointer alternative;
- interactive targets meet WCAG target-size/spacing requirements;
- companion visual layers remain outside reading order unless a deliberate semantic control is exposed;
- forced-colors/high-contrast paths do not depend on the 3D character to convey core state;
- camera/sensor controls expose active/paused/stopped state and a one-action stop control.

## 19. Testing and evidence architecture

Separate confidence layers so pure spatial/ownership failures are not disguised
as remote asset or WebGL failures.

### Phase 1 build/runtime isolation

The Interaction Lab is not a query-gated product route and is not part of the
product TypeScript/Vite entry. Phase 1 uses an independent sub-root:

```text
web/transcend-lab/
  index.html
  vite.config.ts
  tsconfig.json
  src/...
```

The Lab Vite config uses `web/transcend-lab/` as its root and writes only to
`web/.transcend-lab-dist/`. That output is ignored and must never resolve to or
write `web/dist`, which remains the production deployment directory. The
existing product `build` / `prebuild` commands and default `web/index.html`
entry are not repointed to the Lab.

A dedicated Lab TypeScript command type-checks the Lab project separately. Lab
source lives outside the product `web/src` include tree; the only permitted
imports back into current product source are the explicitly enumerated
read-only runtime-membership seam and its static, side-effect-free dependency
closure.

Phase 1 automatically verifies all of the following:

- the Lab build cannot target `web/dist` and the default product build emits no Lab HTML/chunk/navigation marker;
- a Vite/Rollup build hook emits a Lab module-graph report and a verifier checks the **transitive** reachable source graph, not merely direct imports;
- the module graph contains only the Lab subtree, existing package dependencies, and the explicitly enumerated membership-seam closure;
- forbidden transitive imports include `App.tsx`, `SceneShell.tsx`, production renderers, saved-event code, product API/Supabase/Auth/Model V2 modules and product CSS;
- Lab synthetic routes do not modify product history/storage/IndexedDB/cookies;
- network requests are limited to Lab resources plus at most the exact admitted active-lite asset URL;
- zero API/Auth/Model V2/Supabase/storage/sensor/camera/mic traffic occurs;
- build scripts add Lab-specific commands only; they do not change deployment/Wrangler topology.

The module-graph check must be generated from the actual Lab build graph. A
hand-maintained list of direct imports is not sufficient evidence.

### Pure deterministic contracts

No browser, network or GLB:

- tagged Arena coordinate transforms and stale revision rejection;
- safe-zone placement;
- Anchor register/unregister and route-epoch invalidation;
- visual vs hit envelope independence;
- world-root lease fencing, preemption and ABA-safe release;
- placement intent resolution;
- active membership fail-closed behavior for the bounded Lab asset.

### DOM/browser interaction

Use a deterministic local actor surrogate where possible:

- pointer capture and cancel/lost-capture;
- actor-local scroll vs drag arbitration;
- VisualViewport/keyboard geometry;
- two Lab-local synthetic route states;
- alternative non-drag/keyboard relocation;
- modal/focus safe zones;
- reduced-motion and forced-colors;
- Lab stop/reset cleanup;
- semantic controls under renderer failure.

### Renderer integration

Run the identical Lab scenario/metrics schema against A and B:

- one authorized active-lite asset;
- load/ready/failure;
- visual/action envelope behavior;
- route continuity;
- context loss/recovery;
- created/live context count;
- reset cleanup.

### External delivery confidence

Separate remote asset/CORS/delivery checks from geometry contracts. Remote
delivery failure must not turn pure spatial tests red.

### Current-runtime characterization before production migration

The Lab can proceed before all production characterization is complete, but no
production screen migrates until current behavior is documented for at least:

- eligible S02→S03→S02 continuity;
- exit during active pointer capture/reaction timer;
- delayed GLB completion after exit;
- account/session epoch replacement on the same screen;
- report hidden/open/close suspension behavior;
- reduced-motion path differences;
- context/import failure and repeated context stress;
- StrictMode setup/cleanup/setup;
- 30/60/120Hz or long-frame timing interaction with the 300ms release contract;
- owner matrix across legacy/saved/full-scene paths;
- S05 confirmed-persistence one-shot/no-replay invariant.

### Physical-device evidence

Before production migration, run a bounded real-device matrix driven by observed
risk rather than species × browser × viewport combinatorics. Phase 1 may collect
reference-device measurements, but it does not claim production readiness.

## 20. Privacy and threat boundaries

Threats to test explicitly in the phases that introduce those capabilities:

- permission prompt after user already cancelled;
- old worker result after a new route/account/session;
- camera track remaining live after UI says stopped;
- accidental raw-frame network request/logging;
- landmark/event persistence through telemetry;
- prompt/dialogue output attempting unregistered physical action;
- background/hidden-tab work continuing unexpectedly;
- gesture spoofing/low-confidence perception causing destructive app actions.

Future perception has an explicit session boundary with independent stop,
stale-generation rejection and a **zero-egress / no-persistence contract** for
raw frames, audio and derived landmarks unless a separately reviewed feature
authorizes something else. “Local by default” is not sufficient evidence.

Perception observations may drive presentation/play only unless an explicit,
separately reviewed product contract authorizes more. They do not authorize
medical, account, save/delete or security decisions.

Phase 1 contains no camera, microphone, motion sensor, worker or AI/LLM.

## 21. Legacy restrictions to retire

These are candidates for replacement, not protected invariants:

- actor world relocation bounded by the render canvas/local-home clamp;
- `screen -> fixed small slot` as the primary companion placement model;
- permanent screen-specific tactile disablement when a qualified capability/interaction contract can replace it;
- S05-specific canvas-size/FOV patches as the long-term placement mechanism;
- fragmented render/action lifetime and owner policy being mistaken for companion identity lifetime;
- remote GLB/WebGL readiness being required for pure geometry/placement contracts;
- historical “do not redesign renderer/controller” scope notes being treated as permanent platform constraints.

Species preference already persists across routes and some legacy renderer
instances can survive same-position rerenders. The problem to retire is
fragmented render/action ownership, not a false claim that all identity currently
dies on every route visit.

Each retirement still requires a replacement contract and migration evidence.

## 22. Repository module proposal

The North Star may eventually grow additional presence, perception, capability
and dialogue modules, but **Phase 1 deliberately does not create the full
platform tree**.

### Phase 1 minimal files

The Lab is deliberately outside `web/src` so the default product TypeScript
project and Vite entry do not absorb it:

```text
web/transcend-lab/
  index.html
  vite.config.ts
  tsconfig.json
  src/
    main.tsx
    CompanionInteractionLab.tsx
    labRenderers.tsx
    transcend-lab.css
    platform/
      spatial/
        companionWorld.ts
      behavior/
        rootMotionLease.ts
      embodiment/
        labEmbodimentPort.ts
  scripts/
    verify-module-graph.mjs

web/playwright.transcend-lab.config.ts

web/e2e/
  transcend-presence-contract.spec.ts
  transcend-interaction-lab.spec.ts
```

Phase 1 may add Lab-specific package scripts and one ignore entry for
`web/.transcend-lab-dist/`. Existing product `build`, `prebuild`, Wrangler and
deployment settings remain unchanged.

Responsibilities:

- `companionWorld.ts`: atomic `ArenaSnapshot`, tagged coordinate/revision types, route-scoped Anchors, safe zones, `PlacementIntent`, resolved pose and visual/hit envelopes;
- `rootMotionLease.ts`: the single exact-token fenced `world-root` pose-write lease with session/route/revision revocation and ABA-safe release;
- `labEmbodimentPort.ts`: immutable pose/scenario/metrics contract shared by A/B Lab renderers;
- `labRenderers.tsx`: movable-patch and shared-stage implementations behind the Lab-only port plus a sequential backend selector that mounts exactly one implementation at a time;
- `CompanionInteractionLab.tsx`: two synthetic route states, controls, safe zones, stop/reset, teardown barrier and identical scenario replay;
- `verify-module-graph.mjs`: validates the generated transitive Lab build graph against the explicit allow/deny boundary;
- the two specs separate pure contracts from browser/input/render integration.

Existing asset authority remains under current `ui/companion*` / scene registry.
The Lab may read `getCompanionRuntimeMembership()` and use only one **fixed**
asset ID that resolves to `active-runtime-member` at implementation preflight.
The scenario fixture records that ID; there is no automatic fallback or
substitution if it ceases to be active. The Lab does not create a second
allowlist or common loader that changes current review/production authority.

## 23. Migration roadmap

### Phase 0 — Architecture + adversarial review

Docs only. Independent reviews challenge source assumptions, lifecycle,
performance, interaction ambiguity and privacy. No production changes.

### Phase 1 — Transcend Interaction Lab

A separately built, non-production Lab with its own HTML/React/Vite/Playwright
entry. It does not import or modify the product `App`, `SceneShell`, production
renderers, saved-event path, product API/Auth/Model V2 modules or product CSS.

Using one read-only `active-runtime-member` lite asset integration plus a local
surrogate, introduce tagged Arena coordinates, route-scoped Anchors, separate
visual/hit envelopes, safe zones, actor relocation, one fenced world-root lease,
non-drag/keyboard alternatives and two Lab-local synthetic route states.

Compare movable-patch vs shared-stage rendering under the identical scenario and
measurement protocol. No production winner is declared in advance.

No sensor, camera, worker, AI/LLM, new dependency/server, activation or deploy.

### Phase 2 — Presence Host foundation

After Phase 1 decision evidence and a separate review, introduce a stable
logical host/bridge while production screens retain current presentation. Prove
one logical actor, deterministic epochs and fail-closed ownership. No sensors.

### Phase 3 — First production spatial migration

Only after current-runtime characterization, choose one low-risk surface.
Replace slot confinement with the selected backend while preserving asset
activation, S05 invariants and semantic UI. Old path remains rollback.

### Phase 4 — Device motion

Explicit opt-in permission/capability adapter and bounded lean/balance behavior.
No camera.

### Phase 5 — Camera hand interaction

Explicit camera play session, measured worker inference where justified,
temporal wave, zero-egress/no-persistence audit, hard stop/revoke behavior. One
gesture is enough for first release.

### Phase 6 — Behavior + dialogue composition

Add output-channel composition and richer deterministic behaviors only after
real product conflicts require them. Contextual deterministic dialogue comes
before any optional natural-language adapter.

### Phase 7 — Render-owner transfer / full-scene integration

Unify logical presence across standalone actor and S02/S10-style scene owners.
Prove fenced activation, no duplicate active owner, GLB replay or action replay.

### Phase 8 — Expanded perception/native bridge only if evidence requires it

Pose/face, richer voice, native shell/device bridge are conditional extensions,
not prerequisites for the web North Star.

## 24. Phase 1 — first implementation slice

The first code PR after Architecture Revision 2 is a **Transcend Interaction
Lab**, not a rewrite of `CompanionReviewRenderer`, `App`, `SceneShell` or
production scenes.

### Enforceable isolation

Phase 1 requires:

1. dedicated `web/transcend-lab/` HTML/React/Vite/TypeScript sub-root plus dedicated Playwright config;
2. Lab output only in ignored `web/.transcend-lab-dist/`; the Lab build must refuse any output resolving to `web/dist`;
3. existing product `build`/`prebuild`, `web/index.html`, Wrangler and deployment topology remain unchanged;
4. a generated **transitive** Lab module-graph report with an automated allow/deny verifier;
5. no imports—direct or transitive—from `App.tsx`, `SceneShell.tsx`, current production renderers, saved-event code, product API/Supabase/Auth/Model V2 modules or product CSS, except the explicitly enumerated read-only membership-seam closure;
6. two Lab-local synthetic route states only; no product history/storage/IndexedDB/cookie writes;
7. network allowlist limited to Lab resources and at most the exact fixed active-lite integration asset;
8. no camera, microphone, motion sensor, worker, AI/LLM, new dependency/server/topology, activation or deployment.

### Acceptance criteria

1. default product build emits no Lab HTML/chunk/navigation marker, and the Lab build cannot target/write `web/dist`;
2. generated Lab module graph contains only Lab/platform modules, existing packages and the explicitly enumerated membership-seam dependency closure;
3. automated network audit allows only Lab build resources and at most the exact admitted asset URL, with zero product API/Auth/Model V2/Supabase/storage/sensor/media traffic;
4. synthetic routing performs zero writes to product history, local/session storage, IndexedDB, cookies or product state;
5. one fixed asset ID is admitted only when `getCompanionRuntimeMembership(assetId)` returns `active-runtime-member`; catalog-only, unknown, candidate, registry mismatch or thrown authority checks make **no** asset request;
6. one immutable `ArenaSnapshot` contains viewport, both Anchors and all hard zones stamped with the same revision; stale points/rects/poses are rejected and sequential provider registration cannot stale retained geometry individually;
7. route change revokes the world-root lease, advances route epoch, retires the old snapshot, builds one new atomic snapshot, carries only `PlacementIntent`, and deterministically re-resolves or falls back;
8. visual/action envelope, tactile hit envelope and relocation handle vary independently; hard-zone placement uses the conservative visual/action envelope;
9. actor can be relocated between at least two safe Anchors;
10. exact-token world-root lease tests cover acquire, renew, preemption, stale writes, pointer cancel/lost capture/Escape, route/reset/stop revocation, Arena-revision change and the T1-release-after-T2 ABA case;
11. the world-root lease fences **pose writers only**; a separate sequential Lab backend selector guarantees exactly one mounted/visible A-or-B renderer at any instant;
12. outside the actor hit/move target, native touch scroll, wheel and browser zoom remain uncancelled; no viewport-wide transparent surface uses `touch-action:none`;
13. drag, non-drag single-pointer and keyboard controls resolve to the same target Anchors with usable focus/status;
14. hard zones are never covered after drop or geometry-change resolution; no-fit follows anchor -> dock -> control -> hidden fallback;
15. reduced-motion removes nonessential movement/RAF, forced-colors preserves controls/status, and forced WebGL/load failure leaves semantic controls plus stop/reset usable;
16. `stop()` / `reset()` complete only after the Lab teardown barrier reports zero task-owned listeners, timers, RAF loops, pending-load owners and live contexts; stale callbacks cannot remount/reveal/resume work;
17. A then B execute the identical versioned scenario fixture: same scenario ID/hash, fixed asset, viewport, DPR, clock and warm/cold protocol, and emit the same versioned metrics schema with no preselected winner;
18. 100 synthetic route toggles retain one logical actor ID with bounded resource/context counts, one world-root writer and one mounted/visible backend;
19. required lint/test plus dedicated Lab checks pass; the experimental PR does not weaken existing CI or require a broad production browser matrix solely because the isolated Lab exists.

### Explicit non-goals

Phase 1 does not authorize:

- production `App.tsx` / `SceneShell.tsx` / renderer changes;
- S05 event replay or product-state mutation;
- production Presence Host or render-owner transfer;
- camera/sensor/perception/worker work;
- AI/LLM/dialogue implementation;
- new dependency, server or deployment topology;
- asset activation or candidate promotion;
- auto-merge or deployment.

## 25. Abort criteria

Stop the Phase 1 slice instead of widening scope if:

- the Lab requires editing `App.tsx`, `SceneShell.tsx`, current production renderer behavior or product CSS merely to expose/run the experiment;
- the Lab build must write `web/dist`, enter the default product module graph, or alter Wrangler/deployment configuration;
- current active asset identity cannot be resolved through the read-only membership seam without weakening activation authority;
- a viewport/shared overlay must disable normal page scroll/zoom to make the prototype work;
- the sequential Lab backend selector cannot guarantee exactly one mounted/visible renderer, or the world-root lease cannot independently fence pose writers;
- route transition requires replaying confirmed S05 effects or mutating product state;
- the prototype requires camera/sensors/worker/AI to demonstrate basic relocation;
- pure spatial/lease tests cannot be separated from remote GLB/network;
- keyboard/non-drag, reduced-motion, forced-colors or semantic failure controls regress;
- stop/reset cannot deterministically revoke input/listener/timer/RAF/context ownership;
- A/B comparison cannot use the same scenario and measurement schema;
- measured full-screen rendering and movable-patch rendering are both unsustainable without a safe static/hidden fallback;
- implementation starts creating a generic engine/framework without a tested product need.

An abort is evidence that the slice or assumption must be revised; it is not
permission to weaken the protected invariants or CI assertions.

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
