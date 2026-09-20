"""Shared primitives for SK7 machine contracts."""

from __future__ import annotations

import json
from collections.abc import Sequence
from typing import Annotated, Any

from pydantic import AfterValidator, Field


def _finite(value: float) -> float:
    import math

    if not math.isfinite(value):
        msg = f"numeric value must be finite, got {value!r}"
        raise ValueError(msg)
    return value


def _normalized(value: float) -> float:
    import math

    if not math.isfinite(value):
        msg = f"numeric value must be finite, got {value!r}"
        raise ValueError(msg)
    if not 0 <= value <= 1:
        msg = f"normalized numeric value must be in [0, 1], got {value!r}"
        raise ValueError(msg)
    return value


def _unique_strings(value: Sequence[str]) -> Sequence[str]:
    if len(value) != len(set(value)):
        msg = "set-like array contains duplicate tokens"
        raise ValueError(msg)
    return value


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    seen: set[str] = set()
    for key, _ in pairs:
        if key in seen:
            msg = f"duplicate object key: {key!r}"
            raise ValueError(msg)
        seen.add(key)
    return dict(pairs)


def load_json_unique(data: str | bytes) -> Any:
    """Parse JSON while rejecting duplicate object keys."""
    return json.loads(data, object_pairs_hook=_reject_duplicate_keys)


TOKEN_RE = r"^[a-z0-9]+(-[a-z0-9]+)*$"
NAMESPACED_TOKEN_RE = r"^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)*$"
REGION_RE = r"^[a-z0-9]+(-[a-z0-9]+)*$"
HEX64_RE = r"^[a-f0-9]{64}$"

type SemanticToken = Annotated[str, Field(pattern=TOKEN_RE)]
type NamespacedToken = Annotated[str, Field(pattern=NAMESPACED_TOKEN_RE)]
type MotionIntentToken = NamespacedToken
type SemanticRegionToken = Annotated[str, Field(pattern=REGION_RE)]
type Hex64 = Annotated[str, Field(pattern=HEX64_RE)]

type FiniteFloat = Annotated[float, AfterValidator(_finite)]
type NormalizedFloat = Annotated[float, AfterValidator(_normalized)]

type SetLikeSemanticTokens = Annotated[
    list[SemanticToken],
    AfterValidator(_unique_strings),
]
type SetLikeMotionIntents = Annotated[
    list[MotionIntentToken],
    AfterValidator(_unique_strings),
]
