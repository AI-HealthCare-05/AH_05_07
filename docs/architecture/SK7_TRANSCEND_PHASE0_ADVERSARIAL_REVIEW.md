# SK7 Transcend Phase 0 — Independent Adversarial Architecture Review

Status: independent review record; documentation only
Reviewed source baseline: `9e0fe2ba9434b6762167dbc349ed29860e6196f3`
Review date: 2026-09-22
Decision scope: **Phase 1 Interaction Lab only**
Recommendation: **REVISE**

## 0. Scope, preflight and decision summary

`origin/main` was fetched and resolved to
`9e0fe2ba9434b6762167dbc349ed29860e6196f3`. That source, not older
architecture prose, is the authority for every current-state statement below.
The only open work found in the companion/scene architecture scope was
[PR #705](https://github.com/AI-HealthCare-05/AH_05_07/pull/705), backed by
[issue #704](https://github.com/AI-HealthCare-05/AH_05_07/issues/704); no
parallel open implementation PR for a new presence host, arena or renderer was
found.

The proposed direction is viable, but Phase 1 is not ready to implement exactly
as written. The North Star correctly separates logical presence from renderer
lifetime and correctly defers a production rendering choice. It does not yet
define:

- a build/runtime isolation boundary strong enough for a genuinely
  non-production lab;
- a coordinate and invalidation contract precise enough to make Arena, Anchor
  and Actor state safe across routes;
- lease token, epoch, composition and revocation semantics sufficient to
  guarantee one writer; or
- the baseline characterization needed to distinguish preserved behavior from
  behavior intentionally retired.

These are bounded revisions. They do not require a broad `App`/scene rewrite,
so the recommendation is not STOP. This review does not rate the project
globally and does not authorize a production migration, merge or deployment.

## 1. Exact current ownership and lifecycle graph

### 1.1 Runtime graph

```text
web/index.html
  -> web/src/main.tsx
     -> React StrictMode
        -> App                                      one root
           |
           +-- unauthenticated branch
           |    -> Login
           |       -> LoginCompanionNarrator
           |          -> CompanionRuntimeBoundary
           |             -> CompanionReviewRenderer
           |
           +-- authenticated/evidence branch
                -> persistent App state + history-based requestedScreen
                   -> SceneShell                    stable JSX position
                      -> app-shell
                         +-- header
                         +-- scene-viewport
                         |    |
                         |    +-- shell decoration owner, exactly one branch:
                         |    |    +-- SavedSceneBoundary[event.key]
                         |    |    |    -> SavedSceneRenderer
                         |    |    +-- CompanionRuntimeBoundary
                         |    |         -> CompanionReviewRenderer
                         |    |         (direct child, or injected into S05
                         |    |          through SceneCompanionContext)
                         |    |
                         |    +-- renderScene() route subtree
                         |         +-- ordinary semantic Scene
                         |         +-- S02 JourneyToday -> VisualStage
                         |         |                    -> SceneRuntimeBoundary
                         |         |                    -> ThreeSceneRenderer
                         |         +-- S10 JourneyRecap -> VisualStage
                         |                              -> SceneRuntimeBoundary
                         |                              -> ThreeSceneRenderer
                         +-- primary navigation
```

Evidence:

- The browser has one default entry and one React root:
  `web/index.html:13-15` and `web/src/main.tsx:48-52`.
- `App` returns the login branch before the authenticated shell:
  `web/src/App.tsx:1214-1232`. The narrator creates its own runtime boundary:
  `web/src/components/LoginCompanionNarrator.tsx:16-46`.
- Navigation changes history and `requestedScreen` inside the same `App`
  instance rather than mounting a router root:
  `web/src/App.tsx:675-748`.
- The authenticated `SceneShell` occupies one stable JSX position around
  `renderScene()`: `web/src/App.tsx:2138-2160`.
- `SceneShell` chooses saved versus legacy ownership, and either renders the
  companion directly or injects it into the S05 subtree:
  `web/src/components/SceneShell.tsx:22-25` and
  `web/src/components/SceneShell.tsx:90-118`.
- S02 and S10 mount `VisualStage` inside their route subtrees:
  `web/src/components/JourneyToday.tsx:79` and
  `web/src/components/JourneyRecap.tsx:127`.

### 1.2 Current owners

| Concern | Current owner and exact fact | Evidence |
| --- | --- | --- |
| Requested route | `App` parses history, mutates `requestedScreen` and computes a truthful `activeScreen`. | `web/src/App.tsx:675-748`, `web/src/App.tsx:1281-1297` |
| Session epoch | `App.applySession` increments `sessionIdentityRef.generation` only when the user id changes, clears saved presentation state and resets the requested screen. | `web/src/App.tsx:475-525` |
| Saved non-medical species preference | `companionIdentity.ts` validates one of 11 species and stores it in local storage; this preference is not account-scoped. | `web/src/ui/companionIdentity.ts:3-17`, `web/src/ui/companionIdentity.ts:24-58`, `web/src/App.tsx:379` |
| Selection and scene suppression | `App` decides whether S02/S10 full-scene ownership suppresses the legacy selection, then calls the production or review selector. | `web/src/App.tsx:1288-1341` |
| Review/production behavior policy | `companion.ts` owns allowed screens, selection shape, production S05/S10 profiles and clip/context policy. It explicitly excludes health/model inputs. | `web/src/ui/companion.ts:26-56`, `web/src/ui/companion.ts:89-131`, `web/src/ui/companion.ts:144-178`, `web/src/ui/companion.ts:193-214` |
| Shell placement and saved/legacy choice | `SceneShell` owns direct versus inline placement and saved-scene precedence. It passes session generation only to journey transition, not to a companion renderer. | `web/src/components/SceneShell.tsx:43-57`, `web/src/components/SceneShell.tsx:90-118` |
| Legacy descriptor and renderer admission | `CompanionRuntimeBoundary` resolves runtime mode, looks up a review asset or verified active production asset, derives tactile/look flags, and owns lazy/error containment. | `web/src/components/CompanionRuntimeBoundary.tsx:17-56`, `web/src/components/CompanionRuntimeBoundary.tsx:57-109` |
| Legacy WebGL lifecycle | One construction effect owns scene, camera, renderer, GLTF load, model, mixer, actions, resize observer, RAF, tactile controller, look controller and teardown. | `web/src/components/CompanionReviewRenderer.tsx:88-178`, `web/src/components/CompanionReviewRenderer.tsx:243-445`, `web/src/components/CompanionReviewRenderer.tsx:451-469` |
| Legacy animation composition | Each frame removes prior look offsets, advances the mixer, advances tactile root deformation, reapplies look offsets, renders, then schedules the next RAF. | `web/src/components/CompanionReviewRenderer.tsx:139-147`; `web/src/components/companionLook.ts:180-243` |
| Pointer/tactile input | `companionInteraction.ts` listens on the renderer host's parent slot, treats the whole canvas rectangle as head/body/feet bands, captures the pointer and writes model position/scale/rotation around a local home pose. | `web/src/components/companionInteraction.ts:75-125`, `web/src/components/companionInteraction.ts:145-190`, `web/src/components/companionInteraction.ts:240-311` |
| Attention input | `companionLook.ts` owns window/document pointer, replay, blur and visibility listeners and writes additive head/spine offsets. | `web/src/components/companionLook.ts:149-178`, `web/src/components/companionLook.ts:180-277` |
| S05 one-shot fact | The saved event owns one process-local serial and one irreversible `claim/skip` opportunity; it carries no record/account/request identity. | `web/src/ui/savedScene.ts:3-28` |
| Saved S05 lifecycle | `SavedSceneBoundary` owns intersection/visibility admission and timeout. `SavedSceneRenderer` owns fetch/hash verification, parse, animation, bounded RAF, abort and context teardown. | `web/src/components/SavedSceneBoundary.tsx:14-64`, `web/src/components/scene/SavedSceneRenderer.tsx:9-23`, `web/src/components/scene/SavedSceneRenderer.tsx:33-176` |
| S02/S10 scene lifecycle | `VisualStage` resolves a plan, binds an authorized identity, owns poster/runtime handoff and keys by recipe plus character URL. `ThreeSceneRenderer` owns the scene context, load, GPU fence/poll, replay attention and teardown. | `web/src/components/VisualStage.tsx:49-93`, `web/src/components/VisualStage.tsx:96-133`, `web/src/components/scene/ThreeSceneRenderer.tsx:56-110`, `web/src/components/scene/ThreeSceneRenderer.tsx:280-417` |
| Active asset authority | A lite descriptor is active only when generated catalog identity agrees with the checked-in scene registry. The runtime-membership projection labels lite identities active, standard identities catalog-only and arbitrary/candidate ids unknown. | `web/src/ui/companionActiveAsset.ts:5-18`, `web/src/ui/companionSceneRegistry.ts:16-54`, `web/src/ui/companionRuntimeMembership.ts:35-63`, `web/e2e/companion-runtime-membership.spec.ts:23-105` |

There is no current shared logical actor object above all three dynamic render
paths. There is, however, already deliberate host policy preventing the normal
S02/S10 full-scene owner and the legacy owner from rendering together:
`web/src/App.tsx:1303-1341`. A migration must preserve that invariant before it
tries to generalize ownership.

## 2. Route changes and mount/unmount behavior proven by source

| Transition/state change | Current behavior | Evidence and implication |
| --- | --- | --- |
| Ordinary screen navigation | `App` and `SceneShell` remain mounted; only state and the `renderScene()` child change. | `web/src/App.tsx:726-748` and `web/src/App.tsx:2138-2160`. Route visit is not equivalent to root lifetime. |
| Eligible legacy screen to another eligible legacy screen with the same URL/species/variant/framing/interaction/look/reduced-motion inputs | The same renderer effect and canvas can survive. `selection.screen`, `selection.clip` and `selection.sequence` are not all construction dependencies; clip/sequence use a second play effect. | `web/src/components/CompanionReviewRenderer.tsx:465-469`. Existing continuity evidence covers an unrelated parent rerender, not a direct S02→S03 transition: `web/e2e/companion-review.spec.ts:718-753`. |
| Eligible legacy screen to an excluded screen | `CompanionRuntimeBoundary` remains at the shell position but returns `null`, so `CompanionReviewRenderer` unmounts and runs cleanup. Returning mounts a new renderer/canvas. | `web/src/components/CompanionRuntimeBoundary.tsx:57-60` and `web/src/components/CompanionReviewRenderer.tsx:451-464`. The same-document removal path is exercised at `web/e2e/companion-review.spec.ts:666-716`. |
| S04 before confirmed save | No GLB is loaded; only the lazy renderer module may be warmed. | `web/src/components/SceneShell.tsx:75-88` and `web/src/components/CompanionRuntimeBoundary.tsx:33-36`; asserted at `web/e2e/companion-production.spec.ts:57-72`. |
| Journey S05 legacy presentation | The companion moves from the shell's direct-child position into `save-ripple` through context and uses `journey-s05` framing. That is a different parent position, so the renderer is mounted for the inline presentation. | `web/src/components/SceneShell.tsx:90-118`, `web/src/App.tsx:1815` and `web/src/components/journey-candidate.css:674-676`. |
| Saved-scene S05 | `SavedSceneBoundary key={event.key}` replaces the legacy branch. Leaving skips the opportunity and unmounts its renderer; return can show idle for the already-consumed event but cannot replay celebration. | `web/src/components/SceneShell.tsx:90-94`, `web/src/components/SavedSceneBoundary.tsx:29-54`, `web/src/ui/savedScene.ts:11-23`; `web/e2e/saved-scene-review.spec.ts:215-235`. |
| S02/S10 full scene | `VisualStage` is route-local. Plan tier changes reset its boundary; recipe or character URL changes reset the keyed scene runtime. Route exit invokes disposal and explicit context loss. | `web/src/components/VisualStage.tsx:89-93`, `web/src/components/VisualStage.tsx:114-133` and `web/src/components/scene/ThreeSceneRenderer.tsx:401-417`; `web/e2e/diorama-scene-review.spec.ts:246-270` and `web/e2e/s10-production-scene.spec.ts:224-239`. |
| Seoul date recipe change | The active route subtree/scene key is replaced; the old canvas is not retained. | `web/src/App.tsx:1639`, `web/src/components/VisualStage.tsx:132` and `web/e2e/seoul-date-rollover.spec.ts:132-155`. |
| Report presentation | The authenticated app and `SceneShell` are not unmounted; their ancestor is set to HTML `hidden` and the report is rendered beside it. | `web/src/App.tsx:2140-2162`. This does not by itself stop the legacy renderer RAF. |
| Same-user token refresh | `applySession` preserves identity generation and most mounted presentation state. | `web/src/App.tsx:475-488`. |
| Different non-null user id | `applySession` increments generation and resets product state, but generation is not a key or prop for the legacy/saved renderer. If React stays in the authenticated branch and the resulting companion props match, source does not guarantee a renderer remount. | `web/src/App.tsx:491-525` versus `web/src/components/SceneShell.tsx:43-57` and `web/src/components/SceneShell.tsx:90-95`. This is a missing characterization/security-boundary assertion, not proof that stale clinical data enters the renderer. |
| Sign-out to no session | `App` switches to the login branch, unmounting `SceneShell` and all of its renderers; a separate login narrator may then mount. | `web/src/App.tsx:1216-1232`. |

## 3. Clipping, stacking and interaction ownership facts

### 3.1 Current stacking/clipping chain

```text
.app-shell                         position: relative; overflow: clip
  .app-header                      z-index: 4
  .scene-viewport                  z-index: 2 (local stacking context)
    .companion-runtime-slot        absolute; local z-index: 3
    .scene                         overflow: clip (or visible in Journey CSS)
      semantic scene children      local z-index: 1
      .living-visual-stage         overflow: hidden; isolation; pointer-events:none
  .primary-nav                     z-index: 5 desktop; fixed z-index: 10 mobile
```

Consequences proven by the CSS:

- The legacy/saved slot is above ordinary scene content within the viewport but
  remains below the header and navigation stacking contexts. It is still clipped
  by `.app-shell` even where Journey changes `.scene` to `overflow: visible`:
  `web/src/styles.css:153-200`,
  `web/src/components/journey-candidate.css:1-3` and
  `web/src/styles.css:402-435`.
- The default slot is a fixed-size, bottom-end absolute box. S05 has both a
  generic top-right rule and a Journey inline override sized for celebrate:
  `web/src/styles.css:194-198` and
  `web/src/components/journey-candidate.css:674-676`.
- Saved S05 geometry depends on a direct-child structural selector and has
  viewport-specific `:has(.journey-saved)` overrides:
  `web/src/components/journey-candidate.css:56` and
  `web/src/components/journey-candidate.css:79-112`.
- Full scenes cannot currently become a page-wide interaction surface:
  `.living-visual-stage` clips its children, isolates stacking and has
  `pointer-events: none`:
  `web/src/components/scene/scene-stage.css:1-27`.
- S02 stretches a route-local scene frame to 135% within its hero composition,
  while S10 intentionally constrains the stage to roughly 3.75–6 rem:
  `web/src/components/journey-today.css:21-33`,
  `web/src/components/journey-today.css:99-119`,
  `web/src/components/journey-recap.css:445-489` and
  `web/src/components/journey-recap.css:886-958`.

### 3.2 Current hit ownership

The current pointer target is the entire slot, not the visible mesh. The input
controller chooses `surface = host.parentElement`, installs capture-phase
listeners on it, sets `pointer-events:auto` and `touch-action:none`, and derives
head/body/feet from vertical canvas ratios. A ray-plane intersection supplies
local movement, but there is no mesh hit-test admission:
`web/src/components/companionInteraction.ts:75-125`,
`web/src/components/companionInteraction.ts:145-177` and
`web/src/components/companionInteraction.ts:240-255`.

That behavior is acceptable only because the slot is small and bounded. Copying
it to a viewport-sized transparent stage would turn most of the viewport into a
scroll/zoom-blocking hit surface. Phase 1 therefore needs a separate actor hit
envelope or explicit move handle; it cannot inherit current slot event ownership.

## 4. Tests coupled to slot semantics

The following tests would fail or become meaningless if `.companion-runtime-slot`
topology, whole-slot hit semantics or slot-local framing were removed without a
deliberate replacement assertion.

| Test evidence | Encoded slot contract that must be migrated |
| --- | --- |
| `web/e2e/companion-review.spec.ts:249-280` | Slot/canvas is the interactive target; whole-box pointer input moves the local model and springs home without product-state mutation. |
| `web/e2e/companion-review.spec.ts:282-444` | Fixed canvas-height bands select head/body/feet; touch interaction requires slot `touch-action:none` and a 300 ms post-release reaction hold. |
| `web/e2e/companion-review.spec.ts:613-716` | Pointer cancel/lost capture and removal of the slot owner clean pending reaction state. |
| `web/e2e/companion-review.spec.ts:718-753` | The exact canvas and one GLB request survive an unrelated parent rerender. |
| `web/e2e/companion-review.spec.ts:897-929` | Default slot stays within the S02 scene; S05 slot does not overlap title/action. The S02 layout case notably does **not** wait for renderer readiness. |
| `web/e2e/companion-production.spec.ts:57-106` | Production S05 expects exactly one legacy slot/canvas, inline Journey selector, `journey-s05` framing, one celebrate, then whole-slot tactile enablement. |
| `web/e2e/companion-production.spec.ts:108-154` | S05 enables the current pointer surface only after celebrate settles. |
| `web/e2e/companion-production.spec.ts:310-343` | The slot is inside S05 and clear of CTA and fixed navigation at three widths. |
| `web/e2e/saved-scene-review.spec.ts:99-104`, `web/e2e/saved-scene-review.spec.ts:353-376` | Saved presentation still exposes exactly one `.companion-runtime-slot` and uses that rectangle for keyboard/nav overlap checks. |
| `web/e2e/saved-scene-review.spec.ts:215-235`, `web/e2e/saved-scene-review.spec.ts:378-429` | Saved canvas identity, one-shot behavior, offscreen suspension and context release are tied to the current boundary. |
| `web/e2e/saved-scene-review.spec.ts:431-499` | Route visits create/collect one canvas per current owner and a delayed saved-renderer chunk cannot mount late. |
| `web/e2e/companion-candidate-screen-integration.spec.ts:660-723` | The S01 narrator expects the slot and canvas nested inside the login character container. |

Tests that are not slot-shaped but are mandatory replacement invariants:

- S02/S10 have one dynamic companion owner:
  `web/e2e/living-scene-review.spec.ts:371-489` and
  `web/e2e/s10-production-scene.spec.ts:85-239`.
- S02/S10 route exits release contexts:
  `web/e2e/diorama-scene-review.spec.ts:246-270`.
- Reduced motion yields a static/no-loop or poster-only result:
  `web/e2e/companion-review.spec.ts:866-876`,
  `web/e2e/living-scene-review.spec.ts:795-803` and
  `web/e2e/s10-production-scene.spec.ts:181-200`.
- S05 confirmation is one-shot and cannot be reconstructed by URL, refresh,
  back/forward, motion changes or late mutation completion:
  `web/e2e/saved-scene-review.spec.ts:123-342` and
  `web/e2e/saved-scene-review.spec.ts:486-521`.

The right migration is not to retain a fake slot forever. It is to replace these
assertions with Actor visual/hit envelopes, hard-zone non-overlap, one active
owner, one-shot action semantics and deterministic resource cleanup.

## 5. Stale async and cleanup risks

### 5.1 Risks requiring characterization

1. **Session generation does not reach companion ownership.** `App` increments
   generation on account replacement, but `SceneShell` uses it only for
   `useJourneyTransition`. Neither legacy nor saved companion receives the
   generation: `web/src/App.tsx:491-525` and
   `web/src/components/SceneShell.tsx:43-57`. A future presence host must key all
   leases, async deliveries and render ownership by session epoch before any
   cross-route persistence is introduced.

2. **An eligible-to-eligible route can retain local tactile/reaction state.**
   The renderer construction effect excludes `selection.screen`, clip and
   sequence, while `latestSelectionRef` deliberately lets callbacks consult the
   newest screen: `web/src/components/CompanionReviewRenderer.tsx:82-87` and
   `web/src/components/CompanionReviewRenderer.tsx:451-469`. Whether active
   capture, spring return and reaction should cross a route is currently
   untested.

3. **Report visibility is not renderer suspension.** The product hides the
   mounted app with `hidden`, but the legacy render loop only checks its local
   `disposed` flag and schedules RAF continuously:
   `web/src/App.tsx:2140-2162` and
   `web/src/components/CompanionReviewRenderer.tsx:139-147`. This can spend
   rendering work behind the report and gives a future “presence” lifecycle no
   explicit semantic suspension signal.

4. **Pointer-capture cleanup has an ordering hazard.** Renderer cleanup calls
   `controller.dispose()` before `interaction.dispose()`:
   `web/src/components/CompanionReviewRenderer.tsx:451-460`.
   `interaction.dispose()` sets `disposed`, then releases capture while the
   `lostpointercapture` listener is still installed; `cancel` itself has no
   `disposed` check and can call `onReleaseZone`:
   `web/src/components/companionInteraction.ts:230-238` and
   `web/src/components/companionInteraction.ts:313-347`. If the browser
   dispatches lost capture during release, it can schedule a new reaction timer
   after the controller canceled its timers. This is a source-supported race
   hypothesis, not a claimed reproduced defect.

5. **Legacy GLTF work is not abortable and the context is not explicitly lost.**
   Late success is guarded and its scene is disposed, which prevents a late
   mount, but the request/parse continues after unmount. Cleanup calls
   `renderer.dispose()` without `forceContextLoss()`:
   `web/src/components/CompanionReviewRenderer.tsx:177-192` and
   `web/src/components/CompanionReviewRenderer.tsx:451-464`. This is weaker than
   both scene renderers and needs a repeated-transition/context test before a
   longer-lived host is built.

### 5.2 Existing cleanup strengths to preserve

- The legacy load callback checks `disposed` and disposes a late GLTF scene;
  its fail path also checks `disposed`:
  `web/src/components/CompanionReviewRenderer.tsx:132-147` and
  `web/src/components/CompanionReviewRenderer.tsx:177-192`.
- Legacy teardown cancels RAF, disconnects resize observation, cancels animation
  timers/actions and removes tactile/look listeners:
  `web/src/components/CompanionReviewRenderer.tsx:451-464`,
  `web/src/components/companionReactionRelease.ts:9-33` and
  `web/src/components/companionLook.ts:246-277`.
- Saved S05 aborts fetch, guards parse completion, cancels RAF/timeouts and
  explicitly loses its context:
  `web/src/components/scene/SavedSceneRenderer.tsx:33-83`,
  `web/src/components/scene/SavedSceneRenderer.tsx:110-173`.
- Full scenes cancel GPU polling/fences, guard late GLTF completion and force
  context loss:
  `web/src/components/scene/ThreeSceneRenderer.tsx:91-110`,
  `web/src/components/scene/ThreeSceneRenderer.tsx:280-330` and
  `web/src/components/scene/ThreeSceneRenderer.tsx:380-417`.

## 6. Critique of Presence Kernel, Arena, Anchor and Actor

### Presence Kernel

The proposed `CompanionPresence` combines four lifetimes that should not be one
mutable record: identity (`sessionEpoch/actorId/assetId`), route projection
(`routeEpoch/worldPose`), behavior runtime (`activeLeases`), and presentation
lifecycle. The proposal appears at
`docs/architecture/SK7_LIVING_COMPANION_PLATFORM_NORTH_STAR.md:118-143`.

Required correction:

- Keep immutable/slow identity separate from route-scoped placement.
- Make `worldPose` carry `arenaId`, `arenaRevision` and `anchorId` (or an
  explicit unanchored state). An untagged CSS-pixel pose is stale as soon as the
  layout, scroll container, virtual keyboard or route changes.
- Keep the lease table in the arbiter, not serialized into logical presence.
  Presence may expose a read-only snapshot for diagnostics.
- Define three independent revocations: session epoch destroys all ownership;
  route epoch invalidates route anchors/obstacles and route-scoped leases;
  renderer generation rejects late renderer work without destroying identity.
- Preserve species/asset identity only through current active membership. A
  catalog or Learning Record identifier must not become activation authority:
  `web/src/ui/companionRuntimeMembership.ts:39-63`.

### Arena

“Aligned with the currently visible app viewport” is not a sufficient canonical
space while the same section lists layout, visual and document coordinates:
`docs/architecture/SK7_LIVING_COMPANION_PLATFORM_NORTH_STAR.md:145-162`.
The current app has document scroll, an `overflow:clip` app shell, a fixed mobile
nav and route-local scene stages:
`web/src/styles.css:153-194` and `web/src/styles.css:402-435`.

Phase 1 must choose one canonical coordinate space and version every transform.
Recommended lab contract:

- canonical world pose: document CSS pixels relative to one lab arena element;
- visible/legal region: intersection of arena bounds and current
  `VisualViewport` after safe-area/fixed-obstacle subtraction;
- every projection result tagged with `arenaRevision`;
- revision changes on resize, visual viewport resize/scroll, arena scroll,
  registered obstacle change and synthetic route change;
- stale-revision drops are observable and deterministic.

This is a lab choice, not yet a production backend decision.

### Anchor

The examples are useful, but the current proposal lacks lifecycle and collision
semantics. An Anchor contract needs:

- route/arena namespace and epoch;
- a semantic id plus allowed actor profiles;
- geometry source and revision;
- priority and deterministic fallback order;
- availability/occlusion state;
- explicit registration disposal; and
- a rule for reprojecting or abandoning a pose when its anchor disappears.

Without those fields, “preserve pose across routes” conflicts with “route change
invalidates route-owned anchors” in the North Star:
`docs/architecture/SK7_LIVING_COMPANION_PLATFORM_NORTH_STAR.md:137-139` and
`docs/architecture/SK7_LIVING_COMPANION_PLATFORM_NORTH_STAR.md:729-740`.
The safe rule is to preserve placement intent (`anchor role + normalized
preference`), then resolve a fresh pose in the next Arena. Do not preserve stale
CSS pixels.

### Actor

One combined “visual/hit envelope” is insufficient. The current whole-slot hit
box is deliberately more forgiving than the rendered mesh:
`web/src/components/companionInteraction.ts:95-101`. The new Actor needs at
least:

- a conservative visual/action envelope, including celebrate/limb/tail motion;
- a separately sized hit envelope or move handle;
- a world root transform;
- renderer-local normalization and tactile deformation; and
- an embodiment profile/version used by deterministic placement tests.

Safe-zone checks use the conservative visual envelope. Pointer admission uses
the hit envelope. Neither may be inferred from an idle mesh bound alone.

## 7. Critique of channel-lease arbitration

The North Star's priority order is reasonable, but its example channels do not
yet describe exclusive outputs:
`docs/architecture/SK7_LIVING_COMPANION_PLATFORM_NORTH_STAR.md:330-358`.
In particular, `tactile` is an input modality, not a transform channel. Current
tactile behavior writes the model root and requests a body animation, while the
mixer and attention controller both write skeleton transforms in an intentional
order:
`web/src/components/companionInteraction.ts:257-311`,
`web/src/components/CompanionReviewRenderer.tsx:319-345` and
`web/src/components/CompanionReviewRenderer.tsx:139-147`.

A lease design that merely names `body-animation`, `look` and `tactile` can
therefore grant nominally different leases that still write the same transform.
Before Phase 1, define:

1. **Output channels, not stimulus names.** At minimum distinguish
   `world-root`, `embodiment-root-local`, `skeleton-base`,
   `skeleton-additive-look`, `dialogue` and `audio`. Inputs propose actions; they
   do not own output channels.
2. **Composition authority.** The renderer consumes one immutable composed plan
   per frame. A mixer, local deformation and additive look may coexist only
   through an explicit composition order; they must not each mutate shared
   state outside the composer.
3. **Fenced tokens.** A lease carries a unique token, session epoch, route epoch,
   channel, owner, priority, acquisition sequence, preemptibility and optional
   expiry. Release succeeds only when token and epochs still match. This prevents
   an old release from clearing a newer lease (ABA).
4. **Atomicity.** A proposal requiring multiple channels either acquires its
   declared set atomically or receives a declared partial/fallback plan. Define
   deterministic tie-breaking, starvation policy and resume behavior.
5. **Scoped revocation.** Stop/session invalidation revokes all; route change
   revokes route-scoped world motion; modal/hard-zone change revokes world root;
   reduced motion denies nonessential animation without erasing identity;
   renderer/context loss revokes embodiment delivery.
6. **One-shot actions.** A consumed S05 celebrate never resumes or replays after
   preemption. The current irreversible event is the source contract:
   `web/src/ui/savedScene.ts:11-23` and
   `web/e2e/saved-scene-review.spec.ts:215-342`.

Phase 1 should implement only the `world-root` lease needed for lab relocation.
It should not introduce a generic behavior tree, multi-channel framework or
production director.

## 8. Is the Interaction Lab sufficiently isolated?

**No, not yet as specified.** The intention is isolated, but “non-production
route/tool” is only a label:
`docs/architecture/SK7_LIVING_COMPANION_PLATFORM_NORTH_STAR.md:682-687`.
Current Vite has one default HTML entry and one `App` import:
`web/index.html:13-15` and `web/vite.config.ts:1-9`. A query-gated route inside
`App` would still share authentication/bootstrap, product CSS, history state,
API paths and production bundling.

Phase 1 needs this enforceable isolation contract:

- a separate HTML/React entry and dedicated Vite build/dev configuration;
- no import from `App.tsx`, `SceneShell.tsx`, current production renderers,
  saved-event code, product API/Supabase/Model V2/Auth modules or product CSS;
- no change to the default `index.html` entry or default runtime behavior;
- the default production build must not emit, link or navigate to the lab;
- two lab-local synthetic route states only—no product navigation or product
  persistence;
- deterministic local surrogate for pure spatial/input tests, plus one bounded
  renderer integration using an id that
  `getCompanionRuntimeMembership` confirms is `active-runtime-member`;
- no storage, cookies, clinical/user/product data, API calls, raw production
  output, camera, microphone, motion sensor, worker, AI/LLM, new server or new
  dependency;
- actor-local pointer capture, normal scroll/zoom everywhere else, keyboard and
  non-drag relocation, reduced-motion and forced-colors coverage;
- hard stop/reset that removes listeners, RAF, timers and contexts;
- a network allowlist containing only lab chunks and the one authorized asset
  integration request; and
- human review remains the merge gate; the lab provides no deployment or asset
  activation authority.

The existing membership seam is intentionally read-only and is appropriate for
the bounded asset check:
`web/src/ui/companionRuntimeMembership.ts:39-63` and
`web/e2e/companion-runtime-membership.spec.ts:23-105`.

## 9. Minimal Phase 1 file proposal

Add only the following files, plus one package script that names the dedicated
lab config:

```text
web/transcend-lab.html
web/vite.transcend-lab.config.ts
web/playwright.transcend-lab.config.ts

web/src/transcend-lab/main.tsx
web/src/transcend-lab/CompanionInteractionLab.tsx
web/src/transcend-lab/labRenderers.tsx
web/src/transcend-lab/transcend-lab.css

web/src/companion-platform/spatial/companionWorld.ts
web/src/companion-platform/behavior/rootMotionLease.ts
web/src/companion-platform/embodiment/labEmbodimentPort.ts

web/e2e/transcend-presence-contract.spec.ts
web/e2e/transcend-interaction-lab.spec.ts
```

Responsibilities:

- `companionWorld.ts` contains pure tagged coordinate types, Arena revision,
  Anchor registration/disposal, visual versus hit envelopes and deterministic
  hard-zone placement.
- `rootMotionLease.ts` contains only the fenced `world-root` lease and
  session/route revocation.
- `labEmbodimentPort.ts` defines the immutable plan/metrics contract shared by
  the two render strategies.
- `labRenderers.tsx` contains movable-patch and shared-stage implementations
  behind that lab-only port.
- `CompanionInteractionLab.tsx` owns two synthetic route states, safe zones,
  controls, stop/reset and identical scenario replay.
- The two specs separate pure contract tests from browser/input/render
  integration.

Do **not** add `CompanionPresenceHost`, production adapters, sensors, a worker,
dialogue, AI, a new dependency or a new service in Phase 1. Do not edit
`App.tsx`, `SceneShell.tsx`, current renderer behavior or product CSS merely to
host the experiment.

## 10. Exact characterization tests required before production migration

Phase 1 Lab tests are necessary but not sufficient. Before any production
screen adopts the new platform, add the following tests against the old runtime
and record which behavior is preserved versus deliberately superseded.

### 10.1 Current-runtime baseline characterization

1. **Eligible route continuity.** In review mode with the same bear-lite idle
   selection, navigate S02→S03→S02 in-document. Assert whether the exact canvas,
   one GLB request, pointer capture, local offset, reaction deadline and look
   state survive each step. The construction dependency gap is at
   `web/src/components/CompanionReviewRenderer.tsx:465-469`; the existing test
   covers only a non-screen parent rerender:
   `web/e2e/companion-review.spec.ts:718-753`.

2. **Exit during active capture.** Begin a touch and mouse drag, navigate to S08
   before release, and separately unmount after a reaction release timer is
   armed. Assert zero connected old canvas, zero retained capture, no late
   dataset/mixer mutation, no pending reaction callback and no page error. This
   directly exercises the ordering at
   `web/src/components/CompanionReviewRenderer.tsx:451-460` and
   `web/src/components/companionInteraction.ts:313-347`.

3. **Account epoch replacement on the same screen.** Replace user A with user B
   while S02 and companion selection remain identical. Assert all old input,
   animation and async ownership is revoked and document the current canvas
   identity result. The migration target must create a new fenced session even
   if the current renderer happens to survive:
   `web/src/App.tsx:475-525`.

4. **Report suspension.** Open the report while a legacy renderer is active.
   Count RAF/render calls, global listeners and contexts before, while the
   `data-living-week-app` ancestor is hidden, and after close. The target contract
   is no continuing animation/render work while semantically suspended:
   `web/src/App.tsx:2140-2179`.

5. **Legacy late-load and context stress.** Delay the GLB, exit, release it and
   assert no late canvas/model/state mutation. Then perform 100
   eligible/excluded transitions, collecting created/live contexts, canvases,
   RAF callbacks, resize observers and global listeners. Existing GC/context
   coverage is for saved/full-scene owners, not the legacy path:
   `web/e2e/saved-scene-review.spec.ts:399-484`.

6. **Owner matrix.** For review/production/off, Journey/static presentation,
   S02/S05/S10 and reduced-motion combinations, assert at most one dynamic
   character owner, expected poster fallback, and no unauthorized GLB. Extend
   rather than weaken
   `web/e2e/living-scene-review.spec.ts:371-489` and
   `web/e2e/s10-production-scene.spec.ts:85-239`.

7. **S05 invariant map.** Preserve confirmed-persistence-only admission, exactly
   one celebrate, no URL/storage restoration, no replay after
   hidden/reduced-motion/back-forward/failure, semantic controls on failure and
   no overlap with CTA/nav. Evidence to carry forward:
   `web/e2e/saved-scene-review.spec.ts:123-342`,
   `web/e2e/saved-scene-review.spec.ts:353-429` and
   `web/e2e/companion-production.spec.ts:310-343`.

### 10.2 Pure target-contract tests

The proposed `transcend-presence-contract.spec.ts` must run without browser,
network or GLB and assert:

- document↔visual-viewport↔actor-local↔NDC round trips at DPR 1/2, page scroll,
  arena scroll, zoom and virtual-keyboard viewport changes, with stale Arena
  revisions rejected;
- deterministic placement of each visual/action envelope at two anchors around
  hard zones, including no-fit fallback to dock/control/hidden;
- anchor unregister and route-epoch change invalidate old placement, while
  placement intent can resolve in the new route;
- hit envelope and visual envelope remain independent;
- a stale session/route/token cannot acquire, renew or release `world-root`;
- deterministic priority/tie order, preemption, expiration and ABA-safe release;
- a consumed one-shot action cannot resume after preemption; and
- active lite membership succeeds while standard, unknown and candidate ids
  fail closed, matching
  `web/e2e/companion-runtime-membership.spec.ts:23-105`.

### 10.3 Lab browser characterization

The proposed `transcend-interaction-lab.spec.ts` must run the exact same
scenario and metrics schema against movable patch and shared stage, without
declaring a winner, and assert:

- scrolling/zooming outside the actor remains native; only actor hit envelope or
  explicit move handle begins capture;
- touch, pen and mouse cover down/move/up, cancel, lost capture, Escape, stop
  and synthetic route revocation;
- keyboard/non-drag controls reach the same two anchors and expose equivalent
  state;
- visual envelopes never overlap registered hard zones after drop resolution;
- reduced motion preserves presence without nonessential motion; forced colors
  and WebGL failure leave all lab controls/status understandable;
- 100 route toggles retain one logical identity and never more than one active
  `world-root` token or visible actor owner;
- deliberately delayed renderer/asset results from an old route/session cannot
  reveal, write pose or reacquire;
- context loss falls back semantically and reset leaves zero lab listeners,
  timers, RAFs and live contexts;
- requests are limited to lab chunks plus the single authorized active-lite
  integration asset, with zero API/Auth/Model V2/Supabase/storage/sensor traffic;
  and
- both strategies report scenario id, source SHA, viewport/DPR, frame/long-task
  samples, draw/context counts and clipping/safe-zone outcomes under the same
  warm/cold protocol.

## 11. North Star contradictions and unsupported claims

`North Star:N-M` below means
`docs/architecture/SK7_LIVING_COMPANION_PLATFORM_NORTH_STAR.md:N-M`.

| Claim | Finding and required correction |
| --- | --- |
| “`CompanionRuntimeBoundary` selects an asset and derives screen-specific behavior” (`North Star:49-52`) | It looks up the descriptor after admission, but `App`/`companion.ts` select the semantic profile and `App` suppresses legacy ownership for S02/S10. `SceneShell` chooses saved versus legacy placement. Correct the wording so a future boundary does not absorb host policy: `web/src/App.tsx:1288-1341`, `web/src/components/SceneShell.tsx:90-118`, `web/src/components/CompanionRuntimeBoundary.tsx:56-105`. |
| “Several browser tests must wait for remote GLB/WebGL readiness before unrelated layout geometry” (`North Star:69-73`) | Overstated. S05 geometry tests do wait for readiness, but the S02 responsive slot layout test intentionally measures without waiting for renderer-ready: `web/e2e/companion-review.spec.ts:897-912`. Recast this as “some slot/action-envelope integration tests” and preserve the distinction. |
| `activeLeases` is minimum Presence state (`North Star:122-135`) | Unsupported boundary choice. Leases are live arbiter ownership with token/epoch rules, not logical identity. Keep only an observable snapshot outside persisted presence. |
| Route change invalidates anchors but two synthetic routes preserve “safe world pose” (`North Star:137-139`, `North Star:729-740`) | Ambiguous and potentially contradictory. Preserve placement intent, not raw CSS pixels; resolve a new pose against the new Arena revision. |
| Arena is aligned with the “currently visible app viewport” while distinguishing layout, visual and document spaces (`North Star:147-162`) | No canonical space or revision trigger is selected. This cannot produce deterministic keyboard/scroll behavior. Phase 1 must select and version one lab coordinate space. |
| “One actor channel has one active writer/lease” and example channels include `tactile` (`North Star:40`, `North Star:342-355`) | The names do not map to disjoint writes. Current tactile writes root transforms and animation; look composes onto mixer-written bones. Define output channels plus a composer and fenced tokens before claiming exclusivity. |
| Option A/B advantages (`North Star:385-416`) | These are hypotheses, not established advantages in this repository. Label fill cost, context longevity and movement simplicity as measurements to test under one scenario. |
| Owner transfer prepares a new owner before old release (`North Star:468-478`) while forbidding duplicate writers | “Prepared renderer” and “active writer” are not distinguished. Allocate/load may overlap, but only a fenced activation token may write/reveal; old-token release cannot affect the new owner. |
| Initial latency/FPS/20-minute budgets (`North Star:510-522`) | They are explicitly experimental targets, but no current baseline, device class, percentile sample method, warm/cold rule or pass/fallback interpretation supports them. Add the measurement protocol before using them as a gate. |
| “route visit == companion identity lifetime” is a current legacy restriction (`North Star:606-616`) | Too broad. Species identity already survives routes through local storage, and the exact legacy canvas can survive a same-position rerender: `web/src/ui/companionIdentity.ts:30-58` and `web/e2e/companion-review.spec.ts:718-753`. The actual restriction is fragmented render/action ownership, not identity itself. |
| Forced colors is a non-negotiable invariant (`North Star:39`), but Phase 1 acceptance mentions only relocation/stop (`North Star:729-740`) | Current `SceneShell` combines forced colors with reduced motion only for journey transition; it passes only reduced motion to companion rendering: `web/src/components/SceneShell.tsx:43-73`, `web/src/components/SceneShell.tsx:90-95`. Add a lab forced-colors acceptance test; do not claim current renderer coverage. |
| Raw perception data is local/ephemeral “by default” (`North Star:37-38`) | For future sensor work, “by default” is weaker than a testable prohibition. Phase 1 has no sensors. Any later perception phase needs an explicit session, zero-egress/no-persistence contract, independent stop, stale-generation rejection and threat tests before implementation. |
| Phase 1 is an “isolated, non-production route/tool” (`North Star:682-687`) | Unsupported by a build/import boundary. Current web entry is singular. Adopt the separate entry/config/import/network contract in section 8. |
| “one current active lite companion is resolved through existing authority” (`North Star:729-732`) | Correct intent, incomplete mechanism. Use the read-only `getCompanionRuntimeMembership` seam and require `active-runtime-member`; never infer activation from catalog, candidate, Learning Record, `retain` or historical approval. |
| Proposed worker/AI modules and later phases (`North Star:113-116`, `North Star:360-376`, `North Star:641-658`) | The North Star partly conditions the worker on measurement, but the roadmap is not authorization. Repository governance separately requires a measured need and ADR before any worker, LLM or new dependency/topology. None belongs in Phase 1. |

## 12. Recommendation for Phase 1 Lab only

**REVISE.**

Proceed to a Phase 1 implementation PR only after the North Star or the Phase 1
task contract incorporates all of these gates:

1. separate build/runtime entry and import/network isolation from the product;
2. tagged Arena revisions, route-scoped Anchor lifecycle and separate
   visual/hit envelopes;
3. one fenced `world-root` lease with explicit session/route revocation and no
   generic arbiter expansion;
4. read-only active-membership resolution for the one lite integration asset;
5. the baseline and target characterization tests in section 10;
6. identical A/B scenarios and measurement protocol with no preselected winner;
7. reduced-motion, forced-colors, keyboard/non-drag and semantic failure
   behavior; and
8. an explicit exclusion list for production App/scene changes, S05 event
   replay, API/DB/Auth/RLS/Model V2 changes, health/model-driven behavior,
   sensors, worker, AI/LLM, new dependency/server/topology, activation,
   deployment and auto-merge.

Change the recommendation to **STOP** for this slice if implementation requires
editing `App`/`SceneShell` or production renderer behavior merely to expose the
lab; a viewport overlay must block normal scroll/zoom; active asset authority
must be weakened; two visible/active owners cannot be fenced; or S05/product
state must be replayed or mutated.

With the revisions above, Phase 1 remains a bounded experiment. It does not
authorize a production Presence Host, production spatial migration, render-owner
transfer, sensor/perception work, merge or deployment.
