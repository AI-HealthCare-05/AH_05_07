# S3 companion 런타임 기반

> **Lifecycle note — 2026-09-18.** S3A–S3E 번호가 붙은 아래 rollout/측정
> 문단은 해당 단계의 역사적 근거를 보존한다. 현재 실행 계약은
> [`web/src/ui/companion.ts`](../web/src/ui/companion.ts), 현재 scene/host 코드,
> 그리고 이 문서의 **Current source runtime summary**가 우선한다.

Issue #244의 S3 기반 단계에서 시작된 기록이다. S2 선정과 S3B 게시 자체는
runtime activation을 뜻하지 않았으며, 후속 단계에서 별도 검증·활성화가
진행되었다. S2 당시 결정은 [historical selection record](s2-design-selection.md)로
보존한다.

## Current source runtime summary

The bullets below describe current source authorization. They do not prove that
the corresponding Cloudflare scene/UI variables are deployed; live rollout
identity remains a separate deployment-SSOT/control-plane question.

- Companion species는 선택된 11종이며 물범은 포함하지 않는다.
- S01 로그인 narrator는 사용자가 고른 비의료적 `sk7-companion-species`
  preference만 사용해 registered `lite` + `greet` profile을 연다.
- exact `production` scene gate와 Journey presentation이 함께 선택되면 S02
  realtime scene은 같은 saved preference를 identity로 이어받되 registered
  `lite` GLB만 사용한다. invalid preference는 bear로 fail-safe 하며 query, BP,
  Model V2, challenge, record facts가 species를 고를 수 없다.
- S10 exact-production Journey path는 같은 비의료적 saved preference를
  registered `lite` scene character에 직접 연결하며, 별도 companion renderer를
  억제해 한 화면에 character owner가 하나만 남도록 한다. preference가 없거나
  invalid면 bear로 fallback한다.
- S10 unified full-scene owner의 날짜 focus는 record facts가 아니라 semantic
  control의 화면 좌표만 받아 최대 900ms의 bounded head+spine cue로 표시한 뒤
  neutral pose로 돌아간다. 화면 밖의 decorative scene은 cue를 소비하지 않으며,
  보이는 상태에서만 bounded RAF를 시작한다.
- scene gate가 missing/off인 production fallback에서는 기존 독립 production
  companion의 `lite` + `idle` 경로가 계속 유효하다. source activation 자체는
  Cloudflare build variable이나 deployed Worker 상태를 바꾸지 않는다.
- S05는 confirmed host persistence 뒤 exact `review` 또는 `production` scene
  gate에서 qualified SavedScene을 열며 saved non-medical preference의 active
  registered `lite` identity로 `celebrate → idle`을 사용한다. query는 production
  preference를 override하지 못하며 absent/invalid preference는 bear다.
- S01의 `로그인 없이 30초 맛보기`는 canonical `?guest=1` 경로에서 인증 App과
  분리된 Guest Journey Sandbox를 연다. `30초`는 진입 framing이며 timeout이
  아니다. guest S02는 같은 saved non-medical species preference와 현재
  full-scene/Presence ownership을 재사용한다. 실제 guest confirmation 동안에는
  같은 species의 explicit S05 `lite`/`celebrate` selection을 memory-only로 열지만,
  guest 입력은 account/session, Supabase, API/DB, SavedScene persistence event를
  열지 않는다. direct S05 URL은 닫힌다.
- `off`와 reduced motion/failure 경계는 기존 semantic HTML/CSS와 poster/static
  fallback을 보존한다.

## Historical S3 rollout status

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
- P1 Living Replay production extension은 당시 S10의 `lite`/`idle`
  profile과 presentation-only day-focus head+spine attention을 추가했다. 이후
  non-medical saved species preference를 받을 수 있도록 확장되었고 invalid/absent
  preference는 bear로 fallback한다. S10 tactile은 열지 않고 reduced motion에서는
  neutral static을 유지한다. S10 realtime scene gate는
  이 확장과 별개이며 계속 활성화하지 않는다.
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
selection을 유지하지만 `production`은 query를 읽지 않고 saved/fallback identity와
승인된 screen profile만 사용한다. [`companionAssetResolver.ts`](../web/src/ui/companionAssetResolver.ts)는
product selection을 active membership 및 화면별 clip capability에 결합한다.
[`CompanionRuntimeBoundary`](../web/src/components/CompanionRuntimeBoundary.tsx)는
mode, 화면, selection, animation policy와 이 resolver를 모두 통과한 뒤에만
renderer를 lazy import한다.
[evidence manifest](evidence/companion-r2-v1.json)를
읽는 generator가 만드는 [`companionAssets.generated.ts`](../web/src/ui/companionAssets.generated.ts) 외의
URL/version/file name은 사용하지 않는다.

화면 정책은 S02 오늘의 기록, S03 7일 챌린지 선택, S05 저장 완료, S10 7일
돌아보기만 review 후보로 둔다. S04, S07, S08, S09, S11, S12, S13, S14는
중앙 정책에서 제외한다. 이는 비운영 review 범위이며 최종 운영 화면 배정이 아니다.

S01 로그인 narrator는 위 review query 후보군을 넓히지 않는 별도 presentation profile이다.
사용자가 고른 비의료적 species preference만 받아 `lite` + `greet`를 사용한다.
`VITE_SK7_COMPANION_MODE` gate를 그대로 따르므로 `off`에서는 renderer/GLB 요청이 없고
HTML 말주머니와 로그인/둘러보기 UI만 남는다. query parameter, 혈압 수치, 위험군 선별 신호,
모델 결과, 챌린지 상태는 narrator 선택 입력으로 사용하지 않는다. tactile interaction은 열지 않는다.

