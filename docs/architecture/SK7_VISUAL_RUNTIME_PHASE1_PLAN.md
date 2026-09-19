# SK7 Visual Runtime Phase 1 — legacy reaction lifetime 분리 계획

상태: **조사·계획만 완료. Production code와 테스트는 수정하지 않았다.**
조사일: 2026-09-19 KST. 이번 산출물은 이 문서 하나다.

## 기준과 권고

Canonical repository는 `AI-HealthCare-05/AH_05_07`이다. 최초 fetch에서는
`8ce2e416b70c5fbc8176199eefe649e2afcd198b`였으나, 조사 중 remote main에
PR #637이 합쳐진 것을 확인하고 다시 fetch했다. **최종 검토 base는
`cd5a3da47da260ff377407b2a1191fef52f5fffb`**, `polish(web): close the Living
Journey record loop (#637)`이다. 격리 worktree도 이 base로 fast-forward했다.
두 SHA 사이의 companion renderer, input helper, boundary, review/production
companion test에는 diff가 없다. App의 여정 연결과 S10 Today 복귀 UI는 갱신됐다.

Architecture baseline은 `docs/architecture/SK7_VISUAL_RUNTIME_JOURNEY_ORCHESTRATION.md`다.
이 문서는 현재 main에 없으며, `codex/visual-runtime-design`의 문서 commit
`1a7c7f75feb413fa004159d02411b48f9233c4fc`에 있다. 원본은
`/Users/gom/Projects/AH_05_07-visual-runtime-design/docs/architecture/SK7_VISUAL_RUNTIME_JOURNEY_ORCHESTRATION.md`에서
읽었다. 그 문서의 권고와 미래 상태는 구현된 사실이나 이번 작업의 추가 지시가 아니다.
특히 “PR #637은 main에 없다”는 당시 설명은 지금 기준에서 더 이상 맞지 않는다.
[Architecture invariants](ARCHITECTURE_INVARIANTS.md)는 기존 제품 경계를 확인하는
참조이며, 그 문서의 다른 작업을 이번 범위에 포함하지 않는다.

**첫 구현은 전체 `AnimationController` 이동보다 작게 한다. Release 후 300ms를
예약·취소하는 책임만 renderer-local helper로 분리하는 것을 권고한다.**
현재 pointer/spring은 이미 별도 helper다. 반면 `currentAction`은 일반 재생,
tactile, celebrate 완료가 공유하고, 전체 controller는 DOM 표시·최신 selection·
interaction 활성화·renderer paint와 연결돼 있다. 이 모두를 옮기면 단순 timer
분리에 필요 없는 callback 계약이 늘어난다. 먼저 독립적인 timer 소유권을 끊고,
action 전환과 UI 표현의 추가 분리는 실제 필요가 생길 때 판단한다.

## A. Current implementation map

아래 줄 번호는 최종 검토 base의 위치다. 다음 구현은 최신 main에서 symbol과
effect dependency를 다시 대조하며, 이 SHA나 줄 번호를 고정 입력으로 쓰지 않는다.

### A1. 소유자와 호출 경로

| 실제 파일 / component / 함수 | 소유 책임과 연결 |
| --- | --- |
| [App.tsx](../../web/src/App.tsx), `s02SceneOwnsDecoration`, `s10SceneOwnsDecoration`, `companionSelection` (1277–1312) | 화면과 gate에 따라 장식 owner를 선택한다. S02/S10 scene이 owner이면 legacy selection은 null이다. animation 시간을 관리하지 않는다. |
| [SceneShell.tsx](../../web/src/components/SceneShell.tsx), `companion` (65–69) | 허용된 S05 event는 `SavedSceneBoundary`, 그 밖에는 `CompanionRuntimeBoundary`를 연결한다. S04 effect는 renderer module만 warm한다. |
| [CompanionRuntimeBoundary.tsx](../../web/src/components/CompanionRuntimeBoundary.tsx), `CompanionRuntimeBoundary` (55–99) | gate 뒤 lazy import. Review bear/lite/idle은 `immediate`, production S05 bear/lite/celebrate_then_idle은 `after-idle`, 나머지는 `disabled`. Reduced motion은 input을 끈다. |
| [CompanionReviewRenderer.tsx](../../web/src/components/CompanionReviewRenderer.tsx), 첫 `useEffect` (85–471) | **legacy animation 방문 수명의 최종 소유자**. GLB, scene/model, mixer/actions, controller, RAF, resize, input/look helper를 만들고 정리한다. 이름과 달리 production legacy 경로도 사용한다. |
| 같은 파일, GLTF load callback의 `AnimationController` closure (254–419) | `currentAction`, `finishedListener`, release timer를 소유한다. `play`, `react`, `releaseReaction`, `dispose: stopCurrent`를 ref/input에 제공한다. 전역 controller는 없다. |
| [companionInteraction.ts](../../web/src/components/companionInteraction.ts), `createTactileCompanionInteraction` (103–349) | pointer identity/capture, zone, drag 목표·속도, spring 복귀와 target transform. AnimationAction이나 timer를 소유하지 않는다. |
| [companionLook.ts](../../web/src/components/companionLook.ts), `createCompanionLookController` | 독립 S10 head/spine attention. Renderer는 mixer update 전 offset을 되돌리고 이후 look step을 실행한다. Tactile dragging/celebrate 여부를 DOM dataset에서 읽는다. |
| [SavedSceneRenderer.tsx](../../web/src/components/scene/SavedSceneRenderer.tsx), `settle`, `tick`, cleanup | 별도 S05 mixer/celebrate/watchdog/static idle. 이번 legacy timer의 소비자가 아니다. |
| [ThreeSceneRenderer.tsx](../../web/src/components/scene/ThreeSceneRenderer.tsx) | S02/S10 neutral scene. `AnimationMixer`가 없고 demand render/bounded cue를 사용한다. 공통 controller로 합칠 대상이 아니다. |

