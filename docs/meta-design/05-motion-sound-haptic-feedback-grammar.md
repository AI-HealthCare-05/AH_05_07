> **DESIGN PROPOSAL — NOT IMPLEMENTATION AUTHORITY**

# 05. Motion, Sound & Haptic Feedback Grammar

## 1. Status, baseline, and authority boundary

**Status: repository-grounded design draft for Issue #899.** This document defines a sensory experience language for future bounded work. It does not authorize production behavior, implementation beyond this docs-only task, deployment, provider changes, protected data/model changes, new persistence, dependencies, active assets, new audio files, haptic APIs, or a new Experience Slice Issue. No implementation or production publication follows from reading, accepting, or merging this proposal. #396 is unchanged.

Repository: `AI-HealthCare-05/AH_05_07`. Investigated source baseline: `6d3207d673b8001d8809628c0830d5a2f5affe39`, resolved from live `main` on 2026-09-29 KST. Tests cited here were **inspected, not executed for this draft**. Reading a timer test does not establish visible-frame quality; reading audio code does not establish what a person heard. Source, an observed run, physical-device behavior, user comprehension, and deployment are separate facts.

Future implementation starts from then-live `origin/main`, a new bounded GitHub Issue, and revalidation of this proposal's assumptions. Root `AGENTS.md` remains the sole repository-workflow authority. The current task Issue/PR, PROGRAM, Living City architecture, Model V2 and other current protected contracts override this draft. Historical timing tables and rollout gates do not become current instructions merely because a document retains them.

The contribution is **the meaning, admission, duration class, interruption and non-sensory equivalent of feedback**. Proposal 01 owns interaction/pose composition, 02 owns navigation, 03 owns personal-choice and receipt meaning, and 04 owns content, visual hierarchy and spatial envelopes. This document does not take those responsibilities away. A consistent language does not require a global FX bus, shared animation engine, or new store.

Candidate letters identify possible boundaries, not an assigned roadmap or prerequisite chain. The document is not a project ledger, status registry, handoff file, or standing QA phase. Local review diagrams, when supplied, are explanatory documents only: not activated art, implementation, motion playback, or proof of actual product interaction.

## 2. Current repository reality and evidence

### 2.1 Evidence map

These are source references for this proposal, not a replacement authority registry. Paths refer to the inspected revision; every future slice must reopen its affected paths and current contracts.

| Ref | Source or contract | Relevant evidence and limit |
| --- | --- | --- |
| R01 | [AGENTS](../../AGENTS.md), [PROGRAM](../transcend/PROGRAM.md), [Living City contract](../architecture/SK7_LIVING_CITY_3D_FIRST_PRODUCT_CONTRACT.md) | Workflow and shell/bridge separation; sensory experience is product functionality, not permission to change protected semantics |
| R02 | [Scene policy](../scene-policy-contract.md), [Model V2 contract](../model-v2-product-contract.md), [UX flow](../ux-flow.md) | Cause-specific visual exceptions; S11 meaning and transient privacy; truthful loading and confirmed facts |
| R03 | [styles.css](../../web/src/styles.css), [scene-stage.css](../../web/src/components/scene/scene-stage.css) | Existing control tokens, hover/focus and a scoped S02 placement-settle treatment; tokens are not universal event policy |
| R04 | [JourneySkeleton.tsx](../../web/src/components/JourneySkeleton.tsx), [journey-feedback.css](../../web/src/components/journey-feedback.css) | Local pause control, visible loading status, decorative skeleton, 2.8-second surface/sweep cycle and accessibility stops |
| R05 | [useJourneyTransition.ts](../../web/src/components/useJourneyTransition.ts), [SceneShell.tsx](../../web/src/components/SceneShell.tsx) | One owned Web Animation over copy/desk DOM; cancellation, current media facts, route/session distinctions |
| R06 | [PresenceSceneActorInteraction.tsx](../../web/src/components/PresenceSceneActorInteraction.tsx), [presenceSceneActorRuntime.ts](../../web/src/platform/presence/presenceSceneActorRuntime.ts) | Fenced placement, correction, cancellation and semantic status; placement commit is not a persisted cosmetic save |
| R07 | [CompanionRuntimeBoundary.tsx](../../web/src/components/CompanionRuntimeBoundary.tsx), [CompanionReviewRenderer.tsx](../../web/src/components/CompanionReviewRenderer.tsx), [companionReactionRelease.ts](../../web/src/components/companionReactionRelease.ts), [companion-review.spec.ts](../../web/e2e/companion-review.spec.ts) | Narrow legacy eligibility and resettable release timer; not current S02 reaction authority or proof of 300 ms of visible motion |
| R08 | [savedScene.ts](../../web/src/ui/savedScene.ts), [SavedSceneBoundary.tsx](../../web/src/components/SavedSceneBoundary.tsx) | Ephemeral once-only presentation opportunity, visibility/failure skip, semantic confirmation outside decoration |
| R09 | [worldScene.ts](../../web/src/placeable/worldScene.ts), [PlaceableWorld.tsx](../../web/src/placeable/PlaceableWorld.tsx), [current companion summary / E5 / E6](../companion-runtime.md) | Product plaza playback, manual twilight sequence, visit-local lifecycle and existing keepsake lighting exception |
| R10 | [PlaceableExperience.tsx](../../web/src/placeable/PlaceableExperience.tsx), [controller.ts](../../web/src/placeable/controller.ts), [placeable value contract](../../web/src/placeable/contract.ts), [placeable.contract.spec.ts](../../web/e2e/placeable.contract.spec.ts) | Explicit preview/confirm, immutable pending operation, exact receipt, UNKNOWN/conflict; `saved` also describes load/cancel states |
| R11 | [feedback.ts](../../web/src/placeable/feedback.ts), [placeable-experience.contract.spec.ts](../../web/e2e/placeable-experience.contract.spec.ts) | Gesture-requested, default-muted oscillator motifs and generation-fenced enable; synthetic audio tests, not audibility or loudness measurements |
| R12 | [companionActor.ts](../../web/src/placeable/companionActor.ts), [GardenNook.tsx](../../web/src/placeable/GardenNook.tsx), [placeable-world.contract.spec.ts](../../web/e2e/placeable-world.contract.spec.ts) | Separate My Space embodiment, visit rest/greet and reduced-motion paths, geometry and cleanup assertions |
| R13 | [themePreference.ts](../../web/src/ui/themePreference.ts), [browserPersonalization.ts](../../web/src/ui/browserPersonalization.ts) | Existing browser presentation keys; no authority for a new persistent global sensory profile |
| R14 | [visual production contract](../visual-production-contract.md), [Factory/runtime boundary](../architecture/SK7_VISUAL_FACTORY_RUNTIME_ACTIVATION_BOUNDARY.md) | Semantic/accessibility and asset-supply limits; historical timing/approval prose does not override newer source or root workflow |

### 2.2 Current feedback already uses several local mechanisms

There is no reason to describe SK7 as having no feedback system. CSS provides ordinary control states, the skeleton uses CSS loops, Journey copy uses Web Animations, legacy companionship has a mixer and timer, S02 placement uses a semantic sibling and a CSS settle mark, and My Space uses its own frame loop and optional audio owner. Their lifetimes and meanings differ. A future language should explain those differences before attempting reuse. R03–R12.

Current foundation tokens include fast 160 ms, base 260 ms, scene 360 ms, slow 520 ms and recap 720 ms. They describe available CSS values. The current Journey hook separately uses 160 ms entry, 120 ms reveal and 200 ms Today reveal. Neither fact means every screen currently runs a 360 ms transition. Scoped CSS can suppress generic button transforms, as the S02 actor hit target does. R03, R05.

### 2.3 Loading is a real state; its rhythm is not request progress

`JourneySkeleton` has a local `motionPaused` state, a named pause/resume button, a polite loading sentence and a decorative inner layout. Current CSS gives the blocks and broad light wash a 2,800 ms cycle, with small phase offsets between groups; its separate status dot uses 2,400 ms. The offsets explicitly express visual grouping, not completion percentage or separate network stages. R04.

The component does not own data readiness or impose a minimum viewing time. The surrounding application decides whether loading exists. A ready response can replace the skeleton without waiting for the sweep to finish. Reduced motion and forced colors suppress the relevant CSS animations and hide the now-unnecessary local motion toggle. User pause pauses presentation, not the request. R02, R04.

Do not infer complete hidden-tab cleanup merely from these CSS media rules. The local skeleton component inspected here does not itself install a visibility listener. A future visibility claim must examine the mounted owner and browser behavior rather than borrow the cancellation evidence of another renderer.

