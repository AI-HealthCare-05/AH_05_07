# 남은 기기 검사 — 2026-09-10

Issue #390 / PR #391의 후속 검사다. 기존 Android 반복 검사와 이미 통과한 커밋의 GitHub CI는 다시 실행하지 않았다. S02/S10의 42개 아트 자산과 승인 범위는 유지한다. 아래 Simulator 결과를 실제 iPhone 결과로 합치지 않는다.

## CURRENT QUALIFICATION — Verification Policy v0.2 (2026-09-13)

현재 분류 기준은 upstream `main`
`6abee8f7842fef9f9d2eea83ce7bbfe4a0ad4d16`이다. 이 SHA는 분류 기준일 뿐,
아래의 과거 기기 evidence를 현재 SHA에서 재실행했다는 뜻이 아니다. 최종
production scene activation의 작은 REQUIRED 목록과 운영 절차는
[release gates](scene-release-gates.md)가
관리한다.

| 분류 | 현재 처리 |
| --- | --- |
| **REQUIRED** | 별도 승인된 activation Issue/PR, 최종 후보 HEAD의 required CI와 변경 경계 검사, confirmed-save S05 1회성·저장/복구·내비게이션·semantic fallback, production 설정/단일 Worker topology, 배포 smoke와 signed-in synthetic affected flow, 현재 known-good 대상의 rollback/restore 능력만 activation gate다. |
| **CONDITIONAL** | renderer/resource/art, Safari·viewport·input, semantic/focus/motion/reflow, CDN/cache/chunk recovery 중 관련 경계가 바뀌거나 실제 문제가 관찰될 때만 대표 physical device/browser, 관련 AT 조건, GPU/메모리/FPS, 실제 망, broad matrix·30-cycle·poster 재캡처를 요구한다. |
| **DEFERRED / OBSERVATIONAL** | 현재 증상이 없는 absolute GPU/peak memory와 정확한 presented FPS, 남은 JS heap/long-task 귀속, Wi-Fi와 cellular 각각의 반복, physical iPhone confidence check, 모든 audible/touch/switch 조합, 다음 실제 배포의 stale-chunk 자동 recovery proof, 승인된 S05 위치 polish는 release를 막지 않는다. |

Simulator Safari와 semantic fallback evidence는 physical iPhone PASS로 바꾸지
않는다. 반대로 3D가 실패해도 핵심 HTML/CSS 기능이 안전하게 유지되는 현재
경계에서는 physical iPhone 부재나 정량 GPU/FPS 미측정만으로 release를
무기한 막지 않는다. PR #462의 다음 cross-deployment physical proof는
opportunistic evidence이며, 재발하거나 recovery/cache 경계가 바뀌면 그때
CONDITIONAL 검증으로 승격한다. R2/CORS/WebGL 원인 가설은 만료 상태를 유지한다.

Issue #390의 review-candidate qualification 역할은 완료됐다. 이 분류 PR이
merge된 뒤 Issue #390은 자동으로 닫지 않고 **CLOSE NOW**를 권고하며,
production activation은 별도의 명시적 승인 record에서 REQUIRED gate만 추적한다.

> **Historical reference notice:** 아래 결과·절차·미측정 표시는 당시 evidence와
> provenance를 보존하기 위한 reference다. 위 CURRENT QUALIFICATION과 충돌하는
> 과거의 `남은 항목`, `required`, `gate` 표현은 현재 blocker 목록이 아니다.
> CONDITIONAL trigger가 없으면 반복 실행하지 않는다.

**사용자 직접 검사 결과:** 스마트폰 HTTPS 검토 주소를 안내한 뒤 사용자가 “모두 정상 작동입니다!”라고 보고했다. [사용자 검사 기록](evidence/scene-phone-user-check.json)에 정상 작동 보고를 반영했다. 기종·OS·브라우저와 실제 확인한 조건은 추가 확인 중이다. 접근성 설정·각 통신망·정량 성능의 개별 통과 여부는 이 보고만으로 확정하지 않는다.

