> **DESIGN PROPOSAL — NOT IMPLEMENTATION AUTHORITY**

# SK7 Meta-Design Proposal 02 — Spatial Journey, Entry & Semantic Bridge Grammar

Status: **design proposal only**
Foundry task: GitHub Issue #899
Repository: `AI-HealthCare-05/AH_05_07`
Repository baseline reviewed: `main = 6d3207d673b8001d8809628c0830d5a2f5affe39`
Proposal scope: spatial entry, semantic destinations, return-to-world grammar, browser history/deep-link behavior, loading/failure/recovery, adaptive and accessibility behavior.

This document does **not** authorize production behavior or implementation.

It does not authorize:

- a new Living City Experience Slice;
- E1 production activation;
- changes to current semantic routes;
- changes to Auth, API, DB, RLS, retention, account deletion, Model V2, or persistence;
- deployment or preview activation;
- a new router, dependency, provider, storage mechanism, or bridge event;
- new world-state persistence;
- changes to the current `#396` Model V2 research-preview authority.

Any future implementation must begin from live `origin/main`, a new bounded GitHub Issue, and revalidation of every assumption in this proposal.

If this proposal conflicts with current `AGENTS.md`, the live GitHub Issue/PR, `docs/transcend/PROGRAM.md`, `docs/architecture/SK7_LIVING_CITY_3D_FIRST_PRODUCT_CONTRACT.md`, Model V2 authority, privacy/data-lifecycle authority, or another current protected contract, those authorities win.

This proposal is not a project ledger, roadmap registry, current-state registry, or replacement architecture SSOT.

---

## 1. Status, baseline, and authority boundary

### 1.1 Purpose

The product direction says SK7 should feel like **entering a personal place**, while important health work remains directly reachable through clear semantic UI.

The current repository already proves several independent pieces of that direction:

- an isolated E1 Living City Entry rehearsal with a Today Gate;
- a current product My Space route with both 3D and Classic presentation;
- stable semantic `screen` routes with browser history;
- bounded return context between My Space and Today;
- explicit WebGL-to-Classic fallback;
- account-bound vs browser-bound My Space separation;
- a browser-local starting-home preference whose explicit-URL precedence is tested.

What is missing is a single **experience grammar** that explains how these pieces should feel like one journey without pretending that they already share one runtime owner.

This proposal defines that grammar.

### 1.2 Authority order

For implementation decisions, use this order:

1. live `AGENTS.md`;
2. live task Issue/PR;
3. current `docs/transcend/PROGRAM.md`;
4. current `docs/architecture/SK7_LIVING_CITY_3D_FIRST_PRODUCT_CONTRACT.md`;
5. current protected domain contracts;
6. live source and tests;
7. this proposal;
8. historical architecture and evidence.

Historical W-series, Phase documents, and older UX evidence remain useful provenance but do not automatically authorize forward product work.

### 1.3 Vocabulary used by this proposal

This proposal uses four deliberately distinct terms:

**World surface**
A spatial/3D presentation owned by the world runtime, such as an entry plaza, My Space plaza, or optional future spatial destination.

**Semantic destination**
An existing application capability with a stable semantic route and non-spatial usability, such as Today, Records, AI Analysis, Seven-day Review, or Settings.

**Bridge intent**
A bounded request from one experience owner to another. It identifies a semantic destination or a return context; it does not grant data access.

**Return context**
A small, validated navigation context that lets a semantic surface offer a meaningful route back to the experience the user intentionally came from. It is not arbitrary redirect state and not persistence authority.

These terms are not declarations of new source types. They are design vocabulary.

---

## 2. Current-repository reality and evidence

### 2.1 Current semantic application navigation

The signed-in semantic application uses the safe `screen` URL parameter.

Current primary destinations are documented and exercised as:

| Product meaning | Current semantic screen |
| --- | --- |
| Today / 오늘의 기록 | `S02` |
| AI Analysis / AI 분석 | `S11` |
| Records / 기록 찾아보기 | `S08` |
| Seven-day review / 7일 돌아보기 | `S10` |
| Settings / 설정 | `S14` |

`web/src/App.tsx` owns current in-app navigation.

Its `navigate()` behavior currently:

- writes `screen` into the URL;
- uses `history.pushState` or `replaceState`;
- updates requested screen state;
- clears record selection when appropriate;
- scrolls the document to the top;
- leaves browser back/forward available.

Its `popstate` handler reparses the current URL rather than maintaining a second hidden navigation history.

`web/e2e/journey-navigation.spec.ts` verifies URL updates and browser history.

This is important: the semantic application already has a real URL/history contract. A future Living City bridge should **adapt to it**, not create a parallel hidden navigation state machine.

### 2.2 Current semantic focus behavior

`SceneShell` focuses the semantic screen heading on screen change.

Therefore world-to-semantic navigation should not require a new global focus system merely to announce a destination. The semantic destination already owns its own focus-entry behavior.

Any future bridge-specific focus work should be limited to the transition boundary and must not produce two competing focus owners.

### 2.3 E1 Living City Entry is currently an isolated Transcend Lab preview/rehearsal

