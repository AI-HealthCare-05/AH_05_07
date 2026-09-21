# SK7 Autopilot Lite

SK7 uses the repository controls it already has instead of adding a second agent
platform. The goal is low-cost hands-off implementation for routine work while
keeping health, auth, data, model, deployment, and repository-governance changes
behind a human merge gate.

## Why this is deliberately small

Autopilot Lite does **not** add an MCP writer, Secure Tunnel, persistent daemon,
new server, or self-hosted CI dependency. Codex or another approved coding agent
works in an isolated Git worktree, the repository decides the risk lane, and the
existing GitHub PR/ruleset/required CI path remains the source of merge truth.

This keeps incremental infrastructure cost at zero and avoids giving a web agent
a general-purpose shell or production credential surface.

## Control plane

```text
User request
  -> approved coding agent
  -> isolated worktree / short branch
  -> affected local checks
  -> autopilot_guard.py
  -> GitHub PR
  -> existing required CI (lint + test, plus routed checks)
       -> routine: human merge decision
       -> protected: human review + merge decision
       -> deny: hands-off stop; explicit human-governed task required
```

GitHub-hosted CI is the final broad regression gate. The repository's persistent
self-hosted runners remain opt-in trusted heavy verification and are not part of
the default autonomous merge path.

## Lanes

| Lane | Typical examples | Autonomous outcome |
| --- | --- | --- |
| `routine` | web copy/CSS/semantic UI, presentation components, focused web tests, ordinary docs | implement, test, publish PR, then leave merge to the human |
| `protected` | API/auth/RLS/retention, Supabase/migrations, Model V2/data tooling, dependencies/locks, deployment/ops, architecture/ADR and CI guard code | implement and test, publish PR, then stop for human review/merge |
| `deny` | `AGENTS.md`, Autopilot policy/guard, GitHub workflows/CODEOWNERS, Codex commit wrapper, tracked env/credential containers | hands-off lane stops; only an explicitly user-scoped human-governed task may prepare a Draft PR, with the guard still reporting `deny` |

The path guard is intentionally conservative. `AGENTS.md` remains authoritative
for semantic risk: a routine-looking path can still require the protected lane if
the requested behavior changes a protected product boundary.

## Start a task

Use current upstream `main` and a disposable worktree. The exact worktree name is
not a contract.

```sh
git fetch origin main
TASK="short-task-name"
git worktree add -b "autopilot/${TASK}" "../AH_05_07-${TASK}" origin/main
cd "../AH_05_07-${TASK}"
```

The agent reads `AGENTS.md`, the fast-start handoff, and only the contract/tests
for the boundary it is changing. It runs the smallest affected checks while
iterating; it does not repeat the full browser/release matrix by default.

## Local verification and handoff

Reuse [sk7ctl](../scripts/sk7ctl.py), not another verification router. With this
task's plan active, `python3 scripts/sk7ctl.py verify --profile focused` previews
the checks; add `--run` to execute and record them. `pr` and `full` are explicit
broader profiles, not replacements for required hosted CI.

`sk7ctl` keeps one active task in `<git-common-dir>/sk7ctl/state.json`, shared by
linked worktrees. Check `python3 scripts/sk7ctl.py plan show` before writing it;
`plan` mutations and `verify --run` need one owner at a time. If another lane owns
that state, use the affected commands directly and preserve your own handoff
without replacing its plan or verification record.

`python3 scripts/sk7ctl.py handoff` prints the existing restart record; it does
not save the work or export assets. Save the record and required task artifacts
outside temporary storage, following the
[AGENTS restart rules](../AGENTS.md#long-running-work-and-restart).

## Guard before publish

The guard inspects committed changes plus staged, unstaged, and untracked files:

```sh
python3 scripts/git/autopilot_guard.py --base origin/main
```

`--require-routine` remains available only as a strict assertion for an
operator or script that expects a routine diff:

```sh
python3 scripts/git/autopilot_guard.py --base origin/main --require-routine
```

It is **not** auto-merge or merge authorization. Exit status is `0` for an
allowed result, `1` for denied paths, `2` when `--require-routine` encounters a
protected change, and `3` for a Git/guard execution failure. Machine-readable
output is available with `--json`.

The guard classifies scope; it does not replace affected tests, `git diff --check`,
full diff review, or GitHub required checks.

## Publish and merge

After the affected checks and guard pass, inspect the complete diff and publish
one coherent PR. When Codex materially contributed, use the repository's
`scripts/git/codex-commit` wrapper for the commit.

For `routine`, the agent may prepare the complete implementation and PR, follow
the required checks, and resolve task-owned review findings. Merge remains a
human action.

For `protected`, the agent may likewise prepare the complete implementation and
PR but must leave review and merge to the user. This is the normal path for
health semantics, auth/RLS/retention, data/model contracts, dependencies,
migrations, deployment, and CI/security boundary changes.

For `deny`, the hands-off lane stops. The purpose is to prevent the autonomous
process from changing its own authority, GitHub execution policy, or credential
boundary. When the **current user request explicitly authorizes** a named
governance/workflow/guard change, treat that work as a separate human-governed
task: the agent may implement and test the approved paths and may publish a
Draft PR, but it must not alter the guard merely to make the classification pass,
must record the expected `deny`, and must leave merge to the human.

## When to revisit MCP or a tunnel

Do not add a local writer service merely because it is technically possible.
Revisit a tunnel/MCP bridge only after a measured workflow gap shows that the
approved coding agent cannot reliably perform required local-only actions through
the current worktree/PR flow. Such a change is new topology and therefore follows
the protected-boundary process with an ADR.

Until then, Autopilot Lite deliberately reuses Codex, Git, GitHub Actions, the
current ruleset, and the existing SK7 validation commands.
