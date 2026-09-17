# Repository rules

## Fast start

Canonical source: `AI-HealthCare-05/AH_05_07`. Copies in
`emotigom/ah-05-07-pages` are deployment snapshots, not a second development
authority. Start from current upstream `main`, this file, and the user's scoped
request. Read [project handoff](docs/project-handoff.md#fast-start) and only the
contract or tests for the boundary being changed. Historical ledgers, completed
audits, and unrelated evidence are not startup requirements.

## Protected product boundaries

- Use `입력 기반 위험군 선별 신호`; never diagnosis, treatment, prevention,
  or causal-improvement language.
- Do not store real clinical records, names, contacts, original documents,
  free-text medical histories, credentials, or raw production output.
- Keep model output, measured blood pressure, and challenge participation as
  separate facts.
- Preserve authentication, RLS/ownership, retention, account deletion,
  request/session/uncertain-write protections, and secret boundaries.
- Preserve the frozen Model V2 artifact, schema, 11-feature order,
  preprocessing, and target-leakage prohibition. User-visible Model V2 output
  follows `docs/model-v2-product-contract.md`, including its time-boxed
  research/development preview.
- Do not add an LLM, OCR, Redis, worker, new server, or deployment topology
  without a measured requirement and an ADR.

## Risk-based change policy

Use the lightest lane that matches the actual diff. When uncertain, use the
protected-boundary lane.

### Routine product lane

For copy, CSS, semantic layout, presentation components, tests, tooling, and
docs that do not alter a protected boundary:

- An Issue is optional. The user's request and PR body may be the task record.
- Use one coherent short branch and PR; do not split work by screen or create
  paperwork-only follow-up PRs.
- During development, run the smallest affected checks. Final-candidate CI keeps
  the required named `lint` and `test` merge gates, but their payload is
  path-aware: frontend/docs lanes may satisfy them with lightweight routing while
  backend/protected/unknown changes keep the full Python/AI/MySQL payload.
- Do not create an ADR, evidence document, deployment record, screenshot set,
  or full-matrix rerun unless it proves behavior changed by this diff.

### Protected-boundary lane

For API or database semantics, auth/RLS/retention, write/session guards,
Model V2 contracts or artifacts, secrets, production activation/deployment,
or a new dependency/topology:

- Use an Issue, a short branch, a PR, and the directly relevant contract/tests.
- Add an ADR only for a new architectural dependency/topology or another
  durable decision with meaningful alternatives.
- Record deployment/rollback evidence only when runtime state actually changes.

### Verification lifecycle

- PR/local verification selects the smallest affected checks: docs-only uses
  diff/static checks, test-only uses its targeted test, web runtime source uses
  a build plus directly related tests, and scene/companion runtime uses its
  directly related scene test plus a physical spot-check only when needed. The
  full browser matrix is skipped by default.
- Routine App shell / presentation wiring does not by itself imply backend
  Python/AI/MySQL verification; protected auth/API/data/model/dependency/deployment
  paths still escalate to the full lane. Browser CI is concern-routed; Model V2
  cross-browser coverage is not a generic UI tax.
- For AI-assisted local verification, redirect verbose passing test/build logs to
  `/tmp` and surface only result summaries or focused failure excerpts. Do not feed
  line-by-line passing Playwright output into model context.
- Required PR/core CI owns merge-time regression. Do not replay the complete
  browser matrix after every `main` merge; scheduled nightly or explicit manual
  Browser E2E owns broad browser confidence. Classify a red scheduled/manual run
  as product regression, test-contract mismatch, or transient rather than
  turning every routine change into a release exercise.
- Release verification may explicitly run the full browser matrix and required
  physical device gates. Do not require release evidence for a routine PR.
- `INVARIANT` is a durable product/security/health contract. `TASK GUARD` is
  current-task-only and must not carry forward. `HYPOTHESIS` is experimental and
  expires when falsified. `EVIDENCE` is valid only for its recorded SHA,
  environment, and scope.
- An incident becomes a durable rule only with reusable value, a clear scope,
  and human review. Completed audits, expired hypotheses, and old thresholds are
  not startup requirements for a new task.

## Autonomous execution lane

Hands-off AI development uses the existing repository controls instead of adding
a second orchestration stack. Do not add a tunnel, persistent writer daemon, or
new deployment service for routine autonomous work. See
[Autopilot Lite](docs/autopilot-lite.md) for the operator workflow.

- Work from current `origin/main` in an isolated Git worktree and a short task
  branch. Preserve unrelated worktrees and user changes.
- Before publishing an autonomously prepared change, run
  `python3 scripts/git/autopilot_guard.py --base origin/main`. The guard is a
  classification aid; the stricter `--require-routine` mode is required before
  an agent enables auto-merge.
- A `routine` result may be published as a PR and may request squash auto-merge
  only after the existing required checks pass and review threads are resolved.
- A `protected` result may be implemented, tested, and published as a PR, but an
  autonomous agent must not enable auto-merge or merge it. Human approval is the
  final gate.
- A `deny` result must not be published from the autonomous lane. Governance,
  workflow, credential, and guard files are intentionally outside hands-off
  self-modification.
- GitHub-hosted required PR/core CI remains the merge gate. The scheduled/manual
  full Browser E2E matrix is broad confidence and release coverage, not a routine
  merge prerequisite. Persistent self-hosted runners remain manual trusted
  verification only and are not the default autonomous merge path.

## Shared defaults

- Keep `main` runnable and merge through a PR with passing required `lint` and
  `test` checks. Prefer squash merge for a compact linear history.
- Preserve unrelated user changes. Do not clean, reset, stash, delete, or
  rewrite files merely to prepare a task.
- Reuse still-valid evidence within its exact scope. Never relabel historical,
  mock, simulator, or source-only evidence as current production proof.

- When Codex materially contributes to a commit, create that commit with
  `scripts/git/codex-commit` instead of invoking `git commit` directly.
  The resulting commit message must contain exactly one
  `Co-authored-by: Codex <noreply@openai.com>` trailer.
- Do not rewrite already-published history solely to add Codex attribution.
- When a Codex-authored branch is squash-merged, GitHub may copy each
  constituent commit's `Co-authored-by: Codex <noreply@openai.com>` trailer
  into the generated squash body. Remove those repeated constituent trailers
  before merging, then keep exactly one final
  `Co-authored-by: Codex <noreply@openai.com>` trailer at the end of the squash
  commit message so attribution survives on `main`.