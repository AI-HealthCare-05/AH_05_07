"""Focused tests for the pure DollSpec v0.1 DollMaker proof."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.dollmaker import build_assembly_plan, load_existing_catalog

FIXTURES = Path(__file__).parent.parent / "fixtures" / "dollspec"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def test_exact_match_selects_an_existing_requested_tier_asset() -> None:
    spec = _load("dollspec_minimal_valid.json")
    spec["delivery"] = {"qualityTier": "lite"}

    plan = build_assembly_plan(spec)

    assert plan.status == "exact"
    assert plan.candidate_asset_ids == ("COMPANION-R2-003", "COMPANION-R2-004")
    assert plan.recipe is not None
    assert plan.recipe.character.asset_id == "COMPANION-R2-003"
    assert plan.recipe.character.object_key == "companion/v1/rabbit/v002/lite.glb"


def test_candidate_order_and_content_identity_are_deterministic() -> None:
    first = _load("dollspec_order_variant_a.json")
    second = _load("dollspec_order_variant_b.json")
    catalog = load_existing_catalog()

    left = build_assembly_plan(first, catalog=catalog)
    right = build_assembly_plan(second, catalog=tuple(reversed(catalog)))

    assert left == right
    assert left.candidate_asset_ids == ("COMPANION-R2-004", "COMPANION-R2-003")


def test_invalid_dollspec_is_rejected_before_catalog_lookup() -> None:
    with pytest.raises(ValidationError):
        build_assembly_plan(_load("dollspec_duplicate_tag_invalid.json"))


def test_no_match_has_no_recipe_or_asset_reference() -> None:
    spec = _load("dollspec_minimal_valid.json")
    spec["identity"]["archetype"] = "koala"

    plan = build_assembly_plan(spec)

    assert plan.status == "no-match"
    assert plan.candidate_asset_ids == ()
    assert plan.recipe is None


def test_partial_match_preserves_unresolved_valid_dollspec_detail() -> None:
    plan = build_assembly_plan(_load("dollspec_rich_valid.json"))

    assert plan.status == "partial"
    assert plan.recipe is not None
    assert plan.recipe.character.asset_id == "COMPANION-R2-003"
    assert plan.unsupported_request_fields == (
        "identity.variant",
        "identity.characterTags",
        "appearance",
        "expression",
        "behavior",
        "delivery.targets",
        "constraints",
    )
