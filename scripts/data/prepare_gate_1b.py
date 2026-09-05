"""Single cross-platform entry point; no Git mutation, download, or training."""

import argparse
import hashlib
import importlib.metadata
import json
import platform
import shutil
import subprocess
import sys
import tomllib
from pathlib import Path

from contract import ROOT, load_manifest, outside_repository


def git_output(*arguments: str) -> str:
    result = subprocess.run(["git", "-C", str(ROOT), *arguments], capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise ValueError("Git preflight failed; check the local checkout")
    return result.stdout.strip()


def check_environment() -> None:
    if platform.python_version() != (ROOT / ".python-version").read_text().strip():
        raise ValueError("Python does not match .python-version; run uv sync --group ai --frozen")
    locked = tomllib.loads((ROOT / "uv.lock").read_text(encoding="utf-8"))
    expected = {item["name"]: item["version"] for item in locked["package"]}
    for name in ("pandas", "pyarrow", "scikit-learn", "joblib", "numpy", "scipy"):
        if importlib.metadata.version(name) != expected[name]:
            raise ValueError("AI environment differs from uv.lock; run uv sync --group ai --frozen")


def file_digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def preflight(raw: Path, work: Path) -> tuple[Path, Path, str, dict[str, str]]:
    check_environment()
    if git_output("status", "--porcelain", "--untracked-files=all"):
        raise ValueError("checkout is not clean; preserve existing changes and use a clean checkout")
    commit = git_output("rev-parse", "HEAD")
    raw, work = outside_repository(raw), outside_repository(work)
    if raw == work or raw in work.parents or work in raw.parents:
        raise ValueError("raw and work directories must not overlap")
    if work.exists():
        raise ValueError("work directory already exists; select a new directory")
    manifest = load_manifest()
    hashes = {}
    for filename in manifest["files"].values():
        path = outside_repository(raw / filename)
        if not path.is_file() or path.stat().st_size == 0:
            raise ValueError(f"missing or empty required file: {filename}")
        hashes[filename] = file_digest(path)
    return raw, work, commit, hashes


def run_stage(name: str, script: str, *arguments: object) -> None:
    print(f"{name}: running", flush=True)
    result = subprocess.run(
        [sys.executable, str(ROOT / script), *map(str, arguments)],
        cwd=ROOT,
        capture_output=True,
        timeout=300,
    )
    if result.returncode:
        # Do not expose pandas exceptions, row values, or filesystem paths.
        raise ValueError(f"{name}: failed; partial outputs retained, no later stage executed")
    print(f"{name}: passed", flush=True)


def prepare(raw: Path, work: Path) -> None:
    raw, work, commit, hashes = preflight(raw, work)
    work.mkdir(parents=True, exist_ok=False)
    for name in ("run-a", "run-b"):
        run = work / name
        run.mkdir()
        run_stage(f"{name}/manifest", "scripts/data/verify_manifest.py")
        run_stage(f"{name}/schema", "scripts/data/audit_schema.py", raw)
        run_stage(f"{name}/derive", "scripts/data/build_derived_table.py", raw, run / "derived.parquet")
        run_stage(
            f"{name}/split",
            "scripts/data/freeze_split.py",
            run / "derived.parquet",
            run / "splits",
            "--evidence",
            run / "evidence.json",
            "--commit",
            commit,
        )
        run_stage(
            f"{name}/evidence", "scripts/ci/verify_model_gate_1b_contract.py", "--evidence", run / "evidence.json"
        )
        if any(file_digest(raw / filename) != digest for filename, digest in hashes.items()):
            raise ValueError("source files changed during preparation; evidence is not accepted")
        if git_output("rev-parse", "HEAD") != commit or git_output("status", "--porcelain", "--untracked-files=all"):
            raise ValueError("checkout changed during preparation; evidence is not accepted")
    first = json.loads((work / "run-a/evidence.json").read_text(encoding="utf-8"))
    second = json.loads((work / "run-b/evidence.json").read_text(encoding="utf-8"))
    if first != second:
        raise ValueError("reproducibility comparison failed; both runs retained for local review")
    (work / "local-review.json").write_text(
        json.dumps(
            {
                "repository_commit": commit,
                "python": platform.python_version(),
                "platform": sys.platform,
                "raw_file_sha256": hashes,
                "two_runs_equal": True,
                "human_review": "pending",
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    shutil.copyfile(work / "run-a/evidence.json", work / "gate-1b-evidence.json")
    print("prepared_not_trained: two runs match; human evidence review still required", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", type=Path, required=True)
    parser.add_argument("--work-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        prepare(args.raw_dir, args.work_dir)
    except (ValueError, OSError, importlib.metadata.PackageNotFoundError, subprocess.TimeoutExpired) as error:
        message = str(error) if isinstance(error, ValueError) else "environment, filesystem, or stage timeout failure"
        print(f"Gate 1B stopped: {message}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
