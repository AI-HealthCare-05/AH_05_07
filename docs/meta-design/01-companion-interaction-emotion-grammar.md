> **DESIGN PROPOSAL — NOT IMPLEMENTATION AUTHORITY**

# 01. Companion Interaction & Emotion Grammar

## 1. Status, baseline, and authority boundary

Status: **design proposal only** for GitHub Issue #899. This document is an implementation-independent product/interaction design asset. It does not authorize runtime behavior, product implementation, deployment, provider changes, protected data/model changes, persistence changes, asset activation, dependency changes, or a later Experience Slice.

Repository baseline investigated for this draft:

- canonical repository: `AI-HealthCare-05/AH_05_07`
- live `main`: `6d3207d673b8001d8809628c0830d5a2f5affe39`
- Issue #899: open at the time of investigation
- Issue #396: open and remains the Model V2 research-preview authority
- open pull requests: none at the time of investigation

A future implementation must begin from the then-current `origin/main`, open a new bounded GitHub Issue, and revalidate every assumption in this proposal against current source, tests, product contracts, active asset authority, and browser behavior.

Authority precedence is explicit. If this proposal conflicts with current `AGENTS.md`, the current GitHub Issue/PR, `docs/transcend/PROGRAM.md`, `docs/architecture/SK7_LIVING_CITY_3D_FIRST_PRODUCT_CONTRACT.md`, Model V2 contracts, privacy/data-lifecycle contracts, current Presence contracts, or another protected current authority, **the current authority wins**.

This document must not become a second project-management ledger, status registry, implementation roadmap registry, or handoff/checkpoint file. GitHub Issue/PR/Git remain live work authority.

## 2. Current repository reality and evidence

This proposal starts from the current implementation rather than from the older mental model of “a companion in a small canvas.” The repository currently contains multiple companion embodiments with deliberately different owners.

### 2.1 S02 full-scene Presence is already a fenced spatial owner

The current S02 path is not the legacy tactile slot.

- [`CompanionPresenceHostBridge.tsx`](../../web/src/components/CompanionPresenceHostBridge.tsx) observes current render ownership, reconciles logical Presence identity/epochs, measures the S02 Arena, and publishes the exact active asset/owner state to the S02 actor runtime. It does not own renderer mount/load/disposal.
- [`companionPresenceKernel.ts`](../../web/src/platform/presence/companionPresenceKernel.ts) owns logical Presence identity, session/route/Arena/owner generations, an observed render owner token, and transient placement intent. Session replacement clears placement intent; route change carries intent while fencing route-local geometry.
- [`presenceSceneActorRuntime.ts`](../../web/src/platform/presence/presenceSceneActorRuntime.ts) identifies itself as the **sole product writer authority for the migrated S02 actor world root**. A world-root write is accepted only through the exact current session/route/Arena/owner/port fence and one exact lease.
- [`s02SceneActor.ts`](../../web/src/components/scene/s02SceneActor.ts) exposes one renderer-local port that can mutate only the registered S02 `worldRoot`. Camera, environment, and local embodiment roots remain outside that write.
- [`PresenceSceneActorInteraction.tsx`](../../web/src/components/PresenceSceneActorInteraction.tsx) is a semantic DOM sibling of the `aria-hidden` scene. It owns pointer capture for relocation, Escape cancellation, a keyboard/pointer alternative position control, and polite status for relocation/correction/restoration.

The current pointer grammar already contains an important seam for future interaction: a press/release that never crosses the relocation threshold returns `"tap"`; a pointer that crosses the threshold becomes a fenced root relocation. **Current S02 does not attach a reaction to the returned tap.** That is an intentional design opportunity, not missing evidence that a reaction already exists.

The current S02 actor renderer is also deliberately simple. [`ThreeSceneRenderer.tsx`](../../web/src/components/scene/ThreeSceneRenderer.tsx) describes the scene as a neutral study with no `AnimationMixer` or persistent frame loop. `S02SceneActorOwner` requires an `idle` clip to exist but presently mounts the actor as a static full-scene subject and delegates only world-root relocation to Presence. A future reaction cannot honestly be described as “turning on what is already there”; it would introduce a new local embodiment/animation responsibility that must remain fenced away from the world root.

### 2.2 S02 relocation already has strong interaction evidence

[`s02-spatial-presence.spec.ts`](../../web/e2e/s02-spatial-presence.spec.ts) currently exercises, among other things:

- direct actor relocation at 320×844, 390×844, 768×900, and 1366×768;
- safe travel to frame edges across multiple species at 320px and broader bear coverage at other viewports;
- deliberate suppression of the heavy S02 frame/interaction at a short 320×640 viewport;
- a visually quiet actor hit target plus a separate 44×44 minimum position control;
- keyboard focus and Enter on the position alternative;
- deterministic correction away from unsafe UI geometry;
- Escape, pointer cancel, lost capture, and route invalidation restoring/revoking stale interaction;
- normalized placement surviving route return and responsive Arena rebuild within the current session;
- reduced-motion suppression of the settle animation and, under the current scene policy, fallback from the 3D runtime to the poster;
- `touch-action: none` only on the actual actor relocation target rather than the entire scene;
- forced-colors focus treatment through [`scene-stage.css`](../../web/src/components/scene/scene-stage.css).

This is reusable evidence for ownership and input fencing. It is **not** evidence that S02 reaction, emotion, stroke, grab, gaze, or rapid-reaction arbitration are implemented.

### 2.3 Legacy tactile/reaction is a different owner and must not be overlaid blindly

The legacy runtime is valuable provenance, but it is not the current S02 full-scene owner.

- [`CompanionRuntimeBoundary.tsx`](../../web/src/components/CompanionRuntimeBoundary.tsx) admits tactile input narrowly. Reduced motion disables tactile input. Review bear/lite/idle can enable it immediately; the production S05 bear/lite confirmed-save path enables it only after celebrate settles to idle. Other combinations are disabled.
- [`companionInteraction.ts`](../../web/src/components/companionInteraction.ts) owns pointer identity/capture, screen-space head/body/feet zones, local drag target/velocity, bounded spring return, local translation/scale/rotation, and cleanup. It does **not** own animation actions or reaction timers.
- [`CompanionReviewRenderer.tsx`](../../web/src/components/CompanionReviewRenderer.tsx) owns the legacy `AnimationMixer`, current action, crossfades, reaction release timer, render loop, renderer lifetime, and teardown. The current tactile mapping is head→`curious`, body→`greet`, feet→`rest`. A minimum post-release reaction visibility of 300ms is current implementation evidence, not a universal future timing constant.
- [`companionLook.ts`](../../web/src/components/companionLook.ts) demonstrates a separate additive attention owner. It removes its previous head/spine offset before the mixer updates the authored pose and reapplies a bounded look offset afterward. It suspends look while tactile dragging or celebration owns attention.

