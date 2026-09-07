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

## S4 — 1회차 마감 — **ACTIVE**

- 범위: 운영 O1/O2/O3, API P95, 제출 시트·최종 검토, 발주 범위 수용, 입력/모델 결정을 정리한다.
- 완료 기준: [#238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238)의 각 항목에 실행 근거 또는 책임 있는 수용/보류가 기록된다.
- 선행 조건: S0–S3의 해당 결과, 운영 승인, 제출 검토, 발주사·분야·통계·제품 책임자의 필요한 결정.

### S4 O1 — **PREPARED / OPERATOR APPROVAL REQUIRED**

- [O1 실행 preflight](o1-production-flow-execution.md)를 최신 `origin/main`
  `5b04817607a07262e7f3c1f162980d1a1530396c` 기준으로 준비했다.
- public/no-auth deployment smoke는 PASS했다. 실제 production account, login,
  record/session 작업과 infrastructure 변경은 **0**이다.
- O1 범위는 AC-04/06/08의 Synthetic A owner 흐름이다. 기존 #149의
  cross-user 근거를 승계하므로 Synthetic B는 새로 만들지 않는다.
- 현재 Cloud Run revision, remote migration inventory의 최신 적용 상태,
  execution window, cleanup owner와 active-challenge cleanup path는
  `operator input required`다. 이 조건이 확인되기 전에는 실행하지 않는다.
- 실행 추적 successor는 [#257](https://github.com/AI-HealthCare-05/AH_05_07/issues/257)이며,
  부모 [#238](https://github.com/AI-HealthCare-05/AH_05_07/issues/238)은 계속 OPEN이다.

S4는 모델 출시, test 실행 또는 운영 배포를 자동으로 승인하지 않는다.

기능 범위 완료 후 전체 UI/companion composition을 별도 통합 디자인 패스로 검토.
