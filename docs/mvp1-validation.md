# 1회차 로컬 검증·제출 캡처 기록

2026-09-06, Issue #225. 검증 대상 runtime/migration 코드 기준은
`255c904414943e21ee0a8596690e2a1adebb3ebc`이며 이번 변경은 문서·도면·합성 캡처 도구다.
원래 사용자 checkout과 기존 데이터/모델 결과를 보존했다. 실제 원자료·frozen split·
test 파일을 열거나 해시하지 않았다. 기존 evidence·manifest·CONFIG·lock·model_not_ready는
기준 commit과 diff가 없음을 확인한다. PR #224에서 통과한 집계 verifier를 동일 파일에
다시 반복 실행하지 않았고, 그 결과를 새 실제 예측 재계산으로 표현하지 않는다.

## 환경과 결과

Windows, Node 24.11.0, npm 11.6.1, Python 3.13.14, uv 0.12.8, Docker Engine 29.6.1,
기존 설치 Supabase CLI 2.116.0, 기존 web lock의 Playwright 1.62.1을 사용했다.
`npm ci`, `uv sync --frozen --group app --group ai` 성공. 라이브러리/lock 변경 없음.
외부 Supabase 프로젝트에 link/login/query하지 않았다.

| 검사 | 실제 명령/방법 | 결과·exit | 적용 범위 |
| --- | --- | --- | --- |
| 기존 browser E2E | `CI=1 npm --prefix web run test:e2e` (PowerShell은 `$env:CI='1'`) | 25 + production fixture boundary1 = **26 passed**, 0 | AC-04/06/08, navigation, viewport/키보드/축소 모션·복구, mock API; 실제 Auth/RLS 아님 |
| store/API/health | 아래 pytest 명령 | 초기 31 passed + 환경 초기화 실패3; 보완 실행3 passed, 최종 해당 검사 모두 통과 | 실제 제품 저장소/계정에 연결하지 않음 |
| local pgTAP | `supabase test db --local --workdir <분리된 로컬 프로젝트>` | **3 files / 50 tests PASS**, 0 | ownership·challenge·exact-time retention17개 포함. 트랜잭션 fixture rollback |
| smoke 제어 | `python scripts/ci/verify_deployment_smoke.py --self-test` | passed, 0 | 임시 로컬 HTTP의 정상/실패 경계 |
| web build/비밀 경계 | E2E가 clean web build2회 수행; `python scripts/ci/verify_secret_boundary.py --web-dist web/dist` | passed, 0 | 최종 production build에 E2E fixture 비활성화; 공개 키/비밀 경계 |
| clean API build | tracked-source archive의 별도 디렉터리에서 `docker build -f app/Dockerfile -t sk7-mvp1-api:255c904 .` | passed, 0 | 로컬 Docker image만 생성. registry push/운영 deploy 없음 |
| local container smoke | web127.0.0.1:4185, API127.0.0.1:4186 대상으로 기존 smoke verifier | passed, 0 | web200/live/ready/CORS. synthetic 구성만 사용, 실제 DB readiness는 확인하지 않음 |
| 합성 캡처 | `node tools/mvp1-capture.cjs` | **8장**, 0; 외부 요청 없음·가로 넘침 없음 | 1366×768 /390×844, ko-KR, Asia/Seoul, reduced motion; full-page 출력 |
| 변경 검사 | Ruff check/format, JS syntax, Markdown 상대 링크·SVG XML, git diff --check | 통과 | 문서 내용 반복 테스트/새 의존성 추가 없음 |

API image ID는
`sha256:3affed1f1f5f537ba50858fb3e36730a75a20f9da9eb1fb57e6f88856e280ab9`다.
가변 base image/uv 태그가 있으므로 이 빌드는 byte-identical image 재현을 보장하지 않는다.
배포 revision·운영 CORS/Auth/만료 행·rollback은 [운영 준비](mvp1-operations-review.md)로 남는다.

### 테스트 환경 실패와 보완

처음에는 부모 MySQL fixture를 실행하지 않도록 `--noconftest`를 썼다. 이때 Tortoise
TestCase 기반 observation API3개가 DB 초기화 부재(`apps`)로 실패했고 나머지31개는
통과했다. 실패한3개만 별도 메모리 SQLite로 초기화해 통과했다. 제품 코드를 바꾸거나
실패를 숨기지 않았다. 일반 CI는 기존 MySQL fixture로 전체 app 검사를 수행한다.

```powershell
.venv/Scripts/python.exe -m pytest --noconftest app/tests/observation_apis/test_observation_api.py app/tests/test_observation_store.py app/tests/risk_signal_apis/test_risk_signal_api.py tests/health -q
```

