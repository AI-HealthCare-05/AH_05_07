# SK7 visual production contract

## Purpose and status

This contract governs the visual direction, state coverage, evidence, and asset handling for the SK7 signature experience. Issue #190 implements its CSS-first Calm Clay Journey foundation and S01–S14 semantic screen structure. Final visual QA, approved Canva asset selection, R2 publication, and production-parity evidence remain later gates and are not implied by that implementation.

The product promise is:

> A calm seven-day observation ritual that presents measured blood pressure and one chosen daily action as separate facts, without scoring either or implying that one caused the other.

The first signature slice is the signed-in seven-day page: today's context, the blood-pressure measurement ritual, the active-challenge lane, and a fact-only recap.

## Concern-specific authority

No single artifact is authoritative for every concern.

| Concern | Authority |
|---|---|
| Product, safety, privacy, and claim boundaries | `AGENTS.md`, `docs/requirements.md`, and the domain contracts |
| Data and API semantics | Schema, migrations, API contracts, and automated tests |
| Screen states and experience invariants | This contract and `docs/ux-flow.md` |
| Visual specification | Approved, versioned prototype record; Figma when available, or a documented immutable interactive artifact when explicitly approved |
| Editable illustration and media sources | User-owned Canva or original source files |
| Shipped behavior and accessibility | `web/src` plus browser evidence |
| Asset rights and provenance | `docs/asset-register.md`, created when public assets are introduced |
| Binary delivery | R2 after approval only |

Safety, privacy, ownership, retention, and non-causal boundaries override every visual artifact. If documentation, an approved frame, and the implementation differ, the difference is drift: record it in the active Issue or pull request and resolve it explicitly. Do not silently treat one artifact as universally correct.

## Experience invariants

The experience keeps three fact types distinct:

1. A blood-pressure observation is a user-entered measurement with a date and morning or evening context.
2. A challenge selection or check-in records a chosen action and participation state.
3. A future **입력 기반 위험군 선별 신호** is a versioned model result and remains unavailable until its release gate passes.

The following rules apply in every state and viewport:

- `completed` and `skipped` describe check-in participation only.
- Observation and challenge lanes may share a date grid, but must not be joined by arrows, deltas, color coding, captions, or ordering that suggests correlation or causation.
- A recap reports recorded facts. It does not produce a combined score, treatment outcome, improvement claim, normal/abnormal badge, or health recommendation.
- An unreleased risk signal appears only as an honest unavailable state when that state is in scope. It must not be presented as an active product capability.
- Measurement guidance supports more consistent recording. It is not proof that the guidance was followed and does not classify a reading.
- Entry-page titles and calls to action describe only released capabilities. The risk-signal term appears in product UI only after release or inside an explicitly unavailable state.

## Visual language

The default qualities are **calm, precise, humane, Korean-first, and legible before decorative**.

Future visual work must:

- provide one clear primary action for the current state;
- use progressive disclosure for supporting guidance;
- give dates, measurement context, values, and today's action an intentional hierarchy;
- separate fact types through headings, structure, and wording rather than color alone;
- preserve useful density without crowding on desktop and mobile;
- use Korean labels that remain natural when announced by assistive technology; and
- keep destructive and secondary actions visually subordinate without hiding them.

Avoid generic SaaS dashboards, a separate card for every sentence, excessive pills, gradients, glass effects, decorative shadows, alarm-like clinical styling, and gamified streak or reward language. Decorative media must not compete with the daily action.

### Calm Clay Journey implementation profile

Issue #190 maps the approved handoff tokens into `web/src/styles.css` and keeps
the screen registry and Korean copy map in `web/src/ui/journey.ts`. The shell
uses warm cream, sage, lavender, restrained water and coral accents, soft clay
geometry, and CSS-only landscape shapes. Core flows remain usable when images
are blocked; no new binary asset, UI framework, router, or animation dependency
is introduced.

