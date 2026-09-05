"""Fixed validation-only rules; no tuning surface."""

import hashlib
import json

CONFIG = {
    "version": 1,
    "semantics_version": 2,
    "seed": 20260901,
    "calibration_bins": 10,
    "calibration_strategy": "uniform_left_closed_last_inclusive",
    "minimum_report_rows": 20,
    "pr_auc_definition": "average_precision",
    "threads": 1,
    "logistic_regression": {"max_iter": 2000, "solver": "lbfgs", "C": 1.0},
    "histogram_gradient_boosting": {
        "max_iter": 100,
        "learning_rate": 0.1,
        "max_leaf_nodes": 31,
        "min_samples_leaf": 20,
        "l2_regularization": 0.0,
        "early_stopping": False,
    },
}
MODELS = ("logistic_regression", "histogram_gradient_boosting")
GROUPS = ("sex_1", "sex_2", "sex_missing", "age_18_39", "age_40_59", "age_60_80")


def config_digest():
    return hashlib.sha256(json.dumps(CONFIG, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
