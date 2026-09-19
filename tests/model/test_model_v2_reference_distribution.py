"""Synthetic mathematical and publication-boundary tests; no participant data."""

import os
from copy import deepcopy
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from app.services.model_v2_inference import ModelV2ArtifactError
from scripts.model import analyze_model_v2_reference_distribution as research


def test_cdf_definitions_equal_weights_and_rescaling():
    scores = [0.1, 0.3, 0.7, 0.9]
    query = [-1, 0, 0.1, 0.5, 0.9, 1, 2]
    assert research.cdf(scores, query).tolist() == [0, 0, 0.25, 0.5, 1, 1, 1]
    assert research.cdf(scores, query, [1, 3, 2, 4]).tolist() == [0, 0, 0.1, 0.4, 1, 1, 1]
    np.testing.assert_allclose(research.cdf(scores, query, [17] * 4), research.cdf(scores, query))
    np.testing.assert_allclose(research.cdf(scores, query, [10, 30, 20, 40]), research.cdf(scores, query, [1, 3, 2, 4]))


def test_exact_ties_left_right_mid_and_weight_jump():
    scores, weights = [0.2, 0.2, 0.8], [1, 3, 6]
    assert research.cdf(scores, 0.2, weights, "left") == 0
    assert research.cdf(scores, 0.2, weights, "right") == 0.4
    assert research.cdf(scores, 0.2, weights, "mid") == 0.2
    assert research.cdf(scores, 0.5, weights, "mid") == 0.4
    result = research.tie_diagnostics(np.array(scores), np.array(weights))
    assert result["duplicate_groups"] == 1
    assert result["rows_in_duplicate_groups"] == 2
    assert result["max_duplicate_group_weight_pp"] == 40
    assert result["right_minus_left_max_pp"] == 60  # singleton jump still matters


@pytest.mark.parametrize("weights", [[0, 1], [-1, 2], [np.nan, 1], [np.inf, 1], [-np.inf, 1]])
def test_invalid_weights_rejected(weights):
    for function in (research.cdf, research.quantile):
        with pytest.raises(ValueError, match="weights"):
            function([0.2, 0.8], 0.5, weights)


@pytest.mark.parametrize("scores", [[-0.01, 0.5], [0.2, 1.01], [np.nan, 0.5], [0.2, np.inf]])
def test_invalid_scores_rejected(scores):
    for function in (research.cdf, research.quantile):
        with pytest.raises(ValueError, match="scores"):
            function(scores, 0.5)


def test_quantile_inverse_ecdf_boundaries_and_monotonicity():
    p = [0, 0.1, 0.10001, 0.4, 0.40001, 1]
    assert research.quantile([0.1, 0.4, 0.9], p, [1, 3, 6]).tolist() == [0.1, 0.1, 0.4, 0.4, 0.9, 0.9]
    x = np.random.default_rng(6).uniform(size=100)
    w = np.random.default_rng(7).uniform(0.1, 5, size=100)
    assert (np.diff(research.quantile(x, np.linspace(0, 1, 1001), w)) >= 0).all()
    np.testing.assert_allclose(research.quantile(x, p), research.quantile(x, p, np.ones(100)))


def test_exact_maximum_not_limited_by_uniform_grid():
    # A jump between the .0001-spaced grid points must still be detected.
    result = research.mapping_difference([0.50001, 0.8], [1, 1], [0.50002, 0.8], [1, 1])
    assert result["uniform_score_grid_p95_pp"] == 0
    assert result["exact_max_pp"] == 50
    assert result["max_score_bin_lower"] == 0.5
    assert result["anchor_abs_pp"]["p01"] == 50


def test_weight_diagnostics_and_cluster_counts():
    result = research.weight_diagnostics([1, 1, 2])
    assert result["sum"] == 4
    assert result["kish_neff"] == pytest.approx(16 / 6)
    assert result["max_share"] == 0.5
    assert result["top_one_percent_share"] == 0.5
    design = research.design_diagnostics(pd.DataFrame({"kstrata": [1, 1, 1, 2], "psu": [1, 1, 2, 1]}))
    assert design["psu"] == 3  # nested PSU identity, not just the PSU label
    assert design["singleton_strata"] == 1


