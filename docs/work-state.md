# SK7 작업 상태

## 2026-09-08 non-model reconciliation

Source baseline: `9713ed5aab4a4e74b145d79c4d536affab3c010b`.
The [account-removal activation ledger](account-removal-production-baseline.md)
records the latest operator-reported runtime; older runtime identifiers below
remain historical evidence. This documentation pass did not inspect the cloud
control planes or perform production mutations.

- #238 is CLOSED: first-round completion decisions are recorded, not a claim
  that every quality check passed or that the client approved the reduced scope.
- #342 design, #346 / PR #348 implementation, and #355 production activation
  are complete. Actual signed-in production deletion remains NOT EXERCISED.
- Next: review the [synthetic deletion gate](account-removal-synthetic-gate.md).
  This plan does not authorize execution or create synthetic accounts.
- Preserve API P95 EXECUTED / NOT PASSED, measured `/window` n=0, and the
  existing prohibition on another run. Do not reopen completed work by default.
- Model work is owned by its separate workstream. First-round model statements
  below are historical; no current Model V2 readiness is inferred here.


## 기준

- S3C 작업 시작 기준 main: `41361189110f9903acce8704bdef6d375ab913ea`.
  이 값은 작업 시작 당시의 역사적 기준이며, 현재/미래 main을 가리키는 포인터가 아니다.
