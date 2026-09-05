# 1회차 제출 시연·발표 초안

Issue #225. **대본과 내용 초안만 완료. 실제 영상·최종 PPTX/PDF는 아직 없다.**
주장의 판정은 [마감 기준](mvp1-closeout.md), 실행 근거는 [검증 기록](mvp1-validation.md)을
따른다. 원래 화면/계약을 성공한 모델처럼 편집하지 않는다.

## 촬영 준비와 순서

1. 제출 대상 source SHA와 [캡처 목록](mvp1-validation.md)을 확인한다. 모든 장면에
   “합성 fixture · 로컬 제출 검토용 · 운영 실행 증거 아님” 표시를 유지한다.
2. 실제 계정·메일 링크·콘솔·토큰·브라우저 프로필이 없는 새 로컬 브라우저 context만
   사용한다. 기존 `VP-10`, `VP-04`, `VP-11a` fixture를 그대로 사용한다. 모델 결과,
   실제 원자료/예측/식별자/개별 건강값을 붙이지 않는다.
3. [실행 명령](mvp1-validation.md#캡처-재현)은 개발 harness를 loopback에만 연다.
   운영 build에 E2E 플래그를 넣거나 운영 주소에서 fixture를 시연하지 않는다.
4. 촬영 순서: 정상7일 → 기록 상세/분리 → 확정 빈 상태 → 오류/재시도 → 신호 준비 중 →
   실제/목표 도면 → 검증/미완료/질의. 각 장면의 소스/검증 URL을 자막 또는 마지막
   슬라이드에 연결한다. fixture의 버튼 비활성/마스킹을 실제 저장 성공으로 설명하지 않는다.
5. CRUD 성공/취소/불확실 write는 기존 signed-in E2E 결과로 설명한다. 영상에서 동적
   저장 성공을 보여주려면 이미 있는 mock harness를 녹화하고 “모의 API 응답” 표시를
   유지한다. 이번 캡처는 정상 persistence 증거가 아니다.
6. 녹화 후 3–5분 길이·자막·무음 재생 이해도·작은 글자·공유 권한·주장과 근거를
   사용자가 검토한다. 다운로드 가능한 최종 파일/버전을 등록한 후에만 영상 완료로 바꾼다.

## 4분 시연 대본

| 시간 | 화면·조작 | 발화 초안 | 근거 / 주장 제한 |
| --- | --- | --- | --- |
| 0:00–0:25 | 표지와 범위 | “SK7은 혈압 관찰과 한 가지7일 챌린지 참여를 서로 다른 사실로 기록하는 서비스입니다. 지금은 합성 로컬 화면을 시연합니다.” | [요구](requirements.md), 모델 제공 완료라고 하지 않음 |
| 0:25–1:10 | VP-10 / S10 → 기록 상세 | “선택한7일의 혈압 관찰, 챌린지 참여, 이전 기록을 분리합니다. 이전 구간은 읽기 전용입니다. 참여 때문에 혈압이 바뀌었다는 결론은 내리지 않습니다.” | [normal](evidence/mvp1/normal-1366.png), navigation/signed-in 검사. 수치는 마스킹 |
| 1:10–1:40 | 기록 안내·검사 결과 설명 | “측정 안내와 입력 검증, 중복 저장 차단, 체크인 상태 수정·확인 삭제 경로가 있습니다. 브라우저 검사는 모의 API로, DB 소유권 검사는 분리된 로컬 PostgreSQL에서 수행했습니다.” | AC-04/06, [검증](mvp1-validation.md). 영상만으로 운영 CRUD 검증이라 하지 않음 |
| 1:40–2:10 | VP-04 / S12 → VP-11a / S13 | “기록이 없는 상태와 불러오지 못한 상태는 다릅니다. 저장 여부를 확인하지 못했을 때 저장됐다고 표시하거나 자동 재시도하지 않습니다.” | [empty](evidence/mvp1/empty-390.png), [error](evidence/mvp1/error-390.png), AC-08 |
| 2:10–2:45 | VP-10 / S11 | “입력 기반 위험군 선별 신호는 아직 준비 중입니다. 두 모델의 내부 validation 비교와 탐색적 불확실성 보고는 있지만 미래 발병 예측이나 출시 품질을 입증하지는 못했습니다.” | [not-ready](evidence/mvp1/not-ready-1366.png), [모델 카드](model-card.md), [불확실성](model-uncertainty-evidence.md) |
| 2:45–3:20 | 아키텍처·ERD | “현재 브라우저·API·RLS 기록 경로와 아직 없는 모델 artifact·assessment 테이블을 분리해 표시했습니다. 로컬 image build와 smoke는 운영 배포 재현과 구분합니다.” | [도면](architecture.md), AC-10 |
| 3:20–4:00 | 남은 조건·질의 | “발주 요구의 발병 가능성 변화 추이와 현재 범위의 차이는 아직 수용 확인이 필요합니다. 운영 만료 행·clean release·성능 검증, 최종 제출 파일과 책임 있는 모델 판단이 남아 1회차는 진행 중입니다.” | [마감 기준/질의](mvp1-closeout.md), 진행 중을 유지 |

## 발표 내용 초안

최종 디자인 파일이 아닌 7장 구성 원고다. 주장의 근거 링크를 각 슬라이드 하단에 넣는다.

| 장 | 제목 / 본문 핵심 | 넣을 그림·증거 | 발표자 확인 사항 |
| --- | --- | --- | --- |
| 1 | 문제와 발주 요구: 기록 부담, Talos 필수3축, 현재 scope 차이 | [Talos 원문](https://app.notion.com/p/410f58c8594683eca81581525fe31a8e), [대응표](mvp1-closeout.md) | 정량적 문제 규모 자료는 미확보. 임의 통계 삽입 금지 |
| 2 | 현재 제공: 본인 기록·7일 챌린지·분리된 회고·복구 상태 | 정상/빈/오류 캡처 | 화면은 로컬 합성, 운영 실행 증거와 구분 |
| 3 | 실행 아키텍처·데이터 소유권 | [architecture SVG](diagrams/mvp1-architecture.svg), [ERD SVG](diagrams/mvp1-erd.svg) | 목표 artifact/assessment 테이블은 미구현 표시 |
| 4 | 모델 연구: frozen split·LR/HGB·AUROC/AP/Brier·calibration/subgroup·paired 구간 | 승인 [comparison](model-comparison-evidence.md)/[uncertainty](model-uncertainty-evidence.md) 집계 표만 | 전체 AP 개선 근거와 AUROC/Brier 차이 구간의0 포함, 60+·calibration·한국 일반화 한계를 함께 설명 |
| 5 | 검증: browser26, API/store/health31+초기화 보완3, pgTAP50, local build/smoke | [검증 명령/환경](mvp1-validation.md), PR checks | 서로 다른 검증 수준을 합쳐 운영 전체 통과라고 하지 않음 |
| 6 | 요구사항·납품 공백: 모델 목적 차이, 만료 행, clean release, API P95, feedback/비동기 | [판정표](mvp1-closeout.md), [운영 준비](mvp1-operations-review.md) | P95 3초는 외부 평가 기준; 기존 소표본 UI 중앙값으로 대체 금지 |
| 7 | 제출물7종·남은 결정·발주사 질의 | 원본 위치, 영상/발표 파일 미완성, 후속 책임자 | 범위 수용·사용자 최종 검토 전 종료 선언 금지 |

한국어 문장 자연화는 후속 편집으로 남긴다. 승인된 JSON 수치를 발표 편의를 위해
수정하거나 사용자가 model/adapter 출시에 동의한 것으로 인용하지 않는다.
