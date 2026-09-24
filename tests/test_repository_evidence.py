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
    assert "reference-summary.json" in first
    assert "validation.json" in first
    assert "references.json" not in first
    assert "references.md" not in first
    assert "validation.md" not in first


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
    node_ids = {node["id"] for node in graph["nodes"]}
    assert "EV-TEST" in node_ids
    assert {node["node_type"] for node in graph["nodes"]} >= {
        "evidence_record",
        "source_document",
        "protected_boundary",
    }
    assert all(edge["from"] in node_ids and edge["to"] in node_ids for edge in graph["edges"])
    assert json.loads(output["source-validation.json"])["records"][0]["status"] == "resolved"
    assert "../../../../docs/guide.md" in output["reports/PROJECT_AUTHORITY_MAP.md"]


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


def test_plain_words_are_not_commit_shas(tmp_path: Path) -> None:
    root, ref = fixture(tmp_path)
    (root / "docs" / "words.md").write_text("Feedback succeeded.\n")
    subprocess.run(["git", "-C", str(root), "add", "."], check=True)
    subprocess.run(["git", "-C", str(root), "commit", "-qm", "words"], check=True)
    ref = git(root, "rev-parse", "HEAD")
    rows = evidence.inventory(root, ref)
    refs = evidence.extract_references(root, ref, rows)
    targets = {(row["type"], row["target"]) for row in refs}
    assert ("commit_sha", "feedbac") not in targets
    assert ("commit_sha", "cceeded") not in targets


def test_relative_markdown_and_directory_links_resolve(tmp_path: Path) -> None:
    root, _ = fixture(tmp_path)
    (root / "AGENTS.md").write_text("# Agents\n")
    (root / ".github" / "workflows").mkdir(parents=True)
    (root / ".github" / "workflows" / "checks.yml").write_text("name: checks\n")
    (root / "docs" / "sub").mkdir()
    (root / "docs" / "sub" / "a.md").write_text("# A\n")
    (root / "docs" / "relative.md").write_text(
        "[agents](../AGENTS.md)\n"
        "[workflow](../.github/workflows/checks.yml)\n"
        "[directory](sub/)\n"
        "Use .github/workflows/checks.yml.\n"
    )
    subprocess.run(["git", "-C", str(root), "add", "."], check=True)
    subprocess.run(["git", "-C", str(root), "commit", "-qm", "relative links"], check=True)
    ref = git(root, "rev-parse", "HEAD")
    rows = evidence.inventory(root, ref)
    refs = evidence.extract_references(root, ref, rows)
    validation = evidence.validate_references(root, ref, rows, refs)
    by_target = {(row["type"], row["target"]): row["status"] for row in validation}
    assert by_target[("markdown_link", "../AGENTS.md")] == "resolved"
    assert by_target[("markdown_link", "../.github/workflows/checks.yml")] == "resolved"
    assert by_target[("markdown_link", "sub/")] == "resolved"
    assert by_target[("workflow", ".github/workflows/checks.yml")] == "resolved"


def test_unresolved_hex_token_is_not_claimed_broken_commit(tmp_path: Path) -> None:
    root, _ = fixture(tmp_path)
    (root / "docs" / "hash.md").write_text("Evidence token `0000c0de` is not asserted to be a commit.\n")
    subprocess.run(["git", "-C", str(root), "add", "."], check=True)
    subprocess.run(["git", "-C", str(root), "commit", "-qm", "hash"], check=True)
    ref = git(root, "rev-parse", "HEAD")
    rows = evidence.inventory(root, ref)
    refs = evidence.extract_references(root, ref, rows)
    validation = evidence.validate_references(root, ref, rows, refs)
    row = next(row for row in validation if row["type"] == "commit_sha" and row["target"] == "0000c0de")
    assert row["status"] == "unverified"


def test_package_lock_is_not_reference_scanned(tmp_path: Path) -> None:
    root, _ = fixture(tmp_path)
    (root / "web").mkdir()
    (root / "web" / "package-lock.json").write_text(
        '{"resolved":"https://registry.npmjs.org/@supabase/auth-js/-/auth-js-1.0.0.tgz"}\n'
    )
    subprocess.run(["git", "-C", str(root), "add", "."], check=True)
    subprocess.run(["git", "-C", str(root), "commit", "-qm", "lock"], check=True)
    ref = git(root, "rev-parse", "HEAD")
    rows = evidence.inventory(root, ref)
    refs = evidence.extract_references(root, ref, rows)
    assert not any(row["source_path"] == "web/package-lock.json" for row in refs)


def test_context_relative_repo_path_resolves_by_unique_suffix(tmp_path: Path) -> None:
    root, _ = fixture(tmp_path)
    (root / ".github" / "workflows").mkdir(parents=True)
    (root / ".github" / "workflows" / "browser.yml").write_text("run: node scripts/browser-ci-modules.mjs\n")
    (root / "web" / "scripts").mkdir(parents=True)
    (root / "web" / "scripts" / "browser-ci-modules.mjs").write_text("export {};\n")
    subprocess.run(["git", "-C", str(root), "add", "."], check=True)
    subprocess.run(["git", "-C", str(root), "commit", "-qm", "suffix path"], check=True)
    ref = git(root, "rev-parse", "HEAD")
    rows = evidence.inventory(root, ref)
    refs = evidence.extract_references(root, ref, rows)
    validation = evidence.validate_references(root, ref, rows, refs)
    row = next(
        row for row in validation if row["type"] == "repo_path" and row["target"] == "scripts/browser-ci-modules.mjs"
    )
    assert row["status"] == "resolved"
    assert row["resolved_path"] == "web/scripts/browser-ci-modules.mjs"


def test_release_tags_require_explicit_tag_context(tmp_path: Path) -> None:
    root, _ = fixture(tmp_path)
    (root / "docs" / "versions.md").write_text(
        "Playwright image v1.62.1-noble.\n"
        "Node v24.11.0.\n"
        "Release tag: sk7-v1.2.3\n"
        "[release](https://github.com/example/project/releases/tag/v2.0.0)\n"
    )
    subprocess.run(["git", "-C", str(root), "add", "."], check=True)
    subprocess.run(["git", "-C", str(root), "commit", "-qm", "versions"], check=True)
    ref = git(root, "rev-parse", "HEAD")
    rows = evidence.inventory(root, ref)
    refs = evidence.extract_references(root, ref, rows)
    tags = [row["target"] for row in refs if row["type"] == "release_tag"]
    assert "v1.62.1-noble" not in tags
    assert "v24.11.0" not in tags
    assert "sk7-v1.2.3" in tags
    assert "v2.0.0" in tags
