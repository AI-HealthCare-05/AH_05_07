import hashlib
from pathlib import Path

from pydantic import BaseModel


class ModelArtifactMetadata(BaseModel):
    model_version: str
    split_digest: str
    features: list[str]
    artifact_sha256: str


def load_verified_metadata(
    path: Path, expected_features: list[str], expected_split_digest: str
) -> ModelArtifactMetadata:
    metadata = ModelArtifactMetadata.model_validate_json(path.read_text(encoding="utf-8"))
    if metadata.features != expected_features:
        raise ValueError("model artifact feature order does not match the contract")
    if metadata.split_digest != expected_split_digest:
        raise ValueError("model artifact split digest does not match the contract")
    return metadata


def verify_artifact_hash(artifact_path: Path, metadata: ModelArtifactMetadata) -> None:
    digest = hashlib.sha256(artifact_path.read_bytes()).hexdigest()
    if digest != metadata.artifact_sha256:
        raise ValueError("model artifact hash does not match metadata")
