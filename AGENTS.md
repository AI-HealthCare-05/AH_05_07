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
  preprocessing, non-numeric output, and target-leakage prohibition.
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
- During development, run the smallest affected checks. Let final-candidate CI
  provide the repository-wide `lint` and `test` gate.
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

## Shared defaults

- Keep `main` runnable and merge through a PR with passing required `lint` and
  `test` checks. Prefer squash merge for a compact linear history.
- Preserve unrelated user changes. Do not clean, reset, stash, delete, or
  rewrite files merely to prepare a task.
- Reuse still-valid evidence within its exact scope. Never relabel historical,
  mock, simulator, or source-only evidence as current production proof.
