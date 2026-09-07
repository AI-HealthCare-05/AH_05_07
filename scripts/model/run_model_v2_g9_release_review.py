#!/usr/bin/env python3
"""Aggregate-only Model V2 G9 release review."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

PASS = "PASS_RELEASE_CANDIDATE_READY_PRODUCTION_DISABLED"
STOP = "STOP_RELEASE_REVIEW_BLOCKED"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.expanduser().resolve().read_text(encoding="utf-8"))


def check_g6(data: dict[str, Any]) -> None:
    if data.get("gate") != "Model V2 G6":
        raise SystemExit("STOP: expected Model V2 G6 evidence")
    if data.get("gate_decision", {}).get("decision") != "PASS_ADVANCE_TO_G7":
        raise SystemExit("STOP: G6 did not pass")


def check_g7(data: dict[str, Any]) -> None:
    if data.get("gate") != "Model V2 G7":
        raise SystemExit("STOP: expected Model V2 G7 evidence")
    if data.get("gate_decision", {}).get("decision") != "PASS_ADVANCE_TO_G8_REVIEW":
        raise SystemExit("STOP: G7 did not pass")
    safety = data.get("safety", {})
    if safety.get("external_used_for_model_change") is not False:
        raise SystemExit("STOP: G7 safety state invalid")
    if safety.get("final_test_file_read") is not False:
        raise SystemExit("STOP: G7 final-test safety state invalid")


def check_g8(data: dict[str, Any]) -> None:
    if data.get("gate") != "Model V2 G8":
        raise SystemExit("STOP: expected Model V2 G8 evidence")
    if data.get("gate_decision", {}).get("decision") != "PASS_ADVANCE_TO_G9_RELEASE_REVIEW":
        raise SystemExit("STOP: G8 did not pass")
    safety = data.get("safety", {})
    required_false = [
        "g6_validation_participant_data_read",
        "g7_external_participant_data_used_for_fit",
        "v1_validation_test_used",
        "threshold_selection",
        "recalibration",
        "feature_change",
        "model_family_change",
        "hyperparameter_change",
        "final_test_performance_used_for_model_change",
        "production_serialization",
    ]
    if any(safety.get(key) is not False for key in required_false):
        raise SystemExit("STOP: G8 safety state invalid")


def build_review(
    g6: dict[str, Any],
    g7: dict[str, Any],
    g8: dict[str, Any],
    provenance: dict[str, str],
) -> dict[str, Any]:
    checks = {
        "g6_passed": True,
        "g7_passed": True,
        "g8_passed": True,
        "candidate_frozen": (
            g6.get("candidate") == "logistic_regression"
            and g7.get("candidate") == "logistic_regression"
            and g8.get("candidate") == "logistic_regression"
        ),
        "no_post_final_test_repair": (
            g8.get("safety", {}).get("final_test_performance_used_for_model_change") is False
        ),
        "production_serialization_not_yet_done": (g8.get("safety", {}).get("production_serialization") is False),
    }
    decision = PASS if all(checks.values()) else STOP

    return {
        "gate": "Model V2 G9",
        "status": "release_review_complete",
        "decision": decision,
        "checks": checks,
        "candidate": "logistic_regression",
        "production_scoring_enabled": False,
        "threshold_approved": False,
        "recalibration_approved": False,
        "known_limitations": {
            "older_age_discrimination_weaker": True,
            "age_80_plus_requires_explicit_release_note": True,
            "subgroup_metrics_descriptive_only": True,
        },
        "performance_summary": {
            "g6_weighted_auroc": 0.817072743,
            "g7_weighted_auroc": 0.846272426,
            "g8_weighted_auroc": 0.833641518,
            "g8_weighted_brier": 0.152472852,
            "g8_calibration_slope": 0.980149811,
        },
        "provenance": provenance,
        "release_requirements": {
            "serialize_from_frozen_development_only": True,
            "artifact_hash_required": True,
            "inference_contract_tests_required": True,
            "input_schema_validation_required": True,
            "monitoring_and_rollback_required": True,
            "explicit_release_approval_required": True,
        },
    }


def render(review: dict[str, Any]) -> str:
    checks = review["checks"]
    p = review["performance_summary"]
    prov = review["provenance"]

    lines = [
        "# Model V2 G9 — Release Review Result",
        "",
        f"Status: **{review['decision']}**",
        "",
        "## Release posture",
        "",
        "- candidate: `logistic_regression`",
        "- production scoring enabled: **False**",
        "- operational threshold approved: **False**",
        "- recalibration approved: **False**",
        "",
        "The model remains an `입력 기반 위험군 선별 신호`. This review does",
        "not establish diagnosis, future risk, treatment, prevention, or causal",
        "improvement.",
        "",
        "## Gate checks",
        "",
    ]
    for key, value in checks.items():
        lines.append(f"- `{key}`: **{value}**")

    lines += [
        "",
        "## Frozen performance summary",
        "",
        f"- G6 weighted AUROC: **{p['g6_weighted_auroc']:.9f}**",
        f"- G7 weighted AUROC: **{p['g7_weighted_auroc']:.9f}**",
        f"- G8 weighted AUROC: **{p['g8_weighted_auroc']:.9f}**",
        f"- G8 weighted Brier: **{p['g8_weighted_brier']:.9f}**",
        f"- G8 calibration slope: **{p['g8_calibration_slope']:.9f}**",
        "",
        "## Known limitation carried forward",
        "",
        "Older-age subgroup discrimination was weaker in descriptive G6/G7/G8",
        "audits, with the strongest concern in age 80+. This limitation must be",
        "documented in release notes and product guardrails. It must not trigger",
        "post-final-test candidate repair within Model V2.",
        "",
        "## Release requirements",
        "",
        "- serialize only from frozen G3 development",
        "- record artifact SHA-256 and source commit",
        "- freeze exact 11-feature order and preprocessing",
        "- inference contract tests must pass",
        "- schema validation and safe failure behavior required",
        "- aggregate drift monitoring and rollback required",
        "- explicit release approval required before enabling scoring",
        "",
        "## Provenance",
        "",
        f"- G6 evidence SHA-256: `{prov['g6_evidence_sha256']}`",
        f"- G7 evidence SHA-256: `{prov['g7_evidence_sha256']}`",
        f"- G8 evidence SHA-256: `{prov['g8_evidence_sha256']}`",
        "",
        "Participant-level development, validation, external, and final-test data",
        "remain outside Git.",
        "",
        "A G9 PASS means release-candidate readiness only. Production scoring",
        "remains disabled until artifact/inference/monitoring checks and explicit",
        "release approval are complete.",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--g6-evidence", type=Path, required=True)
    ap.add_argument("--g7-evidence", type=Path, required=True)
    ap.add_argument("--g8-evidence", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    g6 = load_json(args.g6_evidence)
    g7 = load_json(args.g7_evidence)
    g8 = load_json(args.g8_evidence)

    check_g6(g6)
    check_g7(g7)
    check_g8(g8)

    provenance = {
        "g6_evidence_sha256": sha256(args.g6_evidence.expanduser().resolve()),
        "g7_evidence_sha256": sha256(args.g7_evidence.expanduser().resolve()),
        "g8_evidence_sha256": sha256(args.g8_evidence.expanduser().resolve()),
    }
    review = build_review(g6, g7, g8, provenance)

    output = args.out.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(render(review), encoding="utf-8")

    print(f"G9 decision: {review['decision']}")
    print("production scoring enabled: False")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