The render order in the legacy path is already instructive: remove previous look offset → mixer/authored animation → tactile wrapper step → new look offset → render. The exact implementation does not need to be copied, but it proves why “reaction”, “touch deformation”, and “gaze” must be treated as distinct write domains rather than independent helpers writing the same transforms.

Historical review in [`SK7_TRANSCEND_PHASE0_ADVERSARIAL_REVIEW.md`](../architecture/SK7_TRANSCEND_PHASE0_ADVERSARIAL_REVIEW.md) and [`SK7_LIVING_COMPANION_PLATFORM_NORTH_STAR.md`](../architecture/SK7_LIVING_COMPANION_PLATFORM_NORTH_STAR.md) reached the same ownership conclusion: root/world movement and local embodiment movement must remain separate; multiple unfenced writers are invalid. Those documents remain useful provenance, while current Living City contracts win where product direction differs.

### 2.4 Clip availability is broader than current interaction qualification

[`companion.ts`](../../web/src/ui/companion.ts) currently defines 11 species, two variants, and seven clip names: `idle`, `greet`, `move`, `curious`, `celebrate`, `rest`, and `special`. Current runtime tests verify that approved species/variants expose the required clip-name set.

That does **not** mean every clip is an approved reaction on every surface:

- the product policy permits general `idle`/`greet`/`curious`/`rest` only on eligible companion surfaces;
- `celebrate` is conditional on confirmed S05 save success;
- `move` requires a non-semantic movement context;
- `special` is currently blocked;
- tactile behavior remains much narrower than asset clip availability.

Therefore future interaction capability must fail closed from current **active asset + surface + policy + qualified behavior**, not infer authorization merely from a species name or clip existing inside a GLB.

### 2.5 Current product and Living City boundaries constrain “emotion”

The current [`Transcend program`](../transcend/PROGRAM.md) and [`Living City 3D-first product contract`](../architecture/SK7_LIVING_CITY_3D_FIRST_PRODUCT_CONTRACT.md) are stronger than any companion delight concept:

- the stable world shell may own companion embodiment, world input, animation, audio/haptic hooks, and local resource recovery;
- semantic product state remains outside renderer authority;
- measured BP, BP direction, Model V2 output, inferred health quality, poor outcomes, and missed goals may not become punishment, world decay, reward multipliers, or emotional-companion inputs;
- core semantic tasks remain usable when 3D or companion capabilities fail;
- no transform, product action, persistence state, or bridge output may have multiple unfenced authoritative writers.

For this proposal, **emotion means an ephemeral presentation grammar for explicitly permitted interaction causes. It does not mean inferring the user’s emotion, assigning a persistent companion mood from health behavior, or interpreting health facts.**

### 2.6 My Space is adjacent evidence, not automatically the same runtime

Current My Space/placeable source has its own world actor and input seams under `web/src/placeable/`. This proposal does not declare the S02 Presence runtime, the legacy slot, and My Space to be one implementation. A future slice may reuse the grammar only after revalidating the owner and transform tree of the target surface.

## 3. User promise / North Star

The companion should feel **responsive, calm, alive, and trustworthy without becoming an obstacle or a judge**.

The user promise is:

> When I intentionally touch or address my companion, it responds in a way I can understand. When I move it, it goes where I put it without fighting the interface. When I stop interacting, it settles naturally. It may notice me, but it never steals control, never turns my health into a mood, and never makes an important task depend on a gesture I cannot perform.

This implies five product qualities:

1. **Intent is legible.** Tap, relocation, tactile play, and attention do not ambiguously compete for the same pointer after ownership is established.
2. **Reaction is bounded.** A reaction has a clear cause, finite lifetime, and deterministic settle/cancel path; repeated input cannot create an unbounded animation queue.
3. **Movement has one writer.** Relocation never competes with tactile offsets, authored animation, or gaze for the same transform.
4. **Delight is additive.** Losing animation, audio, haptics, WebGL, or a companion asset does not block semantic work.
5. **Emotion is non-medical.** Companion affect never rewards or punishes BP values, model results, inferred health quality, missed goals, or similar health-outcome facts.

## 4. Problem statement

SK7 currently has two useful but different interaction histories:

- S02 has the stronger **spatial ownership** model: exact fences, one root writer, safe-zone placement, cancellation, adaptive travel, and a semantic non-drag alternative.
- the legacy slot has the stronger **local embodiment** model: tactile zones, spring deformation, reaction clips, reaction lifetime, authored animation ownership, and gaze composition.

Simply combining the code would regress the architecture:

- legacy tactile drag writes a local model wrapper while S02 drag already means world-root relocation;
- adding a second pointer handler over the same actor would create ambiguous gesture ownership;
- adding an `AnimationMixer` without an explicit local pose owner could compete with later locomotion, gaze, or reaction writers;
- reusing health/product events as convenient reaction triggers could violate the Living City and Model V2 boundaries;
- exposing a visual tap reaction without a keyboard/reduced-motion equivalent would reproduce “technically present but not product-complete” behavior.

The design problem is therefore not “which cute animation plays on tap?” The design problem is **how to define one interaction grammar whose intents, writer domains, cancellation, accessibility, and emotional semantics survive across current S02 and future Living City embodiments without making this proposal a new runtime authority.**

## 5. Principles

### 5.1 Intent before animation

A raw pointer event is not a reaction. Input is first interpreted as a bounded interaction intent, and only then may a qualified embodiment map that intent to a clip, pose, motion, sound/haptic hook, or no-op.

This keeps pointer semantics independent of one GLB and prevents clip names from becoming product vocabulary.

### 5.2 One writer per output domain

Root relocation, authored animation, tactile local offsets, gaze offsets, and semantic DOM feedback are separate output domains. If two behaviors need the same domain, they arbitrate before a write rather than race after it.

