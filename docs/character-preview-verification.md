# 개발용 캐릭터 검토 화면과 검증 범위

Issue #232. 기준 `c46c772486a30319e594dbb9cf555263d5fba1a9`에서 작성한 별도 개발
도구다. [ADR-0006](adr/0006-local-character-preview.md)과
[실행/재검증 방법](../tools/character-preview/README.md)을 따른다. 운영 제품에
연결하지 않고 model_not_ready, 기존 모델 evidence·manifest·CONFIG·lock을 보존한다.

## 현재 확인된 범위

2026-09-06 로컬 검토와 별도 선별 단계에서 **11종·77개 고유 동작**을 선언한 기술
QA 범위의 통과로 선정했다. 표준/경량의 재생 횟수를 고유 동작 수에 중복 합산하지
않는다. reviewer sidecar의 명시적 판정과 실제 참조 파일을 대조한 뒤 카탈로그를
갱신했다. inventory는 보관 상태이며 자동으로 품질 통과를 추론한 결과가 아니다.

기존 7종의 실제 실행 이력은 그대로 유지한다.

사용자는 2026-09-06 현재 완료된 3D 작업까지만 마감하도록 요청했다. 이번 목표는
선정 11종·77동작의 검토본으로 조정하며 물범 추가 제작은 제외한다. 최초 12종·84동작
목표를 달성한 것으로 소급하거나 사람 디자인·제품 출시 승인으로 해석하지 않는다.

