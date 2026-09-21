"""Run10 acceptance for companion ↔ Learning Record identity isolation."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path

import pytest

from app.core.companion_learning_bridge import build_companion_learning_bridge
from scripts.data.convert_run10_learning_records import convert_run10

EXPECTED_SOURCE_SHA256 = "17c1f792c73ab29f1fda725166b48c4fb5806567820e167e08af7f01d95d71ff"
SOURCE_ZIP = Path(os.environ.get("SK7_RUN10_SOURCE_ZIP", ""))


@pytest.fixture(scope="module")
def run10_bridge() -> tuple[list[dict], object]:
    if not SOURCE_ZIP.is_file():
        pytest.skip("SK7_RUN10_SOURCE_ZIP is required for Run10 companion identity acceptance")

    assert hashlib.sha256(SOURCE_ZIP.read_bytes()).hexdigest() == EXPECTED_SOURCE_SHA256
    records, validation, _ = convert_run10(SOURCE_ZIP)
    assert validation["valid"] is True
    return records, build_companion_learning_bridge(records)


def test_run10_has_no_companion_identity_links(run10_bridge: tuple[list[dict], object]) -> None:
    records, bridge = run10_bridge

    assert len(records) == 10
    assert bridge.linked_record_ids == ()
    assert bridge.conflict_record_ids == ()

    classified = (
        set(bridge.linked_record_ids)
        | set(bridge.unresolved_record_ids)
        | set(bridge.conflict_record_ids)
        | set(bridge.no_artifact_record_ids)
    )
    assert classified == {record["recordId"] for record in records}