Current E1 source lives under `web/transcend-lab/`.

The scene profile in:

`web/transcend-lab/src/platform/spatial/e1LivingCityEntrySceneProfile.ts`

defines one spatial destination:

- `Today Gate`;
- a fixed destination id;
- proximity copy;
- a clear `Open classic Today` alternative.

The current bridge in:

`web/transcend-lab/src/platform/bridge/worldSemanticIntent.ts`

registers exactly one semantic destination:

```ts
today -> "/?screen=S02"
```

and exposes a navigation-only intent.

It also constrains product-origin resolution to HTTP(S) and rejects unsafe or cross-host override behavior.

This is useful **bridge feasibility evidence**.

It is not evidence that E1 is the current production/default entry.

The current Living City architecture contract keeps initial activation preview/reversible and states that later Experience Slices require separate Issues.

### 2.4 Current E1 bridge is navigation-only

The E1 world does not receive Today data because the user approaches the Today Gate.

The bridge maps a world semantic intent to an existing route.

That separation is the correct basis for future bridge design:

```text
world understands: destination identity
semantic app understands: destination data and task
```

The world should not need blood-pressure facts, challenge state, model output, Auth internals, report state, or arbitrary application stores just to make a destination visible.

### 2.5 Current product My Space is a separate product entry

`web/src/main.tsx` classifies a bounded E2 placeable route and dynamically loads:

`web/src/placeable/ProductPlaceableEntry.tsx`

when the URL is a valid `experience=e2` route without conflicting semantic/auth contexts.

This route is current product source, not Transcend Lab rehearsal.

It supports:

- `view=3d`;
- `view=classic`;
- `storage=account`;
- `storage=browser`.

This means the current product already has a full-page experience transition between the semantic application and a spatial/personal-place surface.

### 2.6 E2 entry verifies account authority outside the renderer

`ProductPlaceableEntry` owns account-session verification.

The renderer does not determine account ownership.

When account verification is unavailable or fails, the entry offers:

- retry account verification;
- return to Today;
- explicit browser-only continuation.

It does **not** silently read, copy, merge, or repair browser My Space state into account state.

This is a strong precedent for future spatial entry:

> navigation may preserve user intent, but a destination owner must re-establish its own protected authority.

A bridge cannot smuggle account state across an experience boundary.

### 2.7 Current My Space return context is intentionally bounded

`web/src/ui/mySpaceReturn.ts` defines a return context from a fixed cross-product:

- view: `classic | 3d`;
- storage: `browser | account`.

The semantic return URL is generated as:

```text
?screen=S02&return_space=<view>-<storage>
```

Tests reject:

- arbitrary external URLs;
- malformed extra segments;
- unsupported values;
- duplicate forged contexts.

The semantic App reads this bounded context only to decide which My Space destination link to offer when the user returns to Today.

This is a stronger model than arbitrary `return_url`.

### 2.8 Current Today -> My Space destination intent is bounded

In `App.tsx`, the Today surface exposes My Space only when the signed-in state and current read/navigation conditions allow it.

The semantic application provides only destination intent:

```text
?experience=e2&view=<3d|classic>&storage=<account|browser>
```

`ProductPlaceableEntry` then re-verifies account authority and performs destination-owned reads.

This is already the right ownership shape for a future Living City bridge.

### 2.9 Current My Space -> Today handoff protects uncertain cosmetic work

`PlaceableExperience` exposes `오늘의 기록으로 가기`.

However, when the user has:

- an active preview/draft; or
- a pending/uncertain save,

the handoff is blocked and the user is directed to settle or verify the state first.

The bridge does not silently discard uncertain work.

This establishes a crucial journey principle:

> route continuity never outranks mutation truth.

A transition can be graceful only after the source owner can truthfully release the user.

### 2.10 Current My Space internal space transition is visit-local

My Space currently has at least:

- plaza;
- Garden Nook.

The Garden transition uses visit-local component state while retaining the same controller/confirmed snapshot.

Garden entry changes focus to the Garden heading; return restores the plaza-side entry control.

This is not browser-history navigation.

That is appropriate for a bounded subspace inside one experience owner.

Therefore not every spatial movement should become a URL or browser-history entry.

### 2.11 Current world failure preserves semantic exits

The current E2 world boundary explicitly preserves:

- Classic plaza fallback;
- Today navigation.

A WebGL failure does not turn the product task into a persistence or health-data failure.

Garden lazy-load/renderer failure similarly preserves:

- return to plaza;
- Today semantic exit.

Current browser tests exercise these cases.

This is one of the strongest current seams and should remain a durable rule.

### 2.12 Current starting-home preference is browser-local and precedence-safe

The browser-local setting:

```text
sk7-starting-home
```

accepts only:

- `classic-today`;
- `my-space`.

When a signed-in user enters the bare root and My Space is selected, the current destination is:

```text
?experience=e2&view=3d&storage=account
```

Explicit URLs win.

The preference does not override:

- explicit semantic screens;
- guest;
- fixture/evidence routes;
- auth confirmation/recovery;
- explicit My Space route;
- other explicit contexts.

This means future 3D-first entry work must not treat a general “home preference” as ambient authority to rewrite a user’s explicit deep link.

