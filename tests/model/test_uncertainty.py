"""Synthetic numerical oracle, paired bootstrap and publication boundary tests."""

import copy
import json
import os
import subprocess
import sys

import numpy as np
import pytest
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score

from scripts.model import paired_bootstrap as bootstrap
from scripts.model import validation_uncertainty as runner
from scripts.model.evaluate_predictions import metrics
from scripts.model.uncertainty_evidence import same_result, validate_uncertainty
from scripts.model.uncertainty_rules import UNCERTAINTY_CONFIG as RULES
from tests.model.test_comparison import commit, invoke
from tests.model.test_comparison import workspace as comparison_workspace  # noqa: F401


def vectors():
    rng = np.random.default_rng(19)
    y = np.tile([0, 1], 20)
    return y, rng.random(40), rng.random(40)


def test_same_predictions_have_zero_difference_and_interval():
    y, lr, _ = vectors()
    result = bootstrap.bootstrap_group(y, lr, lr)
    for value in result["metrics"].values():
        assert value["point"]["difference"]["value"] == 0
        assert value["interval"]["difference"] == [0.0, 0.0]
        assert value["interval"]["valid_replicates"] == 2000


def test_swap_reverses_difference_and_seed_reproduces():
    y, lr, hgb = vectors()
    original = bootstrap.bootstrap_group(y, lr, hgb)
    assert original == bootstrap.bootstrap_group(y, lr, hgb)
    swapped = bootstrap.bootstrap_group(y, hgb, lr)
    for name, value in original["metrics"].items():
        other = swapped["metrics"][name]
        assert other["point"]["difference"]["value"] == -value["point"]["difference"]["value"]
        np.testing.assert_allclose(
            other["interval"]["difference"], [-x for x in value["interval"]["difference"][::-1]], atol=1e-15
        )


def test_paired_rows_are_kept_together(monkeypatch):
    y = np.tile([0, 1], 10)
    lr = np.linspace(0.01, 0.99, 20)
    pairs = []
    original = bootstrap.scores

    def observed(labels, probabilities):
        pairs.append((labels.copy(), probabilities.copy()))
        return original(labels, probabilities)

    monkeypatch.setattr(bootstrap, "scores", observed)
    bootstrap.bootstrap_group(y, lr, 1 - lr)
    assert len(pairs) == 4000
    for first, second in zip(pairs[::2], pairs[1::2], strict=True):
        np.testing.assert_array_equal(first[0], second[0])
        np.testing.assert_allclose(second[1], 1 - first[1])
        indices = np.rint((first[1] - 0.01) / (0.98 / 19)).astype(int)
        np.testing.assert_array_equal(first[0], y[indices])
        assert len(first[0]) == 20


def test_metric_arithmetic_matches_sklearn_with_ties():
    rng = np.random.default_rng(27)
    for _ in range(30):
        y = rng.integers(0, 2, 40)
        p = rng.integers(0, 5, 40) / 4
        expected = [roc_auc_score(y, p), average_precision_score(y, p), brier_score_loss(y, p)]
        np.testing.assert_allclose(bootstrap.scores(y, p), expected, rtol=1e-13, atol=1e-13)


def test_direct_sklearn_resampling_oracle():
    y, lr, hgb = vectors()
    result = bootstrap.bootstrap_group(y, lr, hgb)
    rng = np.random.Generator(np.random.PCG64(RULES["seed"]))
    values = []
    for _ in range(2000):
        rows = rng.integers(0, len(y), size=len(y))
        values.append(brier_score_loss(y[rows], hgb[rows]) - brier_score_loss(y[rows], lr[rows]))
    expected = np.quantile(values, [0.025, 0.975], method="linear")
    np.testing.assert_allclose(result["metrics"]["brier"]["interval"]["difference"], expected, atol=1e-14)


@pytest.mark.parametrize("n,reason", [(0, "empty_group"), (19, "insufficient_rows")])
def test_small_and_empty_suppress_without_draws(n, reason):
    result = bootstrap.bootstrap_group(np.zeros(n), np.zeros(n), np.zeros(n))
    assert result["attempted_replicates"] == 0
    for value in result["metrics"].values():
        assert value["interval"]["reason"] == reason
        assert value["interval"]["lr"] is None
        assert value["point"]["difference"]["value"] is None