### 5.3 Gesture multiplexing stops after claim

Before threshold/claim, a press may still become a tap or a relocation. Once a gesture is claimed as root relocation, the same pointer cannot also become a stroke, grab reaction, or second root writer.

### 5.4 Reactions do not accumulate debt

Rapid input does not enqueue a long backlog that continues after the user has stopped. At most one bounded reaction slot is active per actor unless a future contract explicitly proves multiple independent output channels.

### 5.5 “Emotion” describes presentation, not health interpretation

Use neutral, interaction-caused presentation intents such as acknowledgement, curiosity, greeting, delight for an explicitly permitted non-medical event, and settle/rest. Do not infer sadness, anxiety, disappointment, pride, or health success from protected facts.

### 5.6 Accessibility changes the gesture, not the outcome

A keyboard or non-drag alternative need not imitate the physical gesture. It should reach the same meaningful product outcome: acknowledge the companion, choose a safe location, or dismiss/cancel interaction.

### 5.7 Failure removes delight, not truth

If interaction capability is unavailable, fail to idle/static/fallback. Never synthesize a different product fact, retry a protected operation, or report semantic success because an animation happened.

### 5.8 Current timing is evidence, not constitution

Values such as the current 6 CSS-pixel S02 relocation threshold, 300ms legacy reaction hold, 700ms touch glance, or 900ms replay cue are implementation evidence. Future slices may reuse them only after revalidation and interaction evidence; this proposal owns no universal millisecond constants.

## 6. Protected boundaries

Any future implementation derived from this proposal must preserve the following unless a newer explicit authority changes them.

### 6.1 Health/model boundary

The companion must not receive, infer, or encode as emotional input:

- measured systolic/diastolic values;
- BP trend or direction;
- Model V2 raw output, transformed output, risk interpretation, or preview result;
- inferred “good/bad health”;
- diagnosis/treatment/prevention concepts;
- missed health targets, poor outcomes, or adherence used as shame/punishment.

A separate future bridge may explicitly authorize a **non-medical confirmed product event** as a cue, but this proposal grants no such bridge.

### 6.2 Persistence/privacy boundary

This proposal authorizes no new persistence.

- reaction state, press candidates, attention cues, pointer ownership, reaction timers, and settle state are transient presentation state;
- current S02 Presence placement intent is whatever the live Presence contract says at implementation time; this proposal does not promote it to browser/account persistence;
- no reaction history, “mood,” interaction analytics, telemetry, behavioral profile, or health-linked companion state is implied;
- future persistent world/companion state belongs to an explicit persistence/data-lifecycle decision and must coordinate with Proposal 03 and Proposal 08.

### 6.3 Asset authority boundary

Clip presence in a candidate or active file is not activation authority. Future reaction capability must start from the exact current checked-in asset/scene activation chain and fail closed if the active identity lacks a qualified behavior.

### 6.4 Semantic-task boundary

No core product task becomes available only by touching, dragging, stroking, looking at, hearing, or otherwise interacting with the companion.

### 6.5 Sensor boundary

Camera, microphone, device motion, inferred gaze, body pose, or perception are out of scope. They require separate opt-in capability authority and cannot be smuggled into “attention” as an implementation shortcut.

### 6.6 Deployment/dependency boundary

No engine rewrite, new animation library, state machine package, worker, server, analytics SDK, haptic API activation, audio asset, provider mutation, or deployment is authorized here.

## 7. Ownership and architecture seams

The grammar depends on preserving explicit ownership rather than centralizing everything into a “companion brain.”

| Output / concern | Current-repository reality at baseline | Proposal rule for future slices |
|---|---|---|
| Logical companion identity/lifecycle | `CompanionPresenceKernel` carries actor identity and fenced epochs for current Presence paths | Reuse/extend only through the current Presence authority; do not infer identity from candidate assets or DOM |
| S02 world-root relocation | `PresenceSceneActorRuntime` is the sole S02 root writer and writes through one exact `S02SceneActorPort` | Reaction/tactile/gaze must never write this root directly; any future root movement goes through the then-current root authority |
| Renderer mount/load/draw/dispose | `ThreeSceneRenderer` for current S02/S10; legacy renderer owns its own lifecycle | Renderer lifetime remains renderer-local; an interaction controller cannot mount a second renderer |
| Authored animation action | Present in legacy `CompanionReviewRenderer`; absent from current S02 actor path | A future animated S02/world actor needs exactly one renderer-local action/pose owner before reactions are enabled |
| Tactile local deformation | Legacy `companionInteraction.ts` mutates a bounded local target around a home pose | Future tactile deformation must target a dedicated local embodiment transform, never the root relocation transform |
| Gaze/attention | Legacy/S10 paths use bounded head/spine offsets with their own cleanup | Gaze is additive and lower priority than a conflicting direct manipulation/reaction; it must remove its previous offset before authored pose evaluation |
| Semantic accessibility/status | Current S02 has DOM sibling controls/status | Keep interactive semantics outside `aria-hidden` WebGL; do not make canvas pixels the sole control surface |
| Sensory sound/haptic response | Living City shell permits hooks; no new grammar is authorized here | Proposal 05 owns service-wide sensory vocabulary; Proposal 01 may expose a local reaction outcome but not invent audio/haptic policy |
| Persistence | No new reaction persistence in current paths | None is created by this proposal; any durable state requires explicit data/persistence authority |

### 7.1 Required transform separation

A future implementation may use a different scene graph, but the responsibility order must remain equivalent to:

```text
world placement / world root       <-- one fenced spatial writer
        |
optional locomotion root           <-- one locomotion owner when present
        |
local embodiment envelope          <-- tactile/local deformation only
        |
authored rig / animation pose      <-- one action/mixer owner
        |
bounded additive gaze/attention    <-- applied with explicit composition rules
        |
render projection
```

This diagram is a responsibility model, not an instruction to add five Three.js `Group`s. A future slice should choose the smallest transform hierarchy that proves the same non-overlap.

### 7.2 Root relocation and tactile play are different capabilities

The current S02 drag means **relocate the actor through the Arena**. The legacy drag means **deform the actor locally around a home pose**. These must not be merged into one ambiguous drag.

A future surface that wants both has only two acceptable directions:

