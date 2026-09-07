# S4 API P95 verification pre-flight — historical snapshot

**상태: HISTORICAL PRE-FLIGHT SNAPSHOT.** 최종 operator verification 결과는
[work-state](work-state.md)와 [운영 검증 기록](mvp1-operations-review.md)에 둔다.

이 문서는 Talos의 external API P95 기준을 실제로 측정하기 전, 측정 대상과
판정 계약을 고정하기 위한 DOCS / READ-ONLY ANALYSIS ONLY 기록이다. 이 문서와
successor Issue는 production load, 반복 authenticated production request,
product data write, 배포, Supabase SQL/migration, model execution, UI 변경을
승인하지 않는다.

초기 저장소 분석의 `DECISION REQUIRED` 표기는 아래에 보존된 pre-approval
상태다. 현재 operator contract는 별도 승인으로 고정되었지만, 이 PR은 실행을
수행하지 않으며 client acceptance를 주장하지 않는다.

## 결론

- 저장소에서 확인되는 외부 기준은 **API P95 <= 3초**다. `requirements.md`,
  `mvp1-closeout.md`, `observation-load-baseline.md`는 이 기준이 아직
  **UNVERIFIED**라고 명시한다.
- 현재 production API final revision은 `bp7-api-00014-jeq`로 기록되어 있다.
  revision이 알려져 있다는 사실만으로 P95 acceptance environment나 release
  mapping이 정해진 것은 아니다.
- Talos 기준만으로는 endpoint set, request count, concurrency/arrival model,
  timeout, cold/warm 포함 범위, HTTP 성공 판정, endpoint 간 집계 여부를
  확정할 수 없다. 이 항목들은 **OPERATOR/CLIENT DECISION REQUIRED**다.
- 따라서 기존 UI 수동 timing이나 PR #235의 local evidence로 외부 기준을
  통과 처리하지 않는다.

## 읽은 근거와 해석 경계

| 근거 | 확인한 사실 | 이 문서에서의 사용 |
| --- | --- | --- |
| [requirements.md](requirements.md) | NFR-01은 P95 target을 고정하기 전 versioned latency/load baseline을 요구하며, Talos external API P95 3초는 미검증이다. | 요구·상태의 기준 |
| [mvp1-closeout.md](mvp1-closeout.md) | Talos 5-1의 3초 기준, API별 local 집계, 운영 환경·수용 조건의 미확정을 구분한다. | 외부 acceptance와 내부 evidence 분리 |
| [observation-load-baseline.md](observation-load-baseline.md) | signed-in browser recent-seven-day 화면의 pre/post-index 각 3회 수동 timing이다. | 사용자-visible timing 참고만; P95 evidence 아님 |
| [docs/evidence/local-reliability.json](evidence/local-reliability.json) | synthetic-only loopback FastAPI → local Supabase의 sanitized aggregate 489 measurements다. | 방법론 참고만; production P95로 승격하지 않음 |
| [api-contract.md](api-contract.md), generated OpenAPI | `/api/openapi.json`이 executable authority이며 현재 method/path/status와 web-connected/legacy 구분을 확인한다. | route inventory |
| `app/main.py`, `app/apis/v1/*`, `web/src/lib/api.ts`, `web/src/App.tsx` | 실제 API route와 현재 web client 호출을 source에서 대조한다. | web-used endpoint 판정 |

### 기존 evidence를 재사용하지 않는 이유

`observation-load-baseline.md`의 두 scenario는 각각 3개 sample의 median만
기록하고 API request timing과 다르다. local reliability JSON은 endpoint별로
first call 1건, warm sequential 20건, warm concurrent 40건을 기록하고,
장애 주입 1건을 별도 포함해 총 489건이다. JSON에 기록된 Hyndman–Fan type 7,
concurrency 4, local cold 정의 등은 **방법론 참고**이지 Talos의 승인 조건이
아니다. 이 작업에서는 수치를 재계산하거나 재실행하지 않는다.

