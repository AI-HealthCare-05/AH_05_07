# SK7 1회차 제출 검토본

Issue #225. 제작 기준은 PR #226 병합
`d3d1a1a2903c558778eef7be0f249057e40ee769`이다. **제출 검토본 준비이며 1회차는 진행 중**이다.
발주사 수용·입력 의미·adapter·모델 선택·출시·전체 종료 승인이 아니다.

## 파일과 보관

사용자에게 전달하는 외부 로컬 폴더에는 다음을 둔다. 실제 로컬 절대 경로는
이 채팅에서 전달하고 저장소에 개인별 경로를 박아 넣지 않는다.

| 파일 | 내용 / 검토 범위 |
| --- | --- |
| `sk7-mvp1-review.pptx` | 편집 가능한 7장, 본문·표 native object, 상세 근거/실행 SHA는 발표자 노트 |
| `sk7-mvp1-review.pdf` | 같은 PPTX를 PowerPoint로 내보낸 7페이지 |
| `sk7-mvp1-review.mp4` | 4분 21.28초, 1366×1000, 25fps H.264/yuv420p, **무음 자막 영상** |
| `sk7-mvp1-sources.md` | PDF에서도 찾을 수 있는 슬라이드별 근거·발표자 노트 |
| `references/` | 실제/목표 SVG 2종, 정상/빈/오류/준비 중 데스크톱 합성 캡처 4장, 이 문서 |
| `sources/` | 이번 제작·녹화·렌더·재생·패키지 검사 소스 5개 |
| `manifest.json`, `validation.json` | 파일명·형식·크기·SHA-256·제작 기준 및 검사 범위 |

제출 바이너리의 자동 Git/LFS/외부 게시 정책은 없다. 기존 asset 검토 경계와
사용자 지시에 따라 PPTX/PDF/MP4는 외부 로컬에 보존하고, Git에는 소스·문서와
[경로 없는 manifest](evidence/mvp1-submission-manifest.json)만 둔다. 원자료/모델 파일을
복사하지 않는다. 외부 업로드는 수행하지 않았다. 필요하면 이 폴더의 PPTX/PDF/MP4,
출처·도면·캡처·manifest를 사용자가 지정한 제출 저장소에 올리고 공유 권한을 확인한다.
기존 Canva/R2 주소를 이번 제출 파일의 업로드 대상으로 추정하지 않는다.

## 제작과 검증

- 기존 7장 원고를 자연스러운 한국어로 편집했다. 모델 지표는 승인된
  `model-uncertainty.json`의 점추정·차이 구간을 소수 넷째 자리로 표시하고 원래
  comparison 점추정과 대조했다. 원본 evidence/CONFIG는 변경하지 않았다.
- Artifact Tool의 PPTX 구조·기하·글꼴·재import 검사를 통과했다. PowerPoint COM으로
  read-only 개방·PNG/PDF export·본문 경계를 검사했다. PowerPoint 편집 UI를 사람이
  조작한 사용성 검증이나 다른 Office 버전 호환성 보장은 아니다.
- 7장 PowerPoint 렌더와 대응 PDF의 Poppler 렌더를 확인했다. 첫 슬라이드2의 지나치게
  긴 모바일 캡처와 어색한 줄바꿈을 데스크톱 캡처·짧은 문장으로 수정했다. 최종본은
  잘림/겹침/눈에 보이는 글꼴 대체가 없었다. PDF font resource는 Malgun Gothic이며
  상세 원본 SVG/캡처는 발표 이미지보다 크게 별도 열어 볼 수 있다.
- 브라우저 녹화는 원래 로컬 harness를 iframe에 열고 실제 버튼을 클릭한다.
  wrapper는 합성/로컬 표시와 자막만 추가한다. 현재→이전→현재, 마스킹된 상세,
  빈 상태, 503 오류→실제 재시도→200 빈 응답, 준비 중을 확인했다. 녹화용 mock은
  브라우저 내부 GET/OPTIONS만 허용하며 모든 외부 요청과 쓰기를 거부한다.
- 재시도는 모의 응답을 실패에서 빈 성공으로 바꾼 뒤 실제 버튼으로 실행했다.
  모의 API 표시를 유지했다. 실제 저장·모델 예측 성공을 만들지 않았다.
- 원본 WebM을 H.264 MP4로 변환했다. 앞의 초기 로딩 2초만 제외했으며 나머지
  녹화 순서·조작·결과를 유지한다. 시간을 늘리는 정지 이미지 편집은 하지 않았다.
  전체 디코드/blackdetect(0.1초 이상, 픽셀 임계0.1)와 Edge 정상 속도 끝까지 재생,
  장면 표본 확인으로 길이·오류·자막·전환·개인정보 부재를 검사했다.
- 자동 검사만으로 모든 프레임의 의미/개인정보를 증명하지 않는다. 허용된 fixture와
  차단된 네트워크/쓰기, 직접 확인한 장면을 함께 근거로 삼는다. 사용자 최종 검토는 대기다.

제작 중 실패는 산출물 검증 환경의 설정 문제였다: native table 검사 대상 목록,
runtime module 경로, finalizer output/receipt 디렉터리를 바로잡았다. 녹화 예행의
빈 상태는 제품의 자동 empty 대상인 S02로 고쳤다(S08은 명시적 기록 탐색 화면).
재생 verifier의 기본30초 timeout은 전체 재생용330초로 명시했다. 제품 코드는
변경하지 않았다. 의존성 버전·평가 허용오차를 바꾸어 모델 검사를 통과시킨 것이 아니다.

