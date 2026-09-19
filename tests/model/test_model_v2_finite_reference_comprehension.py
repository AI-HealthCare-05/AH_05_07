"""Synthetic finite-reference comparator tests; real-data execution is opt-in."""

import hashlib
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from scripts.model import analyze_model_v2_finite_reference_comprehension as research
from scripts.model import analyze_model_v2_reference_distribution as b


def simple_scores_and_weights():
    scores = np.array([0.1, 0.2, 0.3, 0.4, 0.5])
    weights = np.array([1.0, 1.0, 2.0, 3.0, 3.0])
    return scores, weights


def make_identity():
    return {
        "baseline_commit": research.BASELINE,
        "analysis_source_commit": "a" * 40,
        "model_sha256": b.EXPECTED_ARTIFACT_SHA256,
        "schema_version": b.EXPECTED_SCHEMA_VERSION,
        "adapter_version": b.ADAPTER_VERSION,
        "b_evidence_file_sha256": research.B_FILE_SHA,
        "b_evidence_payload_sha256": research.B_PAYLOAD_SHA,
        "b_evidence_newline_policy": "verify_pinned_LF_bytes_accept_checkout_CRLF_only",
        "source_file_sha256": {k: "0" * 64 for k in ("script", "contract", "tests", "b_script")},
        "created_at_utc": "2026-09-19T01:00:00Z",
        "runtime_versions": {
            "python": "3.13.14",
            "numpy": "2.4.1",
            "pandas": "3.0.5",
            "pyarrow": "25.0.1",
            "scikit_learn": "1.8.0",
            "joblib": "1.5.3",
        },
        "validity": "research_only_no_product_authorization",
    }


def make_comparator():
    return {
        "name": "G6_validation_product_complete_2024",
        "n": 869,
        "psu": 31,
        "strata": 14,
        "singleton_strata": 5,
        "model_sha256": b.EXPECTED_ARTIFACT_SHA256,
        "schema_version": b.EXPECTED_SCHEMA_VERSION,
        "adapter_version": b.ADAPTER_VERSION,
        "weight_policy": "original_wt_itvex_and_unweighted_sensitivity",
        "cdf_convention": "right_inclusive",
        "quantile_convention": "inverse_ecdf_no_interpolation",
        "sum_weights": 6303733.087247,
        "kish_neff": 728.226,
    }


def make_payload():
    return {
        "identity": make_identity(),
        "comparator": make_comparator(),
        "lookup": {
            "unweighted": {k: 0.5 for k in research.PERCENTILES},
            "weighted": {k: 0.5 for k in research.PERCENTILES},
        },
        "synthetic_examples": {
            f"p{p:02d}": {"score": 0.5, "unweighted_position": float(p), "weighted_position": float(p)}
            for p in research.EXAMPLE_PERCENTILES
        },
        "weighting_sensitivity": {"max_abs_position_difference_pp": 8.141403},
        "safety": {k: False for k in research.aggregate_schema()["safety"]},
    }


def test_unweighted_lookup_matches_hand_calculation():
    scores, _ = simple_scores_and_weights()
    table = research.lookup_table(scores)
    # Right-inclusive ECDF for 5 sorted unique scores:
    # 0.1->0.2, 0.2->0.4, 0.3->0.6, 0.4->0.8, 0.5->1.0
    assert table["p20"] == pytest.approx(0.1)
    assert table["p40"] == pytest.approx(0.2)
    assert table["p60"] == pytest.approx(0.3)
    assert table["p80"] == pytest.approx(0.4)
    assert table["p99"] == pytest.approx(0.5)


def test_weighted_lookup_matches_hand_calculation():
    scores, weights = simple_scores_and_weights()
    table = research.lookup_table(scores, weights)
    assert table["p15"] == pytest.approx(0.2)
    assert table["p35"] == pytest.approx(0.3)
    assert table["p65"] == pytest.approx(0.4)
    assert table["p95"] == pytest.approx(0.5)


