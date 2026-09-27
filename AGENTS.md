# SK7 Repository Operating Contract

This file is the sole repository-workflow authority. Normal task startup is:

1. Root `AGENTS.md`.
2. The task's GitHub Issue.
3. Only the domain contract, code and tests relevant to the changed boundary.

GitHub Issue/PR/Git carry live task and release state. Live Git/process state
outranks chat memory. Historical evidence is read only for a named need;
Git history is the archive for deleted material. Do not create workflow,
current-state, handoff, checkpoint or authority registries.

Search/index/history hits are discovery hints, not current authority. Before use,
verify the path exists at the task ref and read that exact ref. Deleted paths,
older-SHA hits and closed Issues supply no current gates unless the current Issue
explicitly names them for a specific need.

Canonical source: `AI-HealthCare-05/AH_05_07`. The
`emotigom/ah-05-07-pages` deployment mirror is not development authority.

## Task flow and local execution

- Create an Issue before repository mutation. Work from current `origin/main`
  in one isolated short task branch/worktree; preserve unrelated work and keep
  one writer per worktree. Do not reset, clean, stash or rewrite unrelated changes.
- Normal routine local work uses ChatGPT Work Local + Repo Operator.
  Remote Desktop Commander is not part of the default workflow; Codex is escalation only.
- Accumulate coherent, locally checked commits; open a PR linked to the Issue.
  Merge when conflict-free and required hosted `lint` and `test` pass.
  The authorized agent may squash-merge or enable auto-merge; human review/merge
  is not a default gate. The owner may interrupt, narrow or stop work at any time.
- Keep `main` runnable. Delete the merged task branch and retire its unused
  worktree. Do not replay a post-merge matrix or wait for deployment as a merge gate.
- If interrupted, record unfinished paths, branch/worktree, HEAD/base, completed
  checks and next action/blocker in the existing Issue or PR. Do not add a ledger.
- Use `scripts/git/codex-commit` for Codex-contributed commits. Keep exactly one
  `Co-authored-by: Codex <noreply@openai.com>` trailer in the final squash commit,
  removing repeated constituent trailers from the generated squash body.

## Protected product boundaries

- Use `입력 기반 위험군 선별 신호`; never diagnosis, treatment, prevention,
  or causal-improvement language.
- Do not store real clinical records, names, contacts, original documents,
  free-text medical histories, credentials or raw production output.
- Keep model output, measured blood pressure and challenge participation separate.
- Preserve authentication, session and RLS/ownership, retention, account deletion,
  request/session/uncertain-write protections and secret boundaries.
- Preserve the frozen Model V2 artifact, schema, 11-feature order, preprocessing
  and target-leakage prohibition. User-visible output follows
  [the Model V2 product contract](docs/model-v2-product-contract.md), including its
  time-boxed research/development preview.
- Preserve architecture invariants and the distinction between runtime rollback,
  schema reconstruction and data recovery.
- Do not add an LLM, OCR, Redis, worker, new server or deployment topology without
  a measured requirement and an ADR.

## Verification and scope classification

- Verify in proportion to changed behavior/contract. Run the smallest affected
  checks; redirect verbose passing logs to `/tmp` and report concise results.
  Lint and formatter checks are separate gates.
- Before publishing, inspect all changed paths and the meaningful diff; run
  `git diff --check` and `python3 scripts/git/autopilot_guard.py --base origin/main`.
  Before generated edits/recovery, verify the reviewed SHA, branch/worktree state,
  dirty-path ownership and all required anchors; failed preflight makes no writes.
- The guard classifies scope, not merge authority: `routine` is ordinary UI/docs/
  tests/tooling; `protected` includes backend/auth/data/model/dependency/governance/CI;
  `deny` covers secret/credential containers or explicitly forbidden paths. Stop
  on denied scope; do not weaken the guard. The current request plus Issue
  authorizes scoped governance/workflow changes without another approval ledger.
- Required hosted `lint`/`test` are path-aware; keep heavier payloads for affected
  backend/auth/data/model boundaries. Skipped/unrouted suites are not PASS.
- Do not replay unchanged auth/data/persistence/default-home/user-flow checks just
  because another release occurred. Prior owner/operator evidence may be reused
  for unchanged contracts only within its original scope.
- Broad matrices, audits and evidence refreshes are milestone/decision tools,
  not default release gates. Browser E2E is schedule/manual confidence; trusted
  local runners are manual tools. Neither is a routine merge gate.

## Publication and release evidence

- Merge is not deployment authorization. The human owner controls mirror-to-
  Cloudflare publication by default. Agents may publish only with explicit
  authorization in the CURRENT task; prior release permission is not standing authority.
  Destructive DB operations, credential changes and irreversible external effects
  also need explicit current-task authorization.
- For authorized presentation/web-only releases that leave Auth/API/DB/RLS/
  persistence/default-home semantics unchanged, default verification is exact
  source classification, a compatible rollback identity captured before mutation,
  one public deployment smoke and focused changed-surface sanity when decision-relevant.
  Require signed-in replay only when that behavior changed or the owner asks.
- Classify DB/API/web effects separately. Source, build and runtime are distinct
  facts; read current runtime from live control planes. Operational steps are in
  [deployment](docs/deployment.md); docs-only work performs no production deployment.
- A sanitized release Issue may suffice as evidence. A docs evidence PR is not
  required by default. Old Issue gates never propagate automatically to later releases.
