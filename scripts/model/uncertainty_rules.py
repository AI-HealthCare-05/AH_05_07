"""Independent exploratory uncertainty contract; comparison CONFIG is untouched."""

from scripts.model.comparison_evidence import canonical_digest

UNCERTAINTY_CONFIG = {
    "version": 1,
    "replicates": 2000,
    "seed": 20260901,
    "rng": "PCG64",
    "resampling": "paired_rows_within_group_n_with_replacement",
    "group_rng": "reset_same_seed_per_group",
    "confidence": 0.95,
    "quantiles": [0.025, 0.975],
    "quantile_method": "linear",
    "minimum_valid_replicates": 1900,
    "minimum_report_rows": 20,
    "reproduction_atol": 1e-10,
    "reproduction_rtol": 1e-8,
    "reproduction_scope": "all_reports_and_relative_decision",
    "interpretation": "exploratory_conditional_pointwise",
}
METRICS = ("auroc", "pr_auc", "brier")


def uncertainty_digest():
    return canonical_digest(UNCERTAINTY_CONFIG)
