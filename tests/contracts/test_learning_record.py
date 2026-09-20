"""Tests for SK7 Learning Record v0.1 machine contract."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
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
    assert "extra" in str(exc_info.value).lower() or "field required" in str(exc_info.value).lower()


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


@pytest.mark.parametrize(
    ("omit_evidence", "ref", "message"),
    [
        (True, {"kind": "artifact", "id": "art-hand-trowel-v1"}, "evidenceRef kind"),
        (True, {"kind": "evidence", "id": "missing"}, "unknown evidenceId"),
        (False, {"kind": "artifact", "id": "art-hand-trowel-v1"}, "evidenceRef kind"),
        (False, {"kind": "evidence", "id": "missing"}, "unknown evidenceId"),
    ],
)
def test_evidence_refs_are_always_evidence_only_and_local(
    omit_evidence: bool, ref: dict[str, str], message: str
) -> None:
    rec = _load("learning_record_complete_valid.json")
    if omit_evidence:
        rec.pop("evidence")
    rec["evaluations"][0]["evidenceRefs"] = [ref]
    with pytest.raises(ValidationError, match=message):
        validate_learning_record(rec)


def test_evidence_refs_resolve_to_local_evidence() -> None:
    rec = _load("learning_record_complete_valid.json")
    result = validate_learning_record(rec)
    assert result.evaluations[0].evidenceRefs[0].id == result.evidence[0].evidenceId


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda rec: rec["evaluations"][0]["subjectRef"].update(kind="evidence"), "evaluation subjectRef"),
        (lambda rec: rec["decisions"][0]["subjectRef"].update(kind="evidence"), "decision subjectRef"),
        (
            lambda rec: rec["evaluations"][0]["evidenceRefs"].__setitem__(0, {"kind": "artifact", "id": "x"}),
            "evidenceRef",
        ),
        (
            lambda rec: rec.setdefault("lineage", {"relations": []})["relations"].append(
                {"type": "repair-of", "target": {"kind": "artifact", "id": "x"}}
            ),
            "repair-of",
        ),
        (
            lambda rec: rec.setdefault("lineage", {"relations": []})["relations"].append(
                {"type": "supersedes", "target": {"kind": "input", "id": "x"}}
            ),
            "supersedes",
        ),
        (
            lambda rec: rec.setdefault("lineage", {"relations": []})["relations"].append(
                {"type": "reuses-geometry-from", "target": {"kind": "learning-record", "id": "x"}}
            ),
            "reuses-geometry",
        ),
        (
            lambda rec: rec.setdefault("lineage", {"relations": []})["relations"].append(
                {"type": "derivative-of", "target": {"kind": "presentation", "id": "x"}}
            ),
            "derivative-of",
        ),
    ],
)
def test_typed_reference_contexts_reject_invalid_endpoints(mutate: object, message: str) -> None:
    rec = _load("learning_record_complete_valid.json")
    mutate(rec)
    with pytest.raises(ValidationError, match=message):
        validate_learning_record(rec)


@pytest.mark.parametrize("state", ["partial", "aborted"])
def test_artifactless_empty_build_requires_explanation(state: str) -> None:
    rec = _load("learning_record_partial_valid.json")
    rec.update(recordState=state, build={}, limitations=[])
    with pytest.raises(ValidationError, match="requires"):
        validate_learning_record(rec)


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda rec: rec.update(artifact=None), "requires a primary artifact"),
        (
            lambda rec: rec.update(artifact=None, build=None, limitations=[]),
            "requires limitations and/or build",
        ),
        (
            lambda rec: (rec.pop("artifact", None), rec.update(build=None, limitations=[])),
            "requires limitations and/or build",
        ),
        (
            lambda rec: (rec.pop("artifact", None), rec.update(build={"operationId": None}, limitations=[])),
            "requires limitations and/or build",
        ),
    ],
    ids=[
        "complete-null-artifact",
        "partial-null-artifact",
        "partial-omitted-artifact-null-build",
        "partial-null-only-build",
    ],
)
def test_state_condition_null_cases_fail_in_model_and_schema(mutate: object, message: str) -> None:
    from scripts.data.generate_sk7_contract_schemas import learning_record_schema

    rec = _load("learning_record_complete_valid.json")
    if message != "requires a primary artifact":
        rec = _load("learning_record_partial_valid.json")
    mutate(rec)

    with pytest.raises(ValidationError, match=message):
        validate_learning_record(rec)
    assert list(Draft202012Validator(learning_record_schema()).iter_errors(rec))


def test_learning_record_schema_uses_draft_validator_and_matches_generator() -> None:
    from scripts.data.generate_sk7_contract_schemas import learning_record_schema

    schema_path = Path(__file__).parent.parent.parent / "docs" / "sk7.learning-record.v0.1.schema.json"
    schema = json.loads(schema_path.read_text())
    Draft202012Validator.check_schema(schema)
    assert schema == learning_record_schema()
    assert not list(Draft202012Validator(schema).iter_errors(_load("learning_record_complete_valid.json")))
    invalid = _load("learning_record_complete_missing_artifact_invalid.json")
    assert list(Draft202012Validator(schema).iter_errors(invalid))
