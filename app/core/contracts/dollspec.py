"""SK7 DollSpec v0.1 — machine contract, validator and canonicalizer."""

from __future__ import annotations

import hashlib
import warnings
from typing import Any, Literal

import jcs
from pydantic import BaseModel, ConfigDict, model_validator

from app.core.contracts.common import (
    FiniteFloat,
    MotionIntentToken,
    NamespacedToken,
    NormalizedFloat,
    SemanticRegionToken,
    SemanticToken,
    SetLikeMotionIntents,
    SetLikeSemanticTokens,
    load_json_unique,
    validate_ijson_value,
)

warnings.filterwarnings("ignore", message='Field name "schema"')


class _CoreModel(BaseModel):
    model_config = ConfigDict(extra="forbid", protected_namespaces=(), strict=True)


class Identity(_CoreModel):
    archetype: SemanticToken
    variant: SemanticToken | None = None
    characterTags: SetLikeSemanticTokens | None = None


class VisualStyle(_CoreModel):
    preset: SemanticToken | None = None
    tags: SetLikeSemanticTokens | None = None


class Proportions(_CoreModel):
    headScale: FiniteFloat | None = None
    bodyScale: FiniteFloat | None = None
    eyeScale: FiniteFloat | None = None
    earLength: FiniteFloat | None = None
    earWidth: FiniteFloat | None = None
    snoutScale: FiniteFloat | None = None
    limbLength: FiniteFloat | None = None
    pawScale: FiniteFloat | None = None
    tailScale: FiniteFloat | None = None
    roundness: NormalizedFloat | None = None


class Palette(_CoreModel):
    primary: SemanticToken | None = None
    secondary: SemanticToken | None = None
    accent: SemanticToken | None = None


class Surface(_CoreModel):
    feel: SemanticToken | None = None
    softness: NormalizedFloat | None = None


class Appearance(_CoreModel):
    visualStyle: VisualStyle | None = None
    proportions: Proportions | None = None
    palette: Palette | None = None
    surface: Surface | None = None


class Expression(_CoreModel):
    default: SemanticToken | None = None
    intensity: NormalizedFloat | None = None


class Interaction(_CoreModel):
    trigger: NamespacedToken
    target: SemanticRegionToken
    response: MotionIntentToken


class Behavior(_CoreModel):
    motionIntents: SetLikeMotionIntents | None = None
    interactions: list[Interaction] | None = None

    @model_validator(mode="after")
    def _responses_resolve(self) -> Behavior:
        if not self.interactions:
            return self
        intents = set(self.motionIntents or [])
        for interaction in self.interactions:
            if interaction.response not in intents:
                msg = f"interaction response {interaction.response!r} does not resolve to a listed motionIntent"
                raise ValueError(msg)
        return self


class Delivery(_CoreModel):
    qualityTier: Literal["auto", "lite", "standard"] | None = None
    targets: SetLikeSemanticTokens | None = None
    smallDisplayPriority: bool | None = None


class Constraints(_CoreModel):
    must: SetLikeSemanticTokens | None = None
    avoid: SetLikeSemanticTokens | None = None

    @model_validator(mode="after")
    def _no_collision(self) -> Constraints:
        must = set(self.must or [])
        avoid = set(self.avoid or [])
        collision = must & avoid
        if collision:
            msg = f"constraints.must and constraints.avoid intersect: {sorted(collision)}"
            raise ValueError(msg)
        return self


class DollSpec(_CoreModel):
    schema: Literal["sk7.dollspec"]
    schemaVersion: Literal["0.1"]
    kind: Literal["companion"]
    identity: Identity
    appearance: Appearance | None = None
    expression: Expression | None = None
    behavior: Behavior | None = None
    delivery: Delivery | None = None
    constraints: Constraints | None = None
    extensions: dict[str, Any] | None = None


def validate_dollspec(data: Any) -> DollSpec:
    """Structural + semantic validation for DollSpec v0.1."""
    return DollSpec.model_validate(data)


def _sort_setlike_arrays(document: dict[str, Any]) -> dict[str, Any]:
    if "identity" in document and (tags := document["identity"].get("characterTags")):
        document["identity"]["characterTags"] = sorted(tags)

    if (
        "appearance" in document
        and (visual_style := document["appearance"].get("visualStyle"))
        and (tags := visual_style.get("tags"))
    ):
        visual_style["tags"] = sorted(tags)

    if "behavior" in document and (intents := document["behavior"].get("motionIntents")):
        document["behavior"]["motionIntents"] = sorted(intents)

    if "delivery" in document and (targets := document["delivery"].get("targets")):
        document["delivery"]["targets"] = sorted(targets)

    if "constraints" in document:
        for key in ("must", "avoid"):
            if tokens := document["constraints"].get(key):
                document["constraints"][key] = sorted(tokens)

    return document


def canonicalize_dollspec(data: Any) -> bytes:
    """Return RFC 8785 canonical bytes for a DollSpec v0.1 document.

    The caller may supply raw JSON bytes, a JSON string, or a parsed dict.
    """
    if isinstance(data, bytes):
        raw = load_json_unique(data)
    elif isinstance(data, str):
        raw = load_json_unique(data)
    else:
        raw = data

    validate_ijson_value(raw)
    validate_dollspec(raw)
    # Canonical identity is the supplied semantic document.  In particular,
    # an explicitly supplied null is not silently made identical to omission.
    document = raw
    document = _sort_setlike_arrays(document)
    return jcs.canonicalize(document)


def hash_dollspec(data: Any) -> str:
    """Return the SHA-256 content identity for a DollSpec v0.1 document."""
    canonical_bytes = canonicalize_dollspec(data)
    return hashlib.sha256(canonical_bytes).hexdigest()