### 2.13 Current history behavior spans two navigation styles

Inside the semantic App:

- route changes are SPA history updates.

Between semantic App and E2 My Space:

- anchor/full-page route transitions are used.

Browser tests verify:

- Today -> My Space;
- My Space -> Today;
- back;
- forward;
- return links.

The fact that two runtime roots exist does not invalidate browser history.

A future unified-feeling journey therefore does **not** require everything to become one React tree or one renderer.

### 2.14 Current evidence is asymmetric

Today/My Space has meaningful product integration evidence.

E1 has isolated Living City bridge evidence.

There is **not** current product authority or equivalent evidence for world destinations to:

- Records;
- AI Analysis;
- Settings;
- Seven-day Review.

The proposal can define how such destinations should behave if separately authorized later, but it must not describe them as current registered world destinations.

---

## 3. User promise / North Star

The user should feel:

> “I am moving between places and tasks inside one SK7 experience. I always know where I am, where I am going, how to return, and what will happen to unfinished work.”

This promise has six parts.

### 3.1 Entry has a clear owner

The user never sees two competing “home” concepts at once without explanation.

A qualified Living City entry, My Space entry, Classic Today entry, or direct semantic deep link must each have an obvious current owner.

### 3.2 Spatial discovery does not hide important tasks

A spatial destination can make a semantic task feel discoverable and memorable.

It must not make the task available only through movement, camera control, proximity, drag, sound, or 3D rendering.

### 3.3 Semantic transitions preserve place meaning

Opening Today from a world gate should not feel like being thrown out of the product into an unrelated website.

The semantic surface should be allowed to communicate:

- where the user came from, when useful;
- a bounded way back, when meaningful;
- without importing world state or creating hidden navigation.

### 3.4 Return is trustworthy

“Back to world” means returning to a known destination class, not restoring stale renderer memory or arbitrary coordinates.

### 3.5 Failure does not trap the user

If world initialization, asset loading, WebGL, audio, optional motion, or a lazy chunk fails, semantic destinations remain usable.

### 3.6 Direct URLs remain first-class

A user who opens a semantic link directly should not be forced through a spatial scene first.

---

## 4. Problem statement

Without an explicit journey grammar, SK7 can drift into several incompatible experiences:

1. Living City behaves like one product while semantic screens behave like another.
2. “Back” means different things in different contexts.
3. a world gate starts reading semantic application state merely to personalize itself;
4. every internal spatial move becomes browser history noise;
5. world loading delays access to important tasks;
6. deep links get overridden by a preferred home;
7. return URLs become arbitrary redirect channels;
8. 3D failure strands the user or silently changes persistence mode;
9. each destination invents its own transition animation, focus rule, and failure copy;
10. future Records/AI/Settings gates are added before destination ownership is defined.

The goal is not a universal router.

The goal is a small set of **experience laws** that different owners can implement independently.

---

## 5. Principles

### 5.1 Destination identity before destination data

The world may know:

- “this is Today”;
- “this is Records”;
- “this is AI Analysis”;
- “this is Settings”.

It does not automatically know the data inside those destinations.

### 5.2 One navigation owner per transition

At any moment, exactly one layer performs the route mutation.

Examples:

- semantic App owns its `screen` push/replace;
- a world-to-semantic bridge emits or resolves a registered destination;
- My Space owns its explicit full-page links.

Do not have both world runtime and semantic App independently push history for one user action.

### 5.3 URL truth beats hidden continuity

If a destination can be meaningfully deep-linked, its semantic route remains canonical.

Return context may enhance the experience but may not be required to understand or operate the destination.

### 5.4 Explicit deep link beats default home

A user-entered or externally shared direct semantic URL must not be hijacked by a preferred world/home entry.

### 5.5 Return context is capability-minimal

Carry only what the receiving surface needs to offer a safe return.

Do not carry:

- arbitrary URL;
- world coordinates;
- renderer object identity;
- Auth token;
- account identity;
- health data;
- model result;
- draft object;
- persistence snapshot.

### 5.6 Source owner settles uncertain work before release

If the current owner has an uncertain or pending write, the transition grammar must respect that owner’s recovery contract.

A pretty transition is not permission to abandon uncertain mutation state.

### 5.7 Internal world movement is not automatically browser navigation

Walking to a landmark, entering a garden, changing camera view, or moving between nearby world zones may remain visit-local when:

- it does not need a shareable URL;
- it does not cross product authority;
- browser Back would become noisy rather than useful.

### 5.8 Cross-authority transitions should be URL-legible

When moving between distinct product owners, URLs and browser history should remain meaningful.

### 5.9 Failure falls outward to semantic capability

If spatial presentation fails, degrade toward:

```text
rich world
-> simpler world / Classic spatial presentation
-> semantic destination
```

not toward a dead end.

### 5.10 Transition polish never delays truth

No minimum animation time may hold back:

- ready semantic content;
- an error;
- a session-expiry state;
- an uncertain-write warning;
- an accessibility-required focus transition.

---

## 6. Protected boundaries

This proposal must preserve the following.

### 6.1 Living City architecture authority

