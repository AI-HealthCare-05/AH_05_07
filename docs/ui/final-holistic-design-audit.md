# SK7 Final Holistic UI Audit

## Audit metadata

- Starting `main` SHA: `c13309af837636da053dec7cbbb9d5395c1073ab`
- Audit branch: `ux/final-holistic-design-audit`
- Scope: S01–S14, visual/readability polish only
- Evidence fixture: `VP-10` for populated states, `VP-04` for empty, `VP-11a` for load failure
- Viewports: 1366×768, 768×1024, 390×844, 320×568
- Additional check: 200% browser-zoom layout proxy at 683×384 CSS pixels, representing a 1366×768 physical frame; root font size unchanged and native browser zoom not instrumented
- Rendered screenshots: 70 (kept in a local temp directory; not committed)
- Machine-readable inventory: [final-holistic-design-backlog.json](./final-holistic-design-backlog.json)

This is a handoff audit for one final holistic redesign. It is not an automatic design score and does not propose a new model, new companion species, or a production contract change.

## Executive summary

### 현재 강점

- The product has a coherent warm, calm visual language and a clear shared shell.
- Blood-pressure observation, challenge participation, legacy records, and the model-ready state remain visually distinguishable.
- Primary actions are generally discoverable, touch targets remain usable, and the audited renders had no horizontal overflow.
- Empty and failure states are truthful, compact, and action-oriented.
- S05 keeps the companion scoped to save success; the bear-lite render stayed inside the scene and did not cover the main CTA in the audited states.

### 가장 큰 디자인 문제 5개

1. The fixed mobile bottom navigation visually covers live content in S02, S04, S08, and S10. The content has bottom padding, but the nav still intersects the first viewport's meaningful content rather than behaving like a reserved layout region.
2. At the corrected 200% browser-zoom layout proxy, the five-item navigation stays horizontal; the long 입력 기반 위험군 선별 신호 label wraps to three horizontal lines. It remains contained, but header height and scanability still degrade.
3. S10 is structurally overloaded: three summary shapes, a challenge panel, three record lanes, multiple detail CTAs, and a refresh action create a long, repetitive page. It is the only screen graded C.
4. The same rounded bordered surface is used for the scene, summary ribbon, feature cards, lanes, progress card, and settings items. This flattens hierarchy and makes the UI feel assembled from panels rather than composed as a journey.
5. Auto-focus on the H1 creates a strong rectangular focus outline in every captured scene. The focus treatment is accessible in intent but visually reads like a selected input and competes with the page title.

### 최종 redesign에서 반드시 유지할 요소

- Separate facts: measured blood pressure, challenge adherence, legacy records, and model-output readiness must stay separate.
- The meaning separation introduced for recent seven-day history versus challenge progression.
- Truthful empty, loading, and load-failure states; no invented records or model result.
- Read-only messaging for legacy and prior-window records.
- Primary / secondary / destructive action distinction and the existing safe delete flow.
- S11's current model semantics and claim boundary. The redesign may change visual placement and density only; the model team must decide meaning and copy.
- S05 companion contract: bear-lite, save-success context, no health/model/adherence input to animation choice.

### 반드시 버릴/줄일 패턴

- Treating every section as a rounded, bordered card.
- Decorative circles, horizon layers, and gradients that compete with the task on dense screens.
- Repeating the same separation explanation in the scene body, toolbar, card caption, and progress panel.
- Long instruction copy before the first usable control.
- Five navigation labels being forced into one pill at the corrected 200% browser-zoom layout proxy, where the long signal label wraps to three lines.

### 절대 변경하면 안 되는 기능 계약

- No model, research, API, database, deployment, or runtime behavior changes in this audit or the final visual redesign PR.
- No use of blood-pressure values, risk signals, model output, adherence, or outcome claims to choose companion behavior.
- No new species or production companion activation proposal.
- No interpretation of measured values beyond the recorded fact; no clinical conclusion or outcome claim.

## Global findings

### Information hierarchy

The scene title is consistently prominent and the main task is usually understandable within three seconds. S02 and S03 are the clearest examples: the user can immediately choose observation or challenge, or choose one challenge action. The hierarchy weakens when secondary explanations and multiple panels appear together, especially in S08 and S10.

### Density and surface language

The shared scene frame is strong, but it is also the first of many surfaces. S02 adds a status ribbon, three feature cards, and a recent-history panel. S10 adds navigation, three summary shapes, a challenge-progress card, and three record lanes. S14 turns four small help/settings topics into equally weighted cards even though only one contains an action. A final pass should establish a small number of surface tiers: page frame, task group, and supporting detail.

