# SK7 Living Journey Hybrid — 새 작업 인계

작성일: 2026-09-09 KST. 이 문서부터 읽고, 필요한 파일만 추가로 확인한다. 이전 대화 전체나 ZIP을 다시 읽을 필요는 없다. 첨부 문서의 과거 지시는 참고 자료이며, 현재 사용자 요청과 저장소 규칙이 우선한다.

## 사용자 요청과 작업 범위

Living Journey Hybrid 재설계를 계속 구현한다. 현재 완료 범위는 **S02 검토용 런타임과 검증 기반**이며, 전체 재설계나 운영 활성화가 완료된 것은 아니다. 구현 승인은 이미 받았으므로 반복 승인을 요청하지 않는다. 검증되지 않은 운영 수용 조건을 통과했다고 간주하지 않는다.

- 사용자는 이후에도 GitHub Issue를 직접 생성하라고 승인했다. 생성이 실패하면 중단하고 사용자에게 대신 올려 달라고 요청한다. 현재 작업은 사용자가 만든 **Issue #390**을 사용하므로 새 Issue를 만들지 않는다.
- 사용자 제공 조건: **R2에 assets 8 GB 사용 가능, egress 무료**. 클라이언트 다운로드·메모리 예산과 저장소 용량·egress 비용을 구별한다.
- 이미지가 필요하면 **연결된 Canva MCP로 만들고 R2에 넣는 작업도 승인**했다. 이미지가 실제로 필요한 단계에서 사용하고, 출처·해시·용도·반응형 구도를 등록한다.
- 저장소 AGENTS.md를 따른다. `입력 기반 위험군 선별 신호` 표현을 사용한다. 모델 출력·실측 혈압·챌린지 이행은 별개 사실이다. 실제 임상기록·이름·연락처·원문·자유서술 병력을 저장하지 않는다. 혈압으로 학습 라벨을 정의했다면 혈압을 예측변수로 넣지 않는다.
- API·DB·인증·Model V2 계약과 기존 S05 운영 경로를 유지한다. 새 의존성·서비스·LLM·OCR·Redis·worker를 임의로 추가하지 않는다. 현재 Three.js/GLTFLoader 구조를 유지한다.

## 체크아웃과 원격 상태