The stable world shell owns spatial/runtime concerns.

The semantic application owns health/business semantics.

The bridge owns only explicit registered intent/event boundaries.

### 6.2 Auth and identity

A world transition cannot imply that Auth has been verified.

Destination owners must establish their own session/ownership requirements.

### 6.3 Model V2

A future AI Analysis gate may identify S11 as a semantic destination only.

It must not:

- read Model V2 input/output;
- display numeric preview state in-world;
- classify the result;
- persist it;
- use it to modify world mood, gate appearance, companion emotion, or progression.

The live Model V2 contract and #396 remain authoritative.

### 6.4 Persistence

This proposal does not authorize a “last world location” database field, new browser storage, account setting, or navigation-history table.

### 6.5 Privacy

Return context must not become a disguised data transport.

### 6.6 Recovery

Experience recovery is distinct from data recovery and release rollback.

### 6.7 Assets and world content

A visual gate or landmark does not become runtime authority merely because an asset exists.

---

## 7. Ownership and architecture seams

### 7.1 The three-owner model

A cross-product journey should be modeled as:

```text
SOURCE OWNER
  owns current interaction and any unsettled local work
        |
        | releases through bounded transition
        v
BRIDGE / NAVIGATION SEAM
  owns only destination identity + bounded return context
        |
        v
DESTINATION OWNER
  establishes its own lifecycle, data authority, focus and recovery
```

No shared mutable navigation store is required.

### 7.2 World owner

A future Living City shell may own:

- current world session;
- spatial location;
- visible landmarks;
- proximity state;
- local transition presentation;
- renderer loading/failure;
- local world focus proxy/control;
- temporary “approached gate” state.

It does not own semantic screen state after navigation.

### 7.3 Semantic App owner

The semantic App owns:

- `screen` interpretation;
- `pushState`/`replaceState`;
- semantic route focus;
- semantic loading/error/data truth;
- health/product task state.

### 7.4 My Space owner

Current E2 owns:

- account/browser cosmetic mode;
- its own persistence controller;
- 3D vs Classic presentation;
- plaza/Garden visit-local space;
- uncertain cosmetic save protection;
- explicit Today return.

It should not become the generic Living City navigation router simply because it is currently the richest product spatial surface.

### 7.5 Bridge owner

The bridge should own only:

- admitted destination key;
- route resolution;
- safe origin/path policy where needed;
- bounded source/return context;
- cancellation before handoff;
- one transition completion signal if a slice needs it.

### 7.6 Destination registry concept

The current E1 registry contains only `today`.

A future product registry, if separately authorized, should remain explicit and closed rather than accept arbitrary paths.

Conceptually:

```ts
type SemanticDestination =
  | "today"
  | "records"
  | "seven-day-review"
  | "ai-analysis"
  | "settings";
```

This is proposal vocabulary, **not a declaration that these destinations are currently registered for Living City**.

Each future registration must point to an existing semantic capability and preserve its own product contract.

---

## 8. State and transition grammar

### 8.1 Transition states

A cross-owner transition should be understandable in the following conceptual states:

```text
available
-> requested
-> source-settling
-> released
-> destination-loading
-> destination-ready

or

requested
-> blocked-by-source-truth

or

released
-> destination-failed
-> fallback-available
```

These are UX states, not required implementation enum names.

### 8.2 `available`

The destination is visibly discoverable and an alternative semantic control exists where required.

### 8.3 `requested`

The user has intentionally activated a gate/link/control.

Repeated activation must not create multiple competing navigations.

### 8.4 `source-settling`

Use only if the source has a real reason not to release immediately:

- pending save;
- uncertain write;
- modal confirmation;
- explicit edit preview.

Do not add this state merely for cinematic transition timing.

### 8.5 `released`

The source has stopped owning the interaction that caused the transition.

Any source-specific input capture or transient gate animation that must be cancelled is cancelled.

### 8.6 `destination-loading`

The destination owner may show its own truthful loading state.

A world-themed transition treatment may surround it, but must not fake destination readiness.

### 8.7 `destination-ready`

The semantic destination owns focus and interaction.

The world should not continue intercepting keyboard/pointer input behind it.

### 8.8 `blocked-by-source-truth`

The transition remains on the source surface and clearly explains what must be resolved.

The current My Space pending/preview behavior is a good product precedent.

### 8.9 `destination-failed`

Failure belongs to the destination owner.

The source may offer an alternative route only when doing so does not silently change protected meaning.

---

## 9. Journey grammar by transition class

### 9.1 Class A — World -> semantic destination

Example future shape:

```text
Living City
-> approach Today landmark
-> landmark becomes semantically available
-> explicit activation
-> semantic Today
```

Rules:

- proximity alone does not navigate;
- activation is explicit;
- a non-spatial route is available;
- no health data is needed for the world landmark;
- semantic route is stable and direct;
- browser history records one meaningful cross-owner transition.

### 9.2 Class B — Semantic destination -> world

Example current shape:

```text
Today
-> My Space
```

Rules:

- destination intent is bounded;
- destination owner re-verifies protected authority;
- return context is bounded;
- semantic page does not preload private spatial state merely to render the link.

