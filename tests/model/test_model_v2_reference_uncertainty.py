"""Synthetic design/stability and publication tests; real-data execution is opt-in."""

import json
import os
from copy import deepcopy
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from scripts.model import analyze_model_v2_reference_uncertainty as research

b = research.b


def simple_design(strata, psus, weights):
    return pd.DataFrame({"kstrata": strata, "psu": psus, "wt_itvex": weights})


def synthetic_frame(offset=0):
    frame = pd.DataFrame({name: [30.0] * 8 for name in b.NUMERIC})
    for name, categories in b.CANONICAL_CATEGORIES.items():
        frame[name] = [categories[0]] * 8
    frame["age_years"] = [19, 25, 35, 45, 55, 65, 75, 80]
    frame["walking_days_7d"] = 2
    frame["walking_minutes_per_active_day"] = 30
    frame["weekday_sleep_minutes"] = 420
    frame["weekend_sleep_minutes"] = 480
    frame["kstrata"] = [1, 1, 1, 1, 2, 2, 3, 3]
    frame["psu"] = np.array([1, 1, 2, 2, 3, 4, 5, 5]) + offset
    frame["wt_itvex"] = [1, 2, 3, 4, 3, 2, 1, 4]
    frame.loc[0, "weekday_sleep_minutes"] = np.nan
    return frame


class SyntheticPipeline:
    def predict_proba(self, frame):
        assert list(frame) == b.FEATURES
        p = frame["age_years"].to_numpy() / 100
        return np.column_stack([1 - p, p])


def synthetic_input():
    frames = {role: synthetic_frame(i * 10) for i, role in enumerate(b.ROLES)}
    pipeline = SyntheticPipeline()
    cohorts, temporal, coverage = b.analyze_cohorts(frames, pipeline)
    prior = b.round_aggregates({"cohorts": cohorts, "validation_vs_temporal": temporal, "coverage": coverage})
    return frames, pipeline, prior


def synthetic_metadata(schema):
    if isinstance(schema, dict):
        return {k: synthetic_metadata(v) for k, v in schema.items()}
    if isinstance(schema, set):
        return next(iter(schema))
    return {b.HASH: "0" * 64, "commit": "0" * 40, "timestamp": "2026-09-19T01:00:00Z", "version": "1.0.0"}[schema]


@pytest.fixture
def payload():
    frames, pipeline, prior = synthetic_input()
    schema = research.aggregate_schema()
    return {
        "identity": synthetic_metadata(schema["identity"]),
        "b_statistics_reproduced": True,
        "committed_g3_metadata_only": synthetic_metadata(schema["committed_g3_metadata_only"]),
        **research.analyze(frames, pipeline, prior),
        "uncertainty": synthetic_metadata(schema["uncertainty"]),
        "safety": synthetic_metadata(schema["safety"]),
    }


def test_two_psus_equal_weights_hand_calculation_and_scaling():
    frame = simple_design([1, 1], [1, 2], [1, 1])
    result = research.deletion_sensitivity(frame, [0.2, 0.8])
    assert result["deletions"] == 2
    assert result["deletions_losing_a_stratum"] == 0
    assert result["exact_max_cdf_movement_pp"] == 50
    assert result["anchors"]["p01"]["cdf_change_min_pp"] == -50
    assert result["anchors"]["p01"]["cdf_change_max_pp"] == 50
    frame["wt_itvex"] *= 17
    assert research.deletion_sensitivity(frame, [0.2, 0.8]) == result


def test_unequal_weights_and_deletion_bound():
    frame = simple_design([1, 1], [1, 2], [1, 3])
    result = research.deletion_sensitivity(frame, [0.2, 0.8])
    assert result["exact_max_cdf_movement_pp"] == 75
    assert result["removed_weight_share_max"] == 0.75
    assert result["removed_weight_share_min"] == 0.25


def test_singleton_not_silently_treated_as_certainty():
    frame = simple_design([1, 1, 2], [1, 2, 3], [1, 1, 8])
    result = research.deletion_sensitivity(frame, [0.2, 0.4, 0.9])
    assert result["deletions_losing_a_stratum"] == 1
    assert result["exact_max_cdf_movement_pp"] == pytest.approx(80)
    assert result["method"] == "exhaustive_observed_psu_deletion_not_sampling_uncertainty"
    assert "variance" not in result and "ci" not in result


def test_multiple_strata_and_nested_psu_labels():
    frame = simple_design([1, 1, 2, 2], [1, 2, 1, 2], [1, 2, 3, 4])
    assert research.checked_structure(frame).tolist() == [2, 2]
    result = research.deletion_sensitivity(frame, [0.1, 0.2, 0.8, 0.9])
    assert result["deletions"] == 4
    assert result["deletions_losing_a_stratum"] == 0
    assert result["exact_max_cdf_movement_pp"] <= 100 * result["removed_weight_share_max"]