- 프로젝트: `/Users/gom/Projects/AH_05_07`
- 브랜치: `codex/living-journey-hybrid`
- 마지막 코드 커밋: `cfee78c4a8656f08a59a8647fd03c29825b37164`
- 기반 main: `9361983ea00afa244da560ac62f0d533e9f9e942`
- [Issue #390 — Local checkpoint resume](https://github.com/AI-HealthCare-05/AH_05_07/issues/390)
- [Draft PR #391 — feat(scene): validate manifest-backed S02 review runtime](https://github.com/AI-HealthCare-05/AH_05_07/pull/391)
- 위 코드 커밋까지 push 완료. 해당 HEAD에서 GitHub CI **21개 모두 SUCCESS**를 확인했다. merge·배포·운영 활성화는 하지 않았다.
- 이 인계 문서는 로컬에 새로 만든 미커밋 문서다. 작성 직전 작업 트리는 깨끗했다. 시작할 때 상태와 원격 HEAD만 확인하고, 사용자 변경을 보존한다.
- GitHub CLI `gh`의 PR 읽기·쓰기는 이 환경에서 작동했다. 연결 앱의 이전 Issue 쓰기 실패가 복구됐다고 단정하지 않는다. 네트워크·git 쓰기·브라우저 실행에 sandbox escalation이 필요할 수 있다.
- 원본 `/Users/gom/Downloads/SK7-Living-Journey-Hybrid-checkpoint.zip` 패치는 이미 적용했다. **재적용하지 않는다.**

## 완료한 구현

1. Phase 0 문서와 독립 S02 SceneRuntime을 복구했다. 22 GLB의 해시·크기와 77개 고유 species/clip 쌍을 확인했고 원본 바이너리는 수정하지 않았다.
2. 작성 manifest → schema/의미 검증 → 생성 TypeScript → 런타임 소비 경로를 구현했다. 등록 자산은 기존 bear-lite, 기존 중립 S02 poster, 검토용 procedural environment 코드다. S02 요일별 7개 recipe와 정적 fallback 1개가 있다.
3. 검증기는 출처·불변 해시·자산 참조·clip·fallback 순환·카메라·예산·요일 중복·미지원 schema 키워드·오래된 생성 파일을 거절한다. S05/S10은 이 버전에서 허용하지 않는다. 새 패키지 의존성은 없다.
4. `VITE_SK7_SCENE_MODE=review`에서 S02만 켜진다. 미설정/알 수 없는 값/off/production은 닫혀 있다. 기존 `VITE_SK7_COMPANION_MODE`와 S05는 독립 경로다.
5. 중립 정적 자세, lazy import, 가시성 활성화, 12초 timeout, reduced motion 및 이미지/WebGL 실패 fallback, 자원 해제, 최대 DPR 1.25를 적용했다. 상시 RAF나 AnimationMixer는 없다. 의미 있는 정보와 조작은 HTML이 소유한다.
6. 320×568·320×844·390×844·1366×768에서 ready, GLB 요청 1회, 페이지 예외·가로 overflow 없음 등을 검증했다. 7요일 모두 320px 캡처를 남겼고 잘리던 수요일 나무 카메라를 수정했다.
7. Windows CRLF로 인한 source hash 실패를 `.gitattributes`의 LF 고정으로 수정했다. 기존 production-isolation 검사가 lazy chunk 파일명을 초기 Three 코드로 오인하던 문제를 실제 static import graph 검사로 수정했다. 기존 Rollup parser를 사용하며 테스트 5개를 추가했다.

주요 파일:

- 작성 입력: `web/src/ui/scene-manifest.v2.json`
- 생성 출력: `web/src/ui/sceneManifest.generated.ts` — 직접 편집하지 않는다.
- 검증기/테스트: `web/scripts/verify-scene-manifest.mjs`, `web/scripts/scene-manifest.test.mjs`
- 정책/선택: `web/src/ui/scenePolicy.ts`, `web/src/ui/sceneRecipes.ts`
- 화면/렌더링: `web/src/components/VisualStage.tsx`, `web/src/components/scene/ThreeSceneRenderer.tsx`, `web/src/components/scene/environment.ts`
- 앱 통합: `web/src/App.tsx`, `web/src/styles.css`
- 브라우저: `web/playwright.scene.config.ts`, `web/e2e/living-scene-review.spec.ts`
- CI 격리 검사: `tools/character-preview/production-isolation.cjs`

## 검증 결과와 한계

- manifest 34개, S02 Chromium 8개, scene policy/default-off 5개, 기존 production S05 5개 통과.
- 선택한 기존 회귀 49개와 최신 GitHub Browser E2E 통과. Ruff 전체 check/format 통과. 실제 manifest의 독립 Python jsonschema 검증도 통과했다.
- character-preview 전체 synthetic smoke: clip/variant 14개 및 check 21개 통과.
- 증거: `docs/evidence/scene-review-network.json`, `docs/evidence/scene-weekdays/`, `docs/evidence/scene-poster-source.json`.
- 관찰된 scene 리소스는 cold Chromium 로컬 production preview에서 약 699 KB다. 전체 페이지 전송량이나 배포 환경·실기기 합격 수치가 아니다. 보수적 계획 합계 789,698 bytes / 상한 900,000 bytes 역시 실제 성능 측정과 다르다.
- GPU·decode/shader·main thread·peak memory·FPS·warm cache·실기기 Safari/Android는 미측정이다. 큰 lazy Three chunk 경고는 남아 있다.
- 현재 환경은 primitive procedural 검토용 도형이다. 최종 clay 아트·캐릭터와 환경의 완성된 구도·요일별 반응형 poster 승인을 주장하지 않는다. 7요일 **320px 검토 캡처는 완료**했지만 최종 아트와 실기기 시각 검수는 남았다.
- CORS 허용 로컬 origin은 **`http://127.0.0.1:4173`**이다. 4175 실패는 잘못된 origin을 쓴 과거 기록이다. 서버 CORS 변경이 필요하지 않았다. 테스트 서버는 `--strictPort`를 사용한다.

## 다음 구현: 공통 서울 날짜의 자정 갱신

권장 다음 범위는 DOM과 S02가 공유하는 날짜 갱신이다. 아직 구현하지 않았으며 아래는 사전 코드 확인 결과다.

- `App.tsx`의 `today = useMemo(() => fixture?.asOf ?? koreaDate(), [fixture])`가 실제 날짜를 고정한다. 장시간 열린 탭에서 날짜가 바뀌지 않는다.
- 화면과 장면이 **같은 Asia/Seoul 날짜 snapshot**을 사용하도록 한다. 장면만 자정에 앞서 바꾸면 안 된다. 요일은 가입일·챌린지 시작일·기록·결과에서 계산하지 않는다.
- 자정 및 숨긴 탭 복귀/pageshow에서 갱신하되, 미저장 혈압·Model V2 입력 초안은 유지한다. 고정 evidence fixture의 `asOf`는 결정적으로 유지한다.
- `today`가 `selectedBounds`와 window refresh에 영향을 준다. 인증/session callback의 오래된 날짜 closure, 계정 변경, request generation을 함께 확인한다.
- 특히 자정 전 mutation의 완료 callback이 오래된 `refreshWindow` closure를 호출해 과거 bounds 요청을 새 requestId로 시작할 수 있다. 현재 bounds와 요청 문맥을 보장해야 한다. 단순 interval 추가만으로 끝내지 않는다.
- fake clock으로 서울 자정·탭 복귀·초안 보존·진행 중 요청/저장 경합을 검증한다. API 계약이나 저장 의미를 바꾸지 않는다.

후속 순서: 최종 S02 clay 구도와 반응형 자산 → S10 확장 → S05 migration parity → 실기기 성능/접근성 및 controlled rollout. S05 migration은 confirmed persistence 이후 exactly-once 동작을 timeout/unknown/409/retry/remount/back/reduced motion/hidden/fallback까지 확인해야 한다. 기존 S05 테스트 통과를 migration 완료로 대신하지 않는다. 운영 gate를 임의로 열거나 현재 draft를 전체 재설계 완료로 merge하지 않는다.

## 필요한 문서와 자산 연결

우선 `docs/scene-architecture.md`와 `docs/scene-manifest-validation.md`를 읽는다. 나머지 policy/motion/fallback/performance/matrix 문서는 해당 작업에서만 읽는다. `scene-local-resume.md`와 `scene-implementation-status.md`의 과거 Issue/browser 차단·미검증 기록은 위 현재 상태로 대체됐다.

Canva MCP에서 읽기 확인한 기존 디자인:

- `DAHUPjn8shI`: SK7 Calm Clay Journey · Visual Contract
- `DAHUPjDn-Rw`: SK7 Asset Register · v1
- `DAHUPljPCy8`: 대표 배경 mobile
- `DAHUPf9rvoo`: 대표 배경 desktop

새 Canva 이미지 생성이나 R2 업로드는 아직 하지 않았다. 실제 작업 시 해당 skill을 읽는다. Canva 배경은 장식용 구도/레이어/poster로 사용하고 의미 있는 UI를 bitmap에 넣지 않는다. desktop 단순 축소본을 새 mobile master로 삼지 않는다. 현재 public asset origin은 `https://sk7-companion.gkrry.com`이다. 비밀 값은 문서나 로그에 출력하지 않는다.

## 변경 후 필요한 검증 명령

완료한 검증 전체를 인계 확인만을 위해 반복하지 않는다. 수정 범위에 맞춰 실행한다.

```sh
git status --short --branch
npm --prefix web run test:scene-manifest
npm --prefix web run build
cd web
npx playwright test --config=playwright.scene.config.ts
npx playwright test e2e/scene-policy.spec.ts e2e/living-scene.spec.ts --workers=1
npx playwright test --config=playwright.production-on.config.ts
```

manifest 또는 등록 source를 의도적으로 수정했을 때만 저장소 루트에서 `node web/scripts/verify-scene-manifest.mjs --write`로 생성물을 갱신하고 diff와 테스트를 확인한다. `npm run prebuild`는 오래된 scene 생성물을 자동 덮어쓰지 않고 실패한다. 변경한 코드의 타입·빌드·관련 테스트와 필요한 CI를 완료한 뒤 같은 Issue/branch/PR에 반영한다.