### 9.3 Class C — World -> world subspace within one owner

Example current shape:

```text
My Space plaza
-> Garden Nook
```

Rules:

- browser history is optional and should be avoided when it creates noise;
- preserve the same destination owner;
- focus changes announce the new subspace;
- provide a visible return control;
- no implicit persistence write merely because the user moved.

### 9.4 Class D — Semantic -> semantic

Current App navigation remains current authority.

Living City does not need to wrap or replace every semantic transition.

### 9.5 Class E — direct deep link

A direct semantic URL enters the semantic destination.

A direct My Space URL enters the explicit E2 destination when route guards admit it.

A future Living City direct URL, if one is ever introduced, would need its own route contract.

Default-home preferences do not override explicit links.

---

## 10. Return-to-world grammar

### 10.1 Return is not rewind

Returning to a world does not mean restoring:

- the exact frame;
- camera yaw;
- active animation frame;
- stale physics body;
- old pointer capture;
- unresolved proximity event.

A return should restore **semantic place intent**, not runtime residue.

### 10.2 Current My Space precedent

Current `return_space` preserves only:

- presentation family (`3d` or `classic`);
- storage family (`account` or `browser`).

This is a strong minimal form.

### 10.3 Future Living City return candidate

If a future Experience Slice needs a return from a semantic screen to Living City, the smallest safe return context should identify only something like:

- source experience id;
- source semantic place/landmark role;
- optional bounded presentation mode.

It should not carry coordinates.

Example proposal vocabulary:

```text
source = living-city
return-place = entry-plaza
return-role = today-gate
```

Any actual encoding requires its own implementation review.

### 10.4 When not to show “return to world”

Do not show a world-return control when:

- the user arrived through a direct semantic URL;
- the return context is invalid or ambiguous;
- the prior world session requires authority that is no longer valid;
- the destination is in a destructive/uncertain flow where returning would mislead;
- accessibility or failure fallback intentionally entered a stable semantic route without a recoverable spatial source.

### 10.5 Browser Back remains valid

A dedicated “return” control should not sabotage native browser Back.

Where both exist:

- Back answers “go to the previous history entry”;
- explicit return answers “go to the known source experience”.

They may often lead to the same place, but they express different user intent.

---

## 11. Desktop, mobile, short-viewport, and adaptive behavior

### 11.1 Desktop

Spatial entry can give more visual emphasis to landmarks and world context.

Semantic exits must remain visible without requiring camera search.

### 11.2 Tablet and touch

A world destination must have a stable explicit activation control or accessible proxy.

Proximity may stage the destination, but must not be the only activation method.

### 11.3 390 and 320 widths

The product should not preserve a large 3D composition at the cost of hiding semantic navigation.

Current source already suppresses or simplifies some heavy presentation on constrained viewports.

Future journey slices should prefer:

```text
clear destination + fallback
over
tiny unusable world + hidden controls
```

### 11.4 Short viewport

If the spatial scene cannot maintain meaningful movement and visible exits, downgrade presentation rather than forcing clipped navigation.

### 11.5 200% text / zoom

World controls and semantic exits must remain operable even when the visual composition no longer matches its ideal layout.

The semantic destination remains the stable escape hatch.

### 11.6 Orientation and resize

A resize may recompose the world.

It should not:

- create a browser-history entry;
- change the semantic destination;
- alter return context;
- silently switch storage authority.

---

## 12. Accessibility and non-primary-input equivalents

### 12.1 No destination is gesture-only

Every world semantic destination must have an explicit semantic activation path reachable without 3D locomotion.

### 12.2 Keyboard

Keyboard users must be able to:

- discover the current destination;
- activate it;
- bypass world interaction;
- reach Classic/semantic fallback;
- return when a valid return context exists.

Keyboard activation must use the same admitted destination identity as pointer/touch.

### 12.3 Screen reader

The canvas/world does not need to narrate every decorative object.

It does need a coherent semantic layer for:

- current experience name;
- important available destinations;
- loading/failure status;
- fallback;
- return path.

Do not mirror every spatial landmark into a noisy virtual tree unless it serves an action.

### 12.4 Focus ownership

On source surface:

- source owns focus.

During cross-owner navigation:

- do not park focus in a disappearing world control after destination ready.

On semantic destination:

- current semantic route focus rules own entry.

On visit-local world subspace:

- shift focus to the subspace heading or equivalent semantic anchor;
- restore it to the invoking/return control when leaving if the owner remains mounted.

### 12.5 Reduced motion

Reduced motion may simplify:

- camera travel;
- gate opening;
- zoom/push transitions;
- spatial crossfades.

It must preserve:

- destination availability;
- transition completion;
- semantic focus;
- failure/fallback.

### 12.6 Forced colors

Critical navigation cannot rely on environment color, emissive material, or glow alone.

### 12.7 Audio unavailable/muted

No gate depends on an audio cue for its state.

---

## 13. Loading, failure, recovery, and cancellation

### 13.1 World cold start

A cold-start treatment may communicate that the world is loading.

It must not delay a ready semantic fallback.

### 13.2 World asset failure

