"""Synthetic-only integration and leakage boundary regression."""

import copy
import json
import os
import shutil
import subprocess
import sys
import warnings

import numpy as np
import pytest
from sklearn.exceptions import ConvergenceWarning

from scripts.data.contract import ROOT, load_manifest
from scripts.data.preparation import derive_table, sha256, split_table, write_splits
from scripts.model import compare_baselines as comparison
from scripts.model.comparison_evidence import validate_evidence
from scripts.model.evaluate_predictions import calibration, metrics, relative_comparison, report
from tests.data.test_preparation import synthetic_modules


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, check=True).stdout


def commit(repo):
    git(repo, "add", ".")
    git(
        repo,
        "-c",
        "user.name=Synthetic Test",
        "-c",
        "user.email=synthetic@example.invalid",
        "commit",
        "-m",
        "synthetic fixture",
    )


@pytest.fixture
def workspace(tmp_path):
    repo = tmp_path / "clean checkout"
    repo.mkdir()
    for name in ("scripts", "docs", "data/manifest"):
        shutil.copytree(ROOT / name, repo / name, ignore=shutil.ignore_patterns("__pycache__"))
    for name in (".python-version", "uv.lock", ".gitattributes"):
        shutil.copyfile(ROOT / name, repo / name)
    manifest = load_manifest()
    table = derive_table(synthetic_modules(manifest, count=400), manifest)
    partitions, fills = split_table(table, manifest)
    splits = tmp_path / "frozen inputs"
    metadata = write_splits(partitions, fills, splits, manifest)
    # The comparator must work without the test file; hashes alone remain in metadata.
    (splits / "test.parquet").unlink()
    gate = json.loads((repo / "docs/evidence/model-gate-1b.json").read_text())
    gate.update(
        {
            "row_counts": {"total": len(table), **metadata["row_counts"]},
            "partition_sha256": metadata["partition_sha256"],
            "split_digest": metadata["split_digest"],
            "manifest_sha256": sha256(repo / "data/manifest/nhanes_2017_2020.json"),
            "toolchain_lock_sha256": sha256(repo / "uv.lock"),
        }
    )
    (repo / "docs/evidence/model-gate-1b.json").write_text(json.dumps(gate), encoding="utf-8")
    git(repo, "init")
    commit(repo)
    return repo, splits, tmp_path / "new output"


def invoke(workspace, output=None):
    repo, splits, default = workspace
    return subprocess.run(
        [
            sys.executable,
            str(repo / "scripts/model/compare_baselines.py"),
            "--split-dir",
            str(splits),
            "--work-dir",
            str(output or default),
        ],
        env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
        capture_output=True,
        text=True,
        timeout=90,
    )


def test_real_cli_reproducibility_verifier_and_preservation(workspace):
    repo, splits, output = workspace
    first = invoke(workspace)
    assert first.returncode == 0, first.stdout + first.stderr
    original = (output / "comparison-evidence.json").read_bytes()
    second_dir = output.parent / "second output"
    assert invoke(workspace, second_dir).returncode == 0
    assert original == (second_dir / "comparison-evidence.json").read_bytes()
    assert invoke(workspace).returncode == 1
    assert original == (output / "comparison-evidence.json").read_bytes()
    assert not (splits / "test.parquet").exists()
    result = subprocess.run(
        [
            sys.executable,
            str(repo / "scripts/ci/verify_model_comparison.py"),
            "--evidence",
            str(output / "comparison-evidence.json"),
        ],
        capture_output=True,
    )
    assert result.returncode == 0
    assert {p.name for p in output.iterdir()} == {"comparison-evidence.json"}
    assert not list(repo.rglob("*.parquet")) and not list(repo.rglob("*.joblib"))


