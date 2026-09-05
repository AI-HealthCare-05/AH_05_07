"""Run the real CLI against generated XPTs in an isolated clean Git checkout."""

import json
import os
import shutil
import subprocess
import sys

import pandas as pd
import pytest

from scripts.data.contract import ROOT, load_manifest
from tests.data.synthetic_xpt import write_xpt
from tests.data.test_preparation import synthetic_modules


def git(repo, *args):
    subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True)


@pytest.fixture
def workspace(tmp_path):
    repo = tmp_path / "clean checkout"
    repo.mkdir()
    for name in ("scripts", "data/manifest", "docs"):
        shutil.copytree(ROOT / name, repo / name, ignore=shutil.ignore_patterns("__pycache__"))
    for name in (".python-version", "uv.lock"):
        shutil.copyfile(ROOT / name, repo / name)
    git(repo, "init")
    git(repo, "-c", "user.name=Synthetic Test", "-c", "user.email=synthetic@example.invalid", "add", ".")
    git(
        repo,
        "-c",
        "user.name=Synthetic Test",
        "-c",
        "user.email=synthetic@example.invalid",
        "commit",
        "-m",
        "synthetic fixture",
    )
    raw = tmp_path / "raw inputs"
    raw.mkdir()
    manifest = load_manifest()
    for name, frame in synthetic_modules(manifest).items():
        write_xpt(raw / manifest["files"][name], list(frame.columns), frame.values.tolist())
    return repo, raw, tmp_path / "output with spaces"


def invoke(workspace, raw=None, work=None):
    repo, default_raw, default_work = workspace
    env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
    return subprocess.run(
        [
            sys.executable,
            str(repo / "scripts/data/prepare_gate_1b.py"),
            "--raw-dir",
            str(raw or default_raw),
            "--work-dir",
            str(work or default_work),
        ],
        cwd=repo.parent,
        capture_output=True,
        text=True,
        timeout=90,
        env=env,
    )


def test_synthetic_xpt_round_trip(workspace):
    _, raw, _ = workspace
    frame = pd.read_sas(raw / "P_DEMO.xpt", format="xport")
    assert len(frame) == 120
    assert list(frame.columns) == ["SEQN", "RIAGENDR", "RIDAGEYR"]
    assert frame.iloc[0].tolist() == [1, 1, 40]


def test_full_cli_two_runs_and_no_overwrite(workspace):
    result = invoke(workspace)
    assert result.returncode == 0, result.stderr + result.stdout
    repo, _, output = workspace
    evidence = json.loads((output / "gate-1b-evidence.json").read_text())
    assert evidence["status"] == "prepared_not_trained"
    assert evidence["row_counts"]["total"] == 120
    assert json.loads((output / "local-review.json").read_text())["two_runs_equal"] is True
    for run in ("run-a", "run-b"):
        assert evidence == json.loads((output / run / "evidence.json").read_text())
    assert not any(repo.rglob("*.parquet"))
    assert not any(repo.rglob("*.xpt"))
    assert str(output) not in result.stdout + result.stderr
    before = (output / "gate-1b-evidence.json").read_bytes()
    repeated = invoke(workspace)
    assert repeated.returncode == 1
    assert "already exists" in repeated.stderr
    assert before == (output / "gate-1b-evidence.json").read_bytes()


def test_missing_file_stops_before_output(workspace):
    _, raw, output = workspace
    (raw / "P_ALQ.xpt").unlink()
    result = invoke(workspace)
    assert result.returncode == 1
    assert "P_ALQ.xpt" in result.stderr
    assert not output.exists()


def test_dirty_checkout_stops_without_git_mutation(workspace):
    repo, _, output = workspace
    (repo / "uncommitted.txt").write_text("preserve me")
    result = invoke(workspace)
    assert result.returncode == 1
    assert "not clean" in result.stderr
    assert (repo / "uncommitted.txt").read_text() == "preserve me"
    assert not output.exists()


def test_repository_output_and_overlap_are_rejected(workspace):
    repo, raw, _ = workspace
    result = invoke(workspace, work=repo / "private-data")
    assert result.returncode == 1
    assert "outside" in result.stderr
    result = invoke(workspace, work=raw / "derived")
    assert result.returncode == 1
    assert "overlap" in result.stderr


def test_invalid_xpt_halts_without_later_outputs_or_raw_log(workspace):
    _, raw, output = workspace
    (raw / "P_ALQ.xpt").write_text("synthetic-private-marker")
    result = invoke(workspace)
    assert result.returncode == 1
    assert "run-a/schema: failed" in result.stderr
    assert "synthetic-private-marker" not in result.stdout + result.stderr
    assert not (output / "run-a/derived.parquet").exists()
    assert not (output / "run-b").exists()
    assert not (output / "gate-1b-evidence.json").exists()


def test_digest_disagreement_cannot_produce_shareable_evidence(workspace):
    repo, _, output = workspace
    script = repo / "scripts/data/freeze_split.py"
    script.write_text(
        script.read_text().replace(
            '"derived_table_sha256": sha256(table_path)',
            '"derived_table_sha256": "a" * 64 if "run-a" in str(table_path) else "b" * 64',
        )
    )
    git(repo, "add", ".")
    git(
        repo,
        "-c",
        "user.name=Synthetic Test",
        "-c",
        "user.email=synthetic@example.invalid",
        "commit",
        "-m",
        "synthetic mismatch",
    )
    result = invoke(workspace)
    assert result.returncode == 1
    assert "reproducibility comparison failed" in result.stderr
    assert (output / "run-a/evidence.json").exists()
    assert (output / "run-b/evidence.json").exists()
    assert not (output / "gate-1b-evidence.json").exists()
