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


# 09. Resilience & Recovery Experience Grammar

## 1. Status, baseline, and authority boundary

This proposal defines user-facing resilience and recovery semantics.

It explicitly does **not** replace [`RECOVERY_CONTRACT.md`](../architecture/RECOVERY_CONTRACT.md), which separates runtime rollback, schema reconstruction and data recovery.

No retry worker, offline queue, new infrastructure, background sync or provider change is authorized.

## 2. Current-repository reality and evidence

### 2.1 Current UI already distinguishes recovery kinds

[`RecoveryPanel.tsx`](../../web/src/components/RecoveryPanel.tsx) supports:

- initial-load;
- stale-read;
- uncertain-save;
- uncertain-delete;
- known-rejection;
- session-expired;
- export-failure.

Its structure is already strong:

```text
확인됨
아직 확인되지 않음
지금 할 일
```

This proposal generalizes that clarity without replacing source-specific state machines.

### 2.2 Read and write failure are not equivalent

A failed read can often be retried without duplicating product state.

An uncertain write cannot be blindly repeated because the first write may already have committed.

Current product and placeable controllers preserve this distinction.

### 2.3 Refresh failure can preserve stale facts

When already-loaded records exist, a refresh failure does not have to erase them and show “empty.” Stale truth plus explicit freshness warning is better than fabricated emptiness.

### 2.4 World/asset failure is presentation failure

Current Living City/My Space paths preserve Classic or semantic exits on WebGL/asset failure. Renderer failure must not mutate product data or imply item loss.

### 2.5 Model V2 failure is analytical unavailability

Artifact or execution failure shows no provisional number and no server fallback.

### 2.6 Repository/data recovery is a separate authority

Runtime rollback does not restore deleted DB/Auth state. Migration reconstruction does not restore user rows. Product retention is not backup retention.

The user-facing phrase “다시 시도” must never be confused with operational restore.

## 3. User promise / North Star

> “When something goes wrong, the product tells me what it knows, what it does not know, what is still safe, and the one next action I can take.”

Recovery should reduce uncertainty, not decorate it.

## 4. Problem statement

Failure handling becomes dangerous when every failure is reduced to:

> “오류가 발생했습니다. 다시 시도하세요.”

That wording can cause:

- duplicate writes;
- loss of a still-valid stale view;
- accidental account/browser fallback;
- false item-loss narratives;
- meaningless reload loops;
- user confusion between “not saved” and “save result unknown.”

The product needs a recovery grammar based on **knowledge state**, not HTTP status alone.

## 5. Principles

### 5.1 Known / unknown / next

Every consequential recovery state should answer those three questions.

### 5.2 Preserve usable truth

Do not erase valid stale facts merely because refresh failed.

### 5.3 Never convert uncertainty into failure

Unknown write outcome remains unknown.

### 5.4 Retry ownership stays local

The component/domain that understands idempotency decides whether retry is safe.

### 5.5 Presentation failure degrades, not corrupts

3D → Classic/semantic; optional asset → quiet absence; audio → visible equivalent.

### 5.6 Session loss changes authority

Do not keep showing account-owned interactive state after ownership is no longer valid.

### 5.7 No automatic offline mutation queue

“Offline-like” experience may preserve readable local state, but this proposal does not authorize queued writes.

## 6. Protected boundaries

- No automatic retry of uncertain mutations.
- No hidden generation of a new operation ID to “help.”
- Preserve request/session generations and stale-response fencing.
- No cross-account stale state.
- No browser fallback under account labels.
- No new worker/background queue.
- No data restore claims from source rollback.
- No Model V2 provisional output.
- No persistence change.

## 7. Ownership / architecture seams

| Failure | Recovery owner |
| --- | --- |
| Initial product data read | current App/data loader |
| Refresh/stale read | current read owner |
| BP/check-in mutation | current mutation/request owner |
| My Space save | PlaceableController + selected adapter |
| Auth/session | Auth/session boundary |
| World renderer | world/runtime boundary |
| Companion asset | renderer/asset boundary |
| Model V2 execution | S11 inference owner |
| Export | export action |
| Release rollback | operations/release authority, not product UI |
| Data restore | provider/data recovery authority, not product UI |

### 7.1 Recovery presentation never becomes a second state machine

The shared grammar may normalize wording and hierarchy, but it must not centralize mutation logic.

For example:

- `RecoveryPanel` can render an uncertain-save explanation;
- the BP mutation owner still decides whether a fresh read or new submission is legal;
- `PlaceableController` still decides whether an identical pending operation may be retried;
- account deletion still owns its own ambiguity rules.