def test_single_class_and_insufficient_valid_replicates():
    single = bootstrap.bootstrap_group(np.zeros(20), np.zeros(20), np.ones(20))
    assert single["metrics"]["auroc"]["interval"]["invalid_replicates"] == 2000
    assert single["metrics"]["pr_auc"]["interval"]["reason"] == "single_class"
    assert single["metrics"]["brier"]["interval"]["valid_replicates"] == 2000
    rare = bootstrap.bootstrap_group(np.r_[np.zeros(19), 1], np.full(20, 0.1), np.full(20, 0.2))
    for name in ("auroc", "pr_auc"):
        interval = rare["metrics"][name]["interval"]
        assert interval["valid_replicates"] + interval["invalid_replicates"] == 2000
        assert interval["valid_replicates"] < 1900
        assert interval["reason"] == "insufficient_valid_replicates"
        assert interval["difference"] is None


def test_valid_count_threshold_is_exact():
    y, lr, hgb = vectors()
    points = metrics(y, lr), metrics(y, hgb)
    draws = np.zeros((2000, 2, 3))
    draws[:100, :, :2] = np.nan
    assert bootstrap.summarize_draws(points, draws, 40)["metrics"]["auroc"]["interval"]["status"] == "ok"
    draws[100, :, :2] = np.nan
    assert bootstrap.summarize_draws(points, draws, 40)["metrics"]["auroc"]["interval"]["difference"] is None


@pytest.mark.parametrize("bad", [np.nan, np.inf, -0.1, 1.1])
def test_nonfinite_or_out_of_range_input_rejected(bad):
    y, lr, hgb = vectors()
    hgb[0] = bad
    with pytest.raises(ValueError):
        bootstrap.bootstrap_group(y, lr, hgb)


def test_reproduction_checks_all_structure_and_fixed_tolerance():
    same_result({"x": 0.5, "rows": 20}, {"x": 0.5 + 1e-11, "rows": 20})
    for other in (
        {"x": 0.501, "rows": 20},
        {"x": 0.5, "rows": 21},
        {"x": float("nan"), "rows": 20},
        {"x": 0.5, "rows": 20.0},
    ):
        with pytest.raises(ValueError):
            same_result(other, {"x": 0.5, "rows": 20})


