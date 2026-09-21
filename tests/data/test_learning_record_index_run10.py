"""Acceptance test for LearningRecordIndex against immutable Run10 evidence."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path

import pytest

from app.core.learning_record_index import build_learning_record_index
from scripts.data.convert_run10_learning_records import convert_run10

EXPECTED_SOURCE_SHA256 = "17c1f792c73ab29f1fda725166b48c4fb5806567820e167e08af7f01d95d71ff"
SOURCE_ZIP = Path(os.environ.get("SK7_RUN10_SOURCE_ZIP", ""))


@pytest.fixture(scope="module")
def corpus() -> tuple[list[dict], object]:
    if not SOURCE_ZIP.is_file():
        pytest.skip("SK7_RUN10_SOURCE_ZIP is required for Run10 LearningRecordIndex acceptance")

    assert hashlib.sha256(SOURCE_ZIP.read_bytes()).hexdigest() == EXPECTED_SOURCE_SHA256
    records, validation, _ = convert_run10(SOURCE_ZIP)
    assert validation["valid"] is True
    return records, build_learning_record_index(records)


def test_run10_learning_record_index_acceptance(corpus: tuple[list[dict], object]) -> None:
    records, index = corpus

    assert len(records) == 10
    assert len({record["episodeId"] for record in records}) == 7
    assert sum(len(record.get("presentations") or []) for record in records) == 14

    repair_records = [
        record
        for record in records
        if any(relation["type"] == "repair-of" for relation in (record.get("lineage") or {}).get("relations") or [])
    ]
    assert len(repair_records) == 3
    assert index.unresolved_learning_record_refs == ()
    assert all(index.repair_chain(record["recordId"]).unresolved_target_id is None for record in repair_records)

    decisions = [decision for record in records for decision in record.get("decisions") or []]
    assert len(decisions) == 14
    assert sum(decision["disposition"] == "retain" for decision in decisions) == 5
    assert sum(decision["disposition"] == "reject" for decision in decisions) == 9
    assert all(decision["productionActivation"]["value"] is False for decision in decisions)
    assert all(decision["ownerApproval"]["value"] == "pending" for decision in decisions)