A generic recovery component must never gain authority to repeat actions.

## 8. Recovery-state grammar

### 8.1 Initial loading
No prior facts. Show loading, not empty.

### 8.2 Initial load failed
Known: load did not complete.
Unknown: current server facts.
Next: explicit retry/sign-in as appropriate.

### 8.3 Refreshing
Prior facts remain usable but may become stale.

### 8.4 Stale-read failure
Known: previously loaded facts.
Unknown: whether server state changed.
Next: retry refresh.

Do not enable a mutation whose correctness requires fresh state unless current domain owner allows it.

### 8.5 Known rejection
Server/domain definitively rejected action. Explain the bounded reason and correction/retry.

### 8.6 Uncertain mutation
Known: request was sent.
Unknown: whether it committed.
Next: reconciliation/read; only exact safe retry if current contract allows.

### 8.7 Conflict
Known: a newer state exists.
Next: review before rebase/overwrite.

### 8.8 Session expired
Withdraw account authority, preserve no false success, ask for sign-in.

### 8.9 Presentation/asset failure
Keep semantic product truth and provide fallback/retry.

### 8.10 Model failure
No score. Explicit retry only where current S11 owner permits.

### 8.11 Duplicate versus conflict versus unknown

These states are easy to conflate:

- **duplicate/idempotent repeat** — same intended operation is already recognized;
- **conflict** — a newer/different authoritative state prevents the current write;
- **unknown** — the write may or may not have committed;
- **known rejection** — authoritative response says it did not commit.

Only the domain owner can classify them. Copy should reflect the actual class.

### 8.12 Recovery priority

When multiple problems coexist, prioritize:

1. authority/session safety;
2. uncertain mutation truth;
3. access to the core semantic task;
4. presentation/asset recovery;
5. decorative retry.

A failed companion asset should never visually outrank an uncertain account deletion.

## 9. Desktop, mobile, adaptive behavior

Recovery actions must remain close to the affected region but not cover the primary navigation.

Mobile recovery should use:

```text
short title
known
unknown (only when needed)
one primary next action
secondary safe exit
```

Avoid large error illustrations that push retry/sign-in below the fold.

At 320/short viewport, dialogs and recovery panels scroll internally/document-wise rather than shrinking actions.

## 10. Accessibility and non-primary-input equivalents

- `role="alert"` only for urgent interruption; routine recovery may use status.
- Focus moves to recovery summary when user action requires immediate decision.
- Focus remains stable during background refresh failure if the current task can continue.
- Retry button has a specific name.
- Unknown state is not encoded only by amber color.
- Forced colors preserves boundaries and button identities.
- Reduced motion removes shaking/flashing.
- Screen reader gets one coherent state, not duplicate toast + panel + scene announcements.

## 11. Loading/failure/recovery behavior

### Retry taxonomy

**Safe automatic internal read**
- bounded reconciliation/read may occur where existing controller already owns it.

**Explicit read retry**
- user asks to refresh/recheck.

**Exact operation retry**
- only when current state machine preserves the immutable operation and idempotency contract.

**Fresh mutation**
- new user decision after the old outcome is resolved/reconciled.

Do not call all four “retry” in implementation reasoning.

### Offline-like degradation

Supported only where truth already exists locally:

- stale loaded records can remain visible;
- browser-only My Space may remain usable if its storage/runtime is available;
- semantic static content remains visible.

Not authorized:

- queueing account writes for later;
- caching Model V2 results;
- synthesizing account data from browser copies.

### 11.1 Slow state is not failure

A slow request can remain loading until the owner-defined timeout. Do not switch to “failed” because a presentation animation ended.

Likewise, a slow GLB may cross its bounded load timeout and fail that decorative visit; a data request may have a different timeout and recovery authority. Shared wording cannot imply one global duration.

### 11.2 Visibility/resume

On hidden documents:

- cancel/pause decorative motion according to its owner;
- do not replay missed celebrations;
- revalidate date-bound Model V2 visibility;
- preserve or invalidate request state according to current generation guards.

Resume is not a global retry trigger.

## 12. Conflicts and anti-patterns

| Anti-pattern | Failure |
| --- | --- |
| Clear stale records on refresh error | destroys usable truth |
| Auto-repeat uncertain save | duplicates possible mutation |
| “Save failed” after timeout | may be unknown, not failed |
| Account failure silently opens browser space | scope confusion |
| WebGL error says decoration lost | renderer ≠ persistence |
| Reload loop on optional lazy asset | can trap user |
| Model failure shows prior cached number | violates transience |
| “Rollback restored your data” after app rollback | operational falsehood |
| One generic red error surface everywhere | loses recovery meaning |

