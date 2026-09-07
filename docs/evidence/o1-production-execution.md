# S4 O1 production execution evidence

## Final decision

- O1: **COMPLETE / VERIFIED**
- Production synthetic execution: **COMPLETED**
- Synthetic cleanup: **COMPLETE**
- Final public smoke: **PASS**
- Scope: sanitized documentation/evidence only. This record contains no account
  address, user or record ID, BP value, token, request body/header, raw log,
  screenshot, or exported JSON.

Execution was approved before the run. The run used the approved Synthetic A
owner flow and did not use a real person or real clinical record.

## Runtime reconciliation retained from preflight

| Target | Recorded runtime fact |
| --- | --- |
| Web | Worker `ah-05-07-pages`; version `70f9d4d5-6377-4087-a405-63993382441c`; recorded web source evidence `30fd65eda8d988804c8af208276934226e0eb67d` |
| API | `bp7-api`, `asia-northeast3`, revision `bp7-api-00013-qbz`, traffic `100%` |
| API image | `sha256:f0acce9e03f480bf17851e7e025b5e1e9cde3eb27c386df957c68555d701d1ee` |
| Build mapping | Cloud Build `ca3ce42f-8691-45f8-9358-a9445d9cbf7d`; image tag `921a35e`; repository commit mapping `921a35e38261104aec1cdd7095f86a16c48f357c`; source attestation unavailable / not claimed |
| Remote migrations | Required first four applied; `20260904090000_add_challenge_checkins_challenge_user_index` not applied. Known additive drift, accepted non-blocking for O1. |

These values are runtime reconciliation facts, not a claim that the deployed
artifact is identical to the current documentation branch. No runtime fact was
changed by this evidence work.

## Sanitized execution results

### Pre-execution public smoke

Web, API `/live`, API `/ready`, and CORS `GET`, `POST`, `PUT`, and `DELETE`:
**PASS**.

### Session continuity

- Email-link sign-in: **PASS**
- Reload session: **PASS**
- Same-browser new-tab session: **PASS**
- Natural expired/invalid session invalidation: **NOT RUN**
- Forced invalidation: **NOT PERFORMED**

### Blood-pressure flow

- Measurement guidance visible: **PASS**
- Systolic-range, diastolic-range, equal-value, and reversed-value invalid
  validation: **PASS**
- Invalid UI tests left persistent rows: **0**
- Unknown-field: not directly exercised through production UI because the UI
  cannot construct an arbitrary extra field. The server contract rejects extra
  fields; this record does not claim a direct production unknown-field request.
- Valid synthetic save and save-success screen: **PASS**
- Confirmed-save bear-lite companion: **YES**, decorative save-success behavior
  only. It is not evidence of health status, blood-pressure interpretation,
  입력 기반 위험군 선별 신호, model output, challenge adherence, health
  improvement, diagnosis, treatment, or prevention.
- Rapid duplicate-click attempted: **YES**; resulting BP record count: exactly
  one; unexpected warning/error: **NONE**.
- Edit: **PASS**; count after edit: exactly one.
- Delete cancel: **PASS**; record remained.
- Delete confirm: **PASS**; BP records after confirmed delete: **0**.

### Challenge flow

- Challenge select: **PASS**
- First check-in: **PASS**; challenge records after first check-in: exactly one.
- Action lock after first check-in: **PASS**
- Check-in status update: **PASS**
- Delete cancel: **PASS**; record remained.
- Delete confirm: **PASS**; challenge check-in records after confirmed delete: **0**.
- Active challenge remained before account cleanup: **YES**
- Unexpected warning/error: **NONE**

### Offline and empty/error boundary

- A full-page F5 while browser Network=Offline produced the browser document-load
  failure `ERR_INTERNET_DISCONNECTED` before app execution. It is **NOT COUNTED**
  toward O1 application offline behavior; no mutation/write occurred.
- Valid in-app refresh while browser Network=Offline: existing application
  content preserved, warning/error shown instead of an empty state, no unexpected
  mutation/write, network restored, manual retry **PASS**, session remained active.
- Production runtime error-vs-existing-content distinction: **PASS**.
- Standalone empty-vs-error distinction was not independently re-run in O1. The
  broader checklist is supported by existing main evidence: the `VP-04` empty
  fixture and `VP-11a` load-failure fixture in
  `web/e2e/evidence-fixtures.spec.ts`, plus the distinction recorded in
  `docs/visual-qa-runbook.md` and `docs/g3-implementation-evidence.md`.

No backend outage, timeout injection, Supabase outage, policy manipulation, SQL,
or infrastructure fault injection was performed.

## Cleanup evidence

Before sign-out: BP records **0**, challenge check-ins **0**, active challenge
**1**, and no other intentional O1 product records were observed.

- Exported JSON was deleted locally and not retained as evidence.
- Product sign-out: **PASS**
- Synthetic A Auth user deletion: **PASS**
- Synthetic A absent after Auth refresh: **YES**
- Read-only post-cleanup aggregate check: orphan blood-pressure rows **0**;
  orphan challenge events **0**; orphan active challenges **0**; orphan check-ins
  by user **0**; orphan check-ins by challenge **0**.

The aggregate zero counts confirm no detected orphan rows after declared FK
cascade cleanup. No cleanup SQL mutation was performed.

## Final public smoke

After Synthetic A account/data cleanup, web, API `/live`, API `/ready`, and CORS
`GET`, `POST`, `PUT`, and `DELETE` were all **PASS**. No product write occurred
during final smoke.

**O1 FINAL PUBLIC SMOKE: PASS**

## Deferred integrated UI/UX findings

These are deferred findings, not O1 blockers, and are not fixed in this PR:

1. A new account can see a rolling recent-7-day path (previous six dates plus
   오늘), which can be misread as already being on challenge day 7. This is an
   ambiguous UX presentation, not a functional data defect.
2. After export succeeds, the notice `내보내기 파일을 준비했어요. 본인 기기에
   안전하게 보관해 주세요.` persists across navigation. Export did not fail and
   data integrity was not affected; this is a stale success-notice UX defect.

Both findings remain for the later holistic UI/companion composition and
high-performance design pass after the broader functional scope is complete.

## Change boundaries

- Runtime deploy changes by this evidence PR: **0**
- Production database/schema changes by this evidence PR: **0**
- R2, UI, model, Cloud Run, Cloudflare, Supabase SQL/migration changes by this
  evidence PR: **0**
- Diagnostic note retained: `containeranalysis.googleapis.com` was enabled
  during provenance inspection. This was a project-service configuration change,
  not a Cloud Run deployment, traffic/image change, or Supabase data/schema
  change. Total infrastructure/project configuration changes are therefore not
  claimed to be zero.
