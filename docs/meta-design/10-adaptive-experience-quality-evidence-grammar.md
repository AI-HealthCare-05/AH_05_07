> **DESIGN PROPOSAL — NOT IMPLEMENTATION AUTHORITY**

Status: **design proposal only** for GitHub Issue #899. This document is an implementation-independent product-design asset. It does not authorize production behavior, product implementation beyond this docs-only task, deployment, provider changes, protected data/model changes, new persistence, new dependencies, or a later Experience Slice.

Repository baseline investigated for this draft:

- canonical repository: `AI-HealthCare-05/AH_05_07`
- live `main`: `6d3207d673b8001d8809628c0830d5a2f5affe39`
- Issue #899: open at the time of investigation
- Issue #396: open and remains the current Model V2 research-preview authorization
- current date for this draft: 2026-09-30 KST

Any future implementation must begin from then-current `origin/main`, open a new bounded GitHub Issue, and revalidate this proposal against current source, tests, contracts, runtime behavior and any current release authority.

If this proposal conflicts with current `AGENTS.md`, the current GitHub Issue/PR, [`PROGRAM.md`](../transcend/PROGRAM.md), the [Living City architecture contract](../architecture/SK7_LIVING_CITY_3D_FIRST_PRODUCT_CONTRACT.md), Model V2 contracts, privacy/data-lifecycle authorities, or another current protected contract, **the current authority wins**.

This document is not a project-management ledger, implementation roadmap registry, current-state registry, or handoff/checkpoint file. GitHub Issue/PR/Git remain live work authority.


# 10. Adaptive Experience & Quality Evidence Grammar

## 1. Status, baseline, and authority boundary

This proposal defines how a future Experience Slice chooses evidence strong enough for the **specific claims it makes**.

It is not a standing QA phase, universal release gate, permanent matrix, or replacement for current path-aware CI.

## 2. Current-repository reality and evidence

### 2.1 The repository already contains strong but heterogeneous evidence

Current source/tests include examples of:

- 1366 desktop and 390/320 mobile checks;
- short-viewport suppression/recomposition;
- actual enlarged-text/200% review in prior product work;
- 44×44 target expectations;
- S02 drag/relocation geometry;
- keyboard alternatives;
- forced-colors behavior;
- reduced-motion behavior;
- WebGL/asset failure;
- resource teardown;
- first-paint readiness;
- browser history/focus behavior;
- device-specific historical observations.

No single one of those proves every future interaction.

### 2.2 “Responsive” means more than width

Current product already adapts by:

- reflowing semantic layout;
- reducing decorative density;
- using different scene profiles/posters;
- suppressing heavy presentation on short/narrow cases;
- capping Living City render density;
- keeping semantic alternatives.

A future slice should test the kind of adaptation it actually uses.

### 2.3 Source inspection cannot prove geometry in a browser

CSS values and math can suggest safety but do not prove:

- a target is unobscured;
- a drag can reach the intended destination;
- virtual keyboard does not cover actions;
- fixed navigation clearance;
- scroll restoration;
- actual focus ring visibility.

### 2.4 Screenshot cannot prove interaction

A screenshot can prove composition at one moment. It cannot by itself prove:

- keyboard path;
- drag travel;
- focus restoration;
- motion cancellation;
- audio unavailability;
- screen-reader announcement;
- slow asset handling;
- history/back behavior.

### 2.5 Automated assertions cannot prove visual hierarchy alone

Bounding boxes can prove target size and overflow. They do not prove the page has one clear next action or that effects compete for attention.

## 3. User promise / North Star

> “If SK7 says an experience works on my device/input mode, the important action is actually reachable, understandable and recoverable — not merely present in the DOM.”

## 4. Problem statement

A UI can technically exist and still be unusable because:

- an element is off-screen;
- a target is too small;
- a drag path crosses fixed navigation;
- text at 200% hides an action;
- a canvas captures scroll;
- a focus target disappears on remount;
- a reduced-motion mode removes the only cue;
- an asset times out and leaves an empty hole.

The evidence grammar must connect **claim → risk → observation**.

## 5. Principles

### 5.1 Evidence follows the claim

Do not run every test for every change. Do not skip the one test that actually proves the changed behavior.

### 5.2 Measure geometry, review hierarchy

