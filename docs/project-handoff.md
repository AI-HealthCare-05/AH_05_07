# SK7 project handoff and restart guide

This is the durable restart point for SK7 (상균7데이즈). A new Work session
must read this file before selecting the next Issue. Chat history, deployment
mirrors, and Notion summaries do not replace the source repository.

## Authority order

When records disagree, use this order and open a reconciliation Issue rather
than silently choosing one:

1. `AGENTS.md` for safety, privacy, claim, and contribution boundaries.
2. `docs/requirements.md` and the domain contracts for accepted product scope.
3. Migrations, generated OpenAPI, implementation, and automated tests for
   executable behavior.
4. `docs/deployment-ssot.md` for release topology and operator gates.
5. The linked GitHub Issue, pull request, and immutable commit for one change.
6. The Notion 19-day roadmap as the execution mirror and presentation plan.

Notion must reflect repository evidence, but it must not declare code, schema,
test, or deployment work complete before the repository evidence exists.

## Non-negotiable boundaries

- Use `입력 기반 위험군 선별 신호`; do not use diagnosis, treatment,
  prevention, or causal-improvement language.
- Do not store or publish real clinical records, names, contacts, original
  documents, free-text medical histories, credentials, JWTs, magic-link URLs,
  request headers, or raw production console output.
- Keep model output, measured blood pressure, challenge participation, and
  legacy records as separate facts.
- Do not use BP measurements as predictors when they define the training label.
- The browser receives only public Supabase configuration. It never receives a
  service-role or other server-only key.
- Do not add an LLM, OCR, Redis, worker, or another dependency without an ADR
  and a measured requirement.
- Use synthetic accounts and synthetic values for tests, captures, and demos.

## Current checkpoint

