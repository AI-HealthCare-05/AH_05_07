from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "scripts" / "git" / "resume_task_context.py"
SPEC = importlib.util.spec_from_file_location("resume_task_context", MODULE_PATH)
assert SPEC and SPEC.loader
resume = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = resume
SPEC.loader.exec_module(resume)


def issue(number: int, body: str, title: str | None = None) -> dict:
    return {
        "number": number,
        "title": title or f"Issue {number}",
        "body": body,
        "url": f"https://example.invalid/issues/{number}",
        "updatedAt": "2026-09-24T00:00:00Z",
    }


def metadata(status: str = "READY", priority: str = "P1", blocked_by: str = "none") -> str:
    return f"""# Task

## Agent resume
- Status: `{status}`
- Priority: `{priority}`
- Workstream: `Transcend`
- Blocked by: {blocked_by}
- Next action: Do the bounded next step.
"""


def test_parse_resume_metadata() -> None:
    parsed = resume.parse_resume_metadata(metadata(blocked_by="#12, #13"))
    assert parsed is not None
    assert parsed.status == "READY"
    assert parsed.priority == "P1"
    assert parsed.workstream == "Transcend"
    assert parsed.blocked_by == (12, 13)
    assert parsed.next_action == "Do the bounded next step."


def test_unclassified_issue_is_not_promoted() -> None:
    classified, unclassified = resume.classify_issues([issue(1, "# Old issue\n")])
    assert classified == []
    assert [item["number"] for item in unclassified] == [1]
    target = resume.choose_resume_target([], classified)
    assert target["state"] == "none"


def test_single_open_pr_wins_over_issues() -> None:
    classified, _ = resume.classify_issues([issue(2, metadata(status="ACTIVE", priority="P0"))])
    pr = {"number": 10, "title": "Work", "headRefName": "x", "baseRefName": "main"}
    target = resume.choose_resume_target([pr], classified)
    assert target["kind"] == "pull_request"
    assert target["state"] == "selected"
    assert target["item"]["number"] == 10


def test_multiple_open_prs_are_ambiguous() -> None:
    prs = [{"number": 10, "title": "A"}, {"number": 11, "title": "B"}]
    target = resume.choose_resume_target(prs, [])
    assert target["state"] == "ambiguous"


def test_single_active_issue_wins() -> None:
    classified, _ = resume.classify_issues(
        [issue(2, metadata(status="ACTIVE", priority="P2")), issue(3, metadata(status="READY", priority="P0"))]
    )
    target = resume.choose_resume_target([], classified)
    assert target["state"] == "selected"
    assert target["item"]["number"] == 2


def test_ready_selection_uses_priority() -> None:
    classified, _ = resume.classify_issues(
        [issue(2, metadata(priority="P2")), issue(3, metadata(priority="P0")), issue(4, metadata(priority="P1"))]
    )
    target = resume.choose_resume_target([], classified)
    assert target["state"] == "selected"
    assert target["item"]["number"] == 3


def test_equal_top_priority_is_ambiguous() -> None:
    classified, _ = resume.classify_issues([issue(2, metadata(priority="P0")), issue(3, metadata(priority="P0"))])
    target = resume.choose_resume_target([], classified)
    assert target["state"] == "ambiguous"
    assert {item["number"] for item in target["items"]} == {2, 3}


def test_open_blocker_prevents_ready_selection() -> None:
    classified, _ = resume.classify_issues(
        [issue(2, metadata(priority="P0", blocked_by="#9")), issue(9, metadata(status="ACTIVE", priority="P1"))]
    )
    blocked = next(item for item in classified if item["number"] == 2)
    assert blocked["open_blockers"] == [9]
    target = resume.choose_resume_target([], classified)
    assert target["item"]["number"] == 9


def test_closed_blocker_is_treated_as_satisfied() -> None:
    classified, _ = resume.classify_issues([issue(2, metadata(priority="P0", blocked_by="#99"))])
    assert classified[0]["open_blockers"] == []
    target = resume.choose_resume_target([], classified)
    assert target["state"] == "selected"
    assert target["item"]["number"] == 2


def test_invalid_metadata_does_not_become_authority() -> None:
    bad = metadata(status="MAYBE", priority="P0")
    classified, unclassified = resume.classify_issues([issue(1, bad)])
    assert classified == []
    assert len(unclassified) == 1
