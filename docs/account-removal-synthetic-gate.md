# Account-removal synthetic production gate — proposed, not executed

This is a reviewable plan, not execution authorization. #355 completed runtime
activation only. A later owner-approved execution must record its exact source,
API revision/image, Worker version, identity scope, and cleanup authority before
creating accounts or records. Check for an existing successor before opening one.

## Read-only preflight

1. Re-read source ancestry and actual runtime identifiers against the
   [baseline](account-removal-production-baseline.md). Report drift; do not roll
   back a newer shared release or silently substitute a different source.
2. Confirm secret binding by name/version only, service health, expected account
   route, and the non-model authentication/ownership contract. Never print keys.
3. Enumerate the exact owned tables and cascade relationships from the applicable
   schema, plus approved read-only residual queries scoped to synthetic A/B.
   This plan does not authorize broad Auth/user-data enumeration or model reads.
4. Define two exclusively synthetic identities, the minimum row inventory,
   protected non-model read endpoints, and exact expected rejection statuses.
   Freeze those checks and cleanup steps for owner approval. No placeholder
   query or unresolved table scope may advance to the mutation phase.

## Separately approved execution

| Step | Evidence required |
| --- | --- |
| Create synthetic A and control B | Separate identities; both authenticate; exact approved synthetic rows/counts recorded privately |
| Establish control | A/B owned reads and isolation pass; retain an unexpired A access token in process memory only |
| Delete A through browser | Two destructive confirmations; one intended `DELETE /api/v1/account`; expected success is HTTP 204 |
| Verify A removal | Auth identity absent and A-owned residual count zero for every approved table; use privileged read-only checks scoped to A so RLS invisibility is not mistaken for absence |
| Verify previous token | Before its natural expiry, the retained A token is rejected at each approved protected SK7 endpoint; do not infer denial from JWT syntax or deletion success |
| Verify B isolation | B still authenticates and its exact control rows remain unchanged before cleanup |
| Verify browser | Clean anonymous state, no prior-account content after reload/Back/Forward, and no stale private UI or export completion |
| Final cleanup | Approved B/control Auth and row cleanup, A recheck, total synthetic residual zero, final non-destructive smoke |

Do not sign A out or discard its retained token before the old-token check: that
would confound the deletion-specific evidence. Never paste the token into chat,
Git, command arguments, screenshots, or logs. Old-token expiry before the check
makes that check inconclusive, not PASS.

Lost-response injection remains a non-production regression test unless a later
owner explicitly adds it to this gate. Do not repeat a destructive request just
because its response was lost; follow the implemented recovery flow and record
the observed result. Do not delete B before its isolation check.

## Failure and cleanup

On wrong-account targeting, B changes, unexpected residuals, accepted old token,
unexpected runtime drift, or uncertain deletion outcome: stop further test
mutations and preserve sanitized failure evidence. Run only the pre-approved
cleanup scoped to these synthetic identities. If that cleanup is unsafe or
blocked, report remaining counts for owner action; never claim zero residual.
Do not alter RLS, grants, schema, token lifetime, model configuration, or deployment
to make the experiment pass. Runtime rollback cannot restore deleted identities
or rows and is not a data-recovery procedure.

## Result format

Record each row above as PASS / FAIL / NOT RUN / INCONCLUSIVE, with the exact
source and runtime, observed statuses, aggregate counts, and cleanup result.
Do not retain raw rows, email addresses, user IDs, bearer tokens, response bodies,
or private screenshots in public evidence. Aggregate verification must distinguish
absence from lack of visibility. This gate cannot certify all security behavior,
all token consumers, broader retention compliance, or model readiness.