## API candidate inventory

아래 경로는 generated OpenAPI와 source route를 대조한 결과다. `web-used`는
현재 `web/src/App.tsx`에서 호출하는 경로이며, Supabase Auth의 직접 호출은
이 저장소 FastAPI route가 아니므로 API P95 후보 표에 포함하지 않는다.

### 1. No-auth health endpoints

| Method | Path | OpenAPI success/contract status | 현재 사용 |
| --- | --- | --- | --- |
| GET | `/live` | `200` (`{"status":"ok"}`) | public operational smoke; product data 없음 |
| GET | `/ready` | `200` ready, `503` `service_not_ready` | public operational smoke; configuration presence만 확인, Supabase query 아님 |

이 둘은 no-auth 후보지만 현재 web client의 product data fetch 경로는 아니다.
`/ready`의 `503`은 configuration-not-ready contract error이며 성공 latency로
간주할지 여부는 별도 판정 규칙이 필요하다.

### 2. Signed-in read endpoints

| Method | Path | Expected product status | 현재 web 사용 |
| --- | --- | --- | --- |
| GET | `/api/v1/observations/window?start_on=&end_on=` | `200` | 최근 7일 window와 current/prior browse |
| GET | `/api/v1/observations/export?start_on=&end_on=` | `200` | 선택한 최근 7일 JSON export |

두 경로는 Supabase JWT를 사용하고 RLS-owned read를 수행한다. production에서
반복 authenticated request를 실행하지 않았으며, 측정 시 synthetic/no-real-PHI
경계와 별도 승인이 필요하다. 다만 production 권장 최소 acceptance-bearing
세트에는 `window`만 포함한다. `export`는 아래 실행 계약에 따라 기본 제외한다.

### 3. Signed-in mutation endpoints

현재 web flow가 실제 호출하는 mutation 후보는 다음 7개다.

| Method | Path | Expected product status | 현재 web 사용 |
| --- | --- | --- | --- |
| POST | `/api/v1/observations/blood-pressure` | `201` | 혈압 observation 저장 |
| PUT | `/api/v1/observations/blood-pressure/{record_id}` | `200` | owned observation 수정 |
| DELETE | `/api/v1/observations/blood-pressure/{record_id}` | `204` | 확인 후 owned observation 삭제 |
| POST | `/api/v1/observations/challenges/active` | `200` | active challenge 선택 |
| POST | `/api/v1/observations/challenges/active/checkins` | `201` | daily check-in 저장 |
| PUT | `/api/v1/observations/challenges/checkins/{record_id}` | `200` | current check-in status 수정 |
| DELETE | `/api/v1/observations/challenges/checkins/{record_id}` | `204` | 확인 후 current check-in 삭제 |

이 작업의 production safety boundary에서는 mutation load를 금지한다. mutation
P95가 Talos acceptance에 포함되는지는 **OPERATOR/CLIENT DECISION REQUIRED**이며,
포함하더라도 승인된 non-production synthetic fixture에서만 별도 실행하는
계약이 권장된다. 실제 production product write는 이 작업과 successor issue의
기본 범위가 아니다.

### 4. Model-not-ready endpoint

| Method | Path | Current contract | 측정 해석 |
| --- | --- | --- | --- |
| POST | `/api/v1/risk-signal` | `503 model_not_ready` | 현재 product-connected success path가 아니며, expected error latency를 별도 보고할 뿐 외부 API 성공 P95에 합치지 않음 |

이 endpoint는 입력 기반 위험군 선별 신호가 출시되었다는 뜻이 아니며, 이
pre-flight에서는 model execution을 하지 않는다.

### 현재 web flow 밖의 OpenAPI routes

다음 route는 OpenAPI에는 있으나 현재 SK7 web flow가 사용하지 않는다. Talos
P95 대상에 넣을 근거가 없으므로 후보 endpoint로 확정하지 않는다.

