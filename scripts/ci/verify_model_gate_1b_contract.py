"""Verify the model Gate 1B runbook, manifest, and evidence contract."""

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

PIPELINE_COMMANDS = (
    "scripts/data/verify_manifest.py",
    "scripts/data/audit_schema.py $RawDir",
    "scripts/data/build_derived_table.py $RawDir $DerivedTable",
    "scripts/data/freeze_split.py $DerivedTable $SplitDir --evidence $EvidenceFile --commit $Commit",
)
REQUIRED_FILES = (
    "data/manifest/nhanes_2017_2020.json",
    "docs/ai-toolchain-ssot.md",
    "docs/data-contract.md",
    "docs/model-gate-1b-runbook.md",
    "scripts/data/audit_schema.py",
    "scripts/data/build_derived_table.py",
    "scripts/data/freeze_split.py",
    "scripts/data/verify_manifest.py",
)
EVIDENCE_FIELDS = {
    "dataset_id",
    "derived_table_sha256",
    "features",
    "gate",
    "label",
    "manifest_sha256",
    "partition_sha256",
    "prohibited_predictors_absent",
    "repository_commit",
    "row_counts",
    "schema_version",
    "seed",
    "split_digest",
    "status",
    "toolchain_lock_sha256",
}
SHA256 = re.compile(r"[0-9a-f]{64}")
COMMIT = re.compile(r"[0-9a-f]{40}")
OFFICIAL_FILES = {
    "demographics": "P_DEMO.xpt",
    "body_measures": "P_BMX.xpt",
    "blood_pressure": "P_BPXO.xpt",
    "physical_activity": "P_PAQ.xpt",
    "smoking": "P_SMQ.xpt",
    "alcohol": "P_ALQ.xpt",
    "sleep": "P_SLQ.xpt",
}
OFFICIAL_BP_COLUMNS = {
    "BPXOSY1",
    "BPXOSY2",
    "BPXOSY3",
    "BPXODI1",
    "BPXODI2",
    "BPXODI3",
}


