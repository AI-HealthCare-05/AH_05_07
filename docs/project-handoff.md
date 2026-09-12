# SK7 project handoff and restart guide

## Fast start

This section is the restart index, not a mandatory reading chain. `AGENTS.md` is
the single authority for contribution policy, risk lanes, verification lifecycle,
and context lifecycle. Product, model, data, and release contracts remain
authoritative only for their own boundaries.

### Start with live state

- Canonical development/docs repository: `AI-HealthCare-05/AH_05_07`. Resolve
  current upstream `main`; a dated SHA or the deployment mirror is not current
  source authority.
- The user's scoped request is enough to start routine product work. A separate
  Issue is optional unless `AGENTS.md` classifies the diff as protected-boundary
  work or coordination needs a durable decision record.
- Completed audits are historical context, not startup work. Open only the named
  record when the current task depends on it.
- Issues #390 (scene qualification) and #396 (Model V2 displayability research)
  remain separate scopes. They do not gate unrelated UI, copy, or record-flow work.
- Old `Next`, `PENDING`, `DISABLED`, and W/M checkpoints below are dated evidence,
  not a live queue or an instruction to resume work.

### Read only the affected authority

| Change | Read before editing | Normal development check |
| --- | --- | --- |
| Documentation only | Affected document and its authority link | Diff/static checks; verify only changed relative links |
| Test-only | Affected test and the contract it exercises | Targeted test only; a build is not required by default |
| Web runtime source, including copy, CSS, semantic layout and presentation | Affected component and focused tests | Build plus directly affected tests |
| Scene or companion runtime | Affected component and [scene gates](scene-release-gates.md); read the manifest only when asset mapping changes | Build plus directly affected scene/companion tests; verify the manifest only when it changed, and use a physical spot-check only when the task needs it |
| Model input/result | [Model product boundary](model-v2-product-contract.md) and affected adapter/inference tests | Focused model/API/UI tests |
| API, auth, data, retention | Relevant domain contract and [invariants](architecture/ARCHITECTURE_INVARIANTS.md) | Focused tests plus required final CI |
| Release, mirror, migration, activation | [Deployment SSOT](deployment-ssot.md), [release contract](architecture/RELEASE_CONTRACT.md), and live control-plane state | Boundary-specific preflight and smoke |
| Historical investigation | Only the named dated evidence | No unrelated regression rerun |

### Keep the feedback loop proportional

- Routine work uses a coherent branch/PR without a required preliminary Issue,
  ADR, evidence ledger, screenshot pack, independent review, or full local suite.
- Run affected checks while iterating. The final PR retains required `lint` and
  `test`; specialized CI is routed by affected paths. Do not duplicate locally a
  broad suite owned by final-candidate CI. The complete browser/evidence matrix is
  not a routine PR default; use it for merged-`main`, release, or manual confidence
  work when its scope requires it.
- Protected boundaries keep their relevant Issue, contract, test, and operational
  evidence. An ADR is for a durable architecture decision, not every implementation.
- Reuse unchanged evidence within its exact scope. Do not create a second PR merely
  to turn a status word into `PASS` or duplicate facts already in the task/PR.
- Source merge, mirror sync, runtime deployment, scene activation, and migration are
  distinct. A docs-only change does not require mirror sync or deployment.
- Carry durable `INVARIANT` context forward. Drop a `TASK GUARD` when its task ends,
  retire a falsified `HYPOTHESIS`, and do not generalize `EVIDENCE` beyond its
  recorded SHA, environment, and scope. An incident is not permanent policy by
  default.
- Preserve unrelated local/user changes; do not clean, reset, stash, or rewrite them
  to prepare a task.

**Stop default startup reading here.** Continue below only for a named reference.

## Authority order

Authority is concern-specific. Use this order for contracts; use actual GitHub
state for source/Issue status and control-plane evidence for runtime status.
Dated snapshots are not competing current decisions. Record a material unresolved
conflict in the active task or PR; use an Issue when the `AGENTS.md` risk lane
requires it, not for every historical status:

1. `AGENTS.md` for safety, privacy, claim, and contribution boundaries.
2. `docs/requirements.md` and the domain contracts for accepted product scope.
3. The canonical architecture contracts: `docs/architecture/ARCHITECTURE_INVARIANTS.md`,
   `docs/architecture/TECHNICAL_DEPTH_PLAN.md`, `docs/architecture/WORKSTREAMS.md`,
   and `docs/architecture/RELEASE_CONTRACT.md`.
4. Migrations, generated OpenAPI, implementation, and automated tests for
   executable behavior.
5. `docs/deployment-ssot.md` for release topology and operator gates.
6. The GitHub Issue when required, plus the pull request and immutable commit.
7. The Notion 19-day roadmap as the execution mirror and presentation plan.

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

## HISTORICAL REFERENCE — NOT STARTUP POLICY

The fast-start section is the restart index. The material below preserves the
pre-audit/MVP handoff and its original evidence; it is not a current backlog or
production inventory. Current release evidence is owned by
[deployment SSOT](deployment-ssot.md); do not duplicate its runtime tuple here.
Checkpoint 0 and R1–R11 are complete per the technical depth plan. New work does
not require repeating their original cross-machine synchronization sequence.