def synthetic_frame(offset=0):
    rows = []
    for i in range(6):
        row = {k: 30.0 for k in research.NUMERIC}
        row.update({k: v[0] for k, v in research.CANONICAL_CATEGORIES.items()})
        row.update(
            age_years=20 + i * 10,
            walking_days_7d=0,
            walking_minutes_per_active_day=0,
            weekday_sleep_minutes=420,
            weekend_sleep_minutes=480,
            wt_itvex=i + 1,
            kstrata=1 + i // 3,
            psu=offset + i // 2,
        )
        rows.append(row)
    rows[0]["weekday_sleep_minutes"] = np.nan
    rows[1]["cigarette_smoking_state"] = None
    return pd.DataFrame(rows)


class SyntheticPipeline:
    def predict_proba(self, frame):
        assert list(frame) == research.FEATURES
        p = frame["age_years"].to_numpy(dtype=float) / 100
        return np.column_stack([1 - p, p])


def test_full_complete_before_imputation_and_no_mutation():
    frame = synthetic_frame()
    original = frame.copy(deep=True)
    assert research.complete_mask(frame).tolist() == [False, False, True, True, True, True]
    frames = {role: synthetic_frame(i * 10) for i, role in enumerate(research.ROLES)}
    reports, _, _ = research.analyze_cohorts(frames, SyntheticPipeline())
    subsets = reports["validation_2024"]["subsets"]
    assert subsets["full"]["weights"]["n"] == 6
    assert subsets["product_complete"]["weights"]["n"] == 4
    assert subsets["full"]["score"]["weighted_quantiles"] != subsets["product_complete"]["score"]["weighted_quantiles"]
    assert reports["validation_2024"]["full_vs_product_complete"]["mapping"]["exact_max_pp"] > 0
    pd.testing.assert_frame_equal(frame, original)


def test_marginal_support_missing_absent_and_outside_domain():
    frame = synthetic_frame()
    frame.loc[2, "walking_days_7d"] = 8
    w = frame["wt_itvex"].to_numpy()
    assert research.numeric_support(frame, "walking_days_7d", w)["outside_product_domain_n"] == 1
    assert research.numeric_support(frame, "weekday_sleep_minutes", w)["missing_n"] == 1
    result = research.categorical_support(frame, "cigarette_smoking_state", w)
    assert result["absent_categories_n"] == 3
    assert result["missing_n"] == 1
    assert result["categories"]["daily_current"]["n"] == 5


def synthetic_metadata(schema):
    """Create metadata only; all numeric research evidence is actually computed."""
    if isinstance(schema, dict):
        return {k: synthetic_metadata(v) for k, v in schema.items()}
    if isinstance(schema, set):
        return next(iter(schema))
    return {
        research.HASH: "0" * 64,
        "commit": "0" * 40,
        "timestamp": "2026-09-19T00:00:00Z",
        "version": "1.0.0",
        research.NUMBER: 2024,
    }[schema]


@pytest.fixture
def payload():
    frames = {role: synthetic_frame(i * 10) for i, role in enumerate(research.ROLES)}
    cohorts, temporal, coverage = research.analyze_cohorts(frames, SyntheticPipeline())
    metadata = synthetic_metadata(research.aggregate_schema()["identity"])
    metadata["model_sha256"] = research.EXPECTED_ARTIFACT_SHA256
    return {
        "identity": metadata,
        "cohorts": cohorts,
        "validation_vs_temporal": temporal,
        "coverage": coverage,
        "uncertainty": {
            "confidence_intervals_computed": False,
            "status": "HOLD_pending_split_aware_survey_variance_review",
        },
        "safety": dict.fromkeys(research.aggregate_schema()["safety"], False),
    }


def test_deterministic_closed_aggregate_output(payload):
    first = research.serialize_evidence(payload)
    assert first == research.serialize_evidence(deepcopy(payload))
    assert first == research.serialize_evidence(dict(reversed(list(payload.items()))))
    assert "NaN" not in first
    assert '"psu":' in first  # aggregate counts only, no PSU labels
    assert '"ID"' not in first and '"scores"' not in first


@pytest.mark.parametrize("injection", ["ID", "scores", "weights", "features", "psu_ids", "raw_rows"])
def test_row_material_rejected_at_any_new_key(payload, injection):
    payload["cohorts"]["validation_2024"]["subsets"]["full"][injection] = ["participant", 0.73]
    with pytest.raises(ValueError):
        research.serialize_evidence(payload)


def test_array_cannot_replace_aggregate_scalar(payload):
    payload["coverage"]["validation_missing_from_authorized_union"] = [0.1, 0.2]
    with pytest.raises(ValueError, match="scalar"):
        research.serialize_evidence(payload)