1. **mode/affordance separation:** the default actor drag remains relocation, while explicit “play/touch” entry grants local tactile ownership; or
2. **distinct target separation:** an explicit move handle/region owns relocation while a clearly bounded body target owns local touch.

The exact choice is a future slice decision based on viewport/touch evidence. What is not acceptable is two independent handlers waiting to see which one wins after both have mutated state.

## 8. Interaction and emotion grammar

### 8.1 Product-level vocabulary

Product design should speak in **interaction intents** and **reaction intents**, not raw clip names.

Interaction intents:

- `interact.tap` — deliberate short activation on the companion;
- `relocate.begin / update / commit / cancel` — world-position manipulation;
- `touch.stroke` — bounded local tactile movement where explicitly enabled;
- `touch.grab / release` — bounded local deformation where explicitly enabled;
- `attention.point` — a bounded explicit attention cue from an approved source;
- `interaction.cancel` — owner/session/route/suspension/user cancellation.

Reaction intents are semantic presentation classes, for example:

- **acknowledge** — “I noticed your explicit interaction”; quiet/default tap response;
- **curious** — short orientation/interest response where qualified;
- **greet** — explicit greeting/entry response, not a health-result reward;
- **delight** — reserved for explicitly authorized non-medical success contexts such as the already bounded confirmed-save presentation; not a generic score reward;
- **settle** — return to neutral/idle after an interaction;
- **rest** — calm local response where the active asset/surface policy qualifies it.

These names are not a new public API and do not require a one-to-one mapping to current clips. An active asset might map `acknowledge` to a small authored pose, a different clip, a static expression, or no motion under reduced-motion policy.

### 8.2 Forbidden emotion semantics

Do not define or persist:

- “happy because BP improved”;
- “worried because BP is high”;
- “sad because the user missed a challenge”;
- “proud because model risk is low”;
- punishment/sulk/decay after missed targets;
- inferred user mood from pointer speed, interaction frequency, health answers, camera, microphone, or other implicit signals;
- hidden affection scores, streak pressure, scarcity, or reaction quality tied to health participation.

A companion may be expressive without pretending to know the user’s emotional or medical state.

### 8.3 Pointer/touch claim grammar

A spatial actor that supports both tap and relocation should use a claim sequence conceptually equivalent to:

```text
pointer down inside current qualified hit target
        |
        v
PRESS_CANDIDATE
  |                     |
  | release before      | movement crosses current
  | relocation claim    | relocation threshold
  v                     v
TAP_INTENT           ROOT_RELOCATION_OWNED
  |                     |
  |                     +--> update only through root lease
  |                     +--> drop -> commit/correct/restore
  |                     +--> tap reaction suppressed
  v
qualified reaction
or bounded no-op
```

Rules:

1. Admission uses the exact current actor/owner/session/route/Arena fence where such a fence exists.
2. A pointer must not generate a tap reaction after the same gesture has been claimed for relocation.
3. A tap must not acquire/write the world-root lease merely to play a reaction.
4. Pointer cancel, lost capture, Escape, route change, owner change, asset incarnation change, suspension, or teardown invalidates the interaction token.
5. A stale release from an old fence cannot trigger a reaction on a new actor incarnation.
6. Touch gesture suppression is limited to the actual target that has chosen to own the gesture; surrounding page/scene scrolling remains native.

### 8.4 Local tactile grammar

Stroke/grab are optional capabilities, not synonyms for tap.

Where a future slice enables tactile play:

- local deformation remains bounded around a local neutral pose;
- it may produce a reaction intent only after the same exact actor capability admits it;
- the local touch owner never writes world position;
- release/cancel begins a deterministic local settle or immediate neutral reset;
- pointer capture cleanup is mandatory;
- tactile mode cannot prevent route teardown or semantic navigation;
- if the surface also supports relocation, the gesture ownership is separated as described in Section 7.2.

The current head/body/feet screen-space proxy is useful evidence, but this proposal does not make those three zones a permanent anatomy contract. A species with a very different silhouette may need fewer/different qualified zones or a single whole-body interaction.

### 8.5 Reaction lifecycle

Treat reaction as one bounded slot rather than an animation queue.

Conceptual reaction state:

```text
IDLE
  |
  +-- eligible reaction intent --> ACTIVE(reactionEpoch, cause, capability)
                                  |
               +------------------+------------------+
               |                                     |
        eligible replacement                         release / natural end
               |                                     |
               v                                     v
       ACTIVE(new epoch)                         SETTLING
                                                       |
                                                       v
                                                     IDLE

session/route/owner/asset/suspension/teardown invalidation -> CANCEL -> IDLE
```

Required behavior:

- **one active reaction epoch:** no unbounded FIFO of taps;
- **cause is explicit:** the state can be explained by a current interaction intent, not by ambient health state;
- **replacement is deterministic:** a later eligible interaction may replace/restart/coalesce according to the slice’s documented rule;
- **settle is bounded:** reaction returns to neutral without waiting for another user action;
- **cancellation wins:** lifecycle invalidation removes pending timers/callbacks and cannot later resurrect a reaction;
- **idle is real ownership state, not merely a dataset label:** future tests should distinguish scheduled release, mixer/action weight, local offsets, and user-visible completion when those distinctions matter.

### 8.6 Rapid and repeated input

Rapid input needs an explicit policy because legacy evidence does not fully cover retap races.

Default design rule for a future slice:

1. never enqueue every tap;
2. keep at most the current reaction and one current pointer/contact owner;
3. repeated equivalent tap while the same reaction is active should either coalesce or restart one bounded visibility interval — the slice must choose and test one behavior;
4. a different qualified reaction may replace the current one only through the single reaction owner;
5. relocation claim immediately suppresses any pending tap from the same pointer;
6. route/session/owner invalidation clears the reaction regardless of how many inputs preceded it;
7. auditory/haptic hooks, if later added under Proposal 05, must inherit the same coalescing/cancellation token so repeated taps cannot create sensory spam after visual cancellation.

Do not copy the legacy 300ms hold blindly. Measure a perceivable but restrained duration in the target surface and test boundary races around that chosen value.

### 8.7 Attention/gaze coexistence

Attention is orthogonal to reaction but not free to write on top of it blindly.

Recommended arbitration priority when output domains conflict:

1. teardown/suspension/reduced-motion policy;
2. direct root relocation or explicit local grab currently owned by the user;
3. explicit reaction with authored head/body pose;
4. bounded explicit attention cue;
5. ambient gaze/tracking;
6. idle/ambient motion.

