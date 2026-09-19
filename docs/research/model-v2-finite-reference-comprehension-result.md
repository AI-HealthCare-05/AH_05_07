# Increment B3 — finite-reference comparator & comprehension research result

Decision: **PASS_FINITE_REFERENCE_TO_HUMAN_STUDY**.

The finite comparator meaning, aggregate lookup, presentation arms, and
comprehension gate are defined clearly enough to move to a real human
comprehension study. This is **not** production approval to show a percentile to
users. B/B2's `HOLD_REFERENCE_RESEARCH` and `HOLD_SURVEY_UNCERTAINTY` remain in
force; the current product recommendation stays **C — raw-output explanation
only** under the existing S11 preview contract.

[Contract](model-v2-finite-reference-comprehension-contract.md) ·
[Aggregate evidence](../evidence/model-v2-finite-reference.json) ·
[Runner](../../scripts/model/analyze_model_v2_finite_reference_comprehension.py) ·
[Tests](../../tests/model/test_model_v2_finite_reference_comprehension.py) ·
[Presentation prototype](model-v2-finite-reference-comprehension-prototype.html).

## What B3 did and did not do

B3 did **not** revisit the population-inference question. It accepted B/B2's
`HOLD` and asked whether a **fixed finite research reference** position can be
defined and communicated honestly.

Done:

- Primary comparator: G6 validation `product-complete` subset, N=869.
- Two separate position definitions: unweighted finite rank and
  survey-weighted finite position.
- Aggregate lookup table only — no row scores, weights, features, or IDs.
- Five research-only presentation arms (A–E) with synthetic examples.
- Six critical comprehension questions and prespecified study criteria.
- Responsive layout, keyboard focus, 200% text, no horizontal overflow,
  non-color-only markers, text equivalents.
- Synthetic and local-integration tests; no G8 access; no production change.
- Validation-only data execution: only the frozen artifact and the G6 validation
  2024 parquet are opened; development, temporal, and final-test sources are not
  loaded by the B3 runner.

Not done:

- No CI, SE, bootstrap, or population inference.
- No production S11/API/DB/runtime/artifact change.
- No real participant recruitment.
- No claim that 869 records represent Korea or any population.

## Comparator identity

| Property | Value |
| --- | --- |
| Name | `G6_validation_product_complete_2024` |
| N | 869 |
| PSUs | 31 |
| Strata | 14 |
| Singleton strata | 5 |
| Weight | original `wt_itvex` |
| CDF convention | right-inclusive |
| Quantile convention | inverse ECDF, no interpolation |
| Frozen model SHA | `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84` |
| Schema | `model-v2-r1-schema-v1` |
| Adapter | `model-v2-product-input-adapter-v2` |

The complete-case subset was chosen only because the S11 product path currently
requires complete user input. It is not claimed to be more representative.

## Finite position definitions

Two policies are reported **separately**.

**Unweighted finite rank**: each of the 869 records is treated equally. Position
is the right-inclusive empirical CDF rank among the 869 frozen reference model
outputs.

**Survey-weighted finite position**: the same 869 records with original
`wt_itvex`. This reuses B's weighted point estimator; it is **not** population
truth.

**Policy divergence**: maximum absolute position difference is **8.141295 pp**,
consistent with B's 8.141403 pp. This is published, not hidden.

## Synthetic example

| Output | Unweighted position | Weighted position |
| --- | --- | --- |
| 0.635 | 77.56 | 82.08 |

The same score maps to different positions depending on weighting policy,
reinforcing that the number is a position inside a fixed reference, not a
probability or health severity.

In the presentation prototype, the 82 position is the **weighted research-position
example**; the unweighted position for the same synthetic output is 77.56.
The choice between weighted and unweighted policy remains unresolved for
product use.

## Aggregate lookup artifact

`docs/evidence/model-v2-finite-reference.json` contains:

- comparator identity and subset contract;
- unweighted and weighted lookup tables at p01–p99;
- synthetic examples at p10/p25/p50/p75/p82/p90;
- weighting sensitivity summary;
- provenance, hashes, runtime versions, and safety flags.

No participant IDs, row scores, row weights, row features, or reconstructable
participant table. No SE/CI.

## Presentation arms

| Arm | Label |
| --- | --- |
| A | Current-style raw output: `연구/개발 미리보기 · 낮은 연속 출력 0.635` |
| B | Named finite reference, text percentile with explicit `not probability/diagnosis/peer-match` |
| C | Distribution marker without numeric percentile; text label, not color-only |
| D | 100-position explanation; flagged for possible probability confusion |
| E | No comparison; raw output origin and limitation only |

The prototype is a static, self-contained HTML file using only synthetic data
and aggregate lookup values. It is not wired into production.

## Comprehension gate

Six critical true/false questions. "모르겠다" is not counted as correct.

1. `82백분위` = 질환이 있을 확률 82%? → **No**.
2. 나이·성별이 비슷한 사람과 비교? → **No**.
3. 건강이 나쁜 사람 중 상위 18%? → **No**.
4. 진단 결과? → **No**.
5. 생활습관 변화 후 숫자 감소 = 건강 개선? → **No**.
6. 실제 비교 대상은? → 동결 참조 기록에 같은 동결 모델을 적용한 출력 분포.

Proposed formal-study criteria (not achieved): >=90% correct per critical item,
>=80% overall, one-sided 95% lower bound >=80% on critical items.

## Accessibility checks

Verified: 320/390/430 px viewports, 200% text zoom (`rem` units), visible
keyboard focus, no horizontal overflow, not color-only, text alternative for
the distribution marker. No full browser matrix.

## Decision and product recommendation

**PASS_FINITE_REFERENCE_TO_HUMAN_STUDY**.

**Recommended product option: C — raw-output explanation only.**

The finite comparator remains a research candidate. Arms B–D should not advance
to production until a comprehension study demonstrates that users correctly
answer the six critical questions.

## Verification and scope audit

Synthetic tests: **15 passed, 1 local integration skipped** (without data).  
Approved local integration: **16 passed** with byte-identical aggregate output
across two runs. The integration test asserts that B3 resolves only the frozen
R1 artifact and the G6 validation 2024 parquet; development, temporal, and
final-test sources are not opened.

Commands:

```bash
uv run --frozen --group ai python -m pytest \
  tests/model/test_model_v2_finite_reference_comprehension.py -q

SK7_REFERENCE_DATA_ROOT=/Users/gom/Projects/sk7-rnd-data \
SK7_REFERENCE_CREATED_AT=2026-09-19T04:00:00Z \
uv run --frozen --group ai python -m pytest \
  tests/model/test_model_v2_finite_reference_comprehension.py -q
```

Local execution used Python 3.13.14, NumPy 2.4.1, pandas 3.0.5,
scikit-learn 1.8.0, joblib 1.5.3, PyArrow 25.0.1.

- Aggregate evidence SHA-256: `35901943cef65ca8ac906a5caedd94a2cf05e12c9e9514a5decbb37c78507287`.
- Payload SHA-256: `03b942d8cfb65a9d1753ce6d2d698a1ddbc9bb74ef34e2c4016c79ce0f31c63c`.
- Analysis source commit: `602c8a041935fe8671e28b4cd9bb759f029ff4e0`.
- Baseline: `8381743932c4353b2c7d2d207cdc9659b94fbf67` (#624).

Only the aggregate JSON, contract, result, runner, tests, and research-only
HTML prototype are added. No row-level participant data, no G8 open/hash/score,
no model/adapter/runtime change, no production route.

Ruff check/format passed. Autopilot guard: protected-boundary result; no
auto-merge.