| 후보 | 실제 전체 viewer 실행 | 외부 로컬 QA 루트의 검토 기록 |
| --- | --- | --- |
| 곰 v007·토끼 v002 | `ffcbf7eaa15a7b7a5920feee37f410d95cd687d6` | `g5-technical-review-bear-rabbit-dog-001.json`; 추가 바닥은 아래 강아지 실행 SHA |
| 강아지 v001 | `a707a9e186cf5999a7c73499227408a25c898da4` | 위 세 후보 sidecar; 같은 SHA의 바닥 검사와 별도 원본 열기를 구분 |
| 고양이 v002 | `bedaa179be9977842e1232d926346c4a0ec6ba80` | `g5-technical-review-cat-v002-001.json` |
| 레서판다 v003·수달 v003·카피바라 v002 | `2033c366e742645cb31f642b7b4a8a44fc7e1257` | [새 세 후보의 근거와 한계](#새-세-후보-실행-기록과-한계) |

새 네 후보의 실제 viewer 실행은 모두 `b28596c3e2ac8390364621c49d38a3983ea497ec`이다.
아래 생성 SHA, catalog의 기준 `c46c772486a30319e594dbb9cf555263d5fba1a9`, 실제
viewer SHA와 **후속 문서 반영 커밋**은 각각 다른 참조다. 과거 full JSON의
`sourceCommit`이나 실행 당시 catalog hash를 현재 문서/선택 hash로 고치지 않는다.

| 추가 선정 후보 | 실제 생성 commit | 전용 동작의 추가 표본 | 외부 로컬 검토 기록 |
| --- | --- | --- | --- |
| 펭귄 v002 | `a08919bf1b85ee0af3da4030e3b306bb89945317` | 양 변형 정면/옆면4loop·16자세; .125/.375/.625/.875 | `g5-technical-review-penguin-v002-001.json` |
| 다람쥐 v001 | `79f46ae22cf7a19821409426108f5ac45105b255` | 양 변형3뷰6loop·24자세; .125/.375/.625/.875 | `g5-technical-review-squirrel-v001-001.json` |
| 고슴도치 v004 | `7d9d97ee520bebe73556cf9787a4eea2de73d327` | 양 변형3뷰6loop·30자세; .25/.375/.5/.625/.75 | `g5-technical-review-hedgehog-v004-001.json` |
| 여우 v002 | `7d9d97ee520bebe73556cf9787a4eea2de73d327` | 양 변형3뷰6loop·30자세; .25/.375/.5/.625/.75 | `g5-technical-review-fox-v002-001.json` |

각 새 후보는 편집 원본2개를 새 Blender 세션에서 열고, 전체18개 기능 검사와
7clip ×2variant의14개 실제 loop, 고정 표준형 바닥의 정면/옆면12loop·36자세,
1366/390/320 화면과 전체/바닥 영상 decode를 통과했다. 위 추가 표적은 정면·옆면·
뒤 사선이며 펭귄은 정면·옆면이다. 모든 과정은 새 외부 출력에서 순차 실행했고
기존 7종의 결과·실패 후보·승인된 모델 evidence는 변경하거나 재실행하지 않았다.

새 4종의 실제 검토에서 펭귄의 반대 방향 몸통 기울기와 부리/꼬리 부착, 다람쥐의
좌우 고개·작은 뜀·상향 꼬리 연결을 확인했다. 다람쥐의 정면은 공통 곰형 인상이
남는다. 고슴도치는 가시 기저의 큰 분리 없이 머리·상체를 작게 오므렸으며 완전한
공 모양 동작은 아니다. 여우는 흰 꼬리 끝이 앞으로 감겼다가 복귀하지만 앉은 자세의
깊은 hip 주름, 꼬리에 가려지는 하완·다리의 정확한 표면 간극은 미확인이다.
숨은 가시 기저 전체와 중간 자세의 자기 교차를 표본 이미지로 모두 인증하지 않는다.

원본 열기는 편집 구조 검사이고, 전체 loop 진행·영상 decode는 프로그램 검사다.
시각 판정은 sidecar에 명시한 실제 자세와 추출 프레임에 한정하며 사람이 모든
프레임을 관찰했다는 뜻이 아니다. 진단 영상의 초기 로딩, 조작부를 따라가는 스크롤,
마지막 바닥 화면 크기 변경의 회색 여백을 보존한다. 이는 잘 다듬어진 발표용 영상이
아니다. 레서판다의 기존 작은 꼬리 면 normal 진단과 모든 후보의 정확한 접촉·물리
접지·전 프레임 충돌·실제 모바일/운영 성능 미확인도 계속 남는다.

**물범은 `needs_revision`이며 선택 수량에 포함하지 않는다.** v001은 실제 박수에서
지느러미가 만나지 않았다. 제한된 단일 구조안도 몸통/지느러미 교차로 미채택되어
generator에 통합하지 않았고, 같은 계열의 추가 탐색을 중단했다. 카탈로그의
`standard`/`light`/`hero`는 null이며 실패 원본과 진단을 보존한다. 이전 여우 v001의
꼬리 감싸기 실패도 v002 결과로 덮어쓰지 않는다. 모든 후보의 사람 디자인 검토는
대기이며 12종/84동작·제품 출시·1회차 종료가 완료됐다는 뜻이 아니다.

외부 로컬 QA 루트의 `run-20260906-0319/selection-eleven-001.json`은 새 4종 선별과
8개 영상의 동일 바이트 사본을, `selected-inventory-eleven-001.json`은 11후보·77고유
clip과 보관 파일을, `manifest-checkpoint-eleven-001.json`은 개별 기술 판정·참조를
연결한다. 각 선정 폴더에는 `motion-preview.webm`과 `ground-preview.webm`이 있어
총22개다. 이전 실행 catalog와 새 선택 catalog는 각각의 hash로 보존하며 재인코딩하지
않았다. 같은 디스크 사본은 독립 백업이 아니다. 큰 파일은 Git에 추가하지 않는다.

## 구현된 검토 경로

12종 목록에서 준비된 한 자산만 읽고 표준/경량을 전환한다. 실제 GLB에서 clip·
bone·mesh·material·texture 및 크기를 읽으며 선택/재생/일시 정지/처음 정지와
마우스·키보드 시점 조작을 제공한다. 로딩·미준비·실패·정적 대체 상태를 구분한다.
reduced-motion은 GLB 없는 정적 표시다. 이전/늦게 완료된 자산은 해제하며 context
loss도 점수·대체 성공 결과 없이 정적 안내로 바뀐다.

공식 npm Three.js 0.185.1 tarball integrity를 검증해 외부 local cache에 보존했다.
license·파일 manifest가 그 경로에 있고 운영 package/lock에 추가하지 않았다.
loopback server는 명시된 자산/vendor의 허용 파일만 읽으며 외부 URI GLB는 거부한다.
Windows 경로의 UNC/drive/ADS 또는 상대 경로 이탈은 resolve 이전에 거부한다.
이 경계는 실제 네트워크 경로를 접근하지 않는 합성 검사에서 위험 입력의
resolve/is_file 미호출과 정상 중첩 파일 접근을 확인한다.
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

## 이전 실행 기록

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

후속 검토에서320px의 한 글자 줄바꿈을 수정하고, timeline의 고정 시점으로 표준/
경량 pose를 비교하도록 했다. 새 runner는 동물별 WebM을 분리하고 녹화가 없는
별도 context에서 성능 표본을 수집한다. 위 v003의 과거 녹화 포함 수치를 새 방식의
측정으로 바꾸지 않는다. 임시 fixture CI도 동물별 녹화·timeline을 검사한다.

v006의 첫 녹화 검증은14개 full-loop 후25% pose PNG가 만들어졌지만 녹화 context
종료 구간에서240초 전체 상한에 도달했다. 기존 출력과 WebM을 보존하며 전체
통과로 집계하지 않는다. 인코더가 원인이라고 확정하지 않았다. 후속 runner는
실제 viewport1366×768을 유지하면서 WebM을960×540으로 기록하고, GLB 해제 후
page/context 종료를 각각15초로 제한한다. clip별 진행 기록도 즉시 보존한다.
이 수정 후2초짜리 실제 녹화 종료 probe는 통과했다. 이어진 긴 녹화 실행은
14clip 검사를 완료한102.8초 이후 recorded page.close의15초 제한에 걸려117.8초에
실패했다. 생성 WebM은102.44초·960×540·25fps이며, 별도 단일 스레드 FFmpeg
전체 decode는 exit0, 고정 규칙의 검은 구간0,9개 실제 시점 PNG를 확인했다.
PNG9개의 로딩/표준/경량/동작 표시는 실제 로컬 viewer 내용이었다. 이는 모든
프레임의 관절 품질 검토가 아니며 이 실행을 전체 통과로 바꾸지 않는다. 이 단계에서는
기능 검증과 영상 검사를 분리했다. software 경로의 긴 녹화 종료 한계는 보존한다.
v006 이후 공통 skin weight의 형태 수정이 필요하므로 이전 자산의 재생/영상 검사를
새 제작 버전의 품질 통과로 이전하지 않는다.

같은 PC에 이미 설치된 full Chromium의2초 probe에서 `--browser-channel chromium`
경로는 Intel Iris Xe / Direct3D11 renderer를 보고했고 녹화 종료까지6.96초에
완료했다. 기존 shell/SwiftShader와 다른 실행 환경이다. 이후 실제 새 자산 검증은
이 경로에서 측정하며2초 probe만으로 FPS 향상이나 전체 검증 완료를 주장하지 않는다.

이후 곰 v007과 토끼 v002는 viewer `ffcbf7eaa15a7b7a5920feee37f410d95cd687d6`에서
각각7clip ×2variant,1366/390/320, 키보드·10회 자원 교체·실패 대체와 녹화를 포함한
전체16개 검사를 exit0으로 통과했다. 두 동물의28개 clip-variant loop가 실제 완료됐다.
두 WebM은 각각60.56초/60.36초이며 별도 전체 decode exit0, 고정 black-frame 규칙의
검출 구간0이었다. 영상9개 시점씩과 모든 clip의 표준/경량1초 pose를 열람했다.
토끼 move/special의1·2·3초 자세18개도1366/390/320에서 확인했고 귀·발의 화면 잘림은
관찰되지 않았다. 실제 연속 재생 검사와 샘플 이미지 시각 검토를 구분하며 모든 프레임의
관통·발 접지/미끄러짐을 검증했다고 주장하지 않는다. 제작 QA의 다른 각도·변형 검사는
G4 기록과 결합하고 사람의 최종 디자인 검토는 대기로 유지한다.

| 새 후보 표준형 | viewport | RAF 표본 / 구간 | frame P50 / P95 | 평균 간격의 역수 FPS |
| --- | --- | --- | --- | --- |
| 곰 v007 | 1366×768 | 194 /3.2338초 | 16.7 /16.9ms | 59.99 |
| 곰 v007 | 390×844 | 195 /3.2503초 | 16.7 /16.83ms | 59.99 |
| 곰 v007 | 320×844 | 196 /3.2669초 | 16.7 /16.8ms | 60.00 |
| 토끼 v002 | 1366×768 | 194 /3.2338초 | 16.7 /16.8ms | 59.99 |
| 토끼 v002 | 390×844 | 195 /3.2503초 | 16.7 /16.8ms | 59.99 |
| 토끼 v002 | 320×844 | 195 /3.2503초 | 16.7 /16.9ms | 59.99 |

이 표는 full Chromium151/Iris Xe D3D11, DPR1/AA off에서 녹화를 끝낸 별도 context의
짧은 표본이다. 물리적 모바일·운영·목표 FPS 통과나 모든 환경의 성능을 보장하지 않는다.
곰/토끼 generator commit은 각 asset-manifest의 `98752a3996cf1844783a9d250bd88761b2be1e70`이다.
catalog의 `source_commit` c46c772…는 저장소 기준이며 generator나 viewer 실행 SHA가 아니다.
실행 후 UI를 `카탈로그 기준 커밋`으로 정정하고 토끼의 추가 자세/화면에서 실제 표기를
확인했다. 이 표기 정정은 별도 커밋이며 앞선 JSON·영상·캡처·실행 SHA를 바꾸지 않았다.

Windows/Linux CI는 임시 fixture만 실행한다. 실제 자산은 Git·CI runner에 자동
업로드하지 않는다. 공개 가능한 CI의 코드 경계 검사와 외부 로컬 자산 검증을
구분하며, 제작 품질 통과 동물/clip 수는 G4의 검사 결과에서만 집계한다.

바닥이 없던 위 결과의 접지 검토 한계를 보완하기 위해 고정 바닥/격자 토글과
기본 자세 기준 정면/옆면 시점을 추가했다. 표준형 기본 자세의 정확한 world vertex 최저 Y를
한 번 계산해 두 변형에 공통 고정하고 애니메이션 중 높이를 따라가지 않는다. renderer 없는
Three parser/정확한 Box3 사전 대조에서 표준/경량 extrema 차이를 확인하여 실제 접지
재생을 보기 전에 이 기준을 정했다. 경량형 자체 최저 Y도 별도로 기록한다. 합성 경로는 quarter/mid/
three-quarter에서도 기준 불변, 토글/재로드/정적 표시 자원 해제와 화면 변화를 검사한다.
이 변경은 기존 곰/토끼 검증 파일을 수정하지 않는다. 실제 제작물의 추가 바닥 검토는
별도 출력에서 수행했다. `a707a9e186cf5999a7c73499227408a25c898da4`에서 곰 v007·토끼 v002·
강아지 v001의 move/special/celebrate를 양쪽 변형과 정면/옆면에서 한 loop씩 기록하고,
각각36개 고정 자세 PNG를 남겼다. 총36개 view-variant loop와108개 자세가 통과했으며
두 변형의 공통 표준형 바닥 기준은 변하지 않았다. 강아지의 첫 전체 경로도14개 clip-variant
loop 및 기존16개와 새 바닥/경량형 우선 진입2개를 합친18개 검사 exit0이다.
강아지 전체와 바닥3개 WebM은60.32/60.32/65.96/65.28초, 각각 전체 decode exit0·검은
구간0이며 실제9개 시점씩을 별도로 열람했다. 바닥 영상 마지막 viewport 전환의 회색
여백은 고정 녹화 크기와 실제 화면 크기의 차이이며 검은 프레임으로 숨기지 않는다.

선별 이미지에서 심한 평면 침범·관절 분리·귀/발 잘림이나 명백한 발 끌림은 관찰되지
않았다. 이동/축하와 토끼 전용 동작의 떠오르는 구간은 선언된 in-place hop으로 구분한다.
renderer 없는 Three CPU의0/1/2/3/4초 표본에서 전체 geometry 최저점과 고정 바닥 차이는
move 최대 약0.084–0.086, celebrate0.16, 토끼 special0.17 **상대 GLB 단위**였다.
이 값은 물리 mm·개별 발 식별·품질 임계값이 아니다. 토끼의 최소차 약−1.21e−8과
표준/경량 extrema 차이도 원값으로 남겼다. 샘플과 실제 loop 기록을 전 프레임의 충돌/
접지·미끄러짐 보증으로 표현하지 않는다.

같은 GLB SHA의 기존 binary audit와 fresh-import 보고를 대조하고 선별 정적·실제
브라우저·바닥 샘플 층을 결합해 세 후보의 **선언한 로컬 기술 QA 범위**를 통과로
기록했다. 곰/토끼 제작 commit은98752a3…, 강아지는146b45a…이며 최종 GLB·generator
script·참조 보고의 SHA를 로컬 reviewer sidecar에서 연결한다. 곰/강아지 경량형의
`winding_opposes_vertex_normals=1` 진단은 기존 binary verifier의 pass와 별도로 보존했고,
확인한 이미지에서는 대응되는 명백한 뒤집힘을 관찰하지 못했다. 나머지9종이나 사람의
최종 art/출시 승인을 뜻하지 않는다. 이 실행 코드의 Windows/Linux 합성과 일반6개 CI도
통과했다. 큰 자산과198개 추가 결과 파일은 외부 로컬 manifest에 보존한다.

고양이 v002는 `bedaa179be9977842e1232d926346c4a0ec6ba80`에서 첫 전체18개 검사와
14개 clip-variant loop를 exit0으로 통과했다. 같은 코드의 추가 고정 바닥 검사는
12개 정면/옆면 view-variant loop와36개 자세를 기록했다. 두 무음 WebM60.44/63.84초는
전체 decode exit0·검은 구간0이며 실제9개 시점씩을 열람했다. 모든 clip의 표준/경량
동일1초 pose, 바닥36개 pose contact, move 옆면25/50/75%, stretch 정면 중간 자세,
1366/390 및320 바닥 화면, 제작 back/hero를 직접 확인했다. 확인한 표본에서 명백한
관절 분리·바닥 침범·발 끌림이나 귀/발 잘림은 관찰하지 못했다. 경량형 winding 진단1은
보존하며 전체 프레임의 충돌/물리 접촉 검사로 표현하지 않는다. 원본 full JSON의
`sourceCommit`은 catalog 기준 c46…이고 실제 viewer 실행 SHA는 위 코드 및 ground
report/새 reviewer sidecar에서 구분한다. 고양이 generator는 `c7c41323318f0af4159be29d04bdc3c0c3837e53`,
standard/light GLB는 각각1,043,208/528,348bytes,32,656/14,272삼각형이다. 기존 binary/
fresh-import 참조와 이 층을 결합해 해당 실행 당시4종·28고유clip을 기록했다. 이후 추가
후보는 상단 현재 상태와 별도 실행 근거로 구분한다. 이전3종의 결과는 수정하지 않았다.

편집 원본 검사는 별도의 읽기 전용 외부 script로 수행했다. 곰 v007·토끼 v002·강아지 v001·
고양이 v002의 `rigged.blend`와 `source.blend`를 각각 새로운 Blender4.5.13 세션에서 열어
8개 exit0을 확인했다. 전자는 animate 이전 checkpoint이므로 실제20bone/mesh/live skin을,
후자는 그 구조와 정확한7개 action·실존 channelbag/fcurve/keyframe을 검사했다. 모든 정점의
유효 bone 가중치, authored1..97 frame 범위와 변하는 채널을 확인했으며 원본/manifest/generator
전후 SHA는 유지됐다. 원본 save/delete/render/export는 수행하지 않았다. 외부 wrapper/inspector
SHA와 검토 맥락 bedaa179, 각 generator SHA는 새 원본 완료 manifest에서 별도로 연결한다.
이는 `.blend`가 실제로 열리고 편집 구조가 남았다는 검사이며 모든 자세의 시각 승인이나
완전한 장기 편집 호환성 보증은 아니다.

## 새 세 후보 실행 기록과 한계

레서판다 v003·수달 v003·카피바라 v002의 generator는
`6a617adff19252d6883db869c89c2fdfdd8d30c1`이다. 기존 카탈로그를 수정하지 않고
새 검토용 카탈로그에 이 세 후보만 활성화해 GLB/hero 9개를 동일 바이트로 복사했다.
viewer `2033c366e742645cb31f642b7b4a8a44fc7e1257`의 깨끗한 체크아웃에서
Blender·브라우저·영상 decode를 순차 실행했다. 이 실행 SHA를 후속 문서 커밋으로
바꾸지 않는다. full JSON의 `sourceCommit`은 카탈로그 기준 c46…이며 실제
viewer·generator와 다른 참조임을 새 sidecar에 명시했다.

각 후보는 전체18개 기능 검사, 7clip ×2variant의14개 실제 loop, 고정 표준형 바닥의
정면/옆면12개 view-variant loop와36개 자세를 통과했다. 1366/390/320 화면, 키보드,
자원 해제/10회 교체, 실패·reduced-motion·no-WebGL/context loss 대체를 포함한다.
원본6개는 새 Blender4.5.13 세션에서 각각 exit0으로 열렸다. `rigged`는 animate 이전
20bone/mesh/live skin, `source`는 정확한7action/keyframe을 검사했다. 생성 코드,
manifest, 원본/복사 GLB·hero, 실행 카탈로그와 viewer SHA는 전후 그대로였다.

| 새 후보 | 표준/경량 삼각형 | 전체/바닥 무음 영상 길이 |
| --- | --- | --- |
| 레서판다 v003 | 36,280 /17,126 | 60.08 /63.88초 |
| 수달 v003 | 33,250 /14,764 | 61.60 /62.56초 |
| 카피바라 v002 | 32,636 /14,272 | 61.12 /63.04초 |

6개 영상은 전체 decode exit0·고정 black-frame 검출0이며 실제9개 시점씩을 열람했다.
추가 근접6loop와 레서판다 측면2loop도 새 출력에서 진행했고, 34.84초/11.96초의
두 영상 decode와 각9개 추출 시점을 확인했다. 총8개 영상이다. 기본 화면 전체,
표준/경량1초 pose, 바닥108개 pose contact와 추가 근접 화면을 직접 확인했다.
시작의 로딩/hero 표시, 확대 화면의 의도된 전체 실루엣 잘림, 마지막 바닥 영상의
viewport 변경에 따른 회색 여백은 실제 기록대로 보존한다.

레서판다의 고개/몸통 내밀기와 꼬리 연결부, 수달의 모은 손 방향 변화 및 볼 부착,
카피바라의 작은 귀·주둥이와 고개 상하 변화를 확인한 표본에서 큰 관절 분리나 명백한
바닥 침범·발 끌림은 관찰하지 못했다. 수달 손 비비기는 .45/.50/.55, 카피바라 고개는
.25/.75 시점을 추가로 확인했다. 이동과 축하의 공중 구간은 선언된 in-place hop이며,
손 사이의 정확한 표면 접촉이나 걸음의 물리적 접지를 인증하지 않는다.

레서판다 꼬리의 `winding_opposes_vertex_normals` 진단은 표준2/경량1개 면에 남는다.
두 재질을 함께 정확한 position으로 weld한 검사에서는 닫힌 단일 표면과 일관된 edge
방향을 확인했지만 작은 국소 접힘/자기 교차까지 배제하지 않았다. 실제 캡처 카메라를
사용한 해당 면의 기하학적 투영 크기 최대값은 후면 사선에서 폭 약0.236px·높이0.033px,
추가 측면에서0.167px·0.094px였다. 최초 확대 후면은 하부 실루엣을 잘라 별도 덜 확대한
측면으로 꼬리 기저 전체를 확보했다. viewer의 pan은 비활성화되어 있으며 시도한 drag가
camera target을 바꿨다고 기록하지 않는다. 작은 면 자체를 이미지에서 분해해 관찰하거나
raster occlusion을 검사한 것은 아니다. 닫힌 topology·subpixel 크기를 무해성의 증명으로
삼거나 기존 진단을0으로 고치지 않는다.

새 세 후보의 성능 표본은 full Chromium151/Iris Xe D3D11, DPR1/AA off의 **녹화 없는**
표준형 context에서 화면별 약3.2초 활성 RAF였다. 평균 간격의 역수는 약60FPS였으나
실제 모바일 기기·운영·목표 FPS나 모든 GPU에서의 성능 승인을 뜻하지 않는다.

아래는 저장소 파일이 아닌 **외부 로컬 QA 루트에 대한 상대 위치**다. 큰 파일은
Git에 복제하지 않으며 실제 파일 검토 시 해당 참조와 SHA를 대조한다.

| 로컬 근거 | 위치와 적용 범위 |
| --- | --- |
| 새3종 완료 목록 | `g5-new-trio-technical-completion-001.json`, SHA-256 `0f8bed7516506b9d2c351a85aa7d59085c734183078b31563b38f61096621c7d` |
| 개별 검토 | `g5-technical-review-red_panda-v003-001.json`, `g5-technical-review-otter-v003-001.json`, `g5-technical-review-capybara-v002-001.json`; 원본·실행·열람 이미지와 한계 연결 |
| 실제 실행 | `g5-trio-qa-001/completion.json`;15단계 exit0, 후보별 원본/기능/바닥/영상 세부 출력 참조 |
| 꼬리 후속 진단 | `g5-red-panda-v003-tail-topology-001.json`, `g5-red-panda-tail-projected-pixels-001.json`, `g5-red-panda-tail-side-projected-pixels-001.json`; 품질 자동 승인이 아님 |
| 7종 보관 목록 | `run-20260906-0319/selected-inventory-seven-001.json`;7폴더/49고유clip, 품질 추론 없음 |
| 새3종 영상 사본 | `run-20260906-0319/g5-new-trio-motion-copies-001.json`;6개 WebM의 source/destination SHA 동일, 재인코딩 없음 |

검토 후 원본 카탈로그는 별도 선택 단계에서7종으로 갱신했다. 과거 검증에 사용한 별도
카탈로그와 JSON은 그대로 보존한다. 영상 사본은 각 후보 폴더의 `motion-preview.webm`/
`ground-preview.webm`이며 같은 디스크 사본이지 독립 백업은 아니다.

## 재개와 보존

후속 문서 head28cd175의 Windows software CI는 `recorded page close exceeded 15000ms`로
실패했다. Linux와 일반 검사는 통과했지만 이 실패를 재시도로 지우지 않는다. 소프트웨어
경로의 장기 녹화 종료 한계를 다시 확인한 것이며 인코더 원인으로 확정하지 않았다.
CI는14개 전체 기능 loop와 나머지 검사를 녹화 없이 유지하고, 모든 기능 context를 닫은 뒤
별도의 합성 한 clip 전체 loop 녹화/종료를 검사하도록 분리했다. 단기 smoke와 전체 녹화의
보고 scope도 구분한다. 당시 실제4종의 full Chromium/Iris Xe 전체 녹화 결과를 재실행하거나
수정하지 않으며, CI smoke 통과가 장기 software 녹화 한계 해결을 뜻하지 않는다.

새 catalog/GLB가 준비되면 해당 입력을 고정하고 새 외부 결과 경로에 verifier를
실행한다. `--record`는 실제 브라우저를 WebM으로 녹화하며 성능 결과에 녹화 부하를
표시한다. 기존 결과 경로를 재사용하면 중단한다. 기본20분 또는 `--timeout-ms`의
상한에 도달하면 브라우저/서버를 닫고 실패 기록을 남긴다.
browser cleanup에는 추가 최대10초를 허용하며 Node도 실패로 종료한다.
큰 자산/캡처/녹화는
로컬 manifest로 추적하고 승인되지 않은 외부 upload를 하지 않는다. 같은 디스크
보존은 독립 backup이 아니다. 관련 소스 변경은 main에 병합되었고 1회차는 계속
진행 중이다. 병합은 사람 디자인 승인이나 운영 적용이 아니다.