## 동작 의미 경계

- `idle`, `greet`, `curious`, `rest`: 일반 검토 후보
- `celebrate`: S05의 명시적 `save_success` UI 이벤트에서만 조건부
- `move`: `non_semantic` 장면 이동에서만 조건부
- `special`: 별도 검토 전 보류

Production sequence는 신규 저장 성공이 확인된 S05에서만
`celebrate`를 `LoopOnce`/1회로 재생하고 mixer `finished` event 뒤 `idle` loop로
전환한다. sequence 중 selection을 바꾸지 않으므로 selected active-lite GLB는
정확히 한 번만 요청된다. SavedScene byte cache는 asset ID/species/version/variant/
bytes/SHA identity로 격리되어 다른 species의 bytes를 재사용하지 않는다.
tactile production v1은 기존 범위를 넓히지 않아 bear celebration 동안
`pointer-events: none`/interaction disabled를 유지하고 `idle` 진입 뒤에만 기존
head/body/feet tactile controller를 생성한다. interaction은 저장 결과·혈압 값·
모델 결과를 입력으로 받지 않는다. `prefers-reduced-motion: reduce`에서는 action,
RAF, tactile interaction을 모두 시작하지 않고 neutral static model만 표시한다.

S10 production selection은 save 상태와 무관한 `lite`/`idle` profile이며,
species는 host가 전달한 비의료적 saved preference만 사용할 수 있다. absent/invalid
preference는 bear로 fallback한다. 7일 기록의 선택·혈압·챌린지·Model V2 사실은
species, selection, pose를 고르지 않는다.
day-focus는 활성화한 semantic control의 화면 위치만 presentation cue로 전달하며,
head+spine bounded attention은 기존 envelope 안에서만 동작한다. S10 tactile은
disabled이고 `prefers-reduced-motion: reduce`에서는 attention loop를 시작하지 않는다.

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
경로에서 save 전 0회, confirmed save 후 selected active-lite 1회, `celebrate → idle`,
celebration 중 tactile 차단, idle 이후 mouse/touch tactile 활성화와 celebrate
non-replay를 검증한다. 후속 identity/SavedScene regression은 guest fox/cat과
authenticated non-bear confirmation, exact-species cache/request isolation,
query 무시를 검증한다. 같은 suite와 후속 identity regression은 S10의 saved/fallback species
`lite`/`idle`, query 무시, presentation-only day-focus attention, tactile disabled,
reduced motion static을 검증하고 다른 화면은 계속 제외한다. failure isolation과 1366/390/320 non-overlap도
기존 S05 경계에서 유지한다. 이 테스트의 production variable은 local test web server에만
주입한다.

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
  mode, screen, `confirmedSave`, 그리고 S01/S05/S10에 이어지는 비의료적 species
  preference다. S05는 confirmed save일 때만 saved/fallback species의 active
  `lite` `celebrate → idle`,
  S10은 save 상태와 무관하게 saved/fallback species의 `lite`/`idle` profile을 만든다.
  BP value, 입력 기반 위험군 선별 신호, model output, challenge adherence/result는
  species나 animation 입력으로 받지 않는다.
- S05 trigger: 실제 신규 save request가 성공으로 resolve된 뒤에만 `confirmedSave=true`;
  요청 시작, optimistic UI, timeout/unknown, 4xx/5xx, 저장 확인 전에는 false다.
  기존 혈압 기록의 수정 PUT은 성공 후 S09 상세로 복귀하며 이 S05 trigger에 포함하지 않는다.
- Production-off rollback: `VITE_SK7_COMPANION_MODE=off` 또는 variable 제거 후
  rebuild/deploy하고, renderer request 0 및 GLB request 0을 확인한다.
- Phase B production evidence confirms the live final state is `production` with
  S05-only bear-lite behavior, confirmed-save gating, one-shot `celebrate` to
  `idle`, a verified rollback path, and preserved core UI when off or failed.
- 위 Phase B 기록은 S05 rollout의 역사적 live evidence다. P1 S10 source activation
  merge만으로 현재 served production을 증명하지 않으며, mirror/build-variable/deploy/public
  smoke/rollback 확인은 별도 deployment 단계에서 기록한다.

## Extensible candidate intake

Future companion batches are staged through
[the companion asset platform](companion-asset-platform.md). Candidate metadata
is deliberately outside the active runtime manifest: adding a species, variant,
clip, or new binary digest to the candidate pool cannot make it selectable or
production-active. The current 11-species active registry remains explicit and
cross-checked against immutable companion delivery evidence.

Scene fit data now lives separately from binary identity so S02/S10 framing can
evolve without turning candidate registration into activation. Promotion from a
candidate batch to the active set requires its own reviewed runtime/evidence
change; deployment remains a separate decision.

Published delivery metadata also has a deterministic read-only intake path:
supplied inventory JSON plus optional GLB audit produces a generated review
catalog. The isolated Transcend Lab can enumerate capability-complete entries
and play required clips without changing production membership. The adapter has
no R2 credentials/mutation/listing and the public Asset Gateway remains
GET/HEAD-only. Promotion still requires an explicit reviewed active-membership
change after review.
