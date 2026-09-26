# SK7 Autopilot Lite

This is an explanatory guide. `AGENTS.md` is the sole repository-workflow authority.

## Default flow

```text
user request
  -> GitHub Issue
  -> short branch/worktree from current origin/main
  -> coherent commits + affected local checks
  -> PR linked to the Issue
  -> required GitHub lint + test
  -> agent squash-merge / auto-merge
  -> branch cleanup
```

There is no default human-merge gate.
The human owner is continuously observing and may intervene at any point.

## What the guard does

Run before publishing:

```sh
python3 scripts/git/autopilot_guard.py --base origin/main
```

The guard classifies scope; it does not authorize or block merge by itself.

- `routine`: ordinary UI/docs/tests/tooling.
- `protected`: backend/auth/data/model/dependency/governance/CI. The agent may still publish and merge after required checks pass.
- `deny`: secret/credential containers or another explicitly forbidden path.

For governance/workflow changes, the current user request plus its GitHub Issue is the authorization record.
Do not create a second approval ledger.

## Verification

Use the smallest affected local checks while iterating.
GitHub-required `lint` and `test` are the routine merge-time gate.

The following are deliberately outside the default merge path:

- full Browser E2E matrix
- trusted self-hosted runner jobs
- post-merge main reruns
- mirror / Cloudflare build, deployment, or build-result verification

Browser confidence remains schedule/manual.
The human owner controls the deployment mirror and Cloudflare publication.

## Protected external effects

A protected code change may be merged normally.
Actual destructive database operations, production deployment, credential changes, or other irreversible external effects require explicit current-task authorization before execution.

## Restart

Issue + branch + live Git state is the primary restart surface.
Keep one concise handoff only when necessary; do not build a new mandatory state system.
Live repository/process state outranks chat memory.
