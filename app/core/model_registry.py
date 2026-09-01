import os
from pathlib import Path

from app.core.model_artifact import load_verified_metadata, verify_artifact_hash


def verified_model_is_available(expected_features: list[str], expected_split_digest: str) -> bool:
    artifact_value = os.getenv("RISK_MODEL_ARTIFACT")
    metadata_value = os.getenv("RISK_MODEL_METADATA")
    if not artifact_value or not metadata_value:
        return False

    artifact_path = Path(artifact_value)
    metadata_path = Path(metadata_value)
    if not artifact_path.is_file() or not metadata_path.is_file():
        return False

    try:
        metadata = load_verified_metadata(metadata_path, expected_features, expected_split_digest)
        verify_artifact_hash(artifact_path, metadata)
    except ValueError:
        return False
    return True
