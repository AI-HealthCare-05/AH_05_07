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


# 06. Records & Longitudinal Meaning

## 1. Status, baseline, and authority boundary

This proposal defines how already-authorized record facts can become understandable across time without turning the product into diagnosis, adherence scoring, prognosis, or hidden medical interpretation.

It does **not** change:

- the current 30-day access/retention boundary;
- the current database schema or RLS;
- the current seven-day Today/recap windows;
- the current export APIs;
- record edit/delete authority;
- Model V2 storage or visibility;
- challenge semantics;
- account deletion;
- report/PDF persistence.

Longer-term continuity is discussed only as a separately authorized future decision.

## 2. Current-repository reality and evidence

### 2.1 There are four different time concepts today

The product already carries several time horizons that must not be collapsed into one vague “history”:

1. **fact time** — the observation/check-in date and stored morning/evening period;
2. **journey window** — Today and recap use bounded seven-calendar-day contexts;
3. **server access lifetime** — owned product records become inaccessible at their server-enforced 30-day `expires_at`;
4. **user-managed copy lifetime** — downloaded JSON, browser-saved PDF and printouts are outside server retention.

See [`observation-data-lifecycle.md`](../observation-data-lifecycle.md) and [`ux-flow.md`](../ux-flow.md).

A future UI may visualize these horizons more clearly, but it may not claim they are the same contract.

### 2.2 Current retention is access truth, not a storytelling preference

All four product-record tables become inaccessible through RLS after the exact server-enforced expiry. Scheduled purge is later physical cleanup. An expired row is not a “hidden archive” the UI can restore.

The product must not imply:

- “we keep 30 days but show 7” if a particular row has already expired;
- that purge time defines user access;
- that server retention is a backup;
- that a local JSON/PDF copy remains connected to the account.

### 2.3 Current record surfaces already separate fact types

The current journey keeps:

- measured BP observations;
- challenge check-ins;
- legacy challenge events;
- Model V2 result;

as separate meanings.

S08 summarizes records and recorded dates while retaining separate types. S09 shows one selected record with its date/period context. S10 presents current/prior seven-day review, partial coverage, separate lanes, a human-readable report, print/PDF and JSON export.

This proposal preserves that separation.

### 2.4 Missingness already has several meanings

A blank date in a seven-day view can mean only that **no accessible record is present in the loaded product state for that date**.

It does not prove:

- the user did not measure;
- the user forgot;
- data was deleted;
- data expired;
- a device failed;
- the user was unhealthy;
- the challenge was failed.

Current `ux-flow.md` explicitly says an unrecorded date is not a lost record and not proof that no measurement occurred.

### 2.5 Current report arithmetic is descriptive only

Where the loaded report has at least two BP observations, the current report may show the simple arithmetic mean of those loaded observations, equal weight per observation, with no missing-date zeroes and no daily-average weighting. Display rounding does not change the underlying values.

That mean is a descriptive summary of the loaded records. It is not:

- a diagnosis;
- a “normal”/“abnormal” classifier;
- a trend;
- an improvement score;
- evidence that a challenge caused a change.

### 2.6 Current exports are user-managed copies

The existing observation export supports a bounded 1–30 day window. Current S10 uses the selected seven-day range; current S14 requests the exact recent 30-calendar-date range from `today - 29 days` through `today`.

JSON, PDF and printed copies are user-managed after creation. Account deletion or server expiry does not revoke copies already saved to the user's device.

### 2.7 “Consultation use” is showing facts, not generating a clinical packet

The current human-readable seven-day report can be shown or printed for a consultation. The product is not authorized to claim that the report is:

- a medical record export;
- a clinician-verified summary;
- complete history;
- a diagnosis;
- a treatment recommendation;
- automatically shared with a provider.

## 3. User promise / North Star

> “I can tell what I recorded, when I recorded it, what is missing from this view, and what this summary does — without the product inventing a story about my health.”

The longitudinal experience should make three things immediately legible:

1. **what is known;**
2. **what period is being reviewed;**
3. **what is not known from the available records.**

The product earns trust by resisting the temptation to turn every sequence into a trend or score.

## 4. Problem statement

Time-series interfaces naturally invite over-interpretation.

A list of dates becomes a streak.
A line becomes a trend.
A mean becomes a target.
A gap becomes non-adherence.
Two adjacent lanes become causal association.

SK7 already has strict semantic separation, but a richer future record experience could accidentally reintroduce those implications through visual composition even if the copy remains technically factual.

The design problem is therefore:

> **make accumulated facts easier to understand without adding unearned longitudinal meaning.**

## 5. Principles

### 5.1 Orient before summarize

Always establish the exact period before presenting counts or averages.

### 5.2 Keep fact type labels visible