- S1 검사 기준: `3561e0c66c518c53c8be204ae7258ec4ba577a3b` (PR #239), `origin/main` 대조 완료.
- 작업 안전·주장 경계: [AGENTS.md](../AGENTS.md), [프로젝트 인계](project-handoff.md).
- #225는 1회차 제출 준비 작업의 종료 이력으로 보존한다. 완료 결정은 종료된 [#238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238)에 보존한다.

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

역사적으로 기록된 production web source evidence/Worker는 S3E evidence의
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
CLOSED이며 O1 execution successor [#257](https://github.com/AI-HealthCare-05/AH_05_07/issues/257)은
CLOSED다. O3 execution successor는 [#261](https://github.com/AI-HealthCare-05/AH_05_07/issues/261)에서
별도로 추적한다.

이번 reconciliation 중 `containeranalysis.googleapis.com` diagnostic
project-service enablement이 있었으므로, runtime deployment changes와
production data/schema changes는 `0`으로 기록하되 전체 project configuration
changes가 `0`이라고 표현하지 않는다.

## S4 API P95 verification status

**Operator verification = EXECUTED / NOT PASSED**<br>
**Client acceptance claim = NOT MADE**

Final result: `/live` and `/ready` passed at `c=1/c=4`. `/window` `c=1` warm-up
HTTP 503 was excluded and `/window` measured `n=0`; zero-error acceptance therefore was
not met and `/window` P95 was not calculated. Neither “P95 > 3s” nor “P95 <= 3s”, and
no P95 PASS, is claimed. Additional P95 rerun and client acceptance claim are prohibited.

[S4 API P95 pre-flight](api-p95-verification-preflight.md)는 당시 web-used API
candidate, no-auth health, signed-in read/mutation, `model_not_ready`를
inventory한 역사적 근거다. 기존 browser 3회 timing과 PR #235의 local 489 measurements는
방법론 참고로만 보존하며 최종 production P95 evidence로 승격하지 않는다. 도구와
verifier는 각각 `scripts/ops/measure_api_p95.py`와
`scripts/ci/verify_api_p95_evidence.py`이며, 이번 문서 동기화에서 추가 실행하지
않았다. Successor는
[Issue #264](https://github.com/AI-HealthCare-05/AH_05_07/issues/264)이고,
Issue 자체는 부하 실행 승인이 아니다.

## 현재 결정 및 후속 경계

- S3E [Issue #252](https://github.com/AI-HealthCare-05/AH_05_07/issues/252):
  **COMPLETE**. Production rollout is **ACTIVE + VERIFIED + ROLLBACK REHEARSED**.
  Issue #252 is closed; preserve its rollout evidence as historical.
- 운영 O1/O2/O3와 API P95의 최종 상태: [운영 검증 기록](mvp1-operations-review.md), [P95 pre-flight](api-p95-verification-preflight.md), [#238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238).
- S4 O2: **alternate evidence decision COMPLETE**. `exact_time_retention_rls_test.sql`
  의 17 assertions 등 local retention/RLS contract와 owner-approved deployed
  synthetic expiry evidence가 모두 기록되었다. [AC-05 deployed expiry evidence](evidence/ac05-deployed-expiry-invisibility.md)는
  physical presence와 physical purge 전 owner invisibility를 확인하며, natural
  thirty-day observation이나 broader security guarantee는 주장하지 않는다.
- S4 O3 API clean-release/rehearsal portion: **COMPLETE / VERIFIED**. [O3
  preflight](o3-clean-release-preflight.md)의 역사적 게이트와 [sanitized execution
  evidence](evidence/o3-clean-release-execution.md)에 approved SHA, clean checkout,
  reconciled migration, Cloud Build provenance, API-only no-traffic rollout,
  activation, rollback, restore, and final smoke를 기록했다. O3는 API-only였으며
  web clean-environment reproduction은 [AC-10 web evidence](evidence/ac10-web-clean-release-execution.md)에
  승인된 source freeze, mirror sync, activation smoke, exact-version rollback,
  rollback smoke, restore, and final smoke와 함께 기록했다. API O3와 web
  clean-release/rollback rehearsal이 모두 complete이므로 AC-10 overall은
  **COMPLETE / VERIFIED**이다. 실행 Issue [#261](https://github.com/AI-HealthCare-05/AH_05_07/issues/261)은
  이 closeout PR과 연결한다.
- O1 historical integrated UI/UX findings were later resolved in source: the export
  success notice is cleared by primary navigation and `popstate`, and recent-seven-day
  history is labeled separately from challenge progress. Historical O3 evidence remains
  unchanged and records the findings as they existed then.

- 제출: **COMPLETE / USER ACCEPTED**. 공식 제출물 7종 / 실제 파일 8개이며, 세부
  기록은 [1회차 마감](mvp1-closeout.md)과 [제출 패키지](mvp1-submission-package.md)에 둔다.
- 발주 범위: **FOLLOW-UP SCOPE DECIDED**. 혈압·7일 챌린지 기록 서비스와 공개 횡단면
  데이터 연구 보고 범위로 정리했으며, client가 축소 범위를 승인했다고 주장하지 않는다.
- 입력/모델: **1회차 NO-GO / `model_not_ready` 유지**. D2–D6 결정은 완료되었지만
  final model 없음, preprocessing/calibration/threshold 미고정, held-out test
  UNOPENED / NOT AUTHORIZED, 승인 serialized artifact 없음이다.
- 품질·calibration·고연령·외부/한국 사용자 검증, 별도 승인된 단회 test: [모델 카드](model-card.md), [출시 준비](model-release-readiness.md). 이는 향후 GO 조건이며 현재 모델 출시 승인이 아니다.

## Round 2 non-model status

### Completed in source

- T3 session privacy boundary — #304 / PR #306: authenticated `user.id` browser identity
  boundary, account identity generation, account A → logout/B state clearing, delayed
  previous-account read/mutation completion suppression, stale previous-account export
  suppression, same-user token refresh continuity, Back/Forward private-state blocking,
  and explicit local logout UX are complete in source and browser evidence.
- Observation export retains the existing bounded eight-second timeout and sends
  `Cache-Control: no-store`.
- S01/S14 distinguish product-record retention from the Auth account/email lifecycle and
  explain that downloaded JSON is a local file outside server retention. The O1
  operator-approved Auth cleanup is historical operational cleanup, not a user-facing
  account-removal route.
- The sign-in empty-state routing regression remains covered.
- Export-success notice navigation persistence and recent-seven-day/challenge-seven-day
  ambiguity are resolved against the later source implementation.
- R-06 browser conflict evidence is complete: the signed-in harness drives a server `409` /
  `observation_conflict` response and verifies the stable recovery notice, single mutation,
  preserved blood-pressure draft, recovered save control, session continuity, and no false
  success or S05 navigation. This is regression evidence only; it does not claim production
  verification.

### Unresolved / evidence-bound

- Actual signed-in production account deletion: NOT EXERCISED; see the synthetic gate above.

### Completed evidence

- Deployed expired-row invisibility before physical purge — AC-05 / R-03 evidence is recorded in [the sanitized evidence record](evidence/ac05-deployed-expiry-invisibility.md).

### Separate implementation Issue required

- Account-removal design/implementation and activation are complete (#342 / #346 / #348 / #355); a separate production synthetic gate remains.
- Any actual remaining R-06 implementation gap, if the evidence gap requires code.

## 다음 작업

| ID | 범위 | 완료 근거와 선행 조건 |
| --- | --- | --- |
| S0 | 병합 기록 정리와 짧은 인계 | 이 문서, [작업 대기열](work-queue.md), 로컬 `HANDOFF-LITE.md`, 문서 검사와 PR. |
| S1 | 자산 보존·최종 조합 검사 | #240에서 inventory/asset/checkpoint SHA 대조 완료. 새 생성·렌더·이동·복사·외부 업로드는 수행하지 않았다. |
| S2 | 디자인 선정 | 사람의 11개 후보 `selected` 결정, 허용/제외 화면, 동작 제한, 권리 근거를 [S2 기록](s2-design-selection.md)에 반영했다. 제품 UI 적용은 하지 않았다. |
| S3 | 화면 적용 검토 | S3A/S3B complete, S3C review runtime implemented/verified, S3D visual acceptance approved, and S3E production rollout complete. #248의 review-only 범위와 S3E의 production evidence를 각각 보존한다. |
| S4 | 1회차 마감 — **CLOSED / DECISIONS RECORDED** | O1/O2/O3·API P95·제출·범위·입력/모델 결정의 최종 상태를 기록했다. #238은 종료됐으며, 모델 NO-GO와 `model_not_ready` 경계는 유지한다. |

이 검사는 inventory의 선택 direct known-file 범위만 다룬다. 이전 버전·검토 산출물·
숨김/미인식 파일, 시각 품질·사람 디자인 승인, 독립 backup과 과거 외부 업로드는
증명하지 않는다. 기존 evidence·manifest·CONFIG·lock과 `model_not_ready`는 보존한다.
