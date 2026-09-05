# SK7 모델 카드 초안

Issue #221의 검토용 계약이다. 기준 main은 PR #220 병합
`64aca180aab940a731c322fcf22693a5ec58d756`이다. 출시된 모델 카드나 모델 선택
승인이 아니다. 현재 상태는 `exploratory_uncertainty_not_promoted`이며 제품은
`model_not_ready`를 유지한다. [출시 준비 판정표](model-release-readiness.md)의
책임자 지정과 승인 기록이 갖춰져야 다음 실행을 별도로 승인할 수 있다.

## 목적·대상·사용자 표현

[요구사항](requirements.md)의 정확한 표현은 **입력 기반 위험군 선별 신호**이다.
향후 의미가 검증된 구조화 입력을 받아 버전이 고정된 신호를 제공하는 것이 목적이다.
현재 한국 사용자에 대한 지원 근거와 지원 대상은 승인되지 않았다. 모델 출력,
사용자가 기록한 혈압, 7일 챌린지 이행은 별도 사실이다. 어느 하나로 다른 사실을
대체하거나 인과적 변화로 연결하지 않는다. 현재 앱은 기록·챌린지 기능과
신호 준비 중 화면을 제공하며, 유효한 모델 입력 설문은 제품에 연결되어 있지 않다.

## 연구 라벨과 측정 시점

실제 타깃 이름은 `hypertension_risk_group`이다. NHANES 해당 조사 검진에서
측정한 BPXOSY1..3 중 양의 유한값 평균이 130 이상 **또는** BPXODI1..3 중
양의 유한값 평균이 80 이상이면 1, 둘 다 미만이면 0이다(혈압 단위 mmHg).
수축기·이완기 각각 하나 이상의 유효 측정이 있어야 한다. 한 성분이라도
전부 누락되면 제외하며 혈압을 채워 넣거나 누락을 0 라벨로 만들지 않는다.
이는 해당 조사 시점의 횡단면 측정 임계값 라벨이다. 후속 발병 시점이나
챌린지 전후 효과를 관측한 라벨이 아니다. 미래 발병 확률 또는 7일 챌린지의
효과 예측으로 설명할 수 없다. 치료 여부를 반영한 정의도 아니므로 치료 중인
참여자도 측정값이 낮으면 이 연구 라벨은 0이 될 수 있다.

혈압 6개 입력과 모든 혈압 파생값은 predictor에서 제외한다. SEQN은 결합·분할
검증용이며 모델 입력이 아니다. [데이터 계약](data-contract.md),
[semantics](data-feature-semantics.md),
[실행 manifest](../data/manifest/nhanes_2017_2020.json),
[파생 코드](../scripts/data/preparation.py)가 근거다. 라벨 임계값을 제품의
signal_band 결정 임계값과 혼동하지 않는다. 후자는 아직 고정되지 않았다.

## 개발 데이터·제외·전처리

미국 NHANES 2017–March 2020 Pre-pandemic의 일곱 모듈을 사용했다. 인구통계의
성인 코드 연령 18..80을 시작점으로 SEQN 일대일 left join 후 양쪽 혈압 성분과
BMI 10..80 kg/m² 조건을 적용했다. 80은 80세 이상을 합친 코드이며 80세 초과를
모두 제외한 코호트가 아니다. BMI 범위는 SK7 분석 범위이지 CDC 전체 유효성
기준이 아니다. 연령/BMI 누락·범위 밖, 혈압 성분 부족은 포함되지 않는다.
설문 모듈 누락은 그 이유만으로 제외하지 않는다. 중복·누락·잘못된 결합 키와
예상 밖 범주는 실행을 실패시키며 조용히 정리하지 않는다.

승인된 준비 결과는 7,944행, train/validation/test 5,560/1,192/1,192행이다.
이는 기존 evidence에 기록된 수이며 이번 작업에서 분할 파일을 열거나 해시하지
않았다. label-stratified frozen split과 seed 20260901은 보존한다.
범주 결측은 -1, 설문의 7/9는 결측으로 정규화한다. 범주는 결측을 포함해
one-hot, 연속값은 train에서만 산출한 중앙값으로 채우는 공통 파이프라인이다.
범주를 숫자 크기로 해석하거나 validation에서 통계를 학습하지 않는다.
연령/BMI는 앞선 자격 조건 때문에 준비 시 누락이 제외되므로, 중앙값 기제가
있다고 제품의 필수 연령/BMI 누락을 임의 허용하지 않는다. 실제 fill values는
비공개다. [입력 대응표](model-input-adapter-contract.md)가 8개 feature 순서를 명시한다.