BP observation, challenge participation and legacy records remain distinguishable in wording and structure, not only color.

### 5.3 Absence is not failure

Use “기록 없음” or equivalent bounded wording. Do not say “missed,” “failed,” “didn't measure,” or “incomplete” unless the actual domain contract establishes that fact.

### 5.4 Descriptive arithmetic stays descriptive

Counts, dates and an authorized arithmetic mean may summarize loaded facts. They must not become classification, trajectory, adherence or causal inference.

### 5.5 Current/prior/ended are context, not performance tiers

A prior seven-day period is not “worse,” “better,” or “closed successfully.” Ended challenges remain factual participation history.

### 5.6 Copies disclose their boundary

A downloaded or printed copy should state its date range and that it is user-managed. Do not call it an account backup.

### 5.7 Long-term continuity requires explicit retention authority

A beautiful year view is not permission to retain a year of server data.

## 6. Protected boundaries

- Preserve [`observation-data-lifecycle.md`](../observation-data-lifecycle.md).
- Preserve owner-only RLS and expiry invisibility.
- Do not add a retention extension or derived long-term medical history.
- Do not persist Model V2 output in S10, reports, exports or history.
- Do not combine BP and challenge facts into a single score.
- Do not infer measurement quality or adherence from missing dates.
- Do not classify BP values beyond current authorized factual presentation.
- Do not create a consultation-sharing backend, provider integration or new device sync.
- User-managed copies remain outside server deletion/retention.

## 7. Ownership / architecture seams

| Concern | Current owner | Proposal rule |
| --- | --- | --- |
| Record truth / expiry | API, DB, RLS, lifecycle contract | Presentation consumes accessible facts only |
| Seven-day selection | Current App/window navigation | Proposal may clarify period, not change query authority |
| Record type semantics | Existing domain objects and UI lanes | Never merge into one “health progress” model |
| Detail navigation | S08/S09/S10 routing | Preserve origin/return context |
| Report arithmetic | Current report logic | Keep formula explicit and descriptive |
| Export generation | Existing export/report paths | Clarify copy scope; no new storage |
| Long-term storage | Not authorized by this proposal | Requires separate retention/data decision |
| Visual scene | Decorative scene policy | No record values/counts drive mood, weather or landmark state |

## 8. Longitudinal state grammar

### 8.1 The four-layer time grammar

```text
FACT
observed_on + period/status
        ↓
WINDOW
selected 7-day context
        ↓
ACCESS
currently accessible under 30-day retention
        ↓
COPY
optional user-managed JSON/PDF/print
```

Each layer answers a different question.

### 8.2 Date cell grammar

A date can truthfully be:

- today;
- loaded with one or more BP observations;
- loaded with challenge participation;
- loaded with legacy record;
- loaded with multiple separate fact types;
- loaded with no accessible record in the current data;
- future within a challenge timeline;
- outside the loaded window.

Do not create a generic “complete/incomplete day” state.

### 8.3 Comparison grammar

Safe current/future comparison forms:

- exact date ranges;
- record counts by type;
- dates with/without accessible records;
- raw observations in chronological order;
- separately authorized descriptive mean.

Unsafe without new authority:

- improvement arrows;
- “better/worse” badges;
- red/green trend grading;
- adherence percentage as health quality;
- challenge completion overlaid onto BP trajectory as explanation;
- Model V2 number on the same longitudinal axis.

### 8.4 Missingness grammar

Visible wording should distinguish:

**Known**
- “이 날짜에 현재 불러온 혈압 관찰 기록이 없어요.”

**Unknown**
- why it is absent;
- whether a measurement happened elsewhere;
- whether a user intentionally chose not to record.

Do not fabricate reason codes.

### 8.5 Freshness grammar

Refreshing with existing data should keep the prior facts visible and label that a refresh is in progress or failed. An initial load failure is different from a stale-read failure.

## 9. Desktop, mobile, and adaptive behavior

### 9.1 Desktop

Desktop can show period controls, date structure and separate fact lanes in one view, but should resist dashboard density.

Prioritize:

1. period;
2. date selection;
3. selected-day facts;
4. raw records;
5. report/export utilities.

### 9.2 390 / 320 mobile

Do not compress three record types into colored micro-icons that lose labels.

Prefer:

- horizontally legible date controls or wrapped date rows;
- one selected-date detail area;
- sequential labelled record lanes;
- actions below the relevant record.

### 9.3 Short viewport

Global navigation must not cover period controls, delete/recovery actions or export controls. Scrolling is acceptable; shrinking text/targets is not.

### 9.4 200% zoom/text

Period labels, date ranges and morning/evening context may wrap. Preserve semantic order rather than forcing a seven-column visual at all costs.

## 10. Accessibility and non-primary-input equivalents

