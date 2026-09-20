"""Regression coverage for historical Gate 1B toolchain provenance."""

import hashlib
import json
import subprocess

import pytest

from scripts.ci.verify_model_gate_1b_contract import repository_alignment_findings


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True).stdout


def commit(repo, message):
    git(repo, "add", "-A")
    git(
        repo,
        "-c",
        "user.name=Synthetic Test",
        "-c",
        "user.email=synthetic@example.invalid",
        "commit",
        "-m",
        message,
    )
    return git(repo, "rev-parse", "HEAD").decode().strip()


@pytest.fixture
def historical_repository(tmp_path):
    repo = tmp_path / "repository"
    manifest_path = repo / "data/manifest/nhanes_2017_2020.json"
    manifest_path.parent.mkdir(parents=True)
    manifest = {
        "dataset_id": "public-dataset",
        "candidate_predictors": ["feature_a"],
        "label": {"name": "screening_label"},
        "split": {"seed": 7},
    }
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    historical_lock = b"version = 1\n"
    (repo / "uv.lock").write_bytes(historical_lock)
    git(repo, "init")
    execution_commit = commit(repo, "historical execution")
    evidence = {
        "repository_commit": execution_commit,
        "dataset_id": manifest["dataset_id"],
        "features": manifest["candidate_predictors"],
        "label": manifest["label"]["name"],
        "seed": manifest["split"]["seed"],
        "manifest_sha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
        "toolchain_lock_sha256": hashlib.sha256(historical_lock).hexdigest(),
    }
    return repo, evidence


def test_current_lock_change_does_not_invalidate_historical_evidence(historical_repository):
    repo, evidence = historical_repository
    (repo / "uv.lock").write_text("version = 2\n", encoding="utf-8")
    commit(repo, "unrelated dependency update")

    assert repository_alignment_findings(evidence, repo) == []


def test_tampered_historical_lock_or_hash_fails(historical_repository):
    repo, evidence = historical_repository
    bad_hash = {**evidence, "toolchain_lock_sha256": "0" * 64}
    assert "evidence toolchain_lock_sha256 does not match the repository contract" in repository_alignment_findings(
        bad_hash, repo
    )

    (repo / "uv.lock").write_text("tampered = true\n", encoding="utf-8")
    tampered_commit = commit(repo, "different historical lock")
    bad_commit = {**evidence, "repository_commit": tampered_commit}
    assert "evidence toolchain_lock_sha256 does not match the repository contract" in repository_alignment_findings(
        bad_commit, repo
    )


def test_unavailable_historical_commit_or_lock_fails_closed(historical_repository):
    repo, evidence = historical_repository
    unavailable_commit = {**evidence, "repository_commit": "f" * 40}
    unavailable = "evidence repository commit or historical uv.lock is unavailable"
    assert unavailable in repository_alignment_findings(unavailable_commit, repo)

    (repo / "uv.lock").unlink()
    commit_without_lock = commit(repo, "remove historical lock")
    unavailable_lock = {**evidence, "repository_commit": commit_without_lock}
    assert unavailable in repository_alignment_findings(unavailable_lock, repo)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("dataset_id", "different-dataset"),
        ("features", ["different_feature"]),
        ("label", "different_label"),
        ("seed", 8),
        ("manifest_sha256", "0" * 64),
    ],
)
def test_current_manifest_alignment_checks_remain(historical_repository, field, value):
    repo, evidence = historical_repository
    altered = {**evidence, field: value}
    assert f"evidence {field} does not match the repository contract" in repository_alignment_findings(altered, repo)