표본설계 가중치·복합표본 분산을 사용하지 않은 선택된 내부 코호트다. 미국 전체
인구 대표 성능이나 한국 사용자 성능을 입증하지 않는다. 한국어 질문 이해,
측정 방식, 입력 분포 및 라벨 확보가 같은지 검토한 외부 자료는 아직 없다.

## 모델 비교·불확실성·한계

같은 train 전처리와 validation을 사용한 LR/HGB의 고정 CONFIG 비교다.
LR: C=1, lbfgs, max_iter=2000. HGB: learning_rate=0.1, max_iter=100,
max_leaf_nodes=31, min_samples_leaf=20, l2_regularization=0,
early_stopping=false. seed 20260901, threads=1 및 기존 CONFIG는 그대로다.

| Validation 지표 | LR | HGB | HGB−LR 및 탐색적 95% 구간 |
| --- | --- | --- | --- |
| AUROC | 0.6730 | 0.6875 | +0.0146 [−0.0065, 0.0357] |
| AP (average precision) | 0.5305 | 0.5933 | +0.0628 [0.0278, 0.0955] |
| Brier | 0.2243 | 0.2193 | −0.0050 [−0.0118, 0.0019] |

HGB는 기존 전체 validation의 수치 상대 조건을 충족했다. 이는
[기존 상대 비교 조건](model-promotion.md)의 결과이며 선택·출시 결정은 아니다.
전체 AP 개선을 탐색적 조건부 분석에서 뒷받침하지만 AUROC·Brier 차이 구간은
0을 포함한다. 60–80 코드 그룹 392행의 HGB AUROC는 0.5704 [0.5123, 0.6225],
LR 대비 차이는 +0.0694 [−0.0008, 0.1376]이다. 고연령 판별 한계가 남는다.
HGB의 낮은 예측 구간에서 관측 비율보다 낮게 예측했고, 18–39세 Brier와
40–59세 AUROC 점추정은 악화했다. 보정이나 임계값 조정으로 해결된 상태가 아니다.

불확실성은 기존 결과를 본 뒤 설계한, 고정 예측에 조건부인 점별 paired bootstrap
2,000회·seed 20260901·양측 95% percentile(linear 분위수)이다. 학습 변동성,
다중 비교, NHANES 복합표본설계, 외부/한국 일반화는 다루지 않는다. 모든 비어
있지 않은 그룹의 각 지표는 유효 2,000/무효 0회였고 성별 결측 그룹은 비어
산출하지 않았다. 20행 미만 및 유효 반복 95% 미만의 공개 제한은 유지한다.

근거: [비교 보고](model-comparison-evidence.md),
[불확실성 보고](model-uncertainty-evidence.md),
[comparison JSON](evidence/model-comparison.json),
[uncertainty JSON](evidence/model-uncertainty.json).
운영자 실행 보고·사용자 공개 승인·JSON verifier 통과는 별개다. Verifier는
계약·참조·산술 검사이며 실제 예측에서 구간을 독립 재계산한 증거가 아니다.

## 존재하는 산출물과 아직 없는 출시 산출물

| 항목 | 확인된 상태 |
| --- | --- |
| 데이터 준비 | 승인된 [Gate JSON](evidence/model-gate-1b.json), 로컬 준비/분할 결과에 대한 기존 실행 보고 존재 |
| 비교·불확실성 | 승인된 집계 JSON과 코드·CONFIG·실행 SHA·CI 존재. 예측과 fitted 모델은 당시 메모리에서만 사용 |
| 모델 선택 | 검토·승인된 최종 선택 모델 없음. LR은 비교 기준이며 HGB의 상대 결과가 자동 선택을 뜻하지 않음 |
| 직렬화 artifact | 승인된 실제 모델 파일 및 완성된 release metadata 없음. train_artifact.py와 runtime 검증 scaffold의 존재는 산출물 존재나 출시 승인이 아님 |
| 입력·API | legacy DTO와 model_not_ready만 존재. 승인된 8-feature adapter/제품 설문/성공 API 경로는 없음 |
| Test·운영 성능 | test 평가 미실행. 운영 모델의 성능·반복 입력 결과·외부/한국 성능 evidence 없음 |

이번 모델 카드는 문서 초안이다. 학습·보정·bootstrap·test·직렬화·배포를 실행하지
않았고 UI/API를 바꾸지 않았다. 카드의 내용 검토 승인과 실제 모델 출시 승인을
별도로 기록해야 한다.
