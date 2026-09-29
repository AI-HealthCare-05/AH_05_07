> **DESIGN PROPOSAL — NOT IMPLEMENTATION AUTHORITY**

# 03. Personal Place Growth & Ownership

## 1. Status, baseline, and authority boundary

**Status:** repository-grounded design draft for #899; not a product contract, implementation allocation, release decision, or claim of deployed behavior.

**Canonical repository:** `AI-HealthCare-05/AH_05_07`. **Source baseline:** `6d3207d673b8001d8809628c0830d5a2f5affe39`, resolved from live `main` on 2026-09-29 KST. #899 remained OPEN and the open-PR collection was empty when this investigation began. The earlier local Proposal 01/02 drafts are design inputs, not merged authority.

This proposal authorizes no production behavior, implementation beyond the docs-only task, deployment, provider change, paid call, protected data/model change, new persistence, asset activation, dependency, or new Experience Slice Issue. It does not change #396. A later implementation must start from then-live `origin/main`, a new bounded GitHub Issue, and revalidation of the assumptions below.

Current `AGENTS.md`, live task authority, `docs/transcend/PROGRAM.md`, the Living City architecture contract, current Model V2/data/privacy/scene contracts, and other protected authorities prevail over this proposal. This document does not construct a replacement ranked authority system. Source establishes what exists; it does not automatically authorize changes to a protected contract.

### 1.1 Design brief admitted in this draft

The owner requests generous space between visual groups, less explanatory page prose, and much stronger experiential guidance. The proposed response is **broad feedback coverage, spacious composition, and deliberate sensory emphasis**. Every meaningful action should have a legible response. That does not require every visible object to animate simultaneously.

The public Disney and Disney+ pages were read for their separation of primary presentation, content discovery, and secondary information. No rendered Disney screenshot, pixel-spacing measurement, interaction recording, or conversion study was obtained. All dimensions, FX sequencing, and proposed SK7 composition here are our design hypotheses, not extracted Disney specifications or evidence that effects persuade users. No Disney characters, artwork, branded shapes, copy, or trade dress are reused. External reference boundaries are in §2.9.

### 1.2 Decision summary

Design the place as **a familiar arrangement the user can intentionally change**, not a dashboard measuring how well they live. Lead with the space, expose a compact editing surface on request, preview without writing, and acknowledge only a confirmed operation. Keep health participation and cosmetic choice separate. Broader collection and durable milestones remain future candidates with unresolved storage and privacy decisions.

## 2. Current-repository reality and evidence

The following is source/test inspection at the pinned baseline. Existing test assertions were read; they were not executed in this turn. No production database, authenticated product session, live renderer, or deployment was exercised.

### 2.1 Evidence anchors

Paths are relative to this proposed location under `docs/meta-design/`. The baseline above is part of every current-state claim; re-read the files at a future task's exact SHA.