### 2.4 Journey transition is an overlay on existing semantic truth

`useJourneyTransition` keeps one owned Animation and cancels it before replacing it, on hidden-document notification and on teardown. The previous/current screen, phase and session generation determine eligibility. It skips the initial unqualified entry, suspension, reduced motion, hidden state, changed session, non-content phase and the independently owned S05/S13 paths. SceneShell supplies forced-colors suppression to this hook as well. R05.

For a Today load reveal, the target is `.today-desk`, not the world stage. Other eligible transitions target `.scene-copy`. The hook never waits for animation to navigate, save, reveal real facts, or move focus. Its completion promise only clears its own matching animation handle. If Web Animations is unavailable, the base DOM remains visible. This is a useful causal and ownership precedent, not a mandate to wrap every screen in that hook.

### 2.5 S02 placement, legacy reaction and S05 confirmation are different facts

S02's placement UI consumes a fenced spatial runtime. It exposes `committed`, `corrected`, `restored` and `no-space` with distinct Korean status sentences. A placement count change triggers the local settle mark. That is not an account/browser save receipt and must not be called “saved to my space.” The pointer claim, restore and root writer remain with Presence. R06.

Legacy tactile/reaction paths are narrower. The resettable release helper schedules 300 ms and cancels the previous handle; inspected tests check zero-valued handles, 299/300 ms, reset, cancellation and independent instances. Those tests establish timer behavior, not 300 ms of unobstructed animation frames, asset qualification on every species, or a current S02 reaction. R07.

S05 has a separate `SavedSceneEvent`: an ephemeral key and claim/skip opportunity without a record or account identifier. The decorative boundary skips opportunities on relevant visibility/failure/teardown paths; semantic checkmark, heading and actions remain outside it. The broader current scene contract owns exact saved-event behavior. Cosmetic placement must not reuse S05 celebration as a generic success signal. Guest memory-only confirmation is also distinct from authenticated persistence. R02, R08.

### 2.6 Existing My Space effects have deliberately different causes

Pinwheel interaction increments a visit-local pulse only when current controller state admits that play. It does not save. Cosmetic confirmation instead passes through the immutable operation/receipt path. A loaded positive revision or cancellation can make `saved` true, so that flag cannot identify a newly confirmed local operation. Equal-looking selections do not prove which operation committed. R09–R10.

The manual E6 Twilight control starts a sequence of gate, approach, details and an optional companion greeting. It is not caused by clock, health state, save status or revision. The existing sequence includes subtle lighting on the keepsake face. This does not conflict with E4's static **selection/save** presentation when the cause is kept explicit: no new acquisition celebration, particles or saving sound is granted by E6. R02, R09.

Current PlaceableWorld skips scene work while the document is hidden and resets its frame-time origin, rather than proving that every pending visual phase is discarded. Its parent closes audio on hiding. These behaviors are not identical to Journey animation cancellation or SavedScene opportunity skipping. This proposal therefore separates observed lifecycle behavior from any future decision to change it.

### 2.7 Current audio is small, local and optional

`PlaceableAudio` creates/resumes an AudioContext only through an explicit enable call. The product starts muted. It has two synthesized three-note motifs, pinwheel and twilight, not a generic audio asset library or ambient soundtrack. Its generation check prevents an old asynchronous enable result from becoming the new owner's ready state; disposal invalidates the generation and closes the context. The parent controls actual user actions and visibility/unmount cleanup. R10–R11.

The audio generation check and the parent status update are not the same fence. The inspected `toggleAudio()` awaits `enable()` and then publishes its result when the parent is alive; it does not carry a separate latest-attempt check at that call site. An older completion returning `unavailable` could therefore be a status-ordering concern after a newer enable or mute. This is a source-level race hypothesis, not a reproduced browser defect or permission to patch it here. Candidate 05-D must test the parent label as well as actual resource readiness. R10–R11.

`play()` returning true means oscillators were scheduled against a running context. It does not prove sound reached a speaker, was audible, or had a safe physical level. The configured gain is not a measured volume at the ear. The inspected implementation has no general voice-budget or cross-surface mixer contract; repeated play calls can schedule multiple motifs. That is a scaling question for a selected future slice, not permission to add a sound platform now.

### 2.8 What is not established

No qualified haptic product path was established by the inspected source and a targeted `vibrate` search. An empty search is not proof that no related code exists anywhere. Haptics therefore remain a **decision-first candidate**, with actual target-device support and user control to be investigated before any API use.

Likewise, this inspection does not establish service-wide sensory settings, global audio arbitration, all-surface hidden-tab stopping, a shared FX scheduler, perceptual success of more effects, or physical-device performance. Existing tests and documents answer narrower questions. The design must not fill those gaps by declaring a universal engine or claiming evidence that was not gathered.

## 3. User promise / North Star

> **“When I act, I can see what responded, understand what changed, and stop optional stimulation without losing the task.”**

The primary experience is direct: a control responds where it was used, a selected object visibly corresponds to the choice, and the resulting state has a concise name. Feedback may feel tactile, generous and memorable. It must not require decoding an effects vocabulary before performing an important action.

The user should distinguish “the button accepted my press,” “this is only a preview,” “the location changed,” “the request is pending,” and “the selected storage owner confirmed this operation.” These are separate meanings even when they happen close together. A scene can be delightful without calling them all success.

A person using keyboard, reduced motion, muted audio, forced colors, a small viewport, or a failed renderer retains the meaningful outcome. Optional delight can have a different representation; it does not need pixel-identical animation. Stopping an effect is a product choice, not a penalty or an indication that the person used the service incorrectly.

## 4. Problem statement

The danger is not merely too little or too much motion. It is **motion that tells the wrong story**. A broad loading sweep can resemble progress; a save flourish can fire on reload; a correction can look like rejection; a greeting can be mistaken for approval of a health result; and a sound can arrive after the user has left the action that caused it.

Existing local mechanisms also expose an ownership risk. CSS, a Web Animation, a Three.js controller and a theme update can all attempt to write the same presentation property. “Use the same easing” does not resolve that race. A sensory language needs an explicit cause, surface, lifetime and terminal state for each treatment.

Finally, copying one lifecycle rule everywhere would break current distinctions. A paused ongoing load may resume while that same load remains unresolved. A missed saved-event celebration should not replay later as a fresh success. A manual visit atmosphere may remain in its selected static state. A cancelled drag needs the spatial owner's restoration, not an FX helper's guess. The design problem is to make these differences predictable without constructing a new control plane.

## 5. Principles

### 5.1 Truth first, embellishment second

Input acknowledgement is not operation acceptance. An accepted request is not a receipt. A receipt is not proof the animation was seen. Optional playback does not create or invalidate a business fact. The semantic owner publishes truthful state independently; an eligible effect can accompany that state without delaying it.

### 5.2 Rich coverage, selective emphasis

Every consequential action deserves a legible response; not every response needs movement, sound and vibration. Use the strongest emphasis on the user's current action and its consequence. Background delight should not compete with a focused control, a pending decision or a recovery explanation. “One emphasis” is an attention hierarchy, not a rule that only one CSS property can animate.

### 5.3 Static understanding is the foundation

An unanimated frame must identify the action, selected state and consequence. Effects strengthen that association rather than replace it. Keep short visible names such as `미리보기`, `저장 확인 중`, `위치 바뀜` and `계정 공간에 저장됨` where those facts are true. Do not teach only through “the glowing item.”

### 5.4 Local consequence before global spectacle

A color selection should primarily change the selected object. A location correction should primarily clarify the corrected position. A global flash, camera move or unrelated companion reaction makes the cause harder to trace and crosses more owners. Use existing local seams first; a wider scene response needs an independently justified cause and affected-property boundary.

### 5.5 No deferred coercion

Inactivity does not justify escalating prompts, compulsory tutorials, surprise audio or a queue of missed delight. A self-ending discovery cue can stop after its bounded opportunity. Re-entering a screen is not consent to replay everything the user missed. No effect may make a declined cosmetic choice, missed day or shorter session look like failure.

### 5.6 Interruption is part of the design

Every treatment needs a defined response to a new action, navigation, identity replacement, hiding, media preference changes and failure. Specify whether it pauses, cancels, skips or settles. “Cleanup on unmount” alone is insufficient when the screen can change state while remaining mounted.

### 5.7 Reuse meaning before code

Two surfaces may share the phrase “confirmed” without sharing storage or animation machinery. Reuse the semantic distinction and review questions first. Extract code only after independently qualified cases demonstrate a common boundary. Existing library capabilities do not justify a new dependency or global event bus.