### A2. idle / reaction / recovery의 실제 전환

`recovery`라는 animation enum이나 recovery clip은 없다. 아래 두 축이 독립적이다.

| 전환 | 실제 수행 함수와 동작 |
| --- | --- |
| 초기 clip / 일반 반복 | Renderer의 `play` (353–412)가 먼저 `stopCurrent`를 호출한다. 일반 clip은 `reset → LoopRepeat(Infinity) → play`. Review의 직접 선택 clip과 S01 greet도 이 경로다. |
| S05 celebrate → idle | `play` 안의 `onFinished` (375–394). 자신의 celebrate action과 살아 있는 effect인지 확인하고 listener 제거, celebrate stop, idle 반복 시작. 이때만 `after-idle`의 `enableInteraction` 호출. Tactile fade-out 경로와 다르다. |
| idle/이전 reaction → reaction | `react(zone)` (325–351). 최신 screen의 policy가 blocked이면 아무것도 바꾸지 않는다. 허용이면 이전 release timer 취소, zone action reset, `LoopOnce(1)`+clamp, play. 다른 action에서만 0.14s crossfade. |
| release → 유지 | `releaseReaction` (314–323). 기존 timer 취소 후 **release부터 300ms** timeout을 설정한다. 이때 action을 바꾸지 않는다. |
| 유지 만료 → idle blend | `settleReactionToIdle` (287–312). timer handle을 비우고 idle을 reset/repeat/play, 이전 action에서 0.18s crossfade. 이 순간 phase/reaction dataset을 idle로 쓴다. Fade 완료 callback/timer는 없다. |
| dragging → returning → home | Input helper의 `release`/`cancel`이 home 목표와 returning을 설정한다. `step` (258–310)이 spring을 진행하고 distance `<0.003`, speed `<0.02`이면 transform을 home으로 고정하고 interaction을 idle로 바꾼다. Clip 완료를 기다리지 않는다. |

Tactile action의 자연 `finished`는 release hold를 끝내지 않는다. `LoopOnce`의
마지막 pose가 clamp될 수 있으며, release timer가 idle 전환을 결정한다.
`data-companion-interaction=idle`과 `data-companion-reaction-state=idle`은
서로 다른 사건이고, 후자도 실제 blend 완료를 뜻하지 않는다.

### A3. Pointer down / up / cancel

React JSX의 pointer handler가 아니라 input helper가 `surface`에 native listener를
설치한다. `surface`는 `host.parentElement`가 HTMLElement이면 그 parent slot,
그렇지 않으면 host다. Canvas 좌표를 사용하지만 listener는 slot capture phase다.

- `begin` (145–178): disposed/이미 잡힌 pointer/비왼쪽 mouse button을 거른다.
  Canvas 높이 비율 `<0.34` head, `>0.74` feet, 나머지 body. Plane hit 뒤 capture를
  시도하고 `onGrabZone → controller.react`를 호출한다. Capture 실패는 허용한다.
- `move` (180–207): matching pointer만 drag 목표를 갱신한다. Zone은 drag 중
  재판정하지 않는다. Hit target은 mesh raycast가 아니라 slot 기반 plane이다.
- `release` (209–228): matching pointer만 처리한다. **pointerId를 먼저 null로**
  만들고 capture를 풀어 중복 lostcapture release를 막는다. Home/returning을
  설정하고 `onReleaseZone → controller.releaseReaction`을 한 번 호출한다.
- `cancel` (230–238): `pointercancel`과 `lostpointercapture`가 공유한다.
  Matching pointer만 null 처리, home/returning, 같은 release callback을 수행한다.
  Up과 달리 명시적인 capture release/`preventDefault`/disposed 검사는 없다.
  이 비대칭을 이번 timer extraction에서 handler 통합으로 바꾸지 않는다.
- `dispose` (313–347): disposed 설정, capture 정리, listener 5종 제거,
  pointer/zone·style 정리, target transform 복원. 정상 dispose는 release animation을
  기다리지 않는다. Eligible slot만 `touch-action:none`; 본문 input 범위는 그대로다.

### A4. Mixer / action / timer / cleanup

| 자원 | 현재 소유자 | 해제/진행 |
| --- | --- | --- |
| `AnimationMixer(animatedModel)` | Renderer 첫 effect, non-reduced load callback | RAF마다 `update(1/60)`. 초기 reveal 전에도 1회 update. Scene/model/loader와 함께 방문 단위다. |
| 7개 action map | 같은 callback | GLB의 exact 7 clip 검증 후 `clipAction`으로 생성. Clip 변경만으로 GLB를 다시 받지 않는다. |
| `currentAction` / `finishedListener` | Controller closure | `stopCurrent`: release timer 취소 → finished listener 제거 → current action stop/null → `stopAllAction`. |
| `reactionReleaseTimer` | Controller closure의 number 또는 undefined | `releaseReaction` 예약, 허용된 `react`/`stopCurrent` 취소, 만료 시 handle clear. 별도 cooldown/fade 완료 timer 없음. |
| 지속 RAF / ResizeObserver | Renderer effect | cleanup이 RAF 취소/observer disconnect. Legacy에는 hidden/offscreen pause 정책이 없다. |
| pointer/spring / attention | 각 input/look helper | Renderer가 각 `dispose` 호출. Spring에는 별도 RAF가 없으며 renderer frame을 사용한다. |
| geometry/material/texture/canvas | Renderer `disposeObject` / renderer | 자원 정리 후 host children 제거. 현재 legacy에는 `uncacheRoot`, scene 공용 dispose, explicit context loss를 추가 호출하지 않는다. |

