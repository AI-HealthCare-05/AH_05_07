# S4 O1 production flow execution

이 문서는 [Issue #238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238)의
S4 첫 작업인 O1 운영 검증 **preflight**와 이후 승인된 실행 체크리스트다.
현재 상태는 `PREPARED / OPERATOR APPROVAL REQUIRED`이며, 이 문서 작성 중
production account·record·session·infrastructure 변경은 수행하지 않았다.

O1은 AC-04/06/08의 정상 owner 흐름과 안전한 복구 관찰만 다룬다. 모든 계정과
데이터는 합성으로 한정하고, 입력 기반 위험군 선별 신호·혈압 측정값·챌린지
이행은 서로 다른 사실로 기록한다. companion은 장식 동작일 뿐 임상·모델
증거가 아니다.

## Preflight

### Source and runtime identifiers

| 항목 | 확인된 값 | 상태 / 경계 |
| --- | --- | --- |
| 기준 `origin/main` | `5b04817607a07262e7f3c1f162980d1a1530396c` | 확인 완료 (2026-09-07) |
| O1 실행 대상 source SHA | `5b04817607a07262e7f3c1f162980d1a1530396c` | 이 docs-only 준비 변경을 포함하지 않은 최신 `main` 기준 |
| 최신 production web source evidence | `30fd65eda8d988804c8af208276934226e0eb67d` | S3E evidence의 merged `main` baseline; 현재 `main`의 후속 문서 merge 전 runtime 근거 |
| Production web Worker | `ah-05-07-pages` / `https://ah-05-07-pages.ahnsangkyoon.workers.dev` | Deployment SSOT와 S3E evidence로 확인 |
| Production Worker version | `70f9d4d5-6377-4087-a405-63993382441c` | S3E final restore evidence; public smoke PASS |
| Deployment snapshot workflow run tied to O1 source | `operator input required` | S3E evidence에는 sync 성공만 있고 run URL이 source SHA와 연결되어 있지 않음 |
| API target | `https://bp7-api-292436735548.asia-northeast3.run.app` | Deployment SSOT 및 요청된 smoke 명령과 일치 |
| Cloud Run service / region | `bp7-api` / `asia-northeast3` | Deployment SSOT로 확인 |
| Current Cloud Run revision | `operator input required` | repository evidence로 현재 revision을 특정할 수 없음; 추측 금지 |
| Supabase remote project/runtime state | `operator input required` | preflight에서 SQL, migration push, policy 변경을 수행하지 않음 |

Production Worker version은 S3E companion evidence의 runtime 사실이며, O1의
혈압·챌린지 동작을 검증했다는 뜻이 아니다. `5b048...` source가 현재 운영
Worker에 배포되었다고 추정하지 않는다. O1 실행 전에는 승인자가 source SHA와
실제 web/API target 및 revision을 함께 대조해야 한다.

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
`1c00e903a6bf189bcabc46708d140bd8103045bc`)는 첫 네 migration과 일치했고,
합성 owner CRUD·cross-user non-disclosure·anonymous denial·first-check-in
lock을 정상 경로로 통과시킨 뒤 계정과 행을 정리했다.

다섯 번째 migration은 `challenge_checkins(challenge_id, user_id)` additive
index로 API 의미를 바꾸지 않는다. 다만 현재 remote에 적용되었는지는 이
repository evidence만으로 확정할 수 없으므로 `operator input required`다.
O1 preflight에서는 SQL 실행이나 `supabase db push`를 하지 않는다. 실행 전
운영자는 승인된 read-only inventory로 대상 schema와 현재 runtime을 대조하고,
불일치하면 O1을 중단한다.

**Readiness:** O1의 필요한 schema 계약은 repository와 기존 production
inventory에서 확인되지만, 현재 remote migration inventory 및 현재 Cloud Run
revision 대조가 남아 있으므로 `PREPARED / OPERATOR APPROVAL REQUIRED`다.

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

O1의 challenge delete는 active challenge 자체가 아니라 현재 owned
`challenge_checkin`의 확인 삭제다. 현재 API contract에는 active challenge
자체의 `DELETE` route가 없다. 따라서 check-in 삭제 뒤 남는 synthetic
`active_challenge`를 어떤 승인된 정상 cleanup path로 정리할지 실행 전에
cleanup owner가 확정해야 한다. SQL이나 미문서화 route를 사용해 우회하지 않는다.

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
- Active-challenge cleanup path: `operator input required`; 현재 공개 API에
  active challenge delete가 없으므로 O1 시작 전 승인된 정상 경로가 없으면
  **HOLD**

### Cleanup order

1. offline/retry 및 진행 중인 요청을 종료하고, 미확정 mutation은 fresh read로
   존재 여부를 확인한다. 자동 재시도하지 않는다.
2. Synthetic A session을 종료한다.
3. current owned challenge check-in을 UI 확인 절차로 삭제하고 `204`/reload 부재를
   확인한다.
4. owned blood-pressure record를 UI 확인 절차로 삭제하고 `204`/reload 부재를
   확인한다.
5. 실행 전에 승인된 active-challenge cleanup path로 synthetic challenge를
   정리한다. 이 단계의 SQL·관리자 우회는 사전 승인된 문서가 없으면 금지한다.
