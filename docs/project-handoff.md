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
