from __future__ import annotations

import importlib.util
import json
import subprocess
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "scripts" / "check_repository_evidence.py"
SPEC = importlib.util.spec_from_file_location("repository_evidence", MODULE_PATH)
assert SPEC and SPEC.loader
evidence = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(evidence)


def git(root: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


def fixture(tmp_path: Path) -> tuple[Path, str]:
    root = tmp_path / "repo"
    root.mkdir()
    subprocess.run(["git", "-C", str(root), "init", "-q"], check=True)
    subprocess.run(["git", "-C", str(root), "config", "user.email", "test@example.invalid"], check=True)
    subprocess.run(["git", "-C", str(root), "config", "user.name", "Evidence Test"], check=True)
    (root / "docs").mkdir()
    (root / "docs" / "guide.md").write_text("# Guide\n\n## Current Authority\n")
    (root / "README.md").write_text(
        "[guide](docs/guide.md#current-authority)\n"
        "[missing](docs/missing.md)\n"
        "See https://github.com/example/project/pull/12 and PR #13.\n"
        "Commit abcdef1 and docs/guide.md.\n"
    )
    subprocess.run(["git", "-C", str(root), "add", "."], check=True)
    subprocess.run(["git", "-C", str(root), "commit", "-qm", "fixture"], check=True)
    return root, git(root, "rev-parse", "HEAD")


def test_reference_extraction_and_validation(tmp_path: Path) -> None:
    root, ref = fixture(tmp_path)
    rows = evidence.inventory(root, ref)
    refs = evidence.extract_references(root, ref, rows)
    kinds = {row["type"] for row in refs}
    assert {"markdown_link", "github_url", "pull_request", "commit_sha", "repo_path"} <= kinds
    validation = evidence.validate_references(root, ref, rows, refs)
    by_target = {(row["type"], row["target"]): row["status"] for row in validation}
    assert by_target[("markdown_link", "docs/guide.md#current-authority")] == "resolved"
    assert by_target[("markdown_link", "docs/missing.md")] == "broken"
    assert by_target[("github_url", "https://github.com/example/project/pull/12")] == "unverified"


def test_inventory_outputs_are_deterministic(tmp_path: Path) -> None:
    root, ref = fixture(tmp_path)
    atlas = root / evidence.ATLAS
    atlas.mkdir(parents=True)
    (atlas / "SOURCES.json").write_text(json.dumps({"audited_sha": ref, "records": []}))
    first = evidence.inventory_outputs(root, ref)
    second = evidence.inventory_outputs(root, ref)
    assert first == second
    assert "references.json" in first
    assert "validation.json" in first


def test_normalized_graph_has_traceable_endpoints(tmp_path: Path) -> None:
    root, ref = fixture(tmp_path)
    (root / evidence.ATLAS).mkdir(parents=True)
    (root / evidence.ATLAS / "SOURCES.json").write_text(
        json.dumps(
            {
                "audited_sha": ref,
                "records": [
                    {
                        "id": "EV-TEST",
                        "title": "Fixture authority",
                        "category": "testing",
                        "status": "current",
                        "source_type": "contract",
                        "source_path": "docs/guide.md",
                        "source_sha": ref,
                        "authority": "fixture",
                        "protects": ["fixture boundary"],
                        "summary": "Fixture summary",
                        "verification": "Fixture check",
                    }
                ],
            }
        )
    )
    rows = evidence.inventory(root, ref)
    refs = evidence.extract_references(root, ref, rows)
    validations = evidence.validate_references(root, ref, rows, refs)
    output = evidence.normalized_outputs(root, ref, rows, validations)
    graph = json.loads(output["authority-graph.json"])
    endpoints = {node["id"] for node in graph["nodes"]} | {edge["to"] for edge in graph["edges"]}
    assert {"EV-TEST", "docs/guide.md", "fixture boundary"} <= endpoints
    assert json.loads(output["source-validation.json"])["records"][0]["status"] == "resolved"


def test_write_preflight_rejects_wrong_head_before_writing(tmp_path: Path) -> None:
    root, ref = fixture(tmp_path)
    atlas = root / evidence.ATLAS
    atlas.mkdir(parents=True)
    branch = git(root, "branch", "--show-current")
    (atlas / "STATE.json").write_text(json.dumps({"branch": branch, "base_sha": ref}))
    (atlas / "SOURCES.json").write_text(json.dumps({"records": []}))
    target = atlas / "generated.txt"
    try:
        evidence.apply_outputs(root, {"generated.txt": "would be written\n"}, True, "0" * 40)
    except ValueError as error:
        assert "expect-head" in str(error)
    else:
        raise AssertionError("wrong reviewed head must fail closed")
    assert not target.exists()