Effect cleanup (457–469)은 `disposed=true → RAF 취소 → resize disconnect →
controller.dispose/ref=null → interaction.dispose → look.dispose → model dispose →
renderer.dispose → host.replaceChildren` 순서다. Pending GLTF load 자체는 abort하지
않지만 늦은 성공 callback은 model을 dispose하고 반환한다. 늦은 `fail`도 disposed면
반환한다. Timer callback 자체에는 disposed 검사가 없으므로 **timer 취소가 현재 보호**다.
`dispose: stopCurrent`는 폐기된 controller의 모든 method를 영구 무효화하는 API가 아니다.

### A5. Render state와 imperative state가 만나는 곳

- `status`는 React `useState`이면서 `setStatus`가 같은 host dataset을 직접 쓴다.
  Ready/error는 두 경로에 반영된다. JSX는 status/framing과 host ref를 표현한다.
- Clip/phase/reaction/celebrateCount는 React state가 아니라 DOM dataset이다.
  Controller가 표시값을 쓰며 celebrate count는 기존 DOM 값을 읽어 증가시킨다.
- `latestSelectionRef.current = selection`은 render 때 갱신되고, asynchronous load의
  첫 `play`와 `react`의 policy lookup이 읽는다. Closure 생성 당시 screen으로
  고정하거나 selection object 전체를 effect dependency로 넣으면 의미가 달라진다.
- `controllerRef`가 두 effect와 input helper를 연결한다. `enableInteraction`은
  controller closure와 renderer/model/camera를 연결하고 celebrate 완료 후 input을 연다.
- Look의 suspension은 interaction/phase dataset에 의존한다. Dataset을 단순 테스트
  장식으로 보고 제거하거나 React state로 일괄 옮기면 look timing까지 달라진다.

따라서 현재 component를 한 번에 input 전달·render 연결·UI만 남기도록 정리하지 않는다.
이번에는 timer 소유권만 줄이고 위 결합은 그대로 드러내 둔다.

### A6. Unmount / rerender / retap

| 상황 | 현재 source behavior |
| --- | --- |
| Status/parent rerender, dependency 값 동일 | Scene effect나 `play` effect가 다시 실행되지 않는다. 같은 selection 값의 새 object도 재생 사유가 아니다. |
| clip 또는 sequence 변경, scene dependency 동일 | 두 번째 effect (473–475)가 `play`로 기존 timer/listener/actions를 정리하고 다시 재생한다. 단, boundary에서 interactionActivation도 달라지면 아래의 전체 effect 재생성이 일어난다. |
| species/variant/reducedMotion/framing/interactionActivation/attentionLook 변경 | 첫 effect cleanup 후 GLB/renderer 방문을 다시 만든다. 이 dependency 배열은 이번에 수정하지 않는다. |
| screen만 변경 | 자체적으로 첫 effect/`play` dependency가 아니다. 같은 instance가 유지되면 최신 ref로 policy만 갱신된다. Route가 항상 unmount한다거나 항상 유지된다고 일반화할 수 없다. |
| reduced motion 켜짐 / 다시 꺼짐 | 켜지면 static neutral GLB, mixer/controller/지속 RAF 없음. 복원은 새 방문이므로 legacy S05 celebrate 재생 가능성이 있다. SavedScene의 event claim 보장을 legacy에 가져오지 않는다. |
| 반복 tap / reaction hold 중 retap | 허용된 down이 이전 timer를 취소하고 새 reaction을 시작한다. 같은 zone은 같은 action reset/replay, self-crossfade 없음. 다른 zone은 0.14s crossfade. 마지막 release가 새 300ms 기준이다. |
| idle fade-out 중 retap | 이미 `currentAction=idle`이다. 새 reaction은 idle에서 0.14s crossfade한다. 이전 fade action을 별도로 stop하거나 새 recovery FSM을 만들지 않는다. |
| unmount / owner 교체 | 위 cleanup 실행. 이전 reaction을 새 방문에 넘기지 않는다. Pending hold, 잡힌 pointer, pending load는 서로 다른 경로다. 이번 guard는 앞의 두 경우를 직접 테스트하고 loader는 변경하지 않는다. |

### A7. 현재 테스트가 보호하는 범위와 공백

아래는 **테스트 코드의 assertion 범위**다. 이번 문서 작업에서 테스트를 실행했거나
production/실기기 동작을 재확인했다는 뜻이 아니다.

