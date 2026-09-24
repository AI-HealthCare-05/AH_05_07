# SK7 project handoff

## Fast start

1. Run `git fetch origin` and resolve actual `origin/main` in the canonical
   `AI-HealthCare-05/AH_05_07` repository. A dated SHA or deployment mirror is
   not current source authority.
2. Read [AGENTS.md](../AGENTS.md) for repository process and protected boundaries.
3. Open the [documentation authority map](README.md).
4. Read only the CURRENT documents for the user's scoped request, plus directly
   relevant implementation/tests. Evidence, research and history are not a
   startup sequence.

## Current product baseline

- Living Journey: [UX flow](ux-flow.md).
- Model V2: [current product contract](model-v2-product-contract.md#current-authority).
- API/data/auth: [API](api-contract.md), [data](data-contract.md),
  [observation lifecycle](observation-data-lifecycle.md),
  [observation/challenge](observation-challenge-contract.md), [auth](auth-contract.md).
- Visual/scene: [scene policy](scene-policy-contract.md),
  [scene architecture](scene-architecture.md), [visual production](visual-production-contract.md),
  [companion runtime](companion-runtime.md).
- Production: [Deployment SSOT](deployment-ssot.md).

## Task routing

| Task | Relevant authority |
| --- | --- |
| Docs | [Authority map](README.md) and the affected document's named owner |
| Web | [Requirements](requirements.md), [UX](ux-flow.md), and the contract for the changed boundary |
| API | [API](api-contract.md), [auth](auth-contract.md), [architecture invariants](architecture/ARCHITECTURE_INVARIANTS.md) |
| DB | [Data](data-contract.md), [observation lifecycle](observation-data-lifecycle.md), [observation/challenge](observation-challenge-contract.md), [invariants](architecture/ARCHITECTURE_INVARIANTS.md) |
| Model V2 | [Product contract](model-v2-product-contract.md#current-authority), [invariants](architecture/ARCHITECTURE_INVARIANTS.md) |
| Scene/assets | [Scene policy](scene-policy-contract.md), [scene architecture](scene-architecture.md), [visual production](visual-production-contract.md), [companion runtime](companion-runtime.md) |
| Production | [Deployment SSOT](deployment-ssot.md#deployment-flow), [release](architecture/RELEASE_CONTRACT.md), [recovery](architecture/RECOVERY_CONTRACT.md) |

## Restart record

For long-running work, keep one concise record in the task's existing handoff
or PR. Reconcile it with live Git state before resuming:

- Branch/worktree and HEAD.
- Reviewed base.
- Owned paths, preserving unrelated changes.
- Completed checks, including environment and scope.
- Unfinished work.
- Blocker, if any.
- Next action.

Ensure referenced work and evidence are recoverable; chat history and temporary
paths alone are not durable storage. [AGENTS.md](../AGENTS.md) owns the policy.

## Historical rule

Old audit/checkpoint/`Next`/`PENDING`/`DISABLED` wording is not a live queue.
Use Git history, evidence and research only for a named need. Historical source,
Worker, API, model or verification status never proves today's runtime; follow
[Deployment SSOT](deployment-ssot.md) for release-time verification.

## Fresh-session task discovery

When a new agent or chat must recover work without relying on prior conversation
context, it may run the read-only helper below after the Fast start checks:

```bash
python3 scripts/git/resume_task_context.py
```

The helper reads live GitHub state with `gh`, gives open PRs first priority, and
only treats an Issue as a resumable task when that Issue explicitly contains an
`Agent resume` section. It never promotes an unclassified Issue merely because
it is open or old. If several candidates have equal authority, it reports the
ambiguity instead of choosing one.

A task Issue may opt in with this compact block:

```markdown
## Agent resume
- Status: `READY`
- Priority: `P1`
- Workstream: `Transcend`
- Blocked by: none
- Next action: Implement the next bounded W1 slice from the current authority.
```

Allowed Status values are `READY`, `ACTIVE`, `BLOCKED`, `REVIEW`, and `DONE`.
Priority is `P0` through `P3`. `Blocked by` accepts `none` or Issue references
such as `#123, #456`; an open referenced Issue keeps the task blocked. Keep this
metadata in the task Issue itself rather than in a second project ledger. Update
it only when the task state actually changes.

Use `python3 scripts/git/resume_task_context.py --json` when another tool or
agent needs a machine-readable snapshot. The helper is discovery-only: it does
not edit Issues, branches, PRs, labels, Projects, or repository files.