### 5.8 Capability does not imply permission

A clip can exist but be ineligible on a surface. An AudioContext can exist while audio remains muted. A device might expose vibration without a qualified user experience. A material can emit light without being entitled to signal a saved record. Admission always combines the current task's authority with the current local state.

## 6. Protected boundaries

### 6.1 Health and model semantics

Measured BP, BP direction, Model V2 inputs/outputs, risk-like labels, poor outcomes, missed targets and inferred health quality do not select companion emotion, world lighting, cue intensity, sound pitch or haptic strength. No heartbeat-like “risk pulse,” animated score gauge, favorable green atmosphere, negative-outcome shake or reward multiplier is proposed. S11's execution/result semantics and preview expiry stay under its current contract and #396.

A semantic form may identify invalid input or a confirmed save under its existing rules. That does not authorize visual interpretation of the value. New measurement, edited record, challenge fact, optional cosmetic play and model computation retain separate meanings. Do not generate cue names that covertly encode those protected values into logs, URLs or scene props.

### 6.2 Data, identity and uncertain-write truth

No effect creates a save, retries a write, advances a revision, selects an account, changes a slot, deletes a record or navigates as a side effect of finishing. Preview, hover, resize, repeated render and animation callbacks are not persistence events. Existing controller/session guards win even if a visible animation is incomplete.

No raw request/account/record identifiers, medical values or model data enter a generic feedback object. An existing owner may issue the smallest ephemeral presentation opportunity it already supports. If extra lifetime identity is needed later, define it within that owner and prove it cannot become telemetry or persisted behavioral history.

### 6.3 Persistence and preferences

The proposal adds no saved sensory preference, tutorial-complete flag, sound-history ledger, mood state, haptic consent key or replay queue. Current OS preferences, component-local pause and visit-local audio readiness are distinct facts. Reusing `sk7-ui-theme` to store sensory state would be a persistence change, not a harmless token adjustment. Global settings remain a separately scoped decision with Proposal 08.

### 6.4 Assets and current exceptions

No audio file, animation clip, texture, particle asset or haptic API is created or activated here. Existing asset membership, surface policy and rights remain authoritative. E4 cosmetic save stays static; existing explicit E6 lighting remains its own cause; S05 confirmed-save presentation remains independent. “Shared success FX” cannot dissolve these exceptions.

### 6.5 Accessibility, protected work and release

Decorative emphasis cannot conceal focus, hide an error or hold a user inside a scene. Important controls remain semantic and reachable without optional media. Existing pause/static policies are not relaxed to make feedback more dramatic. Publication, irreversible operations and new dependencies require the current task's explicit scope; docs-only merge is not release authority.

## 7. Ownership and architecture seams

### 7.1 Responsibility table

| Concern | Owner to preserve | Contribution of this grammar |
| --- | --- | --- |
| Decide which action happened | Existing interaction/domain/controller owner | Name its feedback meaning without reinterpreting data |
| Admit pointer and move/restore a root | Presence or current world input/locomotion owner | Consume the resulting status; never become a second transform writer |
| Play authored companion pose | Current renderer-local action/mixer owner | Define cue lifetime and sensory relation; Proposal 01 owns composition |
| Navigate and establish destination truth | Current source/bridge/destination owners | Feedback does not add another history mutation or delay the handoff |
| Confirm cosmetic storage | PlaceableController and selected adapter | Distinguish pending, UNKNOWN and exact receipt from visual selection |
| Draw material/lighting changes | Target scene's final material owner | Combine base appearance and admitted local emphasis without competing writes |
| Animate semantic copy | Current local DOM animation owner | Cancel only its own handle; keep base content visible |
| Schedule optional sound | Existing user-enabled audio owner | Bound cue admission and lifetime, not product truth |
| Announce state and manage focus | Existing semantic UI owner | One concise announcement; focus does not follow decorative choreography |
| Haptic capability | No qualified path established here | Decision-first future boundary; no ambient permission |

### 7.2 A feedback brief, not a new event schema

Before implementing one treatment, record its **cause**, **fact being expressed**, **eligible surface**, **authoritative owner**, **property/channel budget**, **start condition**, **terminal visual state**, **interruption behavior**, **duplicate policy**, **static equivalent**, and **evidence claim** in that task's design. This is a review checklist, not a TypeScript interface or a requirement for a registry.

For example: an admitted pinwheel location choice expresses *unsaved preview*; the existing controller owns the choice, the scene owns the projection, and the semantic editor owns its label. A local outline may accompany it. The outline ends on replacement/cancel/confirmation or loss of eligibility, and its completion does not call save. No request payload is needed to draw that outline.

### 7.3 One final writer per presentation property

The same DOM `transform` must not be independently owned by generic hover CSS, an entry animation and a drag controller without deliberate composition. Likewise, a Three.js material's emission must not be alternately overwritten by a theme loop and a receipt effect. A future slice may use a dedicated local wrapper, separate channel or a single composition function, but it must choose the smallest solution and name its owner.

Restoring a base property is conditional on still owning that target. An old effect cannot reset a newer theme, a different actor, a remounted DOM node or another pointer's position. Disposal and animation cancellation are not permission to write into the next owner's state. Immutable content identity and current route/visit fences from Proposals 01/04 remain relevant.

### 7.4 No inferred bridge from paint to persistence

The existing S02 placement `commitCount`, Placeable `pulse`, Placeable `saved`, S05 presentation key and world `welcomePhase` are not interchangeable event streams. Their names can sound similar while expressing different lifetimes. Do not standardize them into a universal “success count.” A reusable view may receive a bounded state label only after the originating owner has resolved its own meaning.

### 7.5 Audio and visual owners can remain separate

The current My Space parent owns optional audio while the scene owns lighting and play. They can share a direct user action without audio readiness gating the visual state. A future cue coordinator, if necessary for a bounded action, passes only the admitted cue class and ephemeral lifetime; it does not own all renderer frames, auth or persistence. Late audio preparation must not replay a visual action from a prior route or generation.

## 8. State and sensory interaction grammar

### 8.1 Causal sequence

```text
existing owner accepts an action or publishes a truthful state
                         |
                is this cue eligible now?
                         |
       current owner + qualified target + user preferences
                         |
             bounded local sensory response
                         |
            end / replace / cancel / skip / settle

semantic state and permitted actions remain available independently
```

Eligibility is checked both when a cue is requested and when an asynchronous resource becomes ready. A cause that was valid before navigation is not automatically valid after an asset or audio resume completes. A readiness flag cannot resurrect a consumed opportunity. If eligibility cannot be established, keep the named semantic state without the optional effect.

There are two different completion questions: **did the application operation complete?** and **did this feedback presentation finish?** The first belongs to the action owner. The second can release a visual/audio resource or remove an overlay. It cannot answer the first question or gate the user's next action.

### 8.2 Meaning table: similar visuals do not make facts equivalent

| Cause class | What it may communicate | What it must not communicate | Stable semantic equivalent |
| --- | --- | --- | --- |
| Hover/focus | This named action is available | The action already occurred | Label plus persistent focus/affordance |
| Press acknowledgement | This control received the deliberate activation | The request succeeded or data was saved | Pressed/busy state appropriate to the actual handler |
| Unsaved choice | This option is being previewed | Ownership, completed activity or receipt | `미리보기 · 아직 저장 전` |
| Local relocation | Actor/object reached an admitted local position | Account/browser persistence | `위치 바뀜`, or the existing more precise status |
| Safe correction | The requested location was adjusted to a legal one | User failure, health warning or deletion | `가장 가까운 안전한 위치에 놓았어요` |
| Cancellation/restoration | The spatial/editor owner restored the prior valid state | A new save or punishment | Existing restored/cancelled state |
| Request pending | The operation has not resolved | Percent complete, guaranteed success, confirmed failure | `저장 확인 중` or current scope-specific text |
| UNKNOWN outcome | Confirmation has not established the result | “Definitely failed” or “definitely saved” | `저장 여부 확인 필요` plus current recovery action |
| Exact cosmetic receipt | This operation is confirmed in the selected scope | Generic account backup or activity achievement | `계정 공간에 저장됨` / `이 브라우저에 저장됨` |
| Explicit play/greeting | The selected local play happened | Evaluation of health, attachment level or stored relationship | Named play/greeting response |
| Explicit visit atmosphere | The user's temporary scene presentation changed | Time-of-day fact, health state, unlock or cosmetic save | `이번 방문의 해질녘` or current qualified wording |
| Semantic route ready | The destination's current content is presented | Proof every asset loaded or a domain operation succeeded | Destination heading and actual status |