def test_lookup_ties_and_inverse_ecdf():
    scores = np.array([0.2, 0.2, 0.3, 0.3, 0.3])
    table = research.lookup_table(scores)
    assert table["p40"] == pytest.approx(0.2)
    assert table["p41"] == pytest.approx(0.3)
    assert table["p99"] == pytest.approx(0.3)


def test_position_at_aggregates_right_inclusive_cdf():
    scores, weights = simple_scores_and_weights()
    assert research.position_at(scores, np.ones(len(scores)), 0.15) == 20.0
    assert research.position_at(scores, weights, 0.35) == 40.0
    assert research.position_at(scores, weights, 0.45) == 70.0
    assert research.position_at(scores, weights, 1.0) == 100.0


def test_position_at_rejects_invalid_score():
    scores, weights = simple_scores_and_weights()
    with pytest.raises(ValueError):
        research.position_at(scores, weights, -0.1)
    with pytest.raises(ValueError):
        research.position_at(scores, weights, 1.1)
    with pytest.raises(ValueError):
        research.position_at(scores, weights, np.nan)


def test_synthetic_examples_sum_to_requested_percentiles():
    scores, weights = simple_scores_and_weights()
    examples = research.synthetic_examples(scores, weights)
    for info in examples.values():
        assert 0 <= info["score"] <= 1
        assert 0 <= info["unweighted_position"] <= 100
        assert 0 <= info["weighted_position"] <= 100
    # Weighted CDF for this fixture: 0.3 maps to CDF 0.4, 0.4 maps to CDF 0.7.
    # The p50 example uses the weighted p50 cutoff, which is 0.4, so position is 70.
    assert examples["p50"]["weighted_position"] == pytest.approx(70.0)


def test_weighting_sensitivity_bounded():
    scores, weights = simple_scores_and_weights()
    max_diff = max(
        abs(research.position_at(scores, np.ones(len(scores)), s) - research.position_at(scores, weights, s))
        for s in np.linspace(0, 1, 101)
    )
    assert 0 <= max_diff <= 100


def test_aggregate_schema_accepts_valid_payload():
    payload = make_payload()
    output = research.serialize_evidence(payload)
    decoded = json.loads(output)
    assert decoded["payload_sha256"] == hashlib.sha256(b.canonical(decoded["payload"])).hexdigest()


def test_serialize_rejects_model_sha_mismatch():
    payload = make_payload()
    payload["identity"]["model_sha256"] = "0" * 64
    # Schema enum check fires before the explicit SHA guard.
    with pytest.raises(ValueError):
        research.serialize_evidence(payload)


def test_serialize_rejects_row_level_publication():
    payload = make_payload()
    payload["row_scores"] = [0.1, 0.2, 0.3]
    with pytest.raises(ValueError):
        research.serialize_evidence(payload)


def test_frozen_b_evidence_identity(monkeypatch, tmp_path):
    assert research.read_b_evidence()["identity"]["model_sha256"] == b.EXPECTED_ARTIFACT_SHA256
    with pytest.raises(ValueError, match="reference/model SHA"):
        research.run(tmp_path, tmp_path / "unused.json", "2026-09-19T01:00:00Z", "0" * 64)
    monkeypatch.setattr(research, "B_FILE_SHA", "0" * 64)
    with pytest.raises(ValueError, match="B evidence file mismatch"):
        research.read_b_evidence()


def test_windows_checkout_crlf_only_allowed_without_rewriting_b(monkeypatch, tmp_path):
    original = (research.REPO / research.B_EVIDENCE).read_bytes().replace(b"\r\n", b"\n")
    expected = research.read_b_evidence()
    checkout = tmp_path / research.B_EVIDENCE
    checkout.parent.mkdir(parents=True)
    crlf = original.replace(b"\n", b"\r\n")
    checkout.write_bytes(crlf)
    assert hashlib.sha256(crlf).hexdigest() != research.B_FILE_SHA
    monkeypatch.setattr(research, "REPO", tmp_path)
    assert research.read_b_evidence() == expected
    assert checkout.read_bytes() == crlf


