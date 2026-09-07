# S4 O1 production flow execution

이 문서는 [Issue #238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238)의
S4 첫 작업인 O1 운영 검증 preflight, 승인된 실행 체크리스트, 그리고 sanitized
production execution evidence다. 현재 상태는 **COMPLETE / VERIFIED**이며,
실행·정리·최종 public smoke까지 완료되었다. 이 문서와 별도 evidence 파일에는
계정·레코드 식별자, 토큰, 원시 요청/응답, 스크린샷, export JSON을 보존하지 않는다.

O1은 AC-04/06/08의 정상 owner 흐름과 안전한 복구 관찰만 다룬다. 모든 계정과
데이터는 합성으로 한정하고, 입력 기반 위험군 선별 신호·혈압 측정값·챌린지
이행은 서로 다른 사실로 기록한다. companion은 장식 동작일 뿐 임상·모델
증거가 아니다.

## Preflight

### Source and runtime identifiers

| 항목 | 확인된 값 | 상태 / 경계 |
| --- | --- | --- |
| Current repository baseline | `01b29c5d574e18f238683551e088cba0316536f9` | 현재 `origin/main`; deployed API artifact와 동일하다고 주장하지 않음 |
| 현재 기록된 production web source evidence | `30fd65eda8d988804c8af208276934226e0eb67d` | S3E evidence의 merged `main` baseline; 현재 `main`의 후속 문서 merge 전 runtime 근거 |
| 실제 O1 execution target web runtime | Worker version `70f9d4d5-6377-4087-a405-63993382441c`, recorded source evidence `30fd65eda8d988804c8af208276934226e0eb67d` | S3E final restore evidence; API artifact provenance는 별도 기록 |
| Production web Worker | `ah-05-07-pages` / `https://ah-05-07-pages.ahnsangkyoon.workers.dev` | Deployment SSOT와 S3E evidence로 확인 |
| Production Worker version | `70f9d4d5-6377-4087-a405-63993382441c` | S3E final restore evidence; public smoke PASS |
| API target | `https://bp7-api-292436735548.asia-northeast3.run.app` | Deployment SSOT 및 요청된 smoke 명령과 일치 |
| Cloud Run service / region | `bp7-api` / `asia-northeast3` | Deployment SSOT로 확인 |
| Current Cloud Run revision | `bp7-api-00013-qbz` | `latestCreatedRevisionName` and `latestReadyRevisionName`; traffic `100%` |
| API image | `sha256:f0acce9e03f480bf17851e7e025b5e1e9cde3eb27c386df957c68555d701d1ee` | immutable image digest pinned by the running revision |
| Cloud Build artifact mapping | build `ca3ce42f-8691-45f8-9358-a9445d9cbf7d`, `SUCCESS`, `2026-09-03T05:05:16Z`; tag `921a35e` → repository commit `921a35e38261104aec1cdd7095f86a16c48f357c` | operational provenance only; source attestation unavailable / not claimed |
| Supabase remote migration inventory | required first four migrations applied; `20260904090000_add_challenge_checkins_challenge_user_index` not applied | known additive drift; accepted non-blocking for O1 |

Production Worker version은 S3E companion evidence의 runtime 사실이며, O1의
혈압·챌린지 동작을 검증했다는 뜻이 아니다. deployed API artifact는 현재
`main`보다 오래되었지만, repository commit `921a35e38261104aec1cdd7095f86a16c48f357c`
에 O1-required endpoint semantics가 있다. 따라서 O1 실행을 위해 후속 `main`
변경을 배포할 필요는 없으며, clean/latest release reconciliation은 O3 범위다.
배포된 image tag `921a35e`는 repository commit에 operationally 매핑되지만,
Cloud Build metadata의 source commit attestation과 artifact provenance의 SLSA
build level은 노출되지 않았다. 따라서 이 매핑을 cryptographic/SLSA source
attestation으로 주장하지 않는다.

### Schema and migration readiness

현재 repository의 migration inventory는 다음 5개다.

1. `20260902020059_create_observation_lifecycle`
2. `20260902020806_harden_observation_table_grants`
3. `20260902142005_active_seven_day_challenges`
4. `20260903055923_enforce_exact_time_retention`
5. `20260904090000_add_challenge_checkins_challenge_user_index`

O1에 필요한 동작은 첫 네 migration이 제공하는
`blood_pressure_observations`, `active_challenges`, `challenge_checkins`와
소유자 RLS·7일 challenge·첫 check-in 이후 action lock·30일 retention이다.
기존 production inventory evidence (#149, source
`1c00e903a6bf189bcabc46708d140bd8103045bc`)와 이번 read-only remote inventory는
첫 네 migration이 적용된 것을 확인했다. 실제 remote inventory는 다음과 같다.

- APPLIED: `20260902020059_create_observation_lifecycle`
- APPLIED: `20260902020806_harden_observation_table_grants`
- APPLIED: `20260902142005_active_seven_day_challenges`
- APPLIED: `20260903055923_enforce_exact_time_retention`
- NOT APPLIED: `20260904090000_add_challenge_checkins_challenge_user_index`

마지막 migration은 `challenge_checkins(challenge_id, user_id)` additive index만
생성하며 rows, RLS, grants, triggers, API semantics를 변경하지 않는다. 이는
repository와 remote inventory가 동일하다는 뜻이 아니다.

다섯 번째 migration은 성능/supporting index에 불과하므로 O1 behavior는 그
존재에 의존하지 않는다. `20260904090000_add_challenge_checkins_challenge_user_index`
의 known additive drift는 **O1에 non-blocking으로 수용**한다. inventory drift만
없애기 위해 O1 직전에 production DDL을 적용하는 것은 불필요한 운영 위험을
추가하므로 migration을 적용하지 않는다. 이 drift는 clean release/schema
reconciliation, 특히 O3에서 후속 처리할 수 있다.

**Remote inventory:** `KNOWN ADDITIVE DRIFT / NON-BLOCKING FOR O1`.
**Readiness:** runtime reconciliation, migration disposition, cleanup path가
완료되었고 O1 operator execution approval도 확인되었다. 최종 실행 결과는
별도 [sanitized evidence](evidence/o1-production-execution.md)에 기록한다.

### Public smoke

실행자가 본실행 직전에 Windows PowerShell에서 사용할 정확한 명령:

```powershell
python scripts/ci/verify_deployment_smoke.py --web-base-url "https://ah-05-07-pages.ahnsangkyoon.workers.dev" --api-base-url "https://bp7-api-292436735548.asia-northeast3.run.app"
```

이 verifier는 web `200`, API `/live` `200` with `{"status":"ok"}`, `/ready`
`200` with `{"status":"ready"}`, 그리고 현재 browser method인 `GET`, `POST`,
`PUT`, `DELETE`에 대한 CORS preflight만 확인한다. 인증·product data·record
write는 전송하지 않는다.

Preflight 실행 결과: `deployment-smoke verification: passed`.

### O1 endpoint inventory

인증 product API는 Supabase email-link session의 `Authorization: Bearer`를
사용한다. 아래 status는 현재 OpenAPI/code contract이며, 응답 본문·토큰·ID는
공유 evidence에 기록하지 않는다.

| Method | Path | Expected success | Relevant failure status |
| --- | --- | ---: | --- |
| `GET` | `/api/v1/observations/window?start_on=&end_on=` | `200` | `401`, `422`, `503` |
| `POST` | `/api/v1/observations/blood-pressure` | `201` | `401`, `409` duplicate, `422`, `503` |
| `PUT` | `/api/v1/observations/blood-pressure/{record_id}` | `200` | `401`, `404`, `409`, `422`, `503` |
| `DELETE` | `/api/v1/observations/blood-pressure/{record_id}` | `204` | `401`, `404`, `503` |
| `POST` | `/api/v1/observations/challenges/active` | `200` | `401`, `409` after first check-in, `503` |
| `POST` | `/api/v1/observations/challenges/active/checkins` | `201` | `401`, `409` without active challenge, `422`, `503` |
| `PUT` | `/api/v1/observations/challenges/checkins/{record_id}` | `200` | `401`, `404`, `409` non-current/non-editable, `422`, `503` |
| `DELETE` | `/api/v1/observations/challenges/checkins/{record_id}` | `204` | `401`, `404`, `409` non-current/non-editable, `503` |

Deployed API compatibility was checked at repository commit
`921a35e38261104aec1cdd7095f86a16c48f357c`: the deployed artifact contains
`GET /observations/window`, `POST/PUT/DELETE /observations/blood-pressure`,
`POST /observations/challenges/active`, `POST /observations/challenges/active/checkins`,
and `PUT/DELETE /observations/challenges/checkins/{record_id}` (with the API
prefix, these are the O1-required `/api/v1/...` routes). This confirms endpoint
semantics required by O1; it does not claim that deployed API and current `main`
are identical.

O1의 challenge delete는 active challenge 자체가 아니라 현재 owned
`challenge_checkin`의 확인 삭제다. 현재 API contract에는 active challenge
자체의 `DELETE` route가 없다. 확인된 schema contract는
`active_challenges.user_id → auth.users(id) ON DELETE CASCADE`,
`challenge_checkins → active_challenges(id, user_id) ON DELETE CASCADE`,
`blood_pressure_observations.user_id → auth.users(id) ON DELETE CASCADE`다.

### Approved synthetic account requirements

| 계약상 이름 | O1 필요성 | 요구 조건 |
| --- | --- | --- |
| Synthetic A | 필요 | 정상 owner login/session, blood-pressure CRUD, active challenge/check-in flow의 소유자. 실제 주소·ID는 승인된 로컬 비공개 세션에서만 사용 |
| Synthetic B | O1에는 불필요 | O1 자체는 cross-user 검증 범위가 아니다. 기존 #149 Phase B의 cross-user non-disclosure evidence와 cleanup을 승계한다. 범위가 확장되어 B가 필요해질 때만 별도 승인 후 사용 |

새 production account 생성은 이 preflight에서 하지 않았다. O1 실행 전에
승인자는 Synthetic A의 사용 승인, 실행 창, cleanup owner, account cleanup
권한, 그리고 A가 실제 사용자와 분리되었음을 확인해야 한다.

### Minimal production synthetic data

- blood-pressure observation: 유효한 합성 record **1개** (하나의 `observed_on`/
  `period` 조합)
- invalid validation: range/equal/reversed/unknown-field 요청. 서버에 영구 행을
  만들지 않는 요청만 사용
- active challenge: 합성 action **1개**
- challenge check-in: 첫 check-in **최소 1개**, status update가 필요할 때만
  동일 check-in을 변경
- duplicate click: valid save에 대한 재클릭으로 추가 write가 없는지 확인하되,
  별도 record를 만들지 않음

### Execution window and cleanup owner

- Execution window: `operator input required` (Asia/Seoul 날짜·시각)
- Cleanup owner: `operator input required` (승인된 사람/역할만, 이름·연락처는
  repository에 기록하지 않음)
- Active-challenge cleanup path: authenticated Synthetic A session에서 current
  check-in과 BP record를 각각 normal product/API flow로 삭제하고 reload 부재를
  확인한 뒤, session을 종료하고 approved Supabase Auth administrative
  account-cleanup path로 Synthetic A를 삭제한다. declared FK cascade로 남은
  active challenge와 dependent synthetic rows를 정리하고 sanitized cleanup을
  확인한다.

이 경로는 custom SQL, service-role REST workaround, new product DELETE route,
production policy 조작을 사용하지 않는다. approved Auth account deletion을
수행할 수 없으면 O1은 **HOLD**다.

### Cleanup order

1. offline/retry 및 진행 중인 요청을 종료하고, 미확정 mutation은 fresh read로
   존재 여부를 확인한다. 자동 재시도하지 않는다.
2. 인증된 Synthetic A owner session을 유지한 상태에서 challenge check-in을
   정상 삭제하고 reload 후 부재를 확인한다.
3. 인증된 Synthetic A owner session을 유지한 상태에서 blood-pressure record를
   정상 삭제하고 reload 후 부재를 확인한다.
4. 다른 의도적으로 생성한 O1 owner record가 없는지 확인한다.
5. 그 다음 Synthetic A product session을 sign-out/종료한다.
6. 승인된 Auth administrative account cleanup으로 Synthetic A를 삭제한다.
7. declared `ON DELETE CASCADE`에 따른 active challenge/dependent row cleanup과
   sanitized cleanup 완료를 확인한다.
8. final public smoke를 다시 실행한다.

정리 실패, owner record 잔존, 승인되지 않은 관리자 경로 필요, 또는 account
삭제 권한 부재는 O1 완료가 아니라 **HOLD**다.

### Diagnostic project-service note

Provenance inspection 중 GCP project `ah-05-07-api`에서
`containeranalysis.googleapis.com`이 diagnostic/project-service 용도로
enable되었다. 이 enablement은 Cloud Run revision·traffic, image,
Supabase data/schema 또는 product/runtime deployment를 변경하지 않았다.
따라서 이번 세션은 runtime deployment changes `0`, production data/schema
changes `0`으로 기록하되, 전체 infrastructure/project configuration changes가
`0`이라고 표현하지 않는다.

### Stop conditions

- preflight smoke 실패, web source/Worker/API target/revision 불일치
- migration inventory 또는 필요한 schema/RLS/grant가 승인된 근거와 불일치
- Synthetic A 승인·실행 창·cleanup owner·active-challenge cleanup path 미확정
- 실제 계정/실제 건강값/원문 문서/식별자 사용을 요구받음
- invalid 요청이 영구 행을 만들거나 duplicate click이 추가 write를 만듦
- 예상 밖 `401`, `409`, `422`, `5xx`, stale/error/empty 상태 혼동, 또는 저장 여부가
  불명확한 mutation
- 토큰, magic-link URL, browser storage, request/response body, raw log,
  screenshot, record/account ID를 기록해야만 원인을 설명할 수 있음
- offline/timeout 재현을 위해 backend 중단, storage 조작, policy 변경, SQL,
  migration push, Cloud Run/Cloudflare/R2/Supabase 변경이 필요함
- session invalidation을 강제로 재현해야 하거나 별도 권한이 필요함
- S05 save 성공 뒤 bear-lite companion이 표시되더라도 이를 건강 상태,
  입력 기반 위험군 선별 신호, 모델 출력, 챌린지 이행 또는 개선의 증거로
  해석하라는 요구가 생김

중단 시에는 영향 받은 단계의 `fail` 또는 `not run`과 짧은 sanitized failure
class만 기록하고, 민감한 자료를 보존하지 않는다.

### Sensitive information never to record

실제 이메일·이름·연락처, user/account/record ID, JWT·refresh token·magic-link
URL, browser storage·request header, request/response body, 혈압 실제값,
free-text medical history, raw production log, console output, screenshot,
원문 clinical document, Supabase/Cloudflare/Cloud Run secret, service-role key,
private key를 Issue·PR·repository·공유 문서에 기록하지 않는다.

## Operator execution checklist

각 행은 한 단계씩 수행한다. `Evidence`에는 pass/fail, commit/runtime class,
시간, sanitized failure class와 정리 완료 여부만 남긴다.

| Check | Expected result | Sanitized evidence | Stop condition |
| --- | --- | --- | --- |
| [x] preflight smoke PASS | public web/API/CORS 계약이 통과하고 product data/write가 없음 | `public smoke: pass`; final smoke도 pass | smoke 실패 또는 target mismatch |
| [x] Synthetic A 준비 | 승인된 synthetic owner와 실행 창·cleanup owner·active-challenge cleanup path가 확인됨 | `Synthetic A: approved`, 실제 주소/ID 없음 | 승인 또는 cleanup path 미확정 |
| [x] login/reload/new-tab | email-link login 후 정상 owner window, reload와 같은 browser new tab 유지 | `login/reload/new-tab: pass` | 링크/세션/페이지 이상 또는 민감 정보 캡처 필요 |
| [x] blood-pressure invalid | 안내가 입력 전에 보이고 range/equal/reversed는 저장 거부; unknown-field 직접 production request는 미실행 | `BP invalid: pass`, 영구 행 0 | 행 생성, 값 노출, 예상 밖 status |
| [x] blood-pressure valid save | 합성 유효 record 1회 저장 `201`, 저장 성공 UI 표시 | `BP save: pass`, record ID 없음 | `201` 아님, 저장 여부 불명확 |
| [x] duplicate click | 같은 submit 재클릭이 추가 write를 만들지 않음 | `BP duplicate: no additional write`; count exactly 1 | 추가 행/불명확 mutation |
| [x] edit | owned BP record의 유효 필드 수정 `200` | `BP edit: pass`; count exactly 1 | cross-user/immutable 범위 변경, `404/5xx` |
| [x] delete cancel | 취소 시 DELETE가 없고 record가 유지됨 | `BP delete cancel: pass` | 취소 후 부재 또는 DELETE 발생 |
| [x] delete confirm | 확인 후 DELETE `204`, reload/재조회에서 부재 | `BP delete confirm: pass`; count 0 | 삭제 status 불일치 또는 잔존 |
| [x] challenge select | active challenge 1개와 승인된 action이 선택됨 `200` | `challenge select: pass` | active 2개, 예상 밖 action, `5xx` |
| [x] first check-in | 첫 check-in이 1회 생성 `201` | `first check-in: pass`; count exactly 1 | active challenge 없음, 중복/불명확 write |
| [x] action lock | 다른 action 선택/교체가 거부되고 원 action 유지 (`409` 계약) | `action lock: pass` | action 교체 성공 또는 status 혼동 |
| [x] check-in update | 현재 owned check-in의 status만 변경 `200`; action/date/owner 불변 | `check-in status update: pass` | 다른 필드 변경 또는 non-current 수정 가능 |
| [x] delete cancel/confirm | 취소 시 유지, 확인 시 check-in DELETE `204`와 reload 부재 | `check-in delete cancel/confirm: pass`; count 0 | 취소 DELETE, confirmed 잔존, unexpected status |
| [x] offline/recovery | 승인된 브라우저의 일시 offline에서 기존 data가 stale로 유지되고 retry로 복구 | `offline/recovery: pass`; browser F5 failure not counted | empty로 오표시, 자동 재시도, infra 조작 필요 |
| [x] empty/error distinction | existing main fixture/E2E evidence plus O1 runtime observation establish the boundary; standalone scenario not re-run in O1 | `empty/error distinction: pass` with evidence references | error를 empty로 표시하거나 민감 정보 필요 |
| [ ] optional session invalidation | 자연 발생한 invalid/expiry 관찰만 허용; 이번 실행에서는 미실행 | `session invalidation: not run` | JWT/browser storage 조작 또는 강제 권한 필요 |
| [x] synthetic records cleanup | BP/check-in/approved active challenge cleanup path가 완료됨 | `synthetic records cleanup: complete`; aggregate orphans all 0 | 하나라도 잔존, cleanup owner 부재 |
| [x] synthetic account cleanup | A가 승인된 Auth 경로로 정리됨 | `synthetic account cleanup: complete` | 계정 삭제 우회 필요 또는 확인 불가 |
| [x] final smoke | 마지막 public smoke PASS; 추가 product write 없음 | `final public smoke: pass` | smoke 실패 또는 runtime drift |

Valid BP save 성공 뒤 현재 production behavior에 따라 S05 bear-lite가 표시될
수 있다. 이 현상은 저장 성공 UI/API 계약의 일부일 뿐이며 입력 기반 위험군
선별 신호, 건강 상태, 모델 출력, 챌린지 이행 또는 인과적 개선을 의미하지
않는다. UI redesign은 O1 범위가 아니다.

## Final status

- O1 status: **COMPLETE / VERIFIED**
- Runtime reconciliation: **complete**
- Migration disposition: **complete** — known additive drift / non-blocking for O1
- Active-challenge cleanup path: **resolved** via approved Synthetic A Auth account deletion cascade
- Operator execution approval: **confirmed**
- Production execution: **COMPLETED**
- Synthetic cleanup: **COMPLETE**
- Final public smoke: **PASS**
- Natural session invalidation: **NOT RUN**
- Direct production unknown-field request: **NOT RUN**
- Browser full-page Offline F5: **NOT COUNTED** toward application offline behavior
- Valid in-app offline/recovery: **PASS**
- Runtime deployment changes by this evidence PR: **0**
- Production data/schema changes by this evidence PR: **0**
- Diagnostic `containeranalysis.googleapis.com` project-service enablement: **recorded**
- Product/UI/model changes by this evidence PR: **0**
- Deferred integrated UI/UX findings: rolling 7-day path can resemble day-7
  progress; export success notice persists across navigation
- Detailed sanitized result: [O1 production execution evidence](evidence/o1-production-execution.md)
- Successor execution Issue: [#257](https://github.com/AI-HealthCare-05/AH_05_07/issues/257)
- Parent Issue: [#238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238), remains open
