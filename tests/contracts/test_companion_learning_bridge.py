"""Focused contract tests for the companion ↔ Learning Record identity bridge."""

from __future__ import annotations

import json
from dataclasses import FrozenInstanceError, replace
from pathlib import Path

import pytest

from app.core.companion_learning_bridge import build_companion_learning_bridge
from app.core.dollmaker import build_assembly_plan, load_existing_catalog

DOLLSPEC_FIXTURES = Path(__file__).parent.parent / "fixtures" / "dollspec"


def _asset(asset_id: str):
    return next(asset for asset in load_existing_catalog() if asset.asset_id == asset_id)


def _record(
    record_id: str,
    *,
    episode_id: str = "ep-a",
    attempt_index: int = 1,
    sha256: str | None = None,
    locator: str | None = None,
    internal_ref: bool = False,
) -> dict:
    if internal_ref:
        ref: dict = {"kind": "artifact", "id": "art-external-parent"}
    else:
        ref = {}
        if sha256 is not None:
            ref["contentHash"] = {"algorithm": "sha-256", "value": sha256}
        if locator is not None:
            ref["locator"] = locator

    return {
        "schema": "sk7.learning-record",
        "schemaVersion": "0.1",
        "recordId": record_id,
        "episodeId": episode_id,
        "attemptIndex": attempt_index,
        "recordState": "complete",
        "artifact": {
            "artifactId": f"art-{record_id}",
            "kind": "mesh",
            "ref": ref,
        },
    }


def _no_artifact_record(record_id: str) -> dict:
    return {
        "schema": "sk7.learning-record",
        "schemaVersion": "0.1",
        "recordId": record_id,
        "episodeId": "ep-partial",
        "attemptIndex": 1,
        "recordState": "partial",
        "limitations": [{"description": "no artifact was emitted"}],
    }


def test_exact_sha256_links_one_companion_asset() -> None:
    rabbit = _asset("COMPANION-R2-003")
    bridge = build_companion_learning_bridge([_record("lr-rabbit", sha256=rabbit.sha256)])

    link = bridge.record_link("lr-rabbit")

    assert link.status == "linked"
    assert link.basis == "sha256"
    assert link.asset == rabbit


def test_exact_object_key_links_when_no_hash_is_recorded() -> None:
    rabbit = _asset("COMPANION-R2-003")
    bridge = build_companion_learning_bridge([_record("lr-rabbit", locator=rabbit.object_key)])

    link = bridge.record_link("lr-rabbit")

    assert link.status == "linked"
    assert link.basis == "object-key"
    assert link.asset == rabbit


def test_sha256_and_object_key_must_converge_on_same_asset() -> None:
    rabbit = _asset("COMPANION-R2-003")
    bridge = build_companion_learning_bridge([_record("lr-rabbit", sha256=rabbit.sha256, locator=rabbit.object_key)])

    link = bridge.record_link("lr-rabbit")

    assert link.status == "linked"
    assert link.basis == "sha256+object-key"
    assert link.asset == rabbit


def test_conflicting_sha256_and_recognized_object_key_fail_closed() -> None:
    rabbit = _asset("COMPANION-R2-003")
    bear = _asset("COMPANION-R2-001")
    bridge = build_companion_learning_bridge([_record("lr-conflict", sha256=rabbit.sha256, locator=bear.object_key)])

    link = bridge.record_link("lr-conflict")

    assert link.status == "conflict"
    assert link.basis is None
    assert link.asset is None


def test_unknown_sha256_contradicting_recognized_object_key_is_conflict() -> None:
    rabbit = _asset("COMPANION-R2-003")
    bridge = build_companion_learning_bridge([_record("lr-conflict", sha256="0" * 64, locator=rabbit.object_key)])

    assert bridge.record_link("lr-conflict").status == "conflict"


def test_unknown_sha256_is_unresolved() -> None:
    bridge = build_companion_learning_bridge([_record("lr-unknown", sha256="0" * 64)])

    link = bridge.record_link("lr-unknown")

    assert link.status == "unresolved"
    assert link.asset is None


