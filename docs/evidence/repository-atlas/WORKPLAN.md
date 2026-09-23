# Repository Evidence System v1 — task contract

## Mission and authority
Build an offline, reproducible inventory → extraction → normalization → relationship → validation → gap → atlas pipeline. This contract and [original user request](TASK_REQUEST.md) are the task authority. The atlas is a derived navigation aid, never a new product authority. Existing [documentation authority](../../README.md) determines current boundaries.

## Scope and non-goals
Read tracked repository files and Git history at the recorded audited SHA. Inventory README, AGENTS, docs, .github, scripts, tools, tests, web/e2e, infra, ops, supabase, and other tracked files. Do not read binary asset content for archaeology. Write only the owned paths in STATE. No dependencies, dashboard, service, database, network requirement, CI changes, push, PR, merge or deploy. Local checkpoint commits use scripts/git/codex-commit.

## Immutable boundaries
All product/runtime/configuration paths are read-only, including Transcend W0–W8, Companion, 3D assets, API/DB/Auth/RLS, lifecycle/retention/account deletion, Model V2 artifact/schema/11-feature order/preprocessing/target leakage, deployment and cloud resources. Preserve “입력 기반 위험군 선별 신호” and the separation of model output, measured BP and participation. No clinical/personal data, credentials or raw production output is collected.

## Evidence taxonomy
architecture, product, journey, visual, companion, assets, model, data, api, auth, database, security, privacy, account, testing, ci, deployment, operations, research, release, policy, governance, historical.
Lifecycle: current, historical, superseded, temporary, research-only, uncertain. Each assigned status requires a cited source; uncertain is preferable to invention. “Current” means authority at audited_sha within a boundary, never live deployment proof. Extracted references and inferred relationships remain distinguishable from curated decisions.

## Atomic work and verification
QUEUE.json defines dependency-ordered slices; at most one active task. Before a task: reconcile Git/owned dirty paths, activate the task and save STATE/RESUME. Save outputs immediately; verify and self-review before marking verified or blocked. Commit independently useful slices without waiting for final completion. Logs can go to /tmp but durable results and conclusions must remain here.
Use stdlib Python. Test scanner behavior with small isolated Git fixtures, paths, anchors, SHA validity, ambiguous/remote refs, schema consistency and determinism. Run relevant existing repository policy tests, separate lint and formatter gates, and git diff --check. Existing gaps are warnings with scope and confidence, not production defects. No full runtime/browser suite is implied. The new scanner has local-only test coverage until humans decide CI integration.

## Completion criteria
All required queue tasks verified; full tracked-file inventory; typed reference report; source-grounded important evidence index and authority graph; confidence-aware gap report; the three requested generated reports; documented offline audit command; deterministic repeated outputs; no active task; actual working tree inspected; final main divergence examined; final self-review and unresolved items recorded; only owned paths changed; STATE.status complete.

## Resume protocol
Run git status, git branch --show-current, git log --oneline -10, git rev-parse HEAD. Read AGENTS → WORKPLAN → STATE → QUEUE → RESUME → active outputs. Compare recorded branch/base with live Git. STATE.last_commit is the last observed commit before writing the checkpoint; its containing commit cannot embed its own SHA. Resolve the latest checkpoint via git log, never amend history to chase this self-reference. On mismatch inspect owned diffs and repair state without overwriting work. Continue active_task, else next_task. Never treat old status labels in source documents as this task queue.

Before interruption save exact unfinished point, relevant paths, checks and next action; do not mark incomplete work verified. Commit safe slices. Fetch origin/main only at start/final review; preserve base_sha forever. If main advances, inspect changes and add an explicit incremental source snapshot where relevant; do not rebase blindly. Final integration is a human decision.