## 13. Explicit non-goals

No offline queue, service worker mutation cache, retry worker, Redis, new server, background sync, PITR, provider upgrade, data backup, restore UI, incident console, telemetry, or automatic failover.

## 14. Candidate future implementation slices

### 09-A — Recovery language consolidation
Use `known / unknown / next` consistently in existing product recovery states.

### 09-B — Stale-read preservation
Improve refresh-failure presentation while keeping prior records visible.

### 09-C — Uncertain mutation guard
Focused user-facing clarification for one mutation class; no retry semantic change.

### 09-D — World fallback coherence
Unify 3D/asset failure wording with Classic/semantic exits.

### 09-E — Model failure/retry
Clarify verified artifact/execution unavailability with no score.

### 09-F — Offline-like capability audit
Decision-only: inventory what already works without network and explicitly reject unsafe queued mutations.

## 15. Dependencies and prerequisites

Proposal 06 supplies record/missingness meaning.
Proposal 07 supplies Model failure boundary.
Proposal 08 supplies identity/scope language.
Proposal 10 supplies evidence selection.
Current source state machines remain authoritative.

## 16. Acceptance / evidence ideas

- Initial load 503 does not render empty.
- Refresh 503 retains old records with stale warning.
- Mutation timeout never becomes saved or definitive failure without evidence.
- Exact-operation retry uses same idempotent operation where current owner supports it.
- Session expiry prevents stale account continuation.
- Account My Space failure performs zero silent browser reads until explicit browser continuation.
- WebGL context loss preserves Classic and semantic exits.
- Model artifact failure shows no number.
- Export failure leaves server records intact.
- Focus/keyboard path reaches retry and safe exit at 320/390/enlarged text.

### 16.1 Recovery evidence matrix

| Claim | Evidence |
| --- | --- |
| stale facts remain usable | browser refresh-failure exercise |
| uncertain write not repeated | request count + state assertion |
| old account response fenced | delayed response after identity replacement |
| WebGL fallback safe | context-loss/initialization failure + Classic/semantic action |
| model failure no score | artifact/crypto failure path |
| export failure no record loss | failed download/request with records still visible |
| focus reaches recovery | keyboard runtime check |

### 16.2 Recovery copy review

For each panel, ask:

- Does `확인됨` contain only evidence?
- Does `아직 확인되지 않음` avoid speculation?
- Is `지금 할 일` actually legal under the source state machine?
- Does the action create a duplicate risk?
- Does the panel imply a broader outage than actually exists?

## 17. Risks / unresolved questions

- Which current recovery panels are over-explaining and can be shortened safely?
- When should a stale read disable edits versus allow work? Domain owner must decide per mutation.
- Should retry counts ever be shown? Usually no; they can imply background attempts that do not exist.
- How should very slow asset loading distinguish “still loading” from timeout without invented progress?
- Can offline-like browser My Space be advertised without users assuming account synchronization?
- How should product support explain data recovery residual risk without exposing operational complexity in ordinary UI?

### 17.1 Cross-document ownership note

Proposal 09 owns user-facing recovery grammar, not mutation authority. `retry` must always be qualified internally as read retry, exact-operation retry or fresh user mutation. It does not change Proposal 02 navigation, Proposal 03 persistence, Proposal 07 computation, Proposal 08 identity or the repository RECOVERY_CONTRACT's operational restore meanings.

## 18. Live revalidation checklist before any implementation Issue

1. Re-read live main, active Issue/PR and `AGENTS.md`.
2. Identify the exact failed operation and its owner.
3. Determine whether prior usable truth exists.
4. Determine whether outcome is known, unknown or conflicted.
5. Inspect current idempotency/retry contract before adding any retry.
6. Re-read session/account fencing.
7. Re-read current RecoveryPanel and target-specific source/tests.
8. Verify world/asset failure cannot mutate persistence.
9. Verify Model V2 failure cannot show/carry a number.
10. Verify browser/account fallback is explicit.
11. Exercise route exit, visibility change, account replacement and late response.
12. Exercise 320/390/desktop, keyboard/focus, reduced motion and forced colors where presentation changes.
13. Keep repository rollback/schema/data recovery language out of ordinary product retry copy.
14. Stop if new infrastructure, queue, persistence or provider change becomes necessary.
