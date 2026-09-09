#!/usr/bin/env python3
"""Offline verification for the R10 recovery contract and sanitized evidence."""

from __future__ import annotations

import argparse
import copy
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

EXPECTED_SCHEMA = "ah-05-07.recovery-audit.v1"
EXPECTED_REPOSITORY = "AI-HealthCare-05/AH_05_07"
EXPECTED_ISSUE = 387
EXPECTED_ROUND = "R10"
EXPECTED_MODEL_SCHEMA = "model-v2-r1-schema-v1"
EXPECTED_MODEL_SHA256 = "d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84"

HEX40_RE = re.compile(r"^[0-9a-f]{40}$")
HEX64_RE = re.compile(r"^[0-9a-f]{64}$")

REQUIRED_TOP_LEVEL_KEYS = {
    "schema",
    "audit_issue",
    "audit_round",
    "baseline",
    "production_backup_state",
    "recovery_objectives",
    "isolated_reconstruction",
    "production_restore_drill",
    "runtime_rollback",
    "model_v2",
    "owner_decision_gate",
    "limitations",
}


def check(condition: bool, label: str, failures: list[str]) -> None:
    if condition:
        print(f"PASS {label}")
    else:
        print(f"FAIL {label}")
        failures.append(label)


def equal(actual: Any, expected: Any, label: str, failures: list[str]) -> None:
    check(actual == expected, label, failures)


