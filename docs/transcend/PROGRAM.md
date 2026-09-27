# SK7 Transcend long-term program

Status: **CURRENT program authority** for the Transcend / Living City direction.

This document owns long-term product direction and milestone boundaries only. It does **not**
activate production behavior, assets, API/DB/Auth/Model V2 changes, deployment, or release
state. Live `origin/main`, the current GitHub Issue/PR, and `AGENTS.md` remain repository
execution authority.

## Product direction

SK7 now optimizes for a service people want to **enter, touch, hear, revisit, and grow over
time**.

The default experience direction is **3D-first Living City**:

- the normal entry experience should feel like entering a personal place, not opening a
  dashboard;
- movement, touch, animation, sound and spatial discovery are product functionality;
- the classic semantic/text product remains available as fallback and direct-access surface;
- important health information remains reachable through clear semantic UI;
- the long-term loop is a personal city/park that becomes richer through voluntary lifestyle
  actions, routines, observation participation, collection and decoration;
- do not market the experience as a "metaverse";
- do not claim diagnosis, treatment, prevention, or guaranteed blood-pressure improvement.

The product thesis is:

1. **I enter my place.**
2. **I can move and touch things immediately.**
3. **Today has visible destinations and small actions.**
4. **My healthy routines make the world richer over time.**
5. **The city/park becomes mine through decoration, collection and unlocked experiences.**
6. **Important health information is still reachable through clear semantic UI when needed.**

## Product shape

3D-first does **not** mean "move all UI into WebGL".

```text
                   Living City entry
                         |
              stable 3D world shell
        movement / camera / companion / scene
          animation / audio hooks / discovery
                         |
                 explicit product bridge
                         |
semantic routes / forms / reports / navigation / accessibility
                         |
          existing API / Auth / Data / Model boundaries

classic semantic routes remain directly reachable in parallel
```

The stable world shell may create a compelling entry experience before it is allowed to read
protected product state. Product bridges are explicit, reviewed adapters; they are not ambient
access to application stores, network layers, health records, or model output.

The detailed architecture contract is
[SK7 Living City 3D-first product contract](../architecture/SK7_LIVING_CITY_3D_FIRST_PRODUCT_CONTRACT.md).

## Durable invariants

- Existing API, database, authentication, RLS, retention, account-deletion and Model V2
  semantics remain outside world-renderer authority unless separately versioned and reviewed.
- Measured blood pressure, risk/model output, poor health outcomes, missed goals, or similar
  health-result facts never become shame, punishment, scenery decay, reward multipliers, or
  emotional-companion inputs.
- Future world growth may use **voluntary lifestyle actions, routines, observation
  participation, collection and decoration choices** only through explicit product contracts.
- Core semantic tasks remain directly usable when 3D, WebGL/WebGPU, physics, audio, haptics,
  sensors, camera, perception or dialogue are unavailable.
- Renderer/world failure must not mutate product data or convert a health/product task into a
  domain-error state.
- No world transform, product action, persistence state, or bridge output has multiple
  unfenced authoritative writers.
- Camera, microphone and motion sensing remain future explicit opt-in capabilities, never
  prerequisites for the first Living City slices.
- Generated or authored visual assets are supply candidates, not runtime authority. Existing
  manifest/review/activation boundaries remain authoritative.
- Production deployment, destructive data changes, credentials, paid-provider calls and Model
  V2 changes always require their own current-task authorization.

## Foundation evidence: W0-W4

The previous W0-W4 track is retained as foundation evidence, not as the forward product
roadmap.

| Foundation | Result | What it now proves |
| --- | --- | --- |
| W0 | Program authority and bounded research | isolated experimentation discipline |
| W1 | Third-person playable slice | input/camera/render/resource feasibility |
| W2 | Reusable world kernel | stable world/runtime seams |
| W3 | Spatial interaction -> semantic DOM | spatial/semantic bridge feasibility |
| W4 | Living Week alpha | connected landmarks, bounded locomotion and proximity semantics |

W4 validation Issue #803 passed a one-person physical playthrough. It is useful evidence for
locomotion, spatial comprehension and landmark activation. It does **not** prove 3D-first
entry, long-term ownership, sound, world growth, product bridging or production readiness.

The historical W5 wording, "optional product-integration preview", is **retired as automatic
authority**. Do not open or implement old W5 merely because W4 passed.

## Experience Slice model

