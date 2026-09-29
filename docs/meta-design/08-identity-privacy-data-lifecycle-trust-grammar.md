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


# 08. Identity, Privacy & Data-Lifecycle Trust Grammar

## 1. Status, baseline, and authority boundary

This proposal turns existing factual boundaries into one coherent user-facing trust language.

It does not change Auth, RLS, retention, account deletion, browser storage, My Space persistence, Guest isolation, export, Model V2 transience or device-file behavior.

## 2. Current-repository reality and evidence

### 2.1 The product already has multiple storage/identity scopes

Current SK7 contains at least these distinct scopes:

| Scope | Examples | Current lifetime/owner |
| --- | --- | --- |
| **Guest memory** | guest BP/challenge facts, guest S11 input/result | current guest page/runtime; reload resets |
| **Account-owned records** | BP observations, challenge/check-ins | verified account owner; 30-day access contract |
| **Account-owned My Space** | placeable snapshot | verified account owner; account lifetime, separate from health retention |
| **Browser-local personalization** | theme, starting home, companion species, browser My Space | browser storage on that browser/profile |
| **Transient analysis** | signed-in/guest Model V2 input/result | browser memory only |
| **Device-managed copies** | downloaded JSON, saved PDF, print | user's device/file handling |
| **Auth session** | Supabase session | authentication mechanism, not product record ownership data |

These scopes are not interchangeable.

### 2.2 Account deletion is intentionally partial across scopes

Current account deletion removes the Auth account and account-owned server data including account My Space through existing cascades.

It does **not** automatically delete:

- browser-local theme;
- starting-home preference;
- companion preference;
- browser-only My Space;
- downloaded JSON;
- saved PDF;
- printouts.

The current confirmation UI explicitly explains this.

### 2.3 Browser reset is narrower than account deletion

Current browser personalization reset removes exactly four allowlisted keys:

- `sk7-ui-theme`;
- `sk7-starting-home`;
- `sk7-companion-species`;
- `sk7:placeable:v1`.

It does not sign out and does not mutate account data.

### 2.4 Sign-out is not deletion

Sign-out ends the current local account connection. It is not account deletion, record deletion or browser reset.

### 2.5 My Space account/browser modes do not silently merge

Account-mode My Space re-verifies identity. Failure may offer explicit browser-only continuation, but account failure does not read/copy/merge browser cosmetics into account state.

### 2.6 Guest is isolated, not “temporary account”

The guest route mounts a separate memory-only journey, with no Supabase bootstrap, product API capability, server export or account mutation.

### 2.7 Direct URL intent beats a browser-local preference

Starting-home preference applies only to a signed-in bare root. Explicit screen/auth/guest/evidence/My Space contexts win.

## 3. User promise / North Star

> “At the moment I make a choice, I can tell where this information lives, what will survive, and what deleting or resetting will actually affect.”

The goal is **less repeated privacy prose, more precise decision-point truth**.

## 4. Problem statement

Privacy explanations often fail in two opposite ways:

- vague reassurance everywhere (“your privacy matters”);
- dense legal prose at every screen.

SK7 already has relatively crisp technical boundaries. The design challenge is to surface only the scope information that matters **where the user's action changes lifetime or ownership**.

## 5. Principles

### 5.1 Name the place, not the technology

Prefer:

- `계정에 저장`;
- `이 브라우저에만`;
- `이번 방문에서만`;
- `내 기기에 저장한 파일`.

Use “localStorage,” RLS or JWT only in optional technical detail.

### 5.2 Scope follows the action

Show persistence scope beside save, switch, reset, export and delete decisions — not as a repeated banner on every page.

### 5.3 No silent cross-scope transfer

A mode switch does not mean merge.

### 5.4 Delete verbs must name what disappears

“초기화,” “로그아웃,” “계정 삭제,” and “파일 삭제” are different actions.

### 5.5 Unknown outcome remains unknown

An uncertain account-deletion request cannot be narrated as success.

### 5.6 Future world state declares a scope before it exists

Any new persistent Living City state must first choose account/browser/transient/device ownership explicitly.

## 6. Protected boundaries

- Email remains in Supabase Auth, not duplicated into product records.
- `auth.users.id` remains account record owner identity.
- No real identifying/clinical content expansion.
- RLS/retention/deletion unchanged.
- Browser personalization allowlist unchanged.
- No automatic browser→account merge.
- Model V2 input/result remain transient.
- Device copies remain outside server control.
- No new telemetry or profile enrichment.

## 7. Ownership / architecture seams

```text
AUTH
establishes session identity
      ↓
ACCOUNT DATA OWNERS
verify owner / RLS / lifecycle

BROWSER PERSONALIZATION
separate local owner

TRANSIENT RUNTIME
separate visit/session owner

DEVICE FILE
outside application persistence
```

