"""Verify frozen inputs before fitting. Never open the held-out test file."""

import importlib.metadata
import json
import platform
import subprocess
import tomllib
from pathlib import Path

import numpy as np
import pandas as pd

from scripts.ci.verify_model_gate_1b_contract import evidence_findings, repository_alignment_findings
from scripts.data.contract import load_manifest, outside_repository
from scripts.data.preparation import sha256, validate_keys
from scripts.model.comparison_evidence import canonical_digest

ROOT = Path(__file__).resolve().parents[2]


def git(*args):
    return subprocess.check_output(["git", "-C", str(ROOT), *args], stderr=subprocess.PIPE).decode().strip()


def environment():
    if platform.python_version() != (ROOT / ".python-version").read_text(encoding="utf-8").strip():
        raise ValueError("python_mismatch")
    locked = {p["name"]: p["version"] for p in tomllib.loads((ROOT / "uv.lock").read_text(encoding="utf-8"))["package"]}
    for name in ("pandas", "pyarrow", "scikit-learn", "joblib", "numpy", "scipy"):
        if importlib.metadata.version(name) != locked[name]:
            raise ValueError("environment_mismatch")


def validate_frame(frame, manifest, count):
    key, label = manifest["join_key"], manifest["label"]["name"]
    if list(frame.columns) != [key, *manifest["candidate_predictors"], label] or len(frame) != count:
        raise ValueError("columns_or_count_mismatch")
    validate_keys(frame, key)
    if frame[label].isna().any() or not frame[label].isin([0, 1]).all():
        raise ValueError("invalid_label")
    for name, spec in manifest["predictor_specs"].items():
        values = frame[name]
        valid = (
            values.isin([*spec["valid_values"], -1])
            if spec["kind"] == "categorical"
            else values.between(spec["minimum"], spec["maximum"])
        )
        if not valid.all() or not np.isfinite(values).all():
            raise ValueError("invalid_feature")


def load_inputs(split_dir):
    split_dir = outside_repository(split_dir)
    manifest = load_manifest()
    evidence_path = ROOT / "docs/evidence/model-gate-1b.json"
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    if evidence_findings(evidence) or repository_alignment_findings(evidence, ROOT):
        raise ValueError("gate_evidence_mismatch")
    metadata_path = outside_repository(split_dir / "split_metadata.json")
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if (
        metadata["features"] != evidence["features"]
        or metadata["semantics_version"] != manifest["semantics_version"]
        or metadata["seed"] != evidence["seed"]
        or metadata["split_digest"] != evidence["split_digest"]
        or metadata["partition_sha256"] != evidence["partition_sha256"]
        or metadata["row_counts"] != {name: evidence["row_counts"][name] for name in ("train", "validation", "test")}
    ):
        raise ValueError("metadata_mismatch")
    frames, hashes = {}, {}
    for name in ("train", "validation"):
        path = outside_repository(split_dir / f"{name}.parquet")
        hashes[name] = sha256(path)
        if hashes[name] != evidence["partition_sha256"][name]:
            raise ValueError("input_hash_mismatch")
        frames[name] = pd.read_parquet(path)
        validate_frame(frames[name], manifest, evidence["row_counts"][name])
    if set(frames["train"].SEQN) & set(frames["validation"].SEQN):
        raise ValueError("partition_overlap")
    if set(frames["train"][manifest["label"]["name"]].unique()) != {0, 1}:
        raise ValueError("single_class_train")
    fills = {
        name: -1.0 if spec["kind"] == "categorical" else float(frames["train"][name].median())
        for name, spec in manifest["predictor_specs"].items()
    }
    if metadata["fill_values"] != fills:
        raise ValueError("training_fill_mismatch")
    provenance = {
        "gate_execution_commit": evidence["repository_commit"],
        "gate_evidence_sha256": canonical_digest(evidence),
        "manifest_sha256": evidence["manifest_sha256"],
        "toolchain_lock_sha256": evidence["toolchain_lock_sha256"],
        "split_digest": evidence["split_digest"],
        "metadata_sha256": sha256(metadata_path),
        "input_sha256": hashes,
        "features": evidence["features"],
        "semantics_version": manifest["semantics_version"],
    }
    return manifest, frames, fills, provenance
