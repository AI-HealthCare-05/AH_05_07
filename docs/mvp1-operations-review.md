# 1회차 운영 검증 실행 준비

Issue #225의 **준비 문서**다. 이번 작업에서 운영 변경·계정·행 조작은 실행하지 않았다.
운영자가 환경·시간·합성 계정·대상 revision·정리 책임을 명시해 별도로 승인한 뒤에만
아래 절차를 수행한다. [배포 SSOT](deployment-ssot.md), [RLS 계획](deployed-rls-verification-plan.md),
[세션 체크리스트](email-link-session-verification.md)의 기존 경계를 유지한다.

공통 기록은 commit, web version/API revision, migration 파일명, 명령/시나리오,
시각·환경, pass/fail와 정리 상태뿐이다. JWT·메일·사용자/record ID·요청/응답 본문·
실제 값·전체 로그는 공유하지 않는다. 계정/식별자/토큰은 승인된 로컬 비공개 세션에서만
다룬다. production 콘솔 캡처를 제출 화면으로 쓰지 않는다.

## O1 — AC-04/06/08 사용자 흐름

**선행 조건:** 적용된 schema와 API/web release가 source와 연결됨, public smoke 통과,
실제 사용자와 분리된 합성 A/B 계정 승인, 오류 주입 방식·검증 창·정리 권한 확인.
로컬 합성 E2E는 이미 실행했으므로 같은 commit의 테스트를 다시 돌려 운영 증거로
이름만 바꾸지 않는다.

