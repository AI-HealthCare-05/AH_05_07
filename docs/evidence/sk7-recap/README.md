# S10 ‘7일 돌아보기’ — review-only 후보

Issue [#402](https://github.com/AI-HealthCare-05/AH_05_07/issues/402) · branch `codex/sk7-recap` · worktree `/Users/gom/Projects/AH_05_07-sk7-recap`.

기준은 PR #401의 squash main **`f857f0d2256386cae58f8cceba3495fb521df75d`**이며, 착수 및 push 전 canonical `origin`의 main과 일치했습니다. 구현 commit과 Draft PR은 아래 최종 전달 정보와 `verification.json`에 기록합니다. 기존 main worktree, `codex/sk7-journey`와 그 worktree, 원본의 미추적 handoff 파일은 보존했습니다.

**S10 사용자 시각 승인: PENDING.** #401의 S02/S04/S05 승인을 이번 S10에 적용하지 않습니다. main 병합 / mirror sync / 운영 배포 / production scene activation은 미실시입니다.

## 화면 변화와 보존 경계

- review에서만 제목을 ‘7일 돌아보기’로 표시하고, 연도·현재/이전 구간·실제 날짜 범위·읽기 전용 상태를 먼저 보여줍니다. 기존 기간 선택 callback과 버튼 disabled 조건을 재사용합니다.
- 요약 숫자 카드 대신 혈압 관찰, 챌린지 체크인, 이전 방식 기록의 저널을 제공합니다. 날짜, 아침/저녁, 저장된 BP 값, 기록함(completed)/건너뜀(skipped), 상세 보기를 분리했습니다. 표시하는 수는 각 배열의 **기록 개수**입니다.
- 현재 챌린지는 별도 영역입니다. `activeChallengeCheckins`가 선택한 window의 체크인에서 파생되는 기존 사실을 유지하고 ‘선택한 구간 안의 체크인 기록’이라고 명시했습니다. 전체 누적 성과로 표시하지 않습니다. 합성 current는 체크인 3개 중 활성 챌린지 소속 2개, prior는 3개 중 활성 소속 0개입니다.
- 데스크톱은 풍경·현재 챌린지를 왼쪽, 기록 저널을 오른쪽에 배치합니다. 1000px 이하에서는 단일 열로 기록과 파일 도구를 먼저 보여주고, 오늘의 풍경과 현재 챌린지가 뒤따릅니다.
- 초기 loading/S13 오류, refresh 중, refresh-error의 보존된 기록과 ‘최신 여부 미확인’ 경고를 구분합니다. 미확인을 0건으로 표시하지 않습니다.
- App의 요청/날짜/세션 guard, state/effect/key, `selectDashboardWindow`, `exportRecentRecords`, `refreshWindow`, 저장 이벤트, 상세 callbacks를 변경하지 않았습니다. S09의 기존 복귀 목적지는 S08입니다. prior/legacy/비활성 체크인의 수정·삭제 경계와 prior의 export/refresh disabled를 유지합니다.
- 정확히 `VITE_SK7_SCENE_MODE === "review"`일 때만 새 컴포넌트를 렌더합니다. missing/off/invalid/production의 기존 S10 JSX와 gate는 그대로입니다. S02/S04/S05, 전역 헤더/하단 내비게이션, S08/S09의 표현은 변경하지 않았습니다. CSS는 `.journey-recap` 내부로 제한됩니다.
- API/DB/auth/topology, 배포 설정, dependencies/lockfile, CI workflow, Model V2/11 features/모델 결과, S11 저장, 로그/analytics, renderer lifecycle, GLB/clip/asset identity, scene recipe/camera는 변경하지 않았습니다. 입력 기반 위험군 선별 신호, 측정 혈압, 챌린지 참여는 결합하지 않습니다.

변경 파일: `web/src/App.tsx`, `web/src/components/JourneyRecap.tsx`, `journey-recap.css`, 합성 fixture/preview/capture scripts, 새 `recap-candidate.cases.ts`와 기존 suite의 import 및 production URL 차단 사례, 이 증거 디렉터리입니다.

## 실행 가능한 로컬 검토

```sh
cd /Users/gom/Projects/AH_05_07-sk7-recap
npm --prefix web ci
JOURNEY_REVIEW_PORT=4189 node web/scripts/preview-journey-review.mjs
```

[S10 혼합 기록 열기](http://127.0.0.1:4189/?e2e=signed-in&screen=S10&recap_fixture=mixed). 이미 실행 중이면 같은 포트를 다시 실행하지 않고 이 URL을 엽니다. 중지 후 위 명령으로 다시 빌드할 수 있습니다.

loopback에만 바인딩하는 기존 harness를 확장했습니다. 합성 인증은 빌드 시 기존 E2E flag와 local fixture script로만 열립니다. URL만으로 일반/production 빌드에 인증이나 review를 켤 수 없습니다. preview는 GET/HEAD만 제공하고 API 응답은 탭 메모리에서 만듭니다. 지원하지 않는 API 요청은 성공 mock으로 처리하지 않습니다. 일반 BP 저장 preview는 기존처럼 **120 / 80**만 허용하며 네트워크 쓰기·영속 저장은 없습니다. 합성 download는 파일명 `synthetic-sk7-...json`과 본문의 `synthetic: true`로 표시합니다.

`recap_fixture` 값을 바꾸고 페이지를 새로 열면 탭 상태가 초기화됩니다:

| 값 | 확인 내용 |
|---|---|
| `mixed` | BP 2개, 체크인 3개(completed 2 / skipped 1), legacy 1개. current/prior GET의 실제 구간별 날짜·ID |
| `empty` | 세 종류의 확인된 빈 기록, 활성 챌린지 없음 |
| `no-bp`, `no-checkins`, `no-legacy` | 해당 종류만 빈 상태 |
| `loading` | 첫 GET을 4초 지연, 0건 표시 없이 초기 loading |
| `initial-error` | 초기 GET 503, 기존 S13 불러오기 실패 |
| `refresh-error` | 첫 GET 성공 후 새로고침 503, 기존 기록과 stale 경고 유지 |
| `export-error` | 합성 내보내기 503, 기록 유지·재시도 가능 |

S02에서 기존 ‘7일 돌아보기’ → S10 → 상세 보기 → S09의 ‘목록으로 돌아가기’ → S08 → 기존 ‘7일’ 내비게이션을 확인할 수 있습니다. prior 선택 시 이전 날짜와 읽기 전용 표시가 바뀌어도 풍경 날짜는 서울 오늘이며, 챌린지 시작/종료 기간과 관찰 구간은 별개입니다. 날짜별 풍경은 저장·내보내기·참여의 보상이 아닙니다.

## 전후 캡처

모두 **로컬 합성, 서울 2026-09-11 12:00, reduced motion, Playwright Chromium**입니다. `current`/`prior`는 `mixed`, `stale`은 `refresh-error` 후 새로고침입니다. baseline과 candidate는 동일 fixture/capture script/날짜/viewport/motion을 사용했습니다. 기존 #401의 캡처 36장은 재생성·수정하지 않았습니다.

| 상태 / 화면 크기 | Before first-fold | After first-fold | Before full-page | After full-page |
|---|---|---|---|---|
| current 320×568 | [보기](before/S10-current-320x568-viewport.png) | [보기](after/S10-current-320x568-viewport.png) | [보기](before/S10-current-320x568.png) | [보기](after/S10-current-320x568.png) |
| current 390×844 | [보기](before/S10-current-390x844-viewport.png) | [보기](after/S10-current-390x844-viewport.png) | [보기](before/S10-current-390x844.png) | [보기](after/S10-current-390x844.png) |
| current 1366×768 | [보기](before/S10-current-1366x768-viewport.png) | [보기](after/S10-current-1366x768-viewport.png) | [보기](before/S10-current-1366x768.png) | [보기](after/S10-current-1366x768.png) |
| prior 390×844 | [보기](before/S10-prior-390x844-viewport.png) | [보기](after/S10-prior-390x844-viewport.png) | [보기](before/S10-prior-390x844.png) | [보기](after/S10-prior-390x844.png) |
| stale 390×844 | [보기](before/S10-stale-390x844-viewport.png) | [보기](after/S10-stale-390x844-viewport.png) | [보기](before/S10-stale-390x844.png) | [보기](after/S10-stale-390x844.png) |

정확한 저장 경로는 이 디렉터리의 `before/`, `after/`입니다. full-page 이미지의 고정 내비게이션은 원래 viewport 위치에 남을 수 있으므로 실제 첫 화면과 조작 가능성은 `-viewport.png` 및 키보드 검증을 함께 봅니다. 이미지 SHA256과 소스 SHA256은 `verification.json`에 있습니다.

```sh
# 현재 후보를 별도의 ignored 출력 경로에 재현
RECAP_URL=http://127.0.0.1:4189 node web/scripts/capture-recap-review.mjs \
  web/test-results/living-scene-review/recap-captures
```

before는 새 worktree를 기준 SHA에 만든 직후, UI를 편집하기 전에 빌드해 메모리에 고정한 `4187` preview에서 캡처했습니다. 재현 시에는 기존 worktree를 변경하지 말고 별도 임시 디렉터리에 기준 source를 풀고, 이번 로컬 fixture/preview/capture scripts만 복사합니다:

```sh
recap_base_dir=$(mktemp -d /tmp/sk7-recap-baseline.XXXXXX)
git archive f857f0d2256386cae58f8cceba3495fb521df75d | tar -x -C "$recap_base_dir"
cp web/scripts/{journey-review-fixture,preview-journey-review,capture-recap-review}.mjs "$recap_base_dir/web/scripts/"
npm --prefix "$recap_base_dir/web" ci
JOURNEY_REVIEW_PORT=4187 node "$recap_base_dir/web/scripts/preview-journey-review.mjs"
# 별도 터미널에서 위 capture 명령의 RECAP_URL을 4187로 지정합니다.
```

풍경 면적은 기본 글자 크기에서 아래와 같이 변경됐습니다. 높이는 기존 recipe 값을 사용합니다. recipe, camera와 캐릭터 bounds 기준을 수정하지 않았습니다.

| viewport | baseline stage (CSS px) | candidate stage (CSS px) |
|---|---|---|
| 320×568 | 255.625 × 240 | 268.438 × 240 |
| 390×844 | 325.625 × 280 | 330.438 × 280 |
| 1366×768 | 1068.75 × 420 | 529 × 420 |

## 검증과 CI

| 검사 | 결과 |
|---|---|
| TypeScript + Vite build / companion·scene manifest 사전 검증 | PASS; 각 필요한 gate의 기존 build 사용 |
| `CI=1 npm run test:e2e:scene` | Chromium 73 PASS, 새 S10 21개 및 기존 장면·서울 자정 guard 포함 |
| WebKit 새 S10 사례 | 21 PASS: 같은 UI의 17개 성공 증거 재사용 + 플랫폼 키 수정 후 포커스 4개 PASS |
| S02/S04/S05 국소 회귀 | 기존 journey 7개 + pending/refresh-error/재방문 저장 표현 3개, 총 10 PASS |
| 기존 missing-gate S10/S08/S09 회귀 | navigation/export/분리된 사실/prior/detail/refresh 10 PASS |
| 실제 production build의 URL/auth/review 차단 | 3 PASS; S10 `recap_fixture` URL 사례 추가 |
| 스크립트 syntax / `git diff --check` | PASS |

```sh
cd web
CI=1 npm run test:e2e:scene
# WebKit 재현; 물리 Safari가 아님
npx playwright test --config=playwright.scene.config.ts --browser=webkit --grep 'recap '
CI=1 npx playwright test --config=playwright.saved-scene.config.ts \
  --grep 'journey candidate|persistence and refresh pending|confirmed save remains truthful|remount/back/forward'
CI=1 npx playwright test --config=playwright.production.config.ts
CI=1 npx playwright test e2e/journey-navigation.spec.ts e2e/ux-reliability.spec.ts e2e/signed-in-harness.spec.ts \
  --grep 'navigation updates|own URL|export|separate labels|prior|separated record detail|disappears after refresh|refresh failure retains'
```

개발 중 낮춘 장면 높이는 기존 캐릭터 최소 높이 검사 7개에서 실패해 해당 실행을 중단했습니다. 영향은 review 후보의 장면 프레이밍이며, 기준 main의 CI 실패가 아닙니다. 기존 높이를 복원하고 전체 scene suite 73개로 확인했습니다. 기대값/required checks를 느슨하게 바꾸지 않았습니다.

WebKit 최초 실행의 4개 실패는 macOS 기본 Tab이 버튼을 건너뛰는 동작으로 baseline·candidate 모두에서 재현됐습니다. 해당 플랫폼에서 Option-Tab을 사용하며 **같은 버튼의 포커스 기대값**을 유지했습니다. 나머지 17개 성공은 반복하지 않았습니다. 재검증 중 공유 테스트 서버가 종료되어 발생한 connection-refused 실행은 UI 결과로 계산하지 않고 독립 로컬 preview에서 해당 4개를 검증했습니다.

Baseline push CI는 [CI](https://github.com/AI-HealthCare-05/AH_05_07/actions/runs/34516377722), [Browser E2E](https://github.com/AI-HealthCare-05/AH_05_07/actions/runs/34516377696), [Local reliability controls](https://github.com/AI-HealthCare-05/AH_05_07/actions/runs/34516377704), [Local character preview](https://github.com/AI-HealthCare-05/AH_05_07/actions/runs/34516377716), [Synthetic question review](https://github.com/AI-HealthCare-05/AH_05_07/actions/runs/34516377737) 모두 **SUCCESS**입니다. 같은 baseline SHA 검사는 다시 실행하지 않았습니다.

Candidate CI는 baseline과 분리하여 Draft PR checks에서 확인합니다. 활성 main ruleset의 required checks는 `lint`, `test`입니다. 진행 중인 검사는 PENDING이며 로컬 성공이나 과거 CI를 새 SHA의 성공으로 대체하지 않습니다.

실기기 Safari/Android, VoiceOver, GPU/FPS/peak memory, 운영 네트워크/캐시, 실제 API/DB 쓰기와 R0 조사는 미수행입니다. Playwright 결과는 기능/배치 검증이며 새 면적의 실기기 성능 PASS가 아닙니다. 최종 공개 후보의 성능 검증은 #390, Model V2 연구는 #396에 남깁니다.

## 최종 전달 정보

- 구현 HEAD: `09c5ce95005dac211302a1847023311714349b73`. 전후 캡처와 로컬 검증은 이 구현의 UI 소스에 해당합니다.
- Draft PR: [#403](https://github.com/AI-HealthCare-05/AH_05_07/pull/403). 최종 branch HEAD에는 이 전달 정보를 기록한 문서 전용 후속 commit이 포함됩니다. 정확한 최종 HEAD는 PR의 `headRefOid` 및 전달 메시지에서 확인합니다.
- Candidate CI: **PENDING** (증거 문서 작성 시). [해당 PR checks](https://github.com/AI-HealthCare-05/AH_05_07/pull/403/checks)와 PR 본문에 최종 HEAD의 상태를 별도로 기록합니다. baseline 5개 SUCCESS와 구분하며, 진행 중인 검사를 성공으로 간주하지 않습니다.
- 기존 작업 공간을 정리하거나 이전 브랜치에 commit하지 않았습니다. 새 브랜치만 push했습니다.
- 사용자 S10 시각 승인 PENDING. main 병합 / mirror sync / 운영 배포 / production scene activation 미실시.