def test_domain_like_subset_changes_design_without_claiming_variance():
    original = simple_design([1, 1, 2, 2], [1, 2, 3, 4], [1, 1, 1, 1])
    domain = original.iloc[[0, 2, 3]]
    assert research.checked_structure(original).tolist() == [2, 2]
    assert research.checked_structure(domain).tolist() == [1, 2]
    result = research.deletion_sensitivity(domain, [0.1, 0.8, 0.9])
    assert result["deletions_losing_a_stratum"] == 1
    # This diagnostic cannot replace the original design needed for domain SE.
    assert result["deletions"] == 3


def test_tails_include_boundary_ties_and_kish_is_only_concentration():
    frame = simple_design([1, 1, 2, 2], [1, 2, 3, 4], [1, 1, 3, 5])
    result = research.tail_support(frame, [0.1, 0.1, 0.6, 0.9])
    assert result["p01"] == {"cutoff": 0.1, "n": 2, "psu": 2, "strata": 1, "weight_share": 0.2, "kish_neff": 2}
    assert result["p99"]["n"] == 1 and result["p99"]["kish_neff"] == 1
    assert result["p10"]["n"] == 2 and result["p90"]["n"] == 1


def test_conditional_deletions_deterministic_and_row_permutation_invariant():
    frame = synthetic_frame()
    x = frame["age_years"].to_numpy() / 100
    first = research.deletion_sensitivity(frame, x)
    assert first == research.deletion_sensitivity(frame.copy(), x.copy())
    second = research.deletion_sensitivity(frame.iloc[::-1], x[::-1])
    assert b.round_aggregates(first) == b.round_aggregates(second)


@pytest.mark.parametrize(
    "column,value",
    [
        ("psu", None),
        ("kstrata", None),
        ("psu", ""),
        ("kstrata", np.inf),
        ("wt_itvex", 0),
        ("wt_itvex", -1),
        ("wt_itvex", np.nan),
    ],
)
def test_invalid_survey_structure_fail_closed(column, value):
    frame = simple_design([1.0, 1.0], ["a", "b"], [1.0, 1.0])
    frame.loc[0, column] = value
    with pytest.raises(ValueError):
        research.deletion_sensitivity(frame, [0.1, 0.9])


def test_empty_single_psu_and_invalid_scores_fail_closed():
    frame = simple_design([1], [1], [1])
    with pytest.raises(ValueError, match="only PSU"):
        research.deletion_sensitivity(frame, [0.1])
    with pytest.raises(ValueError, match="nonempty"):
        research.checked_structure(frame.iloc[:0])
    with pytest.raises(ValueError):
        research.deletion_sensitivity(simple_design([1, 1], [1, 2], [1, 1]), [0.1, 1.1])


def test_authorized_union_proves_split_singleton_origin_not_national_coverage():
    development = synthetic_frame()
    validation = synthetic_frame(10)
    development.loc[development["kstrata"] == 1, "kstrata"] = 4
    result = research.coverage_review(development, validation)
    assert result["frames"]["validation"]["design"]["singleton_strata"] == 1
    assert result["validation_singletons_with_additional_authorized_psus"] == 1
    assert result["validation_singletons_unresolved_in_authorized_union"] == 0
    assert result["union_strata_absent_in_validation"] == 1
    assert result["union_psus_in_absent_strata"] == 2
    assert result["union_weight_share_in_absent_strata"] == 0.25
    assert result["validation_weight_fraction_of_union"] == 0.5
    assert result["frames"]["authorized_union"]["age_groups"]["80_plus_topcoded"]["n"] == 2
    assert result["frames"]["validation"]["categories"]["sex_knhanes"]["absent_categories_n"] == 1


def test_singleton_origin_can_remain_unresolved():
    development, validation = synthetic_frame(), synthetic_frame(10)
    development["kstrata"] += 10
    result = research.coverage_review(development, validation)
    assert result["validation_singletons_with_additional_authorized_psus"] == 0
    assert result["validation_singletons_unresolved_in_authorized_union"] == 1
    with pytest.raises(ValueError, match="overlap"):
        research.coverage_review(validation, validation)


def test_full_complete_separation_and_b_preserved(payload):
    coverage = payload["coverage"]
    assert coverage["full"]["frames"]["validation"]["n"] == 8
    assert coverage["product_complete"]["frames"]["validation"]["n"] == 7
    frames, pipeline, prior = synthetic_input()
    prior["cohorts"]["validation_2024"]["subsets"]["full"]["weights"]["n"] += 1
    with pytest.raises(ValueError, match="B result not reproduced"):
        research.analyze(frames, pipeline, prior)