Numbers prove dimensions and clearance. Human/visual review proves composition and attention.

### 5.3 Exercise the real interaction

Pointer drag requires drag. Keyboard path requires keyboard. Audio requires actual output-state behavior.

### 5.4 Adaptive does not mean shrink

Prefer reflow, density reduction, alternate composition and semantic fallback over tiny controls.

### 5.5 Accessibility is behavior

A semantic label in source is necessary but not sufficient if focus/order/announcement fails at runtime.

### 5.6 Failures need evidence too

Slow or failed optional media should leave the core action usable.

## 6. Protected boundaries

- No permanent all-suites release gate.
- No telemetry/real-user monitoring requirement.
- No new device lab requirement by default.
- No screenshot of real health/identity data.
- No weakening current CI/guard.
- No “passed source review” claim for browser-only behavior.
- No “screenshot looks good” claim for interaction.
- No fixed breakpoints promoted to architecture unless current source actually owns them.

## 7. Evidence ownership / architecture seams

| Claim type | Best evidence owner |
| --- | --- |
| Semantic/data correctness | unit/integration/domain tests |
| URL/history | browser interaction |
| Layout/reflow | browser geometry + visual review |
| Touch target | measured CSS bounding box + touch run |
| Drag reachability | real pointer/touch trajectory + geometry |
| Focus order/restore | browser keyboard run |
| Screen reader meaning | semantic inspection + actual AT when decision-relevant |
| Forced colors | browser forced-colors run |
| Reduced motion | runtime media-query path |
| Audio unavailable | real API/state failure path |
| Asset delay/failure | network throttling/interception + runtime |
| Visual hierarchy | human visual review at representative states |
| Resource cleanup | runtime counters/profiling/tests |

### 7.1 Evidence inheritance is scoped

Previous evidence may be reused only when the relevant contract and code path are unchanged.

Examples:

- an unchanged semantic button can reuse prior keyboard semantics;
- a newly overlaid FX around that button still needs visual/forced-colors review;
- a new drag target cannot inherit an older target's travel evidence merely because both use Pointer Events;
- a new world camera composition cannot inherit S10's mobile framing.

This avoids both needless retesting and false confidence.

## 8. Claim-to-evidence grammar

### 8.1 Geometry claim

If the claim is “the control remains reachable at 320px”:

- measure document overflow;
- measure control rectangle;
- inspect fixed nav overlap;
- actually activate it.

### 8.2 Drag claim

If the claim is “the actor/object can be dragged across the intended region”:

- establish legal start/end envelope;
- exercise shortest and longest travel;
- include edge/corner travel;
- verify pointer capture/cancel;
- verify surrounding document scroll behavior;
- verify non-drag alternative.

### 8.3 Motion claim

If the claim is “feedback is subtle and cancellable”:

- video/frame trace or runtime event evidence;
- rapid repeated input;
- route/visibility cancellation;
- reduced-motion path.

A screenshot is insufficient.

### 8.4 Accessibility claim

If the claim is “screen-reader usable”:

- source semantics;
- reading/focus order;
- actual screen-reader exercise when the changed interaction depends on announcements or non-visual discovery.

Do not equate `aria-label` presence with acceptance.

### 8.5 Failure claim

If the claim is “asset failure is graceful”:

- actually fail/slow the asset;
- verify fallback;
- verify core action;
- verify cleanup/no stale retry.

### 8.6 Spacing claim

Generous spacing is a hierarchy tool, not a universal pixel quota.

Evidence should confirm:

- related labels/actions remain visually grouped;
- unrelated major groups have separation;
- 320/short/enlarged views do not turn spacing into excessive scroll before the primary action;
- important actions remain visible/reachable.

### 8.7 FX-led instruction claim

If a slice claims users can learn primarily through effects:

- test the static/no-motion equivalent;
- test a first unaided attempt;
- ensure the highlighted object is actually actionable;
- ensure multiple effects do not create competing next actions;
- verify effects stop after the intended moment.

The number of effects is not evidence of comprehension.

## 9. Desktop, tablet, mobile, short viewport and 200%

### Desktop
Use the actual target composition, commonly around 1366-wide current evidence, but follow the slice's current contract.

### Tablet
A 768-class viewport is useful when desktop columns begin to collapse or world/input geometry changes.