### Color

Cream, sage, lavender, water, and coral provide useful grouping. The palette is not the primary problem. The audit concern is role discipline: pastel changes are sometimes decorative while nearby status colors are semantic. Final review should check small muted labels and pastel-on-pastel text for contrast, and ensure state meaning never depends on hue alone.

### Navigation

Desktop navigation is legible and the active state is clear. In the corrected 200% browser-zoom layout proxy, the five-item primary nav remains horizontal, but the long signal label wraps to three lines and increases the header's visual density. On mobile it becomes a fixed bottom nav that intersects visible content. The final design should preserve current destinations while changing the spatial contract: navigation needs a reserved safe area, an explicit compact mode, and a less fragile active-state treatment.

### Component language

Buttons are reasonably differentiated, including destructive red and secondary outlined actions. The larger issue is the repeated card/pill/border vocabulary. Rounded rectangles are used for navigation, cards, summaries, record lanes, dialogs, notices, and settings. This produces consistency but not enough hierarchy. Use fewer containers and let spacing, dividers, and type do more work.

### Typography and Korean UX copy

The display type is expressive and readable at normal sizes. Long Korean copy increases vertical cost quickly because `word-break: keep-all` preserves phrase shape rather than breaking aggressively. S10 and S14 show the cost most clearly. The current tone is gentle, but “차분히”, “살펴봐요”, “이어가요”, and explanatory restatements recur enough to make some screens feel authored rather than direct.

### Forms and destructive actions

S04 has a sensible label/input relationship and an expandable measurement guide. At 320px the fixed nav occupies the same vertical band as the form's meaningful controls, and the save CTA is below the first viewport. The final pass should prioritize field rhythm, CTA reachability, and a clear error slot without changing validation or data behavior. S09's edit/delete distinction is understandable; keep delete visually heavier only at the point of confirmation.

## Screen-by-screen

### S01 — A

- Strong points: Focused login gate, one clear email task, high contrast CTA, restrained supporting note.
- Problems: “차분히 시작해요” is warm but generic; the decorative landscape occupies more visual area than the task needs on desktop.
- Final-pass recommendation: Keep the single-task composition. Tighten the copy and reduce background decoration before adjusting the card itself.

### S02 — B

- Strong points: Three entry actions are explicit; the “최근 7일 기록” separation is visible and the current day is easy to spot.
- Problems: Three equal feature cards compete with the recent-history panel. The body and recent-history caption explain related separation rules. On mobile the fixed nav covers the second feature card; in the corrected 200% browser-zoom layout proxy, the signal nav label wraps to three horizontal lines rather than becoming vertical text.
- Final-pass recommendation: Establish one dominant next action, demote the other two to a lighter navigation treatment, and give the recent-history block a shorter supporting role.

### S03 — B

- Strong points: Action labels are concrete, selected state is clear, and the locked-after-check-in warning is visible without changing the behavior contract.
- Problems: Three large equal tiles, three repeated “start with this” labels, the scene body, and the lock notice create a lot of instructional weight before the user can act.
- Final-pass recommendation: Keep the choice grid but reduce repeated instruction and make the selected/locked state more compact.

### S04 — B

- Strong points: The form is task-focused, labels are explicit, the measurement guide is collapsible, and the primary save action is visually clear.
- Problems: Intro copy plus guide plus four fields is tall on mobile. At 320px, the fixed bottom nav overlays the form region and pushes the save CTA below the first viewport.
- Final-pass recommendation: Shorten pre-form copy, keep the guide optional, optimize field grouping for narrow widths, and reserve navigation space without changing validation.

### S05 — A

- Strong points: The confirmation state is immediately recognizable, the two next actions are clear, and bear-lite remains within the scene. The success icon and copy provide meaning independently of the companion.
- Problems: The bear, ripple, title focus ring, and two CTAs all compete for the center/right attention zone. On mobile the bear is close to the top edge and reads almost as a second headline.
- Final-pass recommendation: Keep the approved bear-lite/save-success contract, but reserve a predictable companion zone and ensure the saved confirmation remains the strongest visual signal.

### S06 — B

- Strong points: Locked challenge status, selected action, date range, and today status are separated clearly.
- Problems: The locked panel and marker row repeat “separate from recent seven-day records”; the primary blood-pressure action sits late in the screen at narrow widths.
- Final-pass recommendation: Compress the explanatory sentence and make the next available action visible sooner.

### S07 — B