- Every date control has a date-bearing accessible name.
- `aria-current="date"` identifies today where appropriate.
- Selected date uses semantic pressed/selected state, not color alone.
- Record lanes retain headings.
- “No record” is text, not an empty decorative gap.
- Keyboard can change periods, choose dates, open details and return.
- Focus returns to a meaningful origin after edit/delete confirmation.
- Reports retain a logical reading order independent of visual columns.
- Printed/PDF output retains text labels, scope and caveats.
- Screen readers should not receive decorative landmark names as medical chronology.

## 11. Loading, failure, recovery

### Initial load
Show structure and loading, never confirmed empty.

### Refresh with old facts
Keep old facts visible, label freshness uncertainty.

### Record expired between views
Treat the next authorized read as source truth. Do not resurrect from client memory and do not call expiry “deletion by the user.”

### Export failure
Do not imply data loss. The server records and local download are separate outcomes.

### Detail no longer available
Return a non-disclosing not-found/expired state and preserve safe navigation.

### Report generation failure
Keep raw records usable; report/PDF is an additional representation.

### 11.1 Recovery language must preserve temporal truth

Record recovery should use different language depending on the evidence available.

| Situation | Known | Unknown | Safe user-facing consequence |
| --- | --- | --- | --- |
| Initial load still pending | no current window yet | all current facts | keep skeleton/status; no empty claim |
| Initial load failed | request failed | current window facts | retry; do not show historical cache as current unless explicitly stale |
| Refresh failed after prior success | previous loaded facts | whether server changed | keep prior facts and mark refresh uncertainty |
| Selected record now unavailable | old URL/key existed | whether expired/deleted/unauthorized | non-disclosing unavailable state; safe return |
| Export failed | account records may still be available | whether a file was created | retry export; no “records lost” copy |
| Print/PDF aborted | on-screen report still exists | whether browser created a file | treat file creation separately |
| Session expired | account authority ended locally | current remote facts until re-auth | re-authenticate; do not carry mutation state across identities |

The UI should never translate “we could not confirm this read” into “there are no records.”

### 11.2 Time-zone integrity

The product uses Korea calendar semantics for current windows. A future record redesign must preserve the exact date semantics already owned by the source/API rather than recomputing boundaries from the browser's arbitrary local time.

Do not:

- shift a record into another date because the browser locale differs;
- infer a clock time from morning/evening period;
- turn stored period into exact measurement timestamp;
- display a “day streak” across timezone-converted dates.

### 11.3 Record detail origin is part of journey continuity, not data meaning

Opening a record from S08 versus S10 affects where the user returns. It does not change the record itself. A redesigned detail surface should not encode “opened from recap” into the record model or exported data.

## 12. Conflicts and anti-patterns

| Anti-pattern | Why it fails |
| --- | --- |
| Green/red line across BP and challenge | implies joined health meaning |
| “7/7 perfect week” | converts participation into score |
| Gap shown as broken streak | invents adherence meaning |
| 30-day calendar described as backup | retention ≠ backup |
| “Your BP improved this week” from two means | unsupported interpretation |
| Model V2 number in record history | violates current non-persistence |
| Hide raw facts behind one summary score | destroys inspectability |
| Export button labelled “backup account” | copy scope is narrower |
| Future year chart backed by newly retained rows | retention change disguised as UI |

## 13. Explicit non-goals

No retention extension, archival table, data warehouse, clinician portal, EHR integration, cloud file storage, share link, background sync, automatic trend diagnosis, adherence score, health outcome score, Model V2 history, new PDF persistence, new export API, or account backup is authorized.

### 13.1 Vocabulary guardrail

Use these terms consistently:

- **record** — one stored product fact;
- **recorded date** — a date with at least one currently accessible record in the loaded scope;
- **selected seven-day period** — the current review window;
- **prior/ended period** — navigation context, not quality judgment;
- **user-managed copy** — JSON/PDF/print outside server lifecycle;
- **missing from this view** — absence of an accessible loaded record, not evidence of behavior.

Avoid introducing “health history,” “adherence history,” “complete day,” “healthy week,” “progress score,” or “baseline improvement” unless a future contract explicitly defines them.

## 14. Candidate future implementation slices

### 06-A — Period and selected-date orientation polish
Clarify current seven-day context and selected day without changing query semantics.

### 06-B — Missingness and stale-read clarity
Make “no accessible record,” “loading,” and “stale refresh” visually distinct.

### 06-C — Human-readable seven-day report hierarchy
Reduce prose and strengthen fact grouping while preserving raw records, formula and non-diagnostic scope.

### 06-D — Cross-window descriptive comparison
Only if justified later: compare two explicitly named seven-day periods through separate counts/raw facts, without “better/worse.”

### 06-E — Consultation-copy disclosure
Clarify date range, generated-at context, user-managed-copy status and absence limitations in print/PDF.