### Mobile 390
Primary current mobile reference.

### Mobile 320
Boundary reflow. No horizontal page scrolling, clipped control or lost action.

### Short viewport
Width alone is insufficient. Existing product evidence includes 320×640-class behavior where heavy spatial presentation may need suppression/recomposition.

### Actual 200%
Record exactly what is being tested:

- browser zoom 200%;
- OS/text scaling;
- text-only enlargement;

because they are not interchangeable.

The intended claim is that important content/actions survive real enlargement, not that one test harness flag exists.

### 9.1 Representative viewport ladder

Use a ladder rather than one “mobile”:

```text
large desktop
→ desktop/laptop
→ tablet/narrow desktop
→ 390 phone
→ 320 phone
→ short 320-class viewport
```

A slice need not test every rung if its composition clearly does not cross them, but it should identify where its layout mode changes.

### 9.2 World-specific adaptation

For 3D/spatial surfaces, additionally inspect:

- actor/landmark projected envelope;
- camera obstruction;
- walkable/drag-safe geometry;
- semantic overlay clearance;
- render density / resource tier;
- fallback availability.

A canvas fitting the viewport does not prove the world is usable.

## 10. Accessibility and non-primary-input equivalents

### Keyboard
Complete the entire changed journey with visible focus.

### Touch
Use actual touch semantics when gesture behavior differs from pointer.

### Non-drag alternative
Any essential drag/relocation has an equivalent discrete/keyboard-accessible action.

### Screen reader
Ensure canvas/decorative layers do not duplicate semantic controls.

### Forced colors
Selected/focus/error states remain distinguishable without gradients/glow.

### Reduced motion
Essential result remains; animation is removed or replaced, not merely slowed.

### Motion/audio unavailable
No core action depends on those modalities.

## 11. Loading, slow delivery, failure and recovery evidence

Test three distinct optional-media conditions when relevant:

1. **normal load**;
2. **slow load**;
3. **failed load**.

Check:

- semantic action available before/without media where required;
- no minimum decorative wait;
- no layout collapse causing target movement under pointer;
- timeout state;
- explicit retry only where allowed;
- teardown after failure/exit.

For product data loading, distinguish initial loading from stale refresh.

### 11.1 Virtual keyboard and browser chrome

When an interaction uses form inputs or bottom actions on mobile, evidence should consider:

- visual viewport resize;
- fixed/sticky navigation;
- software keyboard;
- Safari/Chrome browser chrome;
- scroll-into-view behavior.

Do not infer this from CSS viewport height alone.

### 11.2 Resource cleanup evidence

When a slice mounts WebGL, audio contexts, timers, observers or animation loops, acceptance should include teardown relevant to the changed owner.

This does not mean a universal memory benchmark. It means proving the changed lifecycle does not leave an obvious stale writer/resource after exit.

## 12. Conflicts and anti-patterns

| Anti-pattern | Why insufficient |
| --- | --- |
| CSS media query exists | doesn't prove real reflow |
| screenshot at 390 | doesn't prove touch/focus |
| Playwright click | may bypass realistic touch geometry if misused |
| DOM node present | may be covered/off-screen |
| `aria-live` exists | doesn't prove coherent announcements |
| reduced-motion CSS exists | may not cover JS/WebGL motion |
| one desktop video | doesn't prove 320/short viewport |
| Lighthouse score | not a substitute for journey-specific accessibility |
| run every suite always | costly and hides risk-based intent |
| no tests because “docs/design only” after implementation | design claim still needs later implementation evidence |

## 13. Explicit non-goals

No permanent device farm, universal screenshot matrix, new release committee, telemetry, visual-regression platform, accessibility certification claim, mandatory physical-device run for every PR, or replacement of path-aware CI.

## 14. Candidate future implementation slices

### 10-A — Claim/evidence mini-plan in a bounded Experience Slice
Before implementation, list 3–6 changed claims and the smallest evidence that proves each.

### 10-B — Real viewport/zoom geometry probe
For a layout-sensitive slice, measure 1366/768/390/320/short and actual 200% mode relevant to the claim.

### 10-C — Drag-travel acceptance
For one drag interaction, prove full travel envelope, cancellation and non-drag alternative.

