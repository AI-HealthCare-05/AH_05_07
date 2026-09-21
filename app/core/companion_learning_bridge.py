"""Pure read-only identity bridge from Learning Records to companion catalog assets."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Literal

from app.core.contracts.learning_record import ExternalContentRef, InternalRef, LearningRecord, validate_learning_record
from app.core.dollmaker import CatalogAsset, load_existing_catalog

LinkStatus = Literal["linked", "unresolved", "conflict", "no-artifact"]
LinkBasis = Literal["sha256", "object-key", "sha256+object-key"]


@dataclass(frozen=True, slots=True)
class CompanionLearningLink:
    """Identity result for one Learning Record primary artifact."""

    record_id: str
    artifact_id: str | None
    status: LinkStatus
    basis: LinkBasis | None
    asset: CatalogAsset | None
    recorded_sha256: str | None
    recorded_locator: str | None


class CompanionLearningBridge:
    """Resolve exact immutable companion identity without inferring activation."""

    def __init__(
        self,
        records: Sequence[Any],
        *,
        catalog: Sequence[CatalogAsset] | None = None,
    ) -> None:
        validated = tuple(_validated_record(record) for record in records)
        assets = tuple(catalog) if catalog is not None else load_existing_catalog()

        by_id: dict[str, CatalogAsset] = {}
        by_sha256: dict[str, CatalogAsset] = {}
        by_object_key: dict[str, CatalogAsset] = {}

        for asset in assets:
            if not isinstance(asset, CatalogAsset):
                raise TypeError("companion catalog entries must be CatalogAsset instances")
            if asset.asset_id in by_id:
                raise ValueError(f"duplicate companion asset_id: {asset.asset_id!r}")
            if asset.sha256 in by_sha256:
                raise ValueError(f"duplicate companion sha256: {asset.sha256!r}")
            if asset.object_key in by_object_key:
                raise ValueError(f"duplicate companion object_key: {asset.object_key!r}")

            by_id[asset.asset_id] = asset
            by_sha256[asset.sha256] = asset
            by_object_key[asset.object_key] = asset

        records_by_id: dict[str, LearningRecord] = {}
        record_order: dict[str, tuple[str, int, str]] = {}
        links: dict[str, CompanionLearningLink] = {}

        for record in validated:
            if record.recordId in records_by_id:
                raise ValueError(f"duplicate Learning Record recordId: {record.recordId!r}")
            records_by_id[record.recordId] = record
            record_order[record.recordId] = (record.episodeId, record.attemptIndex, record.recordId)
            links[record.recordId] = _resolve_link(record, by_sha256=by_sha256, by_object_key=by_object_key)

        records_by_asset: dict[str, list[str]] = {asset_id: [] for asset_id in by_id}
        for record_id, link in links.items():
            if link.status == "linked" and link.asset is not None:
                records_by_asset[link.asset.asset_id].append(record_id)

        self._records_by_id = records_by_id
        self._record_order = record_order
        self._links = links
        self._assets_by_id = by_id
        self._records_by_asset = {
            asset_id: tuple(sorted(record_ids, key=record_order.__getitem__))
            for asset_id, record_ids in records_by_asset.items()
        }

    def record_link(self, record_id: str) -> CompanionLearningLink:
        """Return the exact identity result for one Learning Record."""

        try:
            return self._links[record_id]
        except KeyError:
            raise KeyError(f"unknown Learning Record recordId: {record_id!r}") from None

    def records_for_asset(self, asset_id: str) -> tuple[str, ...]:
        """Return linked historical record IDs in deterministic history order."""

        if asset_id not in self._assets_by_id:
            raise KeyError(f"unknown companion asset_id: {asset_id!r}")
        return self._records_by_asset[asset_id]

    @property
    def linked_record_ids(self) -> tuple[str, ...]:
        return self._record_ids_with_status("linked")

    @property
    def unresolved_record_ids(self) -> tuple[str, ...]:
        return self._record_ids_with_status("unresolved")

    @property
    def conflict_record_ids(self) -> tuple[str, ...]:
        return self._record_ids_with_status("conflict")

    @property
    def no_artifact_record_ids(self) -> tuple[str, ...]:
        return self._record_ids_with_status("no-artifact")

    def _record_ids_with_status(self, status: LinkStatus) -> tuple[str, ...]:
        return tuple(
            sorted(
                (record_id for record_id, link in self._links.items() if link.status == status),
                key=self._record_order.__getitem__,
            )
        )


def build_companion_learning_bridge(
    records: Sequence[Any],
    *,
    catalog: Sequence[CatalogAsset] | None = None,
) -> CompanionLearningBridge:
    """Build the pure identity bridge over validated records and catalog assets."""

    return CompanionLearningBridge(records, catalog=catalog)


def _validated_record(data: Any) -> LearningRecord:
    if isinstance(data, LearningRecord):
        return validate_learning_record(data.model_dump(mode="python"))
    return validate_learning_record(data)


def _resolve_link(
    record: LearningRecord,
    *,
    by_sha256: dict[str, CatalogAsset],
    by_object_key: dict[str, CatalogAsset],
) -> CompanionLearningLink:
    artifact = record.artifact
    if artifact is None:
        return CompanionLearningLink(
            record_id=record.recordId,
            artifact_id=None,
            status="no-artifact",
            basis=None,
            asset=None,
            recorded_sha256=None,
            recorded_locator=None,
        )

    ref = artifact.ref
    if isinstance(ref, InternalRef):
        return CompanionLearningLink(
            record_id=record.recordId,
            artifact_id=artifact.artifactId,
            status="unresolved",
            basis=None,
            asset=None,
            recorded_sha256=None,
            recorded_locator=None,
        )

    if not isinstance(ref, ExternalContentRef):
        raise TypeError(f"unsupported Learning Record artifact reference: {type(ref)!r}")

    recorded_sha256 = ref.contentHash.value if ref.contentHash is not None else None
    recorded_locator = ref.locator

    sha_asset = by_sha256.get(recorded_sha256) if recorded_sha256 is not None else None
    object_asset = by_object_key.get(recorded_locator) if recorded_locator is not None else None

    if recorded_sha256 is not None and object_asset is not None:
        if sha_asset is None or sha_asset.asset_id != object_asset.asset_id:
            return CompanionLearningLink(
                record_id=record.recordId,
                artifact_id=artifact.artifactId,
                status="conflict",
                basis=None,
                asset=None,
                recorded_sha256=recorded_sha256,
                recorded_locator=recorded_locator,
            )

    if sha_asset is not None and object_asset is not None:
        return CompanionLearningLink(
            record_id=record.recordId,
            artifact_id=artifact.artifactId,
            status="linked",
            basis="sha256+object-key",
            asset=sha_asset,
            recorded_sha256=recorded_sha256,
            recorded_locator=recorded_locator,
        )

    if sha_asset is not None:
        return CompanionLearningLink(
            record_id=record.recordId,
            artifact_id=artifact.artifactId,
            status="linked",
            basis="sha256",
            asset=sha_asset,
            recorded_sha256=recorded_sha256,
            recorded_locator=recorded_locator,
        )

    if recorded_sha256 is None and object_asset is not None:
        return CompanionLearningLink(
            record_id=record.recordId,
            artifact_id=artifact.artifactId,
            status="linked",
            basis="object-key",
            asset=object_asset,
            recorded_sha256=None,
            recorded_locator=recorded_locator,
        )

    return CompanionLearningLink(
        record_id=record.recordId,
        artifact_id=artifact.artifactId,
        status="unresolved",
        basis=None,
        asset=None,
        recorded_sha256=recorded_sha256,
        recorded_locator=recorded_locator,
    )
