# Model promotion gate

The logistic-regression baseline remains the default under the comparison policy.
No selected or serialized release artifact currently exists.

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

## Recorded validation result and current release barrier

The [approved internal validation report](model-comparison-evidence.md) records
HGB meeting the numeric relative conditions, status validation_compared_not_promoted.
The [published uncertainty report](model-uncertainty-evidence.md), merged in PR #220,
now supplies exploratory conditional intervals. Overall AP improvement is supported,
but overall AUROC/Brier difference intervals include zero. Older-age performance,
calibration underprediction, subgroup regressions and external/Korean-user validity
remain unresolved. The conditions above are unchanged; no selection/promotion is enacted.

ADR-0005's intervals are pointwise, conditional and exploratory. They do not turn
a zero-excluding interval into model selection or release approval. The
[draft model card](model-card.md), [input adapter contract](model-input-adapter-contract.md)
and [release readiness matrix](model-release-readiness.md) specify the remaining
human decisions. Quality thresholds remain undecided without responsible review;
this design was written after seeing validation results. Final model, preprocessing,
thresholds, metrics and failure actions must be fixed and separately approved before
one-time test evaluation. Test is never used for tuning or repeated selection approval.
The current API continues to return model_not_ready.