def test_output_file_bytes_match_returned_hash(monkeypatch, tmp_path):
    monkeypatch.setattr(research, "identity", lambda _: make_identity())
    monkeypatch.setattr(research, "load_validation_source", lambda *_: ({}, None))
    monkeypatch.setattr(
        research,
        "analyze",
        lambda *_: {
            "comparator": make_comparator(),
            "lookup": {
                "unweighted": {k: 0.5 for k in research.PERCENTILES},
                "weighted": {k: 0.5 for k in research.PERCENTILES},
            },
            "synthetic_examples": {
                f"p{p:02d}": {"score": 0.5, "unweighted_position": float(p), "weighted_position": float(p)}
                for p in research.EXAMPLE_PERCENTILES
            },
            "weighting_sensitivity": {"max_abs_position_difference_pp": 8.141403},
        },
    )
    path = tmp_path / "aggregate.json"
    digest = research.run(tmp_path, path, "2026-09-19T01:00:00Z")
    assert digest == hashlib.sha256(path.read_bytes()).hexdigest()
    assert b"\r\n" not in path.read_bytes()


def test_g8_path_rejected_before_any_filesystem_resolution_or_open(monkeypatch, tmp_path):
    def forbidden(*_args, **_kwargs):
        pytest.fail("unapproved path must be rejected before filesystem access")

    monkeypatch.setattr(Path, "resolve", forbidden)
    monkeypatch.setattr(Path, "open", forbidden)
    for path in (
        "model-v2-g3/knhanes-2024/locked-final-test/final_test.parquet",
        "model-v2-g8/final.parquet",
        "../final_test.parquet",
    ):
        with pytest.raises(ValueError, match="unapproved"):
            b.approved_path(tmp_path, path)


def test_overwrite_rejected(tmp_path):
    output = tmp_path / "keep.json"
    output.write_text("keep")
    with pytest.raises(ValueError, match="overwrite"):
        research.run(tmp_path, output, "2026-09-19T01:00:00Z")
    assert output.read_text() == "keep"


@pytest.mark.skipif(not os.getenv("SK7_REFERENCE_DATA_ROOT"), reason="approved local integration is opt-in")
def test_local_finite_reference_lookup_without_g8_fit_or_row_output(monkeypatch, tmp_path):
    root = Path(os.environ["SK7_REFERENCE_DATA_ROOT"]).resolve()
    created_at = os.environ.get("SK7_REFERENCE_CREATED_AT", "2026-09-19T01:00:00Z")
    first, second = tmp_path / "first.json", tmp_path / "second.json"

    approved_accesses = []
    parquet_reads = []
    original_approved_path = b.approved_path

    def tracking_approved_path(r, rel):
        approved_accesses.append(rel)
        return original_approved_path(r, rel)

    original_read_parquet = pd.read_parquet

    def tracking_read_parquet(*args, **kwargs):
        parquet_reads.append(args[0])
        return original_read_parquet(*args, **kwargs)

    monkeypatch.setattr(b, "approved_path", tracking_approved_path)
    monkeypatch.setattr(pd, "read_parquet", tracking_read_parquet)

    assert research.run(root, first, created_at) == research.run(root, second, created_at)
    assert first.read_bytes() == second.read_bytes()
    result = json.loads(first.read_text())["payload"]
    assert result["comparator"]["n"] == 869
    assert result["comparator"]["name"] == "G6_validation_product_complete_2024"
    assert "p82" in result["synthetic_examples"]
    assert all(k in result["lookup"]["weighted"] for k in research.PERCENTILES)
    assert all(v is False for v in result["safety"].values())

    # B3 must resolve only the frozen artifact and the G6 validation parquet.
    assert set(approved_accesses) == {b.ARTIFACT, b.ROLES["validation_2024"]["path"]}
    assert len(parquet_reads) == 2  # one validation parquet read per run
    for read_path in parquet_reads:
        read_path = str(read_path)
        assert read_path.endswith(b.ROLES["validation_2024"]["path"])
        assert "development" not in read_path
        assert "temporal" not in read_path
        assert "final-test" not in read_path
        assert "final_test" not in read_path