These phrases illustrate meaning rather than authorize copy replacement everywhere. Keep the live surface's more precise sentence where it already explains scope, correction or uncertainty.

### 8.3 Five temporal classes

**Stateful affordance** lasts as long as its state: focus, selected, disabled, pending or error. It should not disappear because a short entrance animation ended. This class needs no perpetual motion; a border and label may be sufficient.

**Direct manipulation** follows a currently admitted pointer/keyboard input. Its spatial owner determines position, limits and cancellation. Added stretch or glint must remain subordinate to that input and inside the qualified envelope. It must not trail so far behind that the user cannot tell where the object is.

**Bounded one-shot** answers one eligible cause: a tap acknowledgement, local play accent, route entrance or qualified receipt presentation. Its opportunity can be replaced, consumed or skipped. A queue of missed one-shots is not a history feature.

**Ongoing-state loop** expresses a fact that is still ongoing, such as the current unresolved initial load. User pause affects the loop without changing the fact. End the loop immediately when its owning state ends; neither a full cycle nor a minimum display time is required.

**Visit-local presentation endpoint** is a chosen appearance such as existing twilight. Its transition and its final state are different. Reduced motion can retain the final hierarchy without travel; cancellation of a transitional flourish need not erase the explicitly chosen visit state. Persistence and re-entry still follow the current owner, not this taxonomy.

### 8.4 Attention arbitration without a global scheduler

When cues compete, preserve the currently consequential semantic state first: account/session change, destructive confirmation, uncertainty, error and accessibility controls outrank optional teaching or ambient effects. Next preserve direct manipulation and the action currently being performed. A qualified local acknowledgement can accompany it; unrelated discovery and ambient emphasis yield.

This order is a design heuristic for a selected surface, not a new total-order event bus. Several compatible low-intensity properties may change together to express one cause. The prohibited case is multiple unrelated demands for attention, or two writers fighting over the same property. A focused button's outline remains even if a background scene is in twilight; a recovery dialog must not erase that scene's data, but it can suppress optional attention competition.

In an editor, stop an entry hint once the user has entered the task. Choosing a new color supersedes the old preview's flourish; the actual new preview is not delayed until the old flourish completes. Repeated inactivity never increases urgency. If a cue repeatedly interrupts typing or masks a validation sentence, remove that cue rather than reduce the text.

### 8.5 Repeated and rapid input

Use **replacement**, **coalescing**, or **rejection by existing action eligibility**, not an unbounded queue. Different meanings need different policies. Rapid color choices normally show the latest admitted preview. Repeated confirmation remains governed by pending locks. A greet action already in progress may remain ineligible under its current actor controller. An earlier cue must never restore an old color or re-enable a stale button.

For a replaceable visual cue, invalidate the old callback before scheduling the new one. When a handle can be zero, cancellation must still work; the inspected reaction-release helper is concrete evidence of this concern. For an irreversible or server-backed action, presentation coalescing does not replace idempotency or uncertain-write protections.

A later implementation should test down/up intervals, retap during a hold, retap during fade-out, different target selection, and a route change before the scheduled callback. Timer assertions establish deterministic scheduling; actual input and rendered observation establish whether the response reads as acknowledgement rather than flicker. Neither is a substitute for the other.

### 8.6 Stop vocabulary and resume table

| Operation | Meaning | Example use | Resume rule |
| --- | --- | --- | --- |
| Pause | Temporarily freeze optional presentation while its source state remains valid | User pauses the current loading loop | Resume only the same still-live ongoing state; never postpone ready content |
| Cancel | End owned animation/work and remove its temporary contribution | Journey copy animation during navigation or hiding | A new eligible cause is needed; no stale callback |
| Skip | Consume an optional presentation opportunity without showing it | A missed S05 celebration opportunity | Do not replay on visibility, remount or capability restoration |
| Settle | Resolve to the current owner's valid stable presentation | Reduced-motion endpoint for manual twilight; final static selected state | Remain stable until new explicit input or current owner state changes |
| Restore | Ask the action owner to return to its prior valid state | Cancelled spatial drag or editor preview | The action owner decides the result; an FX owner cannot independently restore data/root |

A surface may use more than one operation: cancel a transition and retain a static endpoint; stop audio and preserve the visible selected state; restore a dragged actor and skip an obsolete local flourish. The words must describe actual behavior, not become synonyms for clearing a timer.

### 8.7 Interruption matrix

| Interruption | Semantic/control response | Optional presentation response | Important qualification |
| --- | --- | --- | --- |
| New admitted choice | Show new choice immediately | Replace older local preview cue | No old completion may restore the prior choice |
| Route or owner replacement | Destination/identity owner takes over | Cancel old handles; skip stale one-shot opportunities | No cross-account or cross-route replay |
| Hidden document | Do not invent a data transition | Apply the selected owner's pause/cancel/skip policy; stop optional sound under existing My Space policy | Current E6 frame pause is not universally a skipped sequence |
| Reduced motion enabled | Preserve the task and named result | Remove nonessential movement; settle or skip as qualified | Disabling reduced motion later does not replay missed success |
| Forced colors enabled | Preserve names, focus, borders and state | Drop glow-only/nonessential transition contributions | A canvas color change alone is not a semantic equivalent |
| User mutes | Keep the action/result | Close or stop current optional audio work through its owner | Unmuting does not replay old motifs |
| Pending/UNKNOWN/conflict | Expose correct state and recovery | Suppress unrelated instructional/success cues | Existing controller still owns reads/retries |
| Renderer/resource failure | Keep core semantic actions and scope | End failed owner's effects, use qualified fallback | No “item lost” or “record failed” story from graphics failure |
| Pointer cancel/lost capture | Existing spatial owner restores/revokes as applicable | Remove cue tied to that pointer | Do not release a newer pointer's capture |
| Layout resize/text enlargement | Recompute actual usable composition | Reproject or cancel stale spatial decoration | No persistence, navigation or tutorial replay |

The table is a future design selection tool, not a claim that every current path implements identical hidden-tab or media-toggle logic. In particular, changing E6 from pause-like behavior to skip/settle would need a focused later Issue and evidence; this proposal does not silently patch it.

### 8.8 Timing is a relationship, not one magic number

Use current surface tokens where appropriate, but select duration from meaning, travel distance, affected area and interruption requirements. Fast input acknowledgement should not wait for a cinematic scene transition. A large-area light wash may need a different temporal contrast from a small pressed-state cue. A shorter animation can still be more distracting if it changes a large bright area repeatedly.

Current numbers are comparison anchors: Journey 120/160/200 ms, S02 settle about 220 ms in its scoped CSS, legacy release 300 ms, loading breathing/sweep 2.8 seconds, and E6's authored sequence ending at 2.1 seconds. They do not authorize changing any of these owners or provide a service-wide minimum. The old visual-production transition numbers must not override the current hook's scoped behavior. R03–R09.

For a future one-control experiment, begin with the relevant existing token rather than inventing a complete timing scale. Adjust only after checking that the initial response is perceptible, the cause/result connection remains clear, repeated input does not queue, and cancellation is safe. Record the chosen value in the implementing task, not as a new permanent global performance target.

Never make ready content wait for the chosen duration. Never add fake request stages to fit choreography. Do not describe a scheduled 300 ms timer as 300 ms of visible rendered pose; hidden frames, asset readiness and display scheduling are different matters.

### 8.9 Cause-specific exceptions: E4, E6 and S05

**E4 keepsake selection/save:** retain a still motif and static preview/receipt language. No new prize entrance, save pulse, sound or particle burst is implied. The identity remains one selected slot, not an acquired collection record.

**E6 manual atmosphere:** retain the existing scene-owned environmental lighting sequence, including its subtle keepsake-face lighting. The cause is the explicit light control, not the presence of a saved motif, a successful save, time, health or revision. A new visit/retry begins from the current default. This exception cannot be repurposed by listening to a persistence boolean.

**S05 confirmed new save:** preserve the independent saved-event opportunity and its semantic confirmation outside decoration. It is not a cosmetic receipt, an edit acknowledgement, or a Model V2 result celebration. Guest memory confirmation does not become authenticated persistence just because the same clip is visible.

Any future shared sensory treatment must identify which exception applies before selecting a visual or sound. Where a current contract is narrower, the narrower current cause/surface rule wins. Refactoring shared code does not merge the authorities.

### 8.10 Audio grammar

