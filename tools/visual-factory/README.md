# SK7 Visual Factory v0.3 — 비공개 후보 보관함

**생성 → 보관 → 운영 승인은 서로 다른 단계입니다.** 이 도구는 이미지 파일을
검사하고 비공개 후보 보관함에 백업합니다. `visual/v1`, `visual/v2`,
`companion/v1`, Asset Gateway, 앱 코드, DNS/CORS, 계정 권한을 변경하지 않습니다.
기존 v0.1/v0.2의 `visual:publish --approved`는 사용하지 마세요. 해당 파일을
자동 삭제하거나 기존 `web/package.json`을 덮어쓰지도 않습니다.

## 준비

Python 3.10 이상과, 실제 백업 시 기존에 로그인한 **로컬 Wrangler**가 필요합니다.
Python 외부 패키지, 이미지 생성 API, 추가 유료 구독은 이 도구의 전제조건이 아닙니다.
이 버전 자체의 테스트 환경은 동봉된 AUDIT.md를 보세요.

작업 디렉터리에 상관없이 스크립트의 실제 경로로 실행합니다.

```bash
python3 -B tools/visual-factory/visual_factory.py init
python3 -B tools/visual-factory/visual_factory.py check
```

기본 보관함은 `~/SK7-Visual-Factory`입니다. Git 저장소 내부는 보관함으로
지정할 수 없습니다. 기존 v0.2 worktree나 npm 스크립트는 건드리지 않습니다.

```text
~/SK7-Visual-Factory/
  config.json          # 로컬 비밀값 없음; target 확인 여부만 저장
  inbox/               # 이 폴더에 의도적으로 저장한 PNG/WebP만 수집
  originals/           # 원본 SHA-256 이름; 원본 메타데이터도 보존
  derivatives/         # 별도 PNG 정리본; 원본을 덮어쓰지 않음
  records/             # needs-review / runtimeApproved=false
  index.json           # 로컬 후보 인덱스, 앱 운영 인덱스 아님
  gallery.html         # 네트워크 서버 없이 여는 로컬 갤러리
  pending/             # 실패/중단 후 재시도할 동일 배치
  receipts/            # R2 이미지·인덱스 readback 완료 기록
```

## 1. 클라우드 없이 검사·보관

ChatGPT에서 저장한 실제 파일을 `inbox/`에 넣습니다. 현재 대화에서 묶어 제공한
원본 ZIP도 이 폴더에 한 번에 넣을 수 있습니다. ChatGPT 화면에서 보인다는 것과
Mac의 로컬 파일이 존재한다는 것은 다릅니다. 이 도구는 브라우저를 스크래핑하거나
ChatGPT의 로그인 쿠키를 읽지 않습니다.

```bash
python3 -B tools/visual-factory/visual_factory.py scan
python3 -B tools/visual-factory/visual_factory.py ingest
open ~/SK7-Visual-Factory/gallery.html
```

`scan`은 읽기 전용입니다. `ingest`는 로컬 보관함만 씁니다. 이미지는 삭제하거나
이동하지 않습니다. 같은 내용이 다른 이름으로 들어와도 SHA-256으로 중복을
제외합니다. `.part` 등 미완료 파일, 심볼릭 링크, 확장자 위장, 크기 초과,
잘못된 PNG CRC/압축 스트림을 거부합니다. 한 파일이 잘못되어도 다른 정상
후보는 계속 처리합니다.

S12 등 사용 위치를 직접 지정할 때만 다음처럼 사용할 수 있습니다.

```bash
python3 -B tools/visual-factory/visual_factory.py ingest --scene S12
```

`plannedProductKey`는 기존 `visual/v2` 경로에 대한 **제안**일 뿐입니다. 이것을
지정해도 운영 업로드나 코드 활성화는 일어나지 않습니다. 무작위 파일 이름에서
제품 상태, 동물 종류, 의미를 추론하지 않습니다.

## 2. 실제 R2 백업을 켜기 전

