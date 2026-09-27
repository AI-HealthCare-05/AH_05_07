#!/usr/bin/env python3
"""Classify an SK7 autonomous change as routine, protected, or denied.

The guard deliberately does not execute arbitrary project commands. It only reads
Git path state and applies repository-owned path policy. AGENTS.md, the task
Issue, and required CI define the workflow. Classification is advisory scope
information; protected changes may still be merged by an authorized agent.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

LANE_ORDER = {"none": 0, "routine": 1, "protected": 2, "deny": 3}

# Retired workflow surfaces, not a registry of current authorities.
DENY_EXACT = {
    "docs/project-handoff.md",
    "docs/deployment-ssot.md",
    "docs/autopilot-lite.md",
    "scripts/git/resume_task_context.py",
    "scripts/check_repository_evidence.py",
    "docs/scene-implementation-status.md",
    "docs/architecture/RELEASE_CONTRACT.md",
}
DENY_PREFIXES = ("docs/evidence/repository-atlas/",)

PROTECTED_EXACT = {
    ".github/CODEOWNERS",
    "AGENTS.md",
    "scripts/git/autopilot_guard.py",
    "scripts/git/codex-commit",
    "Dockerfile",
    "pyproject.toml",
    "uv.lock",
    "web/package.json",
    "web/package-lock.json",
    "wrangler.jsonc",
    "wrangler.toml",
    "docs/ai-toolchain-ssot.md",
    "docs/data-contract.md",
    "docs/deployment.md",
    "docs/model-promotion.md",
    "docs/model-v2-product-contract.md",
}
PROTECTED_PREFIXES = (
    ".github/",
    "app/",
    "data/",
    "docs/adr/",
    "docs/architecture/",
    "migrations/",
    "ops/",
    "scripts/ci/",
    "scripts/data/",
    "scripts/model/",
    "supabase/",
    "tests/",
)


@dataclass(frozen=True)
class Classification:
    lane: str
    routine: tuple[str, ...]
    protected: tuple[str, ...]
    deny: tuple[str, ...]

    @property
    def changed_paths(self) -> tuple[str, ...]:
        return tuple(sorted((*self.routine, *self.protected, *self.deny)))


def normalize_path(raw: str) -> str:
    """Normalize Git's slash-separated relative path for policy matching."""
    return raw.strip().replace("\\", "/").removeprefix("./")


def has_secret_like_segment(path: str) -> bool:
    """Deny tracked environment/credential containers without broad word matching."""
    parts = Path(path).parts
    return any(part == ".env" or part.startswith(".env.") for part in parts) or any(
        part in {"credentials", "secrets"} for part in parts
    )


def has_retired_authority_role(path: str) -> bool:
    """Match named workflow roles, never document content or bare status/current."""
    if path in DENY_EXACT or path.startswith(DENY_PREFIXES) or path == "docs/evidence/repository-atlas":
        return True

    parts = tuple(part.lower().replace("_", "-") for part in Path(path).parts)
    if len(parts) < 2 or parts[0] != "docs":
        return False
    # Historical filenames are inert, except the explicitly retired atlas above.
    if any(part in {"evidence", "research", "adr"} for part in parts[1:-1]):
        return False
    names = tuple(Path(part).stem for part in parts[1:])
    if any(re.search(r"(?:^|-)(?:authority-map|authority-registry|repository-atlas)(?:-|$)", name) for name in names):
        return True
    # Broader handoff/ledger roles are limited to top-level or workflow docs.
    return (len(parts) == 2 or parts[1] in {"current", "workflow", "governance"}) and any(
        re.search(
            r"(?:^|-)(?:handoff|checkpoint-ledger|(?:task|project|workflow)-checkpoint|implementation-status|current-status|deployment-ssot)(?:-|$)",
            name,
        )
        for name in names
    )


def classify_path(raw: str) -> str:
    path = normalize_path(raw)
    if not path:
        return "none"
    if has_retired_authority_role(path) or has_secret_like_segment(path):
        return "deny"
    if path in PROTECTED_EXACT or path.startswith(PROTECTED_PREFIXES):
        return "protected"
    return "routine"


def classify_paths(paths: Iterable[str]) -> Classification:
    buckets: dict[str, list[str]] = {"routine": [], "protected": [], "deny": []}
    for raw in sorted({normalize_path(path) for path in paths if normalize_path(path)}):
        lane = classify_path(raw)
        if lane != "none":
            buckets[lane].append(raw)

    lane = "none"
    for candidate in ("routine", "protected", "deny"):
        if buckets[candidate] and LANE_ORDER[candidate] > LANE_ORDER[lane]:
            lane = candidate

    return Classification(
        lane=lane,
        routine=tuple(buckets["routine"]),
        protected=tuple(buckets["protected"]),
        deny=tuple(buckets["deny"]),
    )


