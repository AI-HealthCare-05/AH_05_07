# S3 companion 런타임 기반

Issue #244의 S3 기반 단계다. 이 문서는 S2의 사용자 `selected` 결정을 런타임
배포 승인으로 확장하지 않는다. 화면별 사용 맥락·허용/제한 동작·사용 권리는
여전히 [S2 기록](s2-design-selection.md)의 `pending` 항목이다.

## 중앙 계약

웹 계약은 [`web/src/ui/companion.ts`](../web/src/ui/companion.ts)에만 둔다.
species는 `bear`, `rabbit`, `cat`, `dog`, `red_panda`, `otter`, `capybara`,
`hedgehog`, `penguin`, `fox`, `squirrel` 11종이며 `seal`은 포함하지 않는다.
clip은 `idle`, `greet`, `move`, `curious`, `celebrate`, `rest`, `special` 7개다.
문자열 배열과 타입을 함께 사용해 임의 값이 계약을 우회하지 않도록 한다.

## 게이트와 자산 경계

`VITE_SK7_COMPANION_MODE`가 정확히 `review`일 때만 명시적 로컬 검토 모드로
해석한다. 누락·오타·다른 값은 모두 `off`다. [`CompanionRuntimeBoundary`](../web/src/components/CompanionRuntimeBoundary.tsx)는
현재 두 모드에서 시각 요소나 자산을 렌더링하지 않으며, GLB import/fetch와
네트워크 요청을 하지 않는다. 따라서 production 기본값은 효과가 없는 `off`이고,
검토 모드도 권리·배포 위치가 승인될 때까지 자산 로더를 열지 않는다.

화면 정책은 S02 오늘의 기록, S03 7일 챌린지 선택, S05 저장 완료, S10 7일
돌아보기만 로컬 검토 후보로 둔다. S04, S07, S08, S09, S11, S12, S13, S14는
중앙 정책에서 제외한다. 후보 목록은 운영 승인 목록이나 최종 화면 배정이 아니다.

## 동작 의미 경계

- `idle`, `greet`, `curious`, `rest`: 일반 검토 후보
- `celebrate`: S05의 명시적 `save_success` UI 이벤트에서만 조건부
- `move`: `non_semantic` 장면 이동에서만 조건부
- `special`: 별도 검토 전 보류

정책 함수는 화면·clip·비의미적 UI context만 받는다. 혈압 수치/변화, 위험 점수·
위험군, 모델 결과·준비 상태, 챌린지 성공률, 건강 개선 여부는 입력 타입이나
분기 조건에 존재하지 않는다. `celebrate`가 정상 혈압·위험 감소·건강 개선을
표현하는 경로도 없다.

## 접근성 및 실패 격리

기존 화면은 companion 없이도 정보·폼·탐색을 제공한다. 경계는 장식용 요소를
읽기 순서·키보드 포커스에 추가하지 않으며, 로드 실패를 본문·버튼·폼·탐색으로
전파할 자산 로더가 없다. `CompanionRuntimeBoundary`는 호스트가 전달한
`reducedMotion` boolean만 계약에 보관하며, 이를 혈압·위험·모델 사실로 추론하지
않는다. 현재는 두 모드 모두 `null`을 반환하므로 포커스·정보 전달·실패 표면이
생기지 않는다. 기존 CSS의 `prefers-reduced-motion: reduce` 정책을 그대로
유지하고, 향후 시각 요소를 추가할 때도 이 경계를 선행 조건으로 삼는다.

## 자산 및 운영 경계

이번 단계에는 GLB Git 추가, 로컬 자산 복사, R2·외부 업로드, 생성·모델링·재렌더,
제품 화면 적용, 운영 배포, 모델/ML 변경, test 접근을 하지 않는다. 실제 origin,
manifest, 허용 화면·동작과 권리는 별도 승인 Issue에서 확정한 뒤에만 연결한다.

## 검증 범위

`web/e2e/companion-runtime.spec.ts`는 계약 배열·fail-closed 파싱·화면/동작
정책을 직접 검증하고, fixture 화면에서 GLB/companion 네트워크 요청이 없으며
기존 S02 UI가 유지되는지 확인한다. 이는 정책과 경계의 합성 검증이며 실제 GLB
재생 품질·권리·운영 성능·최종 디자인 승인을 검증하지 않는다.
