"""Focused tests for the pure Learning Record read-only index."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.contracts.learning_record import validate_learning_record
from app.core.learning_record_index import build_learning_record_index

FIXTURES = Path(__file__).parent.parent / "fixtures" / "learning_record"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def _partial(record_id: str, episode_id: str, attempt_index: int) -> dict:
    record = _load("learning_record_partial_valid.json")
    record["recordId"] = record_id
    record["episodeId"] = episode_id
    record["attemptIndex"] = attempt_index
    return record


def _repair_record(record_id: str, attempt_index: int, parent_id: str | None) -> dict:
    record = _load("learning_record_repair_of_valid.json")
    record["recordId"] = record_id
    record["episodeId"] = "ep-repair"
    record["attemptIndex"] = attempt_index
    record["artifact"]["artifactId"] = f"art-{record_id}"
    record["artifact"]["ref"]["locator"] = f"build/{record_id}.glb"
    if parent_id is None:
        record.pop("lineage", None)
    else:
        record["lineage"]["relations"][0]["target"]["id"] = parent_id
    return record


def test_record_lookup_is_exact_and_returns_a_defensive_copy() -> None:
    index = build_learning_record_index([_partial("lr-a", "ep-a", 1)])

    first = index.record("lr-a")
    first.recordId = "mutated-outside-index"

    assert index.record("lr-a").recordId == "lr-a"
    with pytest.raises(KeyError, match="unknown Learning Record"):
        index.record("missing")


def test_mutated_learning_record_instance_is_revalidated() -> None:
    record = validate_learning_record(_partial("lr-a", "ep-a", 1))
    record.recordId = ""

    with pytest.raises(ValidationError):
        build_learning_record_index([record])


def test_episode_is_ordered_by_attempt_index_without_collapsing_history() -> None:
    index = build_learning_record_index(
        [
            _partial("lr-v2", "ep-one", 2),
            _partial("lr-v1", "ep-one", 1),
        ]
    )

    assert [record.recordId for record in index.episode("ep-one")] == ["lr-v1", "lr-v2"]
    assert index.episode("missing") == ()


def test_repair_chain_follows_only_explicit_recorded_edges() -> None:
    index = build_learning_record_index(
        [
            _repair_record("lr-v1", 1, None),
            _repair_record("lr-v2", 2, "lr-v1"),
            _repair_record("lr-v3", 3, "lr-v2"),
        ]
    )

    chain = index.repair_chain("lr-v3")

    assert chain.record_ids == ("lr-v3", "lr-v2", "lr-v1")
    assert chain.unresolved_target_id is None


def test_unresolved_repair_target_is_preserved_not_inferred() -> None:
    index = build_learning_record_index([_repair_record("lr-v2", 2, "lr-missing")])

    chain = index.repair_chain("lr-v2")

    assert chain.record_ids == ("lr-v2",)
    assert chain.unresolved_target_id == "lr-missing"
    assert index.unresolved_learning_record_refs == ("lr-missing",)


def test_repair_cycle_is_detected() -> None:
    index = build_learning_record_index(
        [
            _repair_record("lr-v1", 1, "lr-v2"),
            _repair_record("lr-v2", 2, "lr-v1"),
        ]
    )

    with pytest.raises(ValueError, match="repair-of cycle detected"):
        index.repair_chain("lr-v2")


def test_presentation_review_preserves_recorded_decision_and_observation_boundaries() -> None:
    record = _load("learning_record_complete_valid.json")
    index = build_learning_record_index([record])

    review = index.presentation_review("lr-hand-trowel-v1", "pres-hand-trowel-a")

    assert len(review.decisions) == 1
    decision = review.decisions[0]
    assert decision.disposition == "reject"
    assert decision.authority == "assistant"
    assert decision.owner_approval is not None
    assert decision.owner_approval.value == "pending"
    assert decision.production_activation is not None
    assert decision.production_activation.value is False

    assert len(review.evaluations) == 1
    assert review.evaluations[0].verdict == "pass"
    assert review.evaluations[0].authority == "automated"

    assert len(review.comparisons) == 1
    comparison = review.comparisons[0]
    assert comparison.side == "left"
    assert comparison.aggregate_outcome == "different-tradeoff"
    assert [(item.dimension, item.outcome) for item in comparison.dimensions] == [
        ("small-slot-readability", "prefer-right"),
        ("performance-budget", "tie"),
    ]
    assert not hasattr(review, "score")


def test_not_tested_verdict_is_preserved() -> None:
    record = _load("learning_record_complete_valid.json")
    record["evaluations"][0]["verdict"] = "not-tested"
    index = build_learning_record_index([record])

    review = index.presentation_review("lr-hand-trowel-v1", "pres-hand-trowel-a")

    assert review.evaluations[0].verdict == "not-tested"


def test_unknown_presentation_is_rejected() -> None:
    index = build_learning_record_index([_load("learning_record_complete_valid.json")])

    with pytest.raises(KeyError, match="unknown presentationId"):
        index.presentation_review("lr-hand-trowel-v1", "pres-missing")


def test_duplicate_record_ids_are_rejected() -> None:
    record = _partial("lr-duplicate", "ep-a", 1)

    with pytest.raises(ValueError, match="duplicate Learning Record recordId"):
        build_learning_record_index([record, deepcopy(record)])


def test_duplicate_episode_attempts_are_rejected() -> None:
    first = _partial("lr-a", "ep-shared", 1)
    second = _partial("lr-b", "ep-shared", 1)

    with pytest.raises(ValueError, match="duplicate Learning Record episode/attempt"):
        build_learning_record_index([first, second])


def test_non_repair_learning_record_reference_is_reported_if_unresolved() -> None:
    record = _load("learning_record_comparison_valid.json")
    record["comparisons"][0]["rightSubjectRef"] = {
        "kind": "learning-record",
        "id": "lr-external-missing",
    }
    index = build_learning_record_index([record])

    assert index.unresolved_learning_record_refs == ("lr-external-missing",)
