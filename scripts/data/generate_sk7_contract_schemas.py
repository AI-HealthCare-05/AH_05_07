#!/usr/bin/env python3
"""Regenerate the published SK7 v0.1 JSON Schemas from contract models."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.contracts.dollspec import DollSpec  # noqa: E402
from app.core.contracts.learning_record import LearningRecord  # noqa: E402


def _schema(model: type[Any]) -> dict[str, Any]:
    schema = model.model_json_schema(mode="validation")
    schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    return schema


def dollspec_schema() -> dict[str, Any]:
    schema = _schema(DollSpec)
    defs = schema["$defs"]
    defs["NormalizedFloat"].update({"minimum": 0, "maximum": 1})
    defs["SetLikeSemanticTokens"]["uniqueItems"] = True
    defs["SetLikeMotionIntents"]["uniqueItems"] = True
    return schema


def learning_record_schema() -> dict[str, Any]:
    schema = _schema(LearningRecord)
    defs = schema["$defs"]
    external = defs["ExternalContentRef"]
    external["anyOf"] = [{"required": ["contentHash"]}, {"required": ["locator"]}]
    # Pydantic emits the structural union in one reusable definition; make its
    # exclusive semantics explicit for standalone Draft 2020-12 consumers.
    defs["Reference"]["oneOf"] = defs["Reference"].pop("anyOf")
    schema.setdefault("allOf", []).extend(
        [
            {
                "if": {"properties": {"recordState": {"const": "complete"}}, "required": ["recordState"]},
                "then": {"required": ["artifact"]},
            },
            {
                "if": {
                    "properties": {"recordState": {"enum": ["partial", "aborted"]}},
                    "required": ["recordState"],
                    "not": {"required": ["artifact"]},
                },
                "then": {
                    "anyOf": [
                        {"required": ["limitations"], "properties": {"limitations": {"minItems": 1}}},
                        {
                            "required": ["build"],
                            "properties": {
                                "build": {
                                    "anyOf": [
                                        {"required": ["operationId"]},
                                        {"required": ["type"]},
                                        {"required": ["target"]},
                                        {"required": ["intent"]},
                                        {"required": ["basis"]},
                                    ]
                                }
                            },
                        },
                    ]
                },
            },
        ]
    )
    return schema


def write_schemas() -> None:
    for path, schema in (
        (ROOT / "docs/sk7.dollspec.v0.1.schema.json", dollspec_schema()),
        (ROOT / "docs/sk7.learning-record.v0.1.schema.json", learning_record_schema()),
    ):
        path.write_text(json.dumps(schema, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    write_schemas()
