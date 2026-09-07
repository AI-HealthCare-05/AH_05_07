# S4 O3 clean release execution evidence

**Execution date:** 2026-09-07
**Execution Issue:** [#261](https://github.com/AI-HealthCare-05/AH_05_07/issues/261)
**Parent:** [#238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238), remains OPEN

## Final decision

**O3 = COMPLETE / VERIFIED.**

The explicitly operator-approved scope was an API-only clean release. Web
reproduction was intentionally not performed because the approved candidate
contained no web runtime delta from the recorded production web source. O1
evidence remains separate; this document does not repeat O1 product-flow
evidence.

The documentation baseline and runtime release SHA are different facts:

- **Approved/runtime release SHA:**
  `3106537d61396b20a18a85cd6d0d74c498a91aab`
- **Clean candidate checkout:** exact release SHA confirmed at `HEAD`; working
  tree confirmed clean. The checkout is identified here as
  `AH_05_07-o3-clean-3106537`.
- No claim is made that the release is bit-identical or reproducibly built.

## Migration A

Approved migration:
`20260904090000_add_challenge_checkins_challenge_user_index`

SQL intent:

```sql
create index if not exists challenge_checkins_challenge_user_idx
  on public.challenge_checkins(challenge_id, user_id);
```

Execution result: **PASS**.

The change was additive index DDL only. It did not mutate rows or change RLS,
grants, triggers, or API behavior.

The connected migration path initially recorded the successful DDL under the
runtime-generated history version `20260907060521` with migration name
`add_challenge_checkins_challenge_user_index`. Migration bookkeeping was then
deliberately reconciled: `20260907060521` was reverted in migration history and
`20260904090000` was applied in migration history. The DDL/index was not
executed a second time during this repair.

Final linked migration inventory:

```text
20260902020059
20260902020806
20260902142005
20260903055923
20260904090000
```

Repository and remote migration versions were aligned. A read-only schema check
confirmed `challenge_checkins_challenge_user_idx` is **PRESENT**.

The post-DDL production performance advisor finding was:

- `unused_index` — **INFO** for `challenge_checkins_challenge_user_idx`

This is retained as immediate post-creation context: the index exists but has
not accumulated usage yet. It is not evidence that the index is unnecessary.
No performance improvement magnitude is claimed, and no additional DDL was
performed.

## Build provenance

- **Cloud Build:** `60c0a23f-6383-47c4-b966-616379116a0d`
- **Status:** **SUCCESS**
- **Image tag:**
  `asia-northeast3-docker.pkg.dev/ah-05-07-api/bp7/api:o3-3106537`
- **Immutable image digest:**
  `sha256:34131105048ca654a4e0e1cf9a1982bc909e7120d1f6320042170262d64e2399`
- **Full immutable image:**
  `asia-northeast3-docker.pkg.dev/ah-05-07-api/bp7/api@sha256:34131105048ca654a4e0e1cf9a1982bc909e7120d1f6320042170262d64e2399`
- **Base-image digest:** NOT CAPTURED / NOT CLAIMED

The Dockerfile uses floating external base/builder references, including
`uv:latest`; therefore this record does not claim a bit-identical or
reproducible build.

## Cloud Run execution

Service: `bp7-api`
Region: `asia-northeast3`

Immediately before execution, the live rollback target was reconfirmed by
read-only inventory:

- `latestCreatedRevisionName`: `bp7-api-00013-qbz`
- `latestReadyRevisionName`: `bp7-api-00013-qbz`
- traffic: `bp7-api-00013-qbz` at `100%`

The approved image was first deployed with no traffic:

- **New revision:** `bp7-api-00014-jeq`
- **Image:** the immutable digest recorded above
- **Tagged direct URL class:** `o3-3106537` (exact public URL not retained)
- **No-traffic state:** new revision ready; production traffic remained on
  `bp7-api-00013-qbz` at `100%`, new revision at `0%`
- **No-traffic deployment smoke:** **PASS**

The no-traffic smoke used the production web public origin and the tagged API
revision. It recorded web `200`, `/live`, `/ready`, and CORS checks for
`GET`/`POST`/`PUT`/`DELETE` as **PASS**. No authenticated product write was
performed.

A second explicit operator approval was received before production traffic was
moved. Issue #261 is the execution record; it is not treated as authorization
by itself.

Approved traffic sequence:

1. `bp7-api-00014-jeq` at `100%` → smoke **PASS**
2. `bp7-api-00013-qbz` at `100%` for rollback rehearsal → smoke **PASS**
3. `bp7-api-00014-jeq` at `100%` for final restore → smoke **PASS**

Recorded results:

- **NEW REVISION PRODUCTION SMOKE:** PASS
- **ROLLBACK SMOKE:** PASS
- **FINAL RESTORE SMOKE:** PASS
- **O3 RUNTIME EXECUTION:** COMPLETE

Final runtime state:

- Cloud Run service: `bp7-api`
- Production revision: `bp7-api-00014-jeq`
- Traffic: `100%`
- Image digest:
  `sha256:34131105048ca654a4e0e1cf9a1982bc909e7120d1f6320042170262d64e2399`

No database downgrade was performed.

## Web and product boundary

- Web O3 action: **API-only**
- Cloudflare Worker deployment: `0`; web unchanged and not redeployed
- Web rollback/restore: not performed because web reproduction was not selected
- Production user/account creation: `0`
- Product record writes: `0`
- Health/BP values processed for O3 evidence: `0`
- Model execution: `0`; model output: none
- Challenge adherence: not measured or used as an O3 fact
- R2 changes: `0`
- Companion changes: `0`
- UI changes: `0`
- DB downgrade: `0`

The only production DB/schema change in this execution was the one explicitly
approved additive index migration above. The temporary generated migration
history entry was bookkeeping reconciliation, not a second schema migration.

## Deferred and separate scope

- O1 remains **COMPLETE / VERIFIED**; its product-flow evidence is not repeated
  here.
- At the time this O3 evidence was captured, O2 had not yet received its later
  alternate-evidence decision; this line is historical and not the current O2 state.
- API P95, submission/final sharing, scope acceptance, and input/model decisions
  remain separate [#238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238)
  scope.
- The deferred UI findings remain unchanged: the recent rolling seven-date path
  can resemble challenge day 7, and the export success notice persists across
  navigation. They are reserved for the later holistic UI/UX pass.
- This O3 completion does not claim S4 overall completion.

This is sanitized evidence only. It retains no tokens, auth identifiers, raw
CLI logs, headers, account IDs, health data, or screenshots.
