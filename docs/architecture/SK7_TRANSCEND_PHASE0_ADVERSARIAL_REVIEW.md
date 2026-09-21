# SK7 Transcend Phase 0 — Architecture Adversarial Review

Status: review record; docs-only
Baseline: `9e0fe2ba9434b6762167dbc349ed29860e6196f3`

## 1. Review question

Does the Living Companion Platform architecture remove historical constraints
without replacing them with a larger, harder-to-test source of coupling?

The answer is **yes, conditionally**. The North Star is viable if the first code
slice proves ownership, input arbitration, spatial separation and renderer cost
before production migration.

## 2. Assumptions rejected during review

### A. “The current product is just one tiny canvas” — rejected

The repository contains both legacy companion slots and S02/S10 full-scene
rendering paths. The architectural problem is fragmented ownership and missing
shared presence semantics, not merely canvas dimensions.

### B. “Making the canvas viewport-sized automatically solves freedom” — rejected

A full-screen transparent canvas can simplify world movement but increases fill,
layering and power cost. A movable render patch can reduce fill but complicates
clipping and environment integration. Both need an Interaction Lab comparison.

### C. “S05 browser geometry test is a bad restriction” — rejected

The useful invariant is non-overlap with important content. The slot-specific
wording is historical, but preventing the companion from covering confirmation
and CTA remains correct. Migrate the assertion to projected actor envelope/safe
zones rather than deleting it.

### D. “Camera landmarks mean we understand the user's action” — rejected

Landmarks/static categories are observations. A wave, nod or approach is a
temporal interpretation with confidence, continuity and negative examples.
Emotion/health/identity inference is outside the initial contract.

### E. “WebGPU / Compute Pressure can be mandatory in 2026” — rejected

Both remain non-universal capabilities. The product needs WebGL/WASM/static
fallbacks and latency-based self-measurement even where those APIs exist.

### F. “Persistent companion means persistent camera/GPU work” — rejected

Persistent identity and world state are separate from renderer, perception and
speech resource lifetimes. Hidden/background work should suspend rather than
attempting to defeat browser lifecycle policy.

### G. “The old architecture note forbidding controller redesign is permanent” — rejected

That restriction belonged to a narrowly scoped timer extraction. It is not a
North Star invariant. A replacement ownership contract can supersede it once
characterized and tested.

## 3. High-risk design points

### Input ambiguity

A freely draggable actor competes with page scroll, form input and browser zoom.
A global overlay with `touch-action:none` would be unacceptable. The first lab
must prove actor-local capture and a non-drag relocation alternative.

### Render-owner transfer

The existing product can render a legacy companion, a saved-scene character or
a full scene. A platform migration that creates a second live representation of
the same logical actor will produce duplicated animation, requests and lifecycle
bugs. Owner acquisition/release must be a formal protocol before cross-scene
persistence ships.

### Spatial envelope

Idle mesh bounds are insufficient for collision. Celebrate, tail/limb motion and
hit padding can leave the canvas or overlap UI even when the actor root is safe.
The spatial service needs a conservative projected envelope per embodiment
profile or measured action envelope.

### Asynchronous stale results

Camera permission, GLB loads, workers, dialogue and renderer preparation can
finish after route/account/session changes. Generation/epoch checks are required
at every async delivery boundary.

### Perception CPU/GPU competition

3D rendering and camera inference contend for device resources. Running face,
pose and gesture continuously from day one would make failures hard to classify.
Start with one hand capability and independent sampling/governor metrics.

### Test contamination by remote assets

Remote asset availability belongs to a bounded integration lane. Spatial and
behavior correctness must remain testable with a local/synthetic embodiment.
Otherwise CI remains slow and transient network/load failures obscure geometry
regressions.

## 4. Architecture decisions accepted for Phase 0/1

1. Product/platform scope is intentionally larger than `Companion Runtime v2`.
2. Logical presence is owned above route-local renderers.
3. Arena coordinates are independent from renderer canvas coordinates.
4. Root/world locomotion is distinct from local tactile deformation.
5. Inputs emit normalized observations; renderers never receive raw camera or
   device events directly.
6. Behavior uses explicit channel leases and deterministic priority before any
   optional language model involvement.
7. Camera/motion/voice are independent opt-in capabilities, not dependencies of
   basic companion interaction.
8. Asset activation authority remains outside behavior/perception.
9. Rendering backend is deliberately undecided until the lab compares movable
   patch and shared stage under the same scenario.
10. First code is an isolated Interaction Lab; production screens stay untouched.

## 5. Decisions deliberately deferred

- permanent rendering backend;
- exact framework/library for behavior trees (none by default);
- MediaPipe vs another perception implementation beyond the first bounded lab;
- native wrapper / WebView bridge;
- face-derived behaviors;
- full-body pose product experience;
- speech recognition provider;
- persistent user placement across browser sessions;
- multi-companion/multi-actor support.

These are not omissions. They are decisions that require measurements or a
concrete product scenario.

## 6. Evidence required before first production migration

The Interaction Lab should produce at least:

- frame-time and long-task traces for both render strategies;
- actor hit/visual envelope and safe-zone overlays at 320, 390 and desktop widths;
- pointer scroll-vs-drag recordings on touch emulation and at least one physical mobile device;
- 100 route-state transition stress result;
- renderer/context/resource counts before/after repeated mount/unmount;
- accessibility check for drag-free relocation;
- network audit showing no unexpected API/asset/perception requests;
- explicit result of old invariant mapping: what production behavior remains unchanged.

## 7. Codex independent review focus

Codex should challenge source truth and migration mechanics:

- enumerate exact current renderer/animation/input/resource owners from latest main;
- prove which React ancestors survive screen changes;
- identify actual clipping/stacking/overflow chains per current route;
- identify all tests that encode slot/owner semantics;
- find stale async callbacks and cleanup hazards in GLB/mixer/input paths;
- review whether the proposed first lab can be isolated without changing product runtime;
- propose the smallest file set that proves Arena/Actor separation;
- do not expand into camera/AI implementation during Phase 1.

## 8. Kimi independent review focus

Kimi should attack product/system assumptions:

- identify confusing touch/scroll/drag grammars and simpler alternatives;
- challenge whether persistent movement adds value on every screen;
- enumerate worst mobile battery/thermal/camera permission failure modes;
- find privacy leaks even when raw frames are not uploaded;
- challenge the behavior arbitration model with simultaneous events;
- propose minimal experiments that can falsify the rendering strategy quickly;
- detect architecture that is becoming a generic engine without product value.

## 9. Phase 1 stop/go gate

GO only if both independent reviews agree that the lab can be built without
changing current production behavior and no unresolved asset/lifecycle invariant
is being silently bypassed.

STOP if either review demonstrates that the proposed host would require a broad
App/scene rewrite before an isolated lab can exist. In that case design a
smaller harness/tool route first.