@pytest.mark.parametrize("mutation", ["hash", "features", "semantics", "fills", "gate", "dirty"])
def test_preflight_rejects_tampering_before_output(workspace, mutation):
    repo, splits, output = workspace
    path = splits / "split_metadata.json"
    metadata = json.loads(path.read_text())
    if mutation == "hash":
        with (splits / "train.parquet").open("ab") as stream:
            stream.write(b"tamper")
    elif mutation == "features":
        metadata["features"].reverse()
    elif mutation == "semantics":
        metadata["semantics_version"] = 1
    elif mutation == "fills":
        metadata["fill_values"]["BMXBMI"] = 99
    elif mutation == "gate":
        gate_path = repo / "docs/evidence/model-gate-1b.json"
        gate = json.loads(gate_path.read_text())
        gate["private"] = "not allowed"
        gate_path.write_text(json.dumps(gate))
        commit(repo)
    else:
        (repo / "dirty.txt").write_text("preserve")
    path.write_text(json.dumps(metadata))
    assert invoke(workspace).returncode == 1
    assert not output.exists()


def test_identical_model_inputs_and_train_only_preprocessing(monkeypatch):
    manifest = load_manifest()
    frame = derive_table(synthetic_modules(manifest), manifest)
    parts, fills = split_table(frame, manifest)
    parts["validation"]["BMXBMI"] = 70.0
    captured = []
    actual = comparison.make_preprocessor

    def preprocessor(m, f):
        transform = actual(m, f)
        original_fit = transform.fit_transform

        def fit(x, *args, **kwargs):
            assert len(x) == len(parts["train"])
            assert list(x.columns) == manifest["candidate_predictors"]
            assert x.BMXBMI.eq(24).all()
            return original_fit(x, *args, **kwargs)

        transform.fit_transform = fit
        return transform

    class Spy:
        classes_ = np.array([0, 1])

        def fit(self, x, y):
            captured.append((x.copy(), y.copy()))

        def predict_proba(self, x):
            return np.tile([0.5, 0.5], (len(x), 1))

    monkeypatch.setattr(comparison, "make_preprocessor", preprocessor)
    monkeypatch.setattr(
        comparison, "model_factories", lambda: {"logistic_regression": Spy(), "histogram_gradient_boosting": Spy()}
    )
    comparison.fit_reports(manifest, parts, fills)
    assert len(captured) == 2
    np.testing.assert_array_equal(captured[0][0], captured[1][0])
    np.testing.assert_array_equal(captured[0][1], captured[1][1])


def test_calibration_boundaries_and_subgroup_exceptions():
    bins = calibration(np.zeros(40), np.array([0.0] * 20 + [1.0] * 20))
    assert bins[0]["rows"] == bins[9]["rows"] == 20
    assert bins[1]["observed"]["reason"] == "empty_bin"
    assert metrics([], [])["auroc"]["reason"] == "empty_group"
    assert metrics([0], [0.5])["brier"]["reason"] == "insufficient_rows"
    assert metrics(np.zeros(20), np.zeros(20))["auroc"]["reason"] == "single_class"
    assert metrics(np.zeros(20), np.zeros(20))["brier"]["value"] == 0
    manifest = load_manifest()
    frame = derive_table(synthetic_modules(manifest), manifest)
    result = report(frame, np.full(len(frame), 0.5), manifest["label"]["name"])
    assert result["subgroups"]["sex_2"]["auroc"]["reason"] == "empty_group"
    assert result["subgroups"]["age_60_80"]["auroc"]["reason"] == "empty_group"
    json.dumps(result, allow_nan=False)


@pytest.mark.parametrize("bad", [np.nan, np.inf, -0.1, 1.1])
def test_invalid_probability_fails(bad):
    with pytest.raises(ValueError):
        metrics([1], [bad])


def test_warning_stops_second_model(monkeypatch):
    manifest = load_manifest()
    parts, fills = split_table(derive_table(synthetic_modules(manifest), manifest), manifest)

    class WarningModel:
        def fit(self, x, y):
            warnings.warn("private marker", ConvergenceWarning, stacklevel=2)

    monkeypatch.setattr(comparison, "model_factories", lambda: {"logistic_regression": WarningModel()})
    with pytest.raises(ConvergenceWarning):
        comparison.fit_reports(manifest, parts, fills)