| 테스트 / 실제 assertion | 보호하는 behavior | 보호하지 않는 것 |
| --- | --- | --- |
| [companion-review.spec.ts](../../web/e2e/companion-review.spec.ts), `bear-lite idle can be grabbed…`, `head body and feet…`, `feet remain more anchored…` (177–252, 375–408) | Native mouse drag, zone→clip dataset, transform offset, spring home, zone별 drag 범위 차이, CTA 표시 | 반응 pose의 실제 weight, exact blend duration, 중첩 retap. Zone loop는 각 복귀를 기다리므로 repeated-tap race가 아니다. Product-state 불변은 모든 storage/write 비교로 검증하지 않는다. |
| 같은 파일, `touch tap keeps…` (254–298) | 실제 Playwright touchscreen tap 뒤 active, 120ms 뒤 active, 1500ms 안에 idle, min-reaction dataset=300 | Down/up 실제 간격이 0ms라는 보장, 정확히 299/300ms 경계, 화면에 실제 300ms 표시됐다는 보장 |
| 같은 파일, `touch release restarts…long press` (300–372) | Synthetic pointer의 360ms press 뒤에도 release+120ms active, 이후 idle | 0/20/80/200ms matrix, natural clip finish, retap/cancel/unmount |
| [companion-production.spec.ts](../../web/e2e/companion-production.spec.ts), 첫 S05 두 테스트 (57–156) | Confirmed save 후 GLB/module 각 1회, celebrateCount=1, celebrate→idle 뒤 input 허용, 이후 touch 반응과 idle 복귀, count 유지 | Timer pending 중 component rerender, repeat touch, listener cleanup 직접 검증, 재방문 전체의 exactly-once |
| Review/production reduced-motion 테스트 | Static 표시, input disabled. Production (270–296)은 전역 RAF counter가 250ms 동안 증가하지 않음도 확인 | 동작 도중 media toggle, 구 renderer의 남은 timer, 복원 시 replay 정책 |
| Review look / production S10 테스트 | Look bound·drag suspension·day-focus, S10 production tactile disabled | Timer race가 look 복귀와 겹칠 때의 상세 pose |
| Review failure/production failure 및 [companion-runtime.spec.ts](../../web/e2e/companion-runtime.spec.ts) | 실패 시 핵심 HTML 유지, clip/gate 정책, off 상태 요청 0 | Unmount 뒤 늦은 GLTF 성공, 잡힌 pointer의 capture 해제 경쟁, action/resource 누수 전반 |

현재 companion test 파일에는 **0/20/80/200ms 명시 matrix, same/different-zone
retap during hold/fade, pointercancel/lostpointercapture, pending-timer unmount**의
직접 assertion이 없다. 다른 renderer의 cleanup 테스트는 legacy의 증거가 아니다.

## B. Preserved behavior contract

`tD`=accepted down, `tU`=matching up/cancel. 새 down에 의해 취소되지 않았다면
idle 전환 예약은 `tU+300ms`다. Down부터 경과한 시간을 빼지 않는다.

| Press | 다른 action에서의 fade-in | Idle fade 시작, 최초 down 기준 | Fade 명목 완료, 최초 down 기준 |
| --- | --- | --- | --- |
| 0ms, 같은 task의 down/up | 0.14s | 300ms | 480ms |
| 20ms | 0.14s | 320ms | 500ms |
| 80ms | 0.14s | 380ms | 560ms |
| 200ms | 0.14s | 500ms | 680ms |

0.14/0.18s는 mixer 시간, 300ms는 wall timer다. Legacy는 RAF마다 고정 `1/60`을
진행한다. 표의 마지막 열은 정상 진행의 명목값이며 느린 frame/hidden tab의 실제
화면 노출 보장이 아니다. 이번에는 delta clock이나 visibility 정책을 바꾸지 않는다.

- Clip 이름 7개와 head→`curious`, body→`greet`, feet→`rest` mapping을 보존한다.
  LoopOnce/clamp, same-action reset, 다른 action에서만 fade-in, idle fade-out을 유지한다.
- Retap은 무시/queue/cooldown하지 않는다. 이전 예약은 마지막 accepted down에서
  취소되며 마지막 matching release가 새 hold를 시작한다. Blocked `react`는 현재처럼
  timer 취소 이전에 반환한다. 다른 pointer의 up/cancel은 hold를 변경하지 않는다.
- Up/cancel/lostcapture는 같은 300ms hold 경로를 사용한다. Up 뒤 lostcapture가
  두 번째 hold를 만들면 안 된다. Held reaction은 자연 clip 완료만으로 idle이 되지 않는다.
- `reaction-state=idle` 기록 시점은 fade 시작이다. Spring returning과 clip lifetime을
  동기화하지 않는다. Fade 완료 이벤트나 새 UI state를 도입하지 않는다.
- Pending timer는 기존 `stopCurrent`/unmount에서 취소한다. 새 owner에 timer를 넘기거나
  cleanup 중 복귀 animation을 기다리지 않는다. 기존 초기 paint/ready 순서도 유지한다.
- S05 celebrate→idle 및 after-idle input, reduced motion static, S10 look, gate·lazy load·
  GLB 요청 수, semantic HTML/CTA/aria-hidden은 동일해야 한다.
- Factory schema/manifest/assets, Journey state, renderer 소유권, dependency, API/auth/data/
  Model V2/배포는 변경하지 않는다. 별도 건강 사실을 animation input으로 추가하지 않는다.

## C. Proposed seam

### C1. 권고: release 예약 한 개의 소유권만 이동

제안 new file: `web/src/components/companionReactionRelease.ts`.
Renderer의 non-reduced GLB callback마다 `createCompanionReactionRelease`를 한 번 만든다.
이 helper는 React/Three/DOM/selection을 import하지 않고 timer handle 하나만 소유한다.
전역 singleton, hook, controller class, FSM, event bus는 필요 없다.

제안 계약은 아래 정도로 제한한다. 이는 구현 코드가 아니라 경계의 명세다.