### 06-F — Longer-term continuity decision
Decision-first work only. Establish need, retention, deletion, ownership, export, recovery and privacy before any year/month history implementation.

### 14.1 Candidate slice stop conditions

Each candidate stops immediately if it requires:

- retaining records longer than current RLS access;
- joining Model V2 result to records;
- deriving a durable “missing reason”;
- classifying BP values;
- inferring adherence quality;
- storing PDF/print/share state;
- adding a provider/clinician integration.

### 14.2 Ordered expansion rationale

06-A through 06-C can improve meaning using current records and current lifecycle. 06-D adds comparison risk and therefore follows only after the single-window grammar is strong. 06-E changes the user's interpretation of a copy and should be validated with the current print/export path. 06-F is intentionally a decision rather than UI implementation because storage duration is the real boundary.

## 15. Dependencies and prerequisites

- Proposal 05 owns motion around period changes, not the meaning of records.
- Proposal 07 owns Model V2 trust and keeps its output out of longitudinal history.
- Proposal 08 owns account/browser/device-copy vocabulary.
- Proposal 09 owns stale-read/uncertain-write recovery language.
- Proposal 10 owns proportional evidence selection.
- Current data lifecycle and API contracts remain source authority.

## 16. Acceptance / evidence ideas

**A:** Navigate current/prior/ended windows by keyboard/touch; URL/history and selected period stay correct.

**B:** Exercise initial load, confirmed empty, stale refresh, refresh failure and expiry/not-found; no state is mislabeled.

**C:** Synthetic seven-day data with 0, 1 and 2+ observations verifies mean visibility and exact formula; challenge and legacy lanes remain separate.

**D:** If comparison is ever built, swap which period has more records. Wording and color must not imply the period with more records is healthier.

**E:** Print/PDF with partial records preserves date range, raw facts, absence wording and user-managed-copy disclosure; app controls are omitted.

**F:** Any longer-term decision must explicitly answer deletion, expiry, restore and account-copy semantics before code.

### 16.1 Evidence must distinguish facts from interpretation

For any future visual comparison, perform an adversarial content review:

1. Use a window with more BP records but fewer challenge check-ins.
2. Swap the windows.
3. Use the same BP values with different missing-date patterns.
4. Use the same challenge participation with different BP values.
5. Remove all records from one date.
6. Put legacy records in only one period.

The layout should not suggest that one window is healthier, more successful, or more complete.

### 16.2 Consultation-copy walkthrough

A consultation-oriented copy should let another person answer:

- What exact date range is shown?
- Which facts are BP observations versus challenge participation?
- Which dates have no accessible BP record in this copy?
- Is the arithmetic summary based on 0, 1, or 2+ observations?
- Is the copy current server state or a user-managed snapshot?

If those answers require hidden application state, the copy is not self-explanatory enough.

## 17. Risks / unresolved questions

- Does the user need 30-day browsing, or is seven-day orientation plus export sufficient?
- How should a seven-day view communicate that older dates may be nearing server expiry without turning expiry into anxiety?
- Should a future comparison surface show arithmetic differences at all, or is side-by-side raw context clearer?
- How should a user-managed copy explain that later account edits/deletes do not update the file?
- What language best supports consultation use without implying clinician endorsement?
- If longer-term continuity becomes important, is server retention actually the right mechanism, or should the product preserve only user-managed copies?

### 17.1 Cross-document ownership note

Proposal 06 owns longitudinal **meaning**, not retention, bridge navigation, recovery state machines or evidence gates. `record`, `recorded date`, `selected period`, `user-managed copy` are the shared terms. Model V2 output remains outside history; device copies use Proposal 08 scope language; failures use Proposal 09 known/unknown/next grammar.

## 18. Live revalidation checklist before any implementation Issue

1. Resolve current `origin/main`, `AGENTS.md`, active Issue/PR and exact target surface.
2. Re-read current retention/RLS/export contracts.
3. Confirm current seven-day/current-prior-ended navigation semantics.
4. Re-read current S08/S09/S10 source and tests.
5. Confirm current report arithmetic and missingness wording.
6. Verify whether S14 export range or API limits changed.
7. Verify Model V2 remains excluded from history/report/export.
8. Enumerate every time horizon used by the slice; do not conflate fact time, window, expiry and copy lifetime.
9. Name every loaded/empty/stale/expired state affected.
10. Check keyboard, date accessible names, focus return and Back behavior.
11. Check 320/390/desktop and actual enlarged text if layout changes.
12. Use screenshots for composition only; use browser interaction for date navigation, focus and export behavior.
13. If retention, export schema or persistence changes, stop: this proposal no longer authorizes the task.
14. Run current required repository checks before publishing; merge is not deployment.