Presentation may describe these scopes, but cannot move data between them.

### 7.1 Scope vocabulary must not imply the same lifetime

Two pieces of state may both be labelled **계정** while having different retention:

- health product records: 30-day access contract;
- account My Space cosmetics: account lifetime under its own persistence contract.

Therefore `계정` means **ownership scope**, not a universal retention promise. Lifetime detail appears only where the decision needs it.

### 7.2 Presentation preference is not identity

Theme, starting-home and companion-species preferences can affect what the interface looks like. They must never be used as proof of account identity or authorization.

### 7.3 Browser-local is not user-private by default

“This browser” means the current browser/profile storage scope. On a shared computer, another person using the same browser profile could potentially encounter those non-medical preferences. Do not phrase browser-local as “only you can see this.”

## 8. Trust-language grammar

### 8.1 Four primary scope labels

Use a compact vocabulary:

- **계정** — tied to verified account;
- **이 브라우저** — local browser/profile;
- **이번 방문** — ephemeral runtime state;
- **내 기기 파일** — user-managed exported/printed copy.

“서버에 저장” can appear when useful, but account ownership is generally the more important user meaning.

### 8.2 Decision-point pattern

At a consequential action show:

```text
WHAT
무엇을 바꾸는가

WHERE
어디에 적용되는가

WHAT REMAINS
무엇은 그대로인가
```

Example for browser reset:

```text
이 브라우저의 개인화 초기화
이 브라우저: 테마 · 시작 화면 · 동반자 · browser-only My Space
계정 기록과 계정 My Space는 변경하지 않음
```

### 8.3 Cross-scope switch pattern

When switching account/browser My Space:

- identify destination scope;
- do not say “동기화”;
- do not preview the other scope as if it were current;
- explain there is no automatic copy/merge.

### 8.4 Export pattern

An export creates a **copy**.

Use wording such as:

- `최근 30일 범위의 현재 접근 가능한 혈압 관찰 JSON 사본`;
- `내 기기에 저장한 사본`.

Avoid:

- “backup your account”;
- “download all my data” unless it truly is all data.

### 8.5 Lifecycle verbs

| Verb | Meaning |
| --- | --- |
| **저장** | persist under the named scope |
| **초기화** | remove/reset a bounded local preference set |
| **로그아웃** | end current session connection |
| **삭제** | remove the specifically named account/record within current authority |
| **내보내기** | create a separate user-managed copy |
| **전환** | move to another scope/presentation without implying copy |
| **가져오기** | future import only if separately authorized; not current behavior |

The UI should not use one verb as shorthand for another.

## 9. Desktop, mobile, adaptive behavior

Scope labels should be compact and stay near the action.

Desktop may use a two-column deletion-scope comparison.

Mobile should stack:

1. 삭제됨;
2. 자동 삭제되지 않음;
3. confirmation action.

Do not hide the second category below a collapsed disclosure on destructive actions.

At 320/enlarged text, scope chips should wrap; do not truncate `계정` vs `이 브라우저`.

## 10. Accessibility and non-primary-input equivalents

- Scope is text, not icon/color alone.
- Destructive confirmation uses an actual modal/dialog behavior with predictable focus.
- Focus returns to the trigger on cancel/close where current semantics support it.
- Status after reset/delete/export is announced once.
- Screen-reader names distinguish account vs browser actions.
- Optional technical disclosures remain keyboard operable.
- High contrast preserves scope boundaries.
- Reduced motion does not remove lifecycle information.

## 11. Loading, failure, recovery

### Auth checking
Do not render account-owned state before verification.

### Browser storage blocked
Use the safe default/current readable choice. Do not promise a preference was stored if the write failed.

### Account My Space unavailable
Offer retry/sign-in and explicit browser mode; never silently substitute browser state under the account label.

### Account deletion uncertain
Use the current known / unknown / next-action structure. Do not automatically repeat deletion.

### Browser reset partial failure
Current reset verifies the allowlisted keys but does not establish a cross-tab tombstone. Do not overpromise other open tabs were fenced.

### Export failure
Keep account/server facts separate from file creation failure.

### 11.1 Failure should not blur scope

If browser storage is blocked, say the browser preference could not be saved; do not escalate that into an account error.

If account verification fails, do not call browser-only continuation “recovery of your account space.”

If file download fails, do not imply the account export endpoint deleted or corrupted records.

### 11.2 Completion messages are ephemeral facts

After logout/account deletion the one-time completion message describes what just happened. It should not become a persistent audit ledger or local history of account actions.

## 12. Conflicts and anti-patterns

