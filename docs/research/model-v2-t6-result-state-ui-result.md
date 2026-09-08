# Model V2 T6 — Safe S11 Result-State UI Result

Status: **IMPLEMENTED / SCORE HIDDEN / PRODUCTION DISABLED**

Starting main: `dc83c9ed60ffd3caece47c028a3d0546f40c6de6`

Issue: `#317`

Result-state contract version: `model-v2-result-state-v1`

## Scope

T6 adds a typed S11-only result-state contract and renders only approved
user-visible state copy. It does not add scoring, product input collection,
persistence, or any model/API changes.

Approved states:

1. `not_ready`
2. `input_invalid`
3. `temporarily_unavailable`
4. `result_available_not_user_visible`

The default is always `not_ready`.

A query-string state override exists only through the repository's existing
E2E fixture boundary. When that boundary is not allowed, any requested state is
ignored and the default remains `not_ready`. This is synthetic browser
verification only; it is not a production result channel.

## User-visible copy

- `not_ready`: 아직 준비 중이에요 / 검증된 모델이 준비되기 전에는 결과를 표시하지 않습니다.
- `input_invalid`: 입력을 확인해 주세요 / 이 입력으로는 신호를 준비할 수 없습니다.
- `temporarily_unavailable`: 잠시 사용할 수 없어요 / 지금은 신호 결과를 준비할 수 없습니다.
- `result_available_not_user_visible`: 결과 표시 검토 중 / 기술적으로 결과가 준비되어도 아직 화면에는 표시하지 않습니다.

Common disclaimer:

`이 신호는 진단·치료·예방 판단을 제공하지 않습니다.`

## Safety properties

The S11 result-state object contains no numeric model score, percentage,
threshold, risk band, artifact path/SHA, schema internals, feature payload, or
BP/challenge data.

No low/medium/high risk classification is created. No normal/abnormal or
safe/danger classification is created. T6 does not interpret a hidden technical
score.

Browser tests verify the default, all four synthetic states, invalid-state
fallback, prohibited-copy absence, and 320/390/1366 viewport usability.

## Unchanged boundaries

- frozen artifact/model/preprocessing changed: **False**
- artifact SHA/schema changed: **False**
- T2 validator changed: **False**
- T4 API changed: **False**
- T5 adapter changed: **False**
- legacy risk-signal route changed: **False**
- DB/schema/migration changed: **False**
- persistence/localStorage/sessionStorage added: **False**
- analytics containing Model V2 input/result added: **False**
- deployment performed: **False**
- `MODEL_V2_SCORING_ENABLED` activated: **False**
- real-user Model V2 health-data collection authorized: **False**

Production scoring remains disabled. T6 completion is not approval for score
visibility, real-user Model V2 use, production activation, or release.

Final build/E2E/CI counts are recorded by the PR and CI runs.
