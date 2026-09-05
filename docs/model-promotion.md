# Model promotion gate

The logistic-regression baseline is the default artifact.

A histogram-gradient-boosting candidate may replace it only when all conditions hold on the frozen validation split:

- PR-AUC is strictly higher.
- Brier score is no worse.
- AUROC is no worse.
- The calibration report and sex/age-band subgroup report are produced for both models.
- The selected artifact metadata records the frozen split digest and feature order.

Otherwise retain the logistic-regression baseline. Test data is not used for promotion; it is evaluated once after selection.

## Pre-release comparison boundary

The fixed validation comparison rules and calibration/subgroup handling are in
[model-comparison-runbook.md](model-comparison-runbook.md), CONFIG version 1.
`candidate_meets_relative_conditions` records only the numeric conjunction above
with both reports produced. Missing required metrics yield `not_computable`.
Neither result authorizes release or proves sufficient quality. No selected
artifact is created in this comparison path; metadata, model card and promotion
review remain separate. Test is never read here, even after a relative result.

## Recorded validation result

The [approved internal validation report](model-comparison-evidence.md) records
HGB meeting the numeric relative conditions, status validation_compared_not_promoted.
Older-age AUROC, calibration underprediction, subgroup regressions and missing
uncertainty estimates remain explicit limitations. This result is not statistical
significance, sufficient quality, Korean-user validation or release suitability.
The conditions above are unchanged; no artifact selection/promotion is enacted.

The exploratory paired-bootstrap design in ADR-0005 does not modify these
relative conditions or authorize promotion when a difference interval excludes
zero. No actual uncertainty analysis is claimed by its implementation.
