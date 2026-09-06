# S3 companion 런타임 기반

Issue #244의 S3 기반 단계다. 이 문서는 S2의 사용자 `selected` 결정과 S3B
게시를 런타임 활성화로 확장하지 않는다. 화면별 사용 범위와 동작 제한은
[S2 기록](s2-design-selection.md)의 Issue #242 사람 결정에 따른다.

## S3 상태

- S3A: 사람 사용 범위·동작 제한·권리 결정 완료.
- S3B: `companion/v1/` 11종 `standard/lite` 22개 R2 게시 및 source↔remote/public
  byte/SHA/header 검증 완료. 상세 근거는 [companion-r2-v1.json](evidence/companion-r2-v1.json)이다.
- S3C: review runtime 구현 및 자동 검증 완료. [Issue #248](https://github.com/AI-HealthCare-05/AH_05_07/issues/248)의
  명시적 query selection으로만 실제 GLB를 읽는다.
- production activation: **NOT APPROVED**. `VITE_SK7_COMPANION_MODE` 기본값은
  계속 `off`이며, 운영 화면·자동 species 배정·모델/위험/BP 연동은 하지 않는다.

## 중앙 계약

웹 계약은 [`web/src/ui/companion.ts`](../web/src/ui/companion.ts)에만 둔다.
species는 `bear`, `rabbit`, `cat`, `dog`, `red_panda`, `otter`, `capybara`,
`hedgehog`, `penguin`, `fox`, `squirrel` 11종이며 `seal`은 포함하지 않는다.
clip은 `idle`, `greet`, `move`, `curious`, `celebrate`, `rest`, `special` 7개다.
문자열 배열과 타입을 함께 사용해 임의 값이 계약을 우회하지 않도록 한다.

## 게이트와 자산 경계

`VITE_SK7_COMPANION_MODE`가 정확히 `review`일 때만 명시적 로컬 검토 모드로
해석한다. 누락·빈 문자열·오타·다른 값은 모두 `off`다. [`CompanionRuntimeBoundary`](../web/src/components/CompanionRuntimeBoundary.tsx)는
mode, 허용 화면, explicit species/variant/clip, animation policy를 모두 통과한
뒤에만 `CompanionReviewRenderer`를 lazy import한다. [evidence manifest](evidence/companion-r2-v1.json)를
읽는 generator가 만드는 [`companionAssets.generated.ts`](../web/src/ui/companionAssets.generated.ts) 외의
URL/version/file name은 사용하지 않는다.

화면 정책은 S02 오늘의 기록, S03 7일 챌린지 선택, S05 저장 완료, S10 7일
돌아보기만 review 후보로 둔다. S04, S07, S08, S09, S11, S12, S13, S14는
중앙 정책에서 제외한다. 이는 비운영 review 범위이며 최종 운영 화면 배정이 아니다.

## 동작 의미 경계

- `idle`, `greet`, `curious`, `rest`: 일반 검토 후보
- `celebrate`: S05의 명시적 `save_success` UI 이벤트에서만 조건부
- `move`: `non_semantic` 장면 이동에서만 조건부
- `special`: 별도 검토 전 보류

정책 함수는 화면·clip·비의미적 UI context만 받는다. 혈압 수치/변화, 위험 점수·
위험군, 모델 결과·준비 상태, 챌린지 성공률, 건강 개선 여부는 입력 타입이나
분기 조건에 존재하지 않는다. `celebrate`가 정상 혈압·위험 감소·건강 개선을
표현하는 경로도 없다.

## 접근성 및 실패 격리

기존 화면은 companion 없이도 정보·폼·탐색을 제공한다. canvas와 bounded slot은
`aria-hidden`, `pointer-events: none`이며 tab index·accessible name이 없다.
renderer 오류는 error boundary와 loader failure path에서 장식만 제거하고 본문·버튼·
폼·탐색에 전파하지 않는다. `prefers-reduced-motion: reduce`는 host가 읽은
presentation boolean으로 전달하며, reduced motion에서는 animation mixer/지속 RAF를
시작하지 않는다.

## 자산 및 운영 경계

S3B에서 승인된 22개 GLB를 `companion/v1/`에 게시했고, S3C는 그 public URL을
review-only로 읽기만 한다. GLB Git 추가, 로컬 자산 복사, 생성·모델링·재렌더,
일반 사용자 활성화, 모델/ML 변경, test 접근은 하지 않았다. Three.js `0.185.1`과
`GLTFLoader`는 product entry에서 정적으로 import하지 않고 gate 뒤 lazy chunk에서만
로드한다. 기존 `visual/v1/` 자산은 대체하지 않는다.

## 검증 범위

`web/e2e/companion-runtime.spec.ts`는 production/off에서 renderer chunk와 GLB 요청이
없는지 검증한다. `npm run test:e2e:review`의 review suite는 22/22 GLB load, 각
7 clip runtime name set, 허용/조건부/차단 policy, 제외 화면 network=0, reduced motion,
404/abort 실패 격리, 1366/390/320 responsive 경계를 실제 브라우저에서 검증한다.

S3C CORS는 변경 전 Wrangler read-only 결과(Workers origin 1개, `GET, HEAD`)를
기록한 뒤 local Playwright fetch 실패를 재현하여 최소 변경했다. 최종 origin은
`https://ah-05-07-pages.ahnsangkyoon.workers.dev`와 `http://127.0.0.1:4173` 두 개이며,
methods `GET, HEAD`, wildcard·credentials 없음이다. 4175 등 다른 local port는 허용하지
않는다. 변경은 R2 CORS 설정에만 적용했고 GLB object는 수정하지 않았다.

## S3C 측정 결과

- baseline `origin/main` main JS: 233,732 raw / 71,800 gzip bytes
- after S3C main JS: 237,275 raw / 73,181 gzip bytes
- lazy review renderer chunk: 627,706 raw / 161,318 gzip bytes
- approved GLB bytes: lite 11종 합계 `6,063,464`, standard 11종 합계
  `11,803,720`, 전체 `17,867,184` bytes (evidence 기준)
- valid first companion render: lazy renderer chunk 1개 + GLB 1개, 추가 network 2회
- production/off initial route: renderer chunk 0, companion GLB 0