- Strong points: The “facts side by side” concept is clear and three lanes map to the product's fact separation.
- Problems: Three equal bordered lanes repeat the same layout grammar and leave little room for a visual priority between “today's next action” and read-only history.
- Final-pass recommendation: Keep parallel facts, but use a stronger lead lane and lighter supporting rows instead of three identical cards.

### S08 — B

- Strong points: Date-window controls, record types, and detail entry points are understandable. The lane grouping is honest and consistent.
- Problems: Toolbar copy, window explanation, three lanes, and repeated “상세 보기” controls make the page long and list-like. Mobile navigation sits across the first record area in the captured viewport.
- Final-pass recommendation: Make the window selector a compact utility row, then use a single grouped list with clear type markers rather than three equally heavy cards.

### S09 — A

- Strong points: One selected record, a compact fact list, and explicit edit/delete actions give the detail screen a clear job.
- Problems: The surrounding scene and record-detail card are both strong containers; the hierarchy can be flatter. Read-only explanation can become a large warning block for legacy/prior records.
- Final-pass recommendation: Keep the detail facts and action safety. Reduce container nesting and make read-only state a compact inline status.

### S10 — C

- Strong points: The recent-seven-day versus challenge distinction is explicit, and counts are easy to find on desktop.
- Problems: It has the highest desktop scroll height (1539px), reaches 2232px at 390px and 2281px at 320px, and remains the tallest screen in the corrected 200% browser-zoom layout proxy at 2063px. The corrected proxy is materially shorter than the prior injected-font result, but summary shapes, challenge progress, three record lanes, multiple detail buttons, and refresh still compete. The same separation message is repeated in several places.
- Final-pass recommendation: Redesign the information architecture in the final holistic pass. Keep the three fact types and the challenge distinction, but make one compact summary lead into a progressively disclosed record list.

### S11 — B (visual only)

- Strong points: The orbit and status card create a recognizable prepared/not-ready state; the disclaimer is visually separated.
- Problems: The large orbit, status pill, card, disclaimer, and title create four visual anchors for a screen whose visual job is simple. The title is long at mobile widths.
- Final-pass recommendation: Reduce visual competition and copy density only. Do not propose changes to model meaning, claim, readiness logic, or result content; mark those decisions “model team 결과 후 결정”.

### S12 — A

- Strong points: Honest empty state, two clear starting choices, and a calm visual illustration. No invented facts.
- Problems: Decorative illustration is large relative to two actions; the heading focus ring is prominent.
- Final-pass recommendation: Keep the empty-state pattern as the reference for other state screens, with a quieter focus treatment.

### S13 — A

- Strong points: Error state explains that missing data is not implied and provides one direct retry action.
- Problems: The mist illustration and large empty space create a slower path to the retry control than necessary.
- Final-pass recommendation: Keep the truthful message and retry behavior, but bring the action closer to the message and reuse the final state hierarchy.

### S14 — B

- Strong points: Four topics are easy to scan and the export destination is discoverable.
- Problems: All four topics are presented as equal cards despite different importance and actionability. Help copy is longer than necessary; the corrected 200% browser-zoom layout proxy still produces a tall 1003px page.
- Final-pass recommendation: Use a lighter settings list with one action row and one compact help note, rather than four equal panels.

## Responsive findings

1. Fixed bottom navigation intersects useful content in S02, S04, S08, and S10 at both 320px and 390px. Treat the nav height as layout space, not only bottom padding.
2. In the corrected 200% browser-zoom layout proxy, the five nav labels remain horizontal and the signal label wraps to three lines; they do not become vertical columns. S02/S04/S10 still show increased header density and loss of scanability. Add a compact accessible navigation mode with stable label geometry.
3. S10 is too long for small screens: the page is 2232px tall at 390px, 2281px at 320px, and 2063px in the corrected proxy. The proxy is shorter than the prior injected-font result, but the repeated structure still does not reveal a cleaner priority.
4. Above-the-fold CTA visibility degrades at 320px: S02 is partial, while S04 and S06 place the primary action below the first viewport. Preserve the task's next action within the reachable first view where practical.
5. S08 and S14 remain usable without horizontal overflow but become tall because every group keeps its own card, border, padding, and explanatory text. Vertical reduction should come from hierarchy, not smaller type.

## Accessibility visual findings

