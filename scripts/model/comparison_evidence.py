"""Strict recursive allowlist for shareable validation aggregates."""

import hashlib
import json
import math
import re

from scripts.model.evaluation_rules import CONFIG, GROUPS, MODELS, config_digest


def canonical_digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    ).hexdigest()


def require(condition):
    if not condition:
        raise ValueError("invalid_comparison_evidence")


def keys(value, expected):
    require(isinstance(value, dict) and set(value) == set(expected))


def count(value):
    require(type(value) is int and value >= 0)


def metric(value):
    keys(value, ("status", "reason", "value"))
    if value["status"] == "ok":
        require(
            value["reason"] is None
            and type(value["value"]) in (int, float)
            and math.isfinite(value["value"])
            and 0 <= value["value"] <= 1
        )
    else:
        require(
            value["status"] == "unavailable"
            and value["value"] is None
            and value["reason"] in ("empty_group", "empty_bin", "insufficient_rows", "single_class", "nonfinite_metric")
        )


def summary(value):
    keys(value, ("rows", "auroc", "pr_auc", "brier"))
    count(value["rows"])
    for name in ("auroc", "pr_auc", "brier"):
        metric(value[name])
        if value["rows"] < CONFIG["minimum_report_rows"]:
            require(value[name]["status"] == "unavailable")
            require(value[name]["reason"] == ("empty_group" if value["rows"] == 0 else "insufficient_rows"))


def validate_report(value):
    keys(value, ("overall", "calibration", "subgroups"))
    summary(value["overall"])
    require(isinstance(value["calibration"], list) and len(value["calibration"]) == CONFIG["calibration_bins"])
    for index, item in enumerate(value["calibration"]):
        keys(item, ("bin", "rows", "observed", "predicted"))
        require(type(item["bin"]) is int and item["bin"] == index)
        count(item["rows"])
        for name in ("observed", "predicted"):
            metric(item[name])
            if item["rows"] < CONFIG["minimum_report_rows"]:
                require(item[name]["status"] == "unavailable")
                require(item[name]["reason"] == ("empty_bin" if item["rows"] == 0 else "insufficient_rows"))
    require(sum(item["rows"] for item in value["calibration"]) == value["overall"]["rows"])
    keys(value["subgroups"], GROUPS)
    for item in value["subgroups"].values():
        summary(item)
    for groups in (GROUPS[:3], GROUPS[3:]):
        require(sum(value["subgroups"][g]["rows"] for g in groups) == value["overall"]["rows"])


def validate_evidence(value, gate, manifest, lock_digest):
    keys(
        value,
        (
            "schema_version",
            "status",
            "execution_commit",
            "provenance",
            "config",
            "config_sha256",
            "models",
            "relative_comparison",
            "test_used",
            "release_approved",
        ),
    )
    require(type(value["schema_version"]) is int and value["schema_version"] == 1)
    require(value["status"] == "validation_compared_not_promoted")
    require(re.fullmatch(r"[0-9a-f]{40}", str(value["execution_commit"])) is not None)
    require(value["test_used"] is False and value["release_approved"] is False)
    require(value["config"] == CONFIG and value["config_sha256"] == config_digest())
    provenance = value["provenance"]
    keys(
        provenance,
        (
            "gate_execution_commit",
            "gate_evidence_sha256",
            "manifest_sha256",
            "toolchain_lock_sha256",
            "split_digest",
            "metadata_sha256",
            "input_sha256",
            "features",
            "semantics_version",
        ),
    )
    require(provenance["gate_execution_commit"] == gate["repository_commit"])
    require(provenance["gate_evidence_sha256"] == canonical_digest(gate))
    for name in ("manifest_sha256", "toolchain_lock_sha256", "split_digest"):
        require(provenance[name] == gate[name])
    require(provenance["toolchain_lock_sha256"] == lock_digest)
    require(provenance["features"] == gate["features"] == manifest["candidate_predictors"])
    require(provenance["semantics_version"] == manifest["semantics_version"] == CONFIG["semantics_version"])
    require(re.fullmatch(r"[0-9a-f]{64}", str(provenance["metadata_sha256"])) is not None)
    keys(provenance["input_sha256"], ("train", "validation"))
    require(provenance["input_sha256"] == {name: gate["partition_sha256"][name] for name in ("train", "validation")})
    keys(value["models"], MODELS)
    for item in value["models"].values():
        validate_report(item)
        require(item["overall"]["rows"] == gate["row_counts"]["validation"])
    # Recompute the relative decision; this never authorizes release.
    from scripts.model.evaluate_predictions import relative_comparison

    require(value["relative_comparison"] == relative_comparison(value["models"]))
    json.dumps(value, allow_nan=False)
