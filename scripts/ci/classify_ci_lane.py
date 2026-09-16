#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
from dataclasses import dataclass

DOC_FILES = {"README.md", "AGENTS.md"}
DOC_PREFIXES = ("docs/",)

FRONTEND_TOOL_PREFIXES = ("tools/character-preview/",)
FRONTEND_TOOL_FILES = {
    "tools/mvp1-capture.cjs",
    "tools/submission-record.cjs",
    "tools/submission-video-check.cjs",
    "tools/submission-slides.mjs",
}

# Browser-side paths that cross protected auth/API/model/deployment boundaries.
PROTECTED_WEB_FILES = {
    "web/src/App.tsx",
    "web/src/main.tsx",
    "web/src/lib/api.ts",
    "web/src/lib/api-contract.ts",
    "web/src/lib/authEmailConfirm.ts",
    "web/src/lib/supabase.ts",
    "web/package.json",
    "web/package-lock.json",
    "web/wrangler.jsonc",
    "web/scripts/verify-production-web-env.mjs",
    "web/scripts/verify-production-web-env.test.mjs",
}
PROTECTED_WEB_PREFIXES = (
    "web/src/lib/auth",
    "web/src/lib/model",
    "web/src/ui/model",
    "web/public/model",
    "web/e2e/model-v2",
    "web/scripts/verify-model-v2-assets",
)

MODEL_WEB_PREFIXES = (
    "web/src/lib/model",
    "web/src/ui/model",
    "web/public/model",
    "web/e2e/model-v2",
    "web/scripts/verify-model-v2-assets",
)

SCENE_TOKENS = (
    "/scene/",
    "Scene",
    "scene-",
    "scene.",
    "companion",
    "Companion",
    "diorama",
)
SCENE_PREFIXES = (
    "web/src/components/scene/",
    "web/src/ui/scene",
    "web/e2e/companion",
    "web/e2e/diorama",
    "web/e2e/living-scene",
    "tools/character-preview/",
)
SCENE_FILES = {
    "web/src/components/CompanionReviewRenderer.tsx",
    "web/src/components/CompanionRuntimeBoundary.tsx",
    "web/src/components/companionInteraction.ts",
    "web/src/components/companionLook.ts",
    "web/src/ui/companion.ts",
    "web/src/components/VisualStage.tsx",
    "web/src/components/SceneShell.tsx",
}

DEPLOYMENT_FILES = {
    "cloudbuild.api.yaml",
    "web/wrangler.jsonc",
    "scripts/ci/verify_deployment_smoke.py",
}
DEPLOYMENT_PREFIXES = ("ops/",)

FULL_PREFIXES = (
    ".github/",
    "app/",
    "ai_worker/",
    "supabase/",
    "tests/",
    "scripts/",
    "data/",
    "model/",
    "models/",
)
FULL_FILES = {
    "pyproject.toml",
    "uv.lock",
    ".python-version",
    "cloudbuild.api.yaml",
}


@dataclass(frozen=True)
class Result:
    lane: str
    web: bool
    scene: bool
    model_web: bool
    deployment: bool
    full: bool

    def github_output(self) -> str:
        def b(value: bool) -> str:
            return "true" if value else "false"

        return "\n".join(
            [
                f"lane={self.lane}",
                f"web={b(self.web)}",
                f"scene={b(self.scene)}",
                f"model_web={b(self.model_web)}",
                f"deployment={b(self.deployment)}",
                f"full={b(self.full)}",
            ]
        )


def is_docs(path: str) -> bool:
    return path in DOC_FILES or path.startswith(DOC_PREFIXES)


def is_frontend_tool(path: str) -> bool:
    return path in FRONTEND_TOOL_FILES or path.startswith(FRONTEND_TOOL_PREFIXES)


def is_web(path: str) -> bool:
    return path.startswith("web/") or is_frontend_tool(path)


def is_protected_web(path: str) -> bool:
    return path in PROTECTED_WEB_FILES or path.startswith(PROTECTED_WEB_PREFIXES)


def is_scene(path: str) -> bool:
    if path in SCENE_FILES or path.startswith(SCENE_PREFIXES):
        return True
    if not path.startswith("web/"):
        return False
    return any(token in path for token in SCENE_TOKENS)


def is_model_web(path: str) -> bool:
    return path.startswith(MODEL_WEB_PREFIXES)


def is_deployment(path: str) -> bool:
    return path in DEPLOYMENT_FILES or path.startswith(DEPLOYMENT_PREFIXES)


def requires_full(path: str) -> bool:
    if is_docs(path):
        return False
    if is_web(path):
        return is_protected_web(path)
    if path in FULL_FILES or path.startswith(FULL_PREFIXES):
        return True
    # Unknown paths fail closed.
    return True


def classify(files: list[str]) -> Result:
    unique = sorted({f for f in files if f})

    if not unique:
        return Result("full", False, False, False, True, True)

    web = any(is_web(f) for f in unique)
    scene = any(is_scene(f) for f in unique)
    model_web = any(is_model_web(f) for f in unique)
    deployment = any(is_deployment(f) for f in unique)
    full = any(requires_full(f) for f in unique)

    if full:
        lane = "full"
    elif web:
        lane = "frontend"
    else:
        lane = "docs"

    return Result(lane, web, scene, model_web, deployment, full)


def changed_files(base: str, head: str) -> list[str]:
    if set(base) == {"0"}:
        output = subprocess.check_output(
            ["git", "show", "--pretty=format:", "--name-only", head],
            text=True,
        )
    else:
        output = subprocess.check_output(
            ["git", "diff", "--name-only", base, head],
            text=True,
        )
    return [line for line in output.splitlines() if line]


def self_test() -> None:
    cases = [
        (
            ["web/src/components/JourneyToday.tsx", "web/src/components/journey-today.css"],
            Result("frontend", True, False, False, False, False),
        ),
        (
            ["web/src/components/CompanionReviewRenderer.tsx"],
            Result("frontend", True, True, False, False, False),
        ),
        (
            ["web/src/App.tsx"],
            Result("full", True, False, False, False, True),
        ),
        (
            ["web/src/lib/api.ts"],
            Result("full", True, False, False, False, True),
        ),
        (
            ["web/src/lib/api-contract.ts"],
            Result("full", True, False, False, False, True),
        ),
        (
            ["web/src/lib/authEmailConfirm.ts"],
            Result("full", True, False, False, False, True),
        ),
        (
            ["web/package.json"],
            Result("full", True, False, False, False, True),
        ),
        (
            ["web/scripts/verify-model-v2-assets.mjs"],
            Result("full", True, False, True, False, True),
        ),
        (
            ["supabase/migrations/example.sql"],
            Result("full", False, False, False, False, True),
        ),
        (
            ["docs/project-handoff.md", "README.md"],
            Result("docs", False, False, False, False, False),
        ),
        (
            [".github/workflows/checks.yml"],
            Result("full", False, False, False, False, True),
        ),
        (
            ["web/wrangler.jsonc"],
            Result("full", True, False, False, True, True),
        ),
    ]

    for files, expected in cases:
        actual = classify(files)
        if actual != expected:
            raise AssertionError(f"{files}: expected {expected}, got {actual}")

    print("ci-lane classifier self-test: passed")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base")
    parser.add_argument("--head")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return 0

    if not args.base or not args.head:
        parser.error("--base and --head are required unless --self-test is used")

    files = changed_files(args.base, args.head)
    result = classify(files)
    print(
        f"ci lane: {result.lane}; changed files: {', '.join(files) or '(none)'}",
        file=sys.stderr,
    )
    print(result.github_output())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