- `POST /api/v1/observations/challenges` 및
  `DELETE /api/v1/observations/challenges/{record_id}`: legacy/API-only
- `POST /api/v1/auth/signup`, `POST /api/v1/auth/login`,
  `GET /api/v1/auth/token/refresh`: inherited auth router
- `GET /api/v1/users/me`, `PATCH /api/v1/users/me`: inherited user router

## 저장소 근거만으로 확정 가능한가

| Acceptance field | 저장소 근거 | 판정 |
| --- | --- | --- |
| Threshold | API P95 `<= 3s`가 requirements/closeout에 기록됨 | **확정 가능** |
| Candidate route inventory | generated OpenAPI + route source + current web imports | **이 문서에서 inventory 가능** |
| Target environment | production revision은 기록되어 있으나 Talos 기준의 측정 environment는 없음 | **OPERATOR/CLIENT DECISION REQUIRED** |
| Request count | browser는 scenario별 n=3, local JSON은 phase별 1/20/40뿐이며 Talos sample count는 없음 | **OPERATOR/CLIENT DECISION REQUIRED** |
| Concurrency and arrival model | local reference는 c=1/c=4 closed-loop지만 Talos 부하가 아님 | **OPERATOR/CLIENT DECISION REQUIRED** |
| Percentile algorithm | local evidence는 type 7; Talos acceptance가 type 7인지 미기록 | **OPERATOR/CLIENT DECISION REQUIRED** |
| Cold/warm definition | local cold는 fresh API process 후 readiness polling이며 infrastructure cold가 아님 | **OPERATOR/CLIENT DECISION REQUIRED** |
| Warm-up exclusion | local method는 warm phase 전에 one endpoint call을 둠; Talos inclusion rule 없음 | **OPERATOR/CLIENT DECISION REQUIRED** |
| Timeout | web client request timeout은 8초, window 내부 dependency timeout은 5초지만 Talos P95 timeout은 없음 | **OPERATOR/CLIENT DECISION REQUIRED** |
| HTTP success/error classification | route별 expected status는 있으나 P95 sample 포함·실패 판정 규칙은 없음 | **OPERATOR/CLIENT DECISION REQUIRED** |
| Endpoint aggregation | 기존 evidence는 endpoint/scenario별 집계이며 Talos가 하나로 합칠지 미기록 | **OPERATOR/CLIENT DECISION REQUIRED** |
| Mutation eligibility | production mutation 금지는 이 작업의 안전 경계이나 Talos scope 자체는 확정하지 않음 | **OPERATOR/CLIENT DECISION REQUIRED** |

## 권장 최소 측정 계약

아래는 실행 승인이 아니라, 결정을 받은 뒤 사용할 **권장안**이다. 값이 승인되지
않은 상태에서는 측정하지 않는다.

1. **Environment gate**: production 또는 production과의 차이를 명시한
   approved non-production 중 하나를 선택한다. non-production 결과는
   production P95로 표현하지 않는다. production을 선택하면 먼저 final
   revision/origin/approval을 대조한다.
2. **Endpoint matrix**: endpoint × cold/warm × concurrency 조건별 결과를
   분리한다. production 권장 최소 acceptance-bearing set은 `/live`, `/ready`의
   ready 상태, 그리고 별도 승인된 synthetic account의 read-only
   `GET /api/v1/observations/window`다. `GET /api/v1/observations/export`는
   production 반복 P95 load에서 기본 제외한다. client/operator가 Talos
   acceptance에 export가 필요하다고 명시적으로 결정한 경우에만 approved
   non-production synthetic fixture에서 별도 측정하며, 그 결과를 production
   P95라고 주장하지 않는다. mutation은 production에서 제외하고, 필요 시
   approved non-production에서 별도 matrix로 실행한다. `model_not_ready`는
   expected `503` contract probe로만 별도 보고한다.