@pytest.fixture
def completed_uncertainty(request):
    workspace = request.getfixturevalue("comparison_workspace")
    repo, splits, comparison_output = workspace
    baseline = invoke(workspace)
    assert baseline.returncode == 0, baseline.stderr
    approved = (comparison_output / "comparison-evidence.json").read_bytes()
    (repo / "docs/evidence/model-comparison.json").write_bytes(approved)
    commit(repo)
    output = comparison_output.parent / "uncertainty output"
    # Audit actual CLI: reject test and all file writes except aggregates/failure.
    # The OS null device used by subprocess discovery cannot persist data.
    script = """
import os,pathlib,runpy,sys
root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2])
def audit(event,args):
    if event=='open' and isinstance(args[0],(str,bytes)):
        path=pathlib.Path(os.fsdecode(args[0])).resolve()
        if path.name=='test.parquet': raise RuntimeError('test access forbidden')
        writing=args[2] & (os.O_WRONLY|os.O_RDWR|os.O_CREAT|os.O_TRUNC|os.O_APPEND)
        if writing and path not in {out/'uncertainty-evidence.json',out/'failure.json',pathlib.Path(os.devnull).resolve()}:
            print('Synthetic audit blocked file write: '+str(path),file=sys.stderr)
            raise RuntimeError('private output forbidden')
sys.addaudithook(audit)
sys.argv=[str(root/'scripts/model/validation_uncertainty.py'),'--split-dir',sys.argv[3],'--work-dir',str(out)]
runpy.run_path(sys.argv[0],run_name='__main__')
"""
    result = subprocess.run(
        [sys.executable, "-c", script, str(repo), str(output), str(splits)],
        env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    evidence = json.loads((output / "uncertainty-evidence.json").read_text())
    return repo, splits, output, json.loads(approved), evidence


def test_real_cli_only_aggregates_and_verifier(completed_uncertainty):
    repo, splits, output, reference, evidence = completed_uncertainty
    validate_uncertainty(evidence, reference)
    assert evidence["original_execution_commit"] == reference["execution_commit"]
    assert evidence["execution_commit"] != reference["execution_commit"]
    assert {p.name for p in output.iterdir()} == {"uncertainty-evidence.json"}
    assert not (splits / "test.parquet").exists()
    result = subprocess.run(
        [
            sys.executable,
            str(repo / "scripts/ci/verify_model_uncertainty.py"),
            "--evidence",
            str(output / "uncertainty-evidence.json"),
        ],
        capture_output=True,
    )
    assert result.returncode == 0


def test_verifier_rejects_tampering(completed_uncertainty):
    _, _, _, reference, evidence = completed_uncertainty
    mutations = [
        lambda x: x["uncertainty_config"].update(seed=1),
        lambda x: x.update(uncertainty_config_sha256="a" * 64),
        lambda x: x["groups"]["overall"]["metrics"]["brier"]["interval"].update(lr=[0.9, 0.1]),
        lambda x: x["groups"]["overall"]["metrics"]["brier"]["interval"].update(valid_replicates=1999),
        lambda x: x["groups"]["overall"]["metrics"]["brier"]["interval"].update(difference=[float("nan"), 1]),
        lambda x: x["groups"]["overall"]["metrics"]["brier"]["point"]["difference"].update(value=0.5),
        lambda x: x["groups"]["sex_missing"]["metrics"]["brier"]["interval"].update(lr=[0, 1]),
        lambda x: x["groups"]["overall"]["metrics"]["auroc"]["interval"].update(
            valid_replicates=1899, invalid_replicates=101
        ),
        lambda x: x.update(samples=[]),
        lambda x: x.update(release_approved=True),
    ]
    for mutate in mutations:
        altered = copy.deepcopy(evidence)
        mutate(altered)
        with pytest.raises(ValueError):
            validate_uncertainty(altered, reference)


def test_mismatch_stops_before_bootstrap_and_preserves(tmp_path, monkeypatch):
    monkeypatch.setattr(runner, "environment", lambda: None)
    monkeypatch.setattr(runner, "git", lambda *args: "a" * 40 if args[0] == "rev-parse" else "")
    reference = {"provenance": {}}
    monkeypatch.setattr(runner, "load_reference", lambda: reference)
    monkeypatch.setattr(runner, "load_inputs", lambda path: ({}, {}, {}, {}))

    def mismatch(*args):
        raise ValueError("private mismatch values")

    monkeypatch.setattr(runner, "reproduce", mismatch)

    def forbidden(*args):
        pytest.fail("bootstrap called after mismatch")

    monkeypatch.setattr(runner, "bootstrap_reports", forbidden)
    output = tmp_path / "output"
    with pytest.raises(RuntimeError, match="refit_and_reproduction"):
        runner.run(tmp_path / "inputs", output)
    before = (output / "failure.json").read_bytes()
    assert b"private" not in before
    assert not (output / "uncertainty-evidence.json").exists()
    with pytest.raises(ValueError):
        runner.run(tmp_path / "inputs", output)
    assert (output / "failure.json").read_bytes() == before


def test_each_model_fits_once_before_all_bootstrap_draws(monkeypatch):
    from scripts.data.contract import load_manifest
    from scripts.data.preparation import derive_table, split_table
    from scripts.model import compare_baselines as comparison
    from scripts.model.evaluate_predictions import relative_comparison
    from tests.data.test_preparation import synthetic_modules

    manifest = load_manifest()
    frames, fills = split_table(derive_table(synthetic_modules(manifest, 200), manifest), manifest)
    reports = comparison.fit_reports(manifest, frames, fills)
    reference = {"models": reports, "relative_comparison": relative_comparison(reports)}
    models = comparison.model_factories()
    counts = {name: 0 for name in models}
    for name, model in models.items():
        original = model.fit

        def fit(x, y, name=name, original=original):
            counts[name] += 1
            return original(x, y)

        monkeypatch.setattr(model, "fit", fit)
    monkeypatch.setattr(comparison, "model_factories", lambda: models)
    predictions = runner.reproduce(manifest, frames, fills, reference)
    bootstrap.bootstrap_reports(frames["validation"], predictions, manifest["label"]["name"])
    assert all(value == 1 for value in counts.values())


def test_unavailable_labels_and_mismatched_lengths_fail():
    with pytest.raises(ValueError):
        bootstrap.bootstrap_group([np.nan] * 20, [0.5] * 20, [0.5] * 20)
    with pytest.raises(ValueError):
        bootstrap.bootstrap_group([0, 1] * 10, [0.5] * 20, [0.5] * 19)