Sound is an optional accent to an already valid visible action. Start muted unless a future approved preference contract explicitly changes that rule. Enabling audio is distinct from asking to replay a past event. Preserve the current generation check around asynchronous context preparation; mute, visibility cleanup or owner replacement invalidates pending readiness.

Use a small vocabulary of clearly differentiated local cues, not a sound for every hover or pointer sample. Existing pinwheel and twilight motifs have different causes. A future receipt cue would require its own semantic and audio qualification; it is not granted by the fact that the current synthesizer can make another tone. Do not tune pitch, dissonance, repetition or volume to a health or risk value.

When rapid actions can overlap, choose a bounded local rule before adding more cues. A reasonable candidate is one currently admitted motif in that local owner, with repeated identical requests coalesced or declined while active. A new distinct action can use a specifically reviewed replace/skip policy. This is a design candidate; the current three-oscillator implementation is not claimed to provide that arbitration. Do not solve a one-surface problem with a global audio mixer by default.

Stopping/muting must also account for sound already scheduled, not merely prevent a later UI label from becoming `ready`. The implementing owner must show how it stops/closes its scheduled resources and handles late enable completion. Test real listening and system controls on the claimed devices. Synthetic oscillator creation counts, `context.state` and `play() === true` do not prove perceived timing, physical loudness, or hardware output.

If sound is unavailable, retain the same visible result and a quiet availability status only where the user requested audio. Do not show a blocking error or repeated permission prompt. Do not load music, request a microphone, open speech synthesis or add autoplay background sound to complete a tactile-feedback slice.

### 8.11 Optional haptic grammar, decision-first

Haptics would supplement an explicit action; they would not be the only evidence of success, correction or error. No haptic API is enabled by this document. A later decision must identify supported devices/browsers, permitted invocation conditions, user control, unavailable behavior, cancellation capability and a way to verify actual physical output without inferring support from a broad device label.

Consider at most one non-medical local action first, such as an already meaningful control activation, and compare it with the visual-only outcome. Avoid continuous vibration, urgency patterns, pulse-rate metaphors, health-based intensity and repeated patterns while a request is pending. Do not simulate unsupported haptics by shaking the whole screen or adding sound without permission.

If an implementation cannot reliably observe physical output or cancel a pattern, its claim must be limited accordingly. An API return value would not prove that a user felt anything. Lack of haptics must never remove a control, deny a cosmetic choice, or reduce access to semantic destinations. Persistent haptic preference would require an explicit Proposal 08/data-lifecycle decision rather than piggybacking on theme or auth storage.

### 8.12 A compact user-facing sequence

The desired visual reading is **available action → deliberate input → local consequence → truthful named state**. Keep the source and consequence near each other where possible. Use existing layout/spacing rather than adding a paragraph under every control. At the moment of uncertainty, reverse the emphasis: the stable recovery sentence and next action become primary, while nonessential effects yield.

No step requires an automatic tour, fake pointer, extra click to reveal the real action, or a time delay. A person can choose immediately, cancel immediately when current rules allow it, and proceed immediately after truth permits. Optional sensory polish is experienced along the path, not imposed as a toll before the path becomes usable.

## 9. Desktop, mobile and adaptive behavior

### 9.1 Scale the affected area, not only the duration

A desktop hover elevation can be a small local event; the same displacement over a tall mobile card may move a large part of the view. Preserve the meaning while reducing travel, scale and background movement on constrained compositions. Do not merely multiply every duration by a device-size factor. Viewport size is not evidence of processing power or permission to remove semantic feedback.

On a spacious desktop, the world and its tools may share a wide view, but the active effect should still connect the selected control to the affected object. Tablet and narrow views may bring the editor into document flow. Revalidate that the preview is visible when the choice changes; an offscreen glow is not instruction. The approach should not require an extra renderer solely to animate a duplicate preview.

### 9.2 Touch and non-hover input

A touch action must not require a first tap to emulate hover and a second tap to perform the action unless the actual interaction contract deliberately requires confirmation. Use visible labels, selected state and ordinary pressed feedback. Preserve native scrolling outside the admitted manipulation target. Do not apply whole-page gesture suppression merely to make a visual response feel responsive.

Button enlargement through glow does not enlarge its hit target. A particle trail does not increase drag travel. Measure the actual semantic target, protected navigation regions and usable motion envelope. Short viewports and a virtual keyboard can remove the very space an effect expected; cancel or recompose optional decoration instead of covering the next action.

### 9.3 Text enlargement and persistent controls

At 200% text, feedback sentences, scope labels and controls may wrap. Their surfaces must grow or flow; never shrink text to preserve a cinematic composition. Persistent action and recovery controls must not slide out of reach to make room for decoration. A focus ring should not be clipped by a parent overflow rule introduced for a light sweep.

For a narrow/short canvas, retain clear semantic alternatives rather than forcing movement through an illegible world. Current S02 poster fallback and My Space static/reduced paths are different implementations; do not claim that S02 currently offers a new static reaction action merely because this proposal values it.

### 9.4 Resource adaptation

Reuse the local owner’s measured renderer/resource policy. Rich feedback does not justify raising the drawing buffer, adding full-screen postprocessing, new shadow passes or permanent animation loops without evidence. First prefer changes to an existing local property and bounded frame work. A CSS wash is not automatically cheap merely because it avoids JavaScript; inspect its affected area and actual browser behavior when selected.

A lower-cost representation preserves state names and action availability. Optional audio/haptics can remain unavailable without being simulated through a more expensive visual effect. A visual-only fallback must not recreate the same stimulation problem with repeated opacity flashes.

## 10. Accessibility and non-primary-input equivalents

### 10.1 Equivalent result, not forced identical sensation

A person should complete the same consequential action with keyboard or an existing non-drag control and receive the same truthful state. A pointer-only decorative greeting is not permission to hide the semantic greeting action already present on My Space. Conversely, this proposal does not add new optional interactions to currently excluded surfaces. Each selected slice must qualify its actual equivalents.

Focus is a state, not a brief animation. Keep a visible focus treatment until focus changes; hover disappearance cannot remove it. A screen-reader user needs the affected object/action and resulting state, not a narration of every material change. Use one appropriate state announcement rather than simultaneous scene, toast and editor announcements that repeat each other.

### 10.2 Reduced motion

Remove nonessential camera travel, scale/bounce, elastic motion and repeated sweeping where the qualified policy requires a static path. Retain meaningful selected state, correction text and current confirmation. Do not replace every animation with an automatic fade and assume the problem is solved. Some cases should settle instantly; others should simply skip optional display.

Live preference changes matter. A change during a cue must remove owned transient contributions and preserve the current valid state. Returning to unrestricted motion later is not a new cause for prior celebration or instruction. Existing source-specific behavior remains authoritative until a later task deliberately changes it.

### 10.3 Pause, stop and user control

Ongoing optional movement must have the pause/stop/hide behavior required by the current accessibility contract. The existing loading pause control is a useful narrow precedent, not a global setting. Pausing never suspends network truth or hides an error. A short self-ending hint is preferable to repeatedly demanding attention, but brevity alone does not make a flashing or destabilizing effect acceptable.

Automatic scrolling, focus movement and camera relocation are not substitutes for a label. Do not move the user's target while they are trying to activate it. Where motion expresses direct manipulation, preserve the input owner's constraints rather than classify all adjacent ambient motion as essential.

### 10.4 Forced colors, contrast and quiet semantic regions

Use semantic borders, selected markers, names and focus, not only glow, hue or emissive material. Keep important copy on a readable stable surface when the world behind it changes. A world palette and a semantic High Contrast preference are different concerns. No scene color choice may erase the status or label needed to understand the operation.

Do not use strobing, alarm-like flashing or abrupt repeated full-screen luminance changes. Review combined area and repetition, not just each independent effect. Multiple individually small cues can become a large attention event when synchronized. Apply the current accessibility authority and verify the changed surface rather than inventing a claim of compliance from timing values alone.

### 10.5 Muted/unavailable audio and haptics

Audio and haptics never carry the only distinction between preview, pending, correction and confirmed state. Keep equivalent visible/semantic information. An availability label should be truthful: `소리 꺼짐`, `소리 사용 불가`, and an action result are different facts. Do not announce that the person heard or felt something.

No microphone, camera, orientation sensor or dialogue capability is needed to deliver this grammar. Optional future haptics must not become a prerequisite for accessibility or access to delight. Actual assistive-technology and physical-device exercises are selected when a future slice makes those claims, not replaced by static markup inspection.

## 11. Loading, failure, recovery and lifecycle behavior

### 11.1 Never turn an effect failure into an operation failure