3. **Request count**: warm P95는 endpoint·concurrency별 `n=100`을 권장한다.
   cold를 acceptance-bearing으로 요구하면 approved non-production에서 endpoint별
   독립 cold start `n=20` 이상을 별도 수집한다. cold `n=1`은 P95 evidence가
   아니다.
4. **Concurrency/arrival**: 비교 가능한 최소 조건으로 closed-loop `c=1`과
   최대 `c=4`를 제안한다. intentional delay, open-loop burst, automatic retry는
   사용하지 않고 실제 concurrency와 요청 간격을 기록한다. 다른 부하가 필요하면
   operator/client가 결정한다.
5. **Timer/percentile**: 요청 시작부터 full response body read까지의 elapsed
   milliseconds를 기록하고, P95는 명시적으로 Hyndman–Fan type 7
   (`(n-1) * p` linear interpolation)로 계산한다. P50, P95, max, n을 함께
   보존한다.
6. **Warm-up/cold**: warm-up call은 측정 n에서 제외한다. cold는 process/instance
   initialization의 정의와 readiness polling 시점을 기록하되, local evidence의
   정의를 infrastructure cold로 확대하지 않는다. cold와 warm samples를 합치지
   않는다.
7. **Timeout and classification**: per-request hard timeout은 current web
   contract에 맞춘 8초를 권장한다. timeout은 8초 값으로 clipping하지 않고
   failed sample로 기록한다. expected status인 정상 route의 `2xx`만
   acceptance-bearing success로 하고, expected `401/422/503`은 contract
   probe로 별도 집계한다. unexpected status, transport error, rate-limit,
   unexpected `5xx`는 run failure/stop condition으로 한다.
8. **Pass rule**: endpoint별 acceptance-bearing warm condition을 각각 판정하고,
   각 P95가 `<= 3,000ms`이며 unexpected/transport error가 0인 경우에만 해당
   endpoint/condition을 PASS로 제안한다. endpoint P95들을 하나의 합성 P95로
   만들지 않는다. 이 per-endpoint rule과 cold의 acceptance 여부는
   **OPERATOR/CLIENT DECISION REQUIRED**다.
9. **Retention**: aggregate-only 결과만 남긴다: revision/environment class,
   endpoint label, phase, concurrency, n, status counts, error counts,
   P50/P95/max, UTC measurement window. raw token, request/response body,
   Authorization header, cookie, user identifier, PHI, full request log는 저장하지
   않는다.

## Production safety boundary

production 실행을 선택하더라도 이 pre-flight가 실행 승인을 대신하지 않는다.
별도 approval이 있는 경우에도 다음 경계를 지킨다.

- real PHI, real clinical record, names, contacts, original documents,
  free-text medical histories를 사용하지 않는다.
- no-auth health와 승인된 synthetic read-only 경로만 허용한다.
- write endpoint load, delete/update/create, challenge mutation, export of
  product data, auth signup/login churn는 금지한다.
- low concurrency(max candidate `c=4`), bounded request count, closed-loop
  traffic, no retry, no ramp/saturation test로 rate-limit/DoS 위험을 낮춘다.
- 잘못된 origin/revision, real-data 발견, 429/rate-limit, unexpected 5xx,
  연속 timeout, auth/session 이상, resource saturation 또는 operator stop
  signal이면 즉시 중단한다.
- 요청·응답 body, token, cookie, header, raw timing line, full log를 보존하지
  않는다. 종료 뒤 생성된 synthetic fixture와 session의 cleanup 책임 및 결과를
  aggregate-only로 확인한다.

approved non-production을 택하면 그 결과의 environment, revision, topology,
data class를 명시하고 production equivalent 또는 production acceptance라고
주장하지 않는다.

## Approved operator verification contract

The operator contract is now explicitly approved for a later, separately gated
production run. It is not executed by this PR.

- target: production `bp7-api`, expected revision `bp7-api-00014-jeq`
- endpoints: `GET /live`, `GET /ready`, and the approved synthetic-account,
  read-only `GET /api/v1/observations/window`