```text
createCompanionReactionRelease({ onElapsed, schedule, cancelScheduled })
  -> { release(), cancel() }

release: 기존 예약 취소 → 고정 300ms 예약
만료: 자신의 handle을 undefined로 변경 → onElapsed 호출
cancel: handle이 undefined가 아니면 취소 → undefined
```

`schedule(callback, delayMs): number`, `cancelScheduled(id): void`에는 renderer가
기존 `window.setTimeout/clearTimeout`의 작은 wrapper를 전달한다. Test는 같은 형태의
local fake clock을 전달한다. `now`, RAF, delta, visibility, React state는 받지 않는다.
기존 `TACTILE_MIN_REACTION_VISIBLE_MS=300`은 이름/값 그대로 helper에서 export하고
renderer의 min-reaction dataset에서도 그 상수를 사용한다. Fade 상수는 옮기지 않는다.

| 현재 위치 | 이동 후 |
| --- | --- |
| `reactionReleaseTimer`, `clearReactionReleaseTimer`, `releaseReaction`의 예약·취소 | Helper의 단일 handle 및 `release`/`cancel` |
| `settleReactionToIdle` 첫 줄의 handle clear | Helper의 만료 wrapper가 먼저 수행. 나머지 idle action/DOM 로직은 그대로 유지 |
| `react`의 허용 검사 뒤 timer 취소 | 같은 위치에서 `reactionRelease.cancel()` 호출 |
| `stopCurrent`의 첫 timer 취소 | 같은 위치에서 `reactionRelease.cancel()` 호출. 나머지 listener/action 정리 순서 그대로 |
| Controller의 `releaseReaction` | Helper의 `release`를 연결. Input의 `onReleaseZone` 연결은 유지 |
| Controller의 `dispose` | 기존 `stopCurrent` alias 유지. Helper를 별도로 또 dispose하는 두 번째 owner를 만들지 않음 |

Helper 생성은 callback 함수들을 선언한 뒤 첫 `play`/input 활성화 이전에 끝낸다.
각 method는 함수 참조로 전달돼도 동작하도록 `this`에 의존하지 않는다. `cancel`은
반복 호출 가능하고 handle `0`도 취소한다. 폐기 후 재사용을 지원하는 새로운 수명
계약을 만들지 않는다. 새 disposed/generation guard를 넣어 원래 없는 동작을 조용히
추가하지 않으며, teardown race가 발견되면 G의 중단 기준을 따른다.

### C2. 남기는 책임과 확대하지 않는 이유

`AnimationController` type, `play/react/settleReactionToIdle/stopCurrent`, current action,
finished listener, tactile mapping, fade 상수는 **renderer에 남긴다**. `enableInteraction`,
latest selection ref, DOM 표시, mixer/model/RAF/loader/cleanup도 그대로다. Component는
기존 input callback을 전달하면서 timer handle 관리만 내려놓는다.

전체 controller 추출은 지금 성공 조건이 아니다. 특히 currentAction을 두 모듈에서
공유·복제하거나 generic ActionPort, presentation event schema, 공용 renderer service를
만들어야 한다면 이 작은 목적에 비해 크다. Helper조차 callback 연결보다 복잡해지거나
두 번째 timer 상태를 요구하면 **characterization commit까지만 유지하고 분리를 보류**한다.
그 경우 더 작은 seam은 기존 local 예약/취소 함수의 역할을 명확히 하는 정도다.

## D. Candidate file changes

아래는 후속 구현의 후보이며 이번 docs-only diff가 아니다.

| 구분 | 파일 | 예상 내용 |
| --- | --- | --- |
| New | `web/src/components/companionReactionRelease.ts` | 고정 300ms release 예약·취소, injected timer pair. Production helper는 이 하나만. |
| Modified | [CompanionReviewRenderer.tsx](../../web/src/components/CompanionReviewRenderer.tsx) | 위 timer seam 연결만. Action/DOM/scene 정책은 그대로. |
| Modified | [companion-review.spec.ts](../../web/e2e/companion-review.spec.ts) | 먼저 현재 component behavior characterization. 추출 뒤 같은 파일에 browser fixture 없는 helper contract tests 추가. 기존 review runner가 수집한다. |
| Untouched, 실행해 확인 | [companion-production.spec.ts](../../web/e2e/companion-production.spec.ts), [companion-runtime.spec.ts](../../web/e2e/companion-runtime.spec.ts) | 기존 S05/input/정책/요청 수 회귀를 재사용한다. |
| Untouched | `companionInteraction.ts`, `companionLook.ts`, `CompanionRuntimeBoundary.tsx`, `SceneShell.tsx`, `App.tsx`, `LoginCompanionNarrator.tsx`, `VisualStage.tsx` | Input/capture/spring, look, effect host/gate/scene 선택, UI/route/여정은 이동하지 않는다. |
| Untouched | `scene/ThreeSceneRenderer.tsx`, `scene/SavedSceneRenderer.tsx`, `scene/disposeScene.ts`, `SavedSceneBoundary.tsx`, `useSavedSceneEvent.ts` | 다른 renderer와 event claim/resource cleanup 확장은 제외. |
| Untouched | `ui/companion.ts`, generated manifests/registries, Factory candidate/schema/verifier, GLB/poster/2D assets, CSS, package/lock, Playwright config, CI/guard/workflow | Clip/Factory/asset/의존성/배포/검증 체계를 바꾸지 않는다. |

