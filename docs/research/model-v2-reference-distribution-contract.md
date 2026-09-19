# Increment B — frozen Model V2 reference-distribution research

Research scope: [Issue #619](https://github.com/AI-HealthCare-05/AH_05_07/issues/619).
Baseline: `95f9774059c079845eb83a68d26a50ad77c6abce`.
This contract is written before reference scores are computed. It authorizes
only the user-requested aggregate research reuse, not a product contract change.

## Authority and access

Current [product contract](../model-v2-product-contract.md),
[G3 freeze](model-v2-g3-freeze-contract.md),
[G6 validation contract](model-v2-g6-validation-contract.md),
[G7 harmonization](model-v2-g7-external-evaluation-contract.md), and
[R1 artifact contract](model-v2-r1-artifact-contract.md) retain their boundaries.
Historical gate access restrictions describe their original consumption events;
the user's Increment B instruction separately authorizes the following read-only
reuse. It does not authorize another G6/G7 selection or fitting event.

Read only these existing local prepared cohort roles, with their recorded hashes:

| Role | Use | Prepared file SHA-256 |
| --- | --- | --- |
| G3 development, 2024 | In-sample diagnostic comparator only | `e56089bcd6dfce076cd41e58e708e44af4dc4281e161c6bacf4115bc9a332adb` |
| G6 frozen validation, 2024 | Primary candidate, not automatically approved | `71774e13e7b994e023253d78f8310a1374610c652644a7a87aeabe88f1c00fd7` |
| G7 prepared temporal cohort, 2023 | Same-survey-family transport comparison, never pooled | `0741896ea09257b7a2a49aa8f2afafbec6e70995324fa49f5f2b5703bdc10334` |

The runner allows only these three relative paths under the approved local data
root. Verify hashes before parsing and project only the 11 features plus
`wt_itvex`, `kstrata`, `psu`. Do not load identifiers or targets as columns.
Do not open, hash, score, inspect, or use G8 final test for any sensitivity
analysis. Do not parse original SAS files or historical prediction files.
Missing approved local data produces `HOLD — required approved local research
source unavailable`; do not download or reconstruct it.

## Frozen inference

Model SHA-256:
`d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`.
Schema: `model-v2-r1-schema-v1`; product adapter:
`model-v2-product-input-adapter-v2`. One verified existing joblib pipeline scores
all rows at full precision. Preserve exact R1 feature order, fitted imputation,
encoding/scaling, and LogisticRegression L2 / C=1 / lbfgs parameters.
Fail closed on artifact/reference identity mismatch. No fitting, OOF/CV scores,
rounding before scoring/CDFs, recalibration, thresholds, or artifact changes.

The target remains `HE_HP == 4` versus `{1,2,3}` at the survey time. An internal
output is not disease probability, future incidence, seven-day risk, or a
challenge/BP/causal effect. No labels or performance metrics are needed here.

## Estimands and subsets

For each role separately:

- Full: every eligible prepared row, including frozen imputation of missing
  predictors. Eligibility is age >=19, recognized HE_HP, ID/design present,
  positive `wt_itvex`, and exclusion of explicit current pregnancy.
- Product-complete: all 11 semantic features observed **before** imputation;
  semantic structural zero/non-applicability categories count as observed.
  This is a completeness sensitivity, not proof of representativeness or exact
  equivalence to all product entry/eligibility rules.

Compute `F(s)=sum(I(score<=s))/N` and
`Fw(s)=sum(w*I(score<=s))/sum(w)` with original `wt_itvex`. Check invariance to
constant weight rescaling. Weighting describes the selected role, not a
validated national population comparator. The PSU hash split and complete-case
selection do not recalibrate the original survey weights.

Use inverse empirical CDF quantiles `inf{s:F(s)>=q}` (no interpolation), for
both weighting policies at 1/5/10/25/50/75/90/95/99%. CDF comparisons use
right-inclusive values as the requested research point estimator. Examine exact
ties first, comparing `<`, `<=`, and their midpoint; recommend a convention only
after the data. This does not freeze a product tie policy.

## Diagnostics fixed before scoring

- N, PSU count, strata count; histogram of PSUs per stratum and singleton
  strata. Compare validation coverage to the **authorized development plus
  validation** strata union; do not consult final test or call that union the
  full national design.
- Weight sum, min/max, maximum normalized share, population weight CV (ddof=0),
  share held by the largest ceil(1% of N) weights, Kish `(sum w)^2/sum(w^2)`.
  Kish is weight concentration only, not survey degrees of freedom or clinical
  sample-size adequacy.
- Score quantiles and weighted/unweighted mean/SD. No row score list, score
  extrema list, or fitted participant predictions are published.
- Mapping disagreement in percentile points: median/p90/p95 across the same
  10,001 equally spaced scores in [0,1], plus exact supremum at the union of CDF
  jumps and their left limits. Uniform-score summaries are not user-frequency
  averages. Report a 0.01-wide score bin containing a maximum, not a participant
  score. Also report p1/p5/p95/p99 anchor differences and lower/upper tail maxima.
- Apply that comparison to weighted versus unweighted, full versus complete,
  and validation versus 2023. Report signed quantile shifts (second minus first)
  and maximum absolute weighted CDF separation; no p-values.
- Tails at weighted q1/q5/q95/q99: inclusive lower/upper support N, Kish, weight
  share, PSUs, strata, and tie/mapping sensitivity. Tails are descriptive and may
  overlap at boundaries; low Kish is not an inferential error bar.
- Exact tie groups, rows involved, maximum group multiplicity and weighted CDF
  jump (including singleton jumps); distinguish duplicate-score ties from the
  nonzero empirical jump at any observed score. Record tie-policy tail effects.
- Every numeric feature: observed min/max, weighted p1/p99, missing N/share,
  out-of-product-domain N. Every categorical feature: fixed canonical category
  counts/weight shares, absent categories and rare (<1% of subset weight)
  category weight share. Apply to full and complete separately. Marginal support
  does not establish joint-input support. Do not fit matched comparators.

2023 retains direct sleep hours times 60 with 88/99 missing, versus 2024
bed/wake derivation. Compare complete subsets descriptively without calling
the instruments equivalent or separating an instrument effect from a year effect.

## Uncertainty and decision

Separate finite-reference point estimates from survey/population uncertainty.
Inspect actual PSU/strata coverage before choosing an uncertainty method.
Ordinary iid row bootstrap is forbidden. Review stratified PSU resampling,
replicate weights and Woodruff inversion. Do not silently collapse strata,
treat a singleton PSU as certainty, import final-test PSUs, or use Kish as df.
If the retained validation design and second-phase split cannot support a
defensible variance method, publish no confidence intervals and choose HOLD.

Method references: the survey package's
[quantile/Woodruff documentation](https://r-survey.r-forge.r-project.org/pkgdown/docs/reference/svyquantile.html),
[bootstrap design documentation](https://r-survey.r-forge.r-project.org/survey/html/bootweights.html),
and [singleton PSU discussion](https://r-survey.r-forge.r-project.org/survey/exmample-lonely.html).
These explain method requirements; they do not approve this KNHANES split.

No post-hoc clinical or numerical acceptance threshold is invented. Choose one:
`PASS_REFERENCE_RESEARCH_READY_FOR_PRODUCT_REVIEW` only with defensible identity,
methodology, uncertainty and applicability; `HOLD_REFERENCE_RESEARCH` with the
smallest specific missing evidence; or `REJECT_PERCENTILE_DIRECTION` if the
observed tradeoff is unfavorable. Report magnitudes to make the judgment
contestable. PASS is never user-exposure approval.

Recommend one next product-review option: A validated percentile, B non-percentile
distribution/context, C raw-output explanation only, or D no comparison. Do not
predetermine A. A future dedicated reference needs prospectively specified
eligibility/entry instrument, representative design with usable replicate or
PSU/strata information, adequate observed complete-input and tail support,
versioned read-only freezing and independent review. Do not create it here.

## Publication, identity and validation

Only aggregate counts, diagnostics, fixed quantiles, sensitivity measures,
hashes and configuration metadata enter Git. Round published aggregates to six
decimal places only after computation; the runner never writes row-level files.
Use a closed output schema; reject extra keys and participant arrays. Keep
PSU/stratum labels in memory and publish only counts/histograms.

Record model SHA/schema, adapter version and source hashes, year/role/eligibility,
full/complete flag, weight/policy, CDF/tie/quantile conventions, analysis source
commit and code hash, UTC creation time, and an output payload SHA-256. Define
the payload hash over canonical sorted JSON excluding its own envelope hash.
Keep the file SHA separately in the result document. Reuse requires the same
identity; any model/adapter/cohort/policy change invalidates the evidence.
This research snapshot grants no production validity period. Review freshness
before any product decision; the S11 preview still expires 2026-10-17 KST.

Synthetic tests require CDFs/equal weights/ties, invalid scores and weights,
quantile monotonicity, full/complete separation, deterministic serialization,
schema leakage rejection and hash mismatch before deserialization. Actual local
integration runs twice from the committed implementation with one fixed
creation timestamp and compares aggregate bytes. No data is needed by CI.

## Understanding study design (proposal only)

After separate approval, randomize expressions A–E: (A) `참조 데이터에서의 모델
출력 위치 · 82백분위`; (B) `참조 데이터의 100개 구간 중 약 82번째 위치`;
(C) distribution plus marker without a percentile; (D) raw output plus reference
explanation; (E) no comparison. Use synthetic scenarios, identical surrounding
context, randomized order or between-person allocation, and an initial unaided
explanation before explicit probes. Ask each participant whether it means:

1. 질환일 확률이 82%라는 뜻인가?
2. 건강이 나쁜 사람 중 상위 18%라는 뜻인가?
3. 나와 같은 나이·성별 사람과 비교한 것인가?
4. 진단 결과인가?
5. 생활습관을 바꾸면 이 값이 내려간다고 보장하는가?

All five answers must be “no,” with the explanation “defined research data's
model-output position” where comparison is shown. Add “does the screen establish
any comparison?” for E, task success, confidence, and explanation in own words;
do not force an 82 interpretation onto C/D/E. Proposed acceptance: >=90% correct
on each item, >=80% correct on all five, and a prespecified one-sided 95% lower
bound >=80% for each critical misconception item. These are proposed product
comprehension criteria, not clinical validity. Agree sample size, recruitment
(including older/low-numeracy users), interval method and subgroup review before
testing; inability to demonstrate criteria is inconclusive/HOLD. No actual
participant recruitment or experiment is authorized in B.

Known applicability gaps remain visible: age 19+, pregnancy exclusion not
necessarily collected in product, measured versus self-entered height/weight,
questionnaire/wording differences, weak existing 80+ discrimination evidence,
and the 2023 sleep-instrument shift. Never claim “similar people,” age/sex/BMI
matching, national percentile, or “top x% risk.” Output .73 and position 82 do
not mean disease probability 82%. BP and challenge facts remain separate.
