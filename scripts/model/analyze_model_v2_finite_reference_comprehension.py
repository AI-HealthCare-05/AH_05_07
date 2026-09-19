#!/usr/bin/env python3
"""B3: finite-reference comparator & comprehension research.

Build an aggregate lookup from the G6 validation product-complete subset only.
No SE/CI, survey replicates, fitting, row output or G8 access. See the contract.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import datetime
from pathlib import Path

import numpy as np
from threadpoolctl import threadpool_limits

from scripts.model import analyze_model_v2_reference_distribution as b

REPO = Path(__file__).resolve().parents[2]
SCRIPT = "scripts/model/analyze_model_v2_finite_reference_comprehension.py"
TEST = "tests/model/test_model_v2_finite_reference_comprehension.py"
CONTRACT = "docs/research/model-v2-finite-reference-comprehension-contract.md"
B_EVIDENCE = "docs/evidence/model-v2-reference-distribution.json"
B_FILE_SHA = "52e93da3762b6357b65d8977238c5b74d0878e78d40cb19c60659a2ff4189fe2"
B_PAYLOAD_SHA = "91f073359507e2934dd58cea354c8acaac3fed49ede5924bba2405e2a16445ab"
BASELINE = "8381743932c4353b2c7d2d207cdc9659b94fbf67"

# Right-inclusive empirical CDF percentiles to publish.
PERCENTILES = {f"p{p:02d}": p / 100 for p in range(1, 100)}

# Synthetic example percentiles for the comprehension prototype.
EXAMPLE_PERCENTILES = (10, 25, 50, 75, 82, 90)


def read_b_evidence():
    path = REPO / B_EVIDENCE
    raw = path.read_bytes().replace(b"\r\n", b"\n")
    if hashlib.sha256(raw).hexdigest() != B_FILE_SHA:
        raise ValueError("B evidence file mismatch; stop and investigate")
    envelope = json.loads(raw)
    payload = envelope["payload"]
    if envelope["payload_sha256"] != B_PAYLOAD_SHA or hashlib.sha256(b.canonical(payload)).hexdigest() != B_PAYLOAD_SHA:
        raise ValueError("B evidence payload mismatch")
    b.validate_tree(payload, b.aggregate_schema())
    if payload["identity"]["model_sha256"] != b.EXPECTED_ARTIFACT_SHA256:
        raise ValueError("reference/model SHA mismatch")
    # Verify the known product-complete validation N from B.
    n_complete = payload["cohorts"]["validation_2024"]["subsets"]["product_complete"]["weights"]["n"]
    if n_complete != 869:
        raise ValueError(f"unexpected complete validation N: {n_complete}")
    return payload


def finite_position(values, weights=None):
    """Right-inclusive empirical CDF as a percentile-like number."""
    x, w = b.checked_values(values, weights)
    order = np.argsort(x, kind="stable")
    sorted_x = x[order]
    sorted_w = w[order]
    cumulative = np.r_[0.0, np.cumsum(sorted_w)]
    cumulative /= cumulative[-1]
    # For each unique score, the right-inclusive CDF value.
    unique_x = np.unique(sorted_x)
    right = cumulative[np.searchsorted(sorted_x, unique_x, side="right")]
    return unique_x, right * 100


def lookup_table(values, weights=None):
    unique_x, cdf_values = finite_position(values, weights)
    table = {}
    for label, probability in PERCENTILES.items():
        # inverse ECDF: smallest score whose right-inclusive CDF >= p.
        idx = int(np.searchsorted(cdf_values, probability * 100, side="left"))
        idx = min(idx, len(unique_x) - 1)
        table[label] = float(unique_x[idx])
    return table


def position_at(values, weights, score):
    """Return right-inclusive finite position for an arbitrary score."""
    x, w = b.checked_values(values, weights)
    if not np.isfinite(score) or score < 0 or score > 1:
        raise ValueError("score must be finite and in [0,1]")
    return float(np.sum(w[x <= score]) / np.sum(w) * 100)


def synthetic_examples(values, weights):
    unweighted_w = np.ones(len(values))
    examples = {}
    for p in EXAMPLE_PERCENTILES:
        label = f"p{p:02d}"
        score = float(b.quantile(values, p / 100, weights))
        examples[label] = {
            "score": score,
            "unweighted_position": round(position_at(values, unweighted_w, score), 2),
            "weighted_position": round(position_at(values, weights, score), 2),
        }
    return examples


def analyze(frames, pipeline):
    validation = frames["validation_2024"]
    with threadpool_limits(limits=1):
        scores = pipeline.predict_proba(b.canonical_features(validation))[:, 1]
    mask = b.complete_mask(validation)
    if mask.sum() != 869:
        raise ValueError(f"complete validation N is {mask.sum()}, expected 869")
    x = scores[mask]
    w = validation.loc[mask, "wt_itvex"].to_numpy(dtype=float)
    b.checked_values(x, w)

    design = b.design_diagnostics(validation.loc[mask])
    weights_diag = b.weight_diagnostics(w)

    return {
        "comparator": {
            "name": "G6_validation_product_complete_2024",
            "n": int(mask.sum()),
            "psu": design["psu"],
            "strata": design["strata"],
            "singleton_strata": design["singleton_strata"],
            "model_sha256": b.EXPECTED_ARTIFACT_SHA256,
            "schema_version": b.EXPECTED_SCHEMA_VERSION,
            "adapter_version": b.ADAPTER_VERSION,
            "weight_policy": "original_wt_itvex_and_unweighted_sensitivity",
            "cdf_convention": "right_inclusive",
            "quantile_convention": "inverse_ecdf_no_interpolation",
            "sum_weights": float(w.sum()),
            "kish_neff": weights_diag["kish_neff"],
        },
        "lookup": {
            "unweighted": lookup_table(x),
            "weighted": lookup_table(x, w),
        },
        "synthetic_examples": synthetic_examples(x, w),
        "weighting_sensitivity": {
            "max_abs_position_difference_pp": round(
                max(abs(position_at(x, np.ones(len(x)), s) - position_at(x, w, s)) for s in np.linspace(0, 1, 1001)),
                6,
            ),
        },
    }


def aggregate_schema():
    percentile_numbers = dict.fromkeys(PERCENTILES, b.NUMBER)
    example = {f"p{p:02d}": b.fields("score unweighted_position weighted_position") for p in EXAMPLE_PERCENTILES}
    return {
        "identity": {
            "baseline_commit": {BASELINE},
            "analysis_source_commit": "commit",
            "model_sha256": {b.EXPECTED_ARTIFACT_SHA256},
            "schema_version": {b.EXPECTED_SCHEMA_VERSION},
            "adapter_version": {b.ADAPTER_VERSION},
            "b_evidence_file_sha256": {B_FILE_SHA},
            "b_evidence_payload_sha256": {B_PAYLOAD_SHA},
            "b_evidence_newline_policy": {"verify_pinned_LF_bytes_accept_checkout_CRLF_only"},
            "source_file_sha256": b.fields("script contract tests b_script", b.HASH),
            "created_at_utc": "timestamp",
            "runtime_versions": b.aggregate_schema()["identity"]["runtime_versions"],
            "validity": {"research_only_no_product_authorization"},
        },
        "comparator": {
            "name": {"G6_validation_product_complete_2024"},
            "n": {869},
            "psu": {31},
            "strata": {14},
            "singleton_strata": {5},
            "model_sha256": {b.EXPECTED_ARTIFACT_SHA256},
            "schema_version": {b.EXPECTED_SCHEMA_VERSION},
            "adapter_version": {b.ADAPTER_VERSION},
            "weight_policy": {"original_wt_itvex_and_unweighted_sensitivity"},
            "cdf_convention": {"right_inclusive"},
            "quantile_convention": {"inverse_ecdf_no_interpolation"},
            "sum_weights": b.NUMBER,
            "kish_neff": b.NUMBER,
        },
        "lookup": {
            "unweighted": percentile_numbers,
            "weighted": percentile_numbers,
        },
        "synthetic_examples": example,
        "weighting_sensitivity": b.fields("max_abs_position_difference_pp"),
        "safety": {
            k: {False}
            for k in (
                "final_test_opened",
                "final_test_hashed",
                "final_test_scored",
                "participant_output_written",
                "production_semantics_changed",
                "retrained",
            )
        },
    }


def serialize_evidence(payload):
    b.validate_tree(payload, aggregate_schema())
    if payload["identity"]["model_sha256"] != b.EXPECTED_ARTIFACT_SHA256:
        raise ValueError("reference/model SHA mismatch")
    rounded = b.round_aggregates(payload)
    envelope = {"payload": rounded, "payload_sha256": hashlib.sha256(b.canonical(rounded)).hexdigest()}
    return json.dumps(envelope, sort_keys=True, indent=2, allow_nan=False) + "\n"


def identity(created_at):
    datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%SZ")
    files = {
        "script": SCRIPT,
        "contract": CONTRACT,
        "tests": TEST,
        "b_script": b.SCRIPT,
    }
    tracked = [
        *files.values(),
        B_EVIDENCE,
        b.CONTRACT,
        b.TEST,
        "app/services/model_v2_inference.py",
        "app/services/model_v2_input_adapter.py",
    ]
    for path in tracked:
        subprocess.run(["git", "ls-files", "--error-unmatch", path], cwd=REPO, check=True, capture_output=True)
    if subprocess.check_output(["git", "diff", "HEAD", "--", *tracked], cwd=REPO):
        raise ValueError("commit the research implementation and contract before analysis")
    inherited = b.identity(created_at)
    return {
        "baseline_commit": BASELINE,
        "analysis_source_commit": inherited["analysis_source_commit"],
        "model_sha256": b.EXPECTED_ARTIFACT_SHA256,
        "schema_version": b.EXPECTED_SCHEMA_VERSION,
        "adapter_version": b.ADAPTER_VERSION,
        "b_evidence_file_sha256": B_FILE_SHA,
        "b_evidence_payload_sha256": B_PAYLOAD_SHA,
        "b_evidence_newline_policy": "verify_pinned_LF_bytes_accept_checkout_CRLF_only",
        "source_file_sha256": {k: b.sha256(REPO / p) for k, p in files.items()},
        "created_at_utc": created_at,
        "runtime_versions": inherited["runtime_versions"],
        "validity": "research_only_no_product_authorization",
    }


def run(root, output, created_at, reference_model_sha=b.EXPECTED_ARTIFACT_SHA256):
    if reference_model_sha != b.EXPECTED_ARTIFACT_SHA256:
        raise ValueError("reference/model SHA mismatch")
    output = Path(output)
    if output.exists():
        raise ValueError("refusing to overwrite existing evidence")
    metadata = identity(created_at)
    _prior = read_b_evidence()
    frames, pipeline = b.load_sources(root, reference_model_sha)
    payload = {
        "identity": metadata,
        **analyze(frames, pipeline),
        "safety": dict.fromkeys(aggregate_schema()["safety"], False),
    }
    serialized = serialize_evidence(payload)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("xb") as stream:
        stream.write(serialized.encode())
    return hashlib.sha256(serialized.encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--created-at", required=True)
    parser.add_argument("--reference-model-sha", default=b.EXPECTED_ARTIFACT_SHA256)
    args = parser.parse_args()
    try:
        digest = run(args.data_root, args.output, args.created_at, args.reference_model_sha)
    except (ValueError, OSError, RuntimeError, subprocess.SubprocessError):
        print("HOLD_FINITE_REFERENCE: prerequisite/integrity failure; no evidence published")
        return 1
    print(f"Aggregate evidence SHA-256 {digest}; finite comparator only, no SE/CI")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