### 10-D — Focus/scroll restoration acceptance
For one modal/editor/subspace transition, prove focus origin, destination and return plus fixed-nav clearance.

### 10-E — Sensory unavailable acceptance
For one FX/audio slice, exercise reduced motion, mute/unavailable and interruption.

### 10-F — Slow/failing asset delivery acceptance
Throttle/fail the exact optional asset and verify semantic fallback, timeout and cleanup.

## 15. Dependencies and prerequisites

Every prior proposal supplies domain-specific claims. Proposal 10 does not own their semantics.

Use current repository tooling and tests where they already prove the claim. Add focused evidence only when needed.

## 16. Acceptance / evidence ideas

### Evidence table template

| Claim | Risk | Evidence |
| --- | --- | --- |
| Primary action reachable at 320 | fixed nav/overflow | measured box + real activation |
| Drag reaches lower-right safe area | geometry/pointer capture | actual drag trace + final projection |
| Reduced motion preserves result | JS/WebGL motion leak | media-query runtime exercise |
| Error action announced | focus/status duplication | keyboard + AT-focused check |
| Optional GLB failure is graceful | blank scene/stale resources | network fail + semantic exit + teardown |
| 200% keeps delete confirmation usable | clipped dialog | actual zoom/text enlargement + activation |

### Visual review questions

- What is the first thing the eye sees?
- Is there one obvious next action?
- Are related items close and unrelated groups separated?
- Is whitespace helping hierarchy or merely increasing scroll?
- Do FX point to the next action or compete?
- Does the failure state preserve the same hierarchy?

### 16.1 Evidence sufficiency decision tree

```text
Does the claim concern pure value transformation?
  → unit/integration may be enough

Does it concern DOM semantics only?
  → source + focused browser may be enough

Does it concern geometry, focus, scroll, pointer travel or timing?
  → real browser interaction required

Does it concern visual hierarchy?
  → visual review required

Does it concern audio/haptic/AT hardware behavior?
  → actual modality/device evidence when decision-relevant
```

### 16.2 What a screenshot can establish

A screenshot can establish:

- composition;
- spacing;
- visible hierarchy;
- clipping/overflow at that exact state;
- static forced-colors/reduced-motion rendering if captured in those modes.

It cannot establish:

- whether a button worked;
- whether focus arrived/returned correctly;
- whether drag was reachable;
- whether motion cancelled;
- whether audio played/stopped;
- whether a screen reader announced the intended state.

## 17. Risks / unresolved questions

- Which interactions justify physical-device testing rather than browser emulation?
- When does screen-reader behavior require a fresh AT run versus reused stable semantics?
- How should performance budgets be expressed without turning unmeasured guesses into gates?
- What is the smallest reliable way to capture drag trajectories?
- How do we verify virtual-keyboard geometry consistently across mobile browsers?
- Which world-density claims require GPU/frame evidence rather than visual review?
- How can visual review remain rigorous without becoming a permanent approval registry?

### 17.1 Cross-document ownership note

Proposal 10 owns evidence selection only. It cannot create a product requirement that another proposal does not define. Conversely, a proposal's design claim does not become accepted merely because source compiles; choose evidence that exercises that claim. This keeps accessibility and adaptive evidence cross-cutting without creating a second release authority.

## 18. Live revalidation checklist before any implementation Issue

1. Resolve current live main and exact target slice.
2. Write down the changed user-facing claims.
3. For each claim, identify failure mode and smallest proof.
4. Record actual target device/input classes; do not inherit old matrices blindly.
5. Inspect source/tests for existing reusable evidence.
6. Decide whether source inspection is sufficient; if geometry/timing/focus is involved, usually run the browser.
7. Decide whether screenshot is sufficient; if interaction/dynamic state is involved, it is not.
8. Include 390/320/short/200% only when relevant to the claim, but do not omit a boundary the changed layout obviously crosses.
9. Measure targets/overflow/clearance rather than infer from CSS token names.
10. Exercise keyboard and touch/pointer paths appropriate to the interaction.
11. Exercise reduced motion, forced colors and sensory unavailable when the slice changes those modalities.
12. Fail/slow optional assets when fallback is claimed.
13. Verify focus and scroll restoration when overlays/editors/routes change.
14. Run current required guard/CI before publishing; do not create a parallel release gate.
