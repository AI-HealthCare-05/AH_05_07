# G2 로컬 신뢰성 검증

Issue #229는 **운영을 변경하지 않는 검증 기반**이다. 실행 기준은 PR #227의
`c46c772486a30319e594dbb9cf555263d5fba1a9`이며 API·DB schema·웹 동작을 수정하지 않았다.
도구는 새 외부 폴더에 지정 commit을 `git archive`로 내보내고, 실제 loopback
FastAPI → Supabase Auth → PostgREST → PostgreSQL 응답을 측정한다. ASGI transport나
모의 응답을 지연 측정에 사용하지 않는다. 기존
[운영 검증 계획](mvp1-operations-review.md)의 O1/O2/O3와
[운영 브라우저 소표본 이력](observation-load-baseline.md)은 별도 증거다.

## 실행과 보존

Node 24, 프로젝트 Python/uv frozen 환경, 로컬 Docker 엔진, Supabase CLI 실행 파일이
필요하다. 이번 검증은 기존 CLI 2.116.0을 사용했다. Windows에서는 npm PowerShell
wrapper 대신 설치된 native `supabase.exe` 경로를 `--supabase-bin`에 지정한다.
새 의존성이나 프로젝트 lock 변경은 없다. CLI가 선택한 컨테이너의 실제 image ID는
결과에 기록되므로, lock만으로 동일 컨테이너 바이트의 재현을 주장하지 않는다.

저장소 루트에서 다음을 실행한다. `<새 외부 폴더>`는 저장소 밖이며 존재하지 않아야
한다. 기존 폴더·사용자 checkout·기존 검증본은 덮어쓰지 않는다.

```powershell
python tools/local-reliability/test_controls.py
python tools/local-reliability/run.py --commit HEAD --output "<새 외부 폴더>" --supabase-bin "<설치된 CLI 실행 파일>"
```

기본 포트 묶음은45321–45330이다. Windows 예약 범위나 다른 서비스와 충돌하면
**기동 전에 중단**한다. 사용 가능한 다른10개 연속 포트를 확인한 후 새 폴더와
`--port <시작 포트>`로 실행한다. 전역 설정이나 기존 프로세스를 바꾸지 않는다.

| 단계 | 실제 검사 / 성공 기준 |
| --- | --- |
| 사전 | 새 외부 출력, 사용할 포트, local Docker named pipe/Unix socket, 지정 Git commit 확인. 원격 Docker context 거부 |
| 설치·빌드 | 새 checkout의 `uv sync --frozen --group app --group ai`, `npm ci`, `npm run build`, secret-boundary 검사 모두 exit0 |
| 별도 환경 | 임의 고유 project ID의 DB/Auth/Kong/PostgREST만 기동. DB1GiB·그 외 각384MiB, 컨테이너별 CPU1개 제한. 운영 URL 입력 인자 없음 |
| 정책 | 기존 pgTAP3개 suite·50 assertions. ownership/anonymous/active challenge/만료 접근과 보존기간 변경 거부 확인 |
| 실제 API | owner CRUD/export, 다른 사용자 비노출·PUT/DELETE404, 익명401, extra field422, 중복409, 첫 check-in 후 action 잠금, status 수정·삭제, model_not_ready503 |
| 지연 |8개 endpoint/scenario의 API process first call·순차 warm·동시 warm, 총488요청. 아래 방법으로 기록 |
| 장애·복구 | 이 run의 label을 다시 검사한 PostgREST만 중지. 실제 요청의 storage503 정규화 → 같은 컨테이너 재시작 →200복구. API는 `/ready`만으로 저장소 정상이라 판단하지 않음 |
| 정리 | 직접 생성한 자식 process 종료. 정확한 project ID로 `supabase stop --no-backup`; 자체 컨테이너·볼륨0개와 기존 실행 중 컨테이너 보존 확인 |
| 보존 | 승인된3개 model evidence·manifest·Python/web lock의 checkout 바이트 불변. 최종 report의 크기/SHA-256와 도구 snapshot 보존 |

Auth의 합성 계정·정답 없는 고정 합성 기록은 로컬 스택 안에서만 생긴다. 이메일
전송 서비스는 시작하지 않으며 요청/응답 본문, 토큰, 계정/행 식별자, 전체 로그를
파일로 저장하지 않는다. CLI status는 메모리에서만 읽는다. 자산·모델 입력·test 파일은
열거나 해시하지 않으며 기존 모델 API의 `503 model_not_ready`를 유지한다.

## 측정 해석

- endpoint마다 API process를 새로 시작한 뒤 readiness를 poll한다. 첫 요청은 **API
  process의 첫 endpoint 호출**이며 Auth/DB가 이미 준비된 상태다. `/ready`는 poll로
  이미 호출된다. 완전히 차가운 운영 인프라나 cold-start 분포가 아니다.