If a DOM animation API is unavailable, the selected state remains visible. If an optional clip fails, the existing semantic confirmation or play result still follows its real owner. If audio cannot start, the visual action remains valid. Keep optional renderer/resource failure separate from a failed or uncertain save.

A frame that did not draw cannot erase an already confirmed receipt. Equally, a frame that looks like the saved object cannot establish a receipt. This separation is essential when an asset loads slowly, a tab hides, or the selected storage mode changes while a request is pending.

### 11.2 Pending and UNKNOWN

Pending feedback may indicate that a request is being processed, but cannot manufacture a percentage, completion estimate or successful endpoint. When the result is UNKNOWN, use stable recovery presentation rather than endless suspense choreography. Do not shake the form as though a known validation failure occurred. Keep the candidate labelled as a candidate.

The current PlaceableController may perform a bounded automatic reconciliation read after selected failures. Write retry remains the admitted immutable pending operation. This proposal does not forbid that existing read, create a retry worker, or replace the request with a fresh operation to give the animation another chance. Old rereads cannot prove the pending operation failed. R10.

### 11.3 Conflict and correction are not synonyms

Spatial correction means the current placement owner found a safe location. A persistence conflict means newer state or operation mismatch requires explicit review. They need different wording and behavior. A smooth visual move cannot resolve a database conflict, and a conflict warning should not be reused for a harmless nearest-safe placement.

Retain the latest confirmed arrangement and the user's edited intent as the current controller allows. Do not blend them visually until the user can tell which is stored. A future save-confirmation cue happens only after the reviewed/rebased operation is actually confirmed, not when the conflict panel is dismissed.

### 11.4 Cancellation and removal

Cancellation of a preview restores what the current editing owner defines as valid. It is not a save success. Removal must retain explicit scope and confirmation under the current contract; a disappearing object is not sufficient explanation that account data will be deleted. Avoid playful disappearance choreography at irreversible decisions where it would obscure what is being removed.

A cancellation callback belonging to an old target must not reset the current target. Preserve exact handles, generations and owner fences at the narrowest existing seam. Do not introduce a global animation kill switch that also interrupts an unrelated current operation or hides its status.

### 11.5 Asset/capability restoration

If a resource becomes available after an opportunity was skipped, do not automatically play an old celebration. If an ongoing state still exists, its owner may permit a representation to become available without replaying unrelated events. A manual world retry creates the current path's new visit; it does not restore old input capture, sound or pending local FX callbacks.

Unsupported saved cosmetic data remains preserved under the data contract. An effect cannot convert it to a default supported object and save the fallback. A grey or neutral representation indicates inability to render/edit only where named; it must not be described as lost ownership. Coordinate this boundary with Proposal 04's asset lifecycle and Proposal 03's data truth.

### 11.6 Diagnostics without a behavioral history

A future deterministic test can observe local cue counts, owners, cancellation handles and resource disposal in an isolated synthetic run. Do not persist those diagnostics as user analytics, save production raw event payloads, or add a feedback-history panel merely for debugging. Tests should record the minimum sanitized evidence needed for the changed behavior.

Do not treat a `data-*` diagnostic attribute as authority for current readiness, receipt or identity. It can help inspect a result; the source owner remains the authority. The same principle applies to screenshots: visible color is evidence of appearance, not proof of the underlying mutation or ownership boundary.

## 12. Conflicts and anti-patterns

| Temptation | Why it fails | Chosen alternative |
| --- | --- | --- |
| Put every element on a perpetual pulse | Competes with the task and needs control; more effects do not prove comprehension | Broad response coverage, selective finite emphasis |
| Reuse one success cue everywhere | Conflates press, placement, play and persistence | Cause-specific meaning and named stable state |
| Play whenever `saved` is true | Load/cancel can satisfy the flag | Exact current receipt opportunity or static status |
| Await animation before showing ready content | Makes polish a task gate | Truth visible immediately; optional overlay |
| Put networking in an animation completion | Changes operation semantics and creates duplicate-write risk | Existing action owner controls networking |
| Queue every tap or tone | Produces stale feedback and overlap | Scoped replace/coalesce/decline policy |
| Turn E6 keepsake lighting into save celebration | Changes the cause and defeats E4's boundary | Preserve manual atmosphere as a separate exception |
| Apply one pause rule to all owners | Loops, one-shots and visit endpoints have different meanings | Explicit pause/cancel/skip/settle/restore choice |
| Let an old effect reset the base color | Can overwrite newer choice/theme/owner | Exact target lifetime and one final writer |
| Copy legacy tactile transforms to S02 | Violates current Presence root ownership | Use Proposal 01's target-specific responsibility boundaries |
| Remove names because glow explains everything | Loses keyboard, screen-reader and static meaning | Short visible labels plus semantic state |
| Infer audibility from scheduled oscillators | Scheduling is not physical output | Real listening evidence with stated limitations |
| Infer vibration support from “mobile” | Device category is not a qualified capability | Separate target-device decision and no-haptic equivalent |
| Persist tutorial/mute state under a theme key | Introduces hidden persistence semantics | Separate approved preference decision, or keep visit-local |
| Make health values change pitch, brightness or intensity | Adds forbidden health interpretation | No such input enters the sensory boundary |

## 13. Explicit non-goals

This draft does not implement animations, audio, vibration, a new API, renderer, timer service, global FX scheduler, event bus, state-management package, dependency or provider. It does not create media assets, publish files to R2, activate clips, change #396, deploy, or open implementation Issues.

It does not mandate one duration for every response, continuous motion everywhere, a soundtrack, automatic speech, camera/microphone input, motion sensing, persistent tutorial completion, inferred emotional state, engagement scoring, or health-result rewards. It does not redesign account/browser ownership, cosmetic storage, record retention, semantic navigation or the current default home.

No static board or document-rendering check establishes real motion quality, audibility, haptic output, frame rate, accessibility conformance or product persistence correctness. Those belong to the later selected implementation and its proportionate evidence.

## 14. Candidate future implementation slices

Candidates are alternatives ordered by expanding boundary, not a compulsory schedule. Re-read current source before selecting one; do not recreate behavior already implemented. Each needs a new bounded Issue outside #899. Where a candidate overlaps Proposal 03, it is **one shared future slice viewed through two concerns**, not a reason to create duplicate work or a second owner.

### 05-A — One pinwheel preview response that teaches without a paragraph

**User outcome:** choose a color or socket and immediately associate that input with the existing unsaved preview, including a static/keyboard path.

**Scope:** one current pinwheel editing sequence; local affordance/selection response, concise preview label, reduced-motion/forced-colors equivalent and replacement/cancellation. Preserve the existing controller and immediate preview. No new keepsake effects, audio, haptics, storage, second renderer or world-root writer. This is the sensory specification for Proposal 03-B, not a separate duplicate implementation.

**Prerequisites and stop:** use 03-A's composition or equivalent then-current layout. Identify the exact property owner and usable envelope from 01/04. Stop if a meaningful result requires changing a persistence field, delaying the preview, inventing a gesture-only control or animating an offscreen consequence without a usable semantic equivalent.

**Acceptance idea:** unaided synthetic operator attempt identifies the option, preview and cancel path; rapid alternating choices show the latest selection without queues; cancel/resize/route change cannot restore an obsolete choice. Record zero writes for preview/cancel and distinguish deterministic scheduling from actual rendered comprehension. Do not call one operator representative user research.

### 05-B — Exact pinwheel receipt clarity, with optional bounded accent

**User outcome:** distinguish a saved operation in the chosen scope from a preview, reloaded arrangement, cancellation or unresolved request.

**Scope:** current pinwheel-only pending/UNKNOWN/confirmed presentation and, only when a narrow exact-operation opportunity is available, a bounded local visual accent. No saving sound by default, no E4 keepsake celebration, no S05 reuse, no receipt/schema change. This is the sensory counterpart of Proposal 03-C and should use the same future Issue when selected.

**Prerequisites and stop:** inspect controller receipt matching, local action lifetime and the lack of a reliable signal in `saved` alone. If the exact new local receipt cannot be distinguished without broad controller work, the coherent first slice is static receipt clarity; defer the accent. Do not create a generic success-event transport to avoid that decision.

**Acceptance idea:** matching response and matching reconciliation each acknowledge at most once; old reread remains UNKNOWN; equal selection with a different operation does not celebrate. Load, cancel, remount, Back/Forward, media changes and account replacement do not replay. The semantic saved state remains correct when the visual accent is disabled or fails.

### 05-C — One explicit Twilight visit with clarified interruption behavior

