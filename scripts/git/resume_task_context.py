#!/usr/bin/env python3
"""Read live GitHub state and identify explicit SK7 resume candidates."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from typing import Any

DEFAULT_REPO = "AI-HealthCare-05/AH_05_07"
STATUSES = {"READY", "ACTIVE", "BLOCKED", "REVIEW", "DONE"}
PRIORITIES = {"P0", "P1", "P2", "P3"}
PRIORITY_RANK = {value: index for index, value in enumerate(("P0", "P1", "P2", "P3"))}
FIELD_NAMES = {
    "status": "status",
    "priority": "priority",
    "workstream": "workstream",
    "blocked by": "blocked_by",
    "next action": "next_action",
}


@dataclass(frozen=True)
class ResumeMetadata:
    status: str
    priority: str
    workstream: str
    blocked_by: tuple[int, ...]
    next_action: str


def _strip_value(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value.startswith("`") and value.endswith("`"):
        return value[1:-1].strip()
    return value


def parse_resume_metadata(body: str) -> ResumeMetadata | None:
    """Parse one visible `## Agent resume` section from an Issue body."""
    lines = body.splitlines()
    start = next((i for i, line in enumerate(lines) if re.fullmatch(r"\s*##\s+Agent resume\s*", line, re.I)), None)
    if start is None:
        return None

    fields: dict[str, str] = {}
    for line in lines[start + 1 :]:
        if re.match(r"^\s*##\s+", line):
            break
        match = re.match(r"^\s*[-*]\s*([^:]+):\s*(.*?)\s*$", line)
        if not match:
            continue
        key = FIELD_NAMES.get(match.group(1).strip().lower())
        if key:
            fields[key] = _strip_value(match.group(2))

    required = {"status", "priority", "workstream", "next_action"}
    if not required.issubset(fields):
        return None

    status = fields["status"].upper()
    priority = fields["priority"].upper()
    if status not in STATUSES or priority not in PRIORITIES:
        return None

    blocker_text = fields.get("blocked_by", "none")
    blockers = (
        ()
        if blocker_text.lower() in {"", "none", "n/a", "-"}
        else tuple(dict.fromkeys(int(value) for value in re.findall(r"#(\d+)", blocker_text)))
    )
    return ResumeMetadata(
        status=status,
        priority=priority,
        workstream=fields["workstream"],
        blocked_by=blockers,
        next_action=fields["next_action"],
    )


def classify_issues(issues: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    open_numbers = {int(issue["number"]) for issue in issues}
    classified: list[dict[str, Any]] = []
    unclassified: list[dict[str, Any]] = []
    for issue in issues:
        metadata = parse_resume_metadata(issue.get("body") or "")
        if metadata is None:
            unclassified.append(issue)
            continue
        open_blockers = [number for number in metadata.blocked_by if number in open_numbers]
        classified.append(
            {
                "number": int(issue["number"]),
                "title": issue["title"],
                "url": issue.get("url"),
                "updated_at": issue.get("updatedAt"),
                "status": metadata.status,
                "priority": metadata.priority,
                "workstream": metadata.workstream,
                "blocked_by": list(metadata.blocked_by),
                "open_blockers": open_blockers,
                "next_action": metadata.next_action,
            }
        )
    return classified, unclassified


def choose_resume_target(open_prs: list[dict[str, Any]], classified: list[dict[str, Any]]) -> dict[str, Any]:
    if len(open_prs) == 1:
        return {"kind": "pull_request", "state": "selected", "item": open_prs[0], "reason": "single open PR"}
    if len(open_prs) > 1:
        return {
            "kind": "pull_request",
            "state": "ambiguous",
            "items": open_prs,
            "reason": "multiple open PRs; do not choose implicitly",
        }

    active = [item for item in classified if item["status"] == "ACTIVE" and not item["open_blockers"]]
    if len(active) == 1:
        return {"kind": "issue", "state": "selected", "item": active[0], "reason": "single unblocked ACTIVE issue"}
    if len(active) > 1:
        return {"kind": "issue", "state": "ambiguous", "items": active, "reason": "multiple unblocked ACTIVE issues"}

    ready = [item for item in classified if item["status"] == "READY" and not item["open_blockers"]]
    if not ready:
        return {"kind": "none", "state": "none", "reason": "no explicit unblocked ACTIVE or READY issue"}
    ready.sort(key=lambda item: (PRIORITY_RANK[item["priority"]], item["number"]))
    best_rank = PRIORITY_RANK[ready[0]["priority"]]
    best = [item for item in ready if PRIORITY_RANK[item["priority"]] == best_rank]
    if len(best) == 1:
        return {
            "kind": "issue",
            "state": "selected",
            "item": best[0],
            "reason": "highest-priority unblocked READY issue",
        }
    return {
        "kind": "issue",
        "state": "ambiguous",
        "items": best,
        "reason": "multiple unblocked READY issues share the highest priority",
    }


def run_json(command: list[str]) -> Any:
    return json.loads(subprocess.check_output(command, text=True))


def gh_snapshot(repo: str) -> dict[str, Any]:
    main_sha = subprocess.check_output(["gh", "api", f"repos/{repo}/commits/main", "--jq", ".sha"], text=True).strip()
    prs = run_json(
        [
            "gh",
            "pr",
            "list",
            "--repo",
            repo,
            "--state",
            "open",
            "--limit",
            "100",
            "--json",
            "number,title,headRefName,baseRefName,url,isDraft,updatedAt",
        ]
    )
    issues = run_json(
        [
            "gh",
            "issue",
            "list",
            "--repo",
            repo,
            "--state",
            "open",
            "--limit",
            "100",
            "--json",
            "number,title,body,url,updatedAt",
        ]
    )
    classified, unclassified = classify_issues(issues)
    return {
        "repo": repo,
        "main_sha": main_sha,
        "open_prs": prs,
        "classified_issues": classified,
        "unclassified_issues": [
            {"number": int(item["number"]), "title": item["title"], "url": item.get("url")} for item in unclassified
        ],
        "resume_target": choose_resume_target(prs, classified),
    }


def _issue_line(item: dict[str, Any]) -> str:
    blockers = ", ".join(f"#{value}" for value in item["open_blockers"]) or "none"
    return (
        f"#{item['number']} [{item['status']}/{item['priority']}/{item['workstream']}] "
        f"{item['title']} (open blockers: {blockers})"
    )


def render_text(snapshot: dict[str, Any]) -> str:
    lines = [f"REPO: {snapshot['repo']}", f"CURRENT MAIN: {snapshot['main_sha']}", ""]
    prs = snapshot["open_prs"]
    lines.append(f"OPEN PRS: {len(prs)}")
    for pr in prs:
        draft = " draft" if pr.get("isDraft") else ""
        lines.append(f"  PR #{pr['number']}{draft}: {pr['title']} [{pr['headRefName']} -> {pr['baseRefName']}]")

    target = snapshot["resume_target"]
    lines.extend(["", f"RESUME TARGET: {target['state']} ({target['reason']})"])
    if target["state"] == "selected":
        item = target["item"]
        if target["kind"] == "pull_request":
            lines.append(f"  PR #{item['number']}: {item['title']}")
        else:
            lines.append("  " + _issue_line(item))
            lines.append(f"  Next action: {item['next_action']}")
    elif target["state"] == "ambiguous":
        for item in target["items"]:
            if target["kind"] == "pull_request":
                lines.append(f"  PR #{item['number']}: {item['title']}")
            else:
                lines.append("  " + _issue_line(item))

    active_or_ready = [
        item for item in snapshot["classified_issues"] if item["status"] in {"ACTIVE", "READY", "BLOCKED", "REVIEW"}
    ]
    lines.extend(["", f"CLASSIFIED ISSUES: {len(active_or_ready)}"])
    for item in sorted(active_or_ready, key=lambda value: (PRIORITY_RANK[value["priority"]], value["number"])):
        lines.append("  " + _issue_line(item))

    lines.extend(["", f"UNCLASSIFIED OPEN ISSUES: {len(snapshot['unclassified_issues'])}"])
    for item in snapshot["unclassified_issues"]:
        lines.append(f"  #{item['number']}: {item['title']}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=DEFAULT_REPO)
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    args = parser.parse_args()
    try:
        snapshot = gh_snapshot(args.repo)
    except (FileNotFoundError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        print(f"ERROR failed to read GitHub state: {exc}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(snapshot, ensure_ascii=False, indent=2))
    else:
        print(render_text(snapshot))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