새 unit test 파일/runner/config를 만들지 않는다. 기존 review spec의 pure `test`에서
helper를 import하면 새 test path routing을 설계할 필요도 없다. Production helper는
lazy renderer에서만 import한다. Eager boundary/App import는 금지한다.

## E. Test-first guard

### E1. Extraction 전에 현재 component에 추가할 최소 characterization

`companion-review.spec.ts`에 `legacy reaction lifetime` describe 묶음을 제안한다.
Bear-lite/S02 한 환경에서 아래를 검증하며 species×browser×viewport matrix로 늘리지 않는다.

| Case | Behavior assertion |
| --- | --- |
| 0/20/80/200ms press | Head down부터 각 간격 뒤 up. Release+299ms까지 curious/active, +300ms에서 idle 전환. Down 기준 hold로 바꾸면 네 case가 실패해야 한다. 0ms는 한 `page.evaluate` task 안에서 down/up을 연속 dispatch한다. |
| 반복 tap, 이전 hold 중 same/different-zone retap | 첫 up+200ms에 새 down. 이전 deadline을 지나도 새 clip/active 유지. 두 번째 up+299/300ms를 확인. Same-zone과 head→body 각각 실행하고 GLB 요청이 늘지 않음 확인. |
| 이전 fade 중 retap | 첫 release+300ms로 idle 전환을 진행한 뒤, 180ms blend가 진행 중일 때 새 down/up. 새 반응과 새 hold를 확인하고 조기 idle/추가 요청 없음 확인. |
| cancel / lostcapture | 각각 matching pointer로 dispatch하여 up과 같은 299/300ms hold 확인. Up 뒤 lostcapture 또는 다른 pointer의 up/cancel은 기존 deadline을 뒤로 미루지 않음 확인. |
| unmount 중 pending hold / held pointer | `page.goto`/context close 대신 같은 document의 기존 navigation으로 legacy owner를 제거한다. Old host 참조를 유지하고 cleanup이 끝난 시점부터 timer를 진행해 후속 dataset mutation/pageerror가 없는지 확인한다. 다음 eligible 방문은 새 초기 state이며 이전 deadline의 영향을 받지 않아야 한다. |
| 관련 없는 rerender | S02 fixture URL에 무해한 `record=synthetic-rerender`를 넣고, release hold 중 기존 brand/Today 버튼을 누른다. `App.navigate`의 `setSelectedRecordKey(null)`이 parent를 다시 render하지만 screen/animation props는 같다. Pending deadline, canvas identity, GLB 요청 수가 유지돼야 한다. Today 자체 disclosure는 child-local state라 이 parent rerender의 대용으로 쓰지 않는다. |

기존 Playwright clock을 페이지 로드 전에 설치하고 ready 뒤 시간을 멈춘 다음
`runFor`로 경계를 진행한다. Paused clock 상태에서는 즉시 dataset을 읽으며 retrying
expect가 시간을 대신 진행한다고 가정하지 않는다. Clock 실행이 RAF도 진행한다는 점을
유지한다. `setFixedTime`만으로 timeout을 제어했다고 주장하지 않는다.
실제 native input/capture는 기존 mouse/touchscreen tests로 별도 보완한다.
Synthetic dispatch와 virtual clock은 OS touch/실제 frame visibility 증거가 아니다.

Unmount의 “변화 없음” 기준은 cleanup 자체의 dataset/style 변경 **이후**다.
페이지를 닫아 모든 timer를 없애는 테스트는 component cleanup을 검증하지 못한다.
Capture 해제 중 late callback이 보이면 baseline failure로 기록하고 refactor를 멈춘다.

### E2. Helper를 옮기는 commit에서 추가할 좁은 테스트

같은 review spec의 browser fixture 없는 tests에서 local virtual timer pair로
`release → 299ms 미호출 → 300ms onElapsed 1회`, release 재호출의 deadline 재설정,
`cancel → 과거 deadline 이후 무호출`, 반복 cancel/handle 0, 두 instance의 독립성을
검증한다. Callback 횟수와 시점을 검증하며 private handle 이름·함수 body 문자열·
React render 횟수를 assertion하지 않는다. Fake는 Three action을 흉내 내지 않는다.

**이 테스트가 fade weight까지 증명하지는 않는다.** 이번 seam은 fade/action 코드를
옮기지 않으므로 .14/.18 상수, reset/play/crossFade 순서와 조건의 diff가 0인지 확인한다.
기존 실제 GLB의 대표 tap/retap은 browser에서 반응이 보이고 자연스럽게 복귀하는지
spot-check한다. 시각 차이가 의심되면 같은 조건의 base/candidate를 비교하고 중단한다.
Action 코드를 바꿔야 한다면 새 범위에서 real mixer+synthetic clip/target의 pose·weight
검증을 먼저 설계해야 하며, dataset assertion만 늘려 이를 대신하지 않는다.

### E3. 실행 범위

후속 implementation worktree의 `web/`에서 다음 focused command를 사용한다.
각 명령의 상세 로그는 `/tmp`로 redirect하고 결과 요약/실패 부분만 확인한다.

```sh
npm run test:e2e:review -- --workers=1 --grep 'legacy reaction lifetime'
npm run test:e2e:review -- --workers=1 --grep 'head body and feet|touch tap keeps|touch release restarts|bear-lite idle can be grabbed|S10 living replay|reduced motion renders'
npm run test:e2e:production:on -- --workers=1 --grep 'production S05 loads|production S05 enables touch|production reduced motion keeps|production S10 defaults'
```