**S05 최종 시각 승인 완료:** 사용자는 저장 직후 애니메이션 위치가 살짝 어색하다고 했지만, “이번 PR 이후, 추후에 수정하면 충분할 것 같습니다. 최종 승인합니다.”라고 명시했다. 현재 후보를 승인하고 위치의 미세 조정은 이번 PR 이후 후속 작업으로 남긴다.

## Samsung Internet stale-chunk 후속 — 2026-09-12–13

- Samsung Internet에서 새로고침 후 S05 곰이 다시 표시되어 fresh-load S05는
  **PASS**다. production live bundle의 PR #462 recovery marker도 확인했다.
- 원인은 오래된 entry bundle과 새 배포 사이의 version skew다. entry가 이미
  제거된 Vite hashed dynamic chunk를 요청했고, SPA fallback의 `text/html`
  응답 때문에 import가 실패했다. GLB fetch·CORS·WebGL2는 정상이었고
  R2/CDN GLB cache rule도 원인이 아니므로 해당 가설은 만료한다.
- PR #462는 `vite:preloadError`에서 한 번만 reload하고, PR #463은 그 복구
  동작에 맞게 test contract만 정리했다. S02/S10은 두 번째 실패에서 fallback
  하며 무한 reload하지 않는다. S05 reload는 일시적인 저장 presentation을
  복원하지 않고 S02로 돌아간다.
- 다음 실제 배포에서 cross-deployment recovery가 자동 수행되는 physical
  proof는 **OPEN**이다. 이 결과로 실제 iPhone Safari, 접근성, GPU·메모리,
  실제 망 gate를 새 PASS로 분류하지 않는다.

## 이번에 확인한 결과

| 순서 | 결과 | 남은 항목 |
| --- | --- | --- |
| 1. Android 메모리·반응 | 기존 힙의 오프라인 분석 완료. 스냅샷의 비네이티브 증가 424,048바이트 중 코드 영역 411,532바이트. CDP 증가 488,276바이트와는 측정 시점·계산 방식이 다르다. | 두 증가량의 차이 64,228바이트는 미귀속. 코드 증가의 정체 여부, 실제 Android 첫 로딩 중 입력·저장·이동 지연, GPU·프로세스 최대 메모리는 미확인. |
| 2. Safari | iPhone 17 / iOS 26.5 **Simulator**의 Safari 26.5에서 S02/S10의 실제 WebGL 캔버스, S05 1회 재생과 기록 목록·앱 복귀 후 비반복을 확인했다. 이후 스마트폰 HTTPS 검토에서 사용자 정상 작동 보고를 받았다. | 새 사용자 보고의 기종·브라우저·세부 검사 범위를 확인 중이다. 실제 iPhone Safari 통과로 분류하기 위한 조건이 아직 없다. 초기 Simulator 복귀 검사는 위치 수정 전 빌드에 해당한다. |
| 3. 접근성·오류 복구 | 현재 후보의 S05 320/390/1366px 키보드·장식 경계, 200% CSS 확대와 미디어 전체 실패, 스크롤된 입력 화면에서의 저장·비반복 회귀를 합쳐 5/5 통과했다. | 실제 TalkBack 음성·손가락 탐색, OS 동작 줄이기·큰 글씨, 실제 iPhone VoiceOver 검사가 남았다. CSS 확대를 OS 큰 글씨 통과로 처리하지 않는다. |
| 4. 실제 망 | 합성 입력 전용 임시 HTTPS 검토 환경을 준비했고 사용자 정상 작동 보고를 받았다. 원본 해시를 검증한 GLB를 같은 Origin에서 제공한다. | 사용한 망과 Wi-Fi/모바일 데이터 각각의 검사 여부를 확인 중이다. 현재 환경은 `no-store`와 검토용 GLB 미러를 사용하므로 운영 전송량·캐시 검사는 별도로 필요하다. |
| 5. S05 시각 | 입력 컨트롤 최소 16px와 저장 확인 영역 옆의 중앙 높이 배치를 적용했다. Simulator에서 확대율 1, 캐릭터 전체 노출, 약 4초간 1회 재생을 확인했다. 수정본 스마트폰 검토 후 **사용자 최종 시각 승인 완료**. | 저장 직후 애니메이션 위치의 미세 조정은 사용자 결정에 따라 이번 PR 이후 후속 작업으로 진행한다. 현재 후보의 시각 승인을 보류하는 항목이 아니다. |

