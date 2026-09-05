# SK7 입력 질문 검토 패키지

Issue #223. 기준은 PR #222의 병합 commit
`944ec9da888f1d51673878608dcb57e7070b013a`이다. #221은 모델 카드·입력 adapter
초안·출시 준비 계약 **작성 범위**를 완료했다. 번역, 입력 지원, 모델 선택과 출시는
여전히 승인 전이다. 이번 결과도 검증된 한국어 설문이나 승인된 adapter가 아니다.
제품 표현은 **입력 기반 위험군 선별 신호**를 유지한다.

[adapter 계약 초안](model-input-adapter-contract.md)의 feature 순서와
[semantics version 2](data-feature-semantics.md)를 보존한다. 원자료, test 파일,
개별 예측을 읽지 않았으며 manifest·CONFIG·lock·승인 evidence는 변경하지 않는다.

## 대조 범위와 출처

2026-09-06 CDC 공식 문서 직접 열람. 공개 변수 정의는 **2017–March 2020
Pre-Pandemic**의 `P_` codebook을 기준으로 한다. 아래 질문지는
[해당 결합 주기 공식 목록](https://wwwn.cdc.gov/nchs/nhanes/continuousnhanes/questionnaires.aspx?Cycle=2017-2020)과
[2017–2018 구성 기간](https://wwwn.cdc.gov/nchs/nhanes/continuousnhanes/questionnaires.aspx?BeginYear=2017),
[2019–March 2020 구성 기간](https://wwwn.cdc.gov/nchs/nhanes/continuousnhanes/questionnaires.aspx?BeginYear=2019)의
원문이다. 다른 주기의 유사 문항을 대신 적용하지 않았다. BMXBMI는 응답 문항이
아니므로 questionnaire 대신 두 구성 기간의 신체 측정 매뉴얼을 확인했다.

| Feature | 결합 주기 codebook | 2017–2018 instrument | 2019–March 2020 instrument / 확인 위치 |
| --- | --- | --- | --- |
| RIAGENDR | [P_DEMO](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_DEMO.htm) | [Screener](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/questionnaires/Screener_Modules_1_and_Interpreter.pdf) SCQ.130 | [Screener](https://wwwn.cdc.gov/nchs/data/nhanes/public/2019/questionnaires/SCQ_screener_module_1_K.pdf) SCQ.130 |
| RIDAGEYR | [P_DEMO](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_DEMO.htm) | [Screener](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/questionnaires/Screener_Modules_1_and_Interpreter.pdf) SCQ.290/292 | [Screener](https://wwwn.cdc.gov/nchs/data/nhanes/public/2019/questionnaires/SCQ_screener_module_1_K.pdf) SCQ.290/292 |
| BMXBMI | [P_BMX](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_BMX.htm) | [Anthropometry 2017](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/manuals/2017_Anthropometry_Procedures_Manual.pdf) §3.4.3–4 | [Anthropometry 2020](https://wwwn.cdc.gov/nchs/data/nhanes/public/2019/manuals/2020-Anthropometry-Procedures-Manual-508.pdf) §3.4.3–4 |
| PAQ605 | [P_PAQ](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_PAQ.htm) | [PAQ_J](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/questionnaires/PAQ_J.pdf) PAQ.605와 앞의 소개 | [PAQ_K](https://wwwn.cdc.gov/nchs/data/nhanes/public/2019/questionnaires/PAQ_K.pdf) PAQ.605와 앞의 소개 |
| PAQ620 | [P_PAQ](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_PAQ.htm) | [PAQ_J](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/questionnaires/PAQ_J.pdf) PAQ.620 | [PAQ_K](https://wwwn.cdc.gov/nchs/data/nhanes/public/2019/questionnaires/PAQ_K.pdf) PAQ.620 |
| SMQ020 | [P_SMQ](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_SMQ.htm) | [SMQ_J](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/questionnaires/SMQ_J.pdf) SMQ.022 | [SMQ_K](https://wwwn.cdc.gov/nchs/data/nhanes/public/2019/questionnaires/SMQ_K.pdf) SMQ.022 |
| ALQ111 | [P_ALQ](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_ALQ.htm) | [ALQ CAPI_J](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/questionnaires/ALQ_CAPI_J.pdf) ALQ.111 / 소개 | [ALQ CAPI_K](https://wwwn.cdc.gov/nchs/data/nhanes/public/2019/questionnaires/ALQ-CAPI-K-508.pdf) ALQ.111 / 소개 |
| SLD012 | [P_SLQ](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_SLQ.htm) Data processing / SLD012 | [SLQ_J](https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/questionnaires/SLQ_J.pdf) SLQ.300/310와 help | [SLQ_K](https://wwwn.cdc.gov/nchs/data/nhanes/public/2019/questionnaires/SLQ_K.pdf) SLQ.300/310와 help |

출처 원문은 링크로만 연결한다. 원문 파일이나 응답 자료를 저장소에 복제하지 않는다.
기존 질문지의 면접원용 절차를 앱의 사용자 질문으로 승인한 것은 아니다.

## Feature별 의미·응답·질문 초안

완전한 질문·선택지·합성 사례·출처를 한꺼번에 보는 곳은
[로컬 화면](../tools/question-review/index.html)과 그 정적
[표시 fixture](../tools/question-review/review-data.js)다. 화면의 숫자는 임의 작성한
예시이며 실제 참가자에게서 추출하지 않았다. 이미 공개 코드가 주어진 예시와
원문 조건이 명시된 의미 대조 예시도 제품 변환의 승인을 뜻하지 않는다.

| Feature | 원자료 대상·의미 / 코드·파생·결측 | 한국어 질문·선택지 초안 | 미확정 사항 / 현재 제품의 대응 불가 이유 |
| --- | --- | --- | --- |
| RIAGENDR | 전체 조사 대상; Gender 1 Male / 2 Female / . 결측. screener SCQ.130은 면접원이 확인하며 7/9도 있으나 공개 변수와 다름 | “조사에 기록할 성별 범주를 어떻게 질문할까요?” 남성/여성/응답하지 않음/이 범주로 응답할 수 없음 | 출생 시 성별·정체성 중 무엇인지 문서가 명시하지 않음. sex 또는 회원 gender를 대신 쓸 근거 없음. 뒤의 두 선택지 공개 코드 미배정 |
| RIDAGEYR | 전체 조사 대상 screening 연령, 생년월일 유도·일부 보고 연령; 공개 0–79와 80=80+, . 결측; SK7 18–80 코드 | “기준 시점의 만 나이는 몇 세인가요?” 정확한 나이/모름/응답하지 않음, 80+ 설명 후보 | 기준 시점과 80+ 지원 미승인. age_years 18–120과 다름. 80을 정확히80세로 복원 불가 |
| BMXBMI | MEC 측정 대상 중 BMI 2세 이상; kg/m², 소수 첫째 자리; . 결측. SK7 10–80은 분석 범위 | “측정한 키와 몸무게로 산출한 BMI인가요?” 근거 확인/숫자만 있음/모름/응답하지 않음 | 질문지 자기보고가 아닌 측정 파생값. 기존 bmi는 측정 근거·시점이 없음. tie·자기보고 동등성 미확정 |
| PAQ605 | 해당 성인 문항18+; 평소 한 주 유급·무급 일/집안일/정원일; 숨·심박 크게 증가, 연속10분 이상. 1예/2아니오/7거절/9모름/.결측 | “평소 한 주에 일·집안일 등에서 숨이나 심장박동이 크게 증가하는 격렬한 활동을 한 번에10분 이상 하나요?” 예/아니오/모름/응답하지 않음 | 한국어 강도·업무 범위 이해도 미확인. 운동 일수는 업무 맥락·강도·연속 시간을 제공하지 않음 |
| PAQ620 | 해당 성인 문항18+; 위 업무 맥락, 숨·심박 약간 증가, 연속10분 이상; 코드605와 같음 | 위 질문의 강도를 “약간 증가하는 중간 강도 활동”으로 분리 | PAQ605와 다른 문항. physical_activity_days를 두 feature에 복제 불가. 여가 운동과 구분 |
| SMQ020 | 해당 문항18+; 평생 담배100개비, 1/2/7/9/.; instrument 표기는 SMQ.022 | “지금까지 평생 담배를 합계100개비 이상 피운 적이 있나요?” 예/아니오/모름/응답하지 않음 | 현재 smoking_status에서 평생 누적 추정 불가. handcard SMQ1의 제품군을 한국어 담배 제품에 대응시키는 검토 미완료 |
| ALQ111 | 공개 성인18+ MEC CAPI; 맛보기/작은 모금 제외 평생1잔, 1/2/7/9/.; 소개의 예시 맥주12oz/와인5oz/증류주1.5oz | “맛보기나 작은 모금을 제외하고 평생 술을 한 잔 이상 마신 적이 있나요?” 원문 용량 예시 병기; 예/아니오/모름/응답하지 않음 | 한 잔의 한국어 용량·주종 대응 미확정. alcohol_frequency는 평생 문항도 양도 아님. 소주잔으로 추정 금지 |
| SLD012 | 16+; 평일/일하는 날 주 수면의 잠듦·깸에서 파생, 반시간 반올림; 2=<3h, 3..13.5 반시간, 14=≥14h, .결측 | “주 수면을 위해 보통 잠드는 시각과 잠에서 깨는 시각은 언제인가요?” 시각/모름/응답하지 않음/하나의 일정으로 표현 불가; 낮 수면 포함 설명 | sleep_hours는 낮잠·침대 시각·주 수면 구분 없음. tie·경계 순서·자정/가변 교대 일정의 완전한 변환 규칙 미확정 |

공개 범주와 특수 결측을 설명하는 것과 전처리는 다르다. 기존 train 전처리의
one-hot/중앙값 및 결측 -1은 그대로 유지되지만 이 패키지는 이를 실행하지 않는다.
혈압 라벨 입력과 SEQN은 predictor에서 계속 제외한다.

## 별도 발견 사항과 미해결 범위

1. **수면 초안의 표현 차이:** 기존 adapter 표의 “취침·기상”은 침대에 든/나온
   시각으로 읽힐 수 있으나 SLQ300/310은 잠든/깬 시각이다. 이번 질문 초안에서는
   이를 구분했다. 주간 주 수면도 원문에 포함되므로 교대근무를 CDC가 모두
   제외했다고 표현하지 않는다. 가변 일정의 제품 지원은 여전히 미확정이다.
2. **질문 맥락의 누락 보완:** PAQ에 “평소 한 주”와 업무 범위를, ALQ에 원문
   한 잔의 용량 예시를 추가했다. BMI의 소수 첫째 자리 반올림을 명시했다.
   이 보완은 기존 공개 변수를 읽는 manifest의 변경 사유가 아니다.
3. **Instrument와 공개 변수의 차이:** SMQ.022와 SMQ020의 평생100개비 의미를
   대조했으나 번호 변경의 내부 생성 과정까지 확인한 것은 아니다. RIAGENDR의
   screener 7/9를 공개 변수의 유효 코드로 추가할 수 없다. 수면 시각의 instrument
   거절/모름 77777777/99999999와 공개 시각 77777/99999/빈 값, 파생 SLD012의
   결측은 구분한다. SLD012의 2/14는 결측이 아니다.
4. **수면 파생을 단순 시간 차로 재현하지 않음:** CDC는 응답 검토·편집과 극단 구간
   시각 비공개 처리를 기술한다. 따라서 공개 시각이 비었다는 이유만으로 SLD012도
   없다고 추론할 수 없다. 확인한 문서에서 반올림 tie와 경계 적용 순서의 완전한
   알고리즘은 찾지 못했다. 2h45m/13h45m 예시를 임의 코딩하지 않는다.
5. **범위와 측정:** 공개 codebook의 관측 최소·최대는 허용 입력 범위가 아니다.
   SK7의 BMI 10–80, 성인 연령 조건은 분석 계약이다. 80+의 모델 지원과 개인의
   정확한 나이, self-report BMI의 측정 동등성은 별도 문제다.

이번 직접 대조에서 확인한 것은 위 표현·정보 누락 및 instrument/public 구분이다.
승인된 공개 변수 코드 처리가 잘못됐다고 확정할 근거는 발견하지 못했다.
승인 evidence 무효 판정이나 데이터 재생성을 수행하지 않는다. 후속 검토에서 실제
계약 불일치가 확정되면 영향과 새 실행 승인을 별도로 다룬다.

## 합성 검증과 실행 경계

[실행 방법](../tools/question-review/README.md). 화면은 `tools/question-review`의
HTML/CSS/JS만 읽으며 `web` 빌드·라우트·API·인증에 연결되지 않는다. 직접 누르는
CDC 출처 링크 외 자동 네트워크 요청이 없고 connect-src는 none이다. 응답 입력,
저장, 분석 추적, 전처리, inference 기능이 없다. 모델 수치나 행동 안내를 표시하지
않는다. UI에 있는 버튼은 고정 사례 전환만 수행한다.

[자동 검증](../tools/question-review/verify.cjs)은 1366×768 및390×844에서 모든
합성 사례의 표시, 긴 한국어/URL의 가로 넘침, Tab/Shift+Tab/Enter/Space와 focus,
출처 링크 접근, 요청·저장 시도 부재를 확인한다. production build에도 화면 문자열이
없는지 검사한다. [Windows/Linux CI](../.github/workflows/question-review.yml)에
연결하며 기존 일반·모델 합성·evidence workflow는 유지한다. 원문 의미·한국어 번역의
타당성은 이 브라우저 검사로 증명하지 않는다. 스크린리더 실제 사용자 검사는 미실시다.

기존 [503 회귀 검사](../app/tests/risk_signal_apis/test_risk_signal_api.py)는 합성 요청으로
model_not_ready 및 artifact 환경 변수에 의한 우회 불가를 확인한다. 실제 모델 파일을
로드하지 않는다. [데스크톱 캡처](evidence/question-review/review-1366-viewport.png),
[전체 데스크톱](evidence/question-review/review-1366.png),
[390px 캡처](evidence/question-review/review-390.png)는 합성 수면 경계 사례다.

로컬 Windows 검증 결과(2026-09-06): 33개 사례 × 2개 viewport = 66개 통과,
503/422/환경 변수 우회 방지 3개 통과, web production build 및 Ruff lint/format
통과, 문서 상대 링크 검사 통과. 기존 Gate/comparison/uncertainty 집계 verifier
3종도 통과했다. 이는 기존 JSON 계약 검사이며 실제 예측이나 구간 재계산이 아니다.
합성 캡처를 직접 확인했으며 실제 건강정보나 모델 산출물은 새로 만들지 않았다.
CI의 최종 commit별 결과는 PR checks에서 확인한다.

## 사람 검토에서 결정할 질문

- 제품 담당자·데이터 semantics 검토자: 성별 수집 개념과 범주 밖 응답을 어떻게
  다룰 것인가? 기존 프로필의 자동 대응은 승인하지 않는다.
- 데이터/측정 검토자: BMI의 측정 근거·시점과 80+ 지원을 무엇으로 확인할 것인가?
- 한국어 설문 검토자와 대상 사용자 이해도 검토: 업무 강도·평생100개비·술의 한 잔을
  같은 뜻으로 이해하는가? SMQ handcard 제품 범위와 한국 주종 단위도 후속 확인한다.
- 데이터 semantics 검토자: 수면 tie·경계·편집·가변 일정에 대해 CDC의 추가 근거를
  확보할 수 있는가? 확보하지 못한 대응은 계속 미지원/미확정으로 남긴다.
- 책임 있는 제품·모델 검토자: 위 의미 검토와 [출시 준비 조건](model-release-readiness.md)을
  충족하기 전 adapter를 활성화하지 않는 경계를 유지하는가?

이 문항들의 검토·승인은 대기다. 모델 학습·분석, test 접근/해시, 직렬화·승격·배포,
운영 UI/API 변경은 이번 패키지의 완료 조건이 아니다.