Rules:

- direct manipulation suppresses ambient gaze if the gaze would visually fight the gesture;
- a reaction clip may temporarily own head/spine pose; gaze either yields or composes through a known additive envelope;
- gaze never changes world-root placement;
- pointer-follow gaze is decorative and must not imply eye tracking or user-state inference;
- touch may use a short bounded glance only if it does not prolong the interaction after cancellation;
- hidden document/blur/suspension centers or stops attention; resume does not replay expired cues.

### 8.8 Settle-to-idle

“Settle” is the contract that makes the companion feel composed rather than twitchy.

Settle may include:

- local tactile spring returning to neutral;
- authored reaction crossfade/return to idle;
- attention returning to center;
- a subtle placement acknowledgement after a committed root move.

Settle must **not** mean:

- moving the root back after a committed relocation;
- replaying a canceled reaction on route return;
- retaining a hidden mood across account/session boundaries;
- delaying semantic navigation until animation finishes.

When a committed relocation and local reaction end at the same time, the root destination is authoritative and local embodiment settles relative to that new root.

## 9. Desktop, mobile, and adaptive behavior

### 9.1 Desktop / precise pointer

- hover may adjust cursor or optional attention only where it is genuinely discoverable;
- hover itself should not repeatedly fire reaction clips;
- primary click/tap and drag share a pre-claim period, then become mutually exclusive intents;
- focus styling must remain visible even when the visual hit surface is otherwise transparent;
- gaze following a mouse pointer is optional decorative behavior, not a prerequisite for interaction.

### 9.2 Touch / coarse pointer

- do not disable page panning globally;
- only an admitted actor target or explicit play surface may use `touch-action: none` when it truly owns drag;
- the actor must have enough usable travel geometry before relocation is offered; if the viewport cannot support it, hide/disable the 3D affordance rather than present a trapped drag target;
- tactile local drag and root relocation cannot both compete for the same touch pointer without explicit mode/target separation;
- tap reaction should tolerate normal touch jitter without accidentally starting relocation, using the current slice’s measured claim threshold.

### 9.3 Narrow and short viewports

Current evidence deliberately removes the S02 heavy scene at 320×640 while retaining the semantic product. That is a valid adaptive outcome.

A future interaction slice must not force companion availability just to keep feature parity. On a viewport where the actor is absent:

- do not leave an invisible focus target;
- do not announce unavailable decorative actions repeatedly;
- semantic Today/Records/etc. tasks remain complete;
- any future “interact with companion” control is omitted or clearly disabled according to the slice’s product value, not replaced with a fake success.

### 9.4 Responsive geometry changes

If the actor remains present across a resize/orientation/zoom-induced Arena rebuild:

- active pointer ownership follows the current runtime’s fencing rules;
- stale geometry cannot accept a new write;
- root placement resolves against the new Arena, not stale CSS pixels;
- local tactile offsets are reset/recomputed relative to the actor’s new local frame rather than treated as persistent world coordinates;
- a reaction may continue only if its actor/owner incarnation remains current and the new layout still admits that embodiment; otherwise it cancels to idle.

Proposal 10 owns the broader adaptive evidence grammar, including actual 200% zoom/text and short-viewport evidence. This proposal supplies the interaction-specific claims to test.

## 10. Accessibility and non-primary-input equivalents

### 10.1 Semantic controls live outside `aria-hidden` rendering

WebGL/canvas remains presentation. Interactive semantics use DOM controls or another accessibility-compatible semantic layer.

The current S02 pattern — an `aria-hidden` renderer with a semantic sibling — is the correct direction. Future slices should preserve that separation even if visual hit testing becomes richer.

### 10.2 Pointer tap requires a keyboard-equivalent reaction outcome

A future tap reaction cannot be pointer-only.

Possible compliant designs include:

- the actor semantic target’s Enter/Space action emits the same `interact.tap` intent; or
- a nearby explicit semantic action such as “동반자와 인사하기” emits the same reaction intent.

The choice should avoid misleading names. If a single visual hit target supports “tap to react, drag to move,” its accessible description must not claim it only moves the companion. Conversely, do not make keyboard users discover a hidden action through an unlabeled icon.

### 10.3 Relocation needs a non-drag path

Current S02 already provides `동반자 위치 바꾸기`, a 44×44 semantic button that cycles safe destinations through the same commit path. Future surfaces may use a cycle, anchor chooser, or bounded directional control, but the outcome must be equivalent: choose a valid location without a drag gesture.

### 10.4 Stroke/grab alternatives are outcome-equivalent, not gesture simulation

A keyboard or assistive-technology user should not be required to simulate “stroke speed.” If tactile play yields a greet/acknowledge outcome, an explicit semantic interaction control may trigger that qualified outcome directly.

### 10.5 Screen-reader announcements stay proportional

Do announce material interaction results such as:

- relocation committed;
- unsafe placement corrected;
- relocation restored/canceled when the user needs confirmation.

Do not create a chatty live region for every decorative head turn or idle reaction. If a keyboard user explicitly triggers a companion reaction and the reaction has no nonvisual equivalent, a short polite acknowledgement may be appropriate; it must be tested for repetition and interruption before adoption.

### 10.6 Reduced motion

Current implementations legitimately differ:

- legacy reduced-motion disables tactile/reaction motion and renders a static companion;
- current S02 reduced-motion policy can fall back from the runtime to a poster, removing the spatial actor interaction entirely while semantic product tasks remain available;
- the S02 settle flourish itself is suppressed by CSS under reduced motion.

This proposal does not override those behaviors. A future slice that claims interaction under reduced motion must define a non-motion equivalent, for example:

- immediate state/pose change without travel animation;
- subtle static visual acknowledgement;
- semantic confirmation for an explicit control;
- no decorative reaction when the actor is absent.

Reduced motion must never become a reason to enable a different health interpretation or persist state.

### 10.7 Forced colors and focus

New semantic interaction controls inherit the product focus/forced-colors contract. A transparent actor hit target still needs visible focus; a control whose only affordance disappears under forced colors is not complete.

## 11. Loading, failure, interruption, and recovery behavior

