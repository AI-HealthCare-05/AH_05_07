#!/usr/bin/env python3
"""Synthetic-test subprocess oracle. Capture stdout in memory; never log it."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.apis.v1 import model_v2_routers  # noqa: E402
from app.services.model_v2_inference import (  # noqa: E402
    ModelV2BoundaryError,
    ModelV2InferenceBoundary,
    ModelV2InputError,
    _canonicalize_frame,
    validate_semantic_input,
)
from app.services.model_v2_input_adapter import ModelV2AdapterError, adapt_product_input_v2  # noqa: E402


def canonical_projection(boundary: ModelV2InferenceBoundary, semantic: dict[str, Any]) -> dict[str, str]:
    # Invoke the actual API helper using the verified local boundary in this test
    # subprocess. No HTTP request, authentication bypass in the app, or env change.
    with (
        patch.object(model_v2_routers, "scoring_enabled", return_value=True),
        patch.object(model_v2_routers, "ModelV2InferenceBoundary", return_value=boundary),
    ):
        return model_v2_routers._score_semantic_payload(semantic).model_dump()


def evaluate(boundary: ModelV2InferenceBoundary, case: Any) -> dict[str, Any]:
    if not isinstance(case, dict) or case.get("kind") not in ("semantic", "product") or "input" not in case:
        return {"ok": False, "error": "input_invalid"}
    try:
        semantic = (
            adapt_product_input_v2(case["input"])
            if case["kind"] == "product"
            else validate_semantic_input(case["input"])
        )
        result = boundary.score(semantic)
        # Synthetic test diagnostics only, supplied to the Node parent through a pipe.
        transformed = boundary._artifact["pipeline"].named_steps["preprocess"].transform(_canonicalize_frame(semantic))
        return {
            "ok": True,
            "semantic": semantic,
            "preprocessed": transformed[0].tolist(),
            "score": result.score,
            "projection": canonical_projection(boundary, semantic),
        }
    except (ModelV2InputError, ModelV2AdapterError):
        return {"ok": False, "error": "input_invalid"}
    except (ModelV2BoundaryError, ValueError, TypeError, ArithmeticError):
        return {"ok": False, "error": "inference_unavailable"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", type=Path, required=True)
    args = parser.parse_args()
    cases = json.load(sys.stdin)
    if not isinstance(cases, list):
        raise SystemExit("expected synthetic case array")
    try:
        boundary = ModelV2InferenceBoundary(args.artifact, enabled=True)
    except ModelV2BoundaryError:
        rows = [{"ok": False, "error": "inference_unavailable"} for _ in cases]
    else:
        rows = [evaluate(boundary, case) for case in cases]
    json.dump(rows, sys.stdout, ensure_ascii=False, allow_nan=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
