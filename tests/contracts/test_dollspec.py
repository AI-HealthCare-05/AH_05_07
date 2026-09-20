"""Tests for SK7 DollSpec v0.1 machine contract."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from pydantic import ValidationError

from app.core.contracts.dollspec import (
    canonicalize_dollspec,
    hash_dollspec,
    validate_dollspec,
)

FIXTURES = Path(__file__).parent.parent / "fixtures" / "dollspec"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def test_schema_file_compiles() -> None:
    schema_path = Path(__file__).parent.parent.parent / "docs" / "sk7.dollspec.v0.1.schema.json"
    schema = json.loads(schema_path.read_text())
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["properties"]["schema"]["const"] == "sk7.dollspec"
    assert schema["$defs"]["SetLikeSemanticTokens"]["uniqueItems"] is True
    assert schema["$defs"]["SetLikeMotionIntents"]["uniqueItems"] is True


def test_minimal_valid_spec() -> None:
    spec = _load("dollspec_minimal_valid.json")
    result = validate_dollspec(spec)
    assert result.schema == "sk7.dollspec"
    assert result.schemaVersion == "0.1"
    assert result.kind == "companion"
    assert result.identity.archetype == "rabbit"


def test_rich_valid_spec() -> None:
    spec = _load("dollspec_rich_valid.json")
    result = validate_dollspec(spec)
    assert result.delivery is not None
    assert result.delivery.targets == ["web", "mobile"]
    assert result.behavior is not None
    assert len(result.behavior.interactions or []) == 1


def test_duplicate_setlike_token_invalid() -> None:
    spec = _load("dollspec_duplicate_tag_invalid.json")
    with pytest.raises(ValidationError) as exc_info:
        validate_dollspec(spec)
    assert "duplicate" in str(exc_info.value).lower()


def test_must_avoid_collision_invalid() -> None:
    spec = _load("dollspec_constraint_collision_invalid.json")
    with pytest.raises(ValidationError) as exc_info:
        validate_dollspec(spec)
    assert "intersect" in str(exc_info.value)


def test_interaction_response_missing_from_motion_intents_invalid() -> None:
    spec = _load("dollspec_interaction_missing_intent_invalid.json")
    with pytest.raises(ValidationError) as exc_info:
        validate_dollspec(spec)
    assert "does not resolve" in str(exc_info.value)


def test_implementation_locator_in_interaction_target_invalid() -> None:
    spec = _load("dollspec_interaction_impl_target_invalid.json")
    with pytest.raises(ValidationError) as exc_info:
        validate_dollspec(spec)
    error = str(exc_info.value)
    assert "target" in error or "string_pattern_mismatch" in error


def test_canonicalization_is_deterministic() -> None:
    spec = _load("dollspec_rich_valid.json")
    first = canonicalize_dollspec(spec)
    second = canonicalize_dollspec(spec)
    assert first == second
    assert hash_dollspec(spec) == hash_dollspec(spec)


def test_setlike_order_variants_have_equal_hash() -> None:
    a = _load("dollspec_order_variant_a.json")
    b = _load("dollspec_order_variant_b.json")
    assert hash_dollspec(a) == hash_dollspec(b)
    assert canonicalize_dollspec(a) == canonicalize_dollspec(b)


def test_interaction_order_variants_have_distinct_hash() -> None:
    a = _load("dollspec_interaction_order_a.json")
    b = _load("dollspec_interaction_order_b.json")
    assert hash_dollspec(a) != hash_dollspec(b)
    assert canonicalize_dollspec(a) != canonicalize_dollspec(b)


def test_duplicate_object_keys_are_rejected() -> None:
    raw = b'{"schema":"sk7.dollspec","schemaVersion":"0.1","kind":"companion","identity":{"archetype":"rabbit","archetype":"cat"}}'
    with pytest.raises(ValueError) as exc_info:
        canonicalize_dollspec(raw)
    assert "duplicate" in str(exc_info.value).lower()


def test_non_finite_numeric_rejected() -> None:
    spec = _load("dollspec_minimal_valid.json")
    spec["expression"] = {"intensity": float("nan")}
    with pytest.raises(ValidationError) as exc_info:
        validate_dollspec(spec)
    assert "finite" in str(exc_info.value).lower()


@pytest.mark.parametrize("constant", ["NaN", "Infinity", "-Infinity"])
def test_raw_nonstandard_constants_are_rejected(constant: str) -> None:
    raw = (
        '{"schema":"sk7.dollspec","schemaVersion":"0.1","kind":"companion",'
        '"identity":{"archetype":"rabbit"},"extensions":{"x":{"n":' + constant + "}}}"
    ).encode()
    with pytest.raises(ValueError, match="non-standard"):
        canonicalize_dollspec(raw)


def test_nested_extension_nonfinite_and_unsafe_integers_are_rejected() -> None:
    spec = _load("dollspec_minimal_valid.json")
    spec["extensions"] = {"x": {"n": float("nan")}}
    with pytest.raises(ValueError, match="finite"):
        canonicalize_dollspec(spec)
    spec["extensions"] = {"x": {"n": 9_007_199_254_740_992}}
    with pytest.raises(ValueError, match="safe range"):
        canonicalize_dollspec(spec)


@pytest.mark.parametrize(
    "path,value", [(("expression", "intensity"), "0.5"), (("appearance", "proportions", "headScale"), True)]
)
def test_numeric_strings_and_booleans_are_not_coerced(path: tuple[str, ...], value: object) -> None:
    spec = _load("dollspec_minimal_valid.json")
    current = spec
    for key in path[:-1]:
        current = current.setdefault(key, {})
    current[path[-1]] = value
    with pytest.raises(ValidationError):
        validate_dollspec(spec)


def test_explicit_null_is_distinct_from_absence() -> None:
    absent = _load("dollspec_minimal_valid.json")
    present = _load("dollspec_minimal_valid.json")
    present["expression"] = None
    assert canonicalize_dollspec(absent) != canonicalize_dollspec(present)


def test_dollspec_schema_uses_draft_validator_and_matches_generator() -> None:
    from scripts.data.generate_sk7_contract_schemas import dollspec_schema

    schema_path = Path(__file__).parent.parent.parent / "docs" / "sk7.dollspec.v0.1.schema.json"
    schema = json.loads(schema_path.read_text())
    Draft202012Validator.check_schema(schema)
    assert schema == dollspec_schema()
    assert not list(Draft202012Validator(schema).iter_errors(_load("dollspec_rich_valid.json")))
    invalid = _load("dollspec_minimal_valid.json")
    invalid["expression"] = {"intensity": 2}
    assert list(Draft202012Validator(schema).iter_errors(invalid))