This proposal uses “recovery” only for **interaction/presentation recovery**. It does not replace [`RECOVERY_CONTRACT.md`](../architecture/RECOVERY_CONTRACT.md), which distinguishes runtime rollback, schema reconstruction, and data recovery.

### 11.1 Actor/asset loading

Before the exact active actor is ready:

- do not admit a tap/drag target that claims a reaction can occur;
- do not pre-announce a successful reaction;
- semantic product content stays usable;
- a decorative loader may be absent rather than inventing state.

### 11.2 Missing/unqualified reaction capability

If the active actor does not have a qualified mapping for a reaction intent:

- keep/return to idle;
- do not choose an arbitrary “similar” clip;
- do not fetch an unapproved candidate asset;
- do not fall back to a product-semantic success message;
- interaction controls may omit the unavailable optional behavior while core product remains intact.

### 11.3 Relocation no-space/correction

Preserve the current S02 philosophy:

- never force the actor into a protected hard zone merely to honor pointer position;
- correct to the nearest valid location when the current spatial contract allows it;
- if no valid space exists, restore the last safe position;
- provide a semantic status for user-initiated relocation outcome;
- reaction/tactile systems do not “compensate” by moving the root through another writer.

### 11.4 Pointer/gesture interruption

On pointer cancel, lost capture, Escape, route/owner/session invalidation, or teardown:

- revoke the active root lease or local-touch token;
- restore the last safe root when the current runtime can do so safely;
- discard the pending tap;
- cancel reaction timers created by that interaction epoch where their cause is no longer current;
- remove local tactile offsets;
- stop/cancel attention cues that would outlive their owner;
- never dispatch a delayed reaction into the next route/actor incarnation.

### 11.5 Renderer/WebGL failure

Renderer failure removes the decorative/spatial companion capability and falls back according to current scene authority. It must not:

- mutate product records;
- turn Today/Records/AI/Settings into a domain error;
- retry a protected product write;
- claim that a user interaction completed if the relevant visual capability never admitted it.

### 11.6 Visibility/background/resume

A hidden/backgrounded document should not accumulate interaction debt. On resume:

- expired reaction/attention cues are not replayed;
- current active pointer ownership is gone unless the platform/runtime explicitly proves otherwise;
- the actor resolves from current owner/session/route state;
- idle/static state is preferable to resuming a half-finished decorative reaction.

Proposal 09 may later define the cross-product user-facing recovery vocabulary. This proposal owns only the companion-specific state consequences.

## 12. Conflicts and anti-patterns

### 12.1 Reusing legacy tactile drag directly on the S02 `worldRoot`

**Do not do this.** It would let local spring deformation compete with the current sole root writer and would make “drag” mean two different things.

### 12.2 Adding a second invisible pointer layer over the current actor

Two overlapping hit owners are not composition. They create nondeterministic capture, gesture, focus, and touch-action behavior.

### 12.3 Letting animation helpers write bones/root independently

A reaction helper, gaze helper, locomotion helper, and tactile helper may not all call `position`, `rotation`, or bone quaternion setters with no composition owner. Establish one writer or an explicit additive composition rule per domain.

### 12.4 Treating clip names as product semantics

`curious` existing in a GLB does not authorize a “curious” product emotion everywhere. Product intent maps to a qualified capability; assets remain implementation supply.

### 12.5 Health-driven companion mood

Do not celebrate “good” BP, become sad about missed challenges, react to Model V2 output, or turn a result into affection/attention. This conflicts with current Living City authority.

### 12.6 Persistent hidden affection/mood score

No hidden meter, streak, relationship score, or cross-session reaction memory is authorized. It would create new persistence and potentially manipulative pressure.

### 12.7 Global `touch-action: none`

Do not disable page gestures for a transparent whole-screen companion layer. Only the exact admitted gesture surface may claim touch manipulation.

### 12.8 Unbounded retap queue

Do not let rapid taps queue seconds of reactions that continue after the user leaves. One bounded reaction owner must coalesce/replace/cancel deterministically.

### 12.9 Animation completion gating navigation

A route change is not delayed until a cute animation finishes. Navigation/lifecycle invalidation cancels the decorative behavior.

### 12.10 Accessibility by visual imitation only

A hidden canvas, hover-only cue, or invisible drag target is not an accessibility equivalent. Expose an actual semantic action and status where the user needs one.

### 12.11 Copying historical thresholds as permanent standards

The existing 6px drag threshold, 300ms reaction hold, and legacy head/body/feet zones are evidence from specific surfaces. Reuse requires current runtime evidence, not historical inertia.

### 12.12 Treating this proposal as a generic Behavior Director authorization

The North Star discusses longer-term arbitration, but this docs task does not authorize a behavior-tree framework, central event bus, worker, or new dependency. A future slice should implement only the smallest owner needed for its exact interaction.

## 13. Explicit non-goals

This proposal does **not**:

- implement emotion, reaction, tactile play, gaze, or animation;
- change the current S02 root runtime;
- migrate the legacy slot, S05 saved scene, S10 replay attention, My Space actor, or Living City world shell;
- add a generic companion behavior engine/director;
- change companion asset identity, activate candidate assets, or publish new assets;
- change clip policy, production companion policy, or current scene activation;
- introduce audio or haptic assets/APIs;
- add camera/microphone/motion/perception/dialogue;
- add persistence, analytics, telemetry, reaction history, mood state, or account data;
- change Auth/RLS/API/DB/retention/deletion/Model V2;
- make companion interaction a prerequisite for semantic tasks;
- create or authorize an Experience Slice Issue;
- authorize production deployment.

## 14. Candidate future implementation slices

These are **candidate slices only**. None is authorized by this proposal. Each needs a new GitHub Issue from live `origin/main` and its own revalidation.

### Slice 01-A — S02 tap acknowledgement without root ownership expansion

**Goal:** give the current S02 actor one bounded tap response while preserving the current root relocation system exactly.

Smallest coherent scope:

- start from the existing tap-vs-relocation claim path on the current semantic actor target;
- on an exact-current-fence tap, emit one local interaction intent;
- add the minimum renderer-local authored reaction owner required for one qualified acknowledgement mapping;
- do not let reaction code write the S02 world root;
- no stroke/grab, gaze expansion, audio/haptic, persistence, product bridge, or new asset activation;
- keep drag relocation, safe correction, Escape/cancel, route invalidation, and alternative location control unchanged.