## 재생성

기존 원자료·split·운영 계정 없이 실행한다. `<repo>`, `<build>`, `<package>`는 실제
절대 경로로 바꾸며, build/package는 저장소 밖의 새 디렉터리를 사용한다. 기존 결과를
삭제하거나 덮어쓰지 않는다. PowerShell 실행 정책·전역 Git 설정은 바꾸지 않는다.

필요한 기존 도구: Node와 web lock의 Playwright, Windows PowerPoint, 맑은 고딕,
Codex bundled `@oai/artifact-tool`/Python(pypdf)/Poppler. 런타임 위치는 Codex의
`load_workspace_dependencies`로 확인한다. renderer는 설치된 PowerPoint COM을 사용한다.
bundled LibreOffice는 확인되지 않아 사용하지 않았다.

추가 제작 전용 의존성은 **imageio-ffmpeg==0.6.0** 하나다. 기존 Playwright FFmpeg는
VP8/WebM만 지원해 MP4 인코딩/blackdetect를 제공하지 않았다. 저장소 밖의 별도 uv
venv에 설치한 패키지가 제공하는 FFmpeg7.1을 사용한다. app/AI/web lock 변경은 없다.

```powershell
# 외부 환경: app/AI 가상환경에 설치하지 않는다.
uv venv <build>/.venv
uv pip install --python <build>/.venv/Scripts/python.exe imageio-ffmpeg==0.6.0

# 녹화 서버 전용 터미널: 운영 빌드에 플래그를 넣지 않는다.
npm --prefix <repo>/web ci
$env:VITE_SK7_E2E_MODE='1'
$env:VITE_API_BASE_URL='http://e2e.invalid'
npm --prefix <repo>/web run dev -- --host 127.0.0.1 --port 4185 --strictPort

# 별도 터미널, 예행과 실제 녹화 출력은 분리한다.
node <repo>/tools/submission-record.cjs <build>/dry --dry-run
node <repo>/tools/submission-record.cjs <build>/recording
```

PPTX: `submission-slides.mjs`를 외부 build에 복사하고 해당 build의 `node_modules`를
bundled node modules에 junction으로 연결한다. `RUNTIME_NODE_MODULES`도 같은 경로로
설정한다. bundled Node로 다음 인자를 전달한다. `presentation-skill`은 설치된
Presentations skill 절대 경로다. 새 `<build>/output`에 출력하고 finalizer 기록은
별도 `.codex-finalizer`에 남긴다.

```text
node <build>/submission-slides.mjs <repo> <build> <presentation-skill> <bundled-python>
powershell: & <repo>/tools/submission-render.ps1 -Pptx <build>/output/sk7-mvp1-review-v2.pptx -Output <build>/render
pdftoppm -scale-to 1600 -png <build>/render/sk7-mvp1-review.pdf <build>/render/pdf
```

이후 전 슬라이드·PDF 렌더와 font resource를 검사한다. PowerPoint는 read-only로
새 deck을 열고 export하며 기존 사용자 발표를 편집하지 않는다.

```text
python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"
<ffmpeg> -hide_banner -nostdin -n -ss 2 -i <recording.webm> -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -an -movflags +faststart <package>/sk7-mvp1-review.mp4
<ffmpeg> -hide_banner -nostdin -i <package>/sk7-mvp1-review.mp4 -vf blackdetect=d=0.1:pix_th=0.1 -an -f null NUL
node <repo>/tools/submission-video-check.cjs <package>/sk7-mvp1-review.mp4 <build>/playback
```

MP4는 Edge에서 실제1배속으로 끝까지 재생한다(약4분30초 소요). 직접 표본을 확인한
뒤 패키지를 작성한다. pypdf가 있는 bundled Python으로 실행하며 manifest 자체는
자기참조 해시를 갖지 않는다. 파일 목록에 없는 추가 파일도 verifier가 거부한다.

```text
python <repo>/tools/submission-package.py <package> --repo <repo> --pptx <build>/output/sk7-mvp1-review-v2.pptx --pdf <build>/render/sk7-mvp1-review.pdf --playback <build>/playback/playback-check.json --recording <build>/recording/recording-checks.json
python <repo>/tools/submission-package.py <package> --verify
```

촬영/재생 서버와 context는 종료한다. 출력·QA 원본은 로컬 보존, 원시 로그는 제출/Git에
넣지 않는다. 영상 길이와 metadata는 재생성 시간에 따라 달라지므로 기존 hash와
동일하다고 가정하지 말고 새 manifest와 검토 기록을 생성한다.

## 남은 마감 조건

[O1/O2/O3](mvp1-operations-review.md) 운영 검증, 제출 시트의 실제 내용·권한 대조,
입력·모델 승인, 발주 범위 수용, 사용자 최종 검토는 미완료다. 발주사 질의는 **미발송**이다.
O2는 아직 승인/행 생성/대기를 시작하지 않았다. 새 행 생성 후30일이므로 2026-09-06에
시작하더라도 가장 빨라야10월6일이다. 기존9월21일 제출 일정과 충돌하므로 미완료
공개 및 일정/별도 환경 근거 수용 판단이 필요하다. 로컬 pgTAP나 짧은TTL 별도 환경을
운영 자연 만료 검증 완료로 바꾸지 않는다. 기존 evidence·CONFIG·lock·model_not_ready와
모델 연구 상태는 그대로다.