def _identity_findings(evidence: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    if set(evidence) != EVIDENCE_FIELDS:
        issues.append("evidence fields do not match the allowlist")
    if evidence.get("schema_version") != 1:
        issues.append("unsupported evidence schema version")
    if evidence.get("gate") != "model_gate_1b" or evidence.get("status") != "prepared_not_trained":
        issues.append("evidence gate or status is invalid")
    if COMMIT.fullmatch(str(evidence.get("repository_commit", ""))) is None:
        issues.append("repository commit is not a full lowercase SHA")
    if not isinstance(evidence.get("label"), str) or not isinstance(evidence.get("dataset_id"), str):
        issues.append("dataset or label identifier is invalid")
    if not isinstance(evidence.get("seed"), int) or isinstance(evidence.get("seed"), bool):
        issues.append("seed is invalid")
    return issues


def _digest_findings(evidence: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    for field in ("manifest_sha256", "toolchain_lock_sha256", "derived_table_sha256", "split_digest"):
        if SHA256.fullmatch(str(evidence.get(field, ""))) is None:
            issues.append(f"{field} is not a SHA-256 digest")
    partition_hashes = evidence.get("partition_sha256", {})
    if set(partition_hashes) != {"train", "validation", "test"} or any(
        SHA256.fullmatch(str(value)) is None for value in partition_hashes.values()
    ):
        issues.append("partition hashes are incomplete or invalid")
    return issues


def _content_findings(evidence: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    row_counts = evidence.get("row_counts", {})
    if set(row_counts) != {"total", "train", "validation", "test"} or any(
        not isinstance(value, int) or isinstance(value, bool) or value < 0 for value in row_counts.values()
    ):
        issues.append("row counts are incomplete or invalid")
    elif row_counts["total"] != row_counts["train"] + row_counts["validation"] + row_counts["test"]:
        issues.append("partition row counts do not equal the total")
    if evidence.get("prohibited_predictors_absent") is not True:
        issues.append("prohibited predictor absence is not confirmed")
    if not isinstance(evidence.get("features"), list) or not all(
        isinstance(value, str) for value in evidence.get("features", [])
    ):
        issues.append("features are not a string list")
    return issues


def evidence_findings(evidence: dict[str, Any]) -> list[str]:
    return _identity_findings(evidence) + _digest_findings(evidence) + _content_findings(evidence)


def _manifest_findings(manifest: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    files = manifest.get("files", {})
    module_columns = manifest.get("module_columns", {})
    if set(files) != set(module_columns):
        issues.append("manifest files and module columns do not match")
    if files != OFFICIAL_FILES:
        issues.append("manifest files do not match the official NHANES release names")

    prohibited = set(manifest.get("label", {}).get("prohibited_predictors", []))
    if set(module_columns.get("blood_pressure", [])) != prohibited:
        issues.append("blood-pressure module columns do not match prohibited predictors")
    if prohibited != OFFICIAL_BP_COLUMNS:
        issues.append("blood-pressure columns do not match the oscillometric release")
    if module_columns.get("alcohol") != ["ALQ111"]:
        issues.append("alcohol column does not match the selected release")
    predictors = {
        column for module, columns in module_columns.items() if module != "blood_pressure" for column in columns
    }
    if predictors != set(manifest.get("candidate_predictors", [])):
        issues.append("module columns do not exactly define candidate predictors")
    if predictors & prohibited:
        issues.append("candidate predictors contain label inputs")
    return issues


def _runbook_findings(runbook: str) -> list[str]:
    issues: list[str] = []
    for command in PIPELINE_COMMANDS:
        if command not in runbook:
            issues.append(f"runbook is missing canonical command: {command}")
    for marker in ("outside the Git repository", "prepared_not_trained", "SEQN", "503 model_not_ready"):
        if marker not in runbook:
            issues.append(f"runbook is missing boundary marker: {marker}")
    return issues


def _freeze_script_findings(freeze_script: str) -> list[str]:
    issues: list[str] = []
    for field in EVIDENCE_FIELDS:
        if f'"{field}"' not in freeze_script:
            issues.append(f"freeze script is missing evidence field: {field}")
    return issues


def contract_findings(root: Path) -> list[str]:
    missing = [relative for relative in REQUIRED_FILES if not (root / relative).is_file()]
    if missing:
        return [f"missing required files: {', '.join(missing)}"]

    manifest = json.loads((root / REQUIRED_FILES[0]).read_text(encoding="utf-8"))
    runbook = (root / "docs/model-gate-1b-runbook.md").read_text(encoding="utf-8")
    freeze_script = (root / "scripts/data/freeze_split.py").read_text(encoding="utf-8")
    return _manifest_findings(manifest) + _runbook_findings(runbook) + _freeze_script_findings(freeze_script)


def repository_alignment_findings(evidence: dict[str, Any], root: Path) -> list[str]:
    manifest_path = root / "data/manifest/nhanes_2017_2020.json"
    lock_path = root / "uv.lock"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    expected = {
        "dataset_id": manifest["dataset_id"],
        "features": manifest["candidate_predictors"],
        "label": manifest["label"]["name"],
        "seed": manifest["split"]["seed"],
        "manifest_sha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
        "toolchain_lock_sha256": hashlib.sha256(lock_path.read_bytes()).hexdigest(),
    }
    return [
        f"evidence {field} does not match the repository contract"
        for field, value in expected.items()
        if evidence.get(field) != value
    ]


def self_test() -> None:
    digest = "a" * 64
    good = {
        "schema_version": 1,
        "gate": "model_gate_1b",
        "status": "prepared_not_trained",
        "repository_commit": "b" * 40,
        "dataset_id": "public-dataset",
        "manifest_sha256": digest,
        "toolchain_lock_sha256": digest,
        "derived_table_sha256": digest,
        "split_digest": digest,
        "seed": 7,
        "features": ["feature_a"],
        "label": "screening_label",
        "prohibited_predictors_absent": True,
        "row_counts": {"total": 10, "train": 7, "validation": 1, "test": 2},
        "partition_sha256": {"train": digest, "validation": digest, "test": digest},
    }
    assert evidence_findings(good) == []

    wrong_status = {**good, "status": "trained"}
    assert "evidence gate or status is invalid" in evidence_findings(wrong_status)

    leaked = {**good, "prohibited_predictors_absent": False}
    assert "prohibited predictor absence is not confirmed" in evidence_findings(leaked)

    wrong_total = {**good, "row_counts": {"total": 11, "train": 7, "validation": 1, "test": 2}}
    assert "partition row counts do not equal the total" in evidence_findings(wrong_total)

    extra = {**good, "local_path": "private"}
    assert "evidence fields do not match the allowlist" in evidence_findings(extra)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--evidence", type=Path)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()

    if args.self_test:
        self_test()
        print("model Gate 1B verifier self-test: passed")
        return 0

    issues = contract_findings(args.root.resolve())
    if args.evidence:
        evidence = json.loads(args.evidence.read_text(encoding="utf-8"))
        issues.extend(evidence_findings(evidence))
        issues.extend(repository_alignment_findings(evidence, args.root.resolve()))
    if issues:
        for issue in issues:
            print(f"model Gate 1B verification failed: {issue}")
        return 1
    print("model Gate 1B contract verification: passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
