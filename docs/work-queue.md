# SK7 작업 대기열

## S0 — 병합 후 기록 정리와 인계

- 범위: PR #231/#234/#235/#236/#237 병합 상태를 현재화하고 작업 상태·로컬 인계를 만든다.
- 완료 기준: 현재 main 기준, 보존할 과거 근거, 다음 결정과 blocker가 연결된다.
- 선행 조건: `origin/main` 대조와 #225 후속 항목 확인.

## S1 — 자산 보존·최종 조합 검사

- 범위: 로컬 11종·77개 고유 동작, 물범 제외, 선택 manifest와 검토 자산의 보존·조합을 확인한다.
- 완료 기준: 선택 목록·해시·검토 범위가 일치하고 누락/중복/외부 업로드가 없다.
- 선행 조건: S0 인계와 기존 로컬 자산·manifest 접근. 새 생성·재렌더는 포함하지 않는다.
- 결과: [#240](https://github.com/AI-HealthCare-05/AH_05_07/issues/240)에서
  `selected-inventory-eleven-001.json` 및 checkpoint의 SHA-256, 11종·77개 고유 동작,
  물범 미선택, 352개 선택 파일의 존재·bytes·SHA-256를 대조했다. 누락·논리 중복은
  없고, 동일 바이트는 의도된 공유 `generator.py` 3그룹(7파일)만 남는다.

## S2 — 디자인 선정

- 범위: 보존된 자산의 제품 사용 여부, 대상 화면, 사용 권한과 제외 대상을 사람이 결정한다.
- 완료 기준: 책임 있는 검토자의 선택·보류·제외 근거가 기록된다.
- 선행 조건: S1 조합 확인과 별도 Issue. 물범은 선택 대상이 아니다.
- 현재 결과: 사용자가 11개 후보를 모두 `selected`로 결정했고 [S2 선정 기록](s2-design-selection.md)에 허용/제외 화면, 동작 제한, 권리 근거를 반영했다. 제품 UI 적용은 하지 않았다.
- S3 선행 조건: S3A 사람 결정과 S3B R2 게시가 완료되었으며, 실제 화면 연결·반응형·접근성·운영 승인은 S3C/S3D review gate에서 별도 검토한다.

## S3 — 화면 적용 검토

- 범위: S2 결정을 실제 화면에 적용할 필요성·경계·검증 계획을 검토한다.
- 완료 기준: 적용 여부, semantic HTML/CSS 경계, 반응형·키보드 검증과 운영 배포 승인 경로가 합의된다.
- 선행 조건: S2 결정, 별도 구현 Issue, 필요 시 ADR. 적용·배포 자체는 이 단계의 자동 결과가 아니다.
- 현재 결과: Issue #244에서 11종·7 clip 중앙 계약, 기본 `off`/fail-closed 게이트,
  S02/S03/S05/S10 검토 후보와 제외 화면 정책, 동작 의미·reduced-motion·실패 격리
  경계를 구현하고 합성 검증했다. Issue #247에서 검증된 22개 `companion/v1/`
  GLB를 R2에 게시하고 source↔remote/public 검증을 완료했다. Issue #248에서
  evidence-generated manifest와 lazy Three.js `0.185.1` review runtime을 연결하고,
  22/22 GLB·7 clip·정책·network·responsive·failure isolation을 검증했다.
- 현재 결과: S3D 사람 시각 수용은 **APPROVED**. bear primary, lite candidate,
  S05 `save_success` only이며 S02/S03/S10은 hold, S11은 제외한다. S3E Phase B
  production activation, smoke, rollback rehearsal, and final restore는
  [production evidence](s3e-companion-production-rollout.md)에 기록했고
  **COMPLETE**다. 상세 S3D 결정은 [S3D 기록](s3d-companion-visual-acceptance.md)과
  [Issue #250](https://github.com/AI-HealthCare-05/AH_05_07/issues/250)에 둔다.

## S3E — 승인된 S05 bear-lite 운영 rollout gate

- 범위: [#252](https://github.com/AI-HealthCare-05/AH_05_07/issues/252)의 좁은 승인 범위만 구현한다.
- 승인 범위: `bear` + `lite` + S05 + 명시적 `save_success` 1회 `celebrate` 후
  `idle`/`rest`, decorative only.
- 제외: S02/S03/S10/S11 및 기타 화면, `greet`/`curious`/`move`/`special`,
  automatic species selection, `standard`, responsive/network variant switching.
- 완료 기준: production-off fail-closed, S05 one-shot/network/rollback,
  responsive 1366/390/320, CTA·bottom-nav non-overlap, reduced-motion,
  accessibility, failure isolation, bundle/network evidence.
- 선행 조건: S3D 승인 기록.
- 현재 상태: **COMPLETE**. Production rollout is **ACTIVE + VERIFIED + ROLLBACK
  REHEARSED**; activation smoke, rollback rehearsal, and final restore evidence
  are recorded in [s3e-companion-production-rollout.md](s3e-companion-production-rollout.md).
  Issue #252 completion is pending only on this closeout PR merge.

## S4 — 1회차 마감 — **CLOSEOUT-READY / DOCUMENTATION SYNC**

- 범위: 운영 O1/O2/O3, API P95, 제출 시트·최종 검토, 발주 범위 수용, 입력/모델 결정을 정리한다.
- 완료 기준: [#238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238)의 모든 completion condition에 실행 근거 또는 책임 있는 수용/보류가 기록되었다.
- 현재 상태: **completion conditions satisfied; #238 closeout after this documentation sync**.
  현재 비모델 후속 경계는 아래 Round 2 reconciliation에 기록한다.

### S4 최종 결정 요약

- **O1:** COMPLETE / VERIFIED.
- **O2:** 1회차 alternate evidence accepted. 격리 `exact_time_retention_rls_test.sql`
  17 assertions 등의 retention/RLS 계약 근거를 일정상 수용했으며 production natural
  expiry는 수행하지 않았다. Deployed expired-row invisibility before physical purge는
  별도 승인-bound evidence로 남긴다.
- **O3:** COMPLETE / VERIFIED.
- **API P95:** EXECUTED / OPERATOR VERIFICATION NOT PASSED. `/live`와 `/ready`는
  `c=1/c=4` PASS, `/window` `c=1` warm-up HTTP 503 제외 후 measured `n=0`이다.
  zero-error acceptance를 충족하지 못해 전체 operator verification은 NOT PASSED이며,
  `/window` P95는 계산되지 않았고 추가 rerun은 금지한다.
- **제출:** COMPLETE / USER ACCEPTED. 공식 제출물 7종 / 실제 파일 8개.
- **범위:** FOLLOW-UP SCOPE DECIDED. 혈압·7일 챌린지 기록 서비스와 공개 횡단면 데이터
  연구 보고 범위이며, Talos 필수 요구 전체 충족이나 client의 축소 범위 승인을 주장하지 않는다.
- **입력/모델:** 1회차 NO-GO / `model_not_ready`. final model 없음, release
  preprocessing/calibration/threshold 미고정, held-out test UNOPENED / NOT AUTHORIZED,
  승인 serialized artifact 없음.

### S4 O1 — **COMPLETE / VERIFIED**

- [O1 실행 문서](o1-production-flow-execution.md)의 current documentation baseline은
  `01b29c5d574e18f238683551e088cba0316536f9`다. 이는 deployed API artifact와
  동일하다고 주장하지 않는다.
- 현재 기록된 production web source evidence는
  `30fd65eda8d988804c8af208276934226e0eb67d`다. API artifact는 image tag
  `921a35e` → repository commit `921a35e38261104aec1cdd7095f86a16c48f357c`
  로 operationally 매핑되며 source attestation은 unavailable/not claimed다.
- public/no-auth pre- and post-cleanup deployment smoke는 PASS했다. approved
  Synthetic A production execution, session continuity, BP/challenge flow,
  cleanup, and in-app offline/recovery were completed and recorded in the
  [sanitized execution evidence](evidence/o1-production-execution.md).
- O1 범위는 AC-04/06/08의 Synthetic A owner 흐름이다. 기존 #149의
  cross-user 근거를 승계하므로 Synthetic B는 새로 만들지 않는다.
- O1 execution 당시 Cloud Run revision은 `bp7-api-00013-qbz`, traffic은 `100%`,
  image digest는 `sha256:f0acce9e03f480bf17851e7e025b5e1e9cde3eb27c386df957c68555d701d1ee`다.
  O3 final runtime은 아래 S4 O3 항목에 별도로 기록한다. O1의 cleanup path는 Synthetic A의 정상
  product/API 삭제 후 approved Auth account deletion과 declared FK cascade로
  resolved되었다.
- Natural session invalidation was not run, direct production unknown-field request
  was not run, and full-page browser Offline F5 was not counted toward application
  offline behavior. The valid in-app offline/recovery experiment passed.
- O1 is **COMPLETE / VERIFIED**. No identifiers, secrets, raw logs, screenshots,
  or exported JSON were retained.
- O1 실행 Issue [#257](https://github.com/AI-HealthCare-05/AH_05_07/issues/257)은
  CLOSED다. O3 실행 successor는 [#261](https://github.com/AI-HealthCare-05/AH_05_07/issues/261)이며,
  부모 [#238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238)은 계속 OPEN이다.

### S4 O3 — **COMPLETE / VERIFIED**

- [Sanitized O3 execution evidence](evidence/o3-clean-release-execution.md)는
  approved/runtime SHA `3106537d61396b20a18a85cd6d0d74c498a91aab`, Cloud Build
  `60c0a23f-6383-47c4-b966-616379116a0d` **SUCCESS**, and immutable image
  digest `sha256:34131105048ca654a4e0e1cf9a1982bc909e7120d1f6320042170262d64e2399`를
  기록한다.
- `bp7-api-00014-jeq`의 no-traffic, activation, rollback, restore/final smoke는
  모두 **PASS**다. Final traffic은 `bp7-api-00014-jeq` `100%`다.
- `20260904090000_add_challenge_checkins_challenge_user_index`는 한 번 적용되었고
  migration history가 정렬되었다. Schema check는 index **PRESENT**를 확인했으며,
  즉시 Advisor `unused_index` **INFO**는 post-creation context로 보존한다.
- Web은 재배포하지 않았다. O3는 API-only이며 product writes/model/R2/UI/
  Cloudflare changes는 모두 `0`이다. API clean-release/rehearsal portion은
  **COMPLETE / VERIFIED**이며 web clean-environment release/rollback rehearsal도
  [AC-10 web evidence](evidence/ac10-web-clean-release-execution.md)에 기록되어
  AC-10 overall은 **COMPLETE / VERIFIED**이다.

### S4 API P95 — **EXECUTED / OPERATOR VERIFICATION NOT PASSED**

- [S4 API P95 pre-flight](api-p95-verification-preflight.md)에서 generated
  OpenAPI와 현재 web 호출을 대조해 no-auth health, signed-in read,
  signed-in mutation, `model_not_ready` 후보를 분류했다.
- Operator verification executed against the approved scope. `/live`와 `/ready`는
  `c=1/c=4`에서 PASS했다. `/window`는 `c=1` warm-up HTTP 503을 제외했고 measured
  `n=0`이므로 P95를 계산하지 않았다.
- 따라서 `/window` P95가 3초 초과 또는 이하였다고 주장하지 않으며 P95 PASS도 주장하지
  않는다. cold-start, export, mutation/write, auth churn, model execution,
  risk-signal, and R2/UI/DB/deployment changes remain excluded.
- `observation-load-baseline.md`의 수동 browser n=3 timing과 PR #235의 local
  synthetic 489 measurements는 production P95로 사용하지 않는다. 기존 수치는
  재계산·재실행하지 않았다.
- This final verification result does not authorize or require another run. The bounded
  harness is `scripts/ops/measure_api_p95.py`, and its offline aggregate verifier is
  `scripts/ci/verify_api_p95_evidence.py`.
- Successor [Issue #264](https://github.com/AI-HealthCare-05/AH_05_07/issues/264)
  는 실행을 추적하지만 부하 실행 승인이 아니다. 부모 [#238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238)은
  계속 OPEN이다.

### S4 follow-up boundaries

- O2 natural 30-day expiration verification was not performed; the alternate-evidence
  decision is complete for the first submission.
- O3 is **COMPLETE / VERIFIED**. See the historical [O3 clean-release preflight](o3-clean-release-preflight.md),
  [sanitized execution evidence](evidence/o3-clean-release-execution.md), and
  [Issue #261](https://github.com/AI-HealthCare-05/AH_05_07/issues/261).
- O3 was API-only: web reproduction was intentionally not performed because the
  approved candidate had no web runtime delta from the recorded production web
  source. The additive index was applied once and migration history was aligned;
  the immediate Advisor `unused_index` INFO is retained as post-creation context.
- The submission, scope, and input/model decisions are complete as decisions. They do not
  mean client scope approval, model validation, held-out test execution, or model release.
- The rolling recent-7-day/challenge-progress ambiguity and export-success notice
  navigation persistence were historical findings. Later source implementation and
  browser evidence resolve both; the historical O3 evidence is not rewritten.

## Round 2 non-model reconciliation

### Resolved since first closeout evidence

- T3 session privacy boundary — #304 / PR #306, including account-scoped state reset,
  delayed previous-account read/mutation/export suppression, same-user token refresh,
  Back/Forward blocking, and explicit local logout.
- Recent-seven-day/challenge-seven-day ambiguity.
- Export-success notice navigation persistence.

### Approval-bound evidence

- AC-05 deployed expiry behavior: production approval is required before any deployed
  expired-row exercise. Local exact-time retention pgTAP evidence does not replace it.

### Operations evidence

- AC-10 is **COMPLETE / VERIFIED**. O3 API clean release and the web
  clean-environment release, public smoke, rollback rehearsal, rollback smoke,
  and final restore are complete and recorded in the AC-10 web evidence.

### Product lifecycle design

- Account-removal operational/support route is unresolved. The current `/users/me` API
  provides read/update only; O1 operator cleanup does not establish a self-service route.

### Error boundary

- R-06 error normalization browser evidence — **RESOLVED**. The signed-in harness explicitly
  covers server `409` / `observation_conflict` recovery without retry or false success.

S4는 모델 출시, test 실행 또는 운영 배포를 자동으로 승인하지 않는다.

기능 범위 완료 후 전체 UI/companion composition을 별도 통합 디자인 패스로 검토.