Expected fallback order should be chosen per slice, but conceptually:

```text
retryable rich world
-> stable simpler presentation
-> semantic destination
```

Do not endlessly retry behind the user.

### 13.3 WebGL failure

Current E2 behavior is a strong precedent:

- preserve Classic;
- preserve Today.

Future Living City entry should preserve semantic destinations similarly.

### 13.4 Lazy chunk failure

If an optional spatial subspace fails, preserve its parent owner and semantic exits.

Do not force a global reload if visit-local recovery can safely contain the failure.

### 13.5 Semantic destination loading

Once navigation has crossed into a semantic route, its own data loading contract owns truth.

A world transition must not display “Today ready” merely because the route bundle mounted.

### 13.6 Semantic destination failure

A semantic data error does not imply world failure.

The user may return to a valid world source if return context is still meaningful, but that return must not disguise or erase uncertain product state.

### 13.7 Session expiry

If the destination requires an authenticated account and the session is invalid:

- show the destination owner’s existing session recovery;
- do not silently downgrade account-owned state to browser-owned state.

### 13.8 Uncertain write before departure

Source mutation truth wins.

Current My Space demonstrates the correct pattern:

- keep draft/preview visible;
- block misleading departure;
- explain confirm/cancel/verify;
- then release.

### 13.9 Route cancellation

If a user backs out before cross-owner navigation commits, cancel source transition presentation.

Do not leave:

- pointer capture;
- input lock;
- ambient “gate active” state;
- stale timeout that later navigates.

### 13.10 Repeated activation

Only one navigation request should win.

Repeated clicks/taps/Enter during handoff should coalesce or become inert rather than produce multiple history entries.

---

## 14. Conflicts and anti-patterns

### 14.1 Treating E1 Lab as current production entry

Wrong.

E1 is valuable current code/evidence, but current authority still treats Living City entry activation as preview/reversible and separately authorized.

### 14.2 Treating E2 My Space as the whole Living City shell

Wrong.

E2 is current product evidence for spatial ownership, fallback, return, persistence separation, and subspaces.

It should not silently become the generic owner of Today/Records/AI/Settings world navigation.

### 14.3 One giant app-wide navigation context

Avoid creating a global store that duplicates URL/history and world state merely to unify transitions.

### 14.4 Arbitrary `return_url`

Do not use an arbitrary URL string for world return.

Use a closed, bounded context.

### 14.5 Saving exact camera coordinates as “return continuity”

This creates stale geometry, privacy/persistence questions, migration burden, and renderer coupling.

### 14.6 World reading product data to choose whether a gate exists

A Today landmark does not need today’s BP.

An AI landmark does not need model output.

A Records landmark does not need record counts unless a separate bridge contract explicitly authorizes a bounded fact.

### 14.7 Navigation on proximity alone

Approaching a landmark may stage it.

It should not unexpectedly change the page.

### 14.8 Browser Back polluted by every world movement

Do not turn camera moves, plaza walking, Garden entry, or decorative exploration into automatic history entries without a user benefit.

### 14.9 Hiding semantic navigation while the world loads

Spatial presentation is additive.

### 14.10 Minimum cinematic transition timers

Do not delay real destination readiness or failure to make a transition feel expensive.

### 14.11 Silent persistence-mode switching

Account My Space failure must not silently become browser My Space.

Current source already rejects that behavior.

### 14.12 Semantic route imported into renderer as business state

A renderer may receive a destination identifier.

It should not import semantic application stores or protected feature modules to implement navigation.

---

## 15. Explicit non-goals

This proposal does not design or authorize:

- E1 production release;
- an E1/E2 merge;
- world-scale streaming architecture;
- a new router;
- multiplayer;
- portals between users;
- saved camera position;
- persistent “last visited gate”;
- a navigation analytics system;
- location telemetry;
- new DB tables;
- new localStorage/sessionStorage keys;
- Auth changes;
- API changes;
- RLS changes;
- Model V2 changes;
- semantic route renaming;
- new Records/AI/Settings world gates;
- audio/haptic assets;
- final transition motion timings;
- release rollback or database recovery.

---

## 16. Candidate future implementation slices

These are **candidates only**. None is authorized by #899 or this document.

They are ordered from smallest coherent product slice toward broader extensions.

### 16.1 Candidate 02-A — Existing Today <-> My Space transition coherence

**Goal**

Improve the already-existing Today <-> My Space handoff so it communicates one journey while preserving every current URL, storage, Auth, and persistence contract.

Possible bounded scope:

- refine source/destination labels;
- make “returning to My Space” vs “entering My Space” semantically clear;
- verify focus and scroll behavior at both ends;
- retain `return_space` as the only bounded return context;
- preserve full-page navigation and browser Back/Forward;
- add no new persistence.

**Why first**

The underlying product path already exists and has browser evidence.

This slice can validate the grammar without activating E1 or adding another semantic destination.

**Acceptance/evidence ideas**

- desktop keyboard and mobile touch;
- browser Back/Forward;
- direct Today URL does not invent a return link;
- account/browser modes remain distinct;
- 3D/Classic return remains exact;
- no extra cosmetic reads/writes from transition polish;
- 320/390 and 200% text;
- focus reaches meaningful destination owner;
- pending/uncertain My Space write still blocks departure truthfully.

