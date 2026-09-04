# Deployed RLS ownership verification plan

Issue [#149](https://github.com/AI-HealthCare-05/AH_05_07/issues/149)
separates a read-only deployment preflight from any synthetic-user exercise.
It proves neither browser behaviour nor ownership enforcement by itself. Phase B
may start only after the repository owner gives explicit approval in Issue #149.

## Scope and evidence boundary

- **Phase A, completed on 2026-09-04:** source and linked-project metadata
  inventory only. No account, product record, policy, grant, migration, runtime
  configuration, or deployment was changed.
- **Phase B, not approved:** create and use two dedicated synthetic accounts
  through the normal signed-in product path, then clean them up.
- Do not record email addresses, user IDs, JWTs, request headers, magic-link
  URLs, observation values, raw browser output, or query result rows in GitHub,
  Notion, screenshots, or this document.

RLS policies and table grants are separate controls; a policy does not replace
the required table privilege, and a table privilege does not bypass an enabled
policy. See the [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Phase A inventory

The repository baseline and the linked production-project migration list were
compared at source commit
`1c00e903a6bf189bcabc46708d140bd8103045bc`. The following ordered migrations
are present in both inventories:

1. `20260902020059_create_observation_lifecycle`
2. `20260902020806_harden_observation_table_grants`
3. `20260902142005_active_seven_day_challenges`
4. `20260903055923_enforce_exact_time_retention`

Read-only metadata confirmed the expected public tables,
`blood_pressure_observations`, `challenge_events`, `active_challenges`, and
`challenge_checkins`. RLS is enabled on each. The exposed application access is
limited to `authenticated` `SELECT`, `INSERT`, `UPDATE`, and `DELETE` grants,
with one unexpired owner-management policy per table. This is inventory evidence
only: it does not reveal, validate, or export any existing row.

The local pgTAP suites remain the executable source contract:

| Suite | Intended coverage | What it does not prove |
| --- | --- | --- |
| `observation_ownership_rls_test.sql` | Anonymous denial; owner CRUD; cross-user denial for observation, legacy-event, active-challenge, check-in, and export-source rows. | Normal browser/API authentication and cleanup behaviour. |
| `active_challenges_rls_test.sql` | One active challenge, owner check-in, first-check-in action lock, and cross-user denial. | A live signed-in user journey. |
| `exact_time_retention_rls_test.sql` | Server-assigned 30-day deadline, immutable expiry, expired-row invisibility, and export exclusion. | Permission to alter production time or existing records. |

These suites use transactional fixed fixtures locally. A linked test run is
separate evidence and must use the approved test window and target.

## Phase B approval gate

Before creating either account or any synthetic record, the owner must add an
explicit Issue #149 approval that names the intended environment and verification
window. A successful CI run, this plan, or a merge does not grant that approval.

After approval, reserve two opaque labels, **Synthetic A** and **Synthetic B**.
Keep the actual account identifiers out of all shared evidence. Use only normal
browser/API authentication and the publishable-key boundary; never put a
service-role key in a browser, capture, command history, or patch.

## Phase B pass/fail matrix and cleanup

| Check | Required sanitized result |
| --- | --- |
| Anonymous request | Denied without another user's data. |
| Synthetic A owned observation | Create, read, update, delete, and export work only while the record is unexpired. |
| Synthetic B against A's observation/export | No read, change, delete, or export disclosure. |
| Challenge ownership | B cannot read, change, delete, or create a check-in for A's challenge. |
| Challenge lock | A can select one active challenge; the first check-in prevents replacement. |
| Cleanup | Delete all synthetic records through the approved owned/admin cleanup path, remove both synthetic accounts, then record only pass/fail and a sanitized error class. |

Do not backdate production data, change server time, bypass triggers, or use
direct production SQL to simulate expiry under this Issue. Stop and open a
separate transactionized plan if normal-path cleanup cannot remove a fixture.

## Evidence record template

Record only the following in the Issue, pull request, handoff, and Notion:

| Field | Allowed value |
| --- | --- |
| Phase | `A preflight` or explicitly approved `B synthetic verification` |
| Source | Full commit SHA and Issue/PR number |
| Environment | `linked production metadata` or approved synthetic test window |
| Checks | Named checks from the matrix, with pass/fail only |
| Failure | Sanitized error class only, if any |
| Cleanup | `complete`, `not started`, or separately approved retention state |
