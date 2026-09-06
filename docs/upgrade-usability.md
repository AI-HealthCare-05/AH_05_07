# SK7 기록 사용성 개선 — G1

Issue [#228](https://github.com/AI-HealthCare-05/AH_05_07/issues/228).
기준은 PR #227 병합 `c46c772486a30319e594dbb9cf555263d5fba1a9`다.
현재 제품의 기록 과업을 개선하며 [FR-07/08과 NFR-08](requirements.md),
[AC-04/06/08](acceptance-test-plan.md)의 **로컬 합성 검증 범위**에 해당한다.
운영 환경 검증·사용자 조사·1회차 종료 승인을 대신하지 않는다.

## 변경 전후와 구현 근거

| 과업 | 확인한 기존 문제 | 변경과 검증 |
| --- | --- | --- |
| 현재/이전 기록 조회 | 기간 선택은 7일 화면에만 있었고 이전 기간이 오늘 화면까지 이어졌다. 늦은 이전 요청이 새 기간 결과를 덮을 수 있었다 | 목록에도 기간 선택과 날짜·읽기 전용 안내를 표시한다. 오늘/입력 화면으로 이동하면 현재 기간을 불러온다. 이전 요청의 성공·실패가 최신 요청 상태를 덮지 않도록 요청 순서를 검사한다 |
| 혈압 기록 수정 취소 | 수정 화면을 열 때 선택한 상세 키를 잃어 취소하면 원래 상세로 돌아가지 못했다 | 수정 시작 위치를 보존한다. 입력을 바꿔도 취소는 요청을 보내지 않고 원래 상세의 저장된 값을 보여준다 |
| 기록 삭제 | 확인창이 본문 위에 나타나 초점이 삭제 버튼에 남았다. 확인 취소/다른 화면 이동의 맥락이 불명확했다 | 네이티브 modal dialog에서 날짜·시간대·기록 종류와 되돌릴 수 없음을 보여준다. 최초 초점은 취소, Escape는 요청 없이 닫기, 닫으면 원래 버튼으로 복귀한다. 처리 중에는 확인/취소를 막고 실패 안내는 대화상자 안에 남긴다 |
| 이전 방식의 기록 | 현재 기간에 있는 legacy 기록도 “이전 7일” 때문에 읽기 전용이라고 설명했다 | 이전 **방식**과 이전 **기간**을 구분한다. legacy는 현재 기간 안에 있어도 읽기 전용임을 설명한다 |
| 실패와 재확인 | 서버의 입력 거부 422도 저장 결과를 모르는 상태로 표시했다. stale/불확실 쓰기의 다음 행동이 약했다 | 422는 입력 정정, 연결/스토리지 실패는 처리 결과 확인 필요로 구분한다. 마지막으로 읽은 기록은 최신이 아닐 수 있음을 표시하고 목록 확인 경로를 제공한다. 불확실 쓰기를 자동 재전송하지 않는다 |
| 날짜와 한국어 | 장식 7일 경로의 “오늘”이 항상 네 번째였다. 긴 제목의 단어가 중간에서 갈라졌다 | 오늘을 마지막으로 하는 실제 최근 7일 날짜를 표시한다. 한국어 단어 줄바꿈·제목 크기·모바일 메뉴 글자 크기·측정 안내를 정리한다. 참여 횟수나 건강 성과를 이 장식에 부여하지 않는다 |
| 키보드와 확대 | 화면 전환 뒤 초점 맥락이 없었다. 날짜 입력 내부 달력 버튼에서 외곽 초점이 사라졌다. 좁은 높이에서 숨김 컨테이너의 가로 스크롤이 입력을 왼쪽 밖으로 밀었다 | 본문 건너뛰기와 화면 제목 초점, date 내부 focus-within 표시, 고정 메뉴에 가리지 않는 스크롤 여백을 적용한다. 장식 clipping이 별도 스크롤 영역을 만들지 않도록 수정한다 |

구현은 [App](../web/src/App.tsx), [SceneShell](../web/src/components/SceneShell.tsx),
[삭제 확인](../web/src/components/DeleteConfirmation.tsx), [문구](../web/src/ui/journey.ts),
[CSS](../web/src/styles.css)에 있다. API·DB·입력 schema·의존성·lock·승인된 모델 evidence는
변경하지 않는다. `model_not_ready`와 점수 없는 **입력 기반 위험군 선별 신호** 화면을 유지한다.
질문 검토 패키지의 의미·번역 타당성·adapter 지원을 승인하지 않는다.

## 재현과 캡처

원래 작업 트리와 제출 검토본을 보존한 별도 worktree에서 실행한다. 기존 lock을 사용한다.
아래 출력 경로는 매 실행 새 외부 경로로 선택한다. Playwright는 지정한 출력 폴더를
정리할 수 있으므로 기존 검증 폴더를 재사용하지 않는다.

```powershell
npm --prefix web ci
# 각 명령의 종료 코드가 0일 때만 다음 단계로 진행
Push-Location web
$env:CI = '1'
npx playwright test --workers=1 --output='<새 외부 폴더>/browser'
npx playwright test --config=playwright.production.config.ts --workers=1 --output='<새 외부 폴더>/production'
Pop-Location
python scripts/ci/verify_secret_boundary.py --self-test
python scripts/ci/verify_secret_boundary.py --web-dist web/dist
python scripts/ci/verify_deployment_smoke.py --self-test
git diff --check
```

[기존 회귀](../web/e2e/signed-in-harness.spec.ts)와
[G1 검사](../web/e2e/usability.spec.ts)는 loopback 브라우저와 모의 API의 합성 응답만 사용한다.
실제 계정·인증·저장·운영 응답을 검증한 것이 아니다. 캡처는 기존 `VP-10`의 가려진
측정값과 no-score 상태이며 S02/04/08/10/11/14를 각 viewport에서 생성한다.
별도의 신규 접근성 라이브러리나 문서를 그대로 되풀이하는 검사는 추가하지 않았다.

검증 환경: Windows, Node 24.11.0, npm 11.6.1, lock의 Playwright 1.62.1 / Chromium,
Vite 7.3.6. 브라우저 검사는 한 worker로 실행한다. CI의 기존 Browser E2E workflow에
추가 검사가 자동 포함되며 기존 일반 CI·production fixture 차단 검사를 유지한다.

검사 범위는 1366×768, 390×844, 320×844 및 683×384의 layout이다.
683×384는 1366×768 화면에서 200% 확대했을 때의 CSS 작업 공간을 재현한 것이며
실제 기기의 브라우저 확대 버튼을 조작한 결과로 표현하지 않는다. 별도로 200% 텍스트
확대의 넘침·건너뛰기 링크도 확인한다. 네이티브 날짜 필드, 수정 취소, modal Tab/Enter/
Escape, 초점 표시·가림 여부를 확인한다. 실제 휴대폰·스크린리더 사용자·과업 성공률
조사는 미실시이며, 전면적인 WCAG 인증을 주장하지 않는다.

## 상태와 남은 확인

로컬 결과: 브라우저 35개 통과(기존 25개 + G1 10개),
secret-boundary/deployment-smoke self-test, Ruff check/format 통과.
source commit·최종 production 검사·캡처 크기/SHA-256은 G1 실행 폴더의 manifest 및 PR에
기록한다. 실패했던 진단 결과와 변경 전 캡처는 덮어쓰지 않고 로컬에 보존한다.
같은 디스크의 보존을 독립 백업이라고 부르지 않으며 외부 업로드는 하지 않는다.

[O1/O2/O3](mvp1-operations-review.md), 실기기/스크린리더·사용자 이해도 검토,
입력 의미·모델 품질/출시 승인, 발주 범위 수용과 사용자 최종 검토는 남아 있다.
[1회차 마감](mvp1-closeout.md)은 진행 중이다. 한국어와 초점 개선으로 이 조건들을
완료 처리하지 않는다.
