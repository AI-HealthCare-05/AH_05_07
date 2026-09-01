from pathlib import Path
from typing import Any

from app.core.model_artifact import ModelArtifactMetadata, verify_artifact_hash


class VerifiedModelRunner:
    def __init__(self, artifact_path: Path, metadata: ModelArtifactMetadata) -> None:
        verify_artifact_hash(artifact_path, metadata)
        self.metadata = metadata
        import joblib

        self.model: Any = joblib.load(artifact_path)

    def predict_probability(self, values: dict[str, Any]) -> float:
        if set(values) != set(self.metadata.features):
            raise ValueError("model input does not match the artifact feature contract")
        import pandas as pd

        frame = pd.DataFrame([[values[name] for name in self.metadata.features]], columns=self.metadata.features)
        probability = self.model.predict_proba(frame)[0, 1]
        return float(probability)
