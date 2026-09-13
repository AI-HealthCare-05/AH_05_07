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
- S3D visual acceptance: **APPROVED**. [결정 기록](s3d-companion-visual-acceptance.md)은
  `bear` primary, `lite` candidate, S05 `save_success` only로 범위를 좁힌다.
- S3E production rollout: **COMPLETE**. exact `production` mode는 고정된 S05
  `bear`/`lite` profile만 만들고, confirmed save 이후 같은 GLB의 mixer에서
  `celebrate` one-shot 뒤 `idle`로 전환한다. 현재 tactile production v1은
  그 `idle` 전환이 끝난 뒤에만 head/body/feet pointer interaction을 연다.
- live production state: **ACTIVE**. Phase B activation, public smoke, rollback
  rehearsal, and final restore are verified in
  [S3E production rollout evidence](s3e-companion-production-rollout.md).
- The rollout is reversible, the rollback path is verified, and companion off or
  failure preserves the S05 core UI.

## S3D 사람 시각 수용 결정

- 근거: [Issue #250](https://github.com/AI-HealthCare-05/AH_05_07/issues/250)의
  [승인 댓글](https://github.com/AI-HealthCare-05/AH_05_07/issues/250#issuecomment-5564180084)
  (2026-09-07).
- S3D: **APPROVED**. primary species는 `bear`, production candidate는 `lite`다.
- 화면: S02 hold, S03 hold, S05 approve, S10 hold. S11과 그 밖의 화면은 제외한다.
- 동작: `idle`/`rest` approve, `greet`/`curious`/`move`/`special` hold,
  `celebrate`는 S05의 명시적 `save_success`에서만 한 번 실행하고
  `idle`/`rest`로 전환한다.
- species: bear primary; rabbit/cat/dog/red_panda/penguin/fox/squirrel secondary;
  otter/capybara limited; hedgehog hold. 선택 GLB는 삭제하지 않는다.
- 이 결정은 production activation이 아니다. R2의 22개 immutable object, CORS,
  운영 flag는 변경하지 않았고, activation은 successor [Issue #252](https://github.com/AI-HealthCare-05/AH_05_07/issues/252)의
  별도 rollout gate 이후에만 가능하다.

## S3B provenance와 S3C runtime delivery 분리

- R2 bucket은 계속 `sk7-assets-prod`다.
- S3B의 original delivery provenance는 `https://sk7-assets.gomdory.com`이며,
  evidence의 기존 `public_url` 기록은 역사적 사실로 보존한다.
- S3C review runtime delivery hostname은
  `https://sk7-companion.gkrry.com`이다. 두 hostname은 동일한
  `companion/v1/` object key를 가리킨다.
- 22개 object의 key, bytes, SHA-256은 불변이며 GLB 재업로드·overwrite·delete는
  수행하지 않았다.
- 분리 이유는 old `gomdory.com` zone의 Free Bot Fight Mode가 GitHub Actions
  Microsoft ASN 및 HeadlessChrome의 legitimate review traffic에 managed
  challenge를 반환했기 때문이다. `gkrry.com` static delivery zone에서는 Bot
  Fight Mode가 OFF다. 이는 `gkrry.com` 전체에 보안이 없다는 의미가 아니다.
- runtime delivery 전환은 production activation 승인이 아니다.

## 중앙 계약

웹 계약은 [`web/src/ui/companion.ts`](../web/src/ui/companion.ts)에만 둔다.
species는 `bear`, `rabbit`, `cat`, `dog`, `red_panda`, `otter`, `capybara`,
`hedgehog`, `penguin`, `fox`, `squirrel` 11종이며 `seal`은 포함하지 않는다.
clip은 `idle`, `greet`, `move`, `curious`, `celebrate`, `rest`, `special` 7개다.
문자열 배열과 타입을 함께 사용해 임의 값이 계약을 우회하지 않도록 한다.

## 게이트와 자산 경계

`VITE_SK7_COMPANION_MODE`는 exact `off`, `review`, `production`만 허용한다.
누락·빈 문자열·오타·unknown은 모두 `off`다. `review`는 기존 explicit query
selection을 유지하지만 `production`은 query를 읽지 않고 승인된 고정 profile만
생성한다. [`CompanionRuntimeBoundary`](../web/src/components/CompanionRuntimeBoundary.tsx)는
mode, 화면, selection, animation policy를 모두 통과한 뒤에만 renderer를 lazy import한다.
[evidence manifest](evidence/companion-r2-v1.json)를
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

Production sequence는 confirmed successful save가 확인된 S05에서만
`celebrate`를 `LoopOnce`/1회로 재생하고 mixer `finished` event 뒤 `idle` loop로
전환한다. sequence 중 selection을 바꾸지 않으므로 approved bear-lite GLB는
정확히 한 번만 요청된다. tactile production v1은 celebration 동안
`pointer-events: none`/interaction disabled를 유지하고 `idle` 진입 뒤에만 기존
head/body/feet tactile controller를 생성한다. interaction은 저장 결과·혈압 값·
모델 결과를 입력으로 받지 않는다. `prefers-reduced-motion: reduce`에서는 action,
RAF, tactile interaction을 모두 시작하지 않고 neutral static model만 표시한다.

정책 함수는 화면·clip·비의미적 UI context만 받는다. 혈압 수치/변화, 위험 점수·
위험군, 모델 결과·준비 상태, 챌린지 성공률, 건강 개선 여부는 입력 타입이나
분기 조건에 존재하지 않는다. `celebrate`가 정상 혈압·위험 감소·건강 개선을
표현하는 경로도 없다.

## 접근성 및 실패 격리

기존 화면은 companion 없이도 정보·폼·탐색을 제공한다. canvas와 bounded slot은
계속 `aria-hidden`이며 tab index·accessible name이 없다. pointer input은 기본적으로
차단되고, review의 승인된 tactile candidate 또는 production S05의 one-shot
`celebrate → idle` 완료 뒤에만 bounded decorative target으로 열린다. renderer 오류는
error boundary와 loader failure path에서 장식만 제거하고 본문·버튼·폼·탐색에
전파하지 않는다. `prefers-reduced-motion: reduce`는 host가 읽은 presentation
boolean으로 전달하며, reduced motion에서는 animation mixer/지속 RAF/tactile
interaction을 시작하지 않는다.

## 자산 및 운영 경계

S3B에서 승인된 22개 GLB를 `companion/v1/`에 게시했고, S3C review와 S3E
production-on 검증은 별도 runtime delivery hostname으로 그 object를 읽기만 한다.
GLB Git 추가, 로컬 자산 복사, 생성·모델링·재렌더,
일반 사용자 활성화, 모델/ML 변경, test 접근은 하지 않았다. Three.js `0.185.1`과
`GLTFLoader`는 product entry에서 정적으로 import하지 않고 gate 뒤 lazy chunk에서만
로드한다. 기존 `visual/v1/` 자산은 대체하지 않는다.

## 검증 범위

`web/e2e/companion-runtime.spec.ts`는 production/off에서 renderer chunk와 GLB 요청이
없는지 검증한다. `npm run test:e2e:review`의 review suite는 22/22 GLB load, 각
7 clip runtime name set, 허용/조건부/차단 policy, 제외 화면 network=0, reduced motion,
404/abort 실패 격리, 1366/390/320 responsive 경계를 실제 브라우저에서 검증한다.
`npm run test:e2e:production:on`은 실제 runtime delivery의 S05 production-on
경로에서 save 전 0회, confirmed save 후 bear-lite 1회, `celebrate → idle`,
celebration 중 tactile 차단, idle 이후 mouse/touch tactile 활성화와 celebrate
non-replay, 제외 화면, query 무시, reduced motion, failure isolation,
1366/390/320 non-overlap을 검증한다. 이 테스트의 production variable은 local test
web server에만 주입한다.

S3C CORS 계약은 그대로 유지한다. 최종 origin은
`https://ah-05-07-pages.ahnsangkyoon.workers.dev`와 `http://127.0.0.1:4173` 두 개이며,
methods `GET, HEAD`, wildcard·credentials 없음이다. 4175 등 다른 local port는 허용하지
않는다. 새 runtime hostname 때문에 CORS를 변경하지 않았고 GLB object도 수정하지 않았다.

## S3C 측정 결과

- baseline `origin/main` main JS: 233,732 raw / 71,800 gzip bytes
- after S3C main JS: 237,275 raw / 73,181 gzip bytes
- lazy review renderer chunk: 627,706 raw / 161,318 gzip bytes
- approved GLB bytes: lite 11종 합계 `6,063,464`, standard 11종 합계
  `11,803,720`, 전체 `17,867,184` bytes (evidence 기준)
- valid first companion render: lazy renderer chunk 1개 + GLB 1개, 추가 network 2회
- production/off initial route: renderer chunk 0, companion GLB 0

## S3E rollout and rollback contract

- Production selection source: `resolveProductionCompanion`의 고정 계약. 입력은
  mode, S05 screen, `confirmedSave` boolean뿐이며 BP value, 입력 기반 위험군
  선별 신호, model output, challenge adherence/result를 받지 않는다.
- S05 trigger: 실제 save request가 성공으로 resolve된 뒤에만 `confirmedSave=true`;
  요청 시작, optimistic UI, timeout/unknown, 4xx/5xx, 저장 확인 전에는 false다.
- Production-off rollback: `VITE_SK7_COMPANION_MODE=off` 또는 variable 제거 후
  rebuild/deploy하고, renderer request 0 및 GLB request 0을 확인한다.
- Phase B production evidence confirms the live final state is `production` with
  S05-only bear-lite behavior, confirmed-save gating, one-shot `celebrate` to
  `idle`, a verified rollback path, and preserved core UI when off or failed.