The historical closeout-preparation authority is [MVP1 closeout](mvp1-closeout.md),
Issue #225. Its remaining conditions are now tracked by [Issue #238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238).
The 2026-09-06-and-earlier source snapshot and review package below are retained
as historical evidence only. [Upgrade execution](upgrade-execution.md) tracks the
separate usability, local reliability, model-design and original-character
workstreams. These historical source changes are not the current production
release.
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
| Historical model evidence / pre-S11 follow-up (2026-09-06 and earlier) | Preparation, comparison and exploratory uncertainty evidence published through PR #220; #217 implementation and #219 disclosure closed. #221 documentation completed via PR #222; #223 reviews input questions; no selected/released artifact in that historical checkpoint |
| Handoff reconciliation | Historical reconciliation completed through [PR #147](https://github.com/AI-HealthCare-05/AH_05_07/pull/147), merge `50039ee1604bf984aae99e945a798db13595862f`; [Issue #146](https://github.com/AI-HealthCare-05/AH_05_07/issues/146) is closed. Current workstreams are tracked in [upgrade execution](upgrade-execution.md). |
| Ownership verification | Issue #149: preflight plus approved synthetic A/B browser verification passed; anonymous denial, owner CRUD/export, cross-user non-disclosure, and first-check-in action lock passed; cleanup complete |
| Rollback evidence | Issue #151: rollback to `38bb08b6-66ca-4933-8cbe-ee857aa4ece7` and restore to `6d100754-7e85-4d43-b466-e7944c61a0c0` both passed public smoke |
| UI production handoff | Issue #190 implements the Calm Clay Journey tokens, copy, motion limits, and S01–S14 screen structure. Issue #192 responsive QA passed at `1366 × 768`, `390 × 844`, and `320 × 844` with reduced motion. R2 `visual/v1/` delivery exists after Issue #196, but Issue #200 restored the app to CSS-first rendering after the initial runtime binding caused responsive regression. |

The table above is a historical handoff snapshot; its pre-S11 model row is not
current release authority. The current S11 source, product connection, and
runtime evidence are the records named in the current checkpoint and
`docs/deployment-ssot.md`. At every restart, resolve the current upstream
`main` SHA and recent merged pull requests before treating any source commit as
current.

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

The historical pre-S11 checkpoint recorded the risk-signal UI as unreleased and
the model release gate as incomplete. That dated state is superseded for the
current S11 product path by the deployment and release records named above; the
older evidence remains available in `docs/model-comparison-evidence.md` and the
related model reports.

## Historical open evidence and former priorities

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
   client's decision on load conditions and acceptance. The source change is merged;
   its local measurement does not establish production P95.
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
4. Preserve the pre-S11 model-development evidence when reviewing model history.
   Issue #204 freezes the selected tools, internal pipeline, deferred
   alternatives, and change-control contract. Issue #206 defines the external
   local seven-module audit, derived-table, frozen-split, and sanitized-evidence
   sequence. Issue #208's Windows operator report and user-approved evidence
   remain in `docs/model-gate-1b-evidence.md`, and the historical comparison
   reports remain in `docs/model-comparison-evidence.md`. Those pre-S11 research
   records do not override the current S11 release contract; use
   `docs/deployment-ssot.md` and `docs/architecture/RELEASE_CONTRACT.md` for
   current artifact and runtime status.
5. Consider a distinct future asynchronous assessment architecture only if a
   separate ADR and explicit product/data contract document a measured latency,
   duration, or reliability trigger. Its persistence rules must remain outside
   the frozen Model V2 boundary. Do not add Redis or a worker merely to mirror a
   reference architecture. OCR, prescription/medical-document handling, and
   LLM guidance are outside SK7 scope.

The representative Cloud Run requests-log review is complete under Issue #166:
after a synthetic signed-in refresh, the operator reviewed the bounded
production request-metadata list and found no secret, user identifier, request
body, or health value. No raw log output is retained.

These historical items used one Issue per item. Current work follows the
risk-based policy in `AGENTS.md`; this paragraph does not impose a new Issue on
routine work. A production action still requires the explicit approval and gate
named in `docs/deployment-ssot.md`.

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

## Historical restart checklist (superseded)

The checklist below describes the earlier audit phase. For current work, stop at
[Fast start](#fast-start) and use the `AGENTS.md` risk lane. Do not execute this
list as a default startup sequence.

1. Earlier sessions read `AGENTS.md`, this file, `docs/requirements.md`,
   `docs/acceptance-test-plan.md`, the canonical architecture contracts
   (`docs/architecture/ARCHITECTURE_INVARIANTS.md`,
   `docs/architecture/TECHNICAL_DEPTH_PLAN.md`,
   `docs/architecture/WORKSTREAMS.md`, and
   `docs/architecture/RELEASE_CONTRACT.md`), and `docs/deployment-ssot.md`.
2. Read the current Notion 19-day roadmap, then treat any mismatch as work to
   reconcile rather than as permission to change code.
3. Confirm the latest upstream `main` SHA and recent merged PRs.
4. Earlier sessions confirmed one Issue, short branch and PR per workstream. Reconcile
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
translation and measurement equivalence remain pending for that historical question-review scope. The current frozen Model V2 product path is separately connected at `/api/v1/model-v2/product-score`; it returns only the schema version and `입력 기반 위험군 선별 신호`. See [architecture invariants](architecture/ARCHITECTURE_INVARIANTS.md) and [release contract](architecture/RELEASE_CONTRACT.md). The legacy `/api/v1/risk-signal` scaffold remains `model_not_ready`.