**User outcome:** turn the existing lights on/off and understand the selected atmosphere without stale greetings, unexpected sound or a trapped task after interruption.

**Scope:** the existing explicit E6 action only, with a deliberate decision about hidden-tab, reversal, reduced-motion and mid-sequence suspension behavior. Preserve its current cause, visit lifetime, material ownership, qualified keepsake-face lighting and no-persistence rule. Do not add automatic time selection, seasons, new effects/assets, multiple lighting owners or a global scheduler.

**Prerequisites and stop:** compare then-current frame-loop behavior with the desired pause/settle/skip policy. If current behavior already satisfies the user outcome, do not change it merely to match a proposed vocabulary. If changing hiding behavior would affect the actor's independent action or data flows, narrow the slice. The established default-on-new-visit and semantic exits remain intact.

**Acceptance idea:** interrupt at gate, route, detail and optional-greet stages; reverse before completion; hide/resume; enable reduced motion mid-sequence; block the companion; retry the renderer. Confirm the chosen endpoint, permitted greeting count and audio behavior, with no writes and no loading/recovery gate. Existing E6 tests are a starting point; new policy needs new actual-runtime evidence.

### 05-D — Bounded rapid-input behavior for the existing optional motifs

**User outcome:** enable sound deliberately, activate existing local play, and receive a coherent optional response without overlapping or late motifs after mute/exit.

**Scope:** one existing My Space audio owner and its pinwheel/twilight cues. Select a local voice-admission/replacement policy only if the observed rapid-input case warrants it. Preserve default mute, asynchronous generation fencing, unavailable status and visual independence. Do not add an audio asset library, ambient soundtrack, saved preferences or service-wide mixer.

**Prerequisites and stop:** establish a reproducible overlap/lifetime problem in the current implementation and identify scheduled-resource cancellation. Without such evidence, retain current behavior rather than refactor speculatively. If the desired cancellation cannot be supported cleanly by the existing owner, reduce the cue policy before introducing infrastructure.

**Acceptance idea:** rapid same/different cue requests remain within the declared local bound; mute/hide/exit closes or stops owned scheduled sound; late enable completion cannot play a prior cue or overwrite a newer parent status with an obsolete attempt result. Synthetic tests check resources and generations; actual listening checks output, temporal relation and user controls on the claimed device. Report untested output devices explicitly.

### 05-E — Reuse between two already-qualified feedback surfaces

**User outcome:** two existing controls communicate the same semantic distinction consistently without altering their independent state owners.

**Scope:** choose two concrete, already implemented cases with genuinely matching meanings and prove whether a shared token, small pure policy or local view is worthwhile. Do not begin with an app-wide migration. Navigation, S05, Presence commit and cosmetic receipt are not automatically matching cases.

**Prerequisites and stop:** both source paths and actual user-visible states must be understood. State explicitly which behavior remains different, such as cause, static fallback, identity fencing or interruption. Reject extraction if it requires exposing private data, coupling lifetimes or weakening a narrower exception. A documented decision not to share is valid.

**Acceptance idea:** both surfaces retain previous capability/gating and no extra writes, routes or resource owners. Test a simultaneous or stale callback from one cannot change the other. Visual review confirms consistent meaning, not pixel identity. This candidate may become unnecessary as current source evolves.

### 05-F — One haptic feasibility and product decision, not automatic activation

**User outcome:** determine whether one optional non-medical haptic accent offers value on a specified real target without reducing the visual/semantic path.

**First coherent scope:** a separate authorized decision examining capability, user control, output verification, interruption limits, unavailable behavior and whether persistence is truly needed. No API is invoked by #899. No broad “mobile support” or device-wealth assumption is sufficient.

**Prerequisites and stop:** identify a real target and a real action whose outcome is already understandable without haptics. Reject the candidate if it introduces required vibration, health-coded patterns, sensory coercion, unsupported cancellation promises or a new tracking profile. Any actual API/persistence change needs its own explicit boundary.

**Acceptance idea for the decision:** a physical operator can distinguish optional output from no output, stop it where supported, and complete the same task without it. The result can be “do not implement.” A simulated vibration icon or API return value does not establish tactile evidence.

## 15. Dependencies and prerequisites

Proposal 01 supplies interaction claims, root/local-pose separation, retap arbitration and current species capability. This document can describe the sensory duration/termination of an admitted outcome, but cannot grant a tap reaction on current S02 or direct a second mixer. Proposal 02 supplies route intent, source-release and destination focus; a transition effect cannot take over navigation or demand an animation-complete event before handoff.

Proposal 03 supplies preview, current slot/collection meaning, exact cosmetic receipt and account/browser scope. Candidates 05-A/B are explicitly coordinated with its existing candidates rather than a second implementation chain. Proposal 04 supplies effect-capable surfaces, material role, dynamic envelope and semantic clearance. An effect must fit those constraints and have one final property writer; 04's “emissive capability” alone is not a trigger.

Proposal 06 owns record comparison and factual continuity; no animated number, sound sequence or path highlight may imply improvement or completion beyond recorded facts. Proposal 07/current Model V2 owns analytical trust; optional feedback cannot invent interpretation. Proposal 08 owns account/browser/transient/device scope and would govern any future persisted sensory preference. Proposal 09 owns recovery presentation grammar while retaining existing controllers. Proposal 10 chooses evidence proportional to the claim.

None of those dependencies means all proposals must be implemented before one small response can be improved. A CSS affordance does not require a haptic feasibility study. An audio lifecycle change does not justify a new renderer. Conversely, a persistent preference or new product cause cannot be hidden inside “motion polish.” Revalidate the specific boundary, not a whole unchanged product matrix.

## 16. Acceptance and evidence ideas

### 16.1 Nine named walkthroughs

**W1 — First choice, no tutorial.** In the existing editor, find a named option, preview it and cancel. Observe whether the user associates input and consequence without prompting. Confirm no write, no success claim and no unrelated companion reaction. Repeat with effects disabled; inability to understand the static path is a design problem, not a reason to intensify the glow.

**W2 — Latest choice wins.** Alternate two colors/sockets while the local cue is active, then leave. Only the latest admitted selection is projected; no old timer restores the previous appearance or starts a write. Inspect both deterministic callbacks and a real rendered sequence.

**W3 — Fast load and paused slow load.** Resolve immediately and verify no forced animation wait. In a deliberately delayed synthetic load, pause the ongoing visual loop; the request continues and ready/error state replaces it immediately. Resume only while the original ongoing state still qualifies. Existing #901 behavior is a baseline, not a reason to reimplement it.

**W4 — Receipt versus matching appearance.** Exercise confirmed save, old reread, lost response with matching receipt, wrong receipt with equal selection, cancellation and ordinary reload. A new local accent, if qualified, occurs only for the exact current operation opportunity. Static state remains truthful with the effect removed.

**W5 — Corrected is not conflicted.** Use a safe-placement adjustment and a separate cosmetic-save conflict. Observe that location correction names the adjusted result while persistence conflict requests deliberate review. No identical alarming or celebratory response tells the wrong story.

**W6 — Explicit twilight, interrupted.** Start the existing light action, reverse it during the sequence, hide/resume, then enable reduced motion and block the optional companion. Inspect the deliberately selected current policy, final hierarchy and skipped/allowed greeting. The motif's light may change for E6; a keepsake save does not become its trigger.

**W7 — Sound enable races with mute.** Begin asynchronous enable, mute or leave before it resolves, then finish the old request. The old generation cannot become active or play a stale cue. Test rapid current cues within the selected policy and perform actual listening separately from oscillator-count assertions.

**W8 — New owner, old callback.** Replace account/route/asset owner while feedback is pending. A stale visual callback, resource completion or cue opportunity cannot populate the new owner, reset a fresh property, release fresh capture or announce a new save. Do not copy an old draft or cue into browser storage as recovery.

**W9 — Static and constrained path.** At the claimed narrow/short/text-enlarged sizes and with keyboard/static/forced-colors conditions, complete the selected action and its recovery. Verify real target geometry, focus and scroll clearance. Do not substitute a full-page screenshot for reachable controls or a media-query declaration for a completed static path.

### 16.2 Evidence must match the statement

