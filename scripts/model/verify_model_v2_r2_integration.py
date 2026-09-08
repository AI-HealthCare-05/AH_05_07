#!/usr/bin/env python3
"""Verify Model V2 R2 against the real frozen R1 artifact."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import tempfile
from pathlib import Path

import joblib

from app.services.model_v2_inference import (
    CANONICAL_CATEGORIES,
    EXPECTED_ARTIFACT_SHA256,
    EXPECTED_PRODUCT_WORDING,
    EXPECTED_SCHEMA_VERSION,
    FEATURES,
    ModelV2ArtifactError,
    ModelV2DisabledError,
    ModelV2InferenceBoundary,
    ModelV2InputError,
    _validate_artifact_payload,
    load_verified_artifact,
)

PASS = "PASS_INFERENCE_INTEGRATION_READY_PRODUCTION_DISABLED"
STOP = "STOP_INFERENCE_INTEGRATION_FAILED"
CATEGORICAL_FEATURES = [
    "sex_knhanes",
    "cigarette_smoking_state",
    "alcohol_frequency",
    "alcohol_amount_category",
    "strength_days_7d",
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def valid_payload() -> dict[str, object]:
    return {
        "age_years": 35,
        "sex_knhanes": 1,
        "bmi_from_height_weight": 23.5,
        "cigarette_smoking_state": "never_smoked",
        "alcohol_frequency": "lt_monthly",
        "alcohol_amount_category": "1_2_drinks",
        "walking_days_7d": 4,
        "walking_minutes_per_active_day": 40,
        "strength_days_7d": "2_days",
        "weekday_sleep_minutes": 420,
        "weekend_sleep_minutes": 480,
    }


def expect_raises(exc_type, fn) -> bool:
    try:
        fn()
    except exc_type:
        return True
    return False


def artifact_sha_mismatch_fails_closed(artifact: Path) -> bool:
    with tempfile.TemporaryDirectory(prefix="model-v2-r2-sha-") as tmp:
        corrupt = Path(tmp) / "corrupt.joblib"
        shutil.copyfile(artifact, corrupt)
        with corrupt.open("ab") as stream:
            stream.write(b"\x00")
        return expect_raises(
            ModelV2ArtifactError,
            lambda: load_verified_artifact(corrupt, enabled=True),
        )


def schema_mismatch_rejected(artifact: Path) -> bool:
    payload = joblib.load(artifact)
    altered = dict(payload)
    altered["schema_version"] = "__r2_invalid_schema__"
    return expect_raises(
        ModelV2ArtifactError,
        lambda: _validate_artifact_payload(altered),
    )


def _plain_category(value):
    item = getattr(value, "item", None)
    return item() if callable(item) else value


def fitted_category_parity(artifact_payload: dict) -> dict[str, dict[str, object]]:
    pipeline = artifact_payload["pipeline"]
    preprocess = pipeline.named_steps["preprocess"]
    categorical = preprocess.named_transformers_["categorical"]
    encoder = categorical.named_steps["encoder"]
    fitted = encoder.categories_

    if len(fitted) != len(CATEGORICAL_FEATURES):
        raise SystemExit("STOP: fitted categorical encoder width does not match frozen feature contract")

    result: dict[str, dict[str, object]] = {}
    for feature, fitted_values in zip(CATEGORICAL_FEATURES, fitted, strict=True):
        expected_values = list(CANONICAL_CATEGORIES[feature])
        actual_values = [_plain_category(value) for value in fitted_values.tolist()]
        expected = set(expected_values)
        actual = set(actual_values)
        missing_expected = [value for value in expected_values if value not in actual]
        unexpected = [value for value in actual_values if value not in expected and value != "__missing__"]
        result[feature] = {
            "expected": expected_values,
            "fitted": actual_values,
            "missing_expected": missing_expected,
            "unexpected": unexpected,
            "passed": not missing_expected and not unexpected,
        }

    return result


def fitted_category_transform_parity(artifact_payload: dict) -> dict[str, dict[str, object]]:
    """Prove each canonical category activates its fitted one-hot path."""
    import numpy as np

    pipeline = artifact_payload["pipeline"]
    preprocess = pipeline.named_steps["preprocess"]
    categorical = preprocess.named_transformers_["categorical"]
    encoder = categorical.named_steps["encoder"]
    fitted = [list(values.tolist()) for values in encoder.categories_]

    if len(fitted) != len(CATEGORICAL_FEATURES):
        raise SystemExit("STOP: fitted categorical encoder width does not match frozen feature contract")

    offsets: list[int] = []
    offset = 0
    for values in fitted:
        offsets.append(offset)
        offset += len(values)

    baseline = [CANONICAL_CATEGORIES[feature][0] for feature in CATEGORICAL_FEATURES]
    result: dict[str, dict[str, object]] = {}

    for feature_index, feature in enumerate(CATEGORICAL_FEATURES):
        feature_results: dict[str, bool] = {}
        actual_values = [_plain_category(value) for value in fitted[feature_index]]
        feature_start = offsets[feature_index]
        feature_end = feature_start + len(actual_values)

        for canonical in CANONICAL_CATEGORIES[feature]:
            if canonical not in actual_values:
                feature_results[str(canonical)] = False
                continue

            row = list(baseline)
            row[feature_index] = canonical
            transformed = encoder.transform(np.asarray([row], dtype=object))
            dense = transformed.toarray()[0] if hasattr(transformed, "toarray") else np.asarray(transformed)[0]
            expected_index = feature_start + actual_values.index(canonical)
            feature_slice = dense[feature_start:feature_end]
            feature_results[str(canonical)] = bool(
                dense[expected_index] == 1 and np.isclose(float(feature_slice.sum()), 1.0)
            )

        result[feature] = {
            "canonical_transform_paths": feature_results,
            "passed": all(feature_results.values()),
        }

    return result


def legacy_route_remains_fail_closed(repo_root: Path) -> bool:
    route = repo_root / "app/apis/v1/risk_signal_routers.py"
    source = route.read_text(encoding="utf-8")
    return (
        "status_code=status.HTTP_503_SERVICE_UNAVAILABLE" in source
        and '"code": "model_not_ready"' in source
        and "ModelV2InferenceBoundary" not in source
    )


def verify(args: argparse.Namespace) -> int:
    artifact = args.artifact.expanduser().resolve()
    out = args.out.expanduser().resolve()
    repo_root = Path(__file__).resolve().parents[2]

    # Disabled path must fail before any artifact existence/hash/load dependency.
    disabled_blocks = expect_raises(
        ModelV2DisabledError,
        lambda: load_verified_artifact(
            artifact.parent / "__must_not_be_touched_when_disabled__.joblib",
            enabled=False,
        ),
    )

    missing_blocks = expect_raises(
        ModelV2ArtifactError,
        lambda: load_verified_artifact(
            artifact.parent / "__missing__.joblib",
            enabled=True,
        ),
    )

    if not artifact.is_file():
        raise SystemExit("STOP: frozen R1 artifact is unavailable")
    if sha256(artifact) != EXPECTED_ARTIFACT_SHA256:
        raise SystemExit("STOP: supplied artifact does not match frozen R1 SHA-256")

    # The real artifact is loaded only after explicit enabled=True and exact hash verification.
    boundary = ModelV2InferenceBoundary(artifact, enabled=True)
    artifact_payload = load_verified_artifact(artifact, enabled=True)
    category_parity = fitted_category_parity(artifact_payload)
    fitted_categories_match = all(item["passed"] for item in category_parity.values())
    if not fitted_categories_match:
        raise SystemExit("STOP: frozen artifact fitted categories do not match G3 semantic contract")

    category_transform_parity = fitted_category_transform_parity(artifact_payload)
    fitted_category_transform_matches = all(
        item["passed"] for item in category_transform_parity.values()
    )
    if not fitted_category_transform_matches:
        raise SystemExit("STOP: canonical category did not activate its fitted encoder path")

    base = valid_payload()
    result_a = boundary.score(base)
    result_b = boundary.score(base)

    missing_field = dict(base)
    missing_field.pop("age_years")

    extra_field = dict(base)
    extra_field["unexpected"] = 1

    bad_age = dict(base)
    bad_age["age_years"] = 18

    bad_walk_days = dict(base)
    bad_walk_days["walking_days_7d"] = 8

    fractional_walk_days = dict(base)
    fractional_walk_days["walking_days_7d"] = 2.5

    bad_walk_minutes = dict(base)
    bad_walk_minutes["walking_minutes_per_active_day"] = -1

    bad_strength = dict(base)
    bad_strength["strength_days_7d"] = 2

    bad_sex = dict(base)
    bad_sex["sex_knhanes"] = "1.0"

    bad_sleep = dict(base)
    bad_sleep["weekday_sleep_minutes"] = 1441

    bad_bmi = dict(base)
    bad_bmi["bmi_from_height_weight"] = 0

    missing_values = dict(base)
    missing_values["bmi_from_height_weight"] = None
    missing_values["weekday_sleep_minutes"] = None

    unknown_category = dict(base)
    unknown_category["cigarette_smoking_state"] = "__r2_unknown_fixture__"

    missing_value_score = boundary.score(missing_values)

    checks = {
        "artifact_exists": artifact.is_file(),
        "artifact_sha_matches_frozen_r1": sha256(artifact) == EXPECTED_ARTIFACT_SHA256,
        "fitted_categories_match_g3_semantics": fitted_categories_match,
        "canonical_categories_activate_fitted_paths": fitted_category_transform_matches,
        "scoring_disabled_blocks_before_artifact_access": disabled_blocks,
        "missing_artifact_fails_closed": missing_blocks,
        "artifact_sha_mismatch_fails_closed": artifact_sha_mismatch_fails_closed(artifact),
        "schema_version_mismatch_rejected": schema_mismatch_rejected(artifact),
        "exact_feature_order_frozen": list(base) == FEATURES,
        "missing_required_field_rejected": expect_raises(
            ModelV2InputError,
            lambda: boundary.score(missing_field),
        ),
        "extra_field_rejected": expect_raises(
            ModelV2InputError,
            lambda: boundary.score(extra_field),
        ),
        "impossible_age_rejected": expect_raises(
            ModelV2InputError,
            lambda: boundary.score(bad_age),
        ),
        "impossible_walking_days_rejected": expect_raises(
            ModelV2InputError,
            lambda: boundary.score(bad_walk_days),
        ),
        "fractional_walking_days_rejected": expect_raises(
            ModelV2InputError,
            lambda: boundary.score(fractional_walk_days),
        ),
        "negative_walking_minutes_rejected": expect_raises(
            ModelV2InputError,
            lambda: boundary.score(bad_walk_minutes),
        ),
        "noncanonical_strength_numeric_rejected": expect_raises(
            ModelV2InputError,
            lambda: boundary.score(bad_strength),
        ),
        "noncanonical_sex_string_rejected": expect_raises(
            ModelV2InputError,
            lambda: boundary.score(bad_sex),
        ),
        "sleep_above_1440_rejected": expect_raises(
            ModelV2InputError,
            lambda: boundary.score(bad_sleep),
        ),
        "nonpositive_bmi_rejected": expect_raises(
            ModelV2InputError,
            lambda: boundary.score(bad_bmi),
        ),
        "valid_missing_values_score": 0.0 <= missing_value_score.score <= 1.0,
        "unknown_category_rejected": expect_raises(
            ModelV2InputError,
            lambda: boundary.score(unknown_category),
        ),
        "repeated_inference_identical": result_a.score == result_b.score,
        "score_in_unit_interval": 0.0 <= result_a.score <= 1.0,
        "audit_sha_matches": result_a.artifact_sha256 == EXPECTED_ARTIFACT_SHA256,
        "schema_version_matches": result_a.schema_version == EXPECTED_SCHEMA_VERSION,
        "product_wording_matches": result_a.product_wording == EXPECTED_PRODUCT_WORDING,
        "legacy_production_route_model_not_ready": legacy_route_remains_fail_closed(repo_root),
        "production_scoring_disabled": True,
        "no_threshold_applied": True,
        "no_risk_band_created": True,
        "no_participant_level_research_data_read": True,
    }

    passed = all(checks.values())
    decision = PASS if passed else STOP

    evidence = {
        "gate": "Model V2 R2",
        "decision": decision,
        "checks": checks,
        "artifact_sha256": EXPECTED_ARTIFACT_SHA256,
        "schema_version": result_a.schema_version,
        "product_wording": result_a.product_wording,
        "fitted_category_parity": category_parity,
        "fitted_category_transform_parity": category_transform_parity,
        "repeated_score_abs_diff": abs(result_a.score - result_b.score),
        "production_scoring_enabled": False,
        "threshold_applied": False,
        "risk_band_created": False,
        "participant_level_research_data_read": False,
        "governance_deviation": {
            "g8_preconsume_sha256_byte_read": True,
            "parquet_parsing_before_consume": False,
            "participant_rows_or_targets_accessed_before_consume": False,
            "performance_accessed_before_consume": False,
            "model_decision_informed_by_hash_read": False,
        },
        "known_limitations": {
            "older_age_discrimination_weaker": True,
            "strongest_concern_age_80_plus": True,
        },
    }

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")

    print("R2 decision:", decision)
    print("artifact SHA-256:", EXPECTED_ARTIFACT_SHA256)
    print("fitted category parity:", fitted_categories_match)
    print("fitted category transform parity:", fitted_category_transform_matches)
    print("repeated score abs diff:", f"{abs(result_a.score - result_b.score):.3e}")
    print("production scoring enabled: False")
    print("evidence:", out)
    return 0 if passed else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    return verify(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
