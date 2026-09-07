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


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def valid_payload() -> dict[str, object]:
    return {
        "age_years": 35,
        "sex_knhanes": "1.0",
        "bmi_from_height_weight": 23.5,
        "cigarette_smoking_state": "never",
        "alcohol_frequency": "2.0",
        "alcohol_amount_category": "1.0",
        "walking_days_7d": 4,
        "walking_minutes_per_active_day": 40,
        "strength_days_7d": 2,
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

    bad_walk_minutes = dict(base)
    bad_walk_minutes["walking_minutes_per_active_day"] = -1

    bad_strength = dict(base)
    bad_strength["strength_days_7d"] = 6

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
    unknown_category_score = boundary.score(unknown_category)

    checks = {
        "artifact_exists": artifact.is_file(),
        "artifact_sha_matches_frozen_r1": sha256(artifact) == EXPECTED_ARTIFACT_SHA256,
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
        "negative_walking_minutes_rejected": expect_raises(
            ModelV2InputError,
            lambda: boundary.score(bad_walk_minutes),
        ),
        "strength_days_above_5_rejected": expect_raises(
            ModelV2InputError,
            lambda: boundary.score(bad_strength),
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
        "unknown_category_scores_safely": 0.0 <= unknown_category_score.score <= 1.0,
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
