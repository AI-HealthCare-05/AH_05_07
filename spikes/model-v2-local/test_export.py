"""Focused fail-closed exporter checks; canonical bytes stay outside Git."""

from __future__ import annotations

import importlib.util
import os
from copy import deepcopy
from pathlib import Path

import joblib
import pytest

SPEC = importlib.util.spec_from_file_location("sk7_local_export", Path(__file__).with_name("export.py"))
assert SPEC is not None and SPEC.loader is not None
EXPORT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EXPORT)

from app.services.model_v2_inference import ModelV2ArtifactError  # noqa: E402


def test_hash_mismatch_is_rejected_before_deserialization(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    artifact = tmp_path / "not-canonical.joblib"
    artifact.write_bytes(b"synthetic invalid artifact")

    def must_not_load(*_args, **_kwargs):
        pytest.fail("unverified binary must not be deserialized")

    monkeypatch.setattr(joblib, "load", must_not_load)
    with pytest.raises(ModelV2ArtifactError, match="SHA-256"):
        EXPORT.export(artifact, tmp_path / "output")
    assert not (tmp_path / "output").exists()


def test_repository_output_is_rejected_before_artifact_access() -> None:
    with pytest.raises(ValueError, match="outside repository"):
        EXPORT.export(Path("does-not-exist.joblib"), EXPORT.REPO_ROOT / "spikes/model-v2-local/model")


@pytest.fixture
def canonical_artifact() -> Path:
    configured = os.getenv("SK7_CANONICAL_ARTIFACT_PATH")
    if not configured:
        pytest.skip("set SK7_CANONICAL_ARTIFACT_PATH to run real frozen artifact checks")
    return Path(configured)


def test_real_export_is_deterministic_without_fit(
    canonical_artifact: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def must_not_fit(*_args, **_kwargs):
        pytest.fail("the frozen artifact must never be fitted")

    monkeypatch.setattr(EXPORT.LogisticRegression, "fit", must_not_fit)
    first = EXPORT.export(canonical_artifact, tmp_path / "a")
    second = EXPORT.export(canonical_artifact, tmp_path / "b")
    assert first == second
    assert (tmp_path / "a/model.json").read_bytes() == (tmp_path / "b/model.json").read_bytes()
    assert first["canonical_sha256"] == EXPORT.EXPECTED_ARTIFACT_SHA256
    with pytest.raises(ValueError, match="refusing to overwrite"):
        EXPORT.export(canonical_artifact, tmp_path / "a")


@pytest.mark.parametrize(
    "mutation", ["category_order", "category_type", "coefficient_width", "scaler", "model", "imputer"]
)
def test_unsupported_fitted_structure_is_rejected(canonical_artifact: Path, mutation: str) -> None:
    payload = deepcopy(EXPORT.load_verified_artifact(canonical_artifact, enabled=True))
    pipeline = payload["pipeline"]
    preprocess = pipeline.named_steps["preprocess"]
    numeric = preprocess.named_transformers_["numeric"]
    categorical = preprocess.named_transformers_["categorical"]
    if mutation == "category_order":
        payload["categorical_features"] = list(reversed(payload["categorical_features"]))
    elif mutation == "category_type":
        categorical.named_steps["encoder"].categories_[0] = EXPORT.np.array(["1", "2"])
    elif mutation == "coefficient_width":
        pipeline.named_steps["model"].coef_ = pipeline.named_steps["model"].coef_[:, :-1]
    elif mutation == "scaler":
        numeric.named_steps["scaler"].with_mean = False
    elif mutation == "model":
        pipeline.named_steps["model"].classes_ = EXPORT.np.array([1, 0])
    elif mutation == "imputer":
        categorical.named_steps["imputer"].fill_value = "invented_missing"
    with pytest.raises(ValueError, match="unsupported frozen structure"):
        EXPORT.inspect_frozen(payload)