Screen transitions use a 260–360 ms shared-axis entrance. The signed-out gate
uses one 520 ms gate-open transition, confirmed persistence alone may show the
save ripple, the locked-state marker settles once, and the seven-day recap pans
once. `prefers-reduced-motion` replaces those movements with a 160 ms fade and
stops loading loops. Shake, alarm flash, confetti, scoring bursts, and anxious
character reactions are prohibited.

The implementation intentionally leaves illustration slots and CSS scene
layers replaceable. Visual QA precedes final Canva asset selection; approved
derivatives may reach R2 only through the asset register and a separate scoped
change.

## Responsive QA execution

Issue #192 makes the viewport and reduced-motion assertions executable in
`web/e2e/visual-qa.spec.ts` and records the manual, synthetic-only capture
procedure in `docs/visual-qa-runbook.md`. Passing this gate confirms layout and
state truthfulness only; it neither approves Canva derivatives nor authorizes
R2 publication.

### Canva source-selection gate

Issue #194 records the selected Canva source sets and an explicit
`approved` / `replaceable` / `not used` decision in
[`asset-register.md`](asset-register.md). This is a source-selection gate, not
a delivery gate: `approved` means the editable source may enter a later
derivative review, not that its current export may be shipped.

Whole-screen and utility-state Canva PNGs remain `not used` at runtime because
they bake example UI copy and state into an image. Live Korean copy, labels,
field values, status announcements, and controls stay in semantic HTML. A
background or character is decorative and optional; the current CSS scene is
the required fallback whenever an image is unavailable, omitted, or unsuitable
for the viewport. Desktop and mobile source sets are exported and measured
separately—never force-crop or upscale one to impersonate the other.

A separate Issue is required before export or R2 delivery. It must add the
exact derivative metadata and SHA-256, review stripped metadata and rights,
confirm the target viewport and focal point, test blocked-image fallback and
reduced motion, attach sanitized visual evidence, and apply the registered
versioned cache policy. The unavailable **입력 기반 위험군 선별 신호** remains
textual and has no score, model-output, or decorative data visualization.

## Information order

Desktop may place measurement and challenge work in two distinguishable lanes. It must not force equal-height panels when their content lengths differ.

Mobile uses this reading and focus order:

1. Today's context
2. Measurement action
3. Challenge action
4. Seven-day recap and history

Loading, empty, stale, and failed states occupy the same semantic position as the content they replace. They must not reorder the page or masquerade as real empty data.

## Canonical state and fixture matrix

Visual evidence uses the versioned synthetic fixture manifest `VPF-1` with:

- `as_of`: `2026-09-03T09:00:00+09:00`;
- locale: `ko-KR`;
- timezone: `Asia/Seoul`;
- a displayed blood-pressure mask of `•••/•• mmHg` in shared evidence;
- synthetic identifiers and dates only; and
- no real name, email, access token, or health record.

The fixed traits below are part of each fixture. An implementation may use valid synthetic values privately, but shared images and logs use the mask above so layout remains reproducible without disclosing health values.