### 16.2 Candidate 02-B — E1 Today Gate product bridge slice

**Goal**

Under a separately authorized Experience Slice, bring the already-proven navigation-only E1 Today intent into a qualified product-facing preview.

Possible bounded scope:

- one Today Gate;
- one explicit Today activation;
- one Open Classic Today path;
- no other semantic destinations;
- no product-data reads by world;
- no new persistence.

**Dependencies**

- live Living City contract revalidation;
- E1 product-entry authority;
- asset/runtime qualification;
- direct fallback;
- Proposal 10 evidence selection.

**Acceptance/evidence ideas**

- direct semantic Today remains usable without world;
- gate proximity does not navigate;
- activation produces one history entry;
- source input cancels before destination owns focus;
- world failure still reaches Today;
- deep-link `?screen=S02` bypasses world;
- no protected product module import into world;
- no new persistence/storage keys.

### 16.3 Candidate 02-C — Return-to-Living-City from Today

**Goal**

After a real product Living City source exists, allow Today to offer a bounded return to that source.

Possible scope:

- only users who arrived through the admitted Living City bridge;
- no arbitrary URL;
- no exact camera coordinate restoration;
- one stable return place/role;
- no persistence.

**Acceptance/evidence ideas**

- direct Today links show no false “return”;
- Back remains correct;
- return remains safe after resize;
- expired session behavior remains semantic-owner truth;
- reload behavior is explicitly defined and tested rather than inferred.

### 16.4 Candidate 02-D — Records semantic destination

**Goal**

Add one additional registered world destination for current Records (`S08`) only after Today bridge semantics are proven.

**Boundary**

The world gets destination identity, not:

- record count;
- dates;
- BP values;
- challenge history.

**Acceptance/evidence ideas**

- direct S08 deep link remains valid;
- world failure still reaches S08;
- Records focus/history behaves like direct semantic navigation;
- no record data crosses bridge.

### 16.5 Candidate 02-E — AI Analysis semantic destination

**Goal**

Add a world-discoverable route to S11 without changing Model V2 meaning.

**Hard prerequisites**

- live #396/Model V2 revalidation;
- explicit confirmation that destination wording does not imply diagnosis/risk classification;
- no numeric result or analysis state exposed to world.

**Acceptance/evidence ideas**

- S11 direct route behavior unchanged;
- model input/result remain transient;
- world gets no model output;
- preview-window expiry works independently of world.

### 16.6 Candidate 02-F — Settings semantic destination

**Goal**

Make Settings spatially discoverable without turning the world into an account/privacy controller.

**Acceptance/evidence ideas**

- navigation-only;
- no Auth/session internals in world;
- account deletion remains semantic UI only;
- browser personalization and world cosmetics remain correctly distinguished.

### 16.7 Candidate 02-G — Multi-destination Living City journey

Only after multiple single-destination slices prove consistent behavior should a broader city journey coordinate several semantic landmarks.

This candidate must not be used to skip the single-destination evidence sequence.

---

## 17. Dependencies, prerequisites, risks, and unresolved questions

### 17.1 Dependencies on other Foundry proposals

**Proposal 01 — Companion Interaction & Emotion Grammar**
Needed where companion behavior coexists with transition gates. Navigation cannot steal actor input ownership.

**Proposal 03 — Personal Place Growth & Ownership**
Needed before return context can imply persistent personal-place continuity.

**Proposal 04 — Living City Visual & World Content System**
Needed before multiple semantic landmarks become a visual system.

**Proposal 05 — Motion, Sound & Haptic Feedback Grammar**
Owns sensory transition feedback, not destination semantics.

**Proposal 08 — Identity, Privacy & Data-Lifecycle Trust Grammar**
Owns language for account/browser/transient boundaries.

**Proposal 09 — Resilience & Recovery Experience Grammar**
Owns cross-product error/retry vocabulary.

**Proposal 10 — Adaptive Experience & Quality Evidence Grammar**
Owns evidence proportionality and real-runtime adaptive checks.

### 17.2 Open question — what is the long-term default entry?

Current program direction is 3D-first.

Current product reality also has:

- Classic semantic entry;
- browser-local My Space starting-home preference;
- E1 isolated preview.

A future implementation Issue must re-check which entry is actually authorized then.

This proposal does not choose a deployment default.

### 17.3 Open question — should Living City itself have a stable direct URL?

The current product has E2 routes and semantic screen routes.

E1 currently lives in Lab.

A future public Living City URL could improve deep-link and history clarity, but creating it is an implementation/product-routing decision and may affect rollout/reversibility.

### 17.4 Open question — reload semantics for return-to-world

For current My Space, URL state makes reload behavior clear.

A future temporary return-to-Living-City context must decide whether reload:

- preserves it;
- intentionally discards it;
- reconstructs only a bounded place role.

Do not let accidental SPA memory decide.

### 17.5 Open question — scroll restoration

Current App explicitly scrolls to top for semantic navigation.