def test_evidence_rejects_extra_nested_fields_and_nonfinite(workspace):
    repo, _, output = workspace
    assert invoke(workspace).returncode == 0
    value = json.loads((output / "comparison-evidence.json").read_text())
    gate = json.loads((repo / "docs/evidence/model-gate-1b.json").read_text())
    for mutate in (
        lambda x: x.update({"predictions": []}),
        lambda x: x["models"]["logistic_regression"]["overall"].update({"labels": []}),
        lambda x: x["models"]["logistic_regression"]["overall"]["brier"].update({"value": float("nan")}),
        lambda x: x.update({"release_approved": True}),
        lambda x: x["provenance"]["features"].append("SEQN"),
    ):
        bad = copy.deepcopy(value)
        mutate(bad)
        with pytest.raises(ValueError):
            validate_evidence(bad, gate, load_manifest(), sha256(repo / "uv.lock"))


def test_relative_rule_keeps_strict_pr_auc():
    base = metrics([0, 1] * 20, [0.2, 0.8] * 20)
    values = {name: {"overall": copy.deepcopy(base)} for name in ("logistic_regression", "histogram_gradient_boosting")}
    assert relative_comparison(values) == "retain_logistic_baseline"
    values["histogram_gradient_boosting"]["overall"]["auroc"] = {"status": "unavailable"}
    assert relative_comparison(values) == "not_computable"


def test_failed_fit_leaves_only_sanitized_status_and_cannot_overwrite(tmp_path, monkeypatch):
    manifest = load_manifest()
    parts, fills = split_table(derive_table(synthetic_modules(manifest), manifest), manifest)
    monkeypatch.setattr(comparison, "environment", lambda: None)
    monkeypatch.setattr(comparison, "git", lambda *args: "a" * 40 if args[0] == "rev-parse" else "")
    monkeypatch.setattr(comparison, "load_inputs", lambda path: (manifest, parts, fills, {}))

    def fail(*args):
        raise ConvergenceWarning("private marker never published")

    monkeypatch.setattr(comparison, "fit_reports", fail)
    output = tmp_path / "output"
    with pytest.raises(RuntimeError, match="convergence_warning"):
        comparison.run(tmp_path / "inputs", output)
    before = (output / "failure.json").read_bytes()
    assert b"private" not in before
    assert json.loads(before)["stage"] == "fit_and_validation"
    assert not (output / "comparison-evidence.json").exists()
    with pytest.raises(ValueError, match="output_exists"):
        comparison.run(tmp_path / "inputs", output)
    assert before == (output / "failure.json").read_bytes()


def test_validation_values_cannot_change_training_statistics():
    manifest = load_manifest()
    parts, fills = split_table(derive_table(synthetic_modules(manifest), manifest), manifest)
    features = manifest["candidate_predictors"]
    transform = comparison.make_preprocessor(manifest, fills)
    before = transform.fit_transform(parts["train"][features])
    parts["validation"]["BMXBMI"] = np.nan
    transformed = transform.transform(parts["validation"][features])
    assert np.isfinite(transformed).all()
    np.testing.assert_array_equal(before, transform.transform(parts["train"][features]))


def test_calibration_internal_boundary_and_single_class_pr_auc():
    bins = calibration(np.zeros(40), np.array([0.1] * 20 + [0.2] * 20))
    assert bins[1]["rows"] == bins[2]["rows"] == 20
    assert metrics(np.ones(20), np.ones(20))["pr_auc"]["reason"] == "single_class"


@pytest.mark.parametrize("mutation", ["order", "bp", "identifier", "invalid_label"])
def test_frozen_frame_contract_rejects_leakage_and_order(mutation):
    from scripts.model.comparison_inputs import validate_frame

    manifest = load_manifest()
    frame = derive_table(synthetic_modules(manifest), manifest)
    if mutation == "order":
        frame = frame[frame.columns[::-1]]
    elif mutation == "bp":
        frame["BPXOSY1"] = 120
    elif mutation == "identifier":
        frame.loc[0, "SEQN"] = frame.loc[1, "SEQN"]
    else:
        frame.loc[0, manifest["label"]["name"]] = 3
    with pytest.raises(ValueError):
        validate_frame(frame, manifest, len(frame))
