# Increment B2 — survey uncertainty and reference coverage result

Decision: **HOLD_SURVEY_UNCERTAINTY**.
Limited conditional stability analysis is defensible; a survey-population CDF or
quantile confidence interval is **not justified by the current design contract**.
No standard errors or confidence intervals were computed.

Increment B remains **HOLD_REFERENCE_RESEARCH**, with product option **C —
raw-output explanation only** under the existing S11 preview window. No percentile,
distribution marker, medical band, runtime change or extension of that window is
approved. This result completes B2 research; HOLD describes the evidence for an
inferential reference, not unfinished implementation.

[Issue #623](https://github.com/AI-HealthCare-05/AH_05_07/issues/623) ·
[Contract](model-v2-reference-uncertainty-contract.md) ·
[Aggregate evidence](../evidence/model-v2-reference-uncertainty.json) ·
[Runner](../../scripts/model/analyze_model_v2_reference_uncertainty.py) ·
[Tests](../../tests/model/test_model_v2_reference_uncertainty.py) ·
[Preserved B result](model-v2-reference-distribution-result.md).

## Principal findings

- Four of validation's five singleton variance strata have other PSUs in the
  authorized development cohort. These four singletons are demonstrably induced
  by retaining the validation role. The fifth remains singleton in the authorized
  union; its original-versus-split origin is **unresolved**, not assumed certainty.
- Development + validation has 165 PSUs / 27 variance strata, including **two
  singleton strata**. Joining authorized design records therefore does not by
  itself supply a complete, non-singleton annual design or valid domain variance.
- Validation's 13 absent variance strata contain 48 PSUs and **31.1235% of raw
  weight mass in the authorized full union** (complete: 47 PSUs / 29.5199%). These
  are union diagnostics, not an estimate of the Korean population missing from
  validation. All examined age groups and canonical categories are represented.
- Exhaustive deletion of one observed validation PSU changes the weighted CDF
  by at most **1.466537 pp full / 1.403626 pp complete**. This is an exact finite
  perturbation result, **not** a survey SE, CI, confidence band or jackknife CI.
- All B aggregate statistics reproduced at their published six-decimal precision.
  B's original files, point estimates and identities remain unchanged. G8 was
  not opened, hashed or scored.

## Identity and source access

PR #620 was verified merged at `2026-09-19T00:29:27Z`. Latest canonical main at
B2 start was `e96803fbd77f59947465365634b90e66a76d247c` (#620), incorporating #618.
New branch: `research/model-v2-reference-uncertainty`; worktree:
`/Users/gom/Projects/AH_05_07-model-v2-reference-uncertainty`.
Analysis contract/code/tests were committed before cohort analysis at
`83c25af36666824d5f1f1eeb41f813930fccb46c`. The final execution used
`21682bfbae3186516b7c6071ffdca3d5b86cac3d`, which adds only checkout-newline
portability and its regression tests. An external branch update incorporated
main `13ce50cf3502a968d525861cd88f719c15bc190f` through merge `dc5d117`; it
was preserved by fast-forward. The PR diff against main remains these five B2
files, with no change to the independent #616/#621 work.

- Analysis timestamp: `2026-09-19T01:25:53Z` (10:25:53 KST), held fixed for the
  two byte-identical integration executions.
- Frozen model SHA: `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`.
- Schema: `model-v2-r1-schema-v1`; adapter: `model-v2-product-input-adapter-v2`.
- B evidence file SHA: `52e93da3762b6357b65d8977238c5b74d0878e78d40cb19c60659a2ff4189fe2`.
- B2 evidence file SHA: `92bf83569d893f7519d2441f5e1e6c65ee1e6a2541d5f43a9ce73d00a9682ca3`.
- B2 canonical payload SHA: `051e7f9e0c1c8302f275ecf0e5c55664c9299fa39e6ecfc802fc3287c1d136b6`.

The B2 payload hash covers sorted compact JSON excluding its own envelope hash.
It also records code/contract/test/B-code/split-code/committed-manifest hashes,
the reviewed guide hash, cohort hashes and runtime versions. This is a research
snapshot, not a deployable reference. A changed model/source/design/method requires
a different identity and review; no product validity period is granted.

Actual participant-containing inputs read under `/Users/gom/Projects/sk7-rnd-data/`:

| Approved role | Relative prepared path | B2 use |
| --- | --- | --- |
| G3 development 2024 | `model-v2-g3/knhanes-2024/development/development.parquet` | Reproduce B; design and marginal support only for union comparison |
| G6 validation 2024 | `model-v2-g3/knhanes-2024/locked-validation/validation.parquet` | Reproduce B; coverage and conditional PSU deletion sensitivity |
| G7 temporal 2023 | `model-v2-g7/knhanes-2023/logistic-transport-v1/external-cohort.parquet` | Reproduce B's existing aggregate results only |

The existing R1 joblib was verified and used unchanged. Only B's 14-column
projection (11 semantic features, weight, stratum, PSU) was parsed; no ID/target
columns. Source hashes match B. No raw SAS, historical prediction file, local G8
metadata, final-test file or new participant dataset was read/downloaded.
Development scores were used only by the unchanged B reproduction; they were
not pooled into a new reference or resampled to claim held-out uncertainty.

The already committed [G3 manifest](model-v2-g3-split-manifest.md) supplies total
eligible PSUs 192 and final-role totals 27 PSUs / 804 rows. Reading these existing
repository totals is authorized metadata reuse, not new G8 access. That manifest
does **not** publish final-role per-stratum counts, weights or outcomes. B2 does
not obtain or infer them. Full validation contains 31/192 eligible annual PSUs
(16.146%) by those historical totals, not 16.146% population coverage.

## What the original KNHANES documentation establishes

Primary authority: KDCA, *국민건강영양조사 제9기(2022–2024) 원시자료 이용지침서*,
first released December 2025, **July 2026 revision**. The already approved local
PDF at `model-v2-g2/knhanes-2024/docs/국민건강영양조사+제9기(2022-2024)+원시자료+이용지침서.pdf`
has SHA-256 `921818c62267bd2949dd08e7d0143ef8cd30eb3086722e696481aa162ba42ce3`.
The official [guide catalogue](https://knhanes.kdca.go.kr/knhanes/dataAnlsGd/findUtztnGdbkDataList.json?utztnGdbkDataKnd=1&pageNo=1&pageSize=10)
lists 2024 guide record 110, modified 2026-07-31. The local guide was used;
no raw-data download or new agreement was submitted.

| Design question | Verified guidance and scope |
| --- | --- |
| Population / frame | Printed pp. 3–4: residents aged 1+, with institutional/foreign households excluded as specified; Cycle 9 uses the 2019 Population and Housing Census frame. The G3 adult/pregnancy/target-observed cohort is narrower. |
| Selection | Two-stage stratified cluster design: survey districts then households; 192 PSUs and 4,800 selected households annually, 25 households per district, eligible household members aged 1+. Explicit region/urban-rural/housing strata and implicit ordering variables are described. B2 does not invent exact PSU joint inclusion probabilities or claim that this is independent SRS. |
| Annual representation | The survey runs throughout the year using the rolling annual design. Annual representation attaches to the survey and its analysis contract, not automatically to a later 15% PSU role. |
| Weights | Printed pp. 23–25: inverse district/household selection probabilities, nonresponse adjustment, region/sex/age post-stratification, extreme-weight trimming and final adjustment. `wt_itvex` is the health-interview/examination weight used by G3. Final calibrated weights cannot simply be decomposed into all stage probabilities. |
| Variance strata | Printed p. 35: `kstrata` combines original design strata for variance estimation; `psu` is the first-stage sampling unit. The 14/27 count is not a count of age/sex cells or regions. |
| Standard variance guidance | Printed pp. 35–37 give a PSU-within-stratum linearization formula and complex-survey software examples. The public weight/stratum/PSU variables support the documented usual approximation for the intact public-use survey. Missing household/FPC/joint-probability detail is not a blanket reason to reject all ordinary KNHANES analysis. |
| Domain analysis | KDCA [FAQ 14, 관심집단 분석](https://knhanes.kdca.go.kr/knhanes/dataAnlsGd/findDaanFaqList.json?pageNo=2), dated 2013-07-22 and still published: retain the full design and use a group/domain indicator; deleting other records before constructing the design can distort SE. |
| Singleton / project split | The reviewed current guide and official analysis FAQs provide no verified rule approving a G3-like hash split or its lonely-PSU handling. This is a scoped finding, not a claim that no relevant methodology could exist elsewhere. |

The p. 35 formula was checked against the rendered PDF. For a fixed score `s`,
substituting `y_i=I(score_i<=s)` into its ratio-mean linearization gives the
candidate residual and variance:

```text
e_hj(s) = sum_i_in_PSU_hj w_i [I(score_i <= s) - Fw(s)] / sum_i w_i
Vhat(Fw(s)) = sum_h n_h/(n_h-1) * sum_j [e_hj(s)-mean_j(e_hj(s))]^2
```

This identifies the blocker; it does not validate inserting validation-only
`n_h`. For five retained strata `n_h=1`, the usual factor is undefined. Setting
those contributions to zero is an additional assumption, not an algebraic repair.
The guide's public-use approximation does not authorize changing the sampling
design after the fact. A quantile interval would additionally require justified
CDF uncertainty and inversion, with appropriate tail behavior.

## The G3 split is an additional statistical problem

The [frozen G3 contract](model-v2-g3-freeze-contract.md) and
[implementation](../../scripts/data/prepare_model_v2_g3_split.py) hash the fixed
namespace and nested `(kstrata, psu)` key. Thresholds are 0.70/0.85, with nominal
validation fraction 0.15. They neither sample a fixed number within every variance
stratum nor guarantee two retained PSUs or any retained PSU in each stratum.
No rerandomization, role reassignment or new cohort creation was performed.

The following are **B2 methodological interpretations**, not KDCA endorsements:

1. **Validation-only independent survey:** not justified by inheriting the annual
   weight alone. Constant multiplication by `1/.15` cancels in a ratio CDF; it
   does not establish a calibrated subsample or a variance estimator. A fixed
   hash may plausibly approximate outcome-blind random thinning, but that is an
   explicit model/design assumption, not a recorded random allocation experiment
   with all required inclusion/joint-probability properties already established.
2. **Domain estimation:** ordinary age/sex/eligibility domains are different from
   a research-role subsample. For a genuine fixed domain, off-domain PSU residuals
   are zero but original PSU counts/design must be retained. Recasting hash-role
   membership as a domain changes the target to that hash-defined domain and does
   not establish annual-population inference or account for split randomization.
3. **Authorized union as phase-one frame:** it is useful for proving four
   singleton origins and measuring coverage. It is itself missing 27 annual PSUs
   and still has two singleton strata. Calling it the full survey and passing it
   to a domain/two-phase function is unjustified. Adding development score outcomes
   would also mix in-sample predictions with the held-out comparator.
4. **Two-phase/compound design:** a defensible derivation might combine original
   survey uncertainty and PSU thinning while conditioning on the exact fitted
   artifact. It must specify the estimand, split law, calibration approximation,
   original-versus-retained strata, missing strata and eligibility/completeness.
   This is not solved by entering `.15` into a generic two-phase function.
5. **What can be learned without G8:** all diagnostics here and four singleton
   origins are recoverable. A domain-style calculation can in principle need
   original per-stratum PSU counts rather than off-domain outcomes, but those
   counts are not supplied by the committed G3 totals. No final-role outcomes or
   design metadata are newly accessed to complete them. A G8-free subsample
   derivation may still be possible; B2 does not claim a mathematical impossibility.
6. **What remains unknown:** original design multiplicity for the unresolved
   singleton, and an approved variance treatment of this particular retained
   PSU sample. A method requiring new G8 access remains prohibited/HOLD.

[Survey domain objects preserve original counts](https://r-survey.r-forge.r-project.org/survey/html/subset.survey.design.html).
The [two-phase implementation requirements](https://r-survey.r-forge.r-project.org/pkgdown/docs/reference/twophase.html)
also distinguish full phase-one information and stage-specific probabilities from
simple approximations. These explain why software output alone would not be
evidence of a correct target or design. Exact repeated sampling of the training
process is outside scope: the artifact stays fixed, with no refitting uncertainty.

## Coverage: validation versus the authorized union

All counts use nested PSU identity. Full preserves frozen imputation; complete
requires observed values for all 11 semantic inputs before imputation.

| Frame | Subset | N | PSUs | Variance strata | Singleton strata | Sum of raw weights |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Development | Full | 4,157 | 134 | 26 | 3 | 30,672,793.198 |
| Validation | Full | 978 | 31 | 14 | 5 | 7,002,377.013 |
| Authorized union | Full | 5,135 | 165 | 27 | 2 | 37,675,170.212 |
| Development | Complete | 3,725 | 133 | 26 | 3 | 27,729,971.691 |
| Validation | Complete | 869 | 31 | 14 | 5 | 6,303,733.087 |
| Authorized union | Complete | 4,594 | 164 | 27 | 2 | 34,033,704.778 |

| Coverage diagnostic | Full | Complete |
| --- | ---: | ---: |
| Validation share of authorized PSU count | 18.788% | 18.902% |
| Validation share of authorized raw weight mass | 18.586% | 18.522% |
| Union variance strata absent in validation | 13 | 13 |
| Union PSUs in those absent strata | 48 | 47 |
| Union raw weight mass in those absent strata | 31.124% | 29.520% |
| Validation weight mass in its singleton strata | 12.740% | 11.845% |
| Validation singletons demonstrably split-induced | 4 of 5 | 4 of 5 |
| Validation singleton origin unresolved | 1 of 5 | 1 of 5 |

The union's PSU multiplicities at the five validation singleton strata are one
stratum with 1, one with 3, and three with at least 5 authorized PSUs. No labels
or per-stratum weights were published. Full validation's own multiplicity
histogram is five strata with 1, five with 2, three with 3 and one with >=5 PSUs.
The complete subset has the same histogram. No `31-14` or Kish value is used as
automatically valid survey degrees of freedom.

An absent `kstrata` indicates absent sampled-design coverage, not necessarily an
absent demographic category. These raw union weight fractions are neither
population noncoverage estimates nor proposed calibration factors. No weights
were changed and no synthetic observations were added.

### Age and category support

Every fixed age group and every canonical categorical value occurs in validation
and the union. Equal category presence does not imply equal composition or joint
support. The evidence includes all marginal counts, missingness and weight shares.

| Age group | Full validation N / weighted % | Full union weighted % | Complete validation N / weighted % | Complete union weighted % |
| --- | ---: | ---: | ---: | ---: |
| 19–29 | 104 / 13.109 | 15.227 | 99 / 13.757 | 15.886 |
| 30–39 | 105 / 14.676 | 15.688 | 93 / 14.873 | 16.047 |
| 40–49 | 147 / 17.503 | 17.994 | 134 / 17.674 | 18.128 |
| 50–59 | 190 / 20.863 | 19.736 | 173 / 21.323 | 19.948 |
| 60–69 | 190 / 16.649 | 17.112 | 180 / 17.522 | 17.216 |
| 70–79 | 168 / 11.615 | 9.507 | 143 / 10.915 | 9.243 |
| 80+ (top-coded) | 74 / 5.587 | 4.736 | 47 / 3.936 | 3.532 |

Male/female validation counts are 423/555 full, 378/491 complete; male weight
shares are 49.243% / 49.784%, versus union 50.293% / 50.865%. Maximum absolute
validation-versus-union category-share differences are:

| Feature | Full pp | Complete pp |
| --- | ---: | ---: |
| Sex | 1.050 | 1.081 |
| Cigarette smoking | 0.812 | 0.954 |
| Alcohol frequency | 1.437 | 1.613 |
| Alcohol amount | 2.445 | 2.851 |
| Strength days | 4.293 | 3.823 |

**Clarification of B's age-support interpretation:** the July 2026 guide's printed
p. 93 explicitly codes `age=80` as **80 years and older**, consistent with its
privacy top-coding notice. B's numerical observed maximum of 80 remains correct;
it is not proof that adults older than 80 are absent. The product accepts exact
ages above 80 while the prepared research feature compresses them to 80, so a
coding/support mismatch remains. B2 changes no adapter or frozen feature. The
historical weak 80+ discrimination evidence and the other B applicability gaps
(pregnancy eligibility, self-entry/measurement, wording, sleep instrument) remain.

## Candidate uncertainty methods and lonely-PSU choices

For all rows below, the weighted finite CDF point estimate is unchanged.
Numerical method sensitivity is **not estimated**, rather than set to zero.

| Method | Required design/assumption | B2 disposition |
| --- | --- | --- |
| Taylor / influence function at fixed score | Correct survey/subsample variance design; PSU residuals within valid variance strata; declared treatment of calibration and domains | Plausible starting method, but validation-only within-stratum variance has five singular terms and the split design is unresolved; no SE calculated |
| Woodruff-type quantile interval | Defensible pointwise CDF/proportion uncertainty and its inversion through the fixed quantile convention | Candidate only after CDF variance is justified; cannot supply missing variance; not a simultaneous CDF confidence band |
| Delete-one PSU JKn | Valid stratum replicate factors and design; at least two resampleable PSUs or an independently justified repair | Not run as variance. Direct jackknife variance of nonsmooth sample quantiles is not generally valid; CDF-based inversion would still need the design |
| Rao-Wu / rescaled bootstrap | Justified original sampling approximation, within-stratum PSU resampling and scaling, split/calibration/domain handling | Singletons cannot provide within-stratum resampling variation. Standard package recipes are not universal PPS/multistage fixes; not run |
| Supplied replicate-weight design | Valid replicate weights, scaling factors, construction and eligibility/domain/split contract | No such contract in the approved prepared inputs. Manufacturing replicates with defaults is not equivalent |
| Split-aware resampling | Explicit randomization/compound-design estimand, phase probabilities and fixed-artifact conditioning | No recorded randomized split law or approved compound variance derivation. Rehashing only dev+validation would simulate a different incomplete frame and include training reuse |
| Exhaustive observed-PSU deletion | Only the finite observed weighted dataset, at least two PSUs, no probabilistic interpretation | Implemented as conditional sensitivity, not an SE, CI, or sampling-coverage guarantee |

The [Woodruff/quantile reference](https://r-survey.r-forge.r-project.org/pkgdown/docs/reference/svyquantile.html)
explicitly distinguishes CDF inversion from direct replicate quantile intervals
and warns against the latter with jackknife replicates.
[Replicate construction](https://r-survey.r-forge.r-project.org/pkgdown/docs/reference/as.svrepdesign.html)
and [survey bootstrap requirements](https://r-survey.r-forge.r-project.org/survey/html/bootweights.html)
are implementation guidance, not approval of this retained design.

| Lonely-PSU option | Assumption and possible direction | Appropriate here? |
| --- | --- | --- |
| Fail | Declines unidentified within-stratum contribution | Yes, for inference; explicit HOLD instead of an interval |
| Remove | Sets that stratum's variance contribution to zero; can understate uncertainty | No default use; it also does not restore absent strata |
| Certainty | Requires a genuinely self-representing PSU/design justification; stage-specific zero is not proof of zero lower-stage variance | No such evidence; four cases have other authorized PSUs, and the fifth is unknown |
| Adjust | Centers lonely contribution at the overall mean; conventionally conservative in the supported setting | Could be a labeled future sensitivity after design approval; not guaranteed conservative for this compound split or missing strata |
| Average | Borrows variance from replicated strata; needs defensible exchangeability/missing-PSU assumptions | Can over- or understate the relevant contribution; no validation here |
| Collapse strata | Requires a substantively justified, predeclared variance-stratum pairing | Direction is design-dependent; do not infer similarity from opaque codes or pick a collapse to obtain a desired interval |
| Domain-aware handling | Retains original PSU counts and zero off-domain contributions | Correct for a justified domain estimand with original design; the authorized union and G3 role do not automatically supply it |
| Replicate-based handling | Encodes a justified lonely-stratum policy in replicate construction | Moves the choice into weights; does not eliminate the assumption |

These options and their limitations are documented in the
[survey variance reference](https://r-survey.r-forge.r-project.org/survey/html/svyCprod.html).
No library lonely-PSU option was silently selected. In particular, numerical
`adjust` versus `average` intervals were withheld because producing two unjustified
intervals would not resolve the missing design. Their CDF point estimates would
be identical; their unvalidated uncertainty widths could differ.

## Conditional deletion sensitivity and tails

Each of the 31 observed validation PSUs was removed once, separately for full and
complete. Retained original weights were renormalized; five deletions remove an
entire retained stratum. These events are recorded, not silently discarded.
No replacement PSU was imported from development or final test.

For removed normalized mass `a`, `F=(1-a)F_remaining+a F_removed`, so
`sup|F_remaining-F|<=a`. Every deletion satisfied this deterministic bound. All
original score jumps were evaluated at full precision; no browser rounding.

| Diagnostic | Full | Complete |
| --- | ---: | ---: |
| Deleted weight-share range | 1.347–5.742% | 1.043–6.036% |
| Median of the 31 maximum CDF changes | 0.623 pp | 0.648 pp |
| Maximum CDF change across all deletions | 1.467 pp | 1.404 pp |
| Deletions losing a stratum | 5 | 5 |

The median above is over 31 deletions, unlike B's median over a uniform score
grid. The following changes are evaluated at the **original weighted quantile**,
not a newly chosen user score. Empirical boundary inclusion can put its baseline
CDF slightly above the nominal quantile.

| Original anchor | Full max absolute CDF movement pp | Complete max movement pp | Complete quantile shift range |
| --- | ---: | ---: | --- |
| p01 | 0.257 | 0.291 | 0.000000 to +0.000279 |
| p05 | 0.349 | 0.389 | -0.000121 to +0.000457 |
| p10 | 0.516 | 0.454 | -0.001521 to +0.000754 |
| p50 | 1.167 | 1.039 | -0.015170 to +0.004373 |
| p90 | 0.843 | 0.754 | -0.003365 to +0.007924 |
| p95 | 0.575 | 0.552 | -0.009175 to +0.003359 |
| p99 | 0.191 | 0.206 | -0.010070 to +0.001221 |

These ranges are extrema of deliberate deletions, **not uncertainty intervals**.
They do not account for unseen PSUs, absent strata, repeated survey selection,
complete-case selection bias, model fitting or temporal/instrument change.
Even 0.291 pp is substantial relative to a nominal 1% lower tail; it is not a
claim of a 29.1% statistical error rate.

| Tail | Full rows / PSUs / strata / Kish | Complete rows / PSUs / strata / Kish |
| --- | --- | --- |
| <= q1 | 8 / 7 / 5 / 6.226 | **7 / 6 / 4 / 5.262** |
| <= q5 | 43 / 22 / 12 / 36.573 | 39 / 19 / 11 / 32.907 |
| <= q10 | 84 / 28 / 12 / 73.934 | 75 / 27 / 12 / 66.000 |
| >= q90 | 124 / 28 / 14 / 109.622 | 111 / 29 / 14 / 97.427 |
| >= q95 | 63 / 26 / 14 / 54.963 | 55 / 26 / 14 / 47.982 |
| >= q99 | 13 / 9 / 6 / 11.122 | **12 / 9 / 6 / 10.190** |

Tail Kish is weight concentration, not independent support or design df. Tail
PSU counts do not repair the original strata or establish interval precision.

## Sensitivity matrix and presentation alternatives

The first five comparisons reuse verified B aggregates. They are separate
perturbations, not additive errors or components of a CI.

| Mapping sensitivity | Full maximum pp | Complete maximum pp |
| --- | ---: | ---: |
| Weighted versus unweighted | **8.249** | **8.141** |
| Full versus complete | **2.095** | **2.095** (same comparison) |
| Validation versus 2023 temporal | **6.307** | **6.230** |
| Left versus right CDF convention | 0.331 | 0.367 |
| Mid-rank versus right | 0.165 | 0.184 |
| One observed PSU deletion | 1.467 | 1.404 |
| Candidate lonely-method interval width difference | Not estimated | Not estimated |

2023 remains a same-survey-family temporal comparison with a different sleep
instrument. It is neither pooled nor promoted to an independent-source reference.
Small duplicate-tie effects or small single-PSU deletion effects cannot cancel
the larger weighting/transport sensitivities or design limitations.

| Tail policy candidate | Statistical support / stability | Understanding and explainability | B2 position |
| --- | --- | --- | --- |
| A: continuous 1–99 | 1% extremes have only 7/12 complete rows; no justified CI | Strong false-precision and severity/probability interpretations | Do not advance on this frame |
| B: continuous 5–95 | More tail rows/PSUs, but unchanged split/coverage and transport problems | Simpler unavailable tails; central precision still implied | Research candidate only after design resolution |
| C: continuous 10–90, unavailable tails | More observed support (75/111 complete rows in corresponding tails); still no sampling precision proof | “End of reference range” must not imply health severity | Could be considered later, not approved now |
| D: five-point / decile positions | Coarsening removes digits, not sampling problems; 8.141 pp weighting sensitivity exceeds a five-point width, and decile boundaries can still change classification | Easily mistaken for medical risk bands; numerical group definitions must stay descriptive | No medical band; cannot solve current HOLD |
| E: no continuous percentile | Makes no unsupported rank-precision claim | Raw-output explanation still needs comprehension and preview-expiry discipline | Recommended now; corresponds to B product option C |

No clamp, central cutoff or rounding rule was selected for production. A marker
without a percentile still implies a comparator and needs applicability review.

## Smallest next evidence and reference-frame decision

**Validation may remain a named finite research comparator, but is not yet an
approved inferential or product reference frame.** B2 does not reject it solely
because 13 variance strata are absent: outcome-blind PSU thinning could have a
defensible compound-design treatment under explicit assumptions. The current
evidence has not established that treatment, and the authorized union does not
repair it. Therefore HOLD is more precise than a universal structural rejection.

The smallest next evidence is a **specific G8-free variance derivation/review**:

1. State whether the estimand is the frozen finite reference, an annual eligible
   population CDF conditional on the frozen model, or a split-randomization
   quantity. Define the split law and any approximation to the annual calibrated
   survey; justify the estimator and its behavior with retained zero/singleton
   strata, rather than only selecting a software option.
2. Establish whether the approved variables suffice for that derivation. If it
   instead requires the original per-variance-stratum PSU frame, identify an
   **already authorized, non-G8 source** of that design information and clarify
   the unresolved singleton. The current committed totals do not suffice; this
   is not authorization to generate new G8 aggregate metadata.
3. Check the proposed estimator on a fully specified synthetic survey/split with
   known truth and prespecified coverage/precision criteria before applying it.
   A method requiring G8 rows or new G8-derived metadata is not an available route.

Continue percentile **methodology** research only through that question or a
dedicated reference design. Do not continue toward percentile UI or produce
additional decimal places from the current point CDF. Human comprehension,
eligibility/support and temporal comparability remain separate gates even if a
variance method later passes.

### Dedicated frozen reference alternative (not constructed)

If the current split cannot be defended without G8, use an independently approved
reference rather than weakening the final-test boundary:

| Design field | Required definition before construction |
| --- | --- |
| Source year | One later annual KNHANES release `Y > 2024`; 2025 is only a candidate subject to documented 11-feature/instrument compatibility and source approval. No year is silently pooled or acquired here. |
| Cohort | Prospectively freeze adult/pregnancy/eligibility semantics and full/complete definitions, aligned with intended product input; preserve all annual design records needed for domain variance under an approved access contract. |
| Training and test independence | No fitting or selection on the reference; use only the exact frozen artifact. No G3 development outcomes as reference substitutes and no G8 participation or reuse. Distinguish same-survey temporal independence from independent-institution validation. |
| Survey design | Retain annual strata/PSU structure and justified weights/replicates; avoid arbitrary role thinning. Predefine domains and lonely-stratum handling with the survey designer. |
| Sample size | Start from all eligible records in the approved annual frame; determine adequacy from prespecified CDF/quantile precision at central and tail positions plus PSU/stratum/domain support. No fixed N is justified yet; obtain a design-based precision calculation/simulation. Do not choose N from SRS or Kish alone. If annual support fails, suppress the claim or prospectively redesign rather than post-hoc pooling. |
| Versioning | Bind source/year/eligibility, model SHA/schema/adapter, design/weight/replicate and CDF/quantile rules, code commit, timestamps and aggregate hashes. A model change invalidates reuse. |
| Refresh | Annual review when a new release becomes available, with instrument/transport/precision and comprehension checks before a separately approved new frozen version. No automatic replacement or extension of the current S11 preview. |

## Comprehension remains independent of statistics

No user study was run. Retain B's five presentation arms (named percentile,
100-position explanation, distribution marker, raw explanation, no comparison)
and its proposed prespecified acceptance criteria. Improve the probe design with
an unaided explanation first, then neutral true/false/unsure items and a reason:

- Does 82 mean an 82% chance of disease? Does it measure disease severity?
- Is this an age/sex-matched peer comparison? Is the higher-position person
  necessarily in worse overall health? Is the result a diagnosis?
- If the position falls after a habit change, does that establish treatment or
  challenge success? What additional observations would be needed?

Use synthetic paired scenarios: identical raw output with a different named
reference; different positions with the same measured BP; and a falling position
without any claim about causal change. Check that users distinguish larger model
output from health severity and reference-version movement from improvement.
“Unsure” does not count as correct comprehension. Do not force a percentile
interpretation onto the no-comparison arm.

Retain the proposed >=90% correct per critical item, >=80% all-item understanding,
and prespecified one-sided 95% lower bound >=80% on critical items as **proposed
study criteria**, not evidence achieved. Agree sample size, interval method,
arm comparisons and older/low-numeracy subgroup review before recruitment.
A statistical PASS would not be a user-facing PASS.

## Verification, sanitization and scope

Synthetic B+B2 verification: **62 passed, 2 opt-in tests skipped**. B2 with approved
local inputs: **33 passed**. Final timestamped integration executed twice with
identical aggregate bytes and reproduced every B cohort/comparison/coverage
statistic; provenance envelopes correctly remain distinct between B and B2.
The initial Windows CI exposed Git's CRLF conversion of B's otherwise unchanged
JSON. B2 now verifies the pinned LF bytes after only CRLF-to-LF conversion in
memory, then verifies the unchanged payload hash; other byte changes still fail.
Regression tests cover CRLF acceptance without rewriting B and binary LF output
whose returned hash matches the actual file. The new execution's entire
non-identity payload equals the prior B2 result; no statistical value changed.

```bash
uv run --frozen --group ai python -m pytest \
  tests/model/test_model_v2_reference_uncertainty.py \
  tests/model/test_model_v2_reference_distribution.py -q

SK7_REFERENCE_DATA_ROOT=/Users/gom/Projects/sk7-rnd-data \
SK7_REFERENCE_CREATED_AT=2026-09-19T01:25:53Z \
uv run --frozen --group ai python -m pytest \
  tests/model/test_model_v2_reference_uncertainty.py -q
```

Exact snapshot reproduction uses source commit
`21682bfbae3186516b7c6071ffdca3d5b86cac3d`; a later source commit changes provenance.
Use a fresh output path. The existing locked environment supplied Python 3.13.14,
NumPy 2.4.1, pandas 3.0.5, scikit-learn 1.8.0 and joblib 1.5.3; JSON records all
versions. No new package or lockfile change.

Tests cover two-PSU and singleton strata, nested PSU labels, multiple strata,
equal/unequal weights and rescaling, domain-like deletion, boundary/tied tails,
determinism, the mixture bound, invalid structures, full/complete separation,
unresolved singleton origins, role overlap, B mismatch, artifact identity,
no overwrite and publication-schema injection. G8 paths fail **before filesystem
resolution/open** in synthetic tests. Local integration guards assert the exact
three approved cohort files plus artifact, read-only modes, permitted columns
and no fitting. These are code/test-level access assertions, not an OS-wide audit.

Only aggregate JSON was copied into Git after closed-schema/payload-hash checks.
No row scores/features/weights/IDs, raw rows, PSU/stratum labels, per-deletion
lists, fitted model, CI/SE arrays or participant prediction files are published.
The only final-role numbers are the two existing committed G3 totals. No source
or consumption marker was modified. B's five files are byte-unchanged.

Ruff check/format, AI-toolchain verifier self-test and diff checks passed. Required
PR `lint`/`test` remain the merge gate. This protected research change is published
for review with **no auto-merge**. No UI/S11/API/DB/auth/deployment, model/adapter,
BP/challenge joining, or independent #616/#621 work is changed. The existing stash
remains untouched.