6. Synthetic A account를 승인된 Auth cleanup path로 삭제하고 관련 행 정리
   완료만 sanitized evidence로 남긴다.
7. 마지막으로 public smoke를 다시 실행한다.

정리 실패, owner record 잔존, active challenge cleanup 미확정, 또는 account
삭제 권한 부재는 O1 완료가 아니라 **HOLD**다.

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
| [ ] preflight smoke PASS | public web/API/CORS 계약이 통과하고 product data/write가 없음 | `public smoke: pass`, 날짜·환경 class·source SHA | smoke 실패 또는 target mismatch |
| [ ] Synthetic A 준비 | 승인된 synthetic owner와 실행 창·cleanup owner·active-challenge cleanup path가 확인됨 | `Synthetic A: approved`, 실제 주소/ID 없음 | 승인 또는 cleanup path 미확정 |
| [ ] login/reload/new-tab | email-link login 후 정상 owner window, reload와 같은 browser new tab 유지 | `login/reload/new-tab: pass|fail|not run` | 링크/세션/페이지 이상 또는 민감 정보 캡처 필요 |
| [ ] blood-pressure invalid | 안내가 입력 전에 보이고 range/equal/reversed/unknown-field는 저장 거부 `422` 또는 UI validation | `BP invalid: pass`, 영구 행 0 | 행 생성, 값 노출, 예상 밖 status |
| [ ] blood-pressure valid save | 합성 유효 record 1회 저장 `201`, 저장 성공 UI 표시 | `BP save: pass`, record ID 없음 | `201` 아님, 저장 여부 불명확 |
| [ ] duplicate click | 같은 submit 재클릭이 추가 write를 만들지 않음 | `BP duplicate: no additional write` | 추가 행/불명확 mutation |
| [ ] edit | owned BP record의 유효 필드 수정 `200` | `BP edit: pass` | cross-user/immutable 범위 변경, `404/5xx` |
| [ ] delete cancel | 취소 시 DELETE가 없고 record가 유지됨 | `BP delete cancel: pass` | 취소 후 부재 또는 DELETE 발생 |
| [ ] delete confirm | 확인 후 DELETE `204`, reload/재조회에서 부재 | `BP delete confirm: pass` | 삭제 status 불일치 또는 잔존 |
| [ ] challenge select | active challenge 1개와 승인된 action이 선택됨 `200` | `challenge select: pass` | active 2개, 예상 밖 action, `5xx` |
| [ ] first check-in | 첫 check-in이 `completed` 또는 `skipped`로 1회 생성 `201` | `first check-in: pass` | active challenge 없음, 중복/불명확 write |
| [ ] action lock | 다른 action 선택/교체가 거부되고 원 action 유지 (`409` 계약) | `action lock: pass` | action 교체 성공 또는 status 혼동 |
| [ ] check-in update | 현재 owned check-in의 status만 변경 `200`; action/date/owner 불변 | `check-in status update: pass` | 다른 필드 변경 또는 non-current 수정 가능 |
| [ ] delete cancel/confirm | 취소 시 유지, 확인 시 check-in DELETE `204`와 reload 부재 | `check-in delete cancel/confirm: pass` | 취소 DELETE, confirmed 잔존, unexpected status |
| [ ] offline/recovery | 승인된 브라우저의 일시 offline에서 기존 data가 stale로 유지되고 retry로 복구 | `offline/recovery: pass|not run`; backend 중단 없음 | empty로 오표시, 자동 재시도, infra 조작 필요 |
| [ ] empty/error distinction | confirmed empty와 initial/error 화면이 구분됨 | `empty/error distinction: pass` | error를 empty로 표시하거나 민감 정보 필요 |
| [ ] optional session invalidation | 자연 발생한 invalid/expiry만 관찰; 강제 만료는 `not run` 가능 | `session invalidation: observed|not run|fail` | JWT/browser storage 조작 또는 강제 권한 필요 |
| [ ] synthetic records cleanup | BP/check-in/approved active challenge cleanup path가 완료됨 | `synthetic records cleanup: complete|hold` | 하나라도 잔존, cleanup owner 부재 |
| [ ] synthetic account cleanup | A가 승인된 Auth 경로로 정리됨 | `synthetic account cleanup: complete|hold` | 계정 삭제 우회 필요 또는 확인 불가 |
| [ ] final smoke | 마지막 public smoke PASS; 추가 product write 없음 | `final public smoke: pass` | smoke 실패 또는 runtime drift |

Valid BP save 성공 뒤 현재 production behavior에 따라 S05 bear-lite가 표시될
수 있다. 이 현상은 저장 성공 UI/API 계약의 일부일 뿐이며 입력 기반 위험군
선별 신호, 건강 상태, 모델 출력, 챌린지 이행 또는 인과적 개선을 의미하지
않는다. UI redesign은 O1 범위가 아니다.

## Status

- O1 status: **PREPARED / OPERATOR APPROVAL REQUIRED**
- Production execution: **not run**
- Production writes in this preflight: **0**
- Infrastructure changes in this preflight: **0**
- Product/UI/model changes in this preflight: **0**
- Successor execution Issue: [#257](https://github.com/AI-HealthCare-05/AH_05_07/issues/257)
- Parent Issue: [#238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238), remains open
