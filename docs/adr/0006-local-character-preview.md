# ADR-0006: 로컬 GLB 검토 도구

상태: 고도화 Issue #232 구현 결정. 사용자 요청의 개발용 자산 검증 범위에 한정한다.
제품 의존성·운영 UI/API·배포 승인과 별개다.

## 필요와 대안

G4의 실제 리깅 GLB를 웹에서 재생해 clip·변형·경량형과 자원 해제를 확인해야 한다.
현재 web dependency는 React·Supabase뿐이고 animated GLB loader/renderer가 없다.
HTML 이미지와 영상만으로는 뼈대 clip 재생이나 교체 후 GPU 자원 수를 검사할 수 없다.
브라우저 WebGL 위에 glTF·animation·PBR 처리를 직접 만드는 대신 Three.js를
별도 개발용 도구로 고정한다. 모델/텍스처를 외부 viewer로 업로드하지 않는다.

## 결정

- Three.js 0.185.1, 공식 npm tarball의 SHA-512 integrity를 source에 고정한다.
  `prepare_vendor.py`가 저장소 밖 새 cache에 검증 설치하며 설치 script는 실행하지 않는다.
  MIT license와 출처·버전·파일 manifest를 cache에 보존한다.
- 기존 로컬 viewer 결정에서는 제품 package/lock 및 Python lock을 변경하지 않았다.
  S3C review runtime 범위에서는 별도 보강으로 Three.js `0.185.1`과 타입 패키지를
  고정하고 제품 package/lock에 추가한다. 실행 중 CDN 요청은 없다.
  Python 표준 라이브러리 loopback 서버가 명시한 외부 자산 root와 vendor를 제공한다.
- GLB는 embedded resource만 지원한다. 외부 URI·네트워크 texture는 거부한다.
  production build와 런타임 import/route에는 연결하지 않는다.
- 선택한 자산만 로드하고 교체 시 animation mixer·geometry·material·texture·skeleton을
  해제한다. reduced-motion은 정적 대체 표시이며 재생을 자동 시작하지 않는다.
- viewer 수치는 해당 브라우저 viewport의 관찰값이다. 실제 모바일 기기나 운영 FPS
  통과의 근거가 아니다. 구조 검사/clip 재생과 G4의 시각 품질 판정도 구분한다.

## 검증과 되돌림

합성 fixture로 누락/오류/동시 교체·reduced-motion·context loss·경로 제한을 검사하고,
G4 실제 GLB가 준비되면 모든 clip의 시간/pose 변화·교체 자원·viewport를 확인한다.
임시 fixture를 최종 캐릭터로 세지 않는다. production/off 초기 route에는 renderer
lazy chunk가 fetch되지 않고, 생산 bundle의 main entry에 정적 Three.js import가 없으며
도구 식별 문자열이 없고
기존 product lock이 변하지 않았는지 검사한다. 도구는 서버 종료만으로 비활성화되며
운영 rollback이 필요하지 않다. 기존 검증 완료 자산은 삭제하지 않는다.

공식 출처(2026-09-06 확인): [npm tarball](https://registry.npmjs.org/three/-/three-0.185.1.tgz),
[GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html),
[Three.js 자원 정리](https://threejs.org/manual/en/cleanup.html).

## S3C review-runtime 보강

Issue #248은 위 로컬 검토 패턴을 비운영 review mode에 한정해 재사용한다.
`CompanionRuntimeBoundary`가 explicit approved selection을 확인한 뒤에만 dynamic
import로 renderer를 열고, 한 화면에서는 manifest가 가리키는 GLB 하나만 읽는다.
mode off, invalid selection, excluded screen에서는 renderer chunk와 GLB 모두 요청하지
않는다. 이 보강은 production activation이나 최종 species 배정 승인이 아니며, S3D
사람 visual acceptance 전에는 운영 활성화를 승인하지 않는다.

