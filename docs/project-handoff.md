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
| Current source baseline | `61ee356e43eeb4f06120af870c4fc2b9ee5f9d41` (PR #145) |
| G3 signature implementation | PR #142, commit `805cf2bad7ab6fd4852fe51a6b6d3ccf2a40b411` |
| G4 readiness record | PR #144, commit `856606a2a230558887e294e44e8fe99186a542a8` |
| Production web | Cloudflare Worker `ah-05-07-pages` |
| Deployment snapshot | `emotigom/ah-05-07-pages`; run `33822332784` passed on 2026-09-04 |
| API | Cloud Run `bp7-api` in `asia-northeast3` |
| Record ownership | Supabase JWT plus PostgreSQL RLS |
| Current documentation work | Issue #146, G4 and restart SSOT reconciliation |

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

1. Establish and rehearse a distinct Cloudflare rollback target without copying
   sensitive console output into GitHub or Notion.
2. Run the reviewed ownership and exact-time pgTAP suites against the linked
   Supabase project with synthetic users; retain only sanitized outcomes.
3. Add automated signed-in browser evidence for recovery, validation,
   duplicate, timeout, empty, stale, and failure states.
4. Inspect representative Cloud Run logs after a synthetic request and record
   only whether prohibited identity, body, and health values were absent.
5. Start the risk-signal release gate only after the operational evidence above
   is reconciled and a separate Issue defines its bounded scope.

Each item requires its own Issue, short branch, pull request, verification, and
squash merge. A production action requires the explicit approval and gate named
in `docs/deployment-ssot.md`.

## Local Windows patch workflow

The operator keeps the working clone at
`C:\Users\emotigom\PycharmProjects\AH_05_07` and downloads generated patches to
`C:\pj`.

Before applying an Issue patch in PowerShell:

```powershell
Set-Location C:\Users\emotigom\PycharmProjects\AH_05_07
git switch main
git pull --ff-only
git rev-parse HEAD
git status --short
git switch -c docs/146-g4-recovery-ssot
git apply --check C:\pj\AH_05_07-issue-146.patch
git apply C:\pj\AH_05_07-issue-146.patch
git diff --check
git status --short
```

For Issue #146, `git rev-parse HEAD` must equal
`61ee356e43eeb4f06120af870c4fc2b9ee5f9d41` and `git status --short` must be
empty before creating the branch. Stop if either check differs. Review the diff
before committing, then use a pull request and squash merge according to
`AGENTS.md`.

Future patch instructions must name their own baseline commit, filename, and
branch. Do not reuse the Issue #146 branch or apply a patch to an unknown base.

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