지원하는 대상은 현재 저장소의 공개 Asset Gateway에서 제외된
`sk7-design-corpus-private` **하나뿐**입니다. 이것은 현재 계정 전체를 감사하여
공개 경로가 전혀 없다고 보증한 결과가 아닙니다. 대상 버킷에 원본을 보관할
권한이 있고, 다른 Worker/배포가 이를 공개하지 않음을 운영자가 확인해야 합니다.

`--confirm-private-target`는 다음 확인을 뜻합니다.

- 입력은 이 작업을 위해 의도적으로 저장한 아트워크이며 실제 개인정보·건강 기록이 아니다.
- 해당 비공개 버킷에 백업할 권한이 있다.
- 별도 Worker/게이트웨이/앱이 해당 버킷 또는 이 prefix를 공개하지 않는다.

CLI는 추가로 `r2.dev` 비활성 및 연결된 custom domain이 **0개**임을 실시간
조회합니다. 권한 오류나 예상하지 못한 CLI 문구는 통과로 간주하지 않고 중단합니다.
대상 버킷의 설정을 자동으로 켜거나 끄지 않습니다.

```bash
python3 -B tools/visual-factory/visual_factory.py configure-r2 --confirm-private-target
python3 -B tools/visual-factory/visual_factory.py sync --confirm-private-upload
```

여러 Cloudflare 계정이 있어 Wrangler가 계정을 고르지 못할 때만 configure-r2에
`--account-id 실제계정ID`를 추가합니다. 계정 ID는 토큰이 아닙니다. OAuth 토큰,
API 비밀키, 브라우저 쿠키를 채팅 또는 config.json에 붙이지 않습니다.

`doctor-r2`는 이미 구성한 대상으로 두 공개 설정을 다시 **읽기만** 합니다.

## 3. 한 번 켜 두는 유한 전경 세션

```bash
python3 -B tools/visual-factory/visual_factory.py watch --minutes 120
```

이 명령은 로컬 보관·인덱싱만 합니다. 실제 백업까지 자동화하는 명령은 다음입니다.

```bash
python3 -B tools/visual-factory/visual_factory.py watch --minutes 120 --upload --confirm-private-upload
```

터미널이 열린 동안만 작동하며 Ctrl+C로 중단합니다. 로그인 항목, launchd,
cron, 상주 데몬, Worker는 설치하지 않습니다. 1~480분만 허용하며, 시한이 되면
새 전송을 시작하지 않습니다. 이미 시작한 Wrangler PUT/GET은 각 120초의
타임아웃 내에서 끝나거나 실패할 수 있으므로 종료 시점에 소폭의 지연은 가능합니다.
한 배치는 최대 12개 원본입니다. 새로운 파일/미완료 백업이 없으면 R2 요청을
반복하지 않습니다. 잘못된 파일은 원본을 그대로 남기며 오류가 바뀔 때만 다시 알립니다.

## R2 구조와 실패 처리

```text
sk7-design-corpus-private
  visual-factory/v1/<workspace-uuid>/<batch-uuid>/
    originals/<sha256>.png
    derivatives/<sha256>.png
    indexes/<sha256>.json
```

각 이미지 PUT과 GET에 `--remote`를 명시합니다. 원격 원본과 정리본의 **전체
바이트 크기 및 SHA-256**이 일치한 후에만 해당 배치 인덱스를 PUT하고 다시 GET하여
검증합니다. HTTP 200 또는 HEAD만으로 성공을 표시하지 않습니다.

공유된 mutable `latest.json`이나 운영 manifest를 덮어쓰지 않습니다. 배치 인덱스는
그 배치에 들어간 파일을 찾는 완결된 목록이며, 로컬 index.json이 전체 후보 목록입니다.
각 배치의 원격 index key는 receipts/에 남습니다. 다른 Mac에서 만든 배치를
자동 합치는 기능이나 원격 전체 보관함 탐색은 이 버전에 포함되지 않습니다.

실패하면 pending plan을 유지합니다. 다음 sync는 동일 UUID/key/bytes를 사용하여
재개합니다. 실패한 원격 쓰기를 되돌렸다고 주장하지 않으며, 불확실한 부분 전송을
삭제하지 않습니다. 새로운 이미지가 옛 v1 파일을 덮어쓰는 방식의 버전 증가는 없습니다.