| Fixture | Fixed synthetic traits and invariant |
|---|---|
| `VP-01a bootstrap` | Configuration and session are unresolved; no record request has started. Do not flash a signed-out screen or claim that records are empty. |
| `VP-01b configuration-unavailable` | Public configuration is absent. Offer a safe recovery action without naming or displaying configuration fields, keys, or values. |
| `VP-02a signed-out` | No session is present. The email field and one magic-link action are ready. |
| `VP-02b link-pending` | The synthetic magic-link request is pending. Prevent duplicate submission and announce progress. |
| `VP-02c link-sent` | The synthetic request succeeded. Confirm the next step without showing the email address. |
| `VP-02d session-expired` | An established session expired. Clear protected content and offer one sign-in recovery action without claiming an uncertain write succeeded. |
| `VP-03 window-loading` | The authenticated `2026-08-28` through `2026-09-03` request is pending with no prior data. Reserve the page hierarchy and do not render false empty or challenge content. |
| `VP-04 empty` | The same window is confirmed to contain no observations, active challenge, check-ins, or legacy rows. Present the next measurement and challenge actions without blame or urgency. |
| `VP-05a invalid-range` | The observation draft has one out-of-range numeric field. Preserve the in-memory draft, identify the field, and move focus to it. |
| `VP-05b invalid-relationship` | The observation draft has systolic less than or equal to diastolic. Preserve both in-memory fields, explain the relationship, and move focus to systolic. |
| `VP-06 active-unlocked` | One masked morning observation exists on `2026-09-03`; `walk-10-minutes` runs `2026-09-03` through `2026-09-09` with no check-in. Keep the facts separate and make action change available. |
| `VP-07a locked-unrecorded` | `walk-10-minutes` runs `2026-09-01` through `2026-09-07`; the first check-in was `completed` on `2026-09-01`, `2026-09-02` is `skipped`, and today is unrecorded. The action is locked. |
| `VP-07b locked-completed` | Same challenge and prior history as `VP-07a`; today, `2026-09-03`, is `completed`. Participation wording must not imply a health outcome. |
| `VP-07c locked-skipped` | Same challenge and prior history as `VP-07a`; today, `2026-09-03`, is `skipped`. Participation wording must not imply failure or a health outcome. |
| `VP-08a observation-edit` | The masked `2026-09-03` morning observation is in edit mode. The affected date is named, save and cancel are distinct, and focus returns predictably. |
| `VP-08b observation-delete` | The same observation is awaiting explicit deletion confirmation. The destructive action is subordinate, specific, and reversible only by cancellation. |
| `VP-08c checkin-edit` | The `2026-09-02` check-in is in status-only edit mode; date, action, challenge link, and owner remain immutable. |
| `VP-08d checkin-delete` | The same check-in is awaiting explicit deletion confirmation and is identified by date and action. |
| `VP-09 challenge-ended` | `walk-10-minutes` ran `2026-08-27` through `2026-09-02`. Mark it ended and present an explicit next action without treating expiry as success or failure. |
| `VP-10 recap` | Window `2026-08-28` through `2026-09-03`: masked observations on `2026-08-28` morning, `2026-09-02` evening, and `2026-09-03` morning; one `walk-10-minutes` active challenge running `2026-08-28` through `2026-09-03` whose first check-in is `completed` on `2026-08-28`; same-challenge check-ins on `2026-08-29` skipped and `2026-09-01` completed; one legacy sleep record on `2026-08-28`. Preserve separate lanes and label the legacy record. |
| `VP-11a load-failure` | The initial window request returns normalized `503` and no data. Say loading failed, do not show a real empty state, and offer a safe retry. |
| `VP-11b stale-refresh-pending` | `VP-10` is already displayed and its refresh is pending. Keep prior data visible, identify refresh progress without blocking record review, and do not imply it is current. |
| `VP-11c stale-refresh-failure` | The pending refresh from `VP-11b` returns normalized `503`. Keep prior data visible, identify that refresh failed, and offer a safe retry rather than clearing it. |
| `VP-12a saved-refresh-pending` | The server confirmed a mutation while the follow-up window read is pending. Announce the confirmed save separately and retain the prior view until fresh data arrives. |
| `VP-12b conflict` | A mutation returns normalized `409`. Nothing is called saved; identify the conflict and offer a fresh read or intentional correction. |
| `VP-12c unknown-outcome` | Transport fails after mutation dispatch. Do not blindly retry or call it saved; require a fresh read before another write. |
| `VP-13a export-pending` | Export for `2026-08-28` through `2026-09-03` is pending. Keep the current records and prevent duplicate requests. |
| `VP-13b export-success` | The same export is confirmed and a sanitized filename is available. Do not expose an internal object key or identifier. |
| `VP-13c export-failure` | The same export fails. Keep current records, state that no file was confirmed, and offer an intentional retry. |

The implementation vocabulary must distinguish at least:

- `loading`
- `refreshing_with_stale_data`
- `load_error_without_data`
- `refresh_error_with_stale_data`
- `saved_but_refresh_pending`
- `conflict`
- `unknown_outcome`

