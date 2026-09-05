# SK7 1회차 마감 기준

**상태: 진행 중.** 통합 관리 Issue [#225](https://github.com/AI-HealthCare-05/AH_05_07/issues/225).
기준 main은 PR #224 병합 `255c904414943e21ee0a8596690e2a1adebb3ebc`이다.
제출 검토본 제작 기준은 PR #226 병합 `d3d1a1a2903c558778eef7be0f249057e40ee769`이며
[PPTX/PDF/MP4 실제 파일의 검사 기록](mvp1-submission-package.md)을 연결한다.
이 문서는 요구사항을 축소 승인하거나 연구 결과를 운영 기능으로 승격하지 않는다.
사용자는 로컬 질문 검토 화면의 **작동·항목 표시**만 확인했다. 한국어 자연화는
후속 개선이며, 질문 의미·adapter·지원 대상·모델 출시 승인은 여전히 대기다.
후속 [고도화 실행](upgrade-execution.md)의 사용성·격리 로컬 신뢰성·모델 적용 설계
PR은 각 브랜치의 검사와 연결한다. 아직 병합되지 않은 변경을 현재 운영 기능으로
표현하지 않으며, 제출 검토본 9개 파일은 기존 manifest의 크기·해시와 일치함을
다시 확인했다. 캐릭터 제작과 개발용 뷰어는 별도 로컬 자산 작업이다.

## 판단 기준과 근거의 버전

- **완료**: 명시한 범위의 구현/실행 증거가 있음. 전체 서비스 수용과 별개.
- **구현 필요**: 실행 가능한 기능/제출물이 없거나 목표 설계만 있음.
- **검증 필요**: 구현은 있으나 요구 환경·버전의 근거가 부족함.
- **외부 판단 필요**: 발주사 범위 수용 또는 책임 있는 검토자의 결정이 선행해야 함.
  하나의 요구에 여러 상태가 있으면 모두 표시한다. 점수나 완료율로 합산하지 않는다.

권위는 [저장소 지침](../AGENTS.md), [FR/NFR](requirements.md), [AC](acceptance-test-plan.md),
실제 코드·migration·OpenAPI, [배포 SSOT](deployment-ssot.md) 순으로 대조한다.
발주사 요구 자체의 충족/변경 수용은 저장소의 내부 P0 결정과 구분한다.

| 근거 | 적용 버전·범위 | 이번 처리 / 확대 해석 금지 |
| --- | --- | --- |
| [Talos 필수 요구 원문](https://app.notion.com/p/410f58c8594683eca81581525fe31a8e) / [평가 기준 포함 원문](https://app.notion.com/p/d65f58c859468223b4cf0131de88dc94) | Notion에 보관된 발주 안내, 2026-09-01 편집본, 2026-09-06 직접 확인 | 모델링·대시보드·챌린지 필수와 평가 항목을 분리. Uponati 요구를 혼입하지 않음 |
| [준비](model-gate-1b-evidence.md) / [비교](model-comparison-evidence.md) / [불확실성](model-uncertainty-evidence.md) | 실행 cb3a3f0… / 668a0d8… / 65ec302…; 문서와 JSON에 전체 SHA 보존 | 기존 승인 집계와 한계 참조. 실제 데이터·test 재접근/재실행 없음 |
| [PR #224](https://github.com/AI-HealthCare-05/AH_05_07/pull/224) | 질문 패키지 CI 6개와 로컬 검증, 사용자 작동·표시 확인 | 질문 의미·번역 타당성·adapter 승인이 아님 |
| [RLS 운영 증거](deployed-rls-verification-plan.md) | #149, 2026-09-04 합성 A/B 정상 경로; 당시 migration inventory 기준 | 익명·소유권·교차 사용자·첫 체크인 잠금·정리 완료만 승계. 만료 행은 미실행 |
| [세션](email-link-session-verification.md) / [배포](deployment-ssot.md) | #182 로그인/새로고침/새 탭, #151 rollback/restore, #166 bounded log review | 강제 만료·최신 소스 전체 배포·clean environment 재현을 증명하지 않음 |
| [이번 검증·캡처](mvp1-validation.md) | 기준 commit의 기존 코드, 2026-09-06 로컬 합성 환경 | 운영 계정/데이터/배포와 분리. JSON 계약 검사는 실제 예측 재계산이 아님 |

#213은 PR #214의 구현 완료 조건과 Windows/Linux 포함 당시 CI 10개 성공을
확인해 **고정 train/validation 비교 경로 구현 범위**로 종료했다. 실제 실행·공개
증거와 전체 모델 수용은 별개다. 후속 미완료 항목은 이 Issue에서 통합 관리한다.

## Talos 필수 요구와 현재 제공 범위

| 발주 요구 | 저장소 연결 | 현재 제공 가능한 것 / 근거 | 상태·구체적 종료 조건·선행 조건 |
| --- | --- | --- | --- |
| 공개 데이터 기반 만성질환 발병 가능성 모델 | FR-01/02, NFR-02/03, AC-02/03 | NHANES 횡단면 BP 임계값 라벨의 LR/HGB 연구 비교·탐색적 조건부 구간. [모델 카드](model-card.md). 제품은 503 model_not_ready | **외부 판단 필요 + 구현 필요**. 발병 예측 수용 범위/대상 질환/예측 기간부터 확인. 현재 라벨로 미래 발병을 설명할 수 없음. 원 요구 유지 시 종단 outcome·발병 시점·추적 기간/검열·baseline 비발병 정의, 추가 개발/검증 필요 |
| 활동/건강 입력 시각화 및 모델 기반 발병 가능성 변화 추이·변화율 | FR-03/05/07, AC-04/07 | 현재/이전7일 기록·상세·혈압과 이행의 분리. [UI](../web/src/App.tsx), [정상 캡처](evidence/mvp1/normal-1366.png). 모델 확률 시계열은 없음 | **구현 필요 + 외부 판단 필요**. 기록 목록/회고는 예측 추이/변화율 차트가 아님. 수용된 출력 정의·시간 기준·반복 측정 자료와 모델 검증이 선행; 그 후 차트/결측/오류 및 비인과 표현을 검증 |
| 생활습관 챌린지 | FR-04, AC-06 | 활성1개, 7일, 첫 체크인 후 action 잠금, 상태 수정·확인 삭제. [계약](observation-challenge-contract.md), 기존 합성 E2E·DB 검사 | **구현 완료 / 운영 검증 필요**. 최신 web/API/migration 버전에서 해당 owner 흐름과 정리 증거 확보. 질환 개선 효과를 입증한 것으로 설명하지 않음 |

기록 서비스와 연구 보고의 제출은 원 필수 요구 전체 충족을 뜻하지 않는다.
사용자가 축소 납품 범위를 이미 승인했다는 기록은 없다. 당뇨 예측 기능도 없다.
LLM 추천·식단 이미지 분류·알림은 Talos **선택** 항목이며 이번 마감에 추가하지 않는다.

### 발주사 확인용 질의 초안 — 미발송

> 현재 SK7은 혈압·생활습관 챌린지 기록과 공개 횡단면 데이터의 연구용 비교 결과를
> 제공합니다. 제품의 입력 기반 위험군 선별 신호는 준비 중이며, 현재 연구 라벨은
> 조사 시점의 혈압 임계값 분류입니다. 미래 발병 가능성이나 그 변화율을 예측하지
> 않습니다. 1회차에 이 기록 서비스·연구 보고·명시된 미완료 목록을 제한된 납품
> 범위로 수용할 수 있는지 확인 부탁드립니다. 수용할 수 없다면 필수 질환, 예측
> 기간, 발병/변화 추이의 정의, 허용 데이터와 평가 기준을 지정해 주실 수 있나요?
> 종단 자료 확보와 추가 개발·검증 일정도 함께 협의하고자 합니다. API P95 3초의
> 대상 endpoint·부하/동시성·cold/warm 조건, 개인 프로젝트 역할 평가와 비동기/피드백
> 항목 적용 범위도 확인 부탁드립니다.

발송과 회신 수용 기록은 사용자가 담당한다. 질의 작성 자체를 범위 수용으로 처리하지 않는다.

## FR/NFR 대응과 미완료 조건

원 요구 문구는 [requirements](requirements.md)에 두고 여기에는 판정과 공백만 기록한다.
`O1/O2/O3`은 [운영 검증 절차](mvp1-operations-review.md)의 실행 단위다.

| 요구 | AC / 근거 | 상태 | 미완료의 완료 조건 / 선행 조건 |
| --- | --- | --- | --- |
| FR-00 | AC-01/08, [Auth 계약](auth-contract.md), #182, E2E | 구현·부분 운영 증거 **완료**, **검증 필요** | O1에서 최신 버전 정상 세션·만료/무효 복구. 별도 합성 계정·운영 검증 승인 |
| FR-01 | AC-02, [adapter 초안](model-input-adapter-contract.md) | **외부 판단 + 구현 필요** | 질문 의미/지원 범위/입력 버전 승인 후 adapter·검증·UI/API 연결; 단순 문장 자연화로 대체 불가 |
| FR-02 | AC-02/03, [출시 게이트](model-release-readiness.md) | 안전한 503 **완료**, 성공 경로 **구현 필요** | 수용된 목적, 선택 모델·전처리·임계값·품질 기준·별도 test 승인·artifact·반복 입력·운영 승인 |
| FR-03 | AC-04, [측정 안내](blood-pressure-measurement-guide.md), API/E2E | 구현·합성 **완료**, **검증 필요** | O1의 정상1회 저장/422/수정/확인 삭제·reload, 최신 배포 provenance |
| FR-04 | AC-06, migrations·E2E | 구현·합성 **완료**, **검증 필요** | O1의 활성1개·잠금·상태 수정/삭제·정리 |
| FR-05 | AC-07, [UX](ux-flow.md), 현재/이전/상세 E2E | 기록 lane **완료**, 모델/추이 **구현 + 외부 판단 필요** | 기록 변화와 모델 변화의 정의·발주 범위 수용, 승인 모델이 선행. 실제 없는 그래프/예측을 시연하지 않음 |
| FR-06 | [피드백 원칙](architecture.md), Talos 3-4 | **구현 + 외부 판단 필요** | 구조화 feedback 저장·검토·모델 개선 반영의 절차/담당/보존·동의 결정 후 구현. 온라인 라벨로 즉시 재사용 금지 |
| FR-07 | AC-05/06, RLS·export·E2E | 현재 owner CRUD **완료**, 만료 운영 **검증 필요** | O2에서 만료 직전/이후 CRUD/export 비노출, 정리. 이전 창/legacy는 계약대로 읽기 전용 |
| FR-08 | AC-08, signed-in harness | 합성 복구 **완료**, **검증 필요** | O1의 실환경 확인; 성공·빈 상태·실패·stale·미확정 저장을 혼동하지 않음 |
| FR-09 | ADR-0001/0002, Talos 3-2 | **외부 판단 필요**, 조건부 **구현 필요** | 측정된 모델 지연/기간/신뢰성 요구와 ADR 없으면 worker 미도입. 평가 항목 미충족을 숨기지 않음 |
| NFR-01 | [부하 baseline](observation-load-baseline.md), [고도화 PR #235](https://github.com/AI-HealthCare-05/AH_05_07/pull/235), Talos 5-1 | 격리 로컬 측정 **완료**, 운영·수용 **검증/판단 필요** | 실제 loopback API 경로 489회 응답의 endpoint·cold/warm·동시성·표본·오류·분위수와 호스트 부하 중첩을 보고. 운영 P95나 발주 조건 충족으로 대체하지 않음. 3초의 적용 부하·환경은 외부 확인 필요 |
| NFR-02 | AC-02, 모델 metadata scaffold | **구현 + 검증 필요** | 승인된 입력/불변 artifact/모델 버전으로 반복 입력 API 일관성. 연구 재현성으로 대체 불가 |
| NFR-03 | Gate/비교/불확실성 공개 JSON | 데이터 분리·두 모델/복수 지표 연구 증거 **완료** | 품질 충분성·한국 일반화·calibration·고연령 검증은 모델 게이트에서 계속 미완료 |
| NFR-04 | AC-05, #149, pgTAP | 소유권 구현/정상 운영 **완료**, 만료 운영 **검증 필요** | O2. local pgTAP가 실제 배포 정책을 검사한 것은 아님 |
| NFR-05 | AC-09, secret verifier·합성 fixture | 코드 경계·기존 제한 로그 검토 **완료** | 제출 파일에 식별자/토큰/실제 건강값 없음 확인. 변경된 logging 경로는 별도 운영 재검토 |
| NFR-06 | AC-10, deployment SSOT | 구성·과거 rollback **완료**, **검증 필요** | O3의 clean release/revision·smoke·rollback/restore 증거. local build만으로 완료 불가 |
| NFR-07 | health tests, smoke | 구현·로컬 **완료**, release **검증 필요** | O3에서 실제 revision의 /live·/ready·CORS. readiness는 DB 연결 검사가 아님 |
| NFR-08 | 시각 QA·합성 캡처 | 반응형·키보드 일부 **완료**, **검증 필요** | 최신 운영 UI, 전체 핵심 상태 대비/200% zoom/키보드/실기기 검토. screenshot 존재만으로 전체 접근성 통과 아님 |
| NFR-09 | 조건부 비동기 ADR | **외부 판단 필요** | Talos 평가의 모델 비동기 개선 증거는 없음. 측정/ADR로 도입 필요성을 먼저 판단 |

### 평가 세부 항목의 공백

Talos 공통 평가 원문과 내부 우선순위가 다른 항목도 제외했다고 가정하지 않는다.

| 평가 축 | 근거·현황 | 남은 조건 |
| --- | --- | --- |
| 1-1/1-2/1-3 문제·요구·형식 | 요구/UX/본 대응표 | 정량적 필요성 근거와 제출 시트 최종 버전 검토; 발주 범위 수용 |
| 2-1/2-2/2-3 스택·확장·아키텍처 | ADR, 실제/목표 도면 분리 | 구현도와 실제 배포 revision 대조; 목표 기능을 실적으로 계산하지 않음 |
| 3-1 모델 비교 | 승인된 LR/HGB AUROC/AP/Brier·calibration/subgroup·bootstrap | 상대 비교 만족은 출시 품질 확정 아님 |
| 3-2/3-3/3-4 비동기·반복 입력·피드백 | 모델 비동기 미구현, 연구 재현성 존재, feedback 미구현 | FR-06/09·NFR-02/09 조건 및 평가 적용 판단 |
| 4-1/4-2/4-3 UX·일관성·3–5 action | 현재 Today→Records→detail은 2회, Today→7일/신호는 1회 메뉴 조작; [navigation 검사](../web/e2e/journey-navigation.spec.ts) | 로그인/폼 입력 횟수까지 포함한 전체 사용자 과업은 별도 측정; 모든 사용자 과업이 3–5회라고 주장하지 않음 |
| 5-1 API P95 3초 | 과거 UI 수동 표본에 더해 PR #235의 격리 로컬 API별 합성 집계 확보; 병합 대기 | 보고된 표본·환경·cold/warm·동시성·호스트 부하 제약 안에서만 해석. 운영 대상과 발주 수용 조건은 별도 확인. 새 품질 기준으로 관측값을 통과시키지 않음 |
| 5-2/5-3/5-4 Method·운영·인증 | [API 계약](api-contract.md), JWT/RLS, 과거 운영 기록 | O1/O2/O3와 제출용 API 시트 대조 |
| 5-5 서버 비동기 I/O | [store](../app/services/observation_store.py)의 비동기 HTTP 경로 | 구조 존재와 성능 개선 수치 별개. baseline 대조 없으므로 개선 입증 미완료 |
| 6-1/6-2 역할·협업 | 사용자: 범위/공개/병합 결정, 도구: 구현/검증, GitHub Issue/PR/CI | 개인 프로젝트 역할 평가 방식 확인; AI가 사람의 전문 검토를 대체하지 않음 |

## AC별 마감 판단

| AC | 현재까지 완료 | 실제 남은 공백 / 종료 조건 |
| --- | --- | --- |
| 01 | #182 정상 세션3단계, 합성401 복구 | O1 실환경 만료/무효 복구 및 버전 기록 |
| 02 | 연구 재현성·503 | 승인된 artifact 기반 반복 입력 성공 경로 없음; 모델 게이트 |
| 03 | S11 no-score·503 회귀 | 승인 모델 success UI 없음; 미래 모델 완료로 시연 금지 |
| 04 | 측정 안내·유효성·중복/불확실 저장 합성 | O1 정상 저장1회, 경계422, 최신 실환경 owner 흐름 |
| 05 | #149 정상 소유권, 이번 50개 local pgTAP 중 만료17개 | O2 실제 만료 행 접근·export 비노출/정리 증거 |
| 06 | 활성1개 DB 제약·잠금·status-only edit·확인 삭제 합성 | O1 최신 배포 owner 수정/삭제/reload·정리 |
| 07 | 기록·이행·legacy 분리, 현재/이전·상세 | 모델 fact/발병 추이는 없음; 발주 수용 또는 별도 구현·검증 |
| 08 | 기존25개 browser suite의401/중복/timeout/503/stale/empty/retry 등 | O1 운영 환경에서 가능한 확인과 제한 기록; 강제 장애는 별도 승인 |
| 09 | source/bundle verifier, #166 제한 로그 검토 | 새 logging 변경 없음. 제출본 보안/공유 권한 최종 검토 |
| 10 | 과거 rollback/restore, 이번 로컬 build/smoke | O3 clean 환경의 실제 release/revision/rollback·정리. 환경 재현과 bit-identical image는 구분 |

## 제출물 7종

원본 목록은 [개인 프로젝트 제출 현황](https://app.notion.com/p/3cff58c8594681229cf4e510c74045b6)을
2026-09-06 확인했다. 외부 시트/Canva의 상세 셀·권한·최종 export는 이번에 검사하지
않았으므로 링크가 있다는 이유로 제출 완료 처리하지 않는다.

| 제출물 | 원본 위치 / 이번 준비물 | 현재 상태 / 남은 작업 |
| --- | --- | --- |
| 1 서비스 | [운영 URL](https://ah-05-07-pages.ahnsangkyoon.workers.dev), [저장소](https://github.com/AI-HealthCare-05/AH_05_07) | 운영 이력·소스 존재. 이번은 로컬 검증. 발주 범위 수용·O1/O2/O3·모델 공백 필요 |
| 2 요구사항 정의서 | [제출 시트](https://docs.google.com/spreadsheets/d/1ymawBhR1fl4PyjknleOwdWI9Plqfb8qqVGb2I9b3nHg/edit), [FR/NFR](requirements.md), 본 대응표 | 작성본 링크 확인. 최종 scope/상태·담당·AC를 셀과 대조하고 읽기 권한·PDF/export 검토 필요 |
| 3 API 명세서 | [제출 시트](https://docs.google.com/spreadsheets/d/1LBiCp6sfI1OOphBTpOHxgYh84zNJ2usK3_5n8PMNVNc/edit), [API SSOT](api-contract.md), `/api/openapi.json` | 작성본 링크 확인. 현재 generated OpenAPI의 method/path/status와 대조, legacy/product 구분·503 상태 표시·최종 export 필요 |
| 4 ERD·아키텍처 | [원본](architecture.md), [아키텍처 SVG](diagrams/mvp1-architecture.svg), [ERD SVG](diagrams/mvp1-erd.svg) | 실제와 목표를 분리한 제출용 도면 준비. 운영 inventory/revision 대조와 최종 제출 형식 선택 필요 |
| 5 UI·와이어프레임 | [Canva](https://www.canva.com/folder/FAHUPpTo5FI), [14화면 기준](https://app.notion.com/p/3d1f58c859468143a071d4991c2f85fe), [인계](https://app.notion.com/p/3d1f58c8594681449053d238bc8ce2c1), [캡처 목록](mvp1-validation.md) | 현재 CSS-first UI의 정상/빈/오류/준비 중 합성8장 확보. 디자인 목표와 runtime 차이 설명·공유 권한·최종 선별 필요 |
| 6 시연 영상 | [실제 파일·검사](mvp1-submission-package.md), [대본](mvp1-demo.md) | **4분21.28초 무음 자막 MP4 제출 검토본 준비**. 실제 로컬 합성 브라우저 녹화·정상 재생 확인. 사용자 최종 검토·공유 대상/권한·납품 수용 필요 |
| 7 발표 자료 | [실제 파일·검사](mvp1-submission-package.md), [7장 원고](mvp1-demo.md#발표-내용-초안) | **편집 가능한7장 PPTX·대응 PDF 제출 검토본 준비**. 렌더·집계 표·출처 검사. 발표 리허설·사용자 최종 검토·납품 수용 필요 |

## 1회차 종료 검토 조건과 후속 개선

종료 **공백 검토**는 이 패키지로 시작할 수 있으나 종료 **승인** 조건은 미충족이다.
다음 항목을 모두 확인하거나, 제외 항목을 발주사와 사용자가 명시적으로 수용해야 한다.

- 발주 필수 요구와 실제 납품 범위 차이의 서면 수용, 잔여 조건·일정·책임자 기록.
- 수용된 범위의 필수 구현·AC 운영 검증·환경/revision·cleanup 증거 완료.
- 입력 의미/모델 포함 시 [출시 판정표](model-release-readiness.md)의 별도 책임자 승인.
- API P95·피드백·비동기 등 평가 공백의 증거 또는 적용/유예 판단 명시.
- 제출물7종 최종 파일/URL·버전·공유 권한·3–5분 영상·발표 파일·주장 근거 검토.
- 사용자 최종 검토. PR 병합/연구 evidence 공개/질문 화면 작동 확인을 대체 승인으로 쓰지 않음.

후속 개선: 한국어 문장 자연화, 설문 이해도·의미/측정 검토, calibration·고연령·외부/한국
검증, 명시적 출시 기준, 구조화 feedback, 성능 표본 확대, 접근성 심화, 선택 알림/R2
재연결. 모델·입력·발주 요구의 미충족을 단순 문구 개선으로 낮춰 분류하지 않는다.