| Claim | Suitable evidence | Insufficient alone |
| --- | --- | --- |
| Cue has the correct cause | Instrumented synthetic action/owner trace with negative causes | Visually similar object or boolean named `saved` |
| Timer replaces/cancels correctly | Deterministic scheduling with current handle/generation checks | A screenshot after the timer |
| Response is actually perceptible | Real runtime input plus observed sequence/video or appropriate frame evidence | A duration constant or diagnostic dataset |
| No operation is caused by FX | Adapter/network/state assertions for preview, cancel, resize and completion | “The user did not press save” |
| Audio cannot leak past mute/exit | Resource/generation assertions and actual listening | `play()` returned true |
| Physical haptic output is useful | Explicitly scoped real-device observation and unavailable comparison | Emulated device category or API success |
| Static/keyboard equivalent works | Complete the same action and recovery with actual focus/scroll | Merely having `aria-live` or CSS media rules |
| More FX improves understanding | Observed first-use attempts with the competing hypothesis considered | Effect count, visual praise or dwell time |

The current reaction timer tests, Placeable audio tests and component contracts can be reused within their original scope. They are not newly passing runs in this docs task. Geometry tests do not measure physical performance; scheduled/manual browser suites are not equivalent to required hosted CI. Report the actual command, revision, environment and claim only when a later implementation runs it.

### 16.3 What to measure and what to review

Measure operation/write counts, cue admission count, pending handles, stale callbacks, final properties, target boxes, affected render/resource work and explicit cleanup where they are relevant. Visually review causal clarity, perceptibility, spatial association, text hierarchy and whether the final frame still communicates the result. Listen when making an audio claim; use a real device when making a haptic claim.

Not every slice needs all measurements. A pinwheel preview outline does not require a new Model V2 test cycle or production account exercise. A receipt cue cannot be validated only as CSS. A haptic decision cannot be validated only in desktop emulation. This is a proportional evidence grammar, not a standing gate registry.

### 16.4 Success is comprehension, not compelled engagement

A good outcome is a person who can identify the next action, distinguish preview from confirmation, understand recovery, and choose a static or muted path. Choosing not to decorate or leaving sooner is not failure. Do not optimize for repeated tapping, extra saves, longer sessions, more health observations or more days of attendance. No new analytics is required by the proposal.

## 17. Risks, unresolved questions and scoped contradiction review

### 17.1 Named unresolved questions

| Risk/question | Position in this draft | What resolves it later |
| --- | --- | --- |
| Do richer responses teach better than clear static hierarchy? | Hypothesis, not demonstrated by an entertainment-brand reference | Scoped direct observation, including the no-effect comparison |
| Can a new local receipt opportunity be exposed without broad refactoring? | Current exact receipt is promising; `saved` is inadequate | One focused source/runtime design; otherwise retain static receipt |
| Should E6 freeze, settle or discard remaining phases on hiding? | Current hidden-frame behavior is not rewritten here | Explicit per-visit policy and interrupted runtime evidence in 05-C |
| Can audio cues overlap perceptually under rapid input? | Current scheduler has no general voice-budget contract | Reproduce on selected path; choose local admission only if needed |
| Does audio generation fencing also guarantee latest parent status? | Not established; the parent awaits a result with an alive check but no visible per-attempt fence | Controlled ordering test and actual selected-path observation in 05-D |
| Does a global sensory setting have a real requirement? | Not established; current preferences have different lifetimes | Product decision with 08, not a new storage key in a polish task |
| Can a large light wash remain legible and comfortable on a short phone? | Area and composition matter as much as duration | Actual viewport/static comparison, combined-effects review |
| Is a particular haptic target supported and controllable? | No qualified path established by this draft | Explicit device/API investigation and physical evidence |
| Will a shared helper leak one surface's cause into another? | Avoid extraction until two real cases prove equivalence | Dependency and negative-cause tests plus bounded ownership design |
| Could an effect encode health meaning without explicit text? | Forbidden even when expressed only by color, pitch or motion | Input-firewall review and equal-visuals-under-domain-change evidence |
| Do current hidden/media boundaries cover all legacy paths? | Not claimed; inspected owners differ | Revalidate the selected owner's actual lifecycle rather than assert global cleanup |

### 17.2 Consistency with Proposals 01–04

**01:** root relocation, tactile deformation, authored pose and gaze remain separate write domains. This document adds no new S02 reaction and no generic behavior director. Its timing language consumes an admitted outcome rather than changing what the input means.

**02:** source truth precedes departure, the bridge stays bounded, and navigation/focus remain destination-owned. Effects never create history entries or hold a semantic task until a cinematic endpoint. The phrase “cancel transition” refers to presentation unless the navigation owner explicitly cancels the route.

**03:** catalog, selected/placed state and a future owned collection remain different. No cue turns the current one-slot keepsake into a prize inventory. A receipt accent requires the exact current operation; load/cancel and UNKNOWN are not substituted. Candidates 05-A/B refer to the same future boundaries as 03-B/C rather than duplicate them.

**04:** content identity, material roles, camera/semantic clearance and resource envelopes remain its domain. This proposal owns sensory cause/time/termination conventions, not spatial topology or asset promotion. Existing E6 lighting is preserved as manual atmosphere; E4 save stillness is not broadened into a ban on all environmental lighting, nor weakened into automatic save FX.

The scoped review also distinguishes the valid meanings of `pause`, `cancel`, `skip`, `settle` and `restore`, and avoids claiming all current runtimes already implement one universal rule. These resolutions improve the first five drafts. They are **not the required completed all-ten contradiction review**. Proposals 06–10 still need to be authored and reconciled before the one docs-only PR.

### 17.3 Information not made permanent

Current durations, literal source enum names and test counts are evidence at the named revision, not contracts that future source must preserve verbatim. The durable decisions are correct cause, bounded ownership, truthful endpoint, usable equivalent and no hidden persistence. A future implementation can choose a different mechanism if it proves those properties under its own current authority.

## 18. Live revalidation checklist before any implementation Issue

1. Resolve canonical live `origin/main`, read root `AGENTS.md` and the current task Issue/PR. Do not execute against this draft's baseline merely because the links match it.
2. Re-read PROGRAM, Living City and the relevant current scene/Model V2/domain contracts. Identify any narrower exception before choosing a shared cue. Do not mutate #396 from this proposal.
3. Select one complete user action and name its meaning: input acknowledgement, preview, placement, correction, pending, UNKNOWN, exact receipt, play, atmosphere or navigation. Reject ambiguous “success.”
4. Read the exact mounted source owner, renderer/DOM target, current controller and relevant tests. Determine whether the desired response already exists before duplicating it.
5. Identify cause authority, current lifetime/generation, qualified target and one final writer for every changed property. Keep root/pose, material base/emphasis and semantic focus responsibilities explicit.
6. Define the stable no-effect representation and immediate action availability first. No API, sound, animation, asset or timer completion may become the only way to reach the task or know the result.
7. Distinguish current values from new design choices. Reuse a suitable local token when possible; no minimum wait or fake progress is introduced to fit a duration.
8. Choose explicit pause/cancel/skip/settle/restore behavior for repeated input, hiding, navigation, identity/asset replacement, media changes and resource failure. State when a new cause is required before replay.
9. For a receipt cue, prove exact current operation matching. Test load, cancel, equal selection, wrong receipt, old reread, reconciliation, remount and different-owner responses. Preserve existing read/retry semantics.
10. Preserve E4 static selection/save, existing explicit E6 atmosphere and S05 confirmed-event boundaries. Asset capability or a general “FX” request does not merge their causes.
11. For audio, preserve deliberate enable, default mute and generation/resource cleanup. Declare any new overlap policy and verify actual output separately from synthetic scheduling. Do not add an unrequested soundtrack or permission request.
12. For haptics, first make the separate target/capability/control decision. Do not infer support or quality from an API return value, and do not introduce a persistent preference without its own decision.
13. Verify the changed geometry and actual pointer/touch/keyboard/static/forced-colors/focus/scroll path where claimed. Text enlargement is not the same as actual browser zoom; state which was exercised.
14. Apply tests proportional to the claim and distinguish inspected coverage, executed checks, visual review, physical output and deployed behavior. Do not call skipped/unrouted tests PASS.
15. Re-read adjacent proposal boundaries; record a real unresolved conflict in the current task, not a new ledger. One overlapping candidate should become one coherent implementation Issue, not two competing owners.
16. Before any real repository publication, inspect changed paths and meaningful diff, use current markdown/link checks when routed, run `git diff --check` and the current autopilot guard, then required hosted checks. No product implementation or deployment belongs to #899.

---

**Closing position:** sensory richness should make the user's action and the application's truth easier to connect. The lasting system is not a catalog of animations. It is a disciplined relationship between **cause, current owner, local response, interruption and a truthful stable result**. The product may feel more alive without becoming less trustworthy when any optional sensation is absent.
