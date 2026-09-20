"""Focused tests for deterministic Run10 Learning Record conversion."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import pytest

from app.core.contracts.learning_record import validate_learning_record
from scripts.data.convert_run10_learning_records import (
    ConversionError,
    Run10Archive,
    _load_inputs,
    _opaque_id,
    convert_run10,
    validate_run10_corpus,
    write_evidence,
)

SOURCE_ZIP = Path(
    os.environ.get(
        "SK7_RUN10_SOURCE_ZIP",
        "/Users/gom/Downloads/SK7_DollSpec_LearningRecord_Stage4/input/SK7_Visual_Factory_Run_20260919_10_DELTA(4).zip",
    )
)


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@pytest.fixture(scope="module")
def conversion() -> tuple[list[dict], dict, str]:
    if not SOURCE_ZIP.is_file():
        pytest.skip(f"Run10 source ZIP not available: {SOURCE_ZIP}")
    return convert_run10(SOURCE_ZIP)


def _by_source(records: list[dict]) -> dict[str, dict]:
    return {record["extensions"]["run10"]["sourcePath"]: record for record in records}


def _candidate_map(record: dict) -> dict[str, dict]:
    return {item["candidateId"]: item for item in record["extensions"]["run10"]["candidateMappings"]}


def test_full_run10_conversion_and_counts(conversion: tuple[list[dict], dict, str]) -> None:
    records, validation, _ = conversion
    assert validation["valid"] is True
    assert validation["sourceFacts"] == {
        "meshSourceVersions": 8,
        "compositionSceneSources": 2,
        "records": 10,
        "presentations": 14,
        "retain": 5,
        "reject": 9,
        "pending": 0,
    }
    assert validation["convertedFacts"] == {
        "records": 10,
        "presentations": 14,
        "retain": 5,
        "reject": 9,
        "pending": 0,
    }
    assert all(validate_learning_record(record) for record in records)


def test_internal_references_and_candidate_mapping(conversion: tuple[list[dict], dict, str]) -> None:
    _, validation, _ = conversion
    assert validation["references"]["valid"] is True
    assert validation["references"]["unresolved"] == []
    assert validation["candidateMapping"] == {
        "valid": True,
        "sourceCandidates": 14,
        "mappedExactlyOnce": 14,
    }
    assert validation["repairs"]["cycles"] == 0


def test_hand_trowel_presentations_remain_distinct(conversion: tuple[list[dict], dict, str]) -> None:
    records, _, _ = conversion
    record = _by_source(records)["source/hand-trowel-f10-v1.glb"]
    candidates = _candidate_map(record)
    assert candidates["hand-trowel-a-v1-f10"]["presentationId"] != candidates["hand-trowel-b-v1-f10"]["presentationId"]
    assert {decision["disposition"] for decision in record["decisions"]} == {"retain", "reject"}
    comparison = record["comparisons"][0]
    assert comparison["dimensionResults"][0]["outcome"] == "prefer-right"


def test_watering_repair_preserves_separate_authorities(conversion: tuple[list[dict], dict, str]) -> None:
    records, _, _ = conversion
    by_source = _by_source(records)
    v1 = by_source["source/watering-can-f10-v1.glb"]
    v2 = by_source["source/watering-can-f10-v2.glb"]
    repair = next(item for item in v2["lineage"]["relations"] if item["type"] == "repair-of")
    assert repair["target"] == {"kind": "learning-record", "id": v1["recordId"]}
    assert any(item["type"] == "reuses-geometry-from" for item in v2["lineage"]["relations"])
    assert all(decision["ownerApproval"]["value"] == "pending" for decision in v2["decisions"])
    assert all(decision["productionActivation"]["value"] is False for decision in v2["decisions"])
    assert any(item["kind"] == "native-runtime" and item["verdict"] == "not-tested" for item in v2["evaluations"])
    assert all(decision["disposition"] == "reject" for decision in v1["decisions"])
    assert all(decision["disposition"] == "retain" for decision in v2["decisions"])


def test_folded_cloth_v2_is_rejected_with_independent_dimensions(
    conversion: tuple[list[dict], dict, str],
) -> None:
    records, _, _ = conversion
    record = _by_source(records)["source/folded-cloth-f10-v2.glb"]
    assert all(decision["disposition"] == "reject" for decision in record["decisions"])
    outcomes = {item["dimension"]: item["outcome"] for item in record["comparisons"][0]["dimensionResults"]}
    assert outcomes == {"performance-budget": "prefer-left", "semantic-readability": "prefer-right"}
    assert record["comparisons"][0]["aggregateOutcome"] == "different-tradeoff"


def test_rice_result_is_non_scalar_and_parent_is_external(conversion: tuple[list[dict], dict, str]) -> None:
    records, _, _ = conversion
    record = _by_source(records)["source/rice-bowl-compact-f10-v2.glb"]
    comparison = record["comparisons"][0]
    assert comparison["leftSubjectRef"]["contentHash"]["value"] == (
        "6f6ef2870f83484114a7355396b0e84bebb7ff2a82295071d5ae4e52bbb874ab"
    )
    assert "kind" not in comparison["leftSubjectRef"]
    assert len(comparison["dimensionResults"]) == 2
    assert comparison["aggregateOutcome"] == "different-tradeoff"
    assert "score" not in json.dumps(comparison).lower()


def test_compositions_have_exact_scene_component_inputs(conversion: tuple[list[dict], dict, str]) -> None:
    records, validation, _ = conversion
    compositions = [record for record in records if record["artifact"]["kind"] == "composition"]
    assert len(compositions) == 2
    assert sorted(len(record["inputs"]) for record in compositions) == [3, 4]
    assert validation["compositions"] == {"valid": True, "sceneComponentInputsChecked": 7}
    for record in compositions:
        assert all(item["role"] == "scene-component" for item in record["inputs"])
        assert len({item["inputId"] for item in record["inputs"]}) == len(record["inputs"])


def test_source_hashes_preserved_and_missing_hash_not_invented(conversion: tuple[list[dict], dict, str]) -> None:
    records, _, _ = conversion
    by_source = _by_source(records)
    assert by_source["source/hand-trowel-f10-v1.glb"]["artifact"]["ref"]["contentHash"]["value"] == (
        "fe38fc498b83e9ad0852be74aba60c2c62ee50eead042b3748f98b4a548cf5bb"
    )
    shore = by_source["source/scenes/shore-study-close-v1-f10.scene.json"]
    legacy_parent = next(item for item in shore["lineage"]["relations"] if item["type"] == "derivative-of")
    assert legacy_parent["target"] == {"locator": "legacy-asset-id:shore-specimen-desk-v3-f8"}


def test_repeat_conversion_and_reports_are_deterministic(
    conversion: tuple[list[dict], dict, str], tmp_path: Path
) -> None:
    records1, validation1, archive_hash1 = conversion
    records2, validation2, archive_hash2 = convert_run10(SOURCE_ZIP)
    assert records1 == records2
    assert validation1 == validation2
    assert archive_hash1 == archive_hash2
    out1 = tmp_path / "one"
    out2 = tmp_path / "two"
    write_evidence(records1, validation1, SOURCE_ZIP, archive_hash1, out1)
    write_evidence(records2, validation2, SOURCE_ZIP, archive_hash2, out2)
    files1 = sorted(path.relative_to(out1) for path in out1.rglob("*") if path.is_file())
    files2 = sorted(path.relative_to(out2) for path in out2.rglob("*") if path.is_file())
    assert files1 == files2
    assert all((out1 / path).read_bytes() == (out2 / path).read_bytes() for path in files1)


def test_source_archive_sha256_unchanged(conversion: tuple[list[dict], dict, str]) -> None:
    _, _, recorded_hash = conversion
    assert recorded_hash == "17c1f792c73ab29f1fda725166b48c4fb5806567820e167e08af7f01d95d71ff"
    assert _sha256(SOURCE_ZIP) == recorded_hash


def test_identical_bytes_do_not_collapse_distinct_attempt_ids() -> None:
    content_hash = "a" * 64
    first = _opaque_id("lr", "run", "attempt-a", "source/a.glb", content_hash)
    second = _opaque_id("lr", "run", "attempt-b", "source/b.glb", content_hash)
    assert first != second


@pytest.mark.parametrize("section", ["run_summary", "source_manifest", "decision_ledger"])
def test_production_activation_contradictions_fail(section: str, conversion: tuple[list[dict], dict, str]) -> None:
    records, _, _ = conversion
    with Run10Archive(SOURCE_ZIP) as archive:
        inputs = _load_inputs(archive)
    if section == "run_summary":
        inputs[section]["productionActivation"] = True
    elif section == "source_manifest":
        inputs[section]["sources"][0]["productionActivation"] = True
    else:
        inputs[section]["items"][0]["productionActivation"] = True
    with pytest.raises(ConversionError, match="productionActivation"):
        validate_run10_corpus(records, inputs)