def test_unrelated_locator_is_not_fuzzy_matched() -> None:
    rabbit = _asset("COMPANION-R2-003")
    bridge = build_companion_learning_bridge(
        [_record("lr-unrelated", locator=f"https://example.invalid/{rabbit.object_key}")]
    )

    assert bridge.record_link("lr-unrelated").status == "unresolved"


def test_internal_artifact_reference_remains_unresolved() -> None:
    bridge = build_companion_learning_bridge([_record("lr-internal", internal_ref=True)])

    assert bridge.record_link("lr-internal").status == "unresolved"


def test_record_without_primary_artifact_is_explicit_no_artifact() -> None:
    bridge = build_companion_learning_bridge([_no_artifact_record("lr-partial")])

    link = bridge.record_link("lr-partial")

    assert link.status == "no-artifact"
    assert link.artifact_id is None
    assert bridge.no_artifact_record_ids == ("lr-partial",)


def test_duplicate_catalog_sha256_is_rejected() -> None:
    catalog = load_existing_catalog()
    duplicate = replace(catalog[1], sha256=catalog[0].sha256)

    with pytest.raises(ValueError, match="duplicate companion sha256"):
        build_companion_learning_bridge([], catalog=(catalog[0], duplicate))


def test_duplicate_catalog_object_key_is_rejected() -> None:
    catalog = load_existing_catalog()
    duplicate = replace(catalog[1], object_key=catalog[0].object_key)

    with pytest.raises(ValueError, match="duplicate companion object_key"):
        build_companion_learning_bridge([], catalog=(catalog[0], duplicate))


def test_reverse_history_is_deterministic_and_does_not_collapse_attempts() -> None:
    rabbit = _asset("COMPANION-R2-003")
    bridge = build_companion_learning_bridge(
        [
            _record("lr-b-1", episode_id="ep-b", attempt_index=1, sha256=rabbit.sha256),
            _record("lr-a-2", episode_id="ep-a", attempt_index=2, sha256=rabbit.sha256),
            _record("lr-a-1", episode_id="ep-a", attempt_index=1, sha256=rabbit.sha256),
        ]
    )

    assert bridge.records_for_asset(rabbit.asset_id) == ("lr-a-1", "lr-a-2", "lr-b-1")
    assert bridge.linked_record_ids == ("lr-a-1", "lr-a-2", "lr-b-1")


def test_link_projection_is_immutable_and_unknown_ids_fail_explicitly() -> None:
    rabbit = _asset("COMPANION-R2-003")
    bridge = build_companion_learning_bridge([_record("lr-rabbit", sha256=rabbit.sha256)])
    link = bridge.record_link("lr-rabbit")

    with pytest.raises(FrozenInstanceError):
        link.status = "unresolved"  # type: ignore[misc]

    with pytest.raises(KeyError, match="unknown Learning Record"):
        bridge.record_link("lr-missing")

    with pytest.raises(KeyError, match="unknown companion asset_id"):
        bridge.records_for_asset("COMPANION-R2-999")


def test_dollmaker_and_learning_bridge_converge_on_same_rabbit_lite_identity() -> None:
    spec = json.loads((DOLLSPEC_FIXTURES / "dollspec_minimal_valid.json").read_text())
    spec["delivery"] = {"qualityTier": "lite"}

    plan = build_assembly_plan(spec)
    assert plan.recipe is not None

    selected = _asset(plan.recipe.character.asset_id)
    bridge = build_companion_learning_bridge(
        [_record("lr-rabbit", sha256=selected.sha256, locator=selected.object_key)]
    )

    link = bridge.record_link("lr-rabbit")

    assert plan.recipe.character.asset_id == "COMPANION-R2-003"
    assert link.status == "linked"
    assert link.asset is not None
    assert link.asset.asset_id == plan.recipe.character.asset_id