Review와 production-on config는 같은 4173 port를 사용하므로 순차 실행하며 다른
mode의 기존 preview를 재사용하지 않는다. 두 config의 webServer는 이미 build를
포함한다. 올바른 review/production build가 실행됐는지 확인하고 별도 중복 build는
필요할 때만 수행한다. GLB/network/WebGL blocker를 assertion 약화로 우회하지 않는다.

최종 PR은 기존 required `lint`/`test`와 concern-routed CI를 따른다.
[Browser selector](../../web/scripts/select-pr-browser-suites.mjs)에 후보 경로를 실제로
입력한 현재 결과는 다음과 같다. 이는 suite 선택 함수 실행이며 browser test PASS가 아니다.

| 후보 diff | 현재 selector 결과 |
| --- | --- |
| 첫 commit의 `companion-review.spec.ts`만 | `review companion runtime` |
| D의 전체 세 파일 | 새 helper가 `knownWebFiles` 밖이므로 `browser regression`, `model-v2 firefox and webkit`, `journey UI`로 조기 반환 |

두 번째 경우 **review/production-on companion suite를 자동 추가하지 않는다**.
따라서 E3의 직접 관련 검사 결과를 별도로 남기고, 실제 PR이 선택한 넓은 required CI도
따른다. 이 범위에서 selector/workflow를 수정하거나 통과 기준을 줄이지 않는다.
구현 시 최신 selector로 다시 확인한다. 이는 현재 routing의 비용이며 전체 browser/
실기기 matrix나 backend Python·AI·MySQL을 로컬에 추가하라는 뜻은 아니다.

## F. Implementation sequence

1. **Behavior characterization — test-only commit.** 최신 upstream과 현재 effect/input
   ownership을 다시 확인하고 E1을 기존 review spec에 추가한다. 기존 production code에서
   통과해야 한다. 확인된 실패는 코드 이동으로 숨기지 않고 G에 따라 멈춘다.
2. **Release lifetime extraction — 하나의 작은 commit.** Helper 생성과 renderer 연결을
   같은 commit에 수행하고 E2 pure tests를 추가한다. 사용하지 않는 controller skeleton을
   먼저 commit하지 않는다. E1과 helper tests를 실행한다.
3. **Focused regression / 정리.** E3, action/effect/cleanup diff 검토, 대표 시각 확인을
   수행한다. 중복 local timer 선언 제거는 2번 commit에 포함한다. 의미 없는 cleanup
   commit을 만들지 않으며 오류 수정이 필요할 때만 별도 작은 commit을 추가한다.
4. **Reviewable candidate.** 하나의 branch/PR로 batch-push하고 기존 guard/required CI를
   따른다. 검증 결과는 해당 SHA와 환경에 한정해 PR에 남긴다. Deployment/asset promotion은
   수행하지 않는다. 필요하지 않은 전체 controller migration은 완료 조건에서 제외한다.

이번 계획 문서 작성은 위 1번조차 실행하지 않는다. 계획 승인과 테스트 PASS를 같은
사실로 기록하지 않는다.

## G. Abort conditions

다음 조건이면 abstraction을 확대하지 않고 마지막 유효한 characterization 상태에서
중단한다. Task-owned 경로만 보존/되돌리고 사용자 변경이나 다른 worktree는 건드리지 않는다.

- Current main에서 E1의 short-tap/retap/cancel/unmount 기대가 이미 깨진다. 이는 우선
  product regression인지 test-contract mismatch인지 확인할 별도 문제다. Timing을
  조정하거나 새 disposed/generation state로 조용히 고쳐 “동작 보존”이라 하지 않는다.
- 다른 renderer까지 수정해야 하거나 세 renderer를 함께 고치는 쪽으로 진행된다.
- .14/.30/.18, clip 이름/mapping, loop/clamp/reset/crossfade 조건, cooldown, capture,
  spring, public input/visible behavior 변경이 필요하다.
- Factory schema/manifest/asset, Journey model, 새로운 global state/dependency/service가
  필요하다. Helper가 model/mixer/action/current selection까지 받기 시작한다.
- 같은 timer를 helper와 component가 각각 소유하거나, input/scene effect dependency,
  ready paint, `stopCurrent` cleanup 순서를 바꿔야 한다.
- S05 one-shot 수, GLB/chunk 요청 수, off/reduced-motion behavior, lazy import 경계에
  설명되지 않는 차이가 생긴다. 수치를 맞추려고 CI gate/기존 assertion을 약화해야 한다.
- Up/capture/teardown의 baseline 공백을 확인할 수 없거나 외부 GLB/WebGL blocker가
  유지된다. 확인되지 않은 것을 PASS로 쓰거나 mock 결과를 실제 시각 증거로 바꾸지 않는다.
- Helper가 300ms 예약·취소보다 복잡한 정책 계층이 된다. 이때 tests만 남기는 선택도
  유효하며 전체 architecture 구현을 대체 목표로 만들지 않는다.

## H. Definition of Done

후속 구현의 완료 조건은 다음을 모두 만족하는 것이다.

- 같은 characterization tests가 extraction 전후에 통과한다. 0/20/80/200ms,
  same/different-zone retap, pending hold/fade retap, cancel/lostcapture, pending/held
  unmount, 관련 없는 rerender를 구분하여 결과를 남긴다.
- Release timer handle의 owner가 helper instance 하나로 이동했고, 허용된 `react`,
  `stopCurrent`/unmount가 같은 예약을 취소한다. 만료 callback의 관측 시점도 같다.