def git_commit_exists(repo_root: Path, commit_sha: str) -> bool:
    result = subprocess.run(
        ["git", "-C", str(repo_root), "cat-file", "-e", f"{commit_sha}^{{commit}}"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return result.returncode == 0


def git_commit_is_ancestor(repo_root: Path, commit_sha: str) -> bool:
    result = subprocess.run(
        ["git", "-C", str(repo_root), "merge-base", "--is-ancestor", commit_sha, "HEAD"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return result.returncode == 0


def validate(
    manifest: dict[str, Any],
    contract: str,
    repo_root: Path,
    *,
    show: bool = True,
) -> list[str]:
    failures: list[str] = []

    def emit_check(condition: bool, label: str) -> None:
        if show:
            check(condition, label, failures)
        elif not condition:
            failures.append(label)

    def emit_equal(actual: Any, expected: Any, label: str) -> None:
        if show:
            equal(actual, expected, label, failures)
        elif actual != expected:
            failures.append(label)

    emit_equal(set(manifest), REQUIRED_TOP_LEVEL_KEYS, "top-level schema")
    emit_equal(manifest.get("schema"), EXPECTED_SCHEMA, "schema")
    emit_equal(manifest.get("audit_issue"), EXPECTED_ISSUE, "audit issue")
    emit_equal(manifest.get("audit_round"), EXPECTED_ROUND, "audit round")

    baseline = manifest.get("baseline", {})
    commit_sha = baseline.get("commit_sha", "")
    emit_equal(baseline.get("repository"), EXPECTED_REPOSITORY, "baseline repository")
    emit_check(
        isinstance(commit_sha, str) and HEX40_RE.fullmatch(commit_sha) is not None,
        "baseline commit format",
    )
    emit_check(git_commit_exists(repo_root, commit_sha), "baseline commit exists")
    emit_check(git_commit_is_ancestor(repo_root, commit_sha), "baseline commit is ancestor of HEAD")

    backup = manifest.get("production_backup_state", {})
    emit_equal(backup.get("inspection_mode"), "read_only", "backup inspection is read-only")
    emit_equal(
        backup.get("production_mutation_performed"),
        False,
        "backup inspection performed no production mutation",
    )
    emit_equal(
        backup.get("scheduled_managed_backup"),
        "unavailable_on_current_plan",
        "scheduled managed backup state",
    )
    emit_equal(backup.get("pitr"), "not_active", "PITR state")
    emit_equal(backup.get("managed_restore_point"), "none_observed", "managed restore point")

    objectives = manifest.get("recovery_objectives", {})
    emit_equal(
        objectives.get("required_production_data_rpo"),
        "NOT_SET_RESIDUAL_RISK_ACCEPTED",
        "required production data RPO",
    )
    emit_equal(
        objectives.get("current_provider_managed_data_rpo"),
        "FINITE_RPO_NOT_ESTABLISHED",
        "current managed data RPO",
    )
    emit_equal(
        objectives.get("required_production_database_auth_rto"),
        "NOT_SET_RESIDUAL_RISK_ACCEPTED",
        "required production database/Auth RTO",
    )
    emit_equal(
        objectives.get("observed_production_managed_restore_rto"),
        "NOT_MEASURED",
        "observed managed restore RTO",
    )

    reconstruction = manifest.get("isolated_reconstruction", {})
    emit_equal(reconstruction.get("result"), "PASS", "isolated reconstruction")
    emit_equal(
        reconstruction.get("production_credentials_used"),
        False,
        "no production credentials used",
    )
    emit_equal(reconstruction.get("production_data_used"), False, "no production data used")
    emit_equal(reconstruction.get("source_commit"), commit_sha, "reconstruction source commit")

    report = reconstruction.get("report", {})
    report_sha = report.get("sha256", "")
    emit_check(
        isinstance(report_sha, str) and HEX64_RE.fullmatch(report_sha) is not None,
        "external report SHA-256 format",
    )
    emit_check(
        isinstance(report.get("bytes"), int)
        and not isinstance(report.get("bytes"), bool)
        and report["bytes"] > 0,
        "external report size",
    )
    emit_equal(report.get("repository_copy_retained"), False, "external report not copied to repository")

    checks = reconstruction.get("checks", {})
    emit_check(bool(checks), "reconstruction checks present")
    emit_check(
        bool(checks) and all(value == "PASS" for value in checks.values()),
        "all reconstruction checks PASS",
    )

    cleanup = reconstruction.get("cleanup", {})
    emit_equal(cleanup.get("status"), "PASS", "cleanup status")
    emit_equal(cleanup.get("owned_container_count"), 0, "owned container cleanup")
    emit_equal(cleanup.get("owned_volume_count"), 0, "owned volume cleanup")
    emit_equal(
        cleanup.get("preexisting_running_containers_preserved"),
        True,
        "pre-existing containers preserved",
    )
    emit_equal(cleanup.get("raw_logs_retained"), False, "raw logs not retained")
    emit_equal(
        cleanup.get("credentials_or_row_exports_retained"),
        False,
        "credentials/row exports not retained",
    )

    restore = manifest.get("production_restore_drill", {})
    emit_equal(restore.get("disposition"), "DEFERRED", "production restore drill disposition")
    emit_equal(
        restore.get("reason"),
        "NO_CURRENT_MANAGED_RESTORE_POINT",
        "production restore drill reason",
    )
    emit_equal(restore.get("separate_owner_approval_required"), True, "restore owner approval gate")
    emit_equal(restore.get("performed"), False, "production restore not performed")

    rollback = manifest.get("runtime_rollback", {})
    emit_equal(rollback.get("api"), "PREVIOUSLY_VERIFIED", "API rollback state")
    emit_equal(rollback.get("web"), "PREVIOUSLY_VERIFIED", "web rollback state")
    emit_equal(
        rollback.get("restores_database_or_auth_data"),
        False,
        "runtime rollback does not claim data recovery",
    )

    model = manifest.get("model_v2", {})
    emit_equal(model.get("schema_version"), EXPECTED_MODEL_SCHEMA, "Model V2 schema")
    emit_equal(model.get("artifact_sha256"), EXPECTED_MODEL_SHA256, "Model V2 artifact SHA-256")
    emit_equal(model.get("semantic_change_performed"), False, "no Model V2 semantic change")
    emit_equal(
        model.get("external_artifact_independent_recovery"),
        "INCONCLUSIVE",
        "external Model V2 recovery state",
    )

    owner_gate = manifest.get("owner_decision_gate", {})
    emit_equal(owner_gate.get("status"), "ACCEPTED", "owner decision gate")
    emit_equal(
        owner_gate.get("decision"),
        "ACCEPT_CURRENT_RESIDUAL_RISK",
        "owner residual-risk decision",
    )
    emit_equal(owner_gate.get("accepted_at"), "2026-09-09", "owner decision date")
    emit_equal(owner_gate.get("r10_status"), "COMPLETE", "R10 status")
    emit_equal(
        owner_gate.get("r10_may_be_marked_complete"),
        True,
        "R10 completion authorized by recorded owner decision",
    )

    required_contract_text = (
        commit_sha,
        report_sha,
        reconstruction.get("run_id", ""),
        EXPECTED_MODEL_SHA256,
        "ACCEPT CURRENT RESIDUAL RISK",
        "NO MANAGED RESTORE POINT — FINITE RPO NOT ESTABLISHED",
        "`NOT MEASURED`",
        "DEFERRED — NO CURRENT MANAGED RESTORE POINT; SEPARATE OWNER APPROVAL REQUIRED",
        "R10 status:",
        "`COMPLETE — CURRENT RESIDUAL RISK ACCEPTED BY OWNER ON 2026-09-09`",
        "R10 does not authorize R12 topology expansion.",
    )
    for text in required_contract_text:
        emit_check(isinstance(text, str) and bool(text) and text in contract, f"contract contains: {text}")

    forbidden_contract_text = (
        "/Users/",
        "NO FINITE GUARANTEE",
        "browser secret-boundary verification",
        "frozen Model V2 route remained `model_not_ready`",
        "OWNER DECISION REQUIRED",
        "R10 must not be marked `COMPLETE`",
    )
    for text in forbidden_contract_text:
        emit_check(text not in contract, f"contract excludes stale/unsafe text: {text}")

    return failures


def run_self_test(manifest: dict[str, Any], contract: str, repo_root: Path) -> int:
    print("--- SELF TEST ---")

    baseline_failures = validate(manifest, contract, repo_root, show=False)
    if baseline_failures:
        print(f"FAIL self-test baseline unexpectedly failed: {baseline_failures}")
        return 1
    print("PASS self-test baseline")

    bad_gate = copy.deepcopy(manifest)
    bad_gate["owner_decision_gate"]["status"] = "OPEN"
    if not validate(bad_gate, contract, repo_root, show=False):
        print("FAIL self-test did not reject reopened owner gate")
        return 1
    print("PASS self-test rejects reopened owner gate")

    stale_objective = copy.deepcopy(manifest)
    stale_objective["recovery_objectives"]["required_production_data_rpo"] = (
        "OWNER_DECISION_REQUIRED"
    )
    if not validate(stale_objective, contract, repo_root, show=False):
        print("FAIL self-test did not reject stale unresolved RPO objective")
        return 1
    print("PASS self-test rejects stale unresolved RPO objective")

    bad_manifest_hash = copy.deepcopy(manifest)
    bad_manifest_hash["isolated_reconstruction"]["report"]["sha256"] = "0" * 64
    if not validate(bad_manifest_hash, contract, repo_root, show=False):
        print("FAIL self-test did not reject manifest/contract report hash mismatch")
        return 1
    print("PASS self-test rejects report hash mismatch")

    bad_contract = contract + "\n/Users/example/forbidden-local-path\n"
    if not validate(manifest, bad_contract, repo_root, show=False):
        print("FAIL self-test did not reject operator-local absolute path")
        return 1
    print("PASS self-test rejects operator-local absolute path")

    print("RECOVERY_VERIFIER_SELF_TEST=PASS")
    return 0


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--manifest",
        type=Path,
        default=repo_root / "docs/architecture/recovery-r10.json",
    )
    parser.add_argument(
        "--contract",
        type=Path,
        default=repo_root / "docs/architecture/RECOVERY_CONTRACT.md",
    )
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    try:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        contract = args.contract.read_text(encoding="utf-8")
    except (OSError, json.JSONDecodeError) as error:
        print(f"FAIL input loading: {type(error).__name__}", file=sys.stderr)
        return 1

    if not isinstance(manifest, dict):
        print("FAIL manifest root must be a JSON object", file=sys.stderr)
        return 1

    if args.self_test:
        return run_self_test(manifest, contract, repo_root)

    print("--- R10 RECOVERY CONTRACT VERIFICATION ---")
    failures = validate(manifest, contract, repo_root)

    if failures:
        print(f"RECOVERY_CONTRACT_VERIFICATION=FAIL ({len(failures)} checks)")
        return 1

    print("RECOVERY_CONTRACT_VERIFICATION=PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
