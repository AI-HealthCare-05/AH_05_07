# Cloudflare Worker rollback evidence plan

Issue [#151](https://github.com/AI-HealthCare-05/AH_05_07/issues/151)
separates read-only version inventory from a traffic-changing rollback rehearsal.
No rollback target is accepted until its complete version ID is distinct from the
current deployment.

## Phase A — read-only preflight

At source commit `7d24d4162b7bc0549f306b2106fbf2fff356c348`, the only
recorded Worker version is `38bb08b6-66ca-4933-8cbe-ee857aa4ece7`. The
short `38bb08b6` is not a rollback target. This repository cannot query the
Cloudflare account directly, so Phase A remains incomplete until the operator
runs the following read-only inventory through an authenticated Wrangler session:

```powershell
npx wrangler deployments status --name ah-05-07-pages --json
npx wrangler versions list --name ah-05-07-pages --json
```

Use the output only to identify the complete current version and one complete,
distinct prior candidate. Do not attach raw JSON, author information, tokens,
headers, or console output. Record only version IDs, source commit, deployment
snapshot run, date, and sanitized pass/fail state.

## Phase B — explicit owner approval

A merge, CI result, or Phase A inventory does not approve a rollback. Before a
traffic-changing action, the owner must approve the target and maintenance
window in Issue #151. Then use Cloudflare's supported rollback path, run the
unauthenticated public smoke command, restore the intended current version, and
run the same smoke again. Stop if any identity is unclear or a smoke fails.

Cloudflare documents that a rollback immediately creates the active deployment;
it is therefore never a read-only check. See the [Workers rollback guidance](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

## Evidence template

| Field | Allowed value |
| --- | --- |
| Phase | `A inventory` or explicitly approved `B rehearsal` |
| Runtime | Complete current and distinct target version IDs |
| Source | Full source commit and deployment-snapshot run |
| Result | Named smoke checks with pass/fail only |
| Restore | Final intended current version and pass/fail |
