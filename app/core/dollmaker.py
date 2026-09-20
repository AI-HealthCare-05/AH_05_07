"""Pure, read-only DollSpec v0.1 to existing-companion-asset planning proof."""

from __future__ import annotations

import json
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from app.core.contracts.dollspec import DollSpec, hash_dollspec, validate_dollspec

MatchStatus = Literal["exact", "partial", "no-match"]
CompanionVariant = Literal["lite", "standard"]

_REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_CATALOG_PATH = _REPOSITORY_ROOT / "docs" / "evidence" / "companion-r2-v1.json"


@dataclass(frozen=True, slots=True)
class CatalogAsset:
    """An immutable reference to one already-catalogued companion asset."""

    asset_id: str
    archetype: str
    version: str
    variant: CompanionVariant
    object_key: str
    sha256: str
    byte_length: int


@dataclass(frozen=True, slots=True)
class AssetReference:
    """Recipe reference that identifies an existing asset without producing one."""

    asset_id: str
    object_key: str
    sha256: str
    byte_length: int


@dataclass(frozen=True, slots=True)
class AssemblyRecipe:
    """The smallest recipe possible with the present catalog: one character asset."""

    character: AssetReference


@dataclass(frozen=True, slots=True)
class AssemblyPlan:
    """Deterministic result of matching a valid DollSpec against the read-only catalog."""

    status: MatchStatus
    dollspec_sha256: str
    candidate_asset_ids: tuple[str, ...]
    unsupported_request_fields: tuple[str, ...]
    recipe: AssemblyRecipe | None


def load_existing_catalog(path: Path | None = None) -> tuple[CatalogAsset, ...]:
    """Read the checked-in companion catalog without modifying catalog metadata or assets."""
    catalog_path = path or _DEFAULT_CATALOG_PATH
    document = json.loads(catalog_path.read_text(encoding="utf-8"))
    objects = document.get("objects")
    if not isinstance(objects, list):
        raise ValueError("companion catalog must contain an objects list")

    assets = tuple(_catalog_asset(item) for item in objects)
    if len({asset.asset_id for asset in assets}) != len(assets):
        raise ValueError("companion catalog contains duplicate asset IDs")
    return assets


def build_assembly_plan(data: Any, *, catalog: Sequence[CatalogAsset] | None = None) -> AssemblyPlan:
    """Validate a DollSpec and deterministically select existing companion asset references.

    This proof only resolves the catalog-backed identity and delivery-tier projection.
    Other valid DollSpec detail remains visible as an explicit partial-match reason;
    it is never interpreted as an instruction to generate or alter an asset.
    """
    spec = validate_dollspec(data)
    content_identity = hash_dollspec(data)
    assets = tuple(catalog) if catalog is not None else load_existing_catalog()
    desired_variant = _desired_variant(spec)
    candidates = sorted(
        (asset for asset in assets if asset.archetype == spec.identity.archetype),
        key=lambda asset: (asset.variant != desired_variant, asset.asset_id),
    )
    unsupported = _unsupported_request_fields(spec)

    if not candidates:
        return AssemblyPlan(
            status="no-match",
            dollspec_sha256=content_identity,
            candidate_asset_ids=(),
            unsupported_request_fields=unsupported,
            recipe=None,
        )

    selected = candidates[0]
    return AssemblyPlan(
        status="partial" if unsupported else "exact",
        dollspec_sha256=content_identity,
        candidate_asset_ids=tuple(asset.asset_id for asset in candidates),
        unsupported_request_fields=unsupported,
        recipe=AssemblyRecipe(character=_asset_reference(selected)),
    )


def _catalog_asset(item: object) -> CatalogAsset:
    if not isinstance(item, dict):
        raise ValueError("companion catalog object must be a mapping")
    variant = item.get("variant")
    if variant not in {"lite", "standard"}:
        raise ValueError(f"unsupported companion catalog variant: {variant!r}")

    required = ("asset_id", "species", "version", "r2_object_key", "sha256", "bytes")
    missing = [key for key in required if key not in item]
    if missing:
        raise ValueError(f"companion catalog object is missing: {', '.join(missing)}")

    return CatalogAsset(
        asset_id=str(item["asset_id"]),
        archetype=str(item["species"]),
        version=str(item["version"]),
        variant=variant,
        object_key=str(item["r2_object_key"]),
        sha256=str(item["sha256"]),
        byte_length=int(item["bytes"]),
    )


def _desired_variant(spec: DollSpec) -> CompanionVariant:
    quality_tier = spec.delivery.qualityTier if spec.delivery else None
    if quality_tier in {"lite", "standard"}:
        return quality_tier
    return "lite" if spec.delivery and spec.delivery.smallDisplayPriority else "standard"


def _unsupported_request_fields(spec: DollSpec) -> tuple[str, ...]:
    """Name valid request detail that has no representation in the frozen asset catalog."""
    fields: list[str] = []
    if spec.identity.variant is not None:
        fields.append("identity.variant")
    if spec.identity.characterTags:
        fields.append("identity.characterTags")
    if spec.appearance is not None:
        fields.append("appearance")
    if spec.expression is not None:
        fields.append("expression")
    if spec.behavior is not None:
        fields.append("behavior")
    if spec.delivery and spec.delivery.targets:
        fields.append("delivery.targets")
    if spec.constraints is not None:
        fields.append("constraints")
    if spec.extensions is not None:
        fields.append("extensions")
    return tuple(fields)


def _asset_reference(asset: CatalogAsset) -> AssetReference:
    return AssetReference(
        asset_id=asset.asset_id,
        object_key=asset.object_key,
        sha256=asset.sha256,
        byte_length=asset.byte_length,
    )
