# SK7 Transcend Phase 2 — Presence Host Foundation

Status: implementation candidate; no merge, deployment, R2 mutation, renderer
migration or visual activation authorized by this document.

Reviewed implementation baseline: `2b0f810a1da8b98a28d121a84df3650f9a25174e`.

## Purpose

Phase 2 introduces a **shadow logical host** above existing companion/scene
owners while keeping every existing production render path authoritative.

The host does not mount, reveal, hide, move, load or dispose a renderer. It
records one logical actor, session/route/Arena epochs, a carried placement
intent, and a fenced rehearsal token describing the owner already selected by
current product policy.

## New boundaries

- `companionPresenceKernel.ts`: logical actor + deterministic epochs + shadow
  owner token. Session replacement clears placement intent. Route change carries
  placement intent but resets Arena revision.
- `s02PresenceArena.ts`: measures only explicit S02 geometry from the visual
  viewport coordinate space. It registers the new #709 scene frame as
  `today-sidecar` and primary CTA/navigation/dialog/notice surfaces as hard
  zones.
- `CompanionPresenceHostBridge.tsx`: observes current product ownership and
  publishes a hidden diagnostic marker for browser contract tests. It has no
  renderer authority and performs no network I/O.

## Existing owner authority remains

The shadow owner is derived only after current source has already made its
decision:

- S02/S10 visible `VisualStage` → `full-scene`;
- current allowed S05 saved scene → `saved-scene`;
- current legacy selection → `legacy-slot`;
- otherwise → `none`.

`VITE_SK7_COMPANION_MODE=off` always produces `none`.

The hidden host cannot make an excluded screen eligible and cannot replay an S05
event.

## Fail-closed identity

Logical identity resolves only through `getActiveCompanionAsset()` and is
decorative. A registry mismatch yields no logical actor rather than weakening
asset authority.

Observed legacy review assets may be catalog descriptors, but they are recorded
only as **observed owner identity**; they do not replace the logical active
asset authority.

## Handoff rehearsal

Each observed owner incarnation receives a deterministic shadow token containing
session epoch, route epoch, owner generation, owner kind and observed asset ID.

This token does not control the renderer. Its purpose is to prove the later
activation-token semantics before migration:

- route/session/owner/asset changes fence the old token;
- stale release cannot clear a newer token (ABA safety);
- one logical actor can survive ownerless routes;
- placement intent crosses route epochs but not session replacement.

## S02 Arena provider

The #709 bounded showcase scene is the first explicit production spatial seam.

For visible S02 profiles:
- anchor: `today-sidecar` = `[data-scene-reserved-box="true"]`;
- hard zone: lead CTA;
- hard zone: primary navigation;
- hard zone when visible: active modal;
- hard zone when visible: active notice.

The adapter uses `visualViewport.offsetLeft/offsetTop/width/height`, matching the
Phase 1 canonical coordinate contract. It does not use DPR scaling and it does
not scan arbitrary DOM every frame.

Enabled-mode resize, scroll and explicit-zone DOM invalidations coalesce behind
one cancellable 16 ms shadow refresh timer. The host never joins the renderer
animation-frame lifecycle, and cleanup removes every listener, observer and
pending timer. Off mode installs no geometry timer or resize/scroll listener.

320x568 intentionally publishes no S02 scene anchor when #709 suppresses the
heavy visual. Semantic UI remains complete.

## First visible spatial migration decision

### Selected candidate: S02, conditional on actor/environment separation

S02 is the best first **candidate** because:

- #709 now gives it one bounded, stable visual seam;
- current full-scene ownership already exists there, so a future migration need
  not invent a new health or product action;
- there is no S05 one-shot save replay contract;
- S02 has the simplest primary hard zones and a strong rollback to poster/CSS;
- Phase 1 direct placement already matches the visual-viewport coordinate model.

The reviewed source confirms this is conditional rather than migration-ready:
`sceneRecipes.findSceneRecipe` requires both an environment asset and a character
asset, while the checked-in S02 poster provenance identifies the registered
bear-lite as part of each render. `savedScene.ts` and `SavedSceneRenderer.tsx`
retain the S05 one-shot event and fixed bear, and `ThreeSceneRenderer.tsx`
retains S10 `day-focus` look behavior.

### Blocking condition before visible migration

Current S02 posters/full-scene recipes include the companion as part of the
approved scene composition. Adding a standalone Presence actor before separating
environment and actor ownership would create duplicate characters.

Therefore Phase 3 must **not** simply overlay a new actor on current S02 art.

The next slice after this foundation should characterize and prototype an
environment-only S02 owner (or another equivalent single-owner decomposition)
without R2 mutation first. Only after visual acceptance may a separately
authorized content-addressed asset publication be considered.

### Why not S05 first

S05 has a confirmed-save one-shot/no-replay invariant and a fixed bear
presentation path. It is a higher-risk owner-transfer surface.

### Why not S10 first

S10 adds day-focus attention/look behavior and a denser recap interaction
surface. It is a useful second migration after S02 owner separation.

## Explicit non-goals

No:
- visual change;
- new canvas or GLB request;
- renderer migration;
- direct manipulation in production;
- new dependency;
- API/DB/Auth/RLS/Model V2 change;
- sensor/camera/worker/AI;
- R2 write/cache/CORS change;
- merge or deploy.
