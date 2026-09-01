# Model promotion gate

The logistic-regression baseline is the default artifact.

A histogram-gradient-boosting candidate may replace it only when all conditions hold on the frozen validation split:

- PR-AUC is strictly higher.
- Brier score is no worse.
- AUROC is no worse.
- The calibration report and sex/age-band subgroup report are produced for both models.
- The selected artifact metadata records the frozen split digest and feature order.

Otherwise retain the logistic-regression baseline. Test data is not used for promotion; it is evaluated once after selection.