Do not blindly retry an uncertain mutation. By default, preserve an unsaved draft only in memory on the current page through a recoverable failure. Persistence across reload, browser storage, or authentication recovery requires a separate privacy and retention decision; this contract does not authorize it. Time-dependent production states must recompute at the `Asia/Seoul` date boundary without requiring a reload.

## Responsive and visual evidence

| Check | Condition |
|---|---|
| Desktop baseline | `1366 × 768`, device pixel ratio 1, 100% zoom |
| Mobile baseline | `390 × 844`, device pixel ratio 1, 100% zoom |
| Boundary reflow | `320 CSS px` viewport width at 100% zoom |
| Zoom | Desktop baseline at 200% zoom, with no clipped or lost content or action |
| Language and time | `ko-KR`, `Asia/Seoul`, canonical `as_of` fixture |

All baseline and boundary captures use device pixel ratio 1. All use 100% browser zoom except the separate zoom check.

G3 implementation creates desktop and mobile golden screenshots for `VP-04 empty`, `VP-07a locked-unrecorded`, `VP-10 recap`, and `VP-11a load-failure`. Other canonical states require functional evidence and a screenshot only when the visual change affects them. G2 review may use an exact-dimension interactive artifact when its immutable source revision, viewport checks, tooling substitution, and owner approval are recorded; this does not waive G3 captures.

At 320 CSS pixels, the page must have no horizontal page scrolling, clipped controls, lost actions, or reordered facts. A shared evidence image must use synthetic fixtures, mask health values and identifiers, and exclude browser storage, request headers, tokens, and private console output.

A canonical capture is the visible viewport, not a full-page composite. Use the stable Chromium version in the implementation environment, record its exact version in the pull request, wait for `document.fonts.ready`, and fail the capture if the approved font is unavailable. Attach sanitized PNG files to the implementing pull request with the name `vpf-1-<fixture>-<desktop|mobile>-<short-sha>.png`. An optional full-page diagnostic adds `-full` before the extension and is never the golden reference. The pull request evidence table is the durable index for each attachment, approved prototype artifact, capture configuration, and approval result.

Each visual pull request records:

- the contract section and canonical fixture exercised;
- the approved prototype artifact, immutable revision, and Figma frame when one exists;
- viewport, zoom, locale, timezone, commit, and timestamp;
- sanitized before/after captures when implementation changes;
- keyboard, focus, contrast, reflow, build, type-check, and console/network results; and
- any asset-register change.

## Accessibility baseline

The signature flow targets WCAG 2.2 AA. Its G3 implementation evidence covers:

- semantic headings, landmarks, lists, forms, and buttons;
- programmatic labels and a visible unit such as `mmHg` for blood-pressure fields;
- reviewed Korean validation text linked with `aria-describedby` and invalid fields marked programmatically;
- focus moved to the first invalid field and restored after confirmation or cancellation;
- a visible `:focus-visible` treatment and a complete keyboard path;
- suitable status, progress, and error announcements rather than one live-region treatment for every message;
- meaning that does not depend on color alone;
- text contrast of at least `4.5:1` and meaningful non-text contrast of at least `3:1`;
- preferred touch targets of at least `44 × 44 CSS px` for primary and repeated record actions;
- mobile form text of at least `16px`;
- unique accessible names that identify the affected date or action;
- reduced-motion support and no autoplay; and
- Korean line-break, reading-order, 200% zoom, and 320px reflow review.

Internal error codes, backend or CORS details, and raw Supabase or unreviewed English error messages never appear in user-facing copy. Broader browser and assistive-technology automation is implementation evidence when feasible, not a prerequisite for this documentation gate.

## Source and tool policy

Use sources in this order:

1. Repository contracts and the current production flow for behavior and boundaries
2. A user-approved reference set recorded at G1 for tone and visual direction
3. An authoritative primary source recorded with the affected copy, URL, version, access date, and review date for health or accessibility wording

Moodboards influence tone only. They do not override product requirements or authorize copying a layout or asset.