Forward product work proceeds as **Experience Slices**, not by automatically extending the old
W-number sequence.

For every user-visible Experience Slice, Definition of Done includes as applicable:

- real rendered 3D/UI presentation;
- complete entry -> action -> success state;
- loading / empty / error / recovery behavior that matters to the flow;
- animation or motion feedback;
- pointer + keyboard + touch behavior appropriate to the target devices;
- sound/haptic hook when the product uses it;
- semantic fallback or direct route for important product tasks;
- narrow verification proportional to the changed behavior;
- one actual runtime/browser exercise of the claimed interaction.

Design/UI is part of BUILD. Do not create a separate standing UI-review phase.

## First Experience Slice: E1 Living City Entry Plaza

The first real product slice is **E1 — Living City Entry Plaza**.

Its purpose is to make the service feel different immediately on entry while remaining
reversible and isolated from protected health/data semantics.

E1 contract:

- an explicit preview entry opens the Living City world shell rather than a dashboard-like
  first impression;
- the user can move immediately with the established world input model;
- the companion and Living Week spatial language remain available as continuity from W4;
- one clearly visible **Today Gate** acts as the first destination;
- reaching/activating the gate produces a local, reversible success response through
  presentation/animation and an audio hook;
- the gate may navigate to an existing semantic Today surface through an explicit navigation
  intent, but the world does not read health records, BP, risk/model output or protected
  product state;
- a clear **Open classic Today** direct-access path remains available;
- WebGL/world failure falls back to the semantic path rather than blocking the task.

E1 begins only through its own Issue after this program/architecture contract is merged.

Later slices are not pre-authorized by this document. World growth, richer product bridges,
decoration persistence, collection systems, sensors, dialogue and broader journeys each need
their own bounded Issue and evidence.

## Stable world shell vs. product bridge

### Stable world shell

The stable shell owns presentation/runtime concerns:

- world session and lifecycle;
- locomotion, camera and world coordinates;
- companion embodiment;
- landmarks, scene composition and local environmental effects;
- pointer/keyboard/touch ownership;
- animation, audio and haptic hooks;
- renderer/resource cleanup and fallback signaling.

It does not own health/business semantics.

### Product bridge

A product bridge is a small explicit adapter between a world affordance and one semantic
application capability.

The first bridge class should be navigation-only. Later bridges require separate contracts
for the exact semantic event they consume or produce.

No bridge may silently read measured BP, risk/model output, auth/session internals or arbitrary
application state merely to make the world feel more personalized.

## World growth boundary

Allowed future growth inputs include explicitly confirmed, voluntary events such as:

- a user-chosen routine completed;
- voluntary observation participation;
- a user-selected lifestyle action;
- collection or decoration choices;
- explicit non-medical exploration milestones.

Allowed growth outputs are additive presentation/ownership outcomes such as decorations,
collections, ambient richness, unlocked areas or experiences.

Forbidden growth inputs include measured BP values, BP direction, risk/model output, inferred
health quality, poor outcomes or missed targets. The world must not decay, shame, punish or
withhold delight because of health outcomes.

## Asset and visual-factory strategy

Use the existing visual-factory / manifest / asset-review pipeline as the scalable content
supply path for Living City themes, landmarks, decorations and animation candidates.

Generated content does not become active merely because it exists in the factory. Runtime
selection continues to flow through checked-in manifest/review/activation contracts and
immutable asset identity.

Prefer reusable scene modules, theme tokens, animation clips and bounded content packs over
one-off hard-coded world art.

## Technology policy

Three.js/WebGL remains the current rendering baseline because W1-W4 evidence has already
proved the repository's renderer, input, cleanup and browser path.

Do not trigger an engine rewrite merely because the product direction is more game-like.
Evaluate Babylon.js/Havok, PlayCanvas, WebGPU or a larger-world architecture only when measured
tooling, performance or capability evidence shows a concrete blocker.

## Documentation lifecycle

Do not create a second project-management ledger.

- this file owns long-term Transcend/Living City direction and milestone boundaries;
- the Living City architecture contract owns the stable-shell/product-bridge/growth boundary;
- current task state lives in the task Issue/PR;
- durable alternative decisions use `docs/adr/`;
- device/SHA-specific observations use `docs/evidence/`;
- Git history remains the archive.

Update this document only when the long-term product boundary, milestone model, or durable
world/product strategy changes.
