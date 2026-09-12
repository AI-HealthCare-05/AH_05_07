#!/usr/bin/env python3
"""Small, deterministic workflow kernel for the SK7 repository."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from collections.abc import Iterable, Sequence
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 2
ESCALATION_MESSAGE = "Do not begin a third implementation attempt.\nMeasure/reclassify/escalate first."
STATE_KEYS = {
    "schema_version",
    "active_task",
    "tasks",
    "expired_hypotheses",
    "last_verification",
    "manual_gates",
    "next_action",
}
TASK_KEYS = {
    "id",
    "title",
    "lane",
    "invariants",
    "guards",
    "failed_attempts",
    "successful_approaches",
    "override_reason",
    "status",
    "task_paths",
    "preexisting_dirty_paths",
}
ATTEMPT_KEYS = {"approach", "hypothesis"}
VERIFICATION_KEYS = {"lane", "files", "out_of_scope_files", "results"}
RESULT_KEYS = {"command", "result", "scope"}


class Sk7Error(RuntimeError):
    """Expected, user-facing CLI failure."""


def run_git(root: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=root,
        check=check,
        text=True,
        capture_output=True,
    )


def repository_root(start: Path | None = None) -> Path:
    here = (start or Path.cwd()).resolve()
    result = run_git(here, "rev-parse", "--show-toplevel")
    return Path(result.stdout.strip()).resolve()


def state_path(root: Path) -> Path:
    raw = run_git(root, "rev-parse", "--git-common-dir").stdout.strip()
    common = Path(raw)
    if not common.is_absolute():
        common = (root / common).resolve()
    return common / "sk7ctl" / "state.json"


def empty_state() -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "active_task": None,
        "tasks": [],
        "expired_hypotheses": [],
        "last_verification": None,
        "manual_gates": [],
        "next_action": "Define the next task.",
    }


def _expect(condition: bool, message: str) -> None:
    if not condition:
        raise Sk7Error(f"state validation failed: {message}")


def validate_state(state: Any) -> dict[str, Any]:
    _expect(isinstance(state, dict), "root must be an object")
    _expect(set(state) == STATE_KEYS, "unknown or missing state fields")
    _expect(state["schema_version"] == SCHEMA_VERSION, "unknown schema version")
    _expect(isinstance(state["tasks"], list), "tasks must be a list")
    _expect(isinstance(state["expired_hypotheses"], list), "expired_hypotheses must be a list")
    _expect(isinstance(state["manual_gates"], list), "manual_gates must be a list")
    _expect(isinstance(state["next_action"], str), "next_action must be text")
    _expect(state["active_task"] is None or isinstance(state["active_task"], str), "active_task must be null or text")
    _expect(
        state["last_verification"] is None or isinstance(state["last_verification"], dict),
        "last_verification must be null or an object",
    )
    ids: set[str] = set()
    for task in state["tasks"]:
        _expect(isinstance(task, dict) and set(task) == TASK_KEYS, "task has unknown or missing fields")
        _expect(isinstance(task["id"], str) and task["id"], "task id must be text")
        _expect(task["id"] not in ids, "duplicate task id")
        ids.add(task["id"])
        _expect(isinstance(task["title"], str) and task["title"], "task title must be text")
        _expect(task["lane"] in {"routine", "protected", "unknown"}, "invalid task lane")
        for key in (
            "invariants",
            "guards",
            "failed_attempts",
            "successful_approaches",
            "task_paths",
            "preexisting_dirty_paths",
        ):
            _expect(isinstance(task[key], list), f"task {key} must be a list")
        _expect(all(isinstance(item, str) for item in task["invariants"]), "task invariants must be text")
        _expect(all(isinstance(item, str) for item in task["guards"]), "task guards must be text")
        _expect(
            all(isinstance(item, str) for item in task["successful_approaches"]), "successful approaches must be text"
        )
        _expect(
            task["task_paths"] and all(isinstance(item, str) for item in task["task_paths"]),
            "task paths must be non-empty text",
        )
        _expect(
            all(isinstance(item, str) for item in task["preexisting_dirty_paths"]),
            "pre-existing dirty paths must be text",
        )
        for attempt in task["failed_attempts"]:
            _expect(
                isinstance(attempt, dict) and set(attempt) == ATTEMPT_KEYS,
                "failed attempt has unknown or missing fields",
            )
            _expect(isinstance(attempt["approach"], str), "failed approach must be text")
            _expect(
                attempt["hypothesis"] is None or isinstance(attempt["hypothesis"], str),
                "failed hypothesis must be null or text",
            )
        _expect(
            task["override_reason"] is None or isinstance(task["override_reason"], str),
            "override_reason must be null or text",
        )
        _expect(task["status"] in {"active", "closed", "superseded"}, "invalid task status")
    _expect(state["active_task"] is None or state["active_task"] in ids, "active_task does not identify a task")
    if state["active_task"] is not None:
        selected = next(task for task in state["tasks"] if task["id"] == state["active_task"])
        _expect(selected["status"] == "active", "active_task must identify an active task")
    _expect(all(isinstance(item, str) for item in state["expired_hypotheses"]), "expired hypotheses must be text")
    _expect(all(isinstance(item, str) for item in state["manual_gates"]), "manual gates must be text")
    verification = state["last_verification"]
    if verification is not None:
        _expect(set(verification) == VERIFICATION_KEYS, "verification has unknown or missing fields")
        _expect(verification["lane"] in {"routine", "protected", "unknown"}, "invalid verification lane")
        _expect(
            isinstance(verification["files"], list) and all(isinstance(item, str) for item in verification["files"]),
            "verification files must be text",
        )
        _expect(
            isinstance(verification["out_of_scope_files"], list)
            and all(isinstance(item, str) for item in verification["out_of_scope_files"]),
            "verification out-of-scope files must be text",
        )
        _expect(isinstance(verification["results"], list), "verification results must be a list")
        for result in verification["results"]:
            _expect(
                isinstance(result, dict) and set(result) == RESULT_KEYS,
                "verification result has unknown or missing fields",
            )
            _expect(all(isinstance(result[key], str) for key in RESULT_KEYS), "verification result values must be text")
    return state


class StateStore:
    def __init__(self, path: Path):
        self.path = path

    def load(self) -> dict[str, Any]:
        if not self.path.exists():
            return empty_state()
        try:
            value = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise Sk7Error(f"malformed state at {self.path}: {exc}") from exc
        return validate_state(value)

    def save(self, state: dict[str, Any]) -> None:
        validate_state(state)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, temporary = tempfile.mkstemp(prefix="state.", suffix=".tmp", dir=self.path.parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(state, handle, ensure_ascii=False, indent=2, sort_keys=True)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, self.path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)


def active_task(state: dict[str, Any]) -> dict[str, Any] | None:
    task_id = state["active_task"]
    return next((task for task in state["tasks"] if task["id"] == task_id), None)


def parse_porcelain_z(output: str) -> list[str]:
    fields = output.split("\0")
    paths: list[str] = []
    index = 0
    while index < len(fields) and fields[index]:
        entry = fields[index]
        _expect(len(entry) >= 4, "unexpected git status entry")
        status = entry[:2]
        paths.append(entry[3:])
        if "R" in status or "C" in status:
            index += 1
            if index < len(fields) and fields[index]:
                paths.append(fields[index])
        index += 1
    return paths


def dirty_files(root: Path) -> list[str]:
    status = run_git(root, "status", "--porcelain=v1", "-z", "--untracked-files=all").stdout
    return sorted(set(parse_porcelain_z(status)))


def changed_files(root: Path) -> list[str]:
    paths = set(dirty_files(root))
    upstream = run_git(root, "rev-parse", "--verify", "origin/main", check=False)
    if upstream.returncode == 0:
        committed = run_git(root, "diff", "--name-only", "-z", "origin/main...HEAD").stdout
        paths.update(path for path in committed.split("\0") if path)
    return sorted(paths)


def normalize_task_paths(paths: Iterable[str]) -> list[str]:
    normalized: set[str] = set()
    for raw in paths:
        path = raw.replace("\\", "/")
        while path.startswith("./"):
            path = path[2:]
        path = path.rstrip("/")
        if not path or path.startswith("/") or path == ".." or path.startswith("../"):
            raise Sk7Error(f"task path must be repository-relative: {raw}")
        normalized.add(path)
    if not normalized:
        raise Sk7Error("at least one --path is required")
    return sorted(normalized)


def path_is_in_scope(path: str, task_paths: Iterable[str]) -> bool:
    return any(path == scope or path.startswith(f"{scope}/") for scope in task_paths)


def classify_changes(
    dirty: Iterable[str],
    changed: Iterable[str],
    task: dict[str, Any] | None,
) -> tuple[list[str], list[str], list[str]]:
    dirty_set = set(dirty)
    if task is None:
        return sorted(set(changed)), [], []
    task_paths = task["task_paths"]
    preexisting = set(task["preexisting_dirty_paths"])
    task_changes = sorted(path for path in set(changed) if path_is_in_scope(path, task_paths))
    preexisting_unrelated = sorted(
        path for path in dirty_set if path in preexisting and not path_is_in_scope(path, task_paths)
    )
    out_of_scope = sorted(
        path for path in dirty_set if path not in preexisting and not path_is_in_scope(path, task_paths)
    )
    return task_changes, preexisting_unrelated, out_of_scope


def print_dirty_sections(
    task_changes: Iterable[str],
    preexisting: Iterable[str],
    out_of_scope: Iterable[str],
) -> None:
    print("DIRTY:")
    for heading, paths in (("TASK", task_changes), ("PRE-EXISTING / UNRELATED", preexisting)):
        print(f"{heading}:")
        values = list(paths)
        for path in values:
            print(f"- {path}")
        if not values:
            print("- none")
    print("OUT-OF-SCOPE DIRTY:")
    values = list(out_of_scope)
    for path in values:
        print(f"- {path}")
    if not values:
        print("- none")


def infer_lane(paths: Iterable[str]) -> str:
    items = list(paths)
    if not items:
        return "unknown"
    protected_prefixes = (
        "api/",
        "backend/",
        "server/",
        "supabase/",
        "migrations/",
        "infra/",
        ".github/",
        "model/",
        "scripts/model/",
        "scripts/deployment",
    )
    protected_tokens = (
        "auth",
        "rls",
        "retention",
        "schema",
        "secret",
        "model_v2",
        "model-v2",
        "deployment",
        "migration",
    )
    routine_prefixes = ("docs/", "scripts/", "tests/", "web/")
    routine_names = {"README.md", "AGENTS.md"}
    unknown = False
    for path in items:
        lowered = path.lower()
        if lowered.startswith(protected_prefixes) or any(token in lowered for token in protected_tokens):
            return "protected"
        if not (path.startswith(routine_prefixes) or path in routine_names):
            unknown = True
    return "unknown" if unknown else "routine"


def loop_state(task: dict[str, Any] | None) -> str:
    return "ESCALATE" if task and len(task["failed_attempts"]) >= 2 else "OK"


def print_loop(task: dict[str, Any] | None) -> None:
    state = loop_state(task)
    print(f"LOOP STATE = {state}")
    if state == "ESCALATE":
        print(ESCALATION_MESSAGE)
        if task and task["override_reason"]:
            print(f"USER APPROVAL OVERRIDE: {task['override_reason']}")


def effective_next(state: dict[str, Any], task: dict[str, Any] | None) -> str:
    if loop_state(task) == "ESCALATE" and task and not task["override_reason"]:
        return "Measure/reclassify/escalate first."
    return state["next_action"]


def cmd_status(args: argparse.Namespace, root: Path, store: StateStore) -> int:
    if args.refresh:
        fetched = run_git(root, "fetch", "origin", "main", check=False)
        if fetched.returncode:
            raise Sk7Error(f"git fetch failed: {fetched.stderr.strip()}")
    branch = run_git(root, "branch", "--show-current").stdout.strip() or "(detached)"
    head = run_git(root, "rev-parse", "HEAD").stdout.strip()
    remote = run_git(root, "rev-parse", "--verify", "origin/main", check=False)
    origin = remote.stdout.strip() if remote.returncode == 0 else "unavailable"
    ahead = behind = "unknown"
    if remote.returncode == 0:
        counts = run_git(root, "rev-list", "--left-right", "--count", "HEAD...origin/main").stdout.split()
        ahead, behind = counts
    dirty = dirty_files(root)
    state = store.load()
    task = active_task(state)
    paths, preexisting, out_of_scope = classify_changes(dirty, changed_files(root), task)
    print(f"repository root: {root}")
    print(f"branch: {branch}")
    print(f"HEAD: {head}")
    print(f"origin/main: {origin}")
    print(f"ahead/behind: {ahead}/{behind}")
    print_dirty_sections(paths, preexisting, out_of_scope)
    print(f"inferred lane: {infer_lane(paths)}")
    print(f"active task: {task['title'] if task else 'none'}")
    print(f"failed attempt count: {len(task['failed_attempts']) if task else 0}")
    print_loop(task)
    return 0


def _require_task(state: dict[str, Any]) -> dict[str, Any]:
    task = active_task(state)
    if task is None:
        raise Sk7Error("no active task; run 'plan start' first")
    return task


def display_plan(state: dict[str, Any]) -> None:
    task = active_task(state)
    print(f"ACTIVE TASK: {task['title'] if task else 'none'}")
    if task:
        print(f"TASK ID: {task['id']}")
        print(f"LANE: {task['lane']}")
        print(f"TASK PATHS: {', '.join(task['task_paths'])}")
        print(f"INVARIANTS: {', '.join(task['invariants']) or 'none'}")
        print(f"GUARDS: {', '.join(task['guards']) or 'none'}")
        print(f"FAILED ATTEMPTS: {len(task['failed_attempts'])}")
        print(f"SUCCESSFUL APPROACHES: {len(task['successful_approaches'])}")
    print_loop(task)
    print(f"NEXT: {effective_next(state, task)}")


def cmd_plan(args: argparse.Namespace, root: Path, store: StateStore) -> int:  # noqa: C901
    state = store.load()
    if args.plan_command == "show":
        display_plan(state)
        return 0
    if args.plan_command == "start":
        previous = active_task(state)
        if previous:
            previous["status"] = "superseded"
        task_id = f"task-{len(state['tasks']) + 1}"
        task = {
            "id": task_id,
            "title": args.title,
            "lane": args.lane,
            "invariants": args.invariant,
            "guards": args.guard,
            "failed_attempts": [],
            "successful_approaches": [],
            "override_reason": None,
            "status": "active",
            "task_paths": normalize_task_paths(args.path),
            "preexisting_dirty_paths": dirty_files(root),
        }
        state["tasks"].append(task)
        state["active_task"] = task_id
        state["manual_gates"] = args.manual_gate
        state["next_action"] = args.next
    elif args.plan_command == "fail":
        task = _require_task(state)
        task["failed_attempts"].append({"approach": args.approach, "hypothesis": args.hypothesis})
        if args.hypothesis and args.hypothesis not in state["expired_hypotheses"]:
            state["expired_hypotheses"].append(args.hypothesis)
        if args.next:
            state["next_action"] = args.next
    elif args.plan_command == "success":
        task = _require_task(state)
        task["successful_approaches"].append(args.approach)
        if args.next:
            state["next_action"] = args.next
    elif args.plan_command == "expire":
        task = _require_task(state)
        if args.hypothesis not in state["expired_hypotheses"]:
            state["expired_hypotheses"].append(args.hypothesis)
        task["invariants"] = [item for item in task["invariants"] if item != args.hypothesis]
        task["guards"] = [item for item in task["guards"] if item != args.hypothesis]
        if args.next:
            state["next_action"] = args.next
    elif args.plan_command == "override":
        task = _require_task(state)
        task["override_reason"] = args.reason
        if args.next:
            state["next_action"] = args.next
    elif args.plan_command == "gate":
        _require_task(state)
        if args.description not in state["manual_gates"]:
            state["manual_gates"].append(args.description)
    elif args.plan_command == "close":
        task = _require_task(state)
        task["status"] = "closed"
        state["active_task"] = None
        state["next_action"] = args.next
    else:
        raise Sk7Error("unknown plan command")
    store.save(state)
    display_plan(state)
    return 0


def verification_plan(paths: Sequence[str], lane: str) -> list[dict[str, Any]]:
    plan: list[dict[str, Any]] = []
    if paths:
        plan.append(
            {
                "cost": "CHEAP",
                "display": "git diff --check -- <task paths>",
                "cwd": ".",
                "argv": ["git", "diff", "--check", "--", *paths],
                "run": True,
                "scope": "task-scope working-tree whitespace errors",
            },
        )
    if any(path in {"scripts/sk7ctl.py", "scripts/test_sk7ctl.py"} for path in paths):
        plan.extend(
            [
                {
                    "cost": "CHEAP",
                    "display": "python3 -m unittest scripts/test_sk7ctl.py",
                    "cwd": ".",
                    "argv": [sys.executable, "-m", "unittest", "scripts/test_sk7ctl.py"],
                    "run": True,
                    "scope": "sk7ctl unit behavior",
                },
                {
                    "cost": "CHEAP",
                    "display": "python3 -c <AST parse scripts/sk7ctl.py>",
                    "cwd": ".",
                    "argv": [
                        sys.executable,
                        "-c",
                        "import ast,pathlib; ast.parse(pathlib.Path('scripts/sk7ctl.py').read_text())",
                    ],
                    "run": True,
                    "scope": "sk7ctl Python syntax",
                },
            ]
        )
    web_product = any(path.startswith("web/") and path.endswith((".ts", ".tsx", ".css")) for path in paths)
    scene_related = any(
        path.startswith("web/") and any(word in path.lower() for word in ("scene", "companion", "manifest"))
        for path in paths
    )
    if scene_related:
        plan.append(
            {
                "cost": "MODERATE",
                "display": "cd web && npm run verify:scene-manifest",
                "cwd": "web",
                "argv": ["npm", "run", "verify:scene-manifest"],
                "run": True,
                "scope": "scene manifest consistency",
            }
        )
    if web_product:
        plan.append(
            {
                "cost": "MODERATE",
                "display": "cd web && npm run build",
                "cwd": "web",
                "argv": ["npm", "run", "build"],
                "run": True,
                "scope": "web TypeScript/CSS build",
            }
        )
    if any(path.startswith("web/e2e/") for path in paths):
        plan.append(
            {
                "cost": "EXPENSIVE",
                "display": "targeted Playwright case selection required",
                "cwd": "web",
                "argv": [],
                "run": False,
                "scope": "directly affected browser behavior",
            }
        )
    if lane == "protected":
        plan.append(
            {
                "cost": "EXPENSIVE",
                "display": "select the directly relevant protected-boundary contract tests",
                "cwd": ".",
                "argv": [],
                "run": False,
                "scope": "protected boundary; routine checks cannot establish PASS",
            }
        )
    return plan


def cmd_verify(args: argparse.Namespace, root: Path, store: StateStore) -> int:
    state = store.load()
    task = _require_task(state)
    dirty = dirty_files(root)
    paths, preexisting, out_of_scope = classify_changes(dirty, changed_files(root), task)
    lane = infer_lane(paths)
    plan = verification_plan(paths, lane)
    print_dirty_sections(paths, preexisting, out_of_scope)
    print(f"LANE: {lane}")
    print("VERIFICATION PLAN:")
    for item in plan:
        suffix = " [manual]" if not item["run"] else ""
        print(f"- {item['cost']}: {item['display']} — {item['scope']}{suffix}")
    if not args.run:
        print("PLAN ONLY: no commands executed (use --run for CHEAP/MODERATE commands).")
        if out_of_scope:
            print("RESULT: OUT-OF-SCOPE DIRTY REQUIRES REVIEW; it is not part of routine PASS.")
        if lane == "protected":
            print("RESULT: PROTECTED REVIEW REQUIRED; routine verification cannot be PASS.")
        return 0

    results: list[dict[str, str]] = []
    failed = False
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    for item in plan:
        if not item["run"]:
            continue
        completed = subprocess.run(item["argv"], cwd=root / item["cwd"], env=env, text=True)
        result = "PASS" if completed.returncode == 0 else "FAIL"
        failed = failed or completed.returncode != 0
        results.append({"command": item["display"], "result": result, "scope": item["scope"]})
        print(f"{item['display']} -> {result}")
    state["last_verification"] = {
        "lane": lane,
        "files": paths,
        "out_of_scope_files": out_of_scope,
        "results": results,
    }
    store.save(state)
    blocked = False
    if out_of_scope:
        print("RESULT: OUT-OF-SCOPE DIRTY REQUIRES REVIEW; it is not part of routine PASS.")
        blocked = True
    if lane == "protected":
        print("RESULT: PROTECTED REVIEW REQUIRED; routine verification cannot be PASS.")
        blocked = True
    if blocked:
        return 2
    return 1 if failed else 0


def _bullet(items: Iterable[str], empty: str = "none") -> list[str]:
    values = list(items)
    return [f"- {value}" for value in values] if values else [f"- {empty}"]


def render_handoff(root: Path, state: dict[str, Any]) -> str:
    branch = run_git(root, "branch", "--show-current").stdout.strip() or "(detached)"
    head = run_git(root, "rev-parse", "HEAD").stdout.strip()
    remote = run_git(root, "rev-parse", "--verify", "origin/main", check=False)
    origin = remote.stdout.strip() if remote.returncode == 0 else "unavailable"
    dirty = dirty_files(root)
    task = active_task(state)
    lines = [
        "# SK7 HANDOFF",
        "",
        "## CANONICAL",
        "",
        f"- origin/main: {origin}",
        f"- local HEAD: {head}",
        f"- branch: {branch}",
        f"- worktree: {'dirty' if dirty else 'clean'}",
        "",
        "## ACTIVE",
        "",
    ]
    if task:
        lines.extend([f"- task: {task['title']}", f"- lane: {task['lane']}"])
        lines.append(f"- task paths: {', '.join(task['task_paths'])}")
        lines.extend(f"- invariant: {item}" for item in task["invariants"])
        lines.extend(f"- guard: {item}" for item in task["guards"])
        lines.append(f"- loop state: {loop_state(task)}")
    else:
        lines.append("- none")
    lines.extend(["", "## VERIFIED", ""])
    verification = state["last_verification"]
    if verification:
        lines.append(f"- lane/scope: {verification['lane']}; {', '.join(verification['files']) or 'clean tree'}")
        if verification["out_of_scope_files"]:
            lines.append(f"- OUT-OF-SCOPE DIRTY: {', '.join(verification['out_of_scope_files'])}")
        lines.extend(f"- {item['command']} -> {item['result']} ({item['scope']})" for item in verification["results"])
    else:
        lines.append("- none recorded")
    lines.extend(["", "## MANUAL GATES", ""])
    lines.extend(_bullet(state["manual_gates"]))
    lines.extend(["", "## EXPIRED / DO NOT CARRY FORWARD", ""])
    lines.extend(_bullet(state["expired_hypotheses"]))
    lines.extend(["", "## NEXT", "", f"- {effective_next(state, task)}"])
    return "\n".join(lines) + "\n"


def cmd_handoff(_args: argparse.Namespace, root: Path, store: StateStore) -> int:
    print(render_handoff(root, store.load()), end="")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="sk7ctl", description="Deterministic SK7 workflow kernel v0.1")
    commands = parser.add_subparsers(dest="command", required=True)
    status = commands.add_parser("status", help="show repository and loop status without network access")
    status.add_argument("--refresh", action="store_true", help="fetch origin main before reporting")
    plan = commands.add_parser("plan", help="manage the local task plan")
    plan_commands = plan.add_subparsers(dest="plan_command", required=True)
    plan_commands.add_parser("show", help="display the current plan")
    start = plan_commands.add_parser("start", help="start an explicit new task")
    start.add_argument("title")
    start.add_argument("--lane", choices=("routine", "protected", "unknown"), default="unknown")
    start.add_argument("--next", required=True, help="the single next action")
    start.add_argument(
        "--path", action="append", required=True, help="repository-relative task file or directory (repeatable)"
    )
    start.add_argument("--invariant", action="append", default=[])
    start.add_argument("--guard", action="append", default=[])
    start.add_argument("--manual-gate", action="append", default=[])
    fail = plan_commands.add_parser("fail", help="record an implementation failure")
    fail.add_argument("approach")
    fail.add_argument("--hypothesis")
    fail.add_argument("--next")
    success = plan_commands.add_parser("success", help="record a successful approach")
    success.add_argument("approach")
    success.add_argument("--next")
    expire = plan_commands.add_parser("expire", help="expire a hypothesis")
    expire.add_argument("hypothesis")
    expire.add_argument("--next")
    override = plan_commands.add_parser("override", help="record explicit user approval for another attempt")
    override.add_argument("reason")
    override.add_argument("--next")
    gate = plan_commands.add_parser("gate", help="add an unresolved manual gate")
    gate.add_argument("description")
    close = plan_commands.add_parser("close", help="close the active task")
    close.add_argument("--next", required=True, help="the single next action")
    verify = commands.add_parser("verify", help="plan proportional verification")
    verify.add_argument("--run", action="store_true", help="run planned CHEAP/MODERATE commands")
    commands.add_parser("handoff", help="print a concise Markdown handoff")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    try:
        args = build_parser().parse_args(argv)
        root = repository_root()
        store = StateStore(state_path(root))
        handlers = {"status": cmd_status, "plan": cmd_plan, "verify": cmd_verify, "handoff": cmd_handoff}
        return handlers[args.command](args, root, store)
    except (Sk7Error, subprocess.CalledProcessError) as exc:
        print(f"sk7ctl: error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
