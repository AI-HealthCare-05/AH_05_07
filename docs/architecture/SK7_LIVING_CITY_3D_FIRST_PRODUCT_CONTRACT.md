# SK7 Living City — 3D-first product architecture contract

Status: **CURRENT architecture contract** for the post-W4 3D-first Living City direction.

Program authority: [SK7 Transcend long-term program](../transcend/PROGRAM.md).

This document defines the boundary between the stable 3D world shell, explicit product
bridges, semantic fallback, world-growth inputs and the first Experience Slice. It does not
authorize production deployment, protected health/data integration, persistence changes or
Model V2 work.

## 1. Architecture goal

The default experience should feel like **entering a personal place** while preserving direct
access to important semantic product tasks.

The architecture therefore keeps two first-class paths:

```text
3D-first entry -> Living City shell -> explicit world-to-semantic intent -> semantic route
direct semantic URL / fallback -----------------------------------------> semantic route
```

Neither path is a degraded copy of the other. The 3D shell owns spatial experience; semantic
routes own forms, reports, health information, accessibility-critical content and existing
product contracts.

## 2. Stable world shell

The stable shell is the long-lived reusable product-facing runtime derived from W1-W4
evidence.

It owns:

- renderer and world lifecycle;
- locomotion, camera, world coordinates and collision bounds;
- companion embodiment and animation;
- scene/landmark composition;
- local ambient motion and visual effects;
- pointer, keyboard and touch interaction;
- audio/haptic hooks and local playback lifecycle;
- loading/error/recovery presentation for world resources;
- deterministic teardown and fallback notification.

It does **not** own authentication decisions, product persistence, RLS/ownership, health
measurements, risk/model output, reports, medical interpretation, or arbitrary navigation
policy. A shell can be richly interactive while completely isolated from protected product
data.

## 3. 3D-first entry and classic fallback

3D-first means the default qualified entry may choose the Living City shell before presenting
dashboard-like UI. It does not mean the classic product disappears.

Required coexistence rules:

1. Important semantic routes keep stable direct URLs.
2. A user can explicitly choose **Open classic Today** from the 3D entry.
3. WebGL/resource/world initialization failure offers the semantic route without destructive
   retries or product-state mutation.
4. Reduced-motion and accessibility settings may reduce world motion while preserving the
   same semantic destinations.
5. No product task is available only through a 3D gesture.

Initial activation remains preview/reversible until a separate production release task says
otherwise.

## 4. Product bridge boundary

A bridge is an explicit, typed adapter. It is not shared access to application state.

The first bridge class is navigation-only:

```ts
type WorldSemanticIntent =
  | { kind: "navigate"; destination: RegisteredSemanticDestination };
```

A registered semantic destination maps to an existing application route. Emitting the intent
does not grant the world access to the route's data.

Future bridges that consume confirmed product events must declare the exact event authority,
read/write direction, lifecycle/session fencing, failure/retry behavior, privacy/persistence
semantics, fallback, and evidence required before activation.

Protected health/data modules are never imported into the renderer merely for convenience.

## 5. World-growth contract

Living City growth is driven by **voluntary participation**, not health outcomes.

Candidate future input events:

```ts
type WorldGrowthInput =
  | { kind: "routine.confirmed"; routineId: string }
  | { kind: "observation.participated"; activityId: string }
  | { kind: "lifestyle-action.confirmed"; actionId: string }
  | { kind: "exploration.completed"; experienceId: string }
  | { kind: "decoration.selected"; decorationId: string };
```

These are architectural examples, not activated product APIs.

Forbidden inputs include measured systolic/diastolic values, BP trend/direction, risk/model
scores or labels, inferred health quality, poor outcomes, and missed targets used as
punishment.

Growth outputs are additive and non-medical: decorations, collections, ambient richness,
visual themes, unlocked places, or optional experiences. No world decay, sadness, shame, loss
or scarcity is driven by health results.

## 6. Asset / theme / animation scaling

The existing visual-factory and checked-in asset authority remain the supply chain.

```text
visual factory / authored source
        -> candidate assets
        -> manifest + verification + review
        -> checked-in activation authority
        -> Living City scene module
```

Rules:

- generation is not activation;
- immutable identity/hash remains reviewable;
- renderers consume registered assets rather than broad candidate inventories;
- themes should be data/config driven where practical;
- landmark/decor/environment modules should share scale/origin/palette contracts;
- animation clips remain explicit capabilities with cleanup ownership;
- first slices prefer existing reviewed assets and procedural primitives over an unbounded new
  asset campaign.

## 7. What W4 evidence carries forward

W4 / #803 gives useful evidence for third-person locomotion, a bounded map containing seven
connected landmarks, weekday landmark differentiation, proximity activation semantics, and a
one-person physical comprehension check.

W4 does **not** provide evidence for 3D-first service entry, product navigation from the world,
sound/haptic comprehension, long-term ownership, decoration persistence, world-growth
motivation, production fallback behavior, or protected product/data bridges.

Those claims require new Experience Slice evidence.

## 8. First product Experience Slice — E1 Living City Entry Plaza

E1 is the first slice opened after this contract is merged.

### Entry

- an explicit preview entry opens a Living City plaza immediately;
- the world is not hidden behind a dashboard;
- the companion is present and movement is immediately available;
- Living Week spatial language may remain visible as continuity.

### Action

- a clearly distinguishable **Today Gate** is visible from the entry area;
- the user can reach it through normal locomotion;
- proximity activation is understandable;
- the gate exposes an explicit semantic action to continue to the existing Today surface.

### Success

- activation produces one local reversible success response;
- motion/animation is included;
- an audio hook exists where audio is enabled;
- the semantic navigation control remains explicit and accessible;
- using the gate navigates through a registered navigation intent only.

### Fallback / recovery

- **Open classic Today** is directly available without completing the 3D interaction;
- world load/error can fall back without reading or mutating protected data;
- leaving/re-entering the preview does not create persistent world-growth state in E1.

### E1 data boundary

E1 may use local shell state, scene configuration, reviewed companion/environment assets,
registered destination identifiers, and explicit navigation intent.

E1 may not use measured BP, risk/model output, report contents, challenge adherence, private
profile/medical state, new DB/schema, or a new auth contract.

### E1 verification

E1 is not done at logic or CI. Minimum evidence includes:

- rendered entry -> movement -> Today Gate -> success state;
- loading/error/recovery behavior for the entry flow;
- keyboard + pointer/touch path appropriate to target devices;
- reduced-motion behavior where motion is nonessential;
- semantic/direct fallback;
- local animation/motion evidence;
- audio hook behavior or explicit muted/no-audio state;
- narrow automated checks;
- one actual runtime/browser exercise.

Physical-device testing is selected from observed risk; production activation remains separate.

## 9. Reversibility and rollout

Until separately authorized:

- Living City entry remains a preview/isolated activation path;
- current semantic product routes remain unchanged;
- no deployment is triggered by merge;
- no DB/schema migration is required;
- rollback is removing/disabling the preview entry while leaving semantic routes intact;
- shell failure cannot corrupt or strand product state.

This allows the world to become visually and interactively ambitious without coupling early
experience work to protected health/data semantics.

## 10. Ownership and writer boundaries

- the shell owns world/render/input state;
- the semantic application owns product state;
- the bridge owns only registered intents/events;
- the visual-factory supplies candidates, not runtime authority;
- each task uses one repository writer/worktree;
- Experience Slices use the normal Issue -> branch -> PR -> required CI -> merge flow.

No later bridge, persistence system or production activation is implied by this contract.