| Ref | Read source or contract | What it establishes for this proposal |
| --- | --- | --- |
| R01 | [Repository contract](../../AGENTS.md) | Workflow and protected boundaries; docs-only work does not deploy |
| R02 | [Transcend program](../transcend/PROGRAM.md) and [Living City contract](../architecture/SK7_LIVING_CITY_3D_FIRST_PRODUCT_CONTRACT.md) | Stable shell, explicit bridges, semantic fallback, voluntary/additive growth; example growth events are not active APIs |
| R03 | [Data contract, My Space section](../data-contract.md#my-space-cosmetic-snapshot-e4) | One snapshot, two slots, versioning, atomic receipt, lifecycle |
| R04 | [Scene policy](../scene-policy-contract.md) | Narrow E3/E4 exceptions; still medallion; no health-driven world effects |
| R05 | [Placeable value contract](../../web/src/placeable/contract.ts) | Exact enums, v1/v2 shapes, three sockets, strict receipt comparison |
| R06 | [Controller](../../web/src/placeable/controller.ts) | Draft/confirmation/UNKNOWN/conflict/retry and operation ownership |
| R07 | [Persistence adapters](../../web/src/placeable/persistence.ts) | Browser locks and storage key; account generation fencing; no mode fallback |
| R08 | [Product entry](../../web/src/placeable/ProductPlaceableEntry.tsx) | Verified account binding outside renderer and explicit browser-only exit |
| R09 | [Placeable experience](../../web/src/placeable/PlaceableExperience.tsx) | Current editor, still keepsake presentation, explicit save, Garden visit, exits |
| R10 | [Living Choice](../../web/src/ui/livingChoice.ts) and [keepsake media](../../web/src/placeable/keepsakeMedia.ts) | Three disposable hints and their exact cosmetic mappings; original still representations |
| R11 | [Placeable migration](../../supabase/migrations/20260927050000_my_first_placeable.sql) and [keepsake migration](../../supabase/migrations/20260927082233_my_first_keepsake.sql) | Account lifetime, owner-only reads, serialized saves, cascade deletion; v2 without backfill |
| R12 | [Controller/adapter contract tests](../../web/e2e/placeable.contract.spec.ts) | No preview writes; receipts; lost responses; conflicts; immutable retries; unknown-version preservation |
| R13 | [Experience contract tests](../../web/e2e/placeable-experience.contract.spec.ts) | Truthful first render, Classic projection, binding, audio boundary, return enums |
| R14 | [Keepsake SQL tests](../../supabase/tests/placeable_keepsake_test.sql) | v1/v2 parity, input rejection, atomic idempotency, deletion/no-recreation assertions |
| R15 | [Browser personalization reset](../../web/src/ui/browserPersonalization.ts) | Four-key read preflight, sequential removals, verification; not transactional rollback |
| R16 | [Account deletion confirmation](../../web/src/components/AccountDeletionConfirmation.tsx) | Two-step destructive confirmation and distinct account/browser/device scope |
| R17 | [Current UX flow](../ux-flow.md) | Two homes, browser starting-home preference, bounded returns and export scope |

### 2.2 My Space exists; a collection system does not follow from that

The current value contract has one pinwheel identity, three colors, and three authored sockets. v1 stores a pinwheel selection or null. v2 stores exactly `{ pinwheel, keepsake }`, with both keys required. There is one keepsake slot with three allowed IDs, not a bag of all previously chosen items. There is no collection count, earned-item balance, acquisition history, room list, freeform scene graph, progression level, or entitlement in this snapshot. These are scoped statements about R03/R05/R11, not an assertion that every file in the repository was exhaustively searched.

A saved selection is not proof of asset ownership in the commercial or legal sense. Here **account-owned** means data is associated with the verified account owner. It does not mean a purchased asset, transferable possession, permanent service entitlement, or backup guarantee.

The pinwheel sockets preserve space around spawn, paths and gate approach; cosmetics do not add movement colliders. Arbitrary drag-to-any-world-coordinate placement would be a new interaction and layout contract, not an existing capability concealed by the UI. R05/R12.

### 2.3 Existing growth bridge is narrower than the long-term direction

E3 permits a disposable `living_choice` URL hint in the existing E2 plaza. Only `walk-10-minutes`, `sleep-routine`, and `low-sodium-meal` are accepted; duplicate or unrecognized hints produce no marker. A forged but known hint remains only a cosmetic hint. It proves neither participation nor completion, identity, storage permission, or ownership. R04/R10/R13.

E4 maps those hints to `plaza-ribbon-v1`, `quiet-moon-v1`, and `garden-leaf-v1`. A user explicitly previews and confirms keeping the offered motif. That writes a cosmetic identity, not the originating action or its completion. A saved keepsake takes precedence over the transient marker. Removing a keepsake preview suppresses the temporary marker rather than visually substituting it for the thing being removed. R03/R09/R10.

The mapping itself remains inferable. Not storing the source action is useful minimization, but it does not make a recognizable moon/ribbon/leaf association anonymous or prove a health fact. Do not market this as impossible-to-infer behavior, and do not log or analyze the association as a medical or adherence signal. This is a privacy inference from the explicit mapping, not a new diagnosis or a finding of a current data leak.

### 2.4 Current authoring already separates preview from truth

`PlaceableController` owns the state machine used by both presentations. `draft === undefined` means no pinwheel edit; `draft === null` means a removal preview. Keepsake editing has the same distinction. Collapsing undefined and null would erase the difference between no change and an explicit removal. R06.

Preview, cancellation, and pinwheel play are not persistence operations. `confirm()` freezes one operation with a UUID, expected revision, version, layout and full selection. Confirmation compares the matching revision, operation ID, fingerprint, schema/layout, and complete selection. A matching-looking object on screen is not a receipt. R05–R07/R12.

On response loss the controller performs a bounded reconciliation read. A read of the old revision cannot prove that the write failed: UNKNOWN retains the same immutable operation. Explicit retry uses that operation, not a freshly generated one. Conflict review preserves the user's edited slot intents and rebases them onto the latest confirmed other slot. This is not an automatic last-writer-wins overwriting strategy. R06/R12.

**Important FX seam:** `saved` also becomes true when a positive-revision snapshot is loaded, and can become true after cancellation. It is not a “new save just completed” event. A future receipt animation cannot subscribe to `saved === true` and replay on every visit. It must identify a just-verified local pending operation, within the current live owner, or remain static. R06.

### 2.5 Five different continuities, not one universal save

| Surface | Current continuity | What the UI must not imply |
| --- | --- | --- |
| Account cosmetic snapshot | Verified account; existing row/RPC; separate account lifetime | Thirty-day cosmetic expiry, local backup, instantaneous live multi-device sync, transfer to another account |
| Browser cosmetic snapshot | `sk7:placeable:v1`; same origin/browser storage context; Web Locks for safe compare/write | Account association, private-per-person storage on a shared browser, automatic account merge |
| Theme, starting home, companion preference | Separate browser-local presentation preferences | Included in the account cosmetic snapshot |
| Visit state / draft | Current experience/controller lifetime; Garden is visit-local | Saved Garden location, restored camera pose, durable unsent-operation outbox |
| Downloaded JSON, PDF, print | Device/user-managed copies of supported record surfaces | My Space export, cosmetic import, whole-account backup, automatic deletion with account |

R07–R09/R15–R17. The guest medical sandbox is not a synonym for browser-only My Space: its medical example/input state remains a separately governed in-memory journey. Merely being signed in does not turn browser-mode cosmetics into account data.

### 2.6 Versioning and deletion constrain future growth

An ordinary v1 read or pinwheel edit does not migrate the snapshot. Explicit keepsake confirmation introduces v2 while preserving the pinwheel and incrementing the same revision. v2 does not downgrade when both slots are null. Unknown versions, layouts or asset selections survive reads without being overwritten by an older client. R03/R05/R11/R12/R14.

Account cosmetics have account lifetime rather than health-record retention. Deleting the Auth owner cascades the cosmetic row. Saves serialize with owner deletion, and a late save cannot recreate the owner. These are migration/test contracts, not new evidence of production restore capability. R11/R14.

Removing an item from the current arrangement is an explicit snapshot edit. Resetting four browser preferences is a separate destructive browser action. Account deletion is another action. They cannot share an ambiguous “Start over” control. R06/R15/R16.

### 2.7 Existing presentation is not a blank canvas for effects

The E4 policy explicitly keeps the medallion small, still and subordinate **for keepsake selection/save meaning**. It says saving/rendering this keepsake does not introduce a new motion, audio, particle, reward or second-hero treatment. The later, separately qualified E6 manual Twilight Welcome may still change environmental lighting on the keepsake face because that is a different visit-local cause. E6 does not authorize a keepsake acquisition/save celebration. Stronger FX elsewhere in My Space therefore neither erases E4's static save boundary nor turns E6 into general reward authority. R04/R10.

My Space already has an explicit 3D editor, inline Classic controls, preview labels, a separate save path, and recovery controls. 3D input is suspended during editing/preview or non-ready persistence phases. Garden uses the same controller lifetime without persisting the visit. Auth authority belongs to the entry, not the renderer. R08/R09.

Therefore this proposal recommends redesigning presentation around these seams, not duplicating persistence, reactivating retired gates, or replacing E2 with a new full-screen app under the name of polish.

### 2.8 Evidence limitations that affect design

Controller tests can establish deterministic receipt behavior; they do not show whether someone notices a changed object. Static markup tests can establish labels; they do not establish focus usability. SQL tests can establish synthetic database properties when run; source inspection alone is not a deployed RLS test. Neither a screenshot nor this draft proves comprehension, motion comfort, frame pacing, or long-term return motivation.

Current S14 offers a recent thirty-calendar-date observation JSON copy; the reviewed My Space adapters and controls expose read/save, not a cosmetic export/import feature. No My Space download or restore promise is made here. R07/R09/R16/R17.

### 2.9 External reference boundary

[Disney](https://www.disney.com/) and [Disney+ welcome](https://www.disneyplus.com/welcome) were inspected as public information-architecture references on 2026-09-29. The reviewed content separates leading offers/content, discovery groups, and support details. That is inspiration for hierarchy, not evidence of measured spacing or the effectiveness of a particular FX treatment.

The accessibility design below also consults W3C's explanations of [Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html), [Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html), [Sensory Characteristics](https://www.w3.org/WAI/WCAG22/Understanding/sensory-characteristics.html), [Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html), and [Target Size Enhanced](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html). These inform this proposal; reading them is not an accessibility conformance audit. In particular 44 CSS pixels is an enhanced-target reference and an SK7 design target here, not a claim that it is the universal AA minimum.

## 3. User promise / North Star

> “This place feels like mine because I chose it. I can enjoy it without earning permission, and I know which changes will still be here when I return.”

The repeatable loop is **enter → notice → choose → preview → intentionally keep → enjoy → leave freely → recognize on return**. Choosing nothing, declining a prompt, removing a decoration, or using Classic is a successful user outcome. The loop has no daily obligation and no loss caused by absence.

Personal meaning comes from recognizable placement, material, color, and voluntary action—not from accumulating a health score. A small well-chosen arrangement can be complete. An unadorned place must look intentional, not unfinished, neglected, or medically unsuccessful.

The desired emotional register is welcoming and playful rather than clinical or administratively busy. The world is the main visual object. Controls reveal possibilities without turning the scene into a shopping inventory or a field of status cards.

## 4. Problem statement

Today, the stored truth is relatively small, but the experience can look like a long form explaining that truth. Merely deleting all explanation would hide distinctions that matter: preview versus saved, account versus browser, current selection versus collected ownership, and save uncertainty versus definite failure.

Conversely, attaching continuous effects everywhere could make every region compete with the next action and could visually announce success before persistence confirms it. The actual design problem is **how to remove explanatory burden while making the next action and its consequences more visible**.

The proposed solution has three complementary layers: a spacious visual composition, direct manipulation/selection with immediate reversible preview, and concise truth at decision points. Effects teach the mechanics; labels carry identity and consequence. Recovery is allowed more words than a normal resting page because uncertainty cannot be responsibly compressed into a glow.

## 5. Principles

### 5.1 Space is the product, not the backdrop

On entry show a legible place, a compact ownership-scope cue, and one primary editing affordance. Do not present a tutorial wall, complete catalog, account explanation, and save history over the landscape. Keep semantic exits available without walking.

### 5.2 Generous spacing means grouped spacing

Use tighter proximity for a label and its control, more room between choices, and the largest separation between major experience groups. Equal large margins between every tiny element would weaken association. Never increase whitespace by shrinking the touch target, hiding recovery, or moving confirmation outside usable reach.

### 5.3 Every action responds; not everything demands attention

Hover/focus, press, preview, confirm, and recover deserve explicit treatments. Only the current action needs the strongest treatment. During a conflict, the conflict region—not the companion, particles, or an idle tutorial—has priority. The user can see a rich world without receiving five simultaneous instructions.

### 5.4 Delight is additive and optional

No guilt, streak repair, lost rewards, sadness caused by absence, countdown pressure, or health-linked scarcity. No valuable decoration requires a BP record, a favorable value, a model result, disclosure of extra health information, or repetitive engagement. Future participation-derived options need an equivalent non-health route before consideration.

### 5.5 Meaning precedes collection size

Recoloring, repositioning and deliberately removing an object can create more ownership than a larger catalog. Start with current capabilities rather than inventing an inventory to make the proposal look ambitious.

### 5.6 Presentation cannot issue receipts

Object arrival, snapping into a socket, a sparkle, a sound or a button press is not evidence of storage. Preview responds immediately; receipt wording waits for the controller. A confirmed empty arrangement is as valid as a decorated one.

### 5.7 Familiarity is not permanent state

Same selected motif does not require saved camera coordinates, mood, gaze, interaction counters or a visit journal. Returning re-establishes the current owner and supported snapshot; it does not replay past actions.

## 6. Protected boundaries and lifecycle trust

### 6.1 Semantic and data firewall

BP values/deltas, Model V2 inputs/outputs, inferred health quality, missed goals, completion ratios, and negative outcomes cannot control companion emotion, world condition, visibility, scarcity or decorative benefit. The broader program's example participation events are not current APIs. E3/E4 remain the narrow exception described in R04, not permission for a general event bus.

Do not attach growth state to medical records, extend their retention with derived counters, or build an apparently cosmetic timeline that reconstructs sensitive activity after record expiry. Future durable growth must resolve this explicitly in its own protected decision.

### 6.2 Scope at the decision point

Use a short visible scope phrase near entry or editing, such as **계정 공간** or **이 브라우저의 공간**. The phrase indicates the selected/verified storage mode, not a save receipt. At confirmation use **계정 공간에 저장** or **이 브라우저에 저장**. During a draft retain **미리보기 · 아직 저장 전**. These phrases are candidates, not changes to current strings.

The low-copy rule does not remove the subject from a destructive action. “남긴 문양 제거,” “브라우저 개인화 초기화,” and “계정 영구 삭제” are different operations with different owners. The current two-step account deletion, pending locks and uncertainty wording remain outside this design's mutation scope.

### 6.3 Reset, removal and loss matrix

| Action/event | Product-level meaning to preserve | Not a promise |
| --- | --- | --- |
| Cancel ordinary preview | Discard edited slot intent; show current confirmed arrangement | Undo a committed server write |
| Confirm removal | Save null for the selected slot; preserve other slot/version | Delete all cosmetics, reset revisions, or erase account |
| Browser personalization reset | Remove the four allowlisted preferences after existing confirmation | Atomic rollback of partial storage errors; deleting account cosmetics or files |
| Sign out | End current account connection and invalidate live owners | Delete stored account state, browser preferences, or downloads |
| Delete account | Existing account deletion and cascade scope | Purge browser-local items and user-managed device copies |
| Clear site data / lose browser profile | Browser-owned items may disappear | Recover those items from the account or app deployment |
| Fail to load asset/WebGL | Presentation unavailable; preserve data authority | Item was deleted or collection progress was lost |
| Unknown snapshot version | Preserve stored representation and block unsupported edits | “Empty place,” free migration, or reset-to-default recovery |

R03/R06/R07/R15/R16. Reset uses sequential key removals, not a storage transaction; an error can leave incomplete cleanup. Do not promise all-or-nothing reset. Coordination with another already-open editing tab is an unresolved implementation risk; do not claim cross-tab reset fencing was established by this inspection.

### 6.4 Exports and device copies

The current observation JSON/PDF/print paths do not export My Space. Do not label them “Back up my place.” A screenshot a user makes independently is a picture, not a restorable layout. A future cosmetic export must separately decide allowed fields, version/provenance, ownership/redaction, import capability, and what a receiving device can reconstruct. That is not an extra button authorized here.

## 7. Ownership / architecture seams

### 7.1 Responsibility table

| Responsibility | Existing owner/seam to preserve | Proposal contribution |
| --- | --- | --- |
| Verify account and replace stale identity | Product entry / verified account binding | Honest entry/scope wording, not Auth policy |
| Read/save and reconcile two slots | One PlaceableController and selected adapter | Clear editing/receipt/recovery presentation |
| Validate layout, version and receipt | Value contract, adapter and SQL | No visual reinterpretation of unsupported/unknown states |
| Place rendered objects and provide local play | Existing world/Classic renderer under qualified inputs | Target salience and scene composition proposals |
| Companion reaction and root movement | Target runtime's existing owner; Proposal 01 semantics | No second mixer/root writer or mood history |
| Navigate or return | Existing E2/App bridge; Proposal 02 | Intentional exits without new return payload |
| Supply content/activate assets | Existing manifest/review/activation chain; Proposal 04 | Explicitly separate catalog, selection and future entitlements |
| Sensory timing and cancellation | Current local owners; Proposal 05 | Required causes, suppressions and endpoints, not a parallel global FX engine |
| Cross-product privacy/recovery/evidence | Current contracts; Proposals 08/09/10 | Domain-specific facts and scenarios, not competing workflow authority |

### 7.2 One candidate operation, one authoritative commit

The editor can emit existing slot intents. A renderer can display a projected candidate. Neither a viewport resize nor a hover/animation callback may call save. An FX completion handler must never commit the draft, increment a revision, or unlock another item.

A future local “receipt presented” marker, if needed, is ephemeral presentation fencing tied to the current operation/owner. It is not a receipt ledger, analytics event, persistence field, global counter or alternative truth store. If the exact receipt cannot be distinguished using a bounded seam, leave the result static rather than infer it.

### 7.3 Collection vocabulary without premature architecture

**Catalog option** means a registered item can be offered under the current rules. **Draft selection** means the user is previewing one option. **Placed selection** means a confirmed slot value. **Owned collection** would mean a separately persisted set or entitlement that does not exist in the reviewed snapshot contract.

Do not render “내 컬렉션 1/3,” locked silhouette slots or acquisition dates from three available IDs. Choosing the moon after the ribbon replaces a slot; it does not establish that both are owned. A later collection must declare retention/removal/recovery separately before an equipped-versus-owned distinction appears in the UI.

## 8. State, interaction and voluntary-growth grammar

### 8.1 Normal editing grammar

```text
enter selected storage mode
  → destination owner verifies/loads
  → confirmed supported arrangement (possibly empty)
  → user opens editing
  → select color/socket or currently offered keepsake
  → immediate labelled preview, no write
  → cancel OR explicitly confirm
  → matching receipt: confirmed arrangement
  → optional local play, independent of save
  → leave and later re-read under a fresh owner
```

Do not insert a compulsory tour or a required first decoration. The first visit may end with simply enjoying the place or opening Today.

### 8.2 State-to-presentation contract

| State/fact | Visible treatment | Available next step | FX restriction |
| --- | --- | --- | --- |
| Initial load | Neutral world framing; “꾸미기 확인 중” | Existing semantic exit | No default object sold as saved |
| Confirmed empty | Complete-looking place; “꾸미기” | Open editor or leave | No neglected/failed appearance |
| Confirmed placement | Actual projected arrangement; compact scope | Edit or existing play | No success replay merely on load |
| Draft | Distinct boundary/outline plus “미리보기” | Confirm or cancel | Preview not a reward/unlock |
| Saving | Stable draft plus “저장 확인 중” | Existing pending-safe controls | No fabricated percentage or receipt flourish |
| UNKNOWN | Stable candidate plus “저장 여부 확인 필요” | Read confirmation; explicit identical retry when admitted | Stop instructional/decorative emphasis; no “failed” or “saved” claim |
| Conflict | Latest known arrangement distinguished from edited intent | Review then reconfirm/cancel | No celebratory reconciliation; no silent overwrite |
| Unsupported | Neutral placeholder/retained data label | Supported exit or existing read | Never render as a newly empty arrangement |
| Session lost | Entry-owned recovery, old account surface withdrawn | Sign in/verify or explicit browser mode | No stale receipt or cross-account carry |
| Visual failure | Data truth unchanged; Classic/semantic exit | Switch presentation | No “you lost your item” story |

### 8.3 Teach through a perceptible sequence

The proposed instructional chain is **affordance → voluntary action → local consequence → named state**. On an admitted, idle entry the editing control may receive a short, self-ending highlight. Opening it reveals color and location choices with real previews. On focus/selection, the corresponding object or legal destination is distinguishable. The user need not read a paragraph to learn that color changes the pinwheel.

The chain does not literally move the mouse, fake a hand clicking, auto-select a choice, or change stored state. A demonstration overlay, if later used, must remain distinguishable from the actual user-controlled object. Repeated inactivity must not cause escalating nudges, audio, or forced attention.

For the current keepsake exception, the medallion stays still. Its name, outline and adjacent selection state can be clearer without claiming new animation authority. Rich reveal effects for keepsake saving are specifically excluded from the smallest candidate.

### 8.4 Sensory emphasis budget — design hypothesis

This is a bounded design proposal for My Space, not a new repository performance standard or a permanent animation framework.

| Moment | Proposed emphasis | What stays quiet | Static equivalent |
| --- | --- | --- | --- |
| Entry resolved | One short emphasis on “꾸미기” where qualified | Other controls; unchanged medallion | Clear labelled button and spacing |
| Focus/hover | Immediate outline plus restrained elevation | Other choices | Outline / selected border |
| Choose pinwheel color/socket | Immediate preview; optional short local transition | Camera, global navigation, companion root | Instant placement with same label |
| User activates existing pinwheel play | One coherent wind/rotation response where already supported | Receipt/status region | Existing textual play response |
| Confirm a pinwheel edit | Pending treatment; after exact receipt, proposed local completion accent | Other regions | Persistent named confirmed state |
| Keepsake confirm at current E4 boundary | Static receipt/selection only | Medallion, particles, sound | Same named state |
| Recovery/destructive confirmation | Stable text, clear focus and actions | All nonessential teaching FX | Identical functional presentation |

A plausible exploration range is 120–220 ms for control feedback, 180–300 ms for a local placement emphasis, and a self-ending entry hint well under five seconds. These are adjustable hypotheses, not borrowed Disney timing and not a reason to delay ready content. Evaluate combinations, area and temporal contrast, not just each animation in isolation. No flashing or strobing treatment is proposed.

### 8.5 Receipt presentation has stricter causality than preview

A later FX implementation may acknowledge an operation only after existing receipt matching has succeeded, within the still-live initiating owner. The same operation may be recognized through the controller's reconciliation read. Equal selections from another operation, positive revision on load, cancel, or repeated render are insufficient causes.

Cancel stale animation/timer work on owner replacement, navigation, hiding or relevant accessibility changes. Do not replay missed completion on resume. Keep the confirmed textual state; visual spectacle is optional. This does not revive S05 saved-scene celebration: cosmetic storage and confirmed health-record presentation remain independent.

### 8.6 Voluntary growth at three horizons

**Horizon A — current-state expression:** recolor/reposition the pinwheel, keep/replace/remove the currently offered motif, and enjoy the existing place. No new persistent structure.

**Horizon B — visit-local discovery candidate:** an optional exploration can reveal an ephemeral local detail within that visit. Do not add an earned badge, remember the visit, or pretend the reveal survives reload. Important routes and Classic alternatives remain equally reachable.

**Horizon C — durable collection/growth candidate:** before any implementation, decide whether the real need is a small set of user choices, a distinct collection, or simply more authored environments. Declare ownership, grants/removal, compatibility, conflict policy, retention and privacy. A richer visual library alone does not justify a new inventory service.

No horizon authorizes counters for missed days, unlock probabilities, reward multipliers, engagement streaks, or health result comparison. A newly added place/content option must not retroactively make an existing user's place incomplete.

### 8.7 Returning without pressure

A return begins by reading the selected mode, not by inspecting the length of absence. Use the existing confirmed arrangement when supported; establish a safe new camera/actor state. Do not display “you have been away,” wither scenery, change companion mood, or demand a catch-up action. A neutral “내 공간” can do more than a personalized attendance message.

## 9. Desktop, mobile and adaptive composition

### 9.1 Resting composition

```text
내 공간                                      [계정 공간]   [오늘의 기록 →]

┌───────────────────────────────────────────────────────────────────┐
│                                                                   │
│             Legible plaza / selected companion / Today Gate       │
│                                                                   │
│     still supporting motif                   selected pinwheel    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

[꾸미기]                  [간단한 광장]                [정원 쉼터 →]
```

This is a conceptual composition, not an existing screenshot or a new navigation allocation. It shows the small current inventory of actions without inventing collection cards. Existing action restrictions still apply. Keep scope readable and exits semantically available; the rest can be progressive disclosure.

### 9.2 Editor composition

```text
내 공간 꾸미기                         [취소하고 닫기]
미리보기 · 아직 저장 전

             immediately visible object preview

색        [코랄]       [청록 ✓]       [해바라기]
자리      [입구 왼쪽]  [입구 오른쪽 ✓] [광장 가장자리]

                              [계정 공간에 저장]
```

A larger desktop can place the editor beside the scene; do not overlay it onto movement controls. On smaller screens it becomes an in-flow editing region with a compact contextual preview. The code may restructure existing DOM in a later Issue, but the same controller and projections remain responsible. A decorative thumbnail is not a second authoritative renderer/store.

### 9.3 Candidate spacing and geometry

| Viewport class | Outer spacing hypothesis | Between major groups | Composition priority |
| --- | --- | --- | --- |
| 1366-wide desktop | About 40–64 CSS px or equivalent existing token | About 32–48 px | Scene first; comfortable adjacent editor if it fits |
| 768-wide tablet | About 24–32 px | About 24–32 px | Stage plus in-flow tools; avoid squeezed dual columns |
| 390-wide mobile | About 16–20 px | About 20–28 px | Named action and preview on the same editing flow |
| 320-wide / short viewport | About 12–16 px where feasible | About 16–24 px | Reflow, scrolling, explicit exits; never shrink targets to keep a composition |

Use existing token families where appropriate; these numbers are trial ranges rather than new global tokens. Related label/control gaps can remain around 8–12 px. Aim at least 44×44 CSS px for primary touch actions; accommodate longer text by growing controls. At 200% text, a control may become multiline and the scene may shrink or move. Do not shrink the text instead.

Generous resting-page whitespace is not permission for a tall locked viewport. A short phone must be able to reach recovery and confirmation by ordinary scrolling, without a bottom dock covering them. The editor's safe region, pointer targets and world projected envelopes must be measured after each layout change. Decorative glow outside a button is not additional clickable area.

### 9.4 More space without more journeys

Do not require an additional route just to choose a color. Do not convert every tool into a modal. Prefer one clearly entered editing state, stable source context, and one explicit confirmation. If a second preview renderer would be required to maintain visual context, choose a simpler representation first or scope its resource ownership separately.

## 10. Accessibility and non-primary-input equivalents

The proposed FX-led guidance remains usable with no FX. Actions retain visible names and accessible names; instructions do not say only “press the glowing thing.” Focus styles persist for as long as focus does, rather than disappearing when an animation ends.

Color choices retain text and selection semantics, not only hue. Socket choices retain the current named buttons; any later dragging affordance must keep a single-pointer non-drag alternative and keyboard operation. Do not borrow the S02 actor's drag handler for placeable objects: their spatial and persistence owners differ.

Reduced motion removes nonessential travel, scale/bounce, camera sweeps and repeated animation. It does not suppress confirmation, remove choices, delete the scope label, or turn off the user's ability to place something. Muted or unavailable audio produces the same result through visible state. Forced colors uses semantic borders/focus/selection rather than glow or material hue. The 3D renderer remains optional for all consequential actions.

For screen readers, announce one bounded state change rather than every pointer move, changing color frame, particle, or loading pulse. Distinguish “미리보기” from “계정 공간에 저장됨.” Avoid duplicate status announcements from scene, toast and editor. A local prototype must later be tested with actual focus movement and a screen-reader path; an `aria-live` attribute alone is not proof of coherent announcement.

Automatic motion shown alongside other content requires the appropriate pause/stop/hide treatment. A short self-ending hint is preferable to an attention loop. Movement needed for direct manipulation remains under the user's control; that does not make all ambient motion essential. The W3C references in §2.9 explain these distinctions.

## 11. Loading, failure, recovery and cancellation

### 11.1 Account versus browser entry

Account mode waits for verified identity. A failed verification can show retry and explicit browser-only continuation, but must not read or merge the browser cosmetic snapshot first. The browser adapter object being constructed is not itself a browser snapshot read. Never display browser decorations under the account label during that wait. R07/R08.

### 11.2 Unknown write is neither success nor failure

Keep the candidate visible as a candidate. Replace decorative guidance with “저장 여부 확인 필요.” Offer the existing reconciliation/read and explicitly admitted same-operation retry. Do not create new operation IDs, ask a renderer to save again, discard the pending operation because a timer elapsed, or announce a failed save from an old reread. The controller already has a bounded automatic read after selected failures; do not describe it as having no automatic work at all. R06.

### 11.3 Conflict review names which intent is retained

Show the latest confirmed arrangement and the edited choice without making both look saved. After review, only explicitly edited slots are rebased. A user editing the pinwheel must not overwrite someone else's newer keepsake on the same account. Same-slot conflict still requires a deliberate decision; a visual merge effect does not resolve it. R06/R12.

### 11.4 Unsupported data remains data

Do not turn unknown assets into `null` and save that fallback. A placeholder can say that the current version cannot edit the stored arrangement. A renderer fallback does not authorize a schema downgrade, destructive reset, or restore operation. R05–R07.

### 11.5 Visual failure is not ownership loss

WebGL failure leaves Classic and semantic routes available under the selected storage mode. Where a draft or pending operation exists, preserve the current navigation protections and truthful warning. An FX layer must not hide the reason departure is constrained. It also must not make optional rendering a prerequisite to dismissing an editor or reaching an existing recovery action.

### 11.6 Suspension and account replacement

An old verification, save response, timer or completion effect cannot populate the next owner's scene. Once an account binding changes, use the entry's fresh controller and lose the previous ephemeral draft as current source dictates—do not silently copy it into browser mode. Visibility resume is not an opportunity to replay saved-object celebrations. R06–R09.

### 11.7 Reset and concurrent tabs are a named open risk

The four-key reset has readable-key preflight and final verification, but it is not the placeable Web Lock transaction. An older tab may retain in-memory state; this inspection does not establish a global tombstone or generation for reset. The proposal therefore does not promise that reset permanently fences all open editors. A later reset-related implementation must investigate and explicitly scope that behavior before offering stronger continuity claims. No new tombstone, event channel or persistence key is introduced here.

## 12. Conflicts and anti-patterns

| Temptation | Why it is wrong here | Chosen alternative |
| --- | --- | --- |
| Animate every visible object continuously | Competing guidance; motion control problem; E4 stillness conflict | Rich responses across actions, one emphasized next action |
| Make keepsake arrival look like a prize | E4 forbids rewards/motion; selection is not completion | Still motif and explicit preview/receipt |
| Play success whenever `saved` is true | Loads/cancel can satisfy that flag | Exact current operation receipt or static status |
| Call the three IDs “my collection” | Current snapshot owns one selected motif, not three entitlements | “내 공간에 남긴 문양” |
| Put daily progress on the world | Can become adherence scoring or implied health judgment | Calendar/record facts remain semantic; no pressure in place |
| Automatically import browser decoration at login | Breaks mode/owner separation | Explicit separately reviewed transfer candidate only |
| Repair unknown storage to empty | Destroys future supported state | Preserve and explain unsupported editing |
| Use an animation to confirm deletion | Can obscure irreversible scope | Stable confirmation, clear action name, current safeguards |
| Promise export/restore because JSON exists | Existing export is observations, not My Space | State current scope; separate future export decision |
| Reuse S02 Presence for all object interactions | Different coordinates, lifetimes and writers | Target-specific adapter respecting existing owner |

The existing DOM is not sacred. The semantic and data boundaries are. A future presentation change can remove redundant headers/cards and restructure the editor while preserving the actual meaning above.

## 13. Explicit non-goals

No product implementation, active assets, production or preview deployment, #396 changes, live provider changes, new persistence, schema migration, Auth/RLS/retention/deletion semantics, dependency, audio asset, haptic API, worker, tracking event, or new implementation Issue is part of #899.

This proposal does not create paid goods, tradable ownership, collection currency, random rewards, leaderboard, multiplayer presence, saved mood, free-text place names, persistent cameras, unlimited objects, seasonal fear-of-missing-out, clinical advice, or automatic participation-to-reward wiring.

The accompanying local **static design storyboard** illustrates spacing and state hierarchy. It is not product code, a working interaction prototype, an activated asset, a screenshot of SK7, or evidence of browser/runtime interaction quality. It stays outside the future docs-only repository change unless the task explicitly revises that scope.

## 14. Candidate future implementation slices

These candidates are ordered by expanding boundary. They are not a schedule, assigned work, or a standing prerequisite chain. Reuse what then-live source already provides; do not reimplement a candidate that has been completed elsewhere. Each candidate needs its own current Issue; candidates F/G are decision-first, not immediately implementable UI work.

### 03-A — Spacious pinwheel editing with the existing truth model

**User outcome:** enter a visually complete place, find editing, change one pinwheel attribute, and understand preview versus saved without reading a tutorial.

**Bounded scope:** current pinwheel-only layout hierarchy, grouped spacing, compact mode label, existing named choices and save/cancel. Preserve the same controller/adapters/slots. Do not redesign the keepsake into a catalog, add a store, alter account binding, or introduce a second renderer. New FX is not necessary to complete A; static hierarchy must work first.

**Dependency / stop:** current editor/state/source and responsive geometry must be re-read. Stop if the desired presentation requires changing a persistence or protected input boundary rather than a projection.

**Acceptance idea:** independently complete entry → edit → preview → cancel and entry → edit → confirm → reload in browser and account synthetic modes. Preview/cancel write count remains zero; confirm has one intended operation. Check 320/390/768/1366 composition and actual enlarged text where relevant. Measure target sizes and covered-control geometry, then visually review the composition.

### 03-B — Pinwheel affordance and preview FX as a teaching slice

**User outcome:** notice what can be changed and immediately see the chosen location/color, with no instruction paragraph.

**Bounded scope:** one qualified entry/edit affordance and the current pinwheel preview response; focused/pressed/static equivalents; interruption cleanup. Reuse the current explicit pinwheel play only when the controller already allows it. An unsaved preview must not call `interact()` as an ownership claim. No keepsake animation, new audio/haptic API, actor-root manipulation, persistent tutorial marker, or event telemetry.

**Dependency / stop:** A or equivalent current composition; exact effect property/renderer owner; reduced-motion path; review whether changed action envelope still respects all sockets/hard zones. Stop if a proposed effect needs a second unfenced writer or if the static equivalent cannot identify the action.

**Acceptance idea:** a first-use operator can name the next action and distinguish preview from stored arrangement. Record uncertainty rather than claim population usability. Interrupt during entry cue, preview transition and repeated input; verify no stale action, no duplicate save, no hidden focus, and no motion under the selected static mode. Real input/video/frame traces establish the motion claim; screenshots establish only composition.

### 03-C — Pinwheel receipt clarity without replay

**User outcome:** reliably distinguish “I am trying a placement” from “this operation is stored in the selected place.”

**Bounded scope:** compact pending/unknown/confirmed status and, only if separately qualified, one pinwheel-local confirmation accent linked to the exact current receipt. Do not fire on `saved`, revision-only changes, cancellation or same-looking objects. Do not change receipt matching or add persistence. Keep keepsake saving static under E4.

**Dependency / stop:** source and tests must show a bounded way to discriminate a new local operation from load/cancel. If that cannot be done without broad controller redesign, choose static receipt clarity as the slice and defer animation.

**Acceptance idea:** successful response and matching lost-response reread each acknowledge at most once; old reread stays UNKNOWN; equal selection with wrong operation/fingerprint is not success; remount/reload/cancel/resume and other-account data do not replay. Browser assertions and local deterministic traces, not just a screenshot.

### 03-D — Still keepsake selection, replacement and removal clarity

**User outcome:** understand that one offered motif can be kept or replace the current one, not that a health achievement was earned.

**Bounded scope:** the existing candidate, saved-priority rule, still preview and named removal. Simplify repetitive prose while preserving a compact “활동 달성 표시 아님” clarification at the choice decision. Preserve both slots and version semantics. Do not offer all three items as a persistent library merely because their IDs exist.

**Dependency / stop:** live E3/E4 exception and v1/v2 rules. Any changed keepsake motion/audio/reward behavior first needs an explicitly scoped scene-policy decision; this document grants none.

**Acceptance idea:** candidate absent/invalid/duplicate, saved motif priority, explicit replacement and null removal, pinwheel preservation, no migration on read, explicit v2 save, no downgrade when empty, unknown data not erased. Contrast test coverage with actual browser rendering; neither alone proves both.

### 03-E — A return visit that recognizes choices without pressure

**User outcome:** recognize the current selected arrangement and leave again without a task, prize, or absence message.

**Bounded scope:** existing re-entry data truth and concise loading/confirmed presentation; retain current presentation/storage modes and existing Garden visit-local behavior. No remembered camera, visit count, history, automatic write, grant or new start-screen policy.

**Dependency / stop:** coordinate with Proposal 02; new durable return context belongs elsewhere. Stop if “recognition” starts requiring tracking elapsed absence or persisting interaction state.

**Acceptance idea:** clean re-entry, changed account, browser/account switch, unsupported snapshot, stale load and WebGL failure show the correct owner/scope. No save replay; no writes just from visiting; no disclosure of the old account. Existing Back/Forward/semantic exits remain correct.

### 03-F — Collection and cosmetic-copy decision before storage expansion

**User outcome:** a future user can distinguish an available option, an equipped object, and any genuinely retained collection, and knows what can be lost or exported.

**First coherent scope:** a separately authorized product/data decision comparing continued single-selection snapshots with a bounded owned set. Do not jump directly to a generic inventory service. Specify the need, limits, owner, acquisition/removal, retention, atomicity, unsupported-client behavior, account deletion, browser loss, export/import and asset withdrawal. This is not an implementation Issue created by #899.

**Acceptance idea for the decision:** walk through duplicate acquisition, replacement, removal, cross-device conflict, expired source records, lost response, account deletion race, malicious imported values, missing/withdrawn assets, and lack of restore capability. The decision must either reject the expansion or identify an implementable first slice with all protected approvals; attractive thumbnails are insufficient evidence.

### 03-G — Optional non-medical discovery growth, only under a new contract

**User outcome:** explore a place at the user's pace without turning exercise/health reporting into payment for decoration.

**First coherent scope:** a visit-local, non-medical exploration response if an existing experience justifies it; durable milestones and participation-derived grants remain separate. Later proposals must keep a direct non-spatial equivalent and no exclusive benefit for completing a health task.

**Dependency / stop:** exact event authority and its lifecycle/duplication meaning; privacy review for any derived persistent fact; no import of medical state into the world. Program example event types are not sufficient approval.

**Acceptance idea:** repeated exploration, a forged hint, a replayed event, skipped/absent records, source-record expiry and reduced-motion/Classic use cannot produce health judgments, penalty, duplicate ownership or exclusion. Reject the slice if it requires inventing a hidden behavioral profile.

## 15. Dependencies and prerequisites

Proposal 01 owns companion input/animation composition only; it does not govern cosmetic save receipts. Proposal 02 owns navigation/return intent; it does not store the layout. Proposal 04 owns content identity, scale/origin, theme cohesion and asset lifecycle; it does not redefine possession. Proposal 05 owns shared sensory vocabulary and cancellation conventions while honoring the E4-save/E6-atmosphere distinction.

Proposal 06 does not call record exports cosmetic backup. Proposal 07/Model V2 cannot provide growth inputs. Proposal 08 owns the cross-product account/browser/visit/device vocabulary used here. Proposal 09 distinguishes uncertain writes from visual failures while deferring to existing controller behavior. Proposal 10 selects evidence proportional to each claim rather than imposing all device tests on unrelated work.

Implementation prerequisites are conditional on a selected slice. A future pinwheel spacing change does not need new collection research, production database exercises, or a full Model V2 test cycle just because those topics appear in this document. Conversely, a durable collection or transfer feature cannot use “UI polish” to bypass its real data/policy work.

## 16. Acceptance and evidence design

### 16.1 Six named walkthroughs

**W1 — Empty but complete.** A confirmed revision-zero snapshot shows no stored item, a welcoming place and an edit affordance. Looking around and leaving produces zero writes. A loading placeholder is not presented as a confirmed empty state.

**W2 — Try, then change mind.** Preview a new color and a legal socket, then cancel. The user can see the preview and the confirmed arrangement remains byte-equivalent where the existing adapter promises that. No saving sound, receipt, acquisition or progress appears.

**W3 — Lost response, old read.** Request confirmation, lose the response, and return the previous revision. The screen shows uncertainty, not success/failure. Changes cannot replace the pending operation. An admitted retry carries exactly the same operation; a correct receipt resolves it once.

**W4 — Concurrent different-slot edits.** One context changes the pinwheel and another the keepsake. Conflict is visible; explicit review preserves the edited intent and latest untouched slot. Neither an FX callback nor a convenient full-layout clone overwrites the unrelated newer slot.

**W5 — Another person, same browser.** Account A is replaced by B while a read/save/FX is pending. No old account snapshot, draft or completion is presented as B's. Browser-only items remain separate browser data; the UI does not promise they are private to either account.

**W6 — Render unavailable, choice intact.** Block 3D or the optional asset. Classic shows supported confirmed state and an equivalent edit/removal path under the same storage mode. A user can reach Today without a world interaction. No default repair write or item-loss narrative occurs.

### 16.2 Evidence type must match the assertion

| Assertion | Suitable evidence | Insufficient on its own |
| --- | --- | --- |
| No preview/default/FX-induced writes | Instrumented adapter/controller/browser calls with synthetic state | “No save button was clicked” |
| Atomic receipt and conflicts | Existing deterministic tests plus changed-path tests; SQL when data boundary actually changes | Matching visible color |
| New-save FX does not replay | Current-operation trace and real runtime route/visibility/repeat-input exercise | Static screenshot or `saved` flag |
| Adequate whitespace and touch access | Measured boxes, reflow, focus/scroll exercise, visual review | Width set to 390 or CSS tokens existing |
| No-motion equivalence | Actually run reduced-motion/static path and complete the action | Merely defining a media query |
| A user learns the action | Observed unaided attempt, stated storage understanding and recovery attempt | Number of effects, perceived polish, tester praise alone |
| Long-term personal meaning | Separately justified repeated-use observation | Single-visit operator rehearsal or one beautiful scene |

No new telemetry is required for these ideas. Use synthetic fixtures and sanitized local observations; do not log health values, identities, URLs carrying sensitive context, or Model V2 data. Do not call a one-person operator exercise representative user evidence.

### 16.3 Design success criteria, not an engagement score

The selected slice should make the next action discoverable, preview reversible, storage scope understandable and recovery possible. A declined decoration or shorter session is not failure. Do not measure success by more saves, more health records, longer dwell time or compelled return. Manual comprehension evidence may guide design without creating a behavioral scoring system.

## 17. Risks, unresolved questions and cross-document notes

| Question/risk | Current position | What resolves it later |
| --- | --- | --- |
| Can richer FX improve understanding rather than only attract attention? | Hypothesis; not established by Disney reference or this board | Direct observation with effects disabled as a comparison |
| Can a receipt be recognized without broad state refactoring? | Existing exact operation/receipt seam is promising; `saved` is inadequate | Focused source/runtime design in 03-C |
| Does a user want a collection or simply more beautiful choices? | Unknown; current single slot is not evidence for inventory need | Explicit product decision, not schema-first work |
| What does “keep forever” mean? | Not supported; account lifetime is not service continuity/backup | Separate recovery/ownership decision; avoid phrase meanwhile |
| Could a motif reveal a lifestyle choice? | Mapping is inferable even without source-action storage | Minimize and explain honestly; no secondary inference/use |
| Reset versus open tabs | Cross-tab fencing not demonstrated; partial reset failure possible | Focused reset investigation, only if that boundary is selected |
| Growth from records after record expiry | Risks a derived retention bypass | Reject by default; explicit data-lifecycle review before any durable bridge |
| Asset retirement while a selection still exists | Do not erase unknown selection or replace silently | Content lifecycle decision coordinated with Proposal 04 |
| Too much whitespace on small/zoomed screens | Could hide context and push actions apart | Real reflow/geometry evidence, not a fixed spaciousness quota |
| Global sensory settings | No new persistence or settings owner selected here | Proposal 05/08 and a later bounded decision if needed |

### 17.1 Scoped consistency review with earlier drafts

This draft keeps Proposal 01's reaction/placement state transient and does not merge S02 Presence with My Space. It keeps Proposal 02's return context navigation-only and account/browser modes explicit. It clarifies that UNKNOWN may use the controller's existing bounded automatic reread; only the write retry is explicit and immutable. It does not promote source-event strings into future growth APIs.

The all-ten contradiction review for the Foundry local set preserves the following shared vocabulary: catalog/available content is not owned; owned is not merely placed; visit state is not saved continuity; E4 keepsake save remains static while the separately caused E6 atmosphere may change environmental lighting; exact operation receipt outranks a generic `saved` boolean for new-success FX; account/browser/visit/device scopes remain distinct; semantic exits remain available during presentation failure while uncertain writes retain their own guards; and Proposal 10 supplies proportional evidence rather than a universal matrix. Future implementation still revalidates all of these against live source.

## 18. Live revalidation checklist before any implementation Issue

1. Resolve canonical live `origin/main`, read `AGENTS.md`, inspect the relevant open Issue/PR and isolate the selected task. Do not use this draft's SHA as a future execution base.
2. Re-read current PROGRAM, Living City and scene-policy contracts. Confirm whether E3/E4 or the qualified product entry has changed; distinguish source capability from deployment.
3. Re-read the exact target entry, value contract, controller, adapters, renderer projections and relevant tests. Verify whether the desired slice already exists before duplicating it.
4. Identify the actual data representation: one/two slots, future collection if any, version/layout/asset allowlists and receipt semantics. Do not assume today's schema remains current.
5. Identify every owner of input, transforms, selected scope, draft, write, receipt, focus, animation and teardown. No unfenced second writer or separate keepsake controller.
6. Name the selected action sequence and the smallest coherent outcome. Distinguish presentation-only work from any scene-policy, persistence, Auth/API/DB, asset or lifecycle change requiring explicit scope.
7. Preserve allowed voluntary-choice inputs and reject BP, Model V2, health outcome, missed-target and hidden adherence inputs. Re-read #396/Model V2 authority if the selected boundary touches S11; do not mutate it from this proposal.
8. Prove preview/cancel/play/entry/resize/FX do not save. Revalidate UNKNOWN, same-operation retry, conflict rebase, unsupported-version preservation and old-owner response fencing.
9. Define concise visible text for scope, preview, saving, uncertainty, confirmation and removal. Do not replace identity/consequence with shape, color, sound or movement alone.
10. Apply only evidence relevant to the changed behavior: actual pointer/touch/keyboard, small/short/enlarged viewport, focus/scroll, static/forced-colors, failure and cancellation where claimed. A screenshot is composition evidence, not interaction proof.
11. Re-check export/reset/sign-out/deletion claims against live source. No new recovery guarantee, silent mode switch, automatic merge, data rewrite or lost-state reconstruction.
12. Re-read adjacent proposals only for the boundaries this slice crosses. Future prose cannot amend current authority. Record unresolved conflicts in the task, not a new status registry.
13. Before publishing an actual repository change, inspect the meaningful diff and paths, run the repository-required checks including `git diff --check` and the current autopilot guard, and use hosted routed checks. Do not report a skipped/unrun payload as PASS.
14. Keep release separate. No merge, draft, approved visual, generated content or prior deployment permission substitutes for current external-effect authorization.

---

**Closing position:** Let people recognize their own choices in a beautiful place. Use space and lively, purposeful feedback to make those choices obvious. Keep the underlying meaning small and exact: a preview is a preview, a receipt is a receipt, a visit is not a permanent milestone, and personal expression is never a judgment about health.
