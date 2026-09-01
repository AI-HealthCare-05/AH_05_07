import hashlib

import pytest

from app.core.model_artifact import ModelArtifactMetadata, load_verified_metadata, verify_artifact_hash


def test_accepts_matching_artifact_hash(tmp_path):
    artifact = tmp_path / "model.bin"
    artifact.write_bytes(b"verified")
    metadata = ModelArtifactMetadata(
        model_version="test",
        split_digest="split",
        features=["feature"],
        artifact_sha256=hashlib.sha256(b"verified").hexdigest(),
    )

    verify_artifact_hash(artifact, metadata)


def test_rejects_mismatched_artifact_hash(tmp_path):
    artifact = tmp_path / "model.bin"
    artifact.write_bytes(b"unverified")
    metadata = ModelArtifactMetadata(
        model_version="test",
        split_digest="split",
        features=["feature"],
        artifact_sha256=hashlib.sha256(b"verified").hexdigest(),
    )

    with pytest.raises(ValueError, match="hash"):
        verify_artifact_hash(artifact, metadata)


@pytest.mark.parametrize(
    ("expected_features", "expected_digest", "message"),
    [(["other"], "split", "feature order"), (["feature"], "other", "split digest")],
)
def test_rejects_metadata_contract_mismatch(tmp_path, expected_features, expected_digest, message):
    metadata_path = tmp_path / "metadata.json"
    metadata_path.write_text(
        '{"model_version":"test","split_digest":"split","features":["feature"],"artifact_sha256":"hash"}',
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match=message):
        load_verified_metadata(metadata_path, expected_features, expected_digest)