def test_reference_model_mismatch_fails_before_reading(monkeypatch, tmp_path, payload):
    def forbidden(*_args, **_kwargs):
        pytest.fail("source must not be accessed")

    monkeypatch.setattr(research, "approved_path", forbidden)
    with pytest.raises(ValueError, match="reference/model SHA"):
        research.load_sources(tmp_path, "f" * 64)
    payload["identity"]["model_sha256"] = "f" * 64
    with pytest.raises(ValueError, match="reference/model SHA"):
        research.serialize_evidence(payload)


def test_artifact_mismatch_fails_before_deserialization(monkeypatch, tmp_path):
    path = tmp_path / research.ARTIFACT
    path.parent.mkdir(parents=True)
    path.write_bytes(b"synthetic unapproved artifact")

    def forbidden(*_args, **_kwargs):
        pytest.fail("unverified bytes must not be deserialized")

    monkeypatch.setattr(joblib, "load", forbidden)
    with pytest.raises(ModelV2ArtifactError, match="SHA-256"):
        research.load_sources(tmp_path)


def test_unapproved_final_test_path_is_rejected_without_opening(tmp_path, monkeypatch):
    def forbidden(*_args, **_kwargs):
        pytest.fail("unapproved path must not be opened")

    monkeypatch.setattr(Path, "open", forbidden)
    with pytest.raises(ValueError, match="unapproved source"):
        research.approved_path(tmp_path, "model-v2-g3/knhanes-2024/locked-final-test/final-test.parquet")


def test_symlink_alias_rejected(tmp_path):
    target = tmp_path / "unapproved.parquet"
    target.write_bytes(b"synthetic")
    path = tmp_path / research.ROLES["validation_2024"]["path"]
    path.parent.mkdir(parents=True)
    path.symlink_to(target)
    with pytest.raises(ValueError, match="symlink"):
        research.approved_path(tmp_path, research.ROLES["validation_2024"]["path"])


def test_missing_source_and_overwrite_rejected(tmp_path):
    with pytest.raises(ValueError, match="approved local research source unavailable"):
        research.approved_path(tmp_path, research.ARTIFACT)
    output = tmp_path / "keep.json"
    output.write_text("preserve")
    with pytest.raises(ValueError, match="overwrite"):
        research.run(tmp_path, output, "2026-09-19T00:00:00Z")
    assert output.read_text() == "preserve"


def test_psu_role_overlap_fails_closed():
    frames = dict.fromkeys(research.ROLES, synthetic_frame())
    with pytest.raises(ValueError, match="PSU overlap"):
        research.analyze_cohorts(frames, SyntheticPipeline())


@pytest.mark.skipif(not os.getenv("SK7_REFERENCE_DATA_ROOT"), reason="approved local data integration is opt-in")
def test_approved_local_integration_without_fit_or_unapproved_file_access(monkeypatch, tmp_path):
    root = Path(os.environ["SK7_REFERENCE_DATA_ROOT"]).resolve()
    allowed = {root / research.ARTIFACT, *(root / item["path"] for item in research.ROLES.values())}
    opened, projected = set(), []
    original_open = Path.open
    original_parquet = pd.read_parquet

    def guarded_open(path, *args, **kwargs):
        resolved = path.resolve()
        if root in resolved.parents:
            assert resolved in allowed, "unapproved research source access"
            mode = args[0] if args else kwargs.get("mode", "r")
            assert mode in ("r", "rb"), "source mutation is prohibited"
            opened.add(resolved)
        return original_open(path, *args, **kwargs)

    def projected_parquet(path, *args, **kwargs):
        assert Path(path).resolve() in allowed
        assert kwargs["columns"] == [*research.FEATURES, "wt_itvex", "kstrata", "psu"]
        projected.append(Path(path).name)
        return original_parquet(path, *args, **kwargs)

    def forbidden_fit(*_args, **_kwargs):
        pytest.fail("frozen model must not be fitted")

    monkeypatch.setattr(Path, "open", guarded_open)
    monkeypatch.setattr(pd, "read_parquet", projected_parquet)
    monkeypatch.setattr(Pipeline, "fit", forbidden_fit)
    monkeypatch.setattr(LogisticRegression, "fit", forbidden_fit)
    created_at = os.environ.get("SK7_REFERENCE_CREATED_AT", "2026-09-19T00:00:00Z")
    first, second = tmp_path / "first.json", tmp_path / "second.json"
    assert research.run(root, first, created_at) == research.run(root, second, created_at)
    assert first.read_bytes() == second.read_bytes()
    assert opened == allowed
    assert len(projected) == 6
