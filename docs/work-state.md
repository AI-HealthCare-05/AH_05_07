# SK7 작업 상태

## 기준

- 현재 기준 main: `2eaa9f6448a41a85a4cb3f65cc826999438b40ea` (PR #241 병합 후).
- S1 검사 기준: `3561e0c66c518c53c8be204ae7258ec4ba577a3b` (PR #239), `origin/main` 대조 완료.
- 작업 안전·주장 경계: [AGENTS.md](../AGENTS.md), [프로젝트 인계](project-handoff.md).
- #225는 1회차 제출 준비 작업의 종료 이력으로 보존한다. 남은 조건은 [#238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238)에서 추적한다.

## 완료된 범위

- PR #231 (`2c9adb6…`): 현재 횡단면 신호·미래 발병·변화 추이를 구분하는 모델 적용 설계를 기록했다.
- PR #234 (`ba549c6…`): 합성 검사와 운영 번들 경계로 사용성 변경을 확인했다.
- PR #235 (`0515f62…`): 격리 로컬 API 경로의 합성 489회 측정·정리를 기록했다.
- PR #236 (`02851bf…`): 선택 11종 GLB의 로컬 재생·바닥 표본·영상 검토를 기록했다.
- PR #237 (`e63b354…`): 로컬 검토 자산을 11종·77개 고유 동작으로 마감하고 물범을 제외했다.
- #240: `selected-inventory-eleven-001.json`(SHA-256 `9fb23a63…`)과 호출 시 제공한 asset root를
  읽기 전용으로 대조했다. 11종·77개 `(species, clip)` 쌍, 물범 `needs_revision`/미선택,
  352개 선택 파일·479,157,979 bytes, 누락 0, 논리 중복 0을 확인했다. 동일 바이트 3그룹
  7파일은 공유 `generator.py` 스냅샷뿐이며, 그 밖의 선택 파일 중복은 없었다.
- 위 병합은 소스 기록의 현재화이며 운영 배포, 모델 선택, 발주 범위 수용이 아니다.
- S2 사람 선정 기록: [s2-design-selection.md](s2-design-selection.md). 11개 후보를
  모두 `selected`로 기록했으나 화면별 사용 범위·동작 제한·권리 확인은 pending이며
  제품 적용이나 출시 승인을 의미하지 않는다.

## 미결 결정

- 운영 O1/O2/O3와 API P95: [운영 검증 준비](mvp1-operations-review.md), [#238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238).
- 제출 시트 대조, 공유·납품 수용, 사용자 최종 검토: [1회차 마감](mvp1-closeout.md).
- 현재 횡단면 입력 기반 위험군 선별 신호와 발병 가능성·변화 추이 요구의 범위 수용: [미발송 질의](mvp1-closeout.md#발주사-확인용-질의-초안--미발송).
- 8개 feature 의미·지원 대상·adapter와 최종 모델/전처리/임계값: [입력 계약](model-input-adapter-contract.md), [출시 준비](model-release-readiness.md).
- 품질·calibration·고연령·외부/한국 사용자 검증, 별도 승인된 단회 test: [모델 카드](model-card.md), [출시 준비](model-release-readiness.md).

## 다음 작업

| ID | 범위 | 완료 근거와 선행 조건 |
| --- | --- | --- |
| S0 | 병합 기록 정리와 짧은 인계 | 이 문서, [작업 대기열](work-queue.md), 로컬 `HANDOFF-LITE.md`, 문서 검사와 PR. |
| S1 | 자산 보존·최종 조합 검사 | #240에서 inventory/asset/checkpoint SHA 대조 완료. 새 생성·렌더·이동·복사·외부 업로드는 수행하지 않았다. |
| S2 | 디자인 선정 | 사람의 11개 후보 `selected` 결정과 기준을 [S2 기록](s2-design-selection.md)에 반영했다. 화면별 사용 범위·동작 제한·권리 확인은 pending이며 S3 선행 조건이다. |
| S3 | 화면 적용 검토 | S2 결정, 별도 Issue/ADR 필요성 검토, semantic HTML/CSS·반응형·접근성 및 운영 경계를 확인. |
| S4 | 1회차 마감 | #238의 운영·제출·범위·입력/모델 결정과 최종 검토를 충족하거나 명시적 수용/보류를 기록. |

이 검사는 inventory의 선택 direct known-file 범위만 다룬다. 이전 버전·검토 산출물·
숨김/미인식 파일, 시각 품질·사람 디자인 승인, 독립 backup과 과거 외부 업로드는
증명하지 않는다. 기존 evidence·manifest·CONFIG·lock과 `model_not_ready`는 보존한다.
