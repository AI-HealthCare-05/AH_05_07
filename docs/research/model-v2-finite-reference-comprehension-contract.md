# Increment B3 — finite-reference comparator & comprehension research

Pre-analysis contract, 2026-09-19. Canonical baseline:
`8381743932c4353b2c7d2d207cdc9659b94fbf67` (merged #624).
This is a protected, research-only continuation of
[Increment B](model-v2-reference-distribution-result.md) and
[Increment B2](model-v2-reference-uncertainty-result.md), not a new roadmap.
It does not override B/B2 decisions or the
[product contract](../model-v2-product-contract.md).

## Research question

B/B2 asked whether the validation sample can infer a Korean population percentile.
The answer is `HOLD`. B3 asks a narrower, separate question:

> Is showing the relative position of a frozen Model V2 output **inside the fixed
> frozen research reference data** useful and understandable, and if so, how?

This is **finite reference comparison**, not population inference. No national,
peer-matched, age/sex-matched, or disease-probability claim is permitted.

## Preserved boundaries

- Current product option remains **C — raw-output explanation only** under the
  existing S11 preview contract. B3 does not extend the preview window or
  authorize any user-facing numeric display.
- No production S11 result, ModelV2Outcome runtime, API, DB, persistence,
  analytics, telemetry, model artifact, input adapter, threshold, band, or
  deployment change.
- No G8 final-test open/hash/score/schema/distribution or new local G8 metadata.
- Preserve #618, independent #616/#621, and the existing stash.

Frozen model SHA:
`d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`;
schema `model-v2-r1-schema-v1`, adapter `model-v2-product-input-adapter-v2`.

## Authority and source access

Reuse B's immutable aggregate JSON and exact model/cohort path/hash allowlist.
Read only the existing G6 validation 2024 prepared cohort for the finite
reference lookup. Do not load development, temporal, or final-test rows into the
comparator. Project only the 11 semantic features and `wt_itvex`, `kstrata`, `psu`.
No IDs, targets, raw SAS or historical prediction lists are loaded.

Verify B's aggregate file/payload hashes before accepting any lookup. Permit only
Git's CRLF checkout conversion by mapping CRLF back to LF **in memory** before the
exact file-hash check, then verify the unchanged payload hash. Reject every other
byte change, including formatting. Never rewrite B.

## Finite comparator definition

Primary comparator: **G6 validation product-complete subset, 2024**.

- `product-complete`: all 11 semantic features observed before imputation.
- Known N from B: **869** records.
- This subset is chosen only because the S11 product path currently requires
  complete user input. Complete-case selection is a limitation, not a claim of
  better representativeness.
- The comparator does **not** claim to represent Koreans, "similar people," or
  any population.

Two position definitions are computed and reported **separately**:

1. **Unweighted finite rank**: each of the 869 records is treated as one record.
   Position = right-inclusive empirical CDF rank among the 869 frozen reference
   model outputs, expressed as a percentile-like number. This is "위치 among 869"
   only.
2. **Survey-weighted finite position**: the same 869 records with original
   `wt_itvex` weights, expressed as a weighted empirical CDF value. This reuses
   B's weighted point estimator; it is **not** promoted to population truth.

The maximum weighted-vs-unweighted mapping difference (≈8.141 pp for complete)
from B is preserved and reported, not hidden.

## Forbidden semantics

Never express the finite position as any of the following:

- 한국인 / 국민 중 상위 x%
- 비슷한 사람 / 동년배 중 상위 x%
- 고혈압 위험 상위 x%
- 질환확률 x%
- 건강상태 상위/하위
- severity, risk band, diagnosis, treatment/prevention effect

Maintain a strict separation between:

1. Model raw output (e.g., 0.731)
2. Finite-reference position (e.g., 82nd among 869)
3. Disease probability or health status

## Weighting policy remains open

B3 evaluates which of the following is most honest/useful for user exposure:

- unweighted finite rank
- weighted research position
- distribution marker only
- no comparator

Do not silently choose one. The decision is recorded explicitly.

## Research presentation arms

Build a **research-only presentation prototype** comparing at least these arms.
Use only **synthetic** examples (e.g., "synthetic internal output 0.731"). Do not
use real participant rows as UI fixtures.

### Arm A — Current-style raw output

```text
연구/개발 미리보기
내부 연속 출력 · 0.731
```

With a short, accurate explanation.

### Arm B — Named finite reference, text percentile

```text
연구 참조 데이터에서의 모델 출력 위치
82백분위
```

Placed near an explicit clarification that this is **not** a disease probability,
peer comparison, diagnosis, or health severity.

### Arm C — Distribution marker without numeric percentile

A marker on the frozen reference output distribution. No color-only meaning
(e.g., no green/red healthy/dangerous mapping). Text equivalent provided.

### Arm D — 100-position explanation

```text
참조 데이터의 모델 출력 분포를
100개의 위치로 나누면 약 82번째 지점입니다.
```

Evaluate whether this phrasing increases probability confusion.

### Arm E — No comparison

Raw output origin and limitation explanation only.

## Reference artifact research

Publish an aggregate lookup artifact:

```text
docs/evidence/model-v2-finite-reference.json
```

Allowed contents:

- reference identity (source, subset, N, model SHA, schema, adapter)
- subset contract and weighting policy
- selected aggregate quantile/CDF lookup for unweighted and weighted positions
- artifact hash and provenance

Forbidden:

- participant ID, row-level model outputs, row-level weights, row features
- any reconstructable participant table
- SE, CI, p-value, or inferential interval

## Comprehension gate

For each presentation arm, a user should be able to answer these critical
questions correctly. "모르겠다" does **not** count as correct.

1. Does `82백분위` mean an 82% chance of disease?
2. Is this an age/sex-matched peer comparison?
3. Does it mean "among people in poor health, top 18%"?
4. Is this number a diagnosis?
5. If the number goes down after a lifestyle change, does that prove health
   improvement caused by the change?
6. What is actually being compared? Answer: frozen reference records scored by
   the same frozen model.

Proposed formal-study criteria (not achieved results):

- >= 90% correct per critical item
- >= 80% overall understanding
- one-sided 95% lower bound >= 80% on critical-item correct rate

No actual user recruitment is performed in B3.

## Decision options

At the end of B3, choose exactly one:

- `PASS_FINITE_REFERENCE_TO_HUMAN_STUDY`: the finite comparator meaning and
  prototype are clear enough to move to a real comprehension study. This is not
  production approval.
- `HOLD_FINITE_REFERENCE`: reference definition or communication ambiguity
  remains too large.
- `REJECT_FINITE_REFERENCE_PRESENTATION`: finite position creates more
  misunderstanding than raw-output explanation.

Also recommend one product option:

- A: numeric finite-reference percentile
- B: distribution marker without percentile number
- C: raw-output explanation only
- D: no numeric model information

## Responsive / accessibility requirements for mockups

If a presentation prototype is built, verify at minimum:

- 320 px, 390 px, 430 px viewports
- 200% text zoom
- keyboard operability
- no horizontal overflow
- not color-only
- text equivalent for any distribution marker

No full browser matrix is required.

## Tests, identity and publication

Synthetic tests must cover CDF position lookup, unweighted vs weighted,
full-vs-complete boundary, invalid scores, missing data, inaccessible G8 paths,
rejection of row material, and schema leakage.

Record baseline and analysis commits, code/contract/B-evidence/source/model hashes,
runtime versions and UTC creation timestamp. Commit contract/code/tests before
actual analysis; never overwrite existing evidence. Publish only the validated
aggregate JSON, research documentation, and research-only prototype. Run targeted
tests, lint/static checks, leakage audit and autopilot guard; one research PR,
no auto-merge.
