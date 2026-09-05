# 개발용 캐릭터 검토 화면과 검증 범위

Issue #232. 기준 `c46c772486a30319e594dbb9cf555263d5fba1a9`에서 작성한 별도 개발
도구다. [ADR-0006](adr/0006-local-character-preview.md)과
[실행/재검증 방법](../tools/character-preview/README.md)을 따른다. 운영 제품에
연결하지 않고 model_not_ready, 기존 모델 evidence·manifest·CONFIG·lock을 보존한다.

## 구현된 검토 경로

12종 목록에서 준비된 한 자산만 읽고 표준/경량을 전환한다. 실제 GLB에서 clip·
bone·mesh·material·texture 및 크기를 읽으며 선택/재생/일시 정지/처음 정지와
마우스·키보드 시점 조작을 제공한다. 로딩·미준비·실패·정적 대체 상태를 구분한다.
reduced-motion은 GLB 없는 정적 표시다. 이전/늦게 완료된 자산은 해제하며 context
loss도 점수·대체 성공 결과 없이 정적 안내로 바뀐다.

공식 npm Three.js 0.185.1 tarball integrity를 검증해 외부 local cache에 보존했다.
license·파일 manifest가 그 경로에 있고 운영 package/lock에 추가하지 않았다.
loopback server는 명시된 자산/vendor의 허용 파일만 읽으며 외부 URI GLB는 거부한다.
원자료·분할 데이터·건강정보·모델 학습 파일을 이 도구에서 읽거나 생성하지 않는다.

## 검사 종류와 한계

| 검사 | 증명하는 것 | 증명하지 않는 것 |
| --- | --- | --- |
| 합성 두-bone fixture, 7clip × 2variant | 선택/재생/loop·bone 변화·pause/stop, 실패/대체와 자원 처리 코드 | 실제 동물 형태나 품질 통과 수량. fixture의 표준/경량은 같은 작은 합성 파일 |
| 실제 제작 GLB | 준비된 자산의 7clip × 2variant 시간·bone 변화·실제 loop 완료, pose 캡처, bytes/SHA·전후 불변 | 누락 면·관절 관통·발 미끄러짐·루프 경계의 시각 품질이나 사용자 최종 승인 |
| 1366×768 / 390×844 / 320×844 | 가로 넘침, 표시·키보드 초점/회전, 해당 renderer의 bounded RAF 표본 | 실제 모바일 기기·운영 FPS·다른 GPU. 녹화/동시 부하가 있으면 별도 명시 |
| 10회 자산 교체 | renderer geometry/texture/program 수가 초기 두 상태보다 증가하지 않음 | 모든 드라이버·장시간 세션의 메모리 누수 부재 |
| fallback / lazy | 읽기 실패·미준비·초기 reduced·no-WebGL·context loss 대체, 선택 외 GLB prefetch 없음 | 자산 자체의 검토/출시 완료 |
| production build / 일반 검사 | 운영 bundle에 viewer/Three.js 경로·식별 내용이 없고 기존 계약과 분리 | 배포나 운영 검증 완료 |

합성 fixture 로컬 검증에서 14clip-variant의 loop 완료와 대체/교체 검사를 통과했다.
초기 검사 도중 URL 경로 정규화와 키보드 focus-visible 검사 방식을 수정했고 실패
기록을 별도 경로에 보존했다. v2 실제 곰의 초기 smoke는 마지막 실패 주입 glob이
중첩 경로를 놓쳐 timeout으로 끝났으므로 통과 결과로 쓰지 않는다. 검증 도구는
중첩 GLB 경로도 실패 주입하도록 수정했다. 실제 자산별 최종 결과는 새 실행의
`verification.json`과 제작 manifest를 대조해야 한다.

2026-09-06 Windows의 곰 v003 후보는 7clip × 2variant에서 실제 loop·bone 변화,
pose PNG, viewport3개, 10회 자원 교체와 대체 상태, catalog/GLB 전후 해시 불변을
포함한16개 검사를 통과했다. 편집 없이 실제 브라우저 WebM도 로컬에 보존했다.
표준형은32,656삼각형·1,035,908bytes, 경량형은14,276삼각형·521,224bytes이며
각20bones·22skinned meshes·7clips였다. 제작 중 후보의 기능 검사이며 다른 버전이나
나머지11종의 통과를 뜻하지 않는다. 제작/사람 품질 통과 수량으로 계산하지 않는다.

| v003 경량형 viewport | RAF 표본 / 구간 | frame P50 / P95 | 평균 간격의 역수 FPS |
| --- | --- | --- | --- |
| 1366×768 | 72 / 3.6499초 | 50.0 / 66.7ms | 19.73 |
| 390×844 | 81 / 3.6498초 | 50.0 / 66.6ms | 22.19 |
| 320×844 | 112 / 3.6665초 | 33.3 / 50.0ms | 30.55 |

기본 ANGLE 경로를 요청했지만 실제 renderer는 Vulkan SwiftShader였다. render DPR1,
AA off, WebM 녹화가 있는 headless Chromium 표본이다. 로드/resize 뒤1초를 제외하고
linear 분위수로 계산했다. Blender를 멈춘 검증 창이지만 다른 모든 시스템 작업이
없음을 증명한 측정은 아니다. 표본은 짧고 반복 측정한 신뢰구간이 없으므로
운영/실기기/목표 FPS 통과를 주장하지 않는다. 이 환경의 자원 부담 때문에 이후
Blender와 브라우저 검사는 동시에 실행하지 않는 절차를 유지한다.

Windows/Linux CI는 임시 fixture만 실행한다. 실제 자산은 Git·CI runner에 자동
업로드하지 않는다. 공개 가능한 CI의 코드 경계 검사와 외부 로컬 자산 검증을
구분하며, 제작 품질 통과 동물/clip 수는 G4의 검사 결과에서만 집계한다.

## 재개와 보존

새 catalog/GLB가 준비되면 해당 입력을 고정하고 새 외부 결과 경로에 verifier를
실행한다. `--record`는 실제 브라우저를 WebM으로 녹화하며 성능 결과에 녹화 부하를
표시한다. 기존 결과 경로를 재사용하면 중단한다. 기본20분 또는 `--timeout-ms`의
상한에 도달하면 브라우저/서버를 닫고 실패 기록을 남긴다. 큰 자산/캡처/녹화는
로컬 manifest로 추적하고 승인되지 않은 외부 upload를 하지 않는다. 같은 디스크
보존은 독립 backup이 아니다. 사용자가 PR을 검토·병합하며 1회차는 계속 진행 중이다.
