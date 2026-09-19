"""Synthetic comprehension-study dry-run tests; no real participants."""

import pytest

from scripts.model import analyze_model_v2_comprehension_study as study


def test_binomial_sf_edges():
    assert study.binomial_sf(-1, 10, 0.5) == 1.0
    assert study.binomial_sf(0, 10, 0.5) == 1.0
    assert study.binomial_sf(11, 10, 0.5) == 0.0
    assert study.binomial_sf(1, 10, 0.0) == 0.0
    assert study.binomial_sf(1, 10, 1.0) == 1.0


def test_binomial_sf_against_hand_calculation():
    # P(X >= 2) for Binomial(3, 0.5) = 1 - P(X=0) - P(X=1) = 1 - 0.125 - 0.375 = 0.5
    assert study.binomial_sf(2, 3, 0.5) == pytest.approx(0.5)
    # P(X >= 5) for Binomial(5, 0.5) = 0.03125
    assert study.binomial_sf(5, 5, 0.5) == pytest.approx(0.03125)


def test_clopper_pearson_lower_monotonic():
    for n in (20, 50, 100):
        bounds = [study.clopper_pearson_lower(k, n) for k in range(n + 1)]
        assert bounds[0] == 0.0
        assert all(bounds[i] <= bounds[i + 1] for i in range(n))


def test_clopper_pearson_lower_all_success():
    # When all n are successes, LB = alpha^(1/n).
    assert study.clopper_pearson_lower(10, 10) == pytest.approx(0.05 ** 0.1)
    assert study.clopper_pearson_lower(100, 100) == pytest.approx(0.05 ** 0.01)


def test_clopper_pearson_lower_all_failure():
    assert study.clopper_pearson_lower(0, 100) == 0.0


def test_clopper_pearson_matches_beta_quantile_for_small_n():
    # For a few cases, verify the defining property directly.
    for k, n in ((5, 10), (7, 20), (15, 30)):
        lb = study.clopper_pearson_lower(k, n)
        sf = study.binomial_sf(k, n, lb)
        assert sf == pytest.approx(0.05, abs=1e-6)


def test_generate_synthetic_responses_is_deterministic():
    first = study.generate_synthetic_responses(seed=42)
    second = study.generate_synthetic_responses(seed=42)
    assert first == second
    assert len(first) == 5 * 60
    arms = {row["arm"] for row in first}
    assert arms == set(study.ARMS)


def test_generate_includes_missing_and_invalid():
    rows = study.generate_synthetic_responses(n_per_arm=200, missing_rate=0.05, invalid_rate=0.05, seed=1)
    missing = sum(1 for row in rows for item in study.CRITICAL_ITEMS if row["responses"].get(item["id"]) is None)
    invalid = sum(1 for row in rows for item in study.CRITICAL_ITEMS if row["responses"].get(item["id"]) == "invalid")
    assert missing > 0
    assert invalid > 0


def test_score_response_counts_missing_invalid_unsure_as_incorrect():
    item = study.CRITICAL_ITEMS[0]
    assert study.score_response(item, item["correct"]) is True
    assert study.score_response(item, not item["correct"]) is False
    assert study.score_response(item, None) is False
    assert study.score_response(item, "invalid") is False
    assert study.score_response(item, "unsure") is False


def test_score_response_q6_requires_frozen_reference_concept():
    q6 = next(item for item in study.CRITICAL_ITEMS if item["id"] == "q6")
    assert study.score_response(q6, "frozen_reference") is True
    assert study.score_response(q6, "peer_comparison") is False
    assert study.score_response(q6, "unsure") is False
    assert study.score_response(q6, None) is False


def test_score_rows_all_correct_flag():
    rows = [
        {
            "participant_id": "p1",
            "arm": "A",
            "responses": {item["id"]: item["correct"] for item in study.CRITICAL_ITEMS},
        }
    ]
    scored = study.score_rows(rows)
    assert scored[0]["all_correct"] is True
    for item in study.CRITICAL_ITEMS:
        assert scored[0]["item_scores"][item["id"]] is True


def test_arm_summary_counts_and_gating():
    # n=30 gives a one-sided 95% lower bound of ~0.905 with all successes,
    # comfortably above the 0.80 gate.
    rows = [
        {
            "participant_id": f"p{i}",
            "arm": "A",
            "responses": {item["id"]: item["correct"] for item in study.CRITICAL_ITEMS},
        }
        for i in range(30)
    ]
    scored = study.score_rows(rows)
    summary = study.arm_summary(scored)
    assert summary["n"] == 30
    assert summary["overall_understanding"] == pytest.approx(1.0)
    assert summary["all_correct_rate"] == pytest.approx(1.0)
    assert summary["passes_gating"] is True
    for stats in summary["item_stats"].values():
        assert stats["pass_observed"] is True
        assert stats["pass_bound"] is True


def test_arm_summary_fails_when_critical_item_below_threshold():
    correct = {item["id"]: item["correct"] for item in study.CRITICAL_ITEMS}
    # Make q1 incorrect for 20% of participants.
    rows = []
    for i in range(100):
        resp = dict(correct)
        if i < 20:
            resp["q1"] = not study.CRITICAL_ITEMS[0]["correct"]
        rows.append({"participant_id": f"p{i}", "arm": "A", "responses": resp})
    scored = study.score_rows(rows)
    summary = study.arm_summary(scored)
    assert summary["item_stats"]["q1"]["rate"] == pytest.approx(0.80)
    assert summary["item_stats"]["q1"]["pass_observed"] is False
    assert summary["passes_gating"] is False


def test_sample_size_table_bounds():
    table = study.sample_size_table()
    assert len(table) == 6 * 4
    for row in table:
        assert 0.0 <= row["p_obs_ge_90"] <= 1.0
        assert 0.0 <= row["p_lb_ge_80"] <= 1.0
        assert 0.0 <= row["p_pass"] <= 1.0
        assert row["p_pass"] <= row["p_obs_ge_90"]
        assert row["p_pass"] <= row["p_lb_ge_80"]


def test_sample_size_table_high_true_rate_has_high_power():
    table = {row["n"]: row for row in study.sample_size_table() if row["true_rate"] == 0.95}
    assert table[200]["p_pass"] > 0.99
    assert table[300]["p_pass"] > 0.999


def test_deterministic_report_is_labeled_synthetic():
    report = study.deterministic_report(seed=7)
    assert report["synthetic"] is True
    assert "NOT EVIDENCE FROM REAL USERS" in report["note"]
    assert report["n_total"] == 300
    assert set(report["by_arm"]) == set(study.ARMS)
    assert len(report["sample_size_table"]) == 24


def test_render_markdown_contains_all_arms():
    report = study.deterministic_report(seed=11)
    markdown = study.render_markdown(report)
    for arm in study.ARMS:
        assert f"Arm {arm}" in markdown or f"| {arm} |" in markdown
    assert "SYNTHETIC DRY-RUN ONLY" in markdown


def test_report_determinism():
    first = study.deterministic_report(seed=99)
    second = study.deterministic_report(seed=99)
    assert first == second
