# Project authority map

Curated from source-grounded records pinned to `6f163c33bf11193f0322c0377ff9463567b361b4`.

| Boundary | Current authority | Lifecycle | Protects |
| --- | --- | --- | --- |
| `governance` | [Repository contribution and protected-boundary rules](../../../../AGENTS.md) | `current` | protected product boundaries, checkpoint and attribution rules |
| `policy` | [Documentation authority and lifecycle map](../../../../docs/README.md) | `current` | named document boundaries, CURRENT versus EVIDENCE lifecycle |
| `architecture` | [System architecture](../../../../docs/architecture.md) | `current` | modular monolith boundary, API and data layering |
| `architecture` | [Architecture invariants](../../../../docs/architecture/ARCHITECTURE_INVARIANTS.md) | `current` | auth/RLS/retention, Model V2 frozen boundary, request/session guards |
| `product` | [Product requirements](../../../../docs/requirements.md) | `current` | product scope, input-based risk-group screening signal wording |
| `model` | [Model V2 product contract](../../../../docs/model-v2-product-contract.md) | `current` | frozen Model V2 artifact, 11-feature order and preprocessing, target-leakage prohibition |
| `api` | [API contract](../../../../docs/api-contract.md) | `current` | API semantics, request and uncertain-write protections |
| `auth` | [Authentication contract](../../../../docs/auth-contract.md) | `current` | authentication semantics, session ownership |
| `data` | [Data contract](../../../../docs/data-contract.md) | `current` | fact separation, retention and account deletion |
| `database` | [Observation data lifecycle](../../../../docs/observation-data-lifecycle.md) | `current` | retention, deletion, observation ownership |
| `journey` | [Living Journey UX flow](../../../../docs/ux-flow.md) | `current` | journey states, user-facing fact separation |
| `visual` | [Scene policy contract](../../../../docs/scene-policy-contract.md) | `current` | scene policy, runtime boundary |
| `assets` | [Visual production contract](../../../../docs/visual-production-contract.md) | `current` | asset production gates, visual acceptance boundary |
| `companion` | [Companion runtime](../../../../docs/companion-runtime.md) | `current` | companion behavior boundary, scene lifecycle |
| `deployment` | [Deployment SSOT](../../../../docs/deployment-ssot.md) | `current` | deployment flow, runtime release state |
| `release` | [Release contract](../../../../docs/architecture/RELEASE_CONTRACT.md) | `current` | release gates, rollback boundary |
| `research` | [Transcend program](../../../../docs/transcend/PROGRAM.md) | `current` | Transcend scope, experimental boundary |
| `research` | [Transcend W1 playable slice contract](../../../../docs/transcend/W1.md) | `current` | W1 acceptance, experimental runtime boundary |
| `governance` | [Project handoff](../../../../docs/project-handoff.md) | `current` | restart source-of-truth, live Git reconciliation |
| `data` | [Seven-day observation and challenge contract](../../../../docs/observation-challenge-contract.md) | `current` | observation/challenge fact separation, non-causal health semantics |
| `visual` | [Scene architecture](../../../../docs/scene-architecture.md) | `current` | semantic UI versus decorative scene ownership, scene runtime lifecycle |
| `operations` | [Recovery contract](../../../../docs/architecture/RECOVERY_CONTRACT.md) | `current` | runtime rollback versus data recovery separation, explicit recovery uncertainty |

Historical, research and evidence records remain traceable in `evidence-index.json`; they do not establish live runtime state.
