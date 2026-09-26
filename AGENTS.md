# SK7 Repository Operating Contract

This file is the sole repository-workflow authority for SK7.
Historical evidence, handoffs, completed audits, and design notes are not workflow SSOT.
Domain contracts remain authoritative only for the product boundary they define.

Canonical development repository: `AI-HealthCare-05/AH_05_07`.
The `emotigom/ah-05-07-pages` mirror is a deployment snapshot controlled by the human owner, not a development authority.

## Default task flow

1. Create a GitHub Issue for every requested task before repository mutation.
2. Start from current `origin/main` in a short task branch/worktree linked to that Issue.
3. Commit as often as useful. Prefer coherent, locally checked commits; there is no target commit count.
4. Open a PR when the task is reviewable. The PR must reference or close its Issue.
5. Merge as soon as the PR is conflict-free and the required hosted `lint` and `test` checks pass.
6. Human review or human merge is not a default gate. The authorized agent may enable auto-merge or squash-merge directly.
7. Delete the merged task branch. Do not rerun a post-merge full matrix by default.

The human owner is continuously observing and may interrupt, narrow, or stop any task.

## Merge and deployment are separate

A merged PR is not authorization for an external production side effect.
The agent does not trigger, wait for, or verify the personal mirror / Cloudflare build or deployment unless the user explicitly requests that as a separate task.
The human owner controls mirror-to-Cloudflare publication.

Do not use Cloudflare build status, a post-merge main matrix, scheduled browser confidence, or a manual trusted-runner job as a routine merge gate.

## Protected product boundaries

- Use `입력 기반 위험군 선별 신호`; never diagnosis, treatment, prevention, or causal-improvement language.
- Do not store real clinical records, names, contacts, original documents, free-text medical histories, credentials, or raw production output.
- Keep model output, measured blood pressure, and challenge participation as separate facts.
- Preserve authentication, RLS/ownership, retention, account deletion, request/session/uncertain-write protections, and secret boundaries.
- Preserve the frozen Model V2 artifact, schema, 11-feature order, preprocessing, and target-leakage prohibition.
- Do not add an LLM, OCR, Redis, worker, new server, or deployment topology without a measured requirement and an ADR.

Protected-boundary code may still follow the normal Issue -> branch -> PR -> agent merge flow.
Actual destructive database operations, production activation/deployment, credential changes, or other irreversible external effects require explicit current-task authorization before execution.
Merging code alone does not perform those effects.

## Verification

During development, run the smallest checks that directly cover the diff.
Before PR publication, run `git diff --check`, the affected local checks, and `python3 scripts/git/autopilot_guard.py --base origin/main`.

GitHub merge-time CI is intentionally small:
- required `lint`
- required `test`

Those checks remain path-aware. Backend/auth/data/model changes may route to heavier payloads; routine frontend/docs changes should not inherit unrelated Python/AI/MySQL work.

Broad Browser E2E is schedule/manual confidence only, not a PR or main merge gate.
Trusted local runners are manual tools only.
Do not replay the complete browser matrix after merge.

## Risk classification

The autopilot guard is a scope classifier, not merge authorization.

- `routine`: ordinary UI/docs/tests/tooling changes.
- `protected`: product contracts, backend/auth/data/model/dependency/governance/CI changes. These may still be merged by the authorized agent after required checks pass.
- `deny`: tracked secret/credential containers or another explicitly forbidden path. Stop and ask rather than weakening the guard.

A current user request plus its Issue is the authorization record for governance/workflow changes.
Do not create a second approval ledger.

## Restart and continuity

The durable restart record is intentionally small:
- Issue number
- branch/worktree
- HEAD and base
- unfinished task-owned paths
- checks already run
- next action or blocker

Use one concise handoff only when a task outlives the session.
On restart, live Git/process state outranks chat memory or an old handoff.
Do not replay completed external effects merely because a previous room forgot them.

## No workflow-SSOT sprawl

Do not create new workflow policy files or mandatory evidence ledgers.
This file defines repository workflow.
`docs/autopilot-lite.md` is explanatory only.
`docs/project-handoff.md` is project context only.
Domain contracts/tests define their own product semantics; historical evidence stays historical.

## Shared defaults

Keep `main` runnable and merge through PRs.
Prefer squash merge for compact main history while allowing many useful branch commits.
Preserve unrelated user changes; do not reset, clean, stash, or rewrite unrelated work.

When Codex materially contributes to a commit, keep exactly one
`Co-authored-by: Codex <noreply@openai.com>` trailer in the final main commit.
