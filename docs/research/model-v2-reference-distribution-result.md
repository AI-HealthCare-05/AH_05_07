# Increment B — Model V2 reference-distribution result

Decision: **HOLD_REFERENCE_RESEARCH**.
Next product-review option: **C — raw-output explanation only**, subject to the
existing S11 preview window; this is not permission to extend numeric display.
After 2026-10-17 KST the existing non-numeric fallback still applies.

A precise position in a named finite research dataset is computable. The evidence
does **not** yet support presenting that position as a stable or applicable user
comparator. The strongest blockers are incomplete validation survey-design
coverage, unresolved split-aware variance, sparse extremes, and product-support
mismatch. Full/complete differences are measurable but smaller than weighting
and temporal differences; they alone do not justify claiming a large mismatch.

[Issue #619](https://github.com/AI-HealthCare-05/AH_05_07/issues/619) ·
[Pre-analysis contract](model-v2-reference-distribution-contract.md) ·
[Aggregate evidence](../evidence/model-v2-reference-distribution.json) ·
[Runner](../../scripts/model/analyze_model_v2_reference_distribution.py) ·
[Synthetic and opt-in local tests](../../tests/model/test_model_v2_reference_distribution.py).

## Identity and actual source access

- Canonical baseline: `95f9774059c079845eb83a68d26a50ad77c6abce` (#618).
- Branch: `research/model-v2-reference-distribution`.
- Worktree: `/Users/gom/Projects/AH_05_07-model-v2-reference-distribution`.
- Committed analysis/contract/test source: `947d4917ad2adb28d5c4a1bec162f3e94eaf6003`.
- Created: `2026-09-19T00:12:34Z` (2026-09-19 09:12:34 KST).
- Frozen artifact: `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`.
- Schema: `model-v2-r1-schema-v1`; adapter: `model-v2-product-input-adapter-v2`.
- Exact frozen joblib pipeline, full precision, one BLAS thread; no retraining,
  recalibration, thresholds, CV/OOF scores, changed preprocessing or feature order.

Actual participant-containing files read, all under the already-approved local
`/Users/gom/Projects/sk7-rnd-data/` root:

1. `model-v2-g3/knhanes-2024/development/development.parquet` (G3 development).
2. `model-v2-g3/knhanes-2024/locked-validation/validation.parquet` (G6 validation).
3. `model-v2-g7/knhanes-2023/logistic-transport-v1/external-cohort.parquet` (G7).

Only 11 semantic predictor columns plus weight/stratum/PSU were parsed. Each
approved file was byte-hashed against its previously recorded SHA before parsing;
ID and target columns were not loaded. The R1 artifact was separately verified
before deserialization. Existing G3/G7 aggregate provenance and R1 manifest were
read for the allowlist; these are metadata, not new cohort consumption events.
No raw SAS source, historical participant prediction file, new download, or G8
final-test file was opened or hashed. **G8 final test remained untouched.**
The existing stash and independent #616 work were not modified.

- Aggregate file SHA-256: `52e93da3762b6357b65d8977238c5b74d0878e78d40cb19c60659a2ff4189fe2`.
- Canonical payload SHA-256 / research snapshot identity: `91f073359507e2934dd58cea354c8acaac3fed49ede5924bba2405e2a16445ab`.

The payload hash covers sorted compact JSON excluding its own envelope hash.
It is not a deployable percentile artifact. Identity includes input/cohort hashes,
source years, contracts, full/complete flags, raw `wt_itvex` weighting policy,
CDF/tie/quantile conventions, code/product-source hashes, versions and UTC time.
Any change of model, adapter, source, eligibility, subset, or policy invalidates
reuse. There is no granted product validity period or production reference ID.

## Cohort, design and weights

Full includes missing predictors through frozen imputation. Complete requires all
11 semantic features observed before imputation, including valid structural
zeros/categories. It is not automatically more representative. PSU counts use
nested `(kstrata, psu)` identity. The following are **counts, not PSU labels**.

| Role | Subset | N | PSU | Strata | Singleton strata | Kish Neff |
| --- | --- | --- | --- | --- | --- | --- |
| Development | Full | 4157 | 134 | 26 | 3 | 3,220.821 |
| Development | Complete | 3725 | 133 | 26 | 3 | 2,893.023 |
| Validation | Full | 978 | 31 | 14 | 5 | 819.423 |
| Validation | Complete | 869 | 31 | 14 | 5 | 728.226 |
| 2023 temporal | Full | 5789 | 192 | 27 | 0 | 4,526.022 |
| 2023 temporal | Complete | 5211 | 192 | 27 | 0 | 4,083.549 |

Validation covers 14 of the 27 strata in the **authorized development + validation union**; 13 are absent. This union is not asserted to be the complete national design. Development/validation PSU overlap is zero. Validation retains the same 31 PSUs and 14 strata after complete filtering; complete-case selection does not repair design coverage. No final-test metadata was needed to calculate this union.

| Role | Subset | Sum w | Min w | Max w | Max share | CV | Top ceil(1% N) share |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Development | Full | 30,672,793.198 | 314.854 | 30,575.038 | 0.100% | 0.539 | 3.117% |
| Development | Complete | 27,729,971.691 | 314.854 | 30,575.038 | 0.110% | 0.536 | 3.084% |
| Validation | Full | 7,002,377.013 | 1,709.502 | 23,155.935 | 0.331% | 0.440 | 2.772% |
| Validation | Complete | 6,303,733.087 | 1,709.502 | 23,155.935 | 0.367% | 0.440 | 2.799% |
| 2023 temporal | Full | 43,106,055.515 | 483.761 | 30,883.429 | 0.072% | 0.528 | 3.090% |
| 2023 temporal | Complete | 39,016,318.119 | 483.761 | 30,883.429 | 0.079% | 0.525 | 3.141% |

All weights are positive finite `wt_itvex`. Constant normalization preserved every tested CDF within `1e-12`; evidence rounds aggregate values only after analysis. Weight sums are retained-role totals, **not** valid reconstructed national counts. Kish describes weight concentration, not survey df, independent observations, precision or clinical adequacy.

- Development: complete retains 89.608% of rows and 90.406% of weight.
- Validation: complete retains 88.855% of rows and 90.023% of weight.
- 2023 temporal: complete retains 90.016% of rows and 90.512% of weight.

## Quantiles and weighting sensitivity

Values are frozen internal continuous outputs, not disease probabilities.
Quantiles use `inf{s:F(s)>=q}`, without interpolation. `W` uses original survey
weights; `U` is a labeled unweighted sensitivity. No scores are rounded before
CDF evaluation. Published tables below round for readability; JSON has six decimals.

| Role | Subset | Policy | 1% | 5% | 10% | 25% | 50% | 75% | 90% | 95% | 99% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Development | Full | W | 0.006098 | 0.013922 | 0.023345 | 0.068840 | 0.228578 | 0.498987 | 0.704171 | 0.775952 | 0.875498 |
| Development | Full | U | 0.006190 | 0.015030 | 0.027745 | 0.101382 | 0.312958 | 0.579990 | 0.746527 | 0.809411 | 0.886895 |
| Development | Complete | W | 0.005623 | 0.013396 | 0.022380 | 0.064709 | 0.217840 | 0.477372 | 0.684689 | 0.772633 | 0.873927 |
| Development | Complete | U | 0.005623 | 0.014366 | 0.026653 | 0.095064 | 0.297119 | 0.557288 | 0.734543 | 0.808898 | 0.884981 |
| Validation | Full | W | 0.006406 | 0.015295 | 0.028374 | 0.083946 | 0.261764 | 0.557820 | 0.752404 | 0.807386 | 0.892319 |
| Validation | Full | U | 0.007124 | 0.016309 | 0.034556 | 0.116417 | 0.340189 | 0.625823 | 0.774205 | 0.826045 | 0.896340 |
| Validation | Complete | W | 0.006406 | 0.015351 | 0.027696 | 0.082623 | 0.254377 | 0.532246 | 0.742414 | 0.807021 | 0.893153 |
| Validation | Complete | U | 0.007124 | 0.016309 | 0.034047 | 0.111274 | 0.326666 | 0.600459 | 0.762129 | 0.825275 | 0.897574 |
| 2023 temporal | Full | W | 0.006363 | 0.013603 | 0.024865 | 0.067841 | 0.226287 | 0.490430 | 0.693668 | 0.774205 | 0.871627 |
| 2023 temporal | Full | U | 0.007068 | 0.017049 | 0.033168 | 0.104034 | 0.305742 | 0.565896 | 0.736849 | 0.797852 | 0.884307 |
| 2023 temporal | Complete | W | 0.006435 | 0.013434 | 0.023792 | 0.063838 | 0.215423 | 0.466502 | 0.676566 | 0.761897 | 0.868485 |
| 2023 temporal | Complete | U | 0.007068 | 0.016660 | 0.031844 | 0.095573 | 0.291156 | 0.546527 | 0.717540 | 0.792473 | 0.883834 |

Mapping differences below are **percentile points (pp)**. Median/p90/p95 summarize 10,001 uniformly spaced scores in [0,1], not participant frequencies or likely product traffic. Exact maxima examine CDF jumps and left limits, including jumps between grid points. Maximum-score bins are 0.01 wide; they are not risk bands. Tail maxima use the first distribution’s weighted lower/upper 5% regions.

| Role | Subset | Median pp | p90 pp | p95 pp | Max pp | Max score bin | Lower tail max | Upper tail max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Development | Full | 6.248 | 8.417 | 8.547 | 8.742 | 0.28–0.29 | 0.565 | 2.129 |
| Development | Complete | 5.984 | 8.245 | 8.360 | 8.586 | 0.28–0.29 | 0.549 | 2.244 |
| Validation | Full | 5.290 | 7.869 | 8.043 | 8.249 | 0.40–0.41 | 0.628 | 1.391 |
| Validation | Complete | 5.126 | 7.779 | 7.952 | 8.141 | 0.40–0.41 | 0.646 | 1.356 |
| 2023 temporal | Full | 6.129 | 9.149 | 9.265 | 9.394 | 0.26–0.27 | 1.354 | 1.826 |
| 2023 temporal | Complete | 5.869 | 8.926 | 9.107 | 9.230 | 0.26–0.27 | 1.261 | 1.904 |

Validation’s median output shifts from 0.340189 unweighted to 0.261764 weighted (full). A maximum 8.249 pp change makes reference interpretation materially sensitive to the weighting policy. The approved survey-weighted CDF is the more honest primary **research description of this selected role**; merely choosing weighted CDF does not establish national representativeness or approve a product reference.

## Full versus product-complete sensitivity

| Role | Median pp | p95 pp | Max pp | Max score bin | Lower tail max | Upper tail max |
| --- | --- | --- | --- | --- | --- | --- |
| Development | 1.235 | 1.607 | 1.662 | 0.44–0.45 | 0.263 | 0.210 |
| Validation | 1.101 | 1.964 | 2.095 | 0.54–0.55 | 0.166 | 0.200 |
| 2023 temporal | 1.418 | 1.660 | 1.707 | 0.25–0.26 | 0.138 | 0.637 |

| Complete minus full | q1 | q5 | q25 | q50 | q75 | q95 | q99 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Development | -0.000475 | -0.000526 | -0.004131 | -0.010739 | -0.021615 | -0.003320 | -0.001571 |
| Validation | 0.000000 | 0.000056 | -0.001324 | -0.007387 | -0.025574 | -0.000365 | 0.000833 |
| 2023 temporal | 0.000072 | -0.000169 | -0.004003 | -0.010864 | -0.023929 | -0.012308 | -0.003142 |

The 109 excluded validation rows change median mapping by 1.101 pp, p95 by 1.964 pp and maximum by 2.095 pp. The weighted q75 shifts by −0.025574. This is not zero and must be versioned with the subset policy, but it is not the largest observed sensitivity. Neither subset earns a claim of better representativeness; complete matches observed-input completeness only, and still inherits selection and eligibility differences.

## Validation versus KNHANES 2023 transport

| Subset | Median mapping pp | p95 mapping pp | Max CDF pp | q5 shift | q25 shift | q50 shift | q75 shift | q95 shift |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Full | 4.085 | 5.769 | 6.307 | -0.001692 | -0.016106 | -0.035477 | -0.067390 | -0.033180 |
| Complete | 4.225 | 5.607 | 6.230 | -0.001916 | -0.018785 | -0.038954 | -0.065745 | -0.045123 |

Shifts are **2023 minus 2024 validation**. Maximum separation occurs in output 0.57–0.58. The largest CDF separation is 0.063073 (full) and 0.062302 (complete), or 6.307/6.230 pp. Full/complete weighted median shifts are −0.035477/−0.038954. The full q75 shift is −0.067390. These are descriptive differences, not p-values or isolated temporal/instrument effects.

2023 is the same survey family with direct average sleep hours ×60 (88/99 missing), whereas 2024 uses bed/wake clock derivation. All non-sleep mappings and the exact single artifact are unchanged. Completeness does not make sleep instruments equivalent. Do not pool years, call 2023 independent-institution external validation, or promote it to reference by its larger N.

## Ties and tail support

| Role | Subset | Tie groups | Tied rows | Largest group | Max duplicate mass pp | Max right−left pp | Max right−mid pp |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Development | Full | 4 | 10 | 4 | 0.101 | 0.101 | 0.051 |
| Development | Complete | 0 | 0 | 1 | 0.000 | 0.110 | 0.055 |
| Validation | Full | 1 | 2 | 2 | 0.114 | 0.331 | 0.165 |
| Validation | Complete | 0 | 0 | 1 | 0.000 | 0.367 | 0.184 |
| 2023 temporal | Full | 4 | 10 | 3 | 0.045 | 0.072 | 0.036 |
| 2023 temporal | Complete | 0 | 0 | 1 | 0.000 | 0.079 | 0.040 |

Exact duplicate scores are rare, and absent in all complete subsets. Finite empirical jumps still exist at single observations: the validation complete maximum left/right difference is 0.367 pp, not zero. The research candidate convention is right-inclusive `<=`, with explicit sample granularity, because it matches the stated CDF and does not conceal the jump; mid-rank is not shown to solve the larger weighting/design problems. This recommendation follows tie inspection and is **not a product contract freeze**. No rounding-induced ties were created.

| Validation | Tail boundary | N | Tail Kish | PSU | Strata | Weight share | Max tie-convention pp |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Full | p01 | 8 | 6.226 | 7 | 5 | 1.127% | 0.285 |
| Full | p05 | 43 | 36.573 | 22 | 12 | 5.025% | 0.285 |
| Full | p95 | 63 | 54.963 | 26 | 14 | 5.096% | 0.137 |
| Full | p99 | 13 | 11.122 | 9 | 6 | 1.101% | 0.123 |
| Complete | p01 | 7 | 5.262 | 6 | 4 | 1.087% | 0.316 |
| Complete | p05 | 39 | 32.907 | 19 | 11 | 5.134% | 0.316 |
| Complete | p95 | 55 | 47.982 | 26 | 14 | 5.016% | 0.152 |
| Complete | p99 | 12 | 10.190 | 9 | 6 | 1.086% | 0.136 |

Tail membership is `score<=weighted q1/q5` or `score>=weighted q95/q99`; boundary inclusion explains shares slightly above 1%/5%. These are conditional weight-support diagnostics, not effective survey precision. Full/complete validation lower 1% support is only 8/7 rows across 7/6 PSUs, with Kish 6.226/5.262. Upper 1% support is 13/12 rows, Kish 11.122/10.190, across 9 PSUs. Larger development and 2023 tail support does not repair the primary validation candidate. All six candidates’ four-tail counts are in JSON.

At the validation full q1/q5/q95/q99 anchors, the following absolute differences apply. The full/complete row uses full-validation cutoffs; temporal complete cutoffs have their own separate JSON diagnostics.

| Comparison | q1 pp | q5 pp | q95 pp | q99 pp |
| --- | --- | --- | --- | --- |
| Weighted vs unweighted | 0.309 | 0.628 | 1.356 | 0.249 |
| Full vs complete | 0.040 | 0.071 | 0.087 | 0.108 |
| Validation vs 2023 full | 0.095 | 0.964 | 1.806 | 0.428 |

Small absolute tail CDF differences do not make extreme ranks precise: 0.428 pp is already substantial relative to a 1% tail. No 1/99 percentile claims should advance on this evidence. Central-only ranges, coarse positions, tail suppression or clamps remain research options; a clamp would hide unsupported extremes rather than establish validity. None is implemented.

## Product input support and applicability

The browser input/adapter was read only. Current age has no upper bound; height and weight have no upper bound (form minima 1, adapter strictly positive), giving no bounded BMI support. Walking days are integer 0–7, derived active-day walking and sleep minutes are bounded by semantic validation at 0–1440. Component/structural checks still apply. Every observed research numeric value is within these broad semantic domains; the reverse is false.

| Feature | Full missing | Full min–max | Full W p1–p99 | Complete min–max | Complete W p1–p99 |
| --- | --- | --- | --- | --- | --- |
| age_years | 0 (0.000%) | 19.000–80.000 | 19.000–80.000 | 19.000–80.000 | 19.000–80.000 |
| bmi_from_height_weight | 22 (2.250%) | 15.431–45.256 | 17.156–35.976 | 15.431–45.256 | 17.156–36.554 |
| walking_days_7d | 72 (7.362%) | 0.000–7.000 | 0.000–7.000 | 0.000–7.000 | 0.000–7.000 |
| walking_minutes_per_active_day | 72 (7.362%) | 0.000–300.000 | 0.000–180.000 | 0.000–300.000 | 0.000–180.000 |
| weekday_sleep_minutes | 41 (4.192%) | 150.000–780.000 | 240.000–600.000 | 180.000–690.000 | 240.000–600.000 |
| weekend_sleep_minutes | 40 (4.090%) | 120.000–840.000 | 240.000–660.000 | 120.000–840.000 | 270.000–660.000 |

Prepared age support stops at 80; permitted older product inputs therefore extend beyond the observed numeric support. Complete validation walking duration tops at 300 minutes, despite semantic permission to 1440. Complete weekday sleep spans 180–690 minutes; the product range is much wider. The BMI range is 15.431–45.256, not all positive values. A future comparison would need eligibility/support handling assessed before showing positions; simply obtaining an ECDF number outside support is not a justified comparison. No product guard was added.

All canonical categories are present in every role/subset, with no noncanonical values and no category below the predeclared 1% weighted-share cutoff. This does not prove abundant support: occasional smoking has only 11 validation rows, weighted share 1.529% full / 1.699% complete. Every category’s count/share, missing weight, absent-category count and rare-category weight share is in JSON. Joint feature combinations were not validated by these marginal tables. Original measured height/weight marginals were not parsed; the prepared cohort contains derived BMI, so self-entry/measurement equivalence remains unresolved.

Research includes age 19+ and excludes explicit current pregnancy; product does not necessarily collect the same exclusion information. Survey measurement, questionnaire and browser wording differ. Existing [G7 subgroup evidence](model-v2-g7-external-evaluation-result.md) reports weak 80+ discrimination (weighted AUROC 0.563719); it is carried as historical evidence, not recomputed here. No age-, sex-, BMI- or condition-matched reference was created. These gaps survive all complete-case checks.

## Survey uncertainty: explicitly withheld

No confidence interval or bootstrap uncertainty was manufactured. The finite
cohort CDF is a well-defined descriptive point estimate; uncertainty about its
population interpretation, sampling stability and product applicability is a
separate question.

Validation has 31 PSUs in 14 strata, including five non-certainty-unknown singleton
strata and thirteen strata absent from the authorized comparison union. The G3
hash split selects whole PSUs at nominal 15% probability, not a calibrated survey
subsample. Multiplying every validation weight by 1/0.15 would cancel in its CDF,
but cannot supply missing design coverage or establish a variance estimator.
Do not treat 31−14 as automatically valid inferential df, or Kish 819 as df.

- Stratified PSU bootstrap needs a defensible design and singleton treatment.
  Resampling individual rows or pooling strata by convenience would ignore the
  actual design. [Survey bootstrap documentation](https://r-survey.r-forge.r-project.org/survey/html/bootweights.html).
- Woodruff inversion is an appropriate **candidate method after** a valid
  design-based CDF variance is established; it cannot create that variance from
  the point CDF. [Survey quantile documentation](https://r-survey.r-forge.r-project.org/pkgdown/docs/reference/svyquantile.html).
- A singleton stratum cannot supply its own usual within-stratum variance;
  treating it as certainty, dropping its contribution or borrowing from other
  strata imposes assumptions not approved here.
  [Singleton PSU documentation](https://r-survey.r-forge.r-project.org/survey/exmample-lonely.html).
- A two-phase/split-aware treatment requires the original sampling and
  second-phase probabilities/design, with a justified treatment of missing
  strata and complete-case selection. No reviewed replicate-weight contract was
  available in the approved prepared inputs. This analysis does not assert that
  a valid method is mathematically impossible.
  [Two-phase survey documentation](https://r-survey.r-forge.r-project.org/survey/html/twophase.html).

2023 has 192 PSUs / 27 strata with no singleton stratum, so a reviewed standalone
survey variance analysis may be feasible. It does not resolve the validation
split's uncertainty or the sleep instrument shift. Development includes fitting
reuse and is not a substitute. No CI was computed for any candidate in B.

## Decision, alternatives and smallest missing evidence

**HOLD_REFERENCE_RESEARCH** — an executable, reproducible descriptive method is
available, but uncertainty and applicability are insufficient for product review
of a validated percentile presentation. This is not a rejection of all future
reference research, and not a threshold or model-quality decision.

| Candidate | Decision in B |
| --- | --- |
| A: development | Diagnostic comparator only; fitting reuse precludes default promotion |
| B: validation | Most honest primary research candidate with explicit raw survey weighting and subset identity; HOLD for product comparison |
| C: 2023 | Transport/stability comparison only; no pooling or default promotion |
| D: future dedicated reference | Needed if reviewed validation design/applicability cannot support the intended comparator |
| E: final test | Prohibited and unused |

The smallest next evidence is a survey-method review of the **existing authorized
validation design**, explicitly resolving phase/split variance, singleton and
missing-stratum assumptions without G8 reuse. A defensible result may still be
“this split cannot support the intended reference.” Then a dedicated future
reference needs prospectively frozen adult/pregnancy eligibility, instrument and
entry semantics aligned to the product, probability/design metadata or valid
replicates, observed complete-input and tail support, independently justified
precision criteria, and frozen artifact-only scoring. No sample size or new
cohort is invented or acquired in B.

Before any comparative display, also resolve support/eligibility handling and
same-instrument transport evidence, then run the separately approved comprehension
study proposed in the contract. Do not use a large overall N, a percentile clamp,
or absence of ties as a replacement for those missing pieces.

Recommended **option C: raw-output explanation only**, within the current
research/development preview. Option B's distribution marker still implies a
comparator and shares the unresolved problems. Option A is not supported. If raw
output cannot be understood or its preview expires, preserve the standing
non-numeric behavior; B does not extend it. No product implementation is included.

The only possible comparative meaning studied is “정의된 연구 참조 데이터에서의
frozen model output 위치.” A hypothetical output 0.73 and position 82 never means
“질환 확률 82%” or “상위 18% 위험.” No claim about similar people or national rank
is made. This is not disease-probability calibration; model output, measured BP
and challenge participation remain separate facts.

## Reproduction, sanitization and scope audit

Synthetic-only command (no research files needed):

```bash
uv run --frozen --group ai python -m pytest tests/model/test_model_v2_reference_distribution.py -q
```

Result: **30 passed, 1 local integration skipped**. Tests cover unweighted and
weighted CDFs, equal weights, constant normalization, exact ties, inverse-ECDF
quantiles, negative/zero/nonfinite weights, invalid scores, exact maxima between
grid points, full/complete separation, design counts, marginal support, deterministic
JSON, schema injection rejection, model/reference SHA mismatch, artifact mismatch
before deserialization, unapproved/final-test paths, symlink aliases, source absence,
overwrite protection and development/validation PSU overlap.

Approved local opt-in command (two full-precision runs, aggregate outputs only):

```bash
SK7_REFERENCE_DATA_ROOT=/Users/gom/Projects/sk7-rnd-data \
SK7_REFERENCE_CREATED_AT=2026-09-19T00:12:34Z \
uv run --frozen --group ai python -m pytest tests/model/test_model_v2_reference_distribution.py -q
```

Result: **31 passed**. Both aggregate artifacts are byte-identical, including
timestamp and payload hash. Local fit tripwires reject Pipeline/LogisticRegression
fitting; source-open and parquet projection guards assert the exact approved four
files (three cohorts + artifact) and 14 allowed data columns. These are local
integration assertions and source review, not an operating-system-wide access audit.
Actual execution used the existing locked Python environment (Python 3.13.14,
NumPy 2.4.1, pandas 3.0.5, scikit-learn 1.8.0, joblib 1.5.3); JSON records PyArrow
and all analysis versions. No dependency or lockfile changed.

The committed analysis can also produce a fresh aggregate output with:

```bash
uv run --frozen --group ai python -m scripts.model.analyze_model_v2_reference_distribution \
  --data-root /Users/gom/Projects/sk7-rnd-data \
  --created-at 2026-09-19T00:12:34Z \
  --output /tmp/model-v2-reference-new.json
```

Exact snapshot reproduction uses analysis commit `947d4917ad2adb28d5c4a1bec162f3e94eaf6003`;
a later commit produces a different provenance identity even with identical
statistics. The runner requires its code, contract and tests committed and rejects
existing outputs. No original consumption marker or source file is modified.

Only the aggregate JSON was copied into Git after closed-schema and payload-hash
validation. There are no ID/target columns, row features/scores/weights, PSU labels,
raw rows, participant prediction lists or binary model files in the diff. The
output schema allows only fixed aggregate fields/category sets and metadata,
rejects arrays and unexpected keys, and does not serialize arbitrary data frames.
Synthetic fixtures contain invented values only. Aggregate quantiles and feature
min/max are intentional approved summaries, not participant records.

Ruff check/format, AI-toolchain verifier/self-test and diff checks passed. Required
GitHub PR/core checks remain the merge gate; no browser/release matrix is needed
for this research-only change. Autopilot classification is protected; no automatic
merge or merge was requested. No UI, S11 runtime, API, DB, auth, deployment, product
semantics, BP/challenge joins or #616 architecture work changed. No actual user
experiment was conducted.