실패했던 observation API3개에 사용한 별도 초기화(현재 작업 디렉터리에서 Python 실행):

```python
import pytest
from tortoise.contrib.test import initializer, finalizer
from app.core.db.databases import TORTOISE_APP_MODELS

initializer(TORTOISE_APP_MODELS, db_url="sqlite://:memory:")
try:
    result = pytest.main([
        "--noconftest", "app/tests/observation_apis/test_observation_api.py", "-q"
    ])
finally:
    finalizer()
raise SystemExit(result)
```

초기 Docker 엔진은 중지 상태여서 시작한 뒤 분리된 프로젝트
`sk7-mvp1-closeout-225`와5432x 대신5532x 포트를 사용했다. 별도 디렉터리에 원본
config/migrations/tests만 복사하고 로컬 project ID·포트만 변경했다. Windows 기본
문자 인코딩으로 config 복사에 실패한 단계는 UTF-8을 명시해 바로잡았다. 저장소
config와 SQL은 변경하지 않았다. `supabase db start --workdir <분리 경로>`와
pgTAP를 실행한 뒤 `supabase stop --project-id sk7-mvp1-closeout-225`로 해당 로컬
stack만 정지했다(exit0). 원래 프로젝트/컨테이너에 테스트를 실행하지 않았다.

API container는 `sk7-mvp1-api-225` 이름으로 loopback만 publish, legacy MySQL 비활성화,
`synthetic.invalid`와 합성 publishable 문자열을 구성했다. 실제 Supabase 요청 없이
smoke 후 해당 container만 정지했다. 임시 build/DB 로그는 로컬 외부 디렉터리에
보존하고 Git에 넣지 않았다. 영상·모델 파일·개별 예측·bootstrap 표본은 생성하지 않았다.

## 캡처와 검토

fixture 데이터는 기존 [evidenceFixtures](../web/src/lib/evidenceFixtures.ts)의 고정
합성 응답이며 실제 참가자의 값이 아니다. 혈압값은 현재 evidence UI의 마스킹을
유지한다. 캡처 도구는 provenance 띠만 추가하며 제품 문구·값·상태를 바꾸지 않는다.
실제 로그인/저장 성공을 연출하지 않는다. 아래 이미지는 직접 확인했다.

| 상태 | fixture / 장면 | 데스크톱 | 모바일 | 근거 |
| --- | --- | --- | --- | --- |
| 정상 회고 | VP-10 / S10 | [1366](evidence/mvp1/normal-1366.png) | [390](evidence/mvp1/normal-390.png) | 사실 lane 분리·마스킹, 모델 추이 아님 |
| 확정 빈 상태 | VP-04 / S12 | [1366](evidence/mvp1/empty-1366.png) | [390](evidence/mvp1/empty-390.png) | 정상 응답의 empty; 오류와 구분 |
| 불러오기 실패 | VP-11a / S13 | [1366](evidence/mvp1/error-1366.png) | [390](evidence/mvp1/error-390.png) | 다시 불러오기, empty 아님 |
| 모델 준비 중 | VP-10 / S11 | [1366](evidence/mvp1/not-ready-1366.png) | [390](evidence/mvp1/not-ready-390.png) | 결과를 표시하지 않는 실제 현재 문구 |

한글 줄바꿈·문장 자연화와 전체 화면 접근성 검토는 후속 개선이다. 이 캡처만으로
모든14화면의 운영/접근성 검증을 완료했다고 하지 않는다.

## 캡처 재현

서버가 없는 clean worktree에서 기존 web lock으로 `npm --prefix web ci` 후 실행한다.
fixture query는 **명시적 개발 harness 플래그**가 있어야 적용된다. 첫 캡처 시 플래그
누락으로 장면 대기에 실패했으며 플래그를 설정한 로컬 서버에서 다시 생성했다.

```powershell
# 터미널 A: 개발/촬영 전용. 운영 build 설정에 넣지 않는다.
$env:VITE_SK7_E2E_MODE='1'
npm --prefix web run dev -- --host 127.0.0.1 --port 4185 --strictPort

# 터미널 B: 정상/빈/오류/준비 중, 두 viewport 촬영
node tools/mvp1-capture.cjs
```

도구는 위 loopback 이외 요청을 차단한다. 출력 경로는 첫 인자로 변경할 수 있다.
촬영 뒤 터미널 A의 dev server를 종료하고 해당 세션 플래그를 해제한다. 기존
프로덕션 fixture boundary 검사는 변경하지 않는다. 최종 PR CI는 별도 source
commit에 연결되며 로컬 결과와 운영 증거의 구분을 유지한다.