def run_git(root: Path, *args: str) -> list[str]:
    result = subprocess.run(
        ["git", "-C", str(root), *args],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "git command failed"
        raise RuntimeError(detail)
    return [line for line in result.stdout.splitlines() if line]


def changed_paths(root: Path, base: str, head: str, committed_only: bool) -> set[str]:
    paths = set(run_git(root, "diff", "--name-only", f"{base}...{head}", "--"))
    if not committed_only:
        paths.update(run_git(root, "diff", "--name-only", "--"))
        paths.update(run_git(root, "diff", "--cached", "--name-only", "--"))
        paths.update(run_git(root, "ls-files", "--others", "--exclude-standard"))

    # Reject revival in the candidate tree, while permitting removal of a retired
    # surface. Keep secret/credential classification unchanged, even on deletion.
    authority_paths = {path for path in paths if has_retired_authority_role(path) and not has_secret_like_segment(path)}
    if committed_only:
        present = (
            set(run_git(root, "ls-tree", "-r", "--name-only", head, "--", *sorted(authority_paths)))
            if authority_paths
            else set()
        )
    else:
        present = {path for path in authority_paths if (root / path).exists() or (root / path).is_symlink()}
    return paths - (authority_paths - present)


def render(result: Classification, as_json: bool) -> None:
    payload = {
        "lane": result.lane,
        "changedPaths": list(result.changed_paths),
        "routine": list(result.routine),
        "protected": list(result.protected),
        "deny": list(result.deny),
    }
    if as_json:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return

    print(f"autopilot lane: {result.lane}")
    for key in ("routine", "protected", "deny"):
        values = payload[key]
        if values:
            print(f"{key}:")
            for path in values:
                print(f"  - {path}")


def self_test() -> None:
    assert classify_path("web/src/App.tsx") == "routine"
    assert classify_path("web/e2e/living-replay.spec.ts") == "routine"
    assert classify_path("docs/README-notes.md") == "routine"
    assert classify_path("app/main.py") == "protected"
    assert classify_path("supabase/migrations/001.sql") == "protected"
    assert classify_path("web/package-lock.json") == "protected"
    assert classify_path("scripts/ci/verify_secret_boundary.py") == "protected"
    assert classify_path("AGENTS.md") == "protected"
    assert classify_path("docs/deployment.md") == "protected"
    assert classify_path(".github/workflows/checks.yml") == "protected"
    assert classify_path("scripts/git/autopilot_guard.py") == "protected"
    assert classify_path("web/.env.production") == "deny"

    for path in (
        "docs/project-handoff.md",
        "docs/deployment-ssot.md",
        "docs/autopilot-lite.md",
        "docs/evidence/repository-atlas/README.md",
        "docs/evidence/repository-atlas/nested/manifest.json",
        "scripts/git/resume_task_context.py",
        "scripts/check_repository_evidence.py",
        "docs/scene-implementation-status.md",
        "docs/architecture/RELEASE_CONTRACT.md",
        "docs/team-handoff.md",
        "docs/current/team-handoff.md",
        "docs/architecture/authority-map.md",
        "docs/governance/authority-registry-v2.md",
        "docs/authority-registry/README.md",
        "docs/task-checkpoint-ledger.md",
        "docs/project-checkpoint.md",
        "docs/workflow/checkpoints/current-status.md",
        "docs/feature-implementation-status.md",
        "docs/current-status.md",
        "docs/repository-atlas-v2/index.md",
        "docs/CURRENT_HANDOFF.md",
    ):
        assert classify_path(path) == "deny", path

    for path in (
        "docs/status.md",
        "docs/current.md",
        "docs/model-checkpoint-format.md",
        "docs/submission-status-contract.md",
        "docs/product/current-session.md",
        "docs/domain/care-handoff.md",
        "docs/evidence/2026-task-handoff.md",
        "docs/evidence/authority-registry.md",
        "docs/evidence/archive/repository-atlas/README.md",
        "docs/research/current-status.md",
        "docs/research/repository-atlas/notes.md",
    ):
        assert classify_path(path) == "routine", path
    for path in (
        "docs/data-contract.md",
        "docs/model-v2-product-contract.md",
        "docs/architecture/session-status.md",
        "docs/adr/0042-authority-registry.md",
        "docs/architecture/adr/0043-current-handoff.md",
    ):
        assert classify_path(path) == "protected", path

    mixed = classify_paths(["web/src/App.tsx", "app/main.py"])
    assert mixed.lane == "protected"
    assert mixed.protected == ("app/main.py",)

    governance = classify_paths(["web/src/App.tsx", "AGENTS.md"])
    assert governance.lane == "protected"
    assert governance.protected == ("AGENTS.md",)

    denied = classify_paths(["web/src/App.tsx", "web/.env.production"])
    assert denied.lane == "deny"
    assert denied.deny == ("web/.env.production",)

    revived = classify_paths(["docs/data-contract.md", "docs/current-handoff.md"])
    assert revived.lane == "deny"
    assert revived.deny == ("docs/current-handoff.md",)

    assert classify_paths([]).lane == "none"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="origin/main")
    parser.add_argument("--head", default="HEAD")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--committed-only", action="store_true")
    parser.add_argument("--require-routine", action="store_true")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        self_test()
        print("autopilot guard self-test: passed")
        return 0

    try:
        paths = changed_paths(args.root.resolve(), args.base, args.head, args.committed_only)
    except RuntimeError as exc:
        print(f"autopilot guard failed: {exc}")
        return 3

    result = classify_paths(paths)
    render(result, args.json)

    if result.lane == "deny":
        print("autopilot decision: stop; forbidden authority or secret/credential paths detected")
        return 1
    if result.lane == "protected":
        if args.require_routine:
            print("autopilot decision: strict routine assertion failed; protected scope detected")
            return 2
        print("autopilot decision: protected lane; Issue/PR flow is allowed and agent merge follows required CI")
        return 0
    if result.lane == "none":
        print("autopilot decision: no change detected")
        return 0

    print("autopilot decision: routine lane; Issue/PR flow is allowed and agent merge follows required CI")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