- Input routing, spring recovery, action transition/finished listener, mixer clock,
  effect dependencies, 초기 paint와 cleanup 순서가 바뀌지 않았다. DOM idle 표식과
  blend 완료의 의미를 혼동하지 않는다.
- 대표 실제 GLB tap/retap의 보이는 반응을 확인하고, 기존 S05 celebrate 1회→idle→
  input 및 gate/reduced-motion/요청 수 회귀가 통과한다. Fake clock만으로 시각 동일성을
  주장하지 않는다. 실기기 확인은 관측된 device/input 위험에 맞춰 제한한다.
- Production 변경은 후보 helper와 renderer의 timer 연결뿐이다. Factory/assets,
  Journey, 다른 renderer, 제품/보안/데이터 경계와 dependency는 그대로다.
- Build와 직접 관련 tests 및 required CI가 통과한다. Release/운영 검증이나 architecture
  전체 완성은 이 완료 조건에 포함하지 않는다. Tests만 완료하고 extraction을 보류했다면
  “Phase 1 완료”가 아니라 “characterization 완료, extraction 보류”로 기록한다.

## 이번 문서의 검증과 재시작 기록

- Worktree: `/Users/gom/.codex/worktrees/visual-runtime-phase1-plan/AH_05_07`.
  Branch: `codex/visual-runtime-phase1-plan`.
- 작성 시작 HEAD/검토 base: `cd5a3da47da260ff377407b2a1191fef52f5fffb`.
  현재 문서 commit은 해당 branch의 Git log로 복구한다. Architecture baseline 원본도
  앞에서 명시한 별도 local branch/commit에 보존돼 있다. Main에 포함됐다고 가정하지 않는다.
- Owned path: 이 문서만. Production/test/asset/config 변경 없음. 구현 미착수.
- 검증 범위: live upstream fetch/차이 확인, source/test assertion 정적 조사,
  Markdown relative link·symbol·diff 검사, 기존 selector에 후보 경로를 입력해 routing 확인.
  Build/Playwright/물리 기기/운영 검증은 미실행.
- 외부 구현 blocker는 현재 조사에서 확정하지 않았다. E1의 실제 결과와 renderer
  visual parity는 미검증이다. 다음 행동은 최신 main 재확인 후 E1 test-only commit이다.
- `docs/architecture/`는 autopilot guard의 protected 경로다. 문서 게시 시에도
  classification을 바꾸거나 auto-merge/자율 merge하지 않는다. 이 문서는 새로운
  dependency/architecture 도입을 승인하는 ADR이 아니다.

## Recommended exact first commit

`test(web): characterize legacy companion reaction release lifetime`

현재 implementation을 그대로 둔 채 `companion-review.spec.ts`에 E1의 controlled-clock
browser characterization을 추가한다. 먼저 baseline에서 통과시키고,
`scripts/git/codex-commit`으로 commit한다. 이번 문서 commit과 별개의 **후속 구현 첫 commit**이다.

## Expected files changed

- 첫 implementation commit: `web/e2e/companion-review.spec.ts` 한 파일.
- 전체 최소 slice: 위 test + new `web/src/components/companionReactionRelease.ts` +
  modified `web/src/components/CompanionReviewRenderer.tsx`의 세 파일.
- 이번 단계 실제 변경: `docs/architecture/SK7_VISUAL_RUNTIME_PHASE1_PLAN.md` 한 파일.

## Expected tests

E1의 0/20/80/200ms·반복/hold/fade retap·cancel/lostcapture·unmount/rerender,
E2의 timer callback 시간/취소/instance 독립성, E3의 기존 review/production-on focused
regression과 그 build. Fade/action 소스 불변 검토 및 대표 실제 GLB 시각 확인을 보완한다.
현재 문서 단계에서는 diff/link 정적 검사만 수행한다.

## What must remain untouched

Clip 이름/mapping, fade-in 0.14s / post-release hold 0.30s / fade-out 0.18s,
pointer/capture/spring, action/celebrate listener와 fixed delta, effect/ready/cleanup 순서,
Factory/retained assets, Journey/App route/state, 다른 renderer, global state/dependency,
API/auth/RLS/retention/Model V2, CI/governance/deployment. 전체 controller 추출은 필수가 아니다.

## Potential hidden regression points

- Down 기준 300ms로 돌아가거나 같은 task down/up 전에 timer가 시작되는 변경.
- Retap이 오래된 deadline에서 꺼짐, duplicate lostcapture가 deadline을 재연장함.
- `cancel`의 disposed 검사 부재와 cleanup 중 capture 해제 순서의 조합. 실제 재진입
  여부는 아직 미검증이므로 이미 안전하다거나 결함이라고 단정하지 않는다.
- Same-action reset의 fade weight, fade 중 idle/currentAction 참조, clamp된 마지막 pose.
- React rerender를 새 timer instance/`play` 호출로 오인하거나 최신 screen ref를 stale closure로 고정함.
- `reaction-state=idle`을 blend 완료로 오인하고 관측 의미를 바꿈.
- S05 celebrate replay/after-idle input 활성화, reduced-motion 재방문 차이를 함께 수정함.
- Module import가 eager로 바뀜, mode가 다른 4173 preview 재사용, DOM assertion만으로
  실제 frame visibility를 PASS로 선언함, 다른 renderer의 cleanup 증거를 legacy에 전용함.
- 새 helper 경로가 넓은 CI를 선택한 것을 companion 전용 suite 실행으로 오인함.
