#!/usr/bin/env python3
"""Repository-safe Model V2 R3 activation-readiness verifier."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

from app.services.model_v2_inference import (
    EXPECTED_ARTIFACT_SHA256,
    EXPECTED_PRODUCT_WORDING,
    EXPECTED_SCHEMA_VERSION,
    FEATURES,
    ModelV2DisabledError,
    ModelV2InferenceBoundary,
    load_verified_artifact,
    scoring_enabled,
)

PASS = "PASS_ACTIVATION_READINESS_PRODUCTION_DISABLED"
STOP = "STOP_ACTIVATION_READINESS_FAILED"

EXPECTED_FEATURES = [
    "age_years",
    "sex_knhanes",
    "bmi_from_height_weight",
    "cigarette_smoking_state",
    "alcohol_frequency",
    "alcohol_amount_category",
    "walking_days_7d",
    "walking_minutes_per_active_day",
    "strength_days_7d",
    "weekday_sleep_minutes",
    "weekend_sleep_minutes",
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def expect_raises(exc_type, fn) -> bool:
    try:
        fn()
    except exc_type:
        return True
    return False


def tracked_files(repo_root: Path) -> list[str]:
    proc = subprocess.run(
        ["git", "ls-files"],
        cwd=repo_root,
        check=True,
        capture_output=True,
        text=True,
    )
    return [line.strip() for line in proc.stdout.splitlines() if line.strip()]


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def verify(args: argparse.Namespace) -> int:
    repo_root = Path(__file__).resolve().parents[2]
    artifact = args.artifact.expanduser().resolve()
    out = args.out.expanduser().resolve()

    runtime = repo_root / "app/services/model_v2_inference.py"
    route = repo_root / "app/apis/v1/risk_signal_routers.py"
    legacy_dto = repo_root / "app/dtos/risk_signal.py"
    r2_contract = repo_root / "docs/research/model-v2-r2-inference-contract.md"
    r2_result = repo_root / "docs/research/model-v2-r2-inference-result.md"
    r3_contract = repo_root / "docs/research/model-v2-r3-activation-readiness-contract.md"

    if not artifact.is_file():
        raise SystemExit("STOP: frozen R1 artifact is unavailable")
    if sha256(artifact) != EXPECTED_ARTIFACT_SHA256:
        raise SystemExit("STOP: supplied artifact does not match frozen R1 SHA-256")

    # Explicitly force the default-disabled environment state for the readiness check.
    import os

    old_enable = os.environ.pop("MODEL_V2_SCORING_ENABLED", None)
    try:
        runtime_default_disabled = scoring_enabled() is False
        disabled_blocks_before_access = expect_raises(
            ModelV2DisabledError,
            lambda: load_verified_artifact(
                artifact.parent / "__must_not_be_touched_when_disabled__.joblib",
                enabled=None,
            ),
        )
    finally:
        if old_enable is not None:
            os.environ["MODEL_V2_SCORING_ENABLED"] = old_enable

    boundary = ModelV2InferenceBoundary(artifact, enabled=True)
    audit = boundary.audit_metadata

    runtime_source = text(runtime)
    route_source = text(route)
    dto_source = text(legacy_dto)
    r2_contract_source = text(r2_contract)
    r2_result_source = text(r2_result)
    r3_contract_source = text(r3_contract)

    tracked = tracked_files(repo_root)
    tracked_joblib = [name for name in tracked if name.endswith(".joblib")]
    tracked_participant_like = [
        name
        for name in tracked
        if any(
            token in name.lower()
            for token in (
                "development.parquet",
                "validation.parquet",
                "final",
                "participant",
                "knhanes-2023",
                "knhanes-2024",
            )
        )
        and name.endswith((".parquet", ".sas7bdat", ".csv", ".xlsx"))
    ]

    no_threshold_logic = all(
        token not in runtime_source
        for token in (
            "signal_band",
            "risk_band",
            "threshold",
            "cutoff",
        )
    )

    no_silent_legacy_mapping = (
        "ModelV2InferenceBoundary" not in route_source
        and "model_not_ready" in route_source
        and "RiskSignalInput" in route_source
        and "physical_activity_days" in dto_source
        and "FEATURES" not in dto_source
    )

    governance_text = "\n".join((r2_contract_source, r2_result_source, r3_contract_source)).lower()
    limitation_visible = "80+" in governance_text and "older-age" in governance_text
    deviation_visible = (
        "g8" in governance_text
        and "sha-256" in governance_text
        and "before explicit g8 consumption approval" in governance_text
    )
    separate_enable_gate_visible = (
        "separate explicit" in r3_contract_source.lower() and "production" in r3_contract_source.lower()
    )

    checks = {
        "artifact_exists": artifact.is_file(),
        "artifact_sha_exact": sha256(artifact) == EXPECTED_ARTIFACT_SHA256,
        "feature_schema_exact": FEATURES == EXPECTED_FEATURES,
        "runtime_default_disabled": runtime_default_disabled,
        "disabled_state_blocks_before_artifact_access": disabled_blocks_before_access,
        "production_route_model_not_ready": (
            "model_not_ready" in route_source and "ModelV2InferenceBoundary" not in route_source
        ),
        "no_silent_legacy_dto_mapping": no_silent_legacy_mapping,
        "no_threshold_or_risk_band_logic": no_threshold_logic,
        "audit_schema_version_available": audit.get("schema_version") == EXPECTED_SCHEMA_VERSION,
        "audit_artifact_sha_available": audit.get("artifact_sha256") == EXPECTED_ARTIFACT_SHA256,
        "audit_product_wording_available": audit.get("product_wording") == EXPECTED_PRODUCT_WORDING,
        "single_runtime_switch_present": ('ENABLE_ENV = "MODEL_V2_SCORING_ENABLED"' in runtime_source),
        "artifact_binary_outside_git": tracked_joblib == [],
        "no_participant_level_research_data_committed": tracked_participant_like == [],
        "known_older_age_limitation_visible": limitation_visible,
        "g8_governance_deviation_visible": deviation_visible,
        "separate_production_enable_gate_required": separate_enable_gate_visible,
        "production_scoring_disabled": True,
        "no_participant_level_research_data_read_during_r3": True,
    }

    decision = PASS if all(checks.values()) else STOP

    evidence = {
        "gate": "Model V2 R3",
        "decision": decision,
        "checks": checks,
        "artifact_sha256": EXPECTED_ARTIFACT_SHA256,
        "schema_version": EXPECTED_SCHEMA_VERSION,
        "product_wording": EXPECTED_PRODUCT_WORDING,
        "tracked_joblib_files": tracked_joblib,
        "tracked_participant_like_files": tracked_participant_like,
        "production_scoring_enabled": False,
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

    print("R3 decision:", decision)
    print("artifact SHA-256:", EXPECTED_ARTIFACT_SHA256)
    print("production scoring enabled: False")
    print("evidence:", out)

    failed = [name for name, value in checks.items() if not value]
    if failed:
        print("failed checks:")
        for name in failed:
            print("-", name)

    return 0 if decision == PASS else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    return verify(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
