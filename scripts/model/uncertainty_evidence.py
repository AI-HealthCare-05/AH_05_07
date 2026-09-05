"""Structure/arithmetic verifier; does not reconstruct private bootstrap samples."""

import json
import math
import re

from scripts.model.comparison_evidence import canonical_digest, keys, require
from scripts.model.evaluation_rules import GROUPS
from scripts.model.paired_bootstrap import difference_point
from scripts.model.uncertainty_rules import METRICS, uncertainty_digest
from scripts.model.uncertainty_rules import UNCERTAINTY_CONFIG as RULES


def same_result(actual, expected):
    """Fixed reproduction scope: complete model reports and relative result."""
    if isinstance(expected, dict):
        require(isinstance(actual, dict) and actual.keys() == expected.keys())
        for key in expected:
            same_result(actual[key], expected[key])
    elif isinstance(expected, list):
        require(isinstance(actual, list) and len(actual) == len(expected))
        for left, right in zip(actual, expected, strict=True):
            same_result(left, right)
    elif type(expected) is float:
        require(
            type(actual) in (int, float)
            and math.isfinite(actual)
            and abs(actual - expected) <= RULES["reproduction_atol"] + RULES["reproduction_rtol"] * abs(expected)
        )
    else:
        require(type(actual) is type(expected) and actual == expected)


def checked_count(value):
    require(type(value) is int and value >= 0)


def bounds(value, low):
    require(isinstance(value, list) and len(value) == 2)
    require(all(type(x) in (int, float) and math.isfinite(x) and low <= x <= 1 for x in value))
    require(value[0] <= value[1])


def validate_interval(item, point, rows, attempted, metric_name):
    keys(item, ("status", "reason", "valid_replicates", "invalid_replicates", "lr", "hgb", "difference"))
    valid, invalid = item["valid_replicates"], item["invalid_replicates"]
    checked_count(valid)
    checked_count(invalid)
    require(valid + invalid == attempted)
    if rows < RULES["minimum_report_rows"]:
        reason = "empty_group" if rows == 0 else "insufficient_rows"
    elif point["difference"]["status"] != "ok":
        reason = point["difference"]["reason"]
        if reason == "single_class":
            require(metric_name in ("auroc", "pr_auc") and valid == 0)
    elif valid < RULES["minimum_valid_replicates"]:
        reason = "insufficient_valid_replicates"
    else:
        reason = None
    # With finite [0,1] inputs, every Brier resample is computable.
    if metric_name == "brier":
        require(valid == attempted and invalid == 0)
    require(item["status"] == ("ok" if reason is None else "unavailable") and item["reason"] == reason)
    for name in ("lr", "hgb", "difference"):
        if reason is not None:
            require(item[name] is None)
        else:
            bounds(item[name], -1 if name == "difference" else 0)


def validate_group(value, references):
    keys(value, ("rows", "attempted_replicates", "metrics"))
    n = value["rows"]
    checked_count(n)
    checked_count(value["attempted_replicates"])
    require(n == references[0]["rows"] == references[1]["rows"])
    require(value["attempted_replicates"] == (0 if n < RULES["minimum_report_rows"] else RULES["replicates"]))
    keys(value["metrics"], METRICS)
    counts = []
    for name in METRICS:
        item = value["metrics"][name]
        keys(item, ("point", "interval"))
        keys(item["point"], ("lr", "hgb", "difference"))
        expected = {"lr": references[0][name], "hgb": references[1][name]}
        expected["difference"] = difference_point(expected["lr"], expected["hgb"])
        same_result(item["point"], expected)
        # Also enforce arithmetic against the actual (tolerance-checked) model points.
        same_result(item["point"]["difference"], difference_point(item["point"]["lr"], item["point"]["hgb"]))
        validate_interval(item["interval"], item["point"], n, value["attempted_replicates"], name)
        counts.append(item["interval"]["valid_replicates"])
    require(counts[0] == counts[1])


def validate_uncertainty(value, reference):
    keys(
        value,
        (
            "schema_version",
            "status",
            "original_comparison_sha256",
            "original_execution_commit",
            "execution_commit",
            "provenance",
            "comparison_config_sha256",
            "uncertainty_config",
            "uncertainty_config_sha256",
            "reproduction",
            "groups",
            "test_used",
            "release_approved",
        ),
    )
    require(type(value["schema_version"]) is int and value["schema_version"] == 1)
    require(value["status"] == "exploratory_uncertainty_not_promoted")
    require(value["original_comparison_sha256"] == canonical_digest(reference))
    require(value["original_execution_commit"] == reference["execution_commit"])
    require(re.fullmatch(r"[0-9a-f]{40}", str(value["execution_commit"])) is not None)
    require(value["provenance"] == reference["provenance"])
    require(value["comparison_config_sha256"] == reference["config_sha256"])
    require(canonical_digest(value["uncertainty_config"]) == uncertainty_digest())
    require(value["uncertainty_config_sha256"] == uncertainty_digest())
    require(value["reproduction"] == {"status": "passed", "scope": RULES["reproduction_scope"]})
    require(value["test_used"] is False and value["release_approved"] is False)
    keys(value["groups"], ("overall", *GROUPS))
    for group, item in value["groups"].items():
        reports = [reference["models"][name] for name in ("logistic_regression", "histogram_gradient_boosting")]
        references = [r["overall"] if group == "overall" else r["subgroups"][group] for r in reports]
        validate_group(item, references)
    json.dumps(value, allow_nan=False)
