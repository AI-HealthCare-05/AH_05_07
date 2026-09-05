"""Dependency-free source contract shared by data commands and CI."""

import json
import math
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "data/manifest/nhanes_2017_2020.json"


def load_manifest() -> dict[str, Any]:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    validate_manifest(manifest)
    return manifest


def validate_manifest(manifest: dict[str, Any]) -> None:
    features = manifest["candidate_predictors"]
    modules = manifest["module_columns"]
    prohibited = manifest["label"]["prohibited_predictors"]
    declared = [column for module, columns in modules.items() if module != "blood_pressure" for column in columns]
    valid = (
        manifest["join_key"] == "SEQN"
        and manifest.get("semantics_version") == 2
        and len(features) == len(set(features))
        and set(features) == set(declared) == set(manifest["predictor_specs"])
        and set(manifest["files"]) == set(modules)
        and set(modules["blood_pressure"]) == set(prohibited)
        and not set(features) & {*prohibited, "SEQN", manifest["label"]["name"]}
        and manifest["status"] == "schema_audit_required_before_training"
    )
    if not valid:
        raise ValueError("manifest feature, source, or leakage contract is invalid")
    ratios = [manifest["split"][name] for name in ("train", "validation", "test")]
    if not all(isinstance(x, (int, float)) and not isinstance(x, bool) and 0 < x < 1 for x in ratios):
        raise ValueError("split ratios must be positive fractions")
    if not math.isclose(sum(ratios), 1, abs_tol=1e-12):
        raise ValueError("split ratios must sum to one")
    if manifest["population"]["minimum_age"] != 18 or manifest["population"]["maximum_coded_age"] != 80:
        raise ValueError("population policy requires a reviewed semantics revision")
    if manifest["preprocessing"] != {
        "continuous_missing": "train_median_fail_if_all_missing",
        "categorical_missing": -1,
        "categorical_encoding": "one_hot_in_model_pipeline",
        "split_input_order": "SEQN_ascending",
    }:
        raise ValueError("unsupported preprocessing policy")
    if manifest["label"]["missing_policy"] != "require_at_least_one_positive_finite_reading_in_each_component":
        raise ValueError("unsupported label missing policy")
    for spec in manifest["predictor_specs"].values():
        if spec["kind"] not in {"continuous", "categorical"}:
            raise ValueError("unknown predictor kind")
        if spec["kind"] == "categorical" and set(spec["valid_values"]) & {*spec["missing_codes"], -1}:
            raise ValueError("categorical values overlap missing codes")


def outside_repository(path: Path) -> Path:
    resolved = path.resolve()
    if resolved == ROOT or ROOT in resolved.parents:
        raise ValueError("data paths must be outside the Git repository")
    return resolved
