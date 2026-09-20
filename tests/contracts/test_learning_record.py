"""Tests for SK7 Learning Record v0.1 machine contract."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.contracts.learning_record import validate_learning_record

FIXTURES = Path(__file__).parent.parent / "fixtures" / "learning_record"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def test_schema_file_compiles() -> None:
    schema_path = Path(__file__).parent.parent.parent / "docs" / "sk7.learning-record.v0.1.schema.json"
    schema = json.loads(schema_path.read_text())
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["properties"]["schema"]["const"] == "sk7.learning-record"


def test_complete_record_with_artifact_is_valid() -> None:
    rec = _load("learning_record_complete_valid.json")
    result = validate_learning_record(rec)
    assert result.recordState == "complete"
    assert result.artifact is not None
    assert result.artifact.artifactId == "art-hand-trowel-v1"


def test_partial_record_without_artifact_is_valid() -> None:
    rec = _load("learning_record_partial_valid.json")
    result = validate_learning_record(rec)
    assert result.recordState == "partial"
    assert result.artifact is None
    assert result.limitations


def test_complete_record_without_artifact_is_invalid() -> None:
    rec = _load("learning_record_complete_missing_artifact_invalid.json")
    with pytest.raises(ValidationError) as exc_info:
        validate_learning_record(rec)
    assert "requires a primary artifact" in str(exc_info.value)


def test_empty_artifact_object_is_invalid() -> None:
    rec = _load("learning_record_empty_artifact_invalid.json")
    with pytest.raises(ValidationError) as exc_info:
        validate_learning_record(rec)
    error = str(exc_info.value)
    assert "artifactId" in error or "field required" in error.lower()


def test_duplicate_local_id_invalid() -> None:
    rec = _load("learning_record_duplicate_local_id_invalid.json")
    with pytest.raises(ValidationError) as exc_info:
        validate_learning_record(rec)
    assert "duplicate local ID" in str(exc_info.value)


def test_ambiguous_reference_is_invalid() -> None:
    rec = _load("learning_record_ambiguous_ref_invalid.json")
    with pytest.raises(ValidationError) as exc_info:
        validate_learning_record(rec)
    assert "exactly one mode" in str(exc_info.value)


def test_presentation_targeted_decision_valid() -> None:
    rec = _load("learning_record_presentation_decision_valid.json")
    result = validate_learning_record(rec)
    decision = result.decisions[0]
    assert decision.subjectRef.kind == "presentation"
    assert decision.subjectRef.id == "pres-1"
    assert decision.productionActivation.value is False


def test_valid_comparison_with_dimension_results() -> None:
    rec = _load("learning_record_comparison_valid.json")
    result = validate_learning_record(rec)
    comparison = result.comparisons[0]
    assert len(comparison.dimensionResults) == 2
    assert comparison.dimensionResults[0].outcome == "prefer-left"
    assert comparison.dimensionResults[1].outcome == "inconclusive"
    assert comparison.aggregateOutcome == "different-tradeoff"


def test_comparison_without_dimension_results_invalid() -> None:
    rec = _load("learning_record_comparison_empty_invalid.json")
    with pytest.raises(ValidationError) as exc_info:
        validate_learning_record(rec)
    assert "dimensionResults" in str(exc_info.value)


def test_valid_repair_of_relation() -> None:
    rec = _load("learning_record_repair_of_valid.json")
    result = validate_learning_record(rec)
    relation = result.lineage.relations[0]
    assert relation.type == "repair-of"
    assert relation.target.kind == "learning-record"


def test_composition_with_scene_component_inputs_valid() -> None:
    rec = _load("learning_record_composition_valid.json")
    result = validate_learning_record(rec)
    assert result.artifact.kind == "composition"
    assert len(result.lineage.relations) == 3
    for relation in result.lineage.relations:
        assert relation.type == "composition-contains"
        assert relation.target.kind == "input"


def test_unknown_not_tested_not_applicable_distinguishable() -> None:
    rec = _load("learning_record_states_valid.json")
    result = validate_learning_record(rec)
    verdicts = {e.verdict for e in result.evaluations}
    assert {"unknown", "not-tested", "not-applicable"} <= verdicts


def test_authority_observations_are_structurally_separate() -> None:
    rec = _load("learning_record_complete_valid.json")
    result = validate_learning_record(rec)
    decision = result.decisions[0]
    assert decision.observation is not None
    assert decision.observation.source == "assistant-visual-review"
    assert decision.ownerApproval.value == "pending"
    assert decision.productionActivation.value is False
    assert decision.ownerApproval.observedAt == decision.productionActivation.observedAt
