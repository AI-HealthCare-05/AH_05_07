# Increment B2 — survey-design uncertainty and reference coverage

Pre-analysis contract, 2026-09-19. Canonical baseline:
`e96803fbd77f59947465365634b90e66a76d247c` (merged #620).
This is a protected, research-only continuation of
[Increment B](model-v2-reference-distribution-result.md), not a new roadmap.
Scope: [Issue #623](https://github.com/AI-HealthCare-05/AH_05_07/issues/623).

## Question and preserved boundaries

Can the existing validation weighted CDF be given defensible uncertainty or
stability interpretation under the original KNHANES survey and the G3 whole-PSU
research split? Producing a CI is not a completion criterion.

Preserve B's `HOLD_REFERENCE_RESEARCH` and product option C, raw-output explanation
only under the [existing preview contract](../model-v2-product-contract.md).
No percentile exposure, runtime/UI/S11/API/DB/auth/deployment change, model fit,
recalibration, threshold, adapter change or user experiment. Preserve #618,
independent Windows #616/#621, and the existing stash.

Frozen model SHA:
`d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`;
schema `model-v2-r1-schema-v1`, adapter `model-v2-product-input-adapter-v2`.
The target is the survey-time cross-sectional state, not future disease,
severity, causal response or treatment success. No matched comparator is built.

## Sources and fail-closed reuse

Reuse B's immutable aggregate JSON and its exact model/cohort path/hash allowlist.
Read only the existing G3 development and G6 validation prepared cohorts for new
coverage/stability analysis. The G7 2023 prepared cohort may be read solely to
verify the unchanged B summaries; transport sensitivities otherwise come from B.
Project only the 11 semantic features and `wt_itvex`, `kstrata`, `psu`.
No IDs, targets, raw SAS or historical prediction lists are loaded.

**G8 final-test data must not be opened, hashed, scored, inspected or reused.**
Do not inspect its schema, footer, directory contents or any local G8 metadata.
The already committed [G3 split manifest](model-v2-g3-split-manifest.md) may be
read for its published role totals (804 rows / 27 PSUs, 192 total PSUs). These
are historical metadata, not new G8 consumption. Do not infer per-stratum
allocation, weights, features or scores from those totals. No new final-role
counts may be obtained. No new dataset download or cohort construction.

Read official methodological documents, prioritizing the existing local KDCA
Cycle 9 user guide and current official KNHANES guidance. Public methodology
documents are not participant datasets. Record version, pages, source URLs and
document hashes when local. Package manuals are implementation references, not
authority to approve an arbitrary split.

Before new statistics are accepted, verify B's aggregate file/payload hashes and
reproduce its cohort summaries with the unchanged B implementation. Compare the
six-decimal aggregate summaries, not the commit-dependent provenance envelope.
On any mismatch, stop and investigate; do not rewrite B to fit new results.

## Estimands and methodology review

Separate three questions:

1. The exact weighted empirical CDF of the frozen finite reference: descriptive,
   with no sampling CI needed to describe those particular observed rows.
2. Survey-population uncertainty: original strata/PSU/weights, eligibility/domain,
   survey weighting/calibration and the additional role split must be justified.
3. Conditional perturbation stability: sensitivity to removing one observed
   PSU is computable but is neither a probability interval nor population proof.

Review sampling versus variance strata, PSU selection, annual representation,
weight construction, Taylor/replicate guidance and subpopulation handling.
Distinguish a survey domain from the hash-assigned PSU validation role. Determine
what the authorized development+validation union can prove about singleton
origin, and what it cannot reconstruct about the full annual survey.

Method review before local analysis: the KDCA Cycle 9 guide (July 2026 revision,
local PDF SHA-256 `921818c62267bd2949dd08e7d0143ef8cd30eb3086722e696481aa162ba42ce3`,
printed pp. 3–4, 23–25, 35–37, 93) identifies `kstrata` as combined variance
strata, provides a within-stratum PSU linearization formula, and defines age 80
as 80+. [KDCA FAQ 14, 관심집단 분석](https://knhanes.kdca.go.kr/knhanes/dataAnlsGd/findDaanFaqList.json?pageNo=2)
requires retaining original design information for domain analysis. Neither
document validates the project's additional deterministic hash split. No
approved split-aware variance or singleton policy has been found, so this
implementation computes coverage and conditional deletion sensitivity only.
It provides no switch that generates a CI or silently changes lonely-PSU rules.

Implementation references (reviewed 2026-09-19):
[design and public-use approximation](https://r-survey.r-forge.r-project.org/pkgdown/docs/reference/svydesign.html),
[domain preservation](https://r-survey.r-forge.r-project.org/survey/html/subset.survey.design.html),
[lonely-PSU options](https://r-survey.r-forge.r-project.org/survey/html/svyCprod.html),
[two-phase requirements](https://r-survey.r-forge.r-project.org/pkgdown/docs/reference/twophase.html),
[survey bootstrap](https://r-survey.r-forge.r-project.org/survey/html/bootweights.html),
[replicate construction](https://r-survey.r-forge.r-project.org/pkgdown/docs/reference/as.svrepdesign.html),
and [Woodruff/quantile limitations](https://r-survey.r-forge.r-project.org/pkgdown/docs/reference/svyquantile.html).
No new R dependency is required for the non-inferential computations.

Compare linearization/influence functions, Woodruff inversion, JKn/delete-one
PSU jackknife, Rao-Wu/rescaled bootstrap, supplied replicate weights,
split-aware resampling, and non-probabilistic sensitivity. For lonely PSUs review
fail/remove/certainty/adjust/average/collapsing/domain treatment. State assumptions,
possible direction of error, and whether any numerical use is justified here.
Do not silently choose an option, collapse strata, assign certainty, use Kish as
degrees of freedom, apply iid/ordinary percentile bootstrap, or create normal
intervals. Unsupported methods receive an explicit not-estimated result.

If justified CDF variance is not established, publish no SE, CI, nominal coverage,
p-value or replicate-based quantile interval. Woodruff does not cure absent
design information. Retain a HOLD rather than equating a stability diagnostic
with survey uncertainty.

## Aggregate coverage diagnostics

For full and product-complete separately, compare validation with the authorized
development+validation union (not the national population):

- N, PSU, strata, singleton counts and PSUs-per-stratum histograms;
- validation PSU fraction and raw weight-mass fraction of that union;
- union weight mass and PSU counts in strata represented versus absent in
  validation; no per-stratum labels or weights are published;
- validation singleton strata with additional authorized development PSUs,
  their union multiplicity histogram, and validation weight mass in singletons;
- observed age support and fixed 19–29/30–39/40–49/50–59/60–69/70–79/80+ groups;
- canonical sex and other categorical marginal counts/weight shares, missingness
  and absence, with differences to the union. No matched references or pooled
  score distribution is created from development and validation.

`kstrata` absence is an analysis-design coverage issue, not proof that a specific
demographic group is wholly absent. Raw role weight sums are not population
totals; a common inverse split factor cancels from the CDF but proves no variance.

## Conditional PSU perturbation, if survey CI remains unsupported

For each validation subset, remove each distinct nested `(kstrata, psu)` once,
retain all other rows/weights, renormalize the same weighted CDF, and score only
with the exact frozen artifact. This is an exhaustive **deletion sensitivity**,
not a jackknife variance estimator or a sampling/percentile bootstrap.
It is allowed even when deleting the sole PSU removes a stratum because its
purpose is to expose that sensitivity; record that event explicitly.

Publish only aggregate summaries across deletions: number of deletions, lost
stratum count, removed weight-share range, maximum absolute CDF movement (exact
CDF jump support), and movement at fixed weighted p1/p5/p10/p50/p90/p95/p99
anchors. Aggregate weighted quantile shift ranges may be reported for the same
anchors. Publish no per-PSU/deletion/participant list or label. A removed PSU
with weight share `a` gives `F=(1-a)F_remaining+a F_removed`, hence the deterministic
bound `sup|F_remaining-F| <= a`; test this mathematical check. This bound is not
a sampling interval and does not include unseen or final-role PSUs.

Record inclusive tail support at 1/5/10/90/95/99%: rows, Kish (concentration only),
PSUs, strata and weight share. Reuse B's weighting/full-complete/temporal/tie
mapping sensitivities in a single matrix. Lonely-PSU numerical method sensitivity
is unavailable unless its design assumptions become defensible; do not fill
missing cells with zero.

## Decision and future interpretation

Compare full 1–99, 5–95, 10–90 with unavailable tails, five-point/decile bins and
no continuous percentile. None is implemented or converted into a medical risk
band. Trimming or coarsening cannot by itself repair population/design coverage.

Choose `PASS_SURVEY_UNCERTAINTY_METHOD`, `HOLD_SURVEY_UNCERTAINTY`, or
`REJECT_VALIDATION_AS_REFERENCE_FRAME` against the primary design question.
Specify the smallest missing evidence and whether validation remains only a
research candidate. If needed, describe a future frozen reference's source year,
eligibility, independence, design preservation, precision-based sample-size
planning, versioning and refresh policy without acquiring/constructing it.

Statistical readiness remains separate from user comprehension. Refine B's
proposed probes for probability, severity, peer matching, worse health and
treatment success, but recruit nobody and run no experiment.

## Tests, identity and publication

Synthetic tests must cover singleton/two-PSU/multiple-stratum structures, equal
and unequal weights, a domain-like subset, tails, deterministic perturbations,
invalid structures, inaccessible G8 paths and rejection of row material.
Local integration asserts the exact approved open/read allowlist, no fit, B
reproduction and deterministic aggregate output. No participant data is needed
in CI. Reuse B's strict aggregate schema machinery; new output has fixed keys,
fixed category/group names, finite scalar summaries and pinned identities only.

Record baseline and analysis commits, code/contract/B-evidence/source/model hashes,
runtime versions and UTC creation timestamp. Commit contract/code/tests before
actual analysis; never overwrite existing evidence. Publish only the validated
aggregate JSON and research documentation. Run targeted tests, lint/static
checks, leakage audit and autopilot guard; one research PR, no auto-merge.
