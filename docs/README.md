# Documentation authority and lifecycle

Start with [AGENTS.md](../AGENTS.md), then choose the authority for the current
task below. [Project handoff](project-handoff.md#fast-start) provides restart
context. Read historical material only when the task needs its recorded evidence.

> A document appearing in GitHub/code search is not automatically current
> authority. Check its lifecycle in this map first; search ranking is not authority.

## Current authority map

Each document owns only its named boundary. This index routes readers; it does
not duplicate product contracts or attest to a deployed runtime.

| Boundary | CURRENT authority |
| --- | --- |
| Contribution / repository process | [AGENTS.md](../AGENTS.md) |
| Restart / handoff | [Project handoff](project-handoff.md#fast-start) |
| Product | [Requirements](requirements.md) |
| Architecture | [Architecture](architecture.md), [architecture invariants](architecture/ARCHITECTURE_INVARIANTS.md) |
| API | [API contract](api-contract.md); generated `/api/openapi.json` is the executable API authority |
| Authentication | [Auth contract](auth-contract.md) |
| Data | [Data contract](data-contract.md), [observation lifecycle](observation-data-lifecycle.md), [observation/challenge contract](observation-challenge-contract.md) |
| Model V2 | [Product contract](model-v2-product-contract.md#current-authority), [architecture invariants](architecture/ARCHITECTURE_INVARIANTS.md) |
| UX | [UX flow](ux-flow.md) |
| Visual / scene | [Scene policy](scene-policy-contract.md), [scene architecture](scene-architecture.md), [visual production contract](visual-production-contract.md), [companion runtime](companion-runtime.md) |
| Deployment | [Deployment SSOT](deployment-ssot.md), [release contract](architecture/RELEASE_CONTRACT.md) |
| Recovery | [Recovery contract](architecture/RECOVERY_CONTRACT.md) |

## Lifecycle

| Lifecycle | Meaning and retention |
| --- | --- |
| CURRENT | Defines current product, system, or operating decisions within its boundary; use the authority map above. |
| ACTIVE REFERENCE / RUNBOOK | Explanation or procedure used by current work; does not independently establish current product/runtime state. |
| EVIDENCE | Immutable observations for a particular SHA, date, environment and scope. Remaining on `main` never makes historical evidence current runtime proof. |
| RESEARCH | Research questions, experiments and results; not production authority. |
| ADR | Architecture decision history. Current architecture documents determine whether a decision still applies. |
| SUPERSEDED | Unused narrative/planning material without unique evidence or reproducibility value. Delete it from the current tree; Git history is its archive. |

[`evidence/`](evidence/), [`research/`](research/), and [`adr/`](adr/) are
**NOT CURRENT PRODUCT/RUNTIME AUTHORITY**. Preserve their unique evidence,
research and decision history without turning old status labels into a live queue.
Historical records outside these directories keep the same scope limits.

## Active references and runbooks

- [Structured feedback review](structured-feedback-review.md): current aggregate-only operator procedure.
- [AI toolchain](ai-toolchain-ssot.md): adopted tool roles and version routing; not Model V2 product/release status.
- [Scene release gates](scene-release-gates.md): scene-specific verification procedure.
- [API specification template](api-specification-template.md) and [requirements template](requirements-definition-template.md): retained by their current contracts.

Other references remain only for current use, unique evidence/research/ADR value,
or an executable tool/workflow dependency. Neither age, length, former importance
nor possible future interest is sufficient. A tool dependency preserves its
verification scope; it does not make a dated status current. No separate legacy
archive, document registry or mandatory frontmatter is needed.

Recover removed material when needed with `git log --all -- docs/<path>` and
`git show <recorded-sha>:docs/<path>`. Start new work from current `origin/main`
and the relevant authority, not a historical search hit.