Why first: the current S02 runtime already distinguishes tap from relocation but leaves tap unused. This is the narrowest seam that tests whether local reaction and fenced world movement can coexist without importing the legacy tactile drag architecture.

### Slice 01-B — Reaction lifecycle / rapid-input hardening

**Goal:** prove that one reaction owner survives rapid repeated tap, replacement, cancellation, and teardown without queues or stale callbacks.

Scope candidates:

- same-intent rapid tap policy;
- different qualified reaction replacement policy if the product has more than one tap cause;
- exact reaction epoch cancellation on route/owner/asset/session change;
- pending timer cleanup;
- background/resume behavior;
- no new gesture types.

This may be folded into 01-A if a production-quality tap reaction cannot be responsibly shipped without it. It should not be deferred merely to make the first implementation appear smaller.

### Slice 01-C — Explicit tactile-play mode / local deformation

**Goal:** add stroke/grab delight without competing with root relocation.

Prerequisite: a proven local embodiment transform/owner separate from the world root and a clear mode/target separation between relocation and tactile play.

Scope candidates:

- one bounded local gesture family;
- one qualified species/asset set first;
- spring/settle and pointer-cancel cleanup;
- semantic non-gesture equivalent to the meaningful reaction outcome;
- no health/product bridge.

### Slice 01-D — Attention/gaze coexistence

**Goal:** add bounded attention after reaction/local-touch ownership is explicit.

Scope candidates:

- one approved attention source;
- authored-pose/additive-gaze composition;
- suppression during root relocation/local grab/reaction when necessary;
- blur/visibility/suspension cleanup;
- no camera/face/eye sensing.

### Slice 01-E — Asset/species capability qualification

**Goal:** move from “clip exists” to an explicit current runtime capability projection for interaction.

Scope candidates:

- exact active asset identity → supported reaction/tactile/gaze capabilities;
- per-capability fail-closed behavior;
- no candidate asset activation;
- visual/runtime evidence for divergent silhouettes or bone availability;
- avoid product branching on species name alone where exact asset identity is required.

This slice may need to precede 01-A if live source at implementation time no longer offers one uniformly qualified active asset family.

### Slice 01-F — Living City interaction conformance adapter

**Goal:** apply the already-proven grammar to a future Living City actor owner without importing semantic product state into the renderer.

This is explicitly **not** pre-authorized. It may happen only inside a separately approved Living City Experience Slice whose current architecture declares the relevant actor/interaction owner. The adapter should reuse intents and cancellation semantics, not assume the current S02 DOM/Arena/port implementation is the future world model.

## 15. Dependencies and prerequisites

### Common prerequisites for any slice

1. live `origin/main` and task Issue are read first;
2. current `AGENTS.md`, PROGRAM, Living City contract, and current Presence owner contracts are re-read;
3. active asset/scene identity and current activation authority are resolved from checked-in source;
4. current renderer transform hierarchy and writer ownership are mapped before mutation;
5. current reduced-motion/forced-colors/viewport policy is observed in the actual browser;
6. no protected product/data/model boundary is imported merely to make the reaction more “personal.”

### Additional prerequisites for animated reaction

- verify exact active asset(s) contain and are authorized for the intended behavior;
- decide one renderer-local action/pose owner;
- establish the local transform/bone domain that reaction owns;
- prove no writes hit the current root relocation transform;
- decide reaction replacement/coalescing behavior before coding timers.

### Additional prerequisites for tactile play

- prove gesture ownership separation from root relocation on touch and pointer;
- define the local embodiment transform/envelope;
- define capability differences for the first qualified species/asset set;
- define a non-drag equivalent outcome;
- test pointer capture cancellation and route teardown.

### Additional prerequisites for gaze

- identify current bone/pose capability from the active asset, not candidate history;
- define priority against reaction and direct manipulation;
- preserve authored pose by explicit additive/remove-before-update behavior or an equivalent proven composition method.

## 16. Acceptance and evidence ideas for candidate slices

These are evidence **ideas**, not a permanent release-gate registry. A future task chooses only what is proportional to its claims.

| Candidate | Minimum behavioral claims worth proving | High-value runtime evidence |
|---|---|---|
| 01-A tap acknowledgement | tap produces one qualified response; drag never produces tap response; reaction does not write/move world root; stale route/owner tap cannot fire; missing capability fails closed | compare root/placement/write counters before/after tap; actual browser tap + drag threshold cases; route exit during/after tap; keyboard explicit activation; reduced-motion/fallback behavior |
| 01-B rapid input | no unbounded queue; chosen same-intent retap policy is deterministic; different intent replacement is deterministic if supported; timers die on unmount/owner change | boundary matrix around selected reaction hold/settle time; 0/near-threshold/repeated tap sequences; stale callback assertion after route and asset incarnation change |
| 01-C tactile play | local transform changes while root remains invariant; gesture and relocation cannot both own one pointer; cancel settles/cleans up; non-drag outcome equivalent exists | root/world matrix invariant during local touch; pointer capture/cancel/lost capture; touch device drag; scroll outside target; local settle bounds; keyboard/AT action |
| 01-D gaze | gaze composes without corrupting authored pose; yields during conflicting direct manipulation/reaction; no stale attention after blur/route | pose before/after reaction; drag + gaze overlap; blur/visibility; reduced motion; missing head/spine capability |
| 01-E capability qualification | exact active identity determines capability; clip existence alone does not; unsupported species/asset fails closed | iterate exact active identities; inspect approved clip/bone contracts; one divergent silhouette/bone-negative case; no candidate asset request |
| 01-F Living City conformance | same interaction intent/cancel semantics under the then-current shell owner; no health/business state import; semantic fallback remains | actual world runtime exercise plus direct semantic fallback; owner/write diagnostics; WebGL failure; keyboard/touch equivalence proportional to slice |

### Evidence that source inspection alone cannot establish

For these interactions, source inspection is insufficient to prove:

- a reaction is perceptible but not distracting;
- a tap threshold feels intentional on coarse touch;
- a companion does not visually jump when reaction/local offsets compose with relocation;
- a 320/390 actor has usable travel geometry;
- focus and forced-colors affordances are actually visible;
- rapid retap does not feel like flicker even if state transitions are technically correct.

Use actual browser/runtime exercise for claims of interaction quality. Proposal 10 should govern the broader evidence vocabulary rather than this document creating a standing QA phase.