Browser Back/Forward has current browser/runtime behavior.

A future bridge should define scroll restoration only where evidence shows a usability problem; do not introduce a global scroll manager preemptively.

### 17.6 Open question — transition presentation across full-page roots

Today <-> E2 currently crosses separate roots.

A transition can still feel coherent through:

- matched vocabulary;
- matched destination identity;
- visual continuity;
- immediate loading feedback.

A shared DOM root is not automatically required.

### 17.7 Risk — destination proliferation

Once one world gate works, it will be tempting to create gates for every feature.

Require each gate to justify:

- spatial discoverability value;
- semantic fallback;
- bridge authority;
- accessibility;
- loading/failure behavior.

### 17.8 Risk — “return” becomes hidden session state

Return must remain inspectable and bounded.

### 17.9 Risk — world becomes dashboard-in-3D

Semantic landmarks should create spatial meaning, not reproduce every navigation tab as floating panels.

### 17.10 Risk — world gate implies health status

A landmark must not become brighter, locked, sad, damaged, or rewarding because of health measurements, model output, missed goals, or inferred outcomes.

---

## 18. Live revalidation checklist before any implementation Issue

Before using this proposal to open an implementation Issue, verify all of the following against live `origin/main`.

### Repository and authority

- [ ] Read current root `AGENTS.md`.
- [ ] Confirm live `origin/main` SHA.
- [ ] Confirm the implementation Issue is distinct from #899.
- [ ] Check current `docs/transcend/PROGRAM.md`.
- [ ] Check current `docs/architecture/SK7_LIVING_CITY_3D_FIRST_PRODUCT_CONTRACT.md`.
- [ ] Confirm no newer Living City ADR supersedes the relevant boundary.
- [ ] Confirm #396 / current Model V2 authority if S11 is in scope.

### Semantic application

- [ ] Re-read current `web/src/App.tsx` navigation/history behavior.
- [ ] Re-read current primary semantic destination mapping.
- [ ] Verify direct URL behavior for the destination in scope.
- [ ] Verify current focus-on-entry behavior.
- [ ] Verify current loading/error/session behavior for that destination.

### Living City / world

- [ ] Determine whether the target world entry is current product source, preview source, or historical evidence.
- [ ] Do not treat `transcend-lab` as production authority without a current Issue that explicitly scopes productization.
- [ ] Re-read current world-shell input/lifecycle ownership.
- [ ] Verify current fallback path when renderer/asset initialization fails.
- [ ] Verify no protected product-state import has entered the world boundary.

### My Space / placeable if involved

- [ ] Re-read `ProductPlaceableEntry`.
- [ ] Re-read `PlaceableExperience`.
- [ ] Re-read `mySpaceReturn`.
- [ ] Re-read `isPlaceableRoute`.
- [ ] Verify account/browser storage semantics have not changed.
- [ ] Verify pending/unknown/conflict save behavior before navigation.
- [ ] Verify WebGL -> Classic -> Today recovery still exists if relevant.

### Return and deep-link semantics

- [ ] Confirm whether the user arrived by direct URL, browser history, default home, or bridge.
- [ ] Define exactly when a return control is shown.
- [ ] Reject arbitrary return URLs.
- [ ] Do not carry world coordinates or protected state.
- [ ] Define reload behavior.
- [ ] Verify Back/Forward behavior in a real browser.

### Accessibility/adaptive evidence

- [ ] Keyboard path.
- [ ] Touch path.
- [ ] 390 width.
- [ ] 320 width where the slice claims support.
- [ ] short viewport if spatial geometry matters.
- [ ] actual 200% text/zoom behavior if navigation presentation changes.
- [ ] screen-reader semantics for destination/fallback.
- [ ] forced-colors visibility for critical controls.
- [ ] reduced-motion transition equivalent.
- [ ] world/audio unavailable equivalent.
- [ ] destination focus ownership after handoff.

### Failure and cancellation

- [ ] repeated activation cannot produce duplicate navigation;
- [ ] route change cancels source input capture/timers;
- [ ] source pending/uncertain write cannot be cosmetically hidden by navigation;
- [ ] world failure does not mutate product state;
- [ ] semantic destination failure remains semantic-owner truth;
- [ ] session expiry does not silently change account/browser persistence mode.

### Final implementation authority check

- [ ] The selected slice is one bounded user-visible experience.
- [ ] Protected changes, if any, are explicitly scoped by the new Issue.
- [ ] No deployment is implied by merge.
- [ ] No later candidate slice is treated as pre-authorized.

---

## Closing design position

The future SK7 journey should not be unified by forcing every surface into one renderer or one router.

It should be unified by **consistent ownership and transition meaning**.

The durable pattern is:

```text
personal place / world
    -> explicit semantic destination identity
    -> bounded bridge
    -> existing semantic capability

existing semantic capability
    -> bounded source context when valid
    -> explicit return
    -> fresh world ownership
```

The world provides place, discovery, movement, presence and delight.

The semantic application provides health/product truth, stable URLs, forms, records, analysis disclosure, settings, and accessibility-critical task structure.

The bridge makes them feel like one product while preventing either side from quietly taking authority from the other.
