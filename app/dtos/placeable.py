from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, JsonValue, model_validator


class PlaceableSelection(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    asset_id: Literal["welcome-pinwheel-v1"] = Field(alias="assetId")
    color: Literal["coral", "teal", "sunflower"]
    socket_id: Literal["gate-left", "gate-right", "plaza-edge"] = Field(alias="socketId")


class CosmeticLayout(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    pinwheel: PlaceableSelection | None
    keepsake: Literal["plaza-ribbon-v1", "quiet-moon-v1", "garden-leaf-v1"] | None


class PlaceableSave(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    operation_id: UUID = Field(alias="operationId")
    expected_revision: int = Field(alias="expectedRevision", strict=True, ge=0, le=9007199254740990)
    schema_version: Literal["placeable.v1", "placeable.v2"] = Field(alias="schemaVersion")
    layout_id: Literal["e1-plaza.v1", "e1-plaza.v2"] = Field(alias="layoutId")
    selection: PlaceableSelection | CosmeticLayout | None

    @model_validator(mode="after")
    def versioned_layout(self):
        if self.schema_version == "placeable.v1":
            valid = self.layout_id == "e1-plaza.v1" and not isinstance(self.selection, CosmeticLayout)
        else:
            valid = self.layout_id == "e1-plaza.v2" and isinstance(self.selection, CosmeticLayout)
        if not valid:
            raise ValueError("unsupported snapshot layout")
        return self


class PlaceableSnapshot(BaseModel):
    """Reads preserve future schemas/assets; the client must refuse to overwrite them."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    revision: int = Field(strict=True, ge=0, le=9007199254740991)
    schema_version: str = Field(alias="schemaVersion")
    layout_id: str = Field(alias="layoutId")
    selection: JsonValue
    latest_operation_id: UUID | None = Field(alias="latestOperationId")
    latest_fingerprint: str | None = Field(alias="latestFingerprint")