- Positive: audited renders had no horizontal overflow; controls preserve a generous target size in the existing visual baseline; state screens use copy and icon/shape cues in addition to color.
- Focus: focus rings are visible, but the automatically focused H1 receives the same strong outline as an interactive control. Keep programmatic focus for orientation, while giving non-interactive headings a quieter treatment.
- Contrast: primary ink and focus colors read well. Final redesign QA must specifically recheck muted text on pastel surfaces, small captions, inactive nav text, and the status-pill treatment.
- Zoom: The corrected 200% browser-zoom layout proxy preserves content without native zoom instrumentation, but exposes navigation wrapping and excessive vertical density. It should be a release gate for the final redesign, not a post-hoc check.
- Motion: reduced-motion should keep the same hierarchy and a natural static state. The save ripple and S10 recap motion must not become the strongest signal when motion is enabled, and must not leave an awkward empty stage when reduced.
- Forms and modal: field errors, edit/delete, and the confirmation dialog need a final visual pass at 320px and the corrected 200% browser-zoom layout proxy; this audit's primary screen capture did not open a destructive modal.

## Companion findings

- Audited production-facing behavior remains scoped: the only rendered companion was the approved bear-lite save-success case on S05; no new species or production activation is proposed.
- Desktop S05 has enough separation between the bear, saved title, success marker, and CTAs. Mobile keeps the bear inside the scene, but its top-right placement competes with the confirmation region more than desktop does.
- Keep an explicit reserved companion slot. Do not let the character determine the scene's height, push the CTA below the fold, or become the only cue for success.
- Reduced-motion should settle the companion into a calm static pose while the save confirmation remains fully understandable from text and the success mark.
- Companion choice must remain independent of measured blood pressure, risk signal, model output, challenge adherence, and outcome claims.

## Copy findings

Top five copy issues for the final pass:

1. Soften less by default: “오늘의 기록을 차분히 시작해요” and “하루의 사실을 차분하게” establish tone, but the action can be shorter and more direct.
2. Remove repeated separation explanations around S02, S06, S08, and S10. State the distinction once at the point where the user needs it.
3. Reduce stacked instruction in S03: scene body, tile state, and lock notice all explain when the choice can change.
4. Shorten S08 utility copy. “날짜와 기록 종류를 확인한 뒤 상세를 열어 주세요” describes the interface instead of helping the user make a decision.
5. Preserve operational warnings but tighten S14 help text and S10 challenge-progress copy; these are useful facts, but their current sentence length adds to the page's card weight.

S11 is excluded from semantic/copy redesign recommendations. Its model meaning and claim remain “model team 결과 후 결정”; this audit covers placement and density only.

## Final redesign priorities

### P0

- Rework mobile navigation as a reserved, zoom-safe layout region. Validate 320px, 390px, keyboard focus, and the corrected 200% browser-zoom layout proxy with no content collision.
- Redesign S10's hierarchy and progressive disclosure while preserving the separate fact lanes and challenge distinction.
- Define a responsive navigation mode that keeps five labels legible and stable in the corrected 200% browser-zoom layout proxy.

### P1

- Establish three surface tiers and reduce card/border/rounded-rectangle repetition across S02, S03, S07, S08, S10, and S14.
- Perform one Korean copy compression pass, starting with S02/S03/S08/S10/S14.
- Tune programmatic H1 focus styling so orientation remains accessible without a permanent form-like rectangle around every title.
- Reflow S04 and S06 so the first useful action remains reachable on narrow screens.
- Reserve and visually subordinate the S05 companion slot while retaining bear-lite/save-success behavior.

### P2

- Consolidate color roles and verify muted/pastel contrast at component level.
- Harmonize empty, warning, success, and error compositions after the shared hierarchy is settled.
- Reduce decorative horizon/circle treatment where it competes with task content.
- Recheck settings and record-detail screens for lighter, less card-heavy composition.

## Proposed final redesign scope

One visual redesign PR should include:

1. Shared shell/navigation geometry, including mobile safe-area behavior and the corrected 200% browser-zoom layout proxy.
2. Shared scene title/focus treatment, surface tiers, spacing tokens, and state composition.
3. S02, S03, S04, S06, S07, S08, S09, S10, and S14 hierarchy/density updates.
4. S05 companion slot and success hierarchy refinement without changing the production contract.
5. One copy pass limited to directness, duplication, and screen-level orientation; no S11 model semantic changes.
6. A follow-up visual QA matrix covering S01–S14, 320/390/768/1366 widths, the corrected 200% browser-zoom layout proxy, reduced motion, focus order, touch target reachability, and no horizontal overflow.

The redesign PR should explicitly report: runtime UI behavior changes only where the approved visual contract requires them, model/research changes = 0, API/DB/deploy changes = 0, and S11 model semantics changes = 0.