## 근거와 수정 범위

- [기존 Android 힙의 추가 분석](evidence/scene-android-heap-growth-accounting.json), [계산 방식과 한계](scene-memory-investigation.md#offline-accounting-of-the-remaining-growth)
- [최초 Simulator Safari 검사](evidence/scene-ios-simulator-safari.json): S02/S10 `ready`, Apple GPU, 캔버스 각 1개, 402px 레이아웃에 가로 넘침 없음. S05가 한 번 재생된 뒤 앱 전환과 history return에서도 추가 재생되지 않았다.
- [S05 위치 수정 후 검사](evidence/scene-ios-simulator-safari-position-fix.json): 실제 빌드 파일과 작업 트리 소스 해시를 기록한다. 초기 전환부터 캐릭터 슬롯 상단은 약 164~285 CSS px에 있었고, 입력·저장 중 확대율은 1이었다. 저장 이벤트·GLB·카메라·표정·길이는 바꾸지 않았다.
- [VoiceOver 기록의 환경 정정](evidence/scene-ios-voiceover-user-check.json): 사용자가 기존 결과도 “같은 Simulator에서 확인”했다고 명시했다. 기존 의미 구조 관찰은 유지하고, 실제 iPhone이라는 이전 분류를 정정했다.

14px 입력 컨트롤을 사용한 원래 Simulator 실행에서는 입력 후 확대율이 약 1.14179로 유지됐다. 이때 `innerWidth`는 352였지만 문서의 client/scroll width는 모두 402였다. 이를 CSS 가로 넘침으로 단정하지 않는다. 키보드가 닫히는 동안 Safari가 스크롤 위치를 조정하므로, 검토용 캐릭터가 장면 상단에 붙지 않도록 배치했다. 최종 변경은 S04 컨트롤 글자 크기와 S05 검토 경계 위치에 한정된다. S02/S10 공통 스타일·아트 소스, 기존 production 캐릭터 배치, 저장/오류/재생 이벤트 로직, 내비게이션 스크롤 로직은 동일하다.

## 로컬 검토 페이지

현재 빌드가 근거 파일의 해시와 일치할 때만 서버가 시작된다.

```sh
node web/scripts/serve-scene-device-review.mjs docs/evidence/scene-ios-simulator-safari-position-fix.json
```

Simulator Safari에서 `http://127.0.0.1:4173/?e2e=signed-in&screen=S04&review=position-center-1`을 연다. 빌드를 교체한 뒤에는 `review` 값을 새 값으로 바꿔 새 문서를 로드하고, 변경된 화면인지 확인한다. 수축기 **120**, 이완기 **80**만 입력하고 저장한다. 모든 API 응답은 메모리 안의 합성 fixture이며 실제 저장 요청은 발생하지 않는다. `/__evidence`는 값·이름·기록 내용 없이 상태·횟수·레이아웃 수치만 내보낸다.

서버는 `127.0.0.1`에만 연결을 받으며 모든 응답은 `no-store`다. 캐시·전송량 측정용 서버가 아니다. `4174` Origin에는 GLB의 `Access-Control-Allow-Origin` 응답이 없어 대체 화면으로 전환됐다. 기존에 허용된 정확한 `http://127.0.0.1:4173` Origin으로 옮긴 뒤 3D 표시를 확인했다. 이 과정에서 공개 CORS, 배포 또는 운영 gate를 변경하지 않았다. 외부 검토 환경을 준비할 때도 Origin과 GLB 응답 헤더를 먼저 확인한다.

## 스마트폰 HTTPS 검토 주소

[스마트폰 검토 시작](https://zus-pine-lynn-char.trycloudflare.com/) · [S04 입력부터 시작](https://zus-pine-lynn-char.trycloudflare.com/?e2e=signed-in&screen=S04&review=phone-position-1)

2026-09-10에 만든 Cloudflare Quick Tunnel 임시 주소다. Mac의 검토 서버와 터널이 실행 중일 때만 사용할 수 있으며 재시작하면 주소가 바뀔 수 있다. 별도 로그인 없이 가상 계정으로 시작하고 수축기 **120**, 이완기 **80**만 사용한다. 저장은 현재 문서의 메모리에서만 흉내 내며 새로고침하면 초기 합성 기록으로 돌아간다. 실제 저장 지속성 검사용이 아니다.

`serve-scene-phone-review.mjs`는 시작 시 현재 후보 빌드 해시와 22개 GLB의 원본 해시·크기를 확인한다. 승인된 정적 파일만 메모리에 고정하고 GET/HEAD만 제공한다. 로컬 Simulator 서버의 `/__probe`, `/__evidence`, 소스·환경 파일은 공개하지 않는다. 브라우저의 합성 API 응답과 GLB 경로 치환을 제외한 앱 번들은 동일하다. 운영 배포·공개 CORS·production scene gate를 변경하지 않았다.

```sh
node web/scripts/serve-scene-phone-review.mjs docs/evidence/scene-ios-simulator-safari-position-fix.json
cloudflared tunnel --no-autoupdate --url http://127.0.0.1:4175
```

[HTTPS 확인 근거](evidence/scene-phone-review-https-smoke.json)는 데스크톱 Chromium의 모바일 화면 모사다. 실제 기기 통과로 분류하지 않는다. S10의 3D 영역은 화면 아래에 있으므로 스크롤해서 확인한다. 실제 망에서도 터치·음성·화면 반응을 확인할 수 있지만, `no-store` 응답과 GLB 미러의 전송량을 운영 CDN 캐시 성능으로 대체하지 않는다.

## Historical 직접 확인 순서

1. 실제 Android: TalkBack으로 S02 → S04 합성 저장 → S05 → S10의 제목·버튼을 읽고 손가락 탐색한다. 장식 캐릭터에 포커스가 가지 않고 저장 확인이 중복되지 않는지 듣는다.
2. 실제 iPhone: Safari 버전과 기기를 기록하고 S02/S10 캔버스·S05 1회 재생을 확인한다. 뒤로 가기, 재생 중 앱 전환, 복귀, OS 동작 줄이기와 큰 글씨 조건을 구분한다.
3. 위 HTTPS 주소를 Wi-Fi와 모바일 데이터에서 각각 열어 화면·입력·이동 반응을 확인한다. 운영과 같은 전달·캐시 설정의 검토 환경에서 첫 방문·재방문·새로고침 전송량을 별도로 측정한다. localhost 또는 Simulator 결과로 모바일 데이터 통과를 기록하지 않는다.

표시되지 않는 GPU·최대 메모리·실제 화면 프레임 수치는 미측정으로 남긴다. S05 최종 시각 승인 후 사용자가 이번 PR 병합을 요청했다. 승인된 수정과 근거를 포함한 최종 커밋의 CI를 확인한 뒤 검토 후보를 squash merge하는 범위다. 기존 통과 커밋의 CI와 Android 반복 검사는 재실행하지 않는다. 운영 scene gate는 닫힌 상태로 유지하며 배포·운영 활성화는 포함하지 않는다. [병합 범위와 남은 운영 조건](scene-release-gates.md#review-candidate-merge-scope--2026-09-10)을 따른다.