## 17. Risks and unresolved questions

### 17.1 What should the first S02 acknowledgement look like?

The repository proves clip availability broadly but not a final semantic mapping for current full-scene S02. `greet` or `curious` may be plausible implementation candidates, but choosing one here would improperly convert asset vocabulary into product authority. The implementation slice should review the active actor motion in-context and choose the quietest qualified mapping.

### 17.2 Should one visual actor target multiplex tap and drag accessibly?

Pointer multiplexing is natural, but an accessible button named only “move companion” would become misleading if Enter/Space triggers a reaction. A future slice must decide whether to rename/describe the actor target, expose a separate explicit reaction action, or use another semantic pattern without duplicating focus traps.

### 17.3 Does S02 remain the right reference surface when implementation starts?

Current source makes S02 the strongest ownership reference. Living City work may later change the preferred reference surface. The future Issue must not resurrect S02 merely because this proposal used the 2026-09-29 baseline.

### 17.4 How much tactile anatomy should be species-specific?

Current head/body/feet screen-space zones intentionally avoid bone-name dependence, but silhouettes differ widely. A single whole-body tactile response may be more robust for some species. This requires runtime/visual evidence, not taxonomy assumptions.

### 17.5 Does reaction require a persistent frame loop?

Current S02 intentionally avoids one. A future reaction may be implementable with bounded invalidation/frames rather than permanent RAF. Performance/lifecycle evidence should decide; this proposal does not require continuous animation.

### 17.6 How should reduced-motion users receive optional companion delight?

The current scene may disappear to a poster under reduced motion. Future Living City surfaces may keep a static actor. The correct equivalent may be a static pose/semantic acknowledgement or no decorative action. The rule is not “motion but slower”; it is “no essential outcome lost, no unwanted motion introduced.”

### 17.7 Where should a reusable reaction intent live?

It should live at the narrowest seam that can serve the approved slice. Do not create a generic event bus or behavior framework in anticipation of future surfaces. If two independently approved surfaces later prove the same contract, refactor from evidence.

### 17.8 Interaction vs sensory vocabulary

A tap reaction may eventually have sound/haptic feedback. Proposal 05 must define global sensory priority, mute/reduced-motion/unavailable equivalents, and interruption. Proposal 01 should emit only the interaction/reaction fact needed by that future grammar, not duplicate it.

## 18. Live revalidation checklist before any implementation Issue

Before opening or implementing any slice derived from this proposal, re-check all of the following against live repository and runtime state.

### Repository/task authority

- [ ] Resolve the exact current `origin/main` SHA; do not reuse this proposal’s baseline.
- [ ] Read current root `AGENTS.md`.
- [ ] Confirm the new task has its own bounded GitHub Issue and that #899 does not itself authorize implementation.
- [ ] Confirm current open PRs/branches do not already own the same companion surface.
- [ ] Re-read current `docs/transcend/PROGRAM.md` and `SK7_LIVING_CITY_3D_FIRST_PRODUCT_CONTRACT.md`.
- [ ] Re-read current Model V2/privacy/data-lifecycle authority if any proposed cue touches semantic product events.

### Current owner reality

- [ ] Identify the exact visible actor owner on the target surface.
- [ ] Identify the sole current world/root writer and its fencing/lifecycle token.
- [ ] Identify renderer mount/load/draw/dispose owner.
- [ ] Identify existing animation/mixer/action owner, if any.
- [ ] Identify any current local tactile or gaze writer.
- [ ] Verify there is no second hidden/legacy owner on the same actor.
- [ ] Confirm the target transform hierarchy from current source and runtime inspection.

### Asset/capability reality

- [ ] Resolve the exact checked-in active asset identity and activation authority.
- [ ] Verify the intended reaction clip/pose exists in the exact active asset used by the slice.
- [ ] Verify clip/bone existence is also allowed by current product policy; do not treat presence as authorization.
- [ ] Check all species/variants claimed by the slice; fail closed for unsupported capability.
- [ ] Confirm no candidate/review-only asset is accidentally promoted by the interaction code.

### Input/arbitration reality

- [ ] Re-read the current tap/drag threshold and pointer-claim implementation.
- [ ] Verify touch-action scope and native page scrolling outside the actor target.
- [ ] Decide and document same-intent rapid retap behavior.
- [ ] Decide and document replacement behavior for different reaction intents, if more than one exists.
- [ ] Define route/session/owner/asset/suspension cancellation tokens.
- [ ] Verify a tap cannot acquire/write root movement and a relocation cannot also trigger the tap reaction.
- [ ] If tactile play is included, prove it cannot compete with relocation for the same pointer/write domain.

### Accessibility/adaptive reality

- [ ] Exercise keyboard focus/activation and the non-drag relocation path.
- [ ] Confirm accessible naming still matches actual actions after adding a reaction.
- [ ] Check reduced-motion current behavior and design a no-motion equivalent only if the actor remains interactive.
- [ ] Check forced-colors focus/control visibility.
- [ ] Exercise target viewport classes relevant to the slice, including narrow and short cases where the actor may disappear.
- [ ] Use actual 200% zoom/text evidence when the slice’s geometry/focus claims require it, following Proposal 10/current evidence authority.

### Failure/lifecycle reality

- [ ] Verify asset/WebGL failure leaves the semantic task usable.
- [ ] Verify pointer cancel, lost capture, Escape, route change, owner handoff, and teardown cancel stale interaction.
- [ ] Verify pending reaction timers/callbacks cannot fire into a new actor incarnation.
- [ ] Verify background/resume does not replay expired reaction debt.
- [ ] Verify no new DB/Web Storage/telemetry/logging/persistence path was introduced for interaction state.

### Scope/merge boundary

- [ ] Keep the implementation Issue to the smallest coherent slice; do not implement later candidates because this proposal describes them.
- [ ] Re-run current narrow tests plus actual browser interaction proportional to the changed behavior.
- [ ] Do not deploy, mutate production/provider state, activate assets, change Model V2, or add protected persistence without separate current-task authority.

---

This proposal intentionally stops at the grammar boundary. It gives future implementation work enough ownership, state, input, accessibility, cancellation, and evidence structure to select a small coherent slice without pretending that today’s S02 DOM, thresholds, clip mappings, or renderer will remain unchanged for the life of SK7.