Wrangler CLI는 이 도구에서 S3 `If-None-Match` 조건부 PUT을 사용하지 않습니다.
nonce+digest namespace와 로컬 단일 writer lock으로 **이 도구의 재시도를 멱등적으로**
만들었지만, 서버 차원의 write-once 잠금이나 다른 자격증명 보유자의 악의적
덮어쓰기까지 막는 것은 아닙니다. 그런 다중 writer 요구가 생기면 별도 S3 조건부
PUT/ETag 설계를 검토해야 합니다. 현재 단계에서 인증 방식을 늘리지 않았습니다.

## 검증 범위와 제외

PNG: 8-bit, non-interlaced 정지 PNG의 signature, chunk CRC/길이/순서,
bounded inflate, scanline 구조, 실제 alpha pixel 값을 검사합니다. RGB/완전
불투명 RGBA/체크무늬 배경 그림을 투명하다고 표시하지 않습니다. 정리본은
별도 PNG 파일이며, EXIF/text/C2PA 등 부가 정보는 정리본에서 제외하고 원본에는
그대로 보존합니다. 색상 관련 프로파일은 유지합니다. 자동 resize나 WebP 변환은
하지 않으며, 원본 해상도/포맷을 속이지 않습니다.

WebP: RIFF 및 정지 frame header/크기만 검사합니다. codec 전체 디코딩 및 실제
투명 픽셀은 **미검증**으로 표시합니다. 완전 디코딩 검증으로 과장하지 않습니다.
GIF/APNG/animated WebP/MP4/WebM/SVG는 이 정지 이미지 intake에 포함하지 않습니다.
이 제한은 지원 없는 파일을 조용히 정지화·변환하는 사고를 막기 위한 것입니다.

품질/텍스트/공식 3D identity/권리/모바일 적합성은 사람 검토가 필요합니다.
현재 방의 생산 규칙은 곰 hero, 보조 동물 순환, 텍스트 최소,
S12 → S13 → S06 → S02이며, 코드가 이미지의 의미를 자동 승인하지 않습니다.

## 테스트 및 저장소 반영

```bash
python3 -B tests/test_visual_factory.py
```

`tests/test_visual_factory.py`는 기존 Python test 수집 경로에 들어갑니다.
채팅의 GitHub connector 쓰기는 초기 403이었지만 사용자 Mac의 `gh` 인증은 정상이며,
Issue #741에서 이 변경을 추적합니다. 별도 branch/PR과 기존 merge gate를 유지하고
`.github/workflows`는 이 패키지가 변경하지 않습니다.

## 출처와 계약

초기 설계 점검 기준은 `3f41e10b654b6f78c7bbc48c9ef3cb02305e38d8`이었고,
실제 Mac 설치·검증 worktree는 다시 fetch한 `origin/main`
`8112b9d27baa85156b57a6d22f26afd824512026`에서 시작했고, 게시 전 다시 전진한
`746939b3a19e730294e9e60eaaea05d58db82653`로 fast-forward했습니다.
어느 값도 다음 작업의 최신 main을 대체하지 않습니다.

- Repository: AGENTS.md, docs/project-handoff.md, docs/README.md,
  docs/visual-production-contract.md, docs/visual-asset-runtime.md,
  ops/sk7-asset-gateway/README.md.
- Cloudflare CLI: https://developers.cloudflare.com/workers/wrangler/commands/r2/
- Public bucket scope: https://developers.cloudflare.com/r2/buckets/public-buckets/
- Conditional PUT capabilities: https://developers.cloudflare.com/r2/api/s3/api/
- Private CLI output parser inspected in cloudflare/workers-sdk:
  packages/wrangler/src/r2/public-dev-url.ts (blob 3dc883caaa9ea3f9c2309e61c11830f4c84273b9)
  and domain.ts (blob 3697b042244991528ab98befe970c7d805f92f75).
- ChatGPT image saving: https://help.openai.com/en/articles/11084440-images-in-chatgpt