| Anti-pattern | Why wrong |
| --- | --- |
| “Saved locally” without saying browser vs visit | ambiguous lifetime |
| “Delete my data” for browser reset | too broad |
| “Logout and clear data” when only session ends | misleading |
| Browser My Space shown under account label | ownership confusion |
| Account delete claims downloaded files disappear | app cannot revoke them |
| Guest called “anonymous account” | guest has no account authority |
| Model result shown as browser-saved | violates transience |
| Future world inventory added without scope class | lifecycle undefined |

## 13. Explicit non-goals

No Auth provider change, RLS change, retention change, cookie/session redesign, new browser keys, cross-device sync, automatic import/merge, account backup, secure vault, device file deletion, telemetry profile, advertising use, data portability service or privacy-policy replacement.

## 14. Candidate future implementation slices

### 08-A — Scope-label consolidation
Replace repeated prose with the four consistent scope labels at current save/reset/export/delete decisions.

### 08-B — My Space mode-switch trust
Clarify account vs browser destination and non-merge behavior.

### 08-C — Data & Account Lifecycle hierarchy
Refine S14 so reset, export, sign-out and deletion are visually and semantically distinct.

### 08-D — Account deletion consequence view
Preserve two-step confirmation while shortening prose through `삭제됨 / 남음` grouping.

### 08-E — Guest/transient trust cue
One concise persistent-in-visit disclosure rather than repetitive storage warnings.

### 08-F — Future world-state scope decision
Decision-first template for any new Living City persistence: scope, lifetime, deletion, export, conflict, recovery.

## 15. Dependencies and prerequisites

- Proposal 02 owns navigation, not scope transfer.
- Proposal 03 owns cosmetic ownership semantics.
- Proposal 06 owns server-record/export meaning.
- Proposal 07 owns Model V2 transience.
- Proposal 09 owns uncertain deletion/recovery.
- Proposal 10 owns evidence.

## 16. Acceptance / evidence ideas

- Another account signs in in same browser: no prior account snapshot is shown as theirs.
- Account mode fails while browser cosmetics exist: zero silent browser reads before explicit continuation.
- Browser reset removes only four keys and leaves account data/session unchanged.
- Sign-out leaves browser personalization unless separately reset.
- Account deletion confirmation names server/account items removed and browser/device items retained.
- Uncertain deletion never shows terminal success until verified.
- Guest reload resets guest health facts.
- Model V2 input/result absent from Web Storage, URLs and exports.
- 320/enlarged text keeps destructive consequences visible before final button.

### 16.1 Scope-switch adversarial walkthrough

Test a browser with:

1. account A My Space;
2. browser-only My Space;
3. saved companion/theme/start preference;
4. downloaded JSON file;
5. transient S11 result.

Then:

- sign out A;
- sign in B;
- switch B to browser My Space;
- reset browser personalization;
- delete B account.

At every step, the interface should describe only the scopes actually changed. No visual residue from A may appear as B's account-owned data.

## 17. Risks / unresolved questions

- Do four scope labels cover future world-state needs without adding confusing variants?
- Should account My Space and health records share the same visual “계정” label despite different retention lifetimes? Likely yes for ownership, with lifetime disclosed only where relevant.
- How should browser-local data be described on shared/public computers without implying account privacy?
- Can exported-copy wording stay concise while explaining it will not update after account edits/deletion?
- If a future import exists, how will users distinguish “copy” from “restore”?
- How should future multi-device cosmetics avoid the misleading word “sync” before merge/conflict semantics are defined?

### 17.1 Cross-document ownership note

Proposal 08 owns the cross-product scope vocabulary: `계정 / 이 브라우저 / 이번 방문 / 내 기기 파일`. It does not redefine domain lifetimes. Proposal 03 remains authoritative for cosmetic possession vocabulary; Proposal 06 for record/copy meaning; Proposal 07 for transient analytical meaning; Proposal 09 for uncertainty.

## 18. Live revalidation checklist before any implementation Issue

1. Re-read `AGENTS.md`, current Issue/PR and live main.
2. Re-read Auth, lifecycle, S14 and My Space contracts.
3. Enumerate every storage/identity scope touched.
4. Confirm current browser personalization allowlist.
5. Confirm account deletion cascade and current uncertain-result behavior.
6. Confirm guest route remains isolated.
7. Confirm Model V2 transience.
8. Confirm export scope/range and device-copy wording.
9. Verify no mode switch adds merge/copy behavior.
10. Verify direct URLs still override starting-home preference.
11. Exercise sign-out vs browser reset vs account deletion separately.
12. Exercise account replacement in same browser.
13. Check screen reader, focus trap/restore, forced colors, 320/390/enlarged text for affected decisions.
14. Stop if Auth/RLS/retention/deletion/persistence semantics would change.
