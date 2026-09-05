# 합성 입력 질문 검토실

실제 설문이 아닌 개발용 정적 화면이다. [원문 대조와 남은 결정](../../docs/input-question-review.md)을
먼저 읽는다. 모든 사례는 고정된 합성 텍스트이며 코드를 계산하는 adapter가 아니다.

## 열기

저장소의 `tools/question-review/index.html`을 Edge 또는 Chrome에서 직접 연다.
Windows PowerShell에서 저장소 루트를 기준으로:

```powershell
Start-Process (Resolve-Path tools/question-review/index.html).Path
```

서버, npm 설치, API 키, 로그인은 필요 없다. 파일 네 개를 함께 보존한다.
feature 버튼 → 고정 사례 버튼을 선택하고 질문·코드/미지원 상태·출처를 대조한다.
Tab/Shift+Tab으로 이동하고 Enter/Space로 버튼을 누를 수 있다.
실제 응답을 넣을 입력칸, 저장/전송/추적, 모델 계산이 없다. 외부 출처 링크는
직접 누를 때 CDC로 이동하며 응답 쿼리나 referrer를 붙이지 않는다.
운영 web/public으로 복사하거나 제품 라우트에 연결하지 않는다.

## 자동 확인과 캡처

기존 web lock의 Playwright만 사용하며 새 의존성을 추가하지 않는다.

```powershell
npm --prefix web ci
npm --prefix web run build
Push-Location web
npx playwright install chromium
Pop-Location
node tools/question-review/verify.cjs
```

각 명령이 성공한 후 다음 명령으로 진행한다. 기본 캡처는 gitignored
`web/test-results/question-review`에 생성된다. 다른 경로는 마지막 명령의 인자로
지정할 수 있다. 브라우저 설치는 검증 환경 설정이며 화면 자체는 설치 없이 동작한다.
CI에서는 Windows/Linux Chromium으로 동일 검증을 수행한다.

검사는 전체 합성 사례의 표시·미확정 상태 보존·키보드·가로 넘침·네트워크와 저장
시도 부재·production build 분리를 다룬다. 한국어 설문의 신뢰도나 실제 건강정보,
모델 변환의 정확성 검증이 아니다. 캡처 생성은 테스트 도구가 수행하며 화면에
다운로드나 응답 저장 기능은 없다. 공유 캡처는 [문서](../../docs/input-question-review.md)에 연결한다.