`docs/blood-pressure-measurement-guide.md` is the current health-wording source record. Accessibility decisions use the official [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/) and [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/). `docs/visual-direction.md` is the durable record of approved references, adopted and rejected qualities, provisional tokens, and approved prototype links.

| Tool or location | Role |
|---|---|
| Figma | Preferred authoring surface for responsive frames, components, states, and visual tokens when available |
| Private interactive prototype | Approved review substitute only when the Issue records the tooling constraint, immutable source revision, exact viewport evidence, and owner approval |
| Canva | Editable source for user-owned illustration or presentation media, not application behavior |
| Repository | Product contracts, semantic tokens, implementation, tests, evidence references, and asset register |
| Browser | Acceptance of the shipped implementation against the approved state and viewport |
| R2 | Delivery of approved public binaries only, never the editable source or sole archive |

Native React, HTML, and CSS remain the default for the signature slice. A UI library requires a separate Issue with a measured need. Stock search and generated imagery are off by default until their purpose and provenance are approved.

## Asset provenance

The first pull request that introduces a public asset creates the canonical register at `docs/asset-register.md`. Create its asset-register entry before any R2 upload. It must contain:

- asset ID and immutable versioned object key;
- title, purpose, and target screen;
- owner, creator, and creation tool;
- source URL when applicable;
- license, consent, or ownership basis;
- creation and review dates;
- SHA-256, MIME type, dimensions, and byte size;
- alternative text or a decorative designation;
- public/private classification;
- retention or deletion decision; and
- the asset version it supersedes, when applicable.

Do not publish real health records, names, email addresses or other contact details, JWTs, clinical source documents, embedded location or EXIF metadata, or unreviewed external assets. Audio and video require captions or transcripts and user controls before release.

## Approval gates

| Gate | Required result |
|---|---|
| G0 — Contract | This documentation is merged with no runtime, dependency, Figma, R2, database, or deployment change. |
| G1 — Direction | One user-approved reference set, three desired qualities, three rejected qualities, one anti-reference when available, and provisional visual tokens are recorded. |
| G2 — Prototype | Measurement ritual, active-challenge lane, and fact-only recap are approved at desktop and mobile sizes, including empty and recoverable-error states. |
| G3 — Implementation | Deterministic fixtures, sanitized comparison captures, accessibility checks, build and type-check results, and clean console/network evidence are attached. |
| G4 — Release | The existing deployment smoke verifier passes and a sanitized manual signature-flow check confirms production parity. |

Approval at one gate does not imply approval at the next. A later change to an invariant, canonical state, viewport, asset right, or approved visual direction requires an explicit Issue or a documented amendment in the implementing pull request.

## User decision point

Do not request a complete mockup before G1. At G1, request only:

- two or three reference images, or one small Canva or Figma moodboard;
- three desired qualities;
- three rejected qualities; and
- one explicit anti-reference when available.

Record which qualities are adopted and why. The reference set does not need to depict a health application.

## G3 implementation sequence

After G2 approval, open a dedicated G3 Issue and short branch, then:

1. Create deterministic `VPF-1` fixtures without real user or health data.
2. Resolve page-shell, authentication bootstrap, loading, confirmed-empty, stale-data, and recovery hierarchy.
3. Implement the blood-pressure measurement ritual.
4. Build the compact active-challenge lane.
5. Replace raw recent lists with a fact-only seven-day recap.
6. Create and register measured responsive media derivatives before any public asset delivery.
7. Validate desktop, mobile, `320 CSS px`, 200% zoom, keyboard, focus, contrast, Korean copy, build, type-check, console, network, and production parity with sanitized captures.

## Phase boundary

Issue #190 authorizes the bounded React and CSS foundation described above. It
does not authorize Canva writes, final binary selection, R2 configuration or
uploads, new dependencies, API, database, migration, RLS, authentication,
retention, deployment, model implementation, or real user data. Visual QA,
asset approval, public delivery, and production-parity evidence remain separate
gates with their own Issue, short branch, pull request, and evidence.