- warm only; one excluded warm-up per endpoint/condition; closed-loop;
  concurrency `1` and `4` as separate conditions
- exactly `n=100` measured requests per endpoint/condition; no retry; timeout 8s
- measurement spans request start through complete response-body read
- P50/P95/max use Hyndman–Fan type 7; each endpoint/condition is judged
  independently; P95 `<= 3000.0 ms` and zero unexpected/transport errors is PASS
- cold start, export, mutation/write, auth churn, model execution, risk-signal,
  R2/UI/DB/deployment changes, and client acceptance are out of scope

The operator must perform a separate read-only target check before execution:
service `bp7-api`, expected revision `bp7-api-00014-jeq`, traffic `100%`. The
measurement tool does not call `gcloud`, change traffic, or change a revision.

## Tooling added in this PR

The bounded harness is [scripts/ops/measure_api_p95.py](../scripts/ops/measure_api_p95.py).
It has an exact GET/path allowlist, requires `--execute` plus the literal
operator confirmation for real execution, rejects non-HTTPS or malformed real
targets, disables redirects and retries, and writes only sanitized aggregate
evidence. `SK7_P95_BEARER_TOKEN` is read only from the environment and is sent
only to `window`; the token, headers, cookies, bodies, identities, health/BP
values, and raw timing rows are never retained or printed.

The offline verifier is
[scripts/ci/verify_api_p95_evidence.py](../scripts/ci/verify_api_p95_evidence.py).
Both tools have localhost-only/no-network self-tests wired into the local
reliability workflow. CI does not contact a production host.

Later production command template (do not paste a token into chat, GitHub,
Issues, PRs, or logs):

```bash
export SK7_P95_BEARER_TOKEN='<set locally; do not paste into chat>'
export SK7_P95_START_ON='YYYY-MM-DD'
export SK7_P95_END_ON='YYYY-MM-DD'

python scripts/ops/measure_api_p95.py \
  --execute \
  --confirm-operator-verification 'I_UNDERSTAND_OPERATOR_VERIFICATION_NO_PRODUCTION_LOAD_TEST' \
  --base-url '<production API base URL>' \
  --expected-revision 'bp7-api-00014-jeq' \
  --runner-label 'google-cloud-shell' \
  --output '<local aggregate JSON path>'
```

## First production attempt (sanitized diagnostic record)

The first production attempt is **INVALID / TOOLING DIAGNOSTIC** and is not an
operator P95 PASS or FAIL. It occurred before the corrected warm-connection
harness in this PR was reviewed.

- live `c=1` completed: `n=100`, P95 `46.297ms`, errors `0`
- live `c=4` stopped after `n=4`
- ready/window were not run
- Cloud Run `/live` server-side latencies were observed around `2–4ms`
- investigation found that the thread-local worker connections were not
  transport-warmed by the single main-thread warm-up
- no product writes, export, mutation, or model execution occurred
- at that snapshot, client acceptance was not claimed and corrected harness review was pending

No token, email, UUID, request body, or raw request log is retained here.

## This pre-flight result — historical snapshot before operator execution

- production load performed: **0**
- repeated authenticated production requests: **0**
- product data writes: **0**
- deploy / database / migration / model / UI changes: **0**
- operator verification contract at snapshot: **APPROVED / awaiting execution**
- client acceptance: **DECISION REQUIRED / NOT CLAIMED**
- production measurement at snapshot: **not performed**
- external API P95 <= 3s at snapshot: **UNVERIFIED**
- production network requests performed by this PR: **0**
- successor: [Issue #264 — perf: execute S4 API P95 verification](https://github.com/AI-HealthCare-05/AH_05_07/issues/264)

Issue #264는 위 결정이 기록된 뒤의 실행을 추적하는 successor Issue일 뿐이며,
그 자체가 production load 또는 authenticated request 실행 승인이라는 뜻은
아니다. 부모 [Issue #238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238)은
계속 열어 둔다.