- 첫 호출1건 뒤 순차20건(concurrency1), 다음40건(concurrency4)을 측정한다. cold1건에
  의미 있는 tail 분포가 있다고 해석하지 않는다. 기간의 시작/끝 UTC를 각 phase에 기록한다.
- client는 요청별 urllib opener를 사용하며 응답 body를 모두 읽을 때까지
  `perf_counter_ns`로 잰다. thread는 완료 직후 다음 요청을 보내는 closed-loop 방식이다.
  의도적 간격은0이며 최대4요청만 동시에 보낸다. Uvicorn worker는1개다.
- P50/P95는 정렬한 값의 `(n−1)×p` 위치를 선형 보간하는 Hyndman–Fan type7이다.
  상태별 건수·transport error와 **예상 상태에서 벗어난 비율**을 따로 기록한다.
  의도된401/422/503은 예상 계약 결과이며 운영 availability 성공률로 합치지 않는다.
- 기존 사용자 컨테이너·호스트 background 작업을 그대로 둔다. 측정 조정이 필요하면
  `--wait-for-measurement-signal`을 쓴다. `measurement-ready.json` 생성 후300초 안에
  조정자가 렌더링 중지를 확인한 `start-measurement.json`을 작성한다. 그 사실만 기록하며
  모든 background load가 제거됐다는 뜻은 아니다. deadline이 지나면 중단·정리한다.
- 작은 합성 fixture, 한 Windows 호스트, loopback 네트워크, 고정된 요청 수의 집계다.
  운영 부하·인터넷·지역·실제 기기 분포, 지속 부하·포화 한계, 실제 사용자 결과를
  대표하지 않는다. Talos의 운영 API P95 3초 조건을 충족했다는 증거가 아니다.

조정 신호 형식(로컬 전용, 사실을 확인한 뒤 작성):

```json
{"renderer_paused": true, "other_background_work": "기존 사용자 컨테이너와 일반 호스트 작업은 유지"}
```

## 실패·복구와 증거 범위

실패하면 다음 측정 단계로 넘어가지 않고 `report.json`의 stage/exit code와 안전한
원인만 보존한다. 정상 stderr 자체를 실패로 판단하지 않는다. 출력 폴더를 재사용하는
자동 retry는 없다. 실패를 수정한 경우 이전 폴더를 보존하고 새 폴더에서 실행한다.

강제 중단으로 정리가 끝나지 않았으면 `resume.json`의 **정확한 자체 project ID**와
출력 폴더를 확인한 뒤 다음만 실행한다. `--all`, Docker global prune, 기존 사용자
volume 삭제는 사용하지 않는다. source/runner snapshot과 집계 report는 보존한다.

```powershell
supabase stop --project-id "<resume.json의 project_id>" --no-backup --workdir "<해당 출력 폴더>/stack"
docker ps -aq --filter "label=com.supabase.cli.project=<동일 project_id>"
docker volume ls -q --filter "label=com.supabase.cli.project=<동일 project_id>"
```

비정상 종료 뒤 자체 API/web process가 남으면 출력에 기록된 전용 포트의 명령·PID를
대조한 후 그 process만 종료한다. 다른 PID를 포트 이름만 보고 종료하지 않는다.
정리 실패는 “검증 성공”으로 바꾸지 않는다. 로컬 디스크 보존은 독립 백업이 아니다.

Windows/Linux CI는 URL/redirect·환경 오염·원격 Docker 거부·출력 보존·집계 산술의
dependency-free controls를 실행한다. 실제 API의 지연값이나 SQL을 CI에서 재계산한
증거가 아니다. 기존 일반·합성·committed model evidence CI는 그대로 유지한다.

## 실행 결과와 남은 조건

2026-09-06 Windows 실제 실행은 도구 commit
`8cf8f7263abef365485da1ba06ddf83c4852c92a`에서 수행했다. 이 commit의 제품 API/DB는
기준 main과 동일하다. Python3.13.14, uv0.12.8, Node24.11.0, FastAPI0.128.0,
Uvicorn0.40.0, httpx0.28.1, Supabase CLI2.116.0, Docker29.6.1을 사용했다.
32개 명령 단계 모두 exit0, pgTAP50 assertions, 실제 API 흐름과 장애/복구가 통과했다.
자체 API/web port 닫힘과 컨테이너·볼륨0개를 확인했으며 기존 사용자 컨테이너3개는 유지됐다.