def test_frozen_b_evidence_and_model_identity(monkeypatch, tmp_path):
    assert research.read_b_evidence()["identity"]["model_sha256"] == b.EXPECTED_ARTIFACT_SHA256
    with pytest.raises(ValueError, match="reference/model SHA"):
        research.run(tmp_path, tmp_path / "unused.json", "2026-09-19T01:00:00Z", "0" * 64)
    monkeypatch.setattr(b, "sha256", lambda _: "0" * 64)
    with pytest.raises(ValueError, match="B evidence file mismatch"):
        research.read_b_evidence()


def test_g8_path_rejected_before_any_filesystem_resolution_or_open(monkeypatch, tmp_path):
    def forbidden(*_args, **_kwargs):
        pytest.fail("unapproved path must be rejected before filesystem access")

    monkeypatch.setattr(Path, "resolve", forbidden)
    monkeypatch.setattr(Path, "open", forbidden)
    monkeypatch.setattr(pd, "read_parquet", forbidden)
    for path in (
        "model-v2-g3/knhanes-2024/locked-final-test/final_test.parquet",
        "model-v2-g8/final.parquet",
        "../final_test.parquet",
    ):
        with pytest.raises(ValueError, match="unapproved"):
            b.approved_path(tmp_path, path)


def test_deterministic_closed_output_and_unestimated_is_not_zero(payload):
    output = research.serialize_evidence(payload)
    assert output == research.serialize_evidence(deepcopy(payload))
    decoded = json.loads(output)["payload"]
    assert decoded["uncertainty"]["confidence_intervals_computed"] is False
    assert decoded["sensitivity_matrix"]["full"]["candidate_lonely_method_interval_difference_pp"] is None
    assert all(v is False for v in decoded["safety"].values())


@pytest.mark.parametrize("key", ["ID", "scores", "weights", "features", "psu_ids", "replicates", "confidence_interval"])
def test_no_row_or_unjustified_interval_publication(payload, key):
    payload["psu_deletion_sensitivity"]["full"][key] = ["row", 0.73]
    with pytest.raises(ValueError):
        research.serialize_evidence(payload)


def test_no_array_or_label_in_scalar_and_no_model_mismatch(payload):
    invalid = deepcopy(payload)
    invalid["coverage"]["full"]["validation_psu_fraction_of_union"] = ["PSU-A", 0.4]
    with pytest.raises(ValueError):
        research.serialize_evidence(invalid)
    payload["identity"]["model_sha256"] = "0" * 64
    with pytest.raises(ValueError):
        research.serialize_evidence(payload)


def test_overwrite_rejected(tmp_path):
    output = tmp_path / "keep.json"
    output.write_text("keep")
    with pytest.raises(ValueError, match="overwrite"):
        research.run(tmp_path, output, "2026-09-19T01:00:00Z")
    assert output.read_text() == "keep"


@pytest.mark.skipif(not os.getenv("SK7_REFERENCE_DATA_ROOT"), reason="approved local integration is opt-in")
def test_local_b_reproduction_and_b2_without_g8_fit_or_row_output(monkeypatch, tmp_path):
    root = Path(os.environ["SK7_REFERENCE_DATA_ROOT"]).resolve()
    allowed = {root / b.ARTIFACT, *(root / config["path"] for config in b.ROLES.values())}
    opened, projected = set(), []
    original_open, original_parquet = Path.open, pd.read_parquet

    def guarded_open(path, *args, **kwargs):
        if root in path.resolve().parents:
            assert path.resolve() in allowed, "unapproved research source access"
            assert (args[0] if args else kwargs.get("mode", "r")) in ("r", "rb")
            opened.add(path.resolve())
        return original_open(path, *args, **kwargs)

    def guarded_parquet(path, *args, **kwargs):
        assert Path(path).resolve() in allowed
        assert kwargs["columns"] == [*b.FEATURES, "wt_itvex", "kstrata", "psu"]
        projected.append(Path(path))
        return original_parquet(path, *args, **kwargs)

    def forbidden_fit(*_args, **_kwargs):
        pytest.fail("model fitting prohibited")

    monkeypatch.setattr(Path, "open", guarded_open)
    monkeypatch.setattr(pd, "read_parquet", guarded_parquet)
    monkeypatch.setattr(Pipeline, "fit", forbidden_fit)
    monkeypatch.setattr(LogisticRegression, "fit", forbidden_fit)
    created_at = os.environ.get("SK7_REFERENCE_CREATED_AT", "2026-09-19T01:00:00Z")
    first, second = tmp_path / "first.json", tmp_path / "second.json"
    assert research.run(root, first, created_at) == research.run(root, second, created_at)
    assert first.read_bytes() == second.read_bytes()
    assert opened == allowed and len(projected) == 6
    result = json.loads(first.read_text())["payload"]
    assert result["b_statistics_reproduced"] is True
    assert result["coverage"]["full"]["frames"]["validation"]["n"] == 978
    assert result["coverage"]["product_complete"]["frames"]["validation"]["n"] == 869
    assert result["uncertainty"]["decision"] == "HOLD_SURVEY_UNCERTAINTY"