| Concern | Verified checkpoint |
| --- | --- |
| Source repository | `AI-HealthCare-05/AH_05_07`, default branch `main` |
| Source baseline before this handoff | `61ee356e43eeb4f06120af870c4fc2b9ee5f9d41` (PR #145) |
| G3 signature implementation | PR #142, commit `805cf2bad7ab6fd4852fe51a6b6d3ccf2a40b411` |
| G4 readiness record | PR #144, commit `856606a2a230558887e294e44e8fe99186a542a8` |
| Production web | Cloudflare Worker `ah-05-07-pages` |
| Deployment snapshot | `emotigom/ah-05-07-pages`; run `33822332784` passed on 2026-09-04 |
| API | Cloud Run `bp7-api` in `asia-northeast3` |
| Record ownership | Supabase JWT plus PostgreSQL RLS |
| Handoff reconciliation | Issue #146 and PR #147; resolve their merge state before selecting the next Issue |
| Ownership verification | Issue #149: preflight plus approved synthetic A/B browser verification passed; anonymous denial, owner CRUD/export, cross-user non-disclosure, and first-check-in action lock passed; cleanup complete |
| Rollback evidence | Issue #151: rollback to `38bb08b6-66ca-4933-8cbe-ee857aa4ece7` and restore to `6d100754-7e85-4d43-b466-e7944c61a0c0` both passed public smoke |

The table records the evidence available when PR #147 was opened. It cannot
predict that pull request's squash-merge commit or later work. At every restart,
resolve the current upstream `main` SHA and recent merged pull requests before
treating any source commit as current.

Issue #143 records a passed public web/API/CORS smoke, magic-link sign-in and
session refresh, and a clean browser console/network review for the G4 web
rollout. It records no Cloud Run deployment, Supabase migration, or production
record write.

The current Worker version was recorded as
`38bb08b6-66ca-4933-8cbe-ee857aa4ece7`. The purported rollback value
`38bb08b6` is only the current version prefix, so rollback readiness remains
open. Do not call Gate C or rollback rehearsal complete until a distinct full
identifier and sanitized rehearsal evidence exist.

## What is implemented

- Supabase email magic-link authentication and browser session restoration.
- Owned morning/evening blood-pressure observation create, read, update,
  explicit-confirmation delete, and recent-seven-day JSON export.
- One active seven-day challenge, first-check-in action lock, daily check-in,
  status-only check-in edit, and explicit-confirmation delete.
- Thirty-day access expiry and physical-cleanup contract with RLS ownership
  policies and local pgTAP suites.
- Approved G3 seven-day signature experience, deterministic evidence fixtures,
  responsive asset delivery, and sanitized desktop/mobile review evidence.
- Dependency-free secret-boundary and public deployment-smoke verification.

The risk-signal UI remains unreleased because the verified model artifact,
metadata, split digest, leakage audit, comparison evidence, and repeatability
gate are not complete.

## Open evidence and next priority

1. Add a separately bounded synthetic browser scenario for storage failure.
   Issue #169 covered browser validation, session recovery, and initial-load
   failure; Issue #172 covered blocked duplicate save, uncertain-save guidance,
   and stale refresh; Issue #174 covers current owned check-in status edit plus
   explicit cancellation and confirmation before deletion. No real account,
   JWT, operational record, API, database, or deployment is involved.
2. Expand the sanitized observation-load sample before setting a P95 target;
   the deployed check-in foreign-key index removed the Advisor finding and
   reduced the observed cold sample, but the current manual sample is small.
3. Complete the evaluator-facing seven-day dashboard evidence: separate BP,
   challenge adherence, and future model signal; capture normal, empty, and
   failure states without causal-improvement language.
4. Start the risk-signal release gate only after the operational evidence above
   is reconciled and a separate Issue defines its bounded scope. The gate needs
   immutable artifact and metadata, frozen split digest, leakage audit, at
   least two-model and multiple-metric comparison, model card, and repeated-
   input consistency evidence.
5. Consider asynchronous model processing only if a separate ADR documents a
   measured latency, duration, or reliability trigger. Persist job state and
   results in PostgreSQL; do not add Redis or a worker merely to mirror a
   reference architecture. OCR, prescription/medical-document handling, and
   LLM guidance are outside SK7 scope.

The representative Cloud Run requests-log review is complete under Issue #166:
after a synthetic signed-in refresh, the operator reviewed the bounded
production request-metadata list and found no secret, user identifier, request
body, or health value. No raw log output is retained.

Each item requires its own Issue, short branch, pull request, verification, and
squash merge. A production action requires the explicit approval and gate named
in `docs/deployment-ssot.md`.

## Local Windows patch workflow

The operator keeps the working clone at
`C:\Users\emotigom\PycharmProjects\AH_05_07` and downloads generated patches to
`C:\pj`.

Every patch delivery must provide a full expected base SHA, patch filename, and
branch name. Apply those values in PowerShell:

```powershell
Set-Location C:\Users\emotigom\PycharmProjects\AH_05_07
git switch main
git pull --ff-only

$ExpectedBase = "<full expected base SHA>"
$PatchFile = "C:\pj\<patch filename>.patch"
$BranchName = "<type>/<issue>-<short-name>"
$ActualBase = git rev-parse HEAD
$Dirty = git status --porcelain

if ($ActualBase -ne $ExpectedBase) {
    throw "Unexpected base commit: $ActualBase"
}
if ($Dirty) {
    throw "Working tree is not clean."
}

git switch -c $BranchName
git apply --check $PatchFile
git apply $PatchFile
git diff --check
git status --short
```

Stop on either guard failure. Review the diff before committing, then use a pull
request and squash merge according to `AGENTS.md`. Never reuse an old Issue
branch or apply a patch to an unknown base.

## Verification commands

Select the smallest set that proves the changed scope. For a documentation-only
patch:

```bash
git diff --check
```

For application changes, use the repository verification commands in
`README.md`, then add the web build and boundary checks when `web/**` changes:

```bash
cd web
npm ci
npm run build
cd ..
python3 scripts/ci/verify_secret_boundary.py --self-test
python3 scripts/ci/verify_secret_boundary.py --web-dist web/dist
python3 scripts/ci/verify_deployment_smoke.py --self-test
git diff --check
```

Database changes also require the local pgTAP suites and the separate production
migration gate. A passing web build never proves that the database migration was
applied.

## Restart checklist

At the beginning of a new Work session:

1. Read `AGENTS.md`, this file, `docs/requirements.md`,
   `docs/acceptance-test-plan.md`, and `docs/deployment-ssot.md`.
2. Read the current Notion 19-day roadmap, then treat any mismatch as work to
   reconcile rather than as permission to change code.
3. Confirm the latest upstream `main` SHA and recent merged PRs.
4. Confirm there is at most one active Issue and no unreviewed local work.
5. Inspect the latest relevant deployment run only when the next task concerns
   runtime state.
6. Choose the highest open P0 evidence item, create or confirm its Issue, and
   state the production boundary before editing.
7. After merge, update this checkpoint, the affected domain documents,
   deployment SSOT when applicable, and Notion with the same evidence-backed
   result.

Never infer completion from an old chat summary. Use immutable commits, Issues,
test results, and sanitized release records.