[공개 집계 JSON](evidence/local-reliability.json)은 로컬 run B의 report와 바이트가
동일하다. 최종 report의 SHA는 로컬 manifest에 기록했다. Git에는 도구·문서·집계만
추가하며 원자료·모델 파일·합성 요청/응답·계정·토큰·전체 로그는 추가하지 않았다.

**호스트 부하 해석:** 측정 시작 신호에서 렌더링·다른 브라우저 작업을 중지하도록
조정했으나, 이후 G5의 합성 fixture 검사1개(Chromium software WebGL)가
UTC18:48:49–18:49:26에 겹쳤다. PUT owner 단계 끝부분과 anonymous window 단계에
겹치며 아래 수치를 수정하거나 선택적으로 다시 측정하지 않았다. JSON의
`measurement_coordination`은 시작 당시 조정 신호이고, 전 구간의 무부하 확인이 아니다.
이 결과는 **병행 작업이 일부 존재한 로컬 관측**이며 isolated-host 기준선으로 쓰지 않는다.

단위는 ms다. 각 행의 최초 호출은 n1, 순차 warm은 n20, 동시 warm은 n40이다.

| 실제 endpoint / 시나리오 | 예상 status | 최초 호출 | 순차 P50 / P95 | 동시4 P50 / P95 |
| --- | --- | ---: | ---: | ---: |
| `GET /live` | 200 | 51.91 | 55.26 / 63.83 | 156.70 / 226.06 |
| `GET /ready` | 200 | 68.54 | 61.44 / 77.41 | 206.70 / 367.19 |
| `GET /observations/window (owner)` | 200 | 242.97 | 213.78 / 251.09 | 959.76 / 1409.14 |
| `GET /observations/export (owner)` | 200 | 354.79 | 341.03 / 527.20 | 1388.90 / 2392.39 |
| `PUT /observations/blood-pressure (owner)` | 200 | 338.00 | 239.66 / 333.91 | 806.47 / 1748.00 |
| `GET /observations/window (anonymous)` | 401 | 674.75 | 914.77 / 2089.92 | 526.13 / 2533.85 |
| `POST /observations/blood-pressure (invalid)` | 422 | 61.53 | 81.22 / 109.90 | 279.01 / 378.46 |
| `POST /risk-signal (not ready)` | 503 | 84.05 | 62.05 / 77.88 | 181.39 / 239.01 |

488개 정상·예상 오류 시나리오와 별도의 저장소 장애1회, 총489개 측정에서 예상과
다른 응답/transport error는0건이었다. 저장소 중지 시 실제 window 응답은
`503 observation_storage_not_ready`, 5242.26ms였으며 PostgREST 복귀 뒤200을 확인했다.
이것은 bounded fault1회이며 장애 tail 분포가 아니다. 생성·삭제·challenge 변경은
실제 기능 경로로 검사했지만 반복 지연 분포를 측정하지 않았다. 모든 API를 포괄한
성능 승인이나 SLA 검증으로 확대하지 않는다.

Windows/Linux CI의7개 controls와 committed aggregate 검사는 최상위/phase 필드,
표본/오류율 산술, 유한 지연값·분위수 순서를 검사한다. raw timing이 공개되지 않으므로
P95를 독립 재계산하지 않으며 HTTP/SQL을 재실행하지 않는다. source/정리와 내용의
적정성은 실제 로컬 실행 및 이 문서의 검토 기록과 함께 읽어야 한다.


O1 운영 사용자 흐름, O3 실제 clean release/rollback 및 운영 P95는 승인된 환경·
합성 계정·release SHA·측정 창·표본/부하 설계·정리 책임이 정해진 뒤 별도로 수행한다.
[배포 SSOT](deployment-ssot.md)의 schema/release gate를 우회하지 않는다.

O2는 실제 서버가 정한30일 deadline을 자연 경과시키고 **purge 전 물리 행이 있는
동안** owner/cross-user/anonymous의 접근 차단을 관찰해야 한다. 이번 pgTAP는 transaction
안의 합성 fixture로 시간을 재현하며 운영 시간을 변경하지 않았다. 별도 환경 결과의
대체 수용 여부는 외부 판단이고, 운영 자연 만료 관찰 완료로 바뀌지 않는다.
2026-09-06에 정상 생성해도 가장 빠른 자연 만료는10월6일이므로9월21일 제출 일정과의
간격은 그대로 남는다. 1회차는 진행 중이다.

공식 도구 기준: [Supabase CLI local development](https://supabase.com/docs/guides/local-development/cli/getting-started),
[changelog](https://supabase.com/changelog)와 실제2.116.0의 `init/start/status/test db/stop --help`를
확인했다. 이번 작업은 기존 migration을 별도 로컬 환경에서 검증하며 운영/self-hosted
gateway 설정이나 Supabase schema를 새로 설계하지 않는다.
