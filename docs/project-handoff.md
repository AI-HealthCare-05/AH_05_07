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

The current closeout authority is [MVP1 closeout](mvp1-closeout.md), Issue #225.
The upgrade baseline is `c46c772486a30319e594dbb9cf555263d5fba1a9` (PR #227),
confirmed against origin/main. Status: in progress. The seven-slide PPTX/PDF and
4:21 silent-caption MP4 review package are preserved; submission acceptance,
operations and model/input approvals remain pending. [Upgrade execution](upgrade-execution.md)
tracks the separate usability, local reliability, model-design and original-character
workstreams and their review PRs. These changes are not a production release.
#213 is closed for PR #214's implementation scope only. The user's question-screen
operation/display review and language polishing do not approve semantics, an adapter
or a model. Historical deployment rows below remain evidence for their stated
versions, not this source SHA's deployment.

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
| AI toolchain authority | `docs/ai-toolchain-ssot.md`, ADR-0002, and exact versions in `uv.lock` |
| Model evidence / current follow-up | Preparation, comparison and exploratory uncertainty evidence published through PR #220; #217 implementation and #219 disclosure closed. #221 documentation completed via PR #222; #223 reviews input questions; no selected/released artifact |
| Handoff reconciliation | Historical reconciliation completed through [PR #147](https://github.com/AI-HealthCare-05/AH_05_07/pull/147), merge `50039ee1604bf984aae99e945a798db13595862f`; [Issue #146](https://github.com/AI-HealthCare-05/AH_05_07/issues/146) is closed. Current workstreams are tracked in [upgrade execution](upgrade-execution.md). |
| Ownership verification | Issue #149: preflight plus approved synthetic A/B browser verification passed; anonymous denial, owner CRUD/export, cross-user non-disclosure, and first-check-in action lock passed; cleanup complete |
| Rollback evidence | Issue #151: rollback to `38bb08b6-66ca-4933-8cbe-ee857aa4ece7` and restore to `6d100754-7e85-4d43-b466-e7944c61a0c0` both passed public smoke |
| UI production handoff | Issue #190 implements the Calm Clay Journey tokens, copy, motion limits, and S01–S14 screen structure. Issue #192 responsive QA passed at `1366 × 768`, `390 × 844`, and `320 × 844` with reduced motion. R2 `visual/v1/` delivery exists after Issue #196, but Issue #200 restored the app to CSS-first rendering after the initial runtime binding caused responsive regression. |

Non-model deployment rows retain the historical handoff snapshot; the model row
is updated through PR #222 and the Issue #223 question review package. At every restart,
resolve the current upstream `main` SHA and recent merged pull requests before
treating any source commit as current.

Issue #143 records a passed public web/API/CORS smoke, magic-link sign-in and
session refresh, and a clean browser console/network review for the G4 web
rollout. It records no Cloud Run deployment, Supabase migration, or production
record write.

At Issue #143, the Worker version was recorded as
`38bb08b6-66ca-4933-8cbe-ee857aa4ece7`. The short value `38bb08b6` did not
establish a distinct rollback target. [Issue #151](https://github.com/AI-HealthCare-05/AH_05_07/issues/151)
subsequently completed rollback, restore and public smoke for the two full
versions in the table above. That historical rehearsal does not prove deployment
of the upgrade baseline; [O3 clean-release rehearsal](mvp1-operations-review.md)
and the remaining Gate C evidence still require separate approval and execution.

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
- CSS-first Calm Clay Journey shell with S01–S14 semantic screen states,
  safe URL/back-forward navigation, separate fact lanes, and reduced-motion
  fallbacks. The responsive CSS implementation passed the synthetic-only
  `1366 × 768`, `390 × 844`, `320 × 844`, and reduced-motion visual QA gate.
- Read-only Canva source selection in `docs/asset-register.md`: shared desktop
  and mobile backgrounds, identity, and decorative characters are approved
  source candidates; full-screen and utility PNGs are explicitly not runtime
  assets because copy and state must remain semantic HTML/CSS.
- Dependency-free secret-boundary and public deployment-smoke verification.
- Bounded model-development tooling: pandas and PyArrow for local tabular data,
  scikit-learn for the two contracted classical models and evaluation, and
  joblib for artifact serialization. CI rejects silent dependency drift; exact
  resolved versions remain in `uv.lock`.

The risk-signal UI remains unreleased. Frozen split/leakage evidence and approved
internal validation aggregates now exist, but quality acceptance, external
validation, verified artifact/metadata, input adapter and release repeatability
remain incomplete. See `docs/model-comparison-evidence.md` for limitations.

## Open evidence and next priority

1. The [sanitized email-link and new-tab verification checklist](email-link-session-verification.md)
   passed for its three intended signed-in session steps under Issue #182:
   2026-09-04, Chrome, email-link sign-in, reload, and same-browser new tab.
   Expired/invalid-session recovery was not run and was not forced. Issue #169
   covered browser validation, session recovery, and initial-load failure;
   Issue #172 covered blocked duplicate save, uncertain-save guidance, and
   stale refresh; Issue #174 covers current owned check-in status edit plus
   explicit cancellation and confirmation before deletion; Issue #176 covers
   normalized storage-unavailable recovery; Issue #178 adds one shared
   eight-second browser request timeout, preserved draft, and no automatic
   retry. No real account, JWT, operational record, API, database, or
   deployment is involved.
2. Review the separate local API evidence in [PR #235](https://github.com/AI-HealthCare-05/AH_05_07/pull/235):
   489 timed synthetic responses, fixed endpoint phases, cold/warm/concurrency and
   quantile definitions, plus owned-environment cleanup. Its measurement window
   includes disclosed software WebGL overlap. This expands beyond the historical
   small manual UI sample; it does not establish production P95 or replace the
   client's decision on load conditions and acceptance. The PR remains unmerged.
3. Issues #184–#188 add evaluator-facing seven-day dashboard, range, browse,
   and focused-detail evidence: BP,
   challenge adherence, legacy records, and the not-ready risk-signal state
   remain distinct. Issue #190 maps those contracts to the Calm Clay Journey
   S01–S14 application shell without changing the API, database, ownership,
   authentication, or model boundary. Issue #192 passed responsive visual QA
   and Issue #194 records selected Canva sources only. Issue #196 added the
   local derivative-staging gate; R2 `visual/v1/` now contains the reviewed
   release objects and manifest. Issue #198's first runtime binding was
   reverted by Issue #200 because it caused responsive regression. CSS-first
   rendering is the current production contract; any new binding needs a
   separate visual review and responsive evidence. A verified model fact
   remains separate follow-up work; do not use causal-improvement language.
4. Follow `docs/ai-toolchain-ssot.md` when starting the risk-signal release
   gate. Issue #204 freezes the selected tools, internal pipeline, deferred
   alternatives, and change-control contract. Issue #206 defines the external
   local seven-module audit, derived-table, frozen-split, and sanitized-evidence
   sequence. Issue #208 now has a Windows operator report and user-approved
   evidence in `docs/model-gate-1b-evidence.md`; its evidence PR #212 is merged. The later actual comparison report is in
   `docs/model-comparison-evidence.md`; promotion remains unperformed. The release gate starts
   only after the operational evidence above is
   reconciled and a separate Issue defines its bounded scope. The gate needs
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
4. Confirm one Issue, short branch and PR per substantive workstream. Reconcile
   and preserve each worktree's saved changes, following the user-authorized
   parallel plan in [upgrade execution](upgrade-execution.md).
5. Inspect the latest relevant deployment run only when the next task concerns
   runtime state.
6. Choose the highest open P0 evidence item, create or confirm its Issue, and
   state the production boundary before editing.
7. After merge, update this checkpoint, the affected domain documents,
   deployment SSOT when applicable, and Notion with the same evidence-backed
   result.

Never infer completion from an old chat summary. Use immutable commits, Issues,
test results, and sanitized release records.
# #192–#194 visual QA and source-selection gates

The Calm Clay Journey has an executable viewport/reduced-motion check and a
synthetic-only manual capture runbook. The manual `1366 × 768`, `390 × 844`,
`320 × 844`, and reduced-motion evidence passed on 2026-09-05. Issue #194 then
reviewed Canva sources read-only and registered approved, replaceable, and
not-used sets. Issue #196 later staged the approved derivatives and the R2 v1
delivery was completed outside the repository. The first app binding was
reverted in Issue #200 after responsive review, so the current UI remains
CSS-first.

## Preparation version 2 and approved operational evidence

Base reviewed: `20f23f7597ceb812170f6582fd6f5011cb5ec654`.
Issue #208 is closed as the completed operational data-preparation task. Its initial
filename list predates #209; the current manifest/runbook has the corrected
`P_` names. Do not close #208 on the strength of this prerequisite patch.

The version 2 patch adds explicit data semantics, BP-completeness exclusions,
train-only/type-aware preprocessing, manifest ratios, and a single Python
operator entry point with two-run digest comparison. See ADR-0003 and
`docs/data-feature-semantics.md`. The unsafe legacy API feature mapping is
removed; an artifact configuration cannot enable the unreleased questionnaire.

Historical synthetic verification is recorded in `docs/data-preparation-verification.md`.
PRs #210 and #211 are merged. The subsequent Windows actual preparation report,
independent local hash checks and user-approved public JSON are recorded in
`docs/model-gate-1b-evidence.md`. The execution commit remains
`cb3a3f06d7378fe4d526abd66275af1e2fb5c7ad`, with 7,944 total rows and
5,560/1,192/1,192 train/validation/test rows. Both runs matched; LF manifest/lock
hashes match Git blobs. Committed-evidence CI validates JSON without source data.
Issue #208 is closed after PR #212 merge. The subsequent train/validation
comparison is reported in `docs/model-comparison-evidence.md`; promotion and
deployment remain unperformed. Preserve previous
raw files and outputs; a new execution must always generate new evidence.

## Gate 1B closure and next implementation

PR #212 merged at `04ab996ba68c852fdf3f47ca94101294bd849f00`; its Windows/Linux
committed-evidence and synthetic checks plus general CI all passed. All #208
preparation/publication conditions were confirmed and the Issue was closed on
user instruction. The
approved evidence remains unchanged and `prepared_not_trained`, not model complete.
Issue #213 implements the bounded synthetic-tested train/validation comparison
path in `docs/model-comparison-runbook.md`; PR #214 is merged and its CI passed.
Issue #215 separately publishes approved actual validation aggregates. Status:
validation_compared_not_promoted. See `docs/model-comparison-evidence.md` for the
older-age AUROC, low-bin underprediction and subgroup regressions. The separate
uncertainty report now supplies exploratory conditional intervals; external/Korean
validity remains unestablished. No test evaluation,
serialization, promotion, adapter/UI change or deployment is claimed.

## Current model evidence and release contract

Implementation #217 is complete through PR #218, merged at
`65ec302886cd6bcf288194ad2e2b6639e6f867a1`, with Windows/Linux synthetic CI passing.
The separately approved local uncertainty execution succeeded at that commit.
Publication #219 is complete through PR #220, merged at
`64aca180aab940a731c322fcf22693a5ec58d756`, with all 14 CI checks passing.
Both Issues are closed for their own scopes, not all model validation or release.
Prior comparison publication #215 remains complete via PR #216
(`b77f2ce3c81c620dcef4074fca60faaa88a8b5e7`). Approved JSON and execution records
are preserved in the [comparison](model-comparison-evidence.md) and
[uncertainty](model-uncertainty-evidence.md) reports.

Exploratory conditional intervals now exist: overall AP improvement is supported,
while overall AUROC/Brier difference intervals include zero. The status remains
`exploratory_uncertainty_not_promoted`. These pointwise intervals do not establish
training stability, multiplicity control, NHANES survey inference or Korean-user
validity. JSON verifier checks do not independently recalculate real-prediction
intervals. Older-age performance, calibration, external/Korean validation and
explicit release criteria remain unresolved.

Issue #221 completed its documentation scope in PR #222: [draft model card](model-card.md),
[unsupported input mappings and question drafts](model-input-adapter-contract.md),
and [readiness matrix and proposed one-time test procedure](model-release-readiness.md)
requiring separate approval.
Named reviewers, supported population, justified quality criteria, final model,
preprocessing and signal thresholds are not yet approved. No actual model/test
execution or product change is part of the question review package. Issue #223 adds
[CDC source comparison and a synthetic-only local review screen](input-question-review.md);
translation, measurement equivalence and adapter support remain pending. The API remains
model_not_ready; evidence, CONFIGs and lock are unchanged.