| 순서 | 실행 경로 / 조작 | 성공 기준 |
| --- | --- | --- |
| 1 | [정상 운영 웹](https://ah-05-07-pages.ahnsangkyoon.workers.dev)에서 합성 A 로그인, reload/new tab | owner window 로드. 인증 문자열 캡처 금지 |
| 2 | 혈압 기록 → 안내 확인 → 범위 밖/같거나 역전된 값 → 정정한 합성 유효값1회 저장 | 안내가 입력 전 표시, 잘못된 값은 저장되지 않음. API `POST /api/v1/observations/blood-pressure` extra/range 오류422, 유효201. 중복 클릭이 추가 write로 이어지지 않음 |
| 3 | 현재 기록 상세 → 수정 → 삭제 취소 → 삭제 확인 → reload | 취소는 DELETE 없음, 확인 뒤204 및 재조회 부재. S05는 확인된 성공 뒤에만 표시 |
| 4 | 챌린지1개 선택 → 첫 체크인 → 다른 action 선택 시도 | 활성1개, 체크인 뒤 action 교체 불가. 이후 check-in PUT은 status만 변경 |
| 5 | 체크인 status 수정 → 삭제 취소/확인 → reload | 현재 owned 범위만 변경, 이전/legacy 읽기 전용. action/date/owner 변경 거부 |
| 6 | 승인된 브라우저의 일시 offline로 읽기 실패/복구 확인 | 초기 실패를 빈 상태로 표시하지 않음, 기존 데이터는 stale로 유지, 명시적 retry |
| 7 | 별도 승인된 합성 세션 만료/무효화 후 정상 경로 접근 | 재로그인 안내, 토큰 검사/노출 없음. 만료 안 됐으면 미실행으로 기록 |
| 8 | 합성 window가 빈 경우와 오류 경우 비교 | 확정 empty S12와 실패 S13 분리 |

저장 중 timeout/응답 유실/스토리지503의 결정적 재현은 기존 mock E2E가 담당한다.
운영 backend를 중단하거나 정책을 바꾸어 재현하지 않는다. 운영 장애 주입이 승인되지
않으면 그 시나리오는 **로컬 합성 통과 / 운영 미실행**으로 남긴다. 불확실 write가
발생하면 자동 재시도하지 않고 먼저 재조회하여 저장 여부를 확인한다.

**정리:** offline 해제 → 중단한 테스트 요청 종료 → A/B 소유 합성 기록을 정상
삭제 경로로 정리 → 세션 종료/취소 → 승인된 Auth 계정 삭제와 관련 행 정리 확인.
만료로 owner 삭제가 불가능하면 O2의 승인된 관리자 정리 절차로 넘기며 우회하지 않는다.
공유 결과에는 정리 완료 여부만 남긴다.

## O2 — AC-05 실제 만료 행 접근

현재 운영 정상 owner/cross-user 증거(#149)에는 만료 행이 없다. 로컬
`exact_time_retention_rls_test.sql`은 17 assertions를 제공하지만 **그대로 운영에서
실행하면 안 된다**. 이 파일은 트랜잭션 내부에서 replication role을 바꾸어 합성
fixture를 만료시키므로, 이번 준비가 운영 trigger 우회 승인은 아니다.

**권장 운영 절차:** 별도 승인된 합성 계정/행을 정상 경로로 만들고 서버가 지정한
30일 deadline을 자연 경과시킨다. 이미 승인된 합성 행이 없다면 생성 시점부터
30일이 필요하다. 제출 일정 안에 근거를 못 얻는 경우 검증 미완료 또는 별도
환경 증거 수용 판단으로 남긴다. 서버 시간·기존 행·정책·cron을 바꾸지 않는다.

| 단계 | 명령/검사 위치 | 통과 기준 |
| --- | --- | --- |
| 사전 | `supabase migration list --linked`는 승인된 운영자 환경에서 inventory만 확인; 아래 HTTP 요청은 승인된 브라우저/API client의 비공개 인증 세션 사용 | source migration 목록과 대상 확인; command history/첨부에 토큰 없음 |
| 만료 전 | A의 `GET /api/v1/observations/window?start_on=…&end_on=…`, `GET /api/v1/observations/export?start_on=…&end_on=…`; B/익명 동일 시도 | A의 unexpired 행만 보임, B 비노출, 익명401. 범위는 기존 API의7일/30일 제한 안에서 고정 |
| deadline 기록 | 승인된 운영자 read-only 메타 확인으로 합성 대상의 서버 expires_at과 물리적 존재 여부를 비공개 기록 | 정확한 deadline을 확보하지 못하면 중단. 개인/제품 행은 읽지 않음 |
| 만료 후, purge 전 | A/B window/export 재조회; expired observation PUT/DELETE, check-in PUT/DELETE | 물리 행이 아직 있을 때도 비노출. 변경/삭제가0건 또는 계약의 비노출404; 성공으로 바뀌지 않음 |
| Auth/테이블 | 익명 Data API 및 다른 소유자 접근도 확인 | 익명 거부와 owner 조건이 만료 이후에도 유지 |

Window/export 기간은 만료 행의 observed_on을 포함하도록 미리 계획한다. 30일
만료 후 export의 기간 제한 때문에 포함할 수 없다면 해당 결과를 만료 RLS의
증거로 쓰지 않는다. 지원되는 원본 테이블 Data API의 승인된 합성 대상 조회로
RLS를 별도 확인하고, API export는 로컬 SQL/모의 store 근거로만 남긴다.
물리 purge 이후의 부재도 RLS 만료 차단의 증거가 아니므로 별도 기록한다.

**정리:** 만료 후 일반 owner delete가 막히는 것이 예상 동작이다. 승인된 관리자가
해당 합성 계정만 삭제하고 cascade 또는 정상 purge를 확인한다. 토큰 세션도 먼저
종료한다. 제거 권한/보존 기간이 승인되지 않았으면 실행 전 해결한다. 정리 실패 시
남은 합성 대상은 비공개 관리하고 “cleanup pending”만 공유한다.

## O3 — AC-10 깨끗한 환경 배포 재현

로컬 API image build와 smoke는 운영 배포/rollback이 아니다. 미래 운영자는
[SSOT](deployment-ssot.md)의 환경·시크릿 분류와 migration gate를 먼저 확인한다.
`scripts/deployment.sh`의 legacy Docker Hub/ai-worker 경로를 사용하지 않는다.

**선행 조건:** 사용자 승인된 release SHA, 별도의 깨끗한 checkout, Node/Python/uv 및
lock 버전 기록, Cloud Build 권한/Artifact Registry 목적지/Secret Manager 참조,
Supabase schema inventory, 현재/직전 API revision·Worker 전체 version ID와
traffic 비율, 실패 시 복귀 담당/시간을 확보한다. 변수가 비어 있으면 실행하지 않는다.
기존 Dockerfile의 base image/uv latest 태그는 변동 가능하므로 build provenance에
실제 image digest를 기록한다. frozen Python lock만으로 bit-identical image라 주장하지 않는다.

아래는 **미실행 명령 초안**이다. 식별자·시크릿 값을 문서에 넣지 않는다. 실제 승인된
운영 CLI 버전의 help와 목적지를 재확인한 후 변수값을 채운다.

```bash
# 별도 clean checkout에서 승인 SHA를 확인한 후
git rev-parse HEAD
uv sync --frozen --group app --group ai
npm --prefix web ci
npm --prefix web run build
python scripts/ci/verify_secret_boundary.py --web-dist web/dist

# cloudbuild.api.yaml의 유일한 image 치환. push는 별도 운영 승인 이후만.
gcloud builds submit --config cloudbuild.api.yaml --substitutions=_IMAGE="$APPROVED_IMAGE"
# 현행 Cloud Run 환경/secret/IAM/CORS를 보존; 먼저 no-traffic revision 작성
gcloud run deploy bp7-api --region asia-northeast3 --image "$APPROVED_IMAGE" --no-traffic
# 새 revision readiness 확인 및 변경 승인 후에만 traffic 이동
gcloud run services update-traffic bp7-api --region asia-northeast3 --to-revisions="$NEW_REVISION=100"

# Web 변경이 포함된 승인 release만: 실제 workflow 이름/입력을 먼저 읽어 확인
gh workflow view 'Sync deployment branch' --repo emotigom/ah-05-07-pages
gh workflow run 'Sync deployment branch' --repo emotigom/ah-05-07-pages

python scripts/ci/verify_deployment_smoke.py \
  --web-base-url https://ah-05-07-pages.ahnsangkyoon.workers.dev \
  --api-base-url https://bp7-api-292436735548.asia-northeast3.run.app
```

SSOT의 mirror workflow는 upstream main을 복사하므로 승인 SHA와 실행 시점의 main이
다르면 중단한다. 이 문서/도면/합성 도구 변경만으로 runtime release를 요구하지 않는다.
운영 재현 시험을 위해 같은 source를 배포하는 행위도 별도 승인 대상이다.

**통과:** source SHA → build image digest → Cloud Run revision → mirror snapshot →
Worker version이 연결되고 public200/live/ready/CORS 통과. 실제 record 경로는 O1의
승인된 합성 계정으로 별도 검증한다. `/ready`는 구성 존재만 검사하므로 storage 정상
판정에 쓰지 않는다. 기존 distinct version rollback/restore는 #151 이력으로 보존하되
새 clean release의 복구 가능성을 대신하지 않는다.

**복귀·정리:** 실패 즉시 새 traffic 확대 중단. API는
`gcloud run services update-traffic bp7-api --region asia-northeast3 --to-revisions="$PREVIOUS_REVISION=100"`.
Web은 [기존 rollback 절차](cloudflare-rollback-plan.md)로 직전 **전체 version** 복귀.
public smoke 후 승인된 목표로 restore하고 다시 smoke. DB downgrade를 즉흥 실행하지
않는다. 신규 test revision/image와 임시 권한 정리는 보존/감사 정책에 따라 승인된
대상만 수행하고, 원래 환경·traffic·합성 데이터 cleanup 상태를 기록한다.
