# 로컬 캐릭터 검토실

Issue #232, [ADR-0006](../../docs/adr/0006-local-character-preview.md).
운영 제품과 분리된 개발용 화면이다. 기존 web 의존성/lock을 바꾸지 않으며
건강정보·모델 inference·API·업로드·저장·분석 추적을 연결하지 않는다.
큰 GLB/원본/렌더는 Git에 넣지 않고 사용자가 지정한 외부 자산 폴더에 보존한다.

## 실행

저장소 root에서 기존 Python과 Node를 사용한다. 첫 명령은 공식 npm에서 고정된
Three.js 0.185.1을 다운로드해 SHA-512 검증 후 **새 외부 경로**에 보존한다.
설치 script/관리자 권한이 필요하지 않다. 기존 cache는 덮어쓰지 않는다.

```powershell
python tools/character-preview/prepare_vendor.py --output "<새 외부 vendor 경로>"
python tools/character-preview/serve.py --assets "<catalog.json이 있는 외부 자산 경로>" --vendor "<검증한 vendor 경로>" --port 8767
```

브라우저에서 `http://127.0.0.1:8767`을 연다. 서버는 127.0.0.1에만 bind하며
외부 asset/vendor root의 허용 파일만 GET/HEAD로 읽는다. 중지는 해당 터미널에서
Ctrl+C. 자산은 삭제하지 않는다. 서버 실행 후 네트워크 의존은 loopback뿐이다.
브라우저 개발 서버와 운영 app은 따로 실행하며 서버를 외부 주소에 노출하지 않는다.

## Catalog 계약

`schema_version: 1`, 제작 코드의 `source_commit`, `animals` 12개를 둔다.
animal은 `id`, `name`, `status`, `motion`, `hero`, `standard`, `light`, `note`를 가진다.
파일 경로는 자산 root 상대 경로이며 준비되지 않았으면 null이다. `pending`은
미완료, `review_candidate`는 후보, `passed`는 제작 검사 통과이며 사람 최종
검토와 별개다. `temporary_fixture`는 최종 동물이나 품질 통과 수량이 아니다.
예: standard `bear-v002/standard.glb`, hero `bear-v002/hero.png`.

GLB는 버전2의 embedded buffer/image만 지원한다. 외부 resource URI를 거부하며
압축 decoder나 CDN을 자동 설치하지 않는다. 이번 자산은 재질 색상의 PBR 경로다.
표준형/경량형은 한 번에 하나만 로드하고 같은 시점에서 토글해 비교한다.
대기·인사·이동·관심·축하·휴식·전용 동작의 clip 이름/길이는 GLB에서 읽는다.
이동의 in_place/root-motion 설명은 제작 catalog와 일치시켜야 한다.

## 상태와 자원

- 로딩·파일 없음·불러오기 실패는 각각 표시하고 정적 hero/일반 대체 그림을 유지한다.
- 움직임 최소화 시 GLB를 읽지 않거나 이미 읽은 자산을 해제하고 정적으로 전환한다.
- 교체/페이지 종료 시 mixer·geometry·material·texture·skeleton을 해제한다. 늦게 끝난
  이전 요청도 표시하지 않고 해제한다. context loss는 자동 재시도하지 않고 대체 표시한다.
- 조작은 HTML select/button/checkbox이며 키보드와 시점 버튼을 제공한다.
  이 화면의 캐릭터가 없어도 운영 기록·조회 기능은 의미 있는 HTML로 독립적이다.
- bytes는 읽은 GLB 크기, 삼각형/재질/텍스처/뼈대/clip은 실제 로드한 scene에서 계산한다.
  texture 해상도와 viewport/DPR·renderer 환경도 기록한다. 타깃 FPS 통과를 자동 판정하지 않는다.

## 검증

기존 locked Playwright를 사용한다. 준비·build는 로컬 검증이며 배포가 아니다.
출력은 **존재하지 않는 새 경로**를 지정한다. 실패 출력도 보존하며 같은 경로로 재실행하지 않는다.

```powershell
npm --prefix web ci
npm --prefix web run build
# 빠른 CI/기능 검증: 실제 동물이 아닌 명시적 두-bone fixture
node tools/character-preview/verify.cjs --synthetic --vendor "<검증한 vendor 경로>" --output "<새 합성 검사 경로>"
# 제작 GLB 검사: 준비된 모든 animal × standard/light × 7clip
node tools/character-preview/verify.cjs --assets "<외부 자산 경로>" --vendor "<검증한 vendor 경로>" --output "<새 실제 자산 검사 경로>"
# 선택 사항: 같은 실제 브라우저 검증을 로컬 WebM으로도 기록
# 위 실제 자산 명령에 --record 추가; 녹화 부하가 있는 측정임을 별도 기록
```

검사는 운영 bundle 분리, loopback/경로/읽기 전용, clip 시간과 bone pose 변화 및 실제 loop 완료,
pause/stop/play, 1366/390/320 viewport, 키보드 초점/회전, 10회 교체 자원 수,
실패/reduced-motion/context loss/no-WebGL과 외부 요청·page error 부재를 확인한다.
실제 자산 검사에는 clip별 pose PNG도 남긴다. 선택적 WebM은 브라우저에서 일어난
조작/결과만 녹화하며 사용자 최종 품질 승인을 대신하지 않는다.
검사 중인 asset root와 catalog는 수정하지 않는다. 새 자산을 검증할 때 새 결과 경로를 사용한다.

로드/viewport 변경마다 표본을 비우고1초 초기 구간 뒤 활성 animation의 RAF 간격
최대600개를 저장한다. linear 분위수로 frame time P50/P95와 평균 간격의 역수 FPS를
계산한다. 임시 fixture CI는 강제 software WebGL, 실제 자산은 브라우저 기본 ANGLE
경로이며 보고에 실제 renderer 문자열과 software 여부를 남긴다. render DPR1·AA off로
자원 사용을 제한한다. 실제 모바일 기기/운영 성능으로 확대 해석하지 않는다.
machine의 동시 부하·녹화 여부도 별도 기록한다.
CI는 합성 fixture만 검사하고 실제 Blender 제작물이나 사용자 폴더를 읽지 않는다.

`verification.json`과 합성/캐릭터 화면 캡처는 로컬 집계 검토 후보다. bone 변화
검사는 발 미끄러짐·관통·루프 연결·실루엣 품질의 사람/제작자 시각 검사를 대신하지
않는다. 제작 품질 통과 수량은 G4 manifest를 확인하며 이 도구는 그 수량을 만들지 않는다.
