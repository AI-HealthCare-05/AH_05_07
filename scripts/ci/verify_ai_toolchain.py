"""Verify the bounded AI toolchain declaration and its durable authorities."""

import argparse
import re
import tempfile
import tomllib
from pathlib import Path
from typing import Any

REQUIRED_AI_DEPENDENCIES = {"joblib", "pandas", "pyarrow", "scikit-learn"}
FORBIDDEN_DIRECT_DEPENDENCIES = {
    "redis",
    "sentence-transformers",
    "torch",
    "torchaudio",
    "torchvision",
}
REQUIRED_AUTHORITIES = {
    "data/manifest/nhanes_2017_2020.json",
    "docs/ai-toolchain-ssot.md",
    "docs/adr/0002-ai-toolchain-and-change-control.md",
    "docs/data-contract.md",
    "docs/model-promotion.md",
    "scripts/data/audit_schema.py",
    "scripts/data/build_derived_table.py",
    "scripts/data/freeze_split.py",
    "scripts/data/verify_manifest.py",
    "scripts/model/compare_baselines.py",
    "scripts/model/evaluate_predictions.py",
    "scripts/model/train_artifact.py",
}
DEPENDENCY_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*")


def normalize_dependency(specification: str) -> str:
    """Return the normalized direct package name from one PEP 508 string."""
    match = DEPENDENCY_NAME.match(specification.strip())
    if match is None:
        return ""
    return match.group(0).lower().replace("_", "-").replace(".", "-")


def dependency_names(specifications: list[str]) -> set[str]:
    return {name for item in specifications if (name := normalize_dependency(item))}


def findings(config: dict[str, Any], raw_pyproject: str, root: Path) -> list[str]:
    """Return deterministic contract violations for one repository root."""
    issues: list[str] = []
    groups = config.get("dependency-groups", {})
    ai_names = dependency_names(groups.get("ai", []))

    missing = REQUIRED_AI_DEPENDENCIES - ai_names
    unexpected = ai_names - REQUIRED_AI_DEPENDENCIES
    if missing:
        issues.append(f"missing direct AI dependencies: {', '.join(sorted(missing))}")
    if unexpected:
        issues.append(f"unexpected direct AI dependencies: {', '.join(sorted(unexpected))}")

    all_direct = dependency_names(config.get("project", {}).get("dependencies", []))
    for values in groups.values():
        all_direct.update(dependency_names(values))
    forbidden = FORBIDDEN_DIRECT_DEPENDENCIES & all_direct
    if forbidden:
        issues.append(f"forbidden direct dependencies: {', '.join(sorted(forbidden))}")

    if "pytorch-cpu" in raw_pyproject:
        issues.append("unused pytorch-cpu package source remains configured")

    absent = sorted(path for path in REQUIRED_AUTHORITIES if not (root / path).is_file())
    if absent:
        issues.append(f"missing AI authority files: {', '.join(absent)}")
    return issues


def verify(root: Path) -> list[str]:
    pyproject = root / "pyproject.toml"
    if not pyproject.is_file():
        return ["pyproject.toml is missing"]
    raw = pyproject.read_text(encoding="utf-8")
    return findings(tomllib.loads(raw), raw, root)


def self_test() -> None:
    good = {
        "project": {"dependencies": ["fastapi>=1"]},
        "dependency-groups": {
            "ai": ["joblib>=1", "pandas>=2", "pyarrow>=1", "scikit_learn>=1"],
            "dev": ["pytest>=1"],
        },
    }
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        for relative in REQUIRED_AUTHORITIES:
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.touch()

        assert findings(good, "", root) == []

        missing = {**good, "dependency-groups": {"ai": ["pandas", "pyarrow", "joblib"]}}
        assert any("missing direct AI dependencies" in item for item in findings(missing, "", root))

        unexpected = {
            **good,
            "dependency-groups": {"ai": [*good["dependency-groups"]["ai"], "xgboost"]},
        }
        assert any("unexpected direct AI dependencies" in item for item in findings(unexpected, "", root))

        forbidden = {**good, "project": {"dependencies": ["redis>=1"]}}
        assert any("forbidden direct dependencies" in item for item in findings(forbidden, "", root))

        (root / "docs/model-promotion.md").unlink()
        assert any("missing AI authority files" in item for item in findings(good, "", root))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()

    if args.self_test:
        self_test()
        print("AI toolchain verifier self-test: passed")
        return 0

    issues = verify(args.root.resolve())
    if issues:
        for issue in issues:
            print(f"AI toolchain verification failed: {issue}")
        return 1
    print("AI toolchain verification: passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
