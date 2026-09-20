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
    """Parse JSON while rejecting duplicate keys and non-JSON constants."""

    def reject_constant(value: str) -> Any:
        raise ValueError(f"non-standard JSON numeric constant: {value}")

    return json.loads(data, object_pairs_hook=_reject_duplicate_keys, parse_constant=reject_constant)


IJSON_MAX_SAFE_INTEGER = 9_007_199_254_740_991


def validate_ijson_value(value: Any) -> None:  # noqa: C901
    """Reject values outside the I-JSON/JCS interoperable value domain."""
    import math

    if value is None or isinstance(value, (str, bool)):
        return
    if isinstance(value, int):
        if not -IJSON_MAX_SAFE_INTEGER <= value <= IJSON_MAX_SAFE_INTEGER:
            raise ValueError(f"integer is outside the I-JSON safe range: {value!r}")
        return
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError(f"numeric value must be finite, got {value!r}")
        return
    if isinstance(value, list):
        for item in value:
            validate_ijson_value(item)
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise ValueError("JSON object keys must be strings")
            validate_ijson_value(item)
        return
    raise ValueError(f"value is not JSON-compatible: {type(value).__name__}")


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
