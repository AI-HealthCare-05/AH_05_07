# SK7 작업 상태

## 기준

- S3C 작업 시작 기준 main: `41361189110f9903acce8704bdef6d375ab913ea`.
  이 값은 작업 시작 당시의 역사적 기준이며, 현재/미래 main을 가리키는 포인터가 아니다.
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
- S3 런타임: [companion-runtime.md](companion-runtime.md)와 중앙 TypeScript 계약·기본
  OFF 경계를 보존하면서 S3C review runtime을 구현했다. S3A 사람 사용 범위·권리
  결정과 S3B R2 `companion/v1/` 22개 게시 및 byte/SHA/public header 검증을 완료했고,
  실제 22개 로드·7 clip 이름·정책·responsive·failure isolation을 local review browser에서
  검증했다. S3D 사람 시각 수용은 [결정 기록](s3d-companion-visual-acceptance.md)에
  따라 승인했지만 production activation은 수행하지 않았다.
- successor review gate: [Issue #250](https://github.com/AI-HealthCare-05/AH_05_07/issues/250)
  의 사람 시각 수용을 기록했다. production rollout은 [Issue #252](https://github.com/AI-HealthCare-05/AH_05_07/issues/252)에서
  별도로 다룬다. #248은 S3C review runtime 구현·검증의 역사적 근거로 보존한다.
  S3E Phase B production activation, rollback rehearsal, and final restore are
  complete; the evidence is in [s3e-companion-production-rollout.md](s3e-companion-production-rollout.md).

## 현재 S3 상태

| 단계 | 상태 | 근거와 경계 |
| --- | --- | --- |
| S3A | 완료 | Issue #242 사람 결정: S02/S03/S05/S10만 허용, S04/S07/S08/S09/S11/S12/S13/S14 제외, 일반 4 clip, 조건부 `celebrate`/`move`, `special` 보류, 물범 제외. |
| S3B | 완료 | [companion-r2-v1.json](evidence/companion-r2-v1.json): 22개, 17,867,184 bytes, source↔remote/public 검증 PASS. |
| S3C | review runtime implemented/verified | [Issue #248](https://github.com/AI-HealthCare-05/AH_05_07/issues/248): evidence-generated manifest, explicit selector, lazy Three.js `0.185.1`, 22/22 GLB, policy/network/responsive/failure tests. |
| S3D | visual acceptance **APPROVED** | [Issue #250](https://github.com/AI-HealthCare-05/AH_05_07/issues/250) 승인 댓글과 [결정 기록](s3d-companion-visual-acceptance.md): bear primary, lite candidate, S05 `save_success` only. Successor S3E production rollout is now complete. |
| S3E | **COMPLETE** | Exact `production` mode, 고정 S05 bear-lite profile, confirmed save 이후 one-shot `celebrate → idle`, activation smoke, rollback rehearsal, and final restore are verified. Production rollout is **ACTIVE + VERIFIED + ROLLBACK REHEARSED**. |

## S4 O1 production execution status

O1은 **COMPLETE / VERIFIED**다. 실행 승인 후 approved Synthetic A production
flow를 완료했고, product cleanup·Auth account cleanup·final public smoke까지
완료했다. 상세 sanitized evidence는 [O1 production execution evidence](evidence/o1-production-execution.md),
체크리스트와 경계는 [O1 execution document](o1-production-flow-execution.md)에 둔다.

이번 evidence PR은 production account/record를 생성·수정·삭제하지 않으며,
SQL·migration push, Cloud Run/Cloudflare/Supabase/R2 변경, UI·model 실행 또는
배포를 수행하지 않았다.

현재 기록된 production web source evidence/Worker는 S3E evidence의
`30fd65eda8d988804c8af208276934226e0eb67d` /
`70f9d4d5-6377-4087-a405-63993382441c`다. API는 revision
`bp7-api-00014-jeq`, traffic `100%`, immutable digest
`sha256:34131105048ca654a4e0e1cf9a1982bc909e7120d1f6320042170262d64e2399`로
O3 final state가 기록되었다. O3 승인 release SHA는
`3106537d61396b20a18a85cd6d0d74c498a91aab`이며 documentation baseline과
동일하다고 주장하지 않는다. O1 기록과 O3 실행은 각각의 sanitized evidence에
분리되어 있다. `20260904090000_add_challenge_checkins_challenge_user_index`는
적용되었고 migration history도 repository version으로 정렬되었으며, schema
check에서 index가 확인되었다. 부모 [#238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238)은
계속 OPEN이며 O1 execution successor [#257](https://github.com/AI-HealthCare-05/AH_05_07/issues/257)은
CLOSED다. O3 execution successor는 [#261](https://github.com/AI-HealthCare-05/AH_05_07/issues/261)에서
별도로 추적한다.

이번 reconciliation 중 `containeranalysis.googleapis.com` diagnostic
project-service enablement이 있었으므로, runtime deployment changes와
production data/schema changes는 `0`으로 기록하되 전체 project configuration
changes가 `0`이라고 표현하지 않는다.

## 미결 결정

- S3E [Issue #252](https://github.com/AI-HealthCare-05/AH_05_07/issues/252):
  **COMPLETE**. Production rollout is **ACTIVE + VERIFIED + ROLLBACK REHEARSED**.
  Issue #252 completion is pending only on this closeout PR merge.
- 운영 O1/O2/O3와 API P95: [운영 검증 준비](mvp1-operations-review.md), [#238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238).
- S4 O2: natural 30-day expiration evidence 또는 책임 있는 alternate-evidence 결정 pending.
- S4 O3: **COMPLETE / VERIFIED**. [O3 preflight](o3-clean-release-preflight.md)의
  역사적 게이트와 [sanitized execution evidence](evidence/o3-clean-release-execution.md)에
  approved SHA, clean checkout, reconciled migration, Cloud Build provenance,
  API-only no-traffic rollout, activation, rollback, restore, and final smoke를
  기록했다. 실행 Issue [#261](https://github.com/AI-HealthCare-05/AH_05_07/issues/261)은
  이 closeout PR과 연결한다.
- O1 deferred integrated UI/UX findings: rolling 7-day path가 day-7 progress처럼
  보일 수 있음; export success notice가 navigation 뒤에도 남음. 기능 범위 완료 후
  holistic UI/companion composition review에서 함께 다룬다.
- 제출 시트 대조, 공유·납품 수용, 사용자 최종 검토: [1회차 마감](mvp1-closeout.md).
- 현재 횡단면 입력 기반 위험군 선별 신호와 발병 가능성·변화 추이 요구의 범위 수용: [미발송 질의](mvp1-closeout.md#발주사-확인용-질의-초안--미발송).
- 8개 feature 의미·지원 대상·adapter와 최종 모델/전처리/임계값: [입력 계약](model-input-adapter-contract.md), [출시 준비](model-release-readiness.md).
- 품질·calibration·고연령·외부/한국 사용자 검증, 별도 승인된 단회 test: [모델 카드](model-card.md), [출시 준비](model-release-readiness.md).

## 다음 작업

| ID | 범위 | 완료 근거와 선행 조건 |
| --- | --- | --- |
| S0 | 병합 기록 정리와 짧은 인계 | 이 문서, [작업 대기열](work-queue.md), 로컬 `HANDOFF-LITE.md`, 문서 검사와 PR. |
| S1 | 자산 보존·최종 조합 검사 | #240에서 inventory/asset/checkpoint SHA 대조 완료. 새 생성·렌더·이동·복사·외부 업로드는 수행하지 않았다. |
| S2 | 디자인 선정 | 사람의 11개 후보 `selected` 결정, 허용/제외 화면, 동작 제한, 권리 근거를 [S2 기록](s2-design-selection.md)에 반영했다. 제품 UI 적용은 하지 않았다. |
| S3 | 화면 적용 검토 | S3A/S3B complete, S3C review runtime implemented/verified, S3D visual acceptance approved, and S3E production rollout complete. #248의 review-only 범위와 S3E의 production evidence를 각각 보존한다. |
| S4 | 1회차 마감 — **ACTIVE** | O1/O3 실행 근거와 O2·API P95·제출·범위·입력/모델 결정의 보류 경계를 기록. O3 complete does not close parent #238 or claim S4 overall complete. |

이 검사는 inventory의 선택 direct known-file 범위만 다룬다. 이전 버전·검토 산출물·
숨김/미인식 파일, 시각 품질·사람 디자인 승인, 독립 backup과 과거 외부 업로드는
증명하지 않는다. 기존 evidence·manifest·CONFIG·lock과 `model_not_ready`는 보존한다.
