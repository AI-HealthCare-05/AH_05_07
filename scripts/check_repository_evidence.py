#!/usr/bin/env python3
"""Offline, pinned-Git-tree repository evidence audit (standard library only)."""

from __future__ import annotations

import argparse
import hashlib
import json
import posixpath
import re
import subprocess
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlparse

ATLAS = Path("docs/evidence/repository-atlas")
OWNED = (str(ATLAS) + "/", "scripts/check_repository_evidence.py", "tests/test_repository_evidence.py")
SCOPE = ("docs/", ".github/", "scripts/", "tools/", "tests/", "web/e2e/", "infra/", "ops/", "supabase/")
TEXT_SUFFIXES = {".md", ".mdx", ".rst", ".txt", ".json", ".yaml", ".yml"}
MAX_TEXT_BYTES = 2_000_000
REFERENCE_EXCLUDED_BASENAMES = {"package-lock.json", "pnpm-lock.yaml", "yarn.lock"}
REF_TYPES = {
    "commit_sha",
    "github_url",
    "issue",
    "pull_request",
    "repo_path",
    "markdown_link",
    "workflow",
    "release_tag",
    "evidence_path",
}
HEX_RE = re.compile(r"(?<![A-Za-z0-9])([0-9a-f]{7,40})(?![A-Za-z0-9])", re.I)
GH_RE = re.compile(
    r"https?://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/"
    r"(?:pull/\d+|issues/\d+|commit/[0-9a-f]{7,40}|releases/tag/[A-Za-z0-9_.-]+)(?:[^\s)]*)?",
    re.I,
)
MD_LINK_RE = re.compile(r'!?(?:\[[^\]]*\])\((?:<([^>]+)>|([^\s)]+))(?:\s+["\'][^"\']*["\'])?\)')
PATH_RE = re.compile(
    r"(?<![A-Za-z0-9_./@-])((?:docs|scripts|tests|web|infra|ops|supabase|tools|\.github)(?:/[A-Za-z0-9_.@+-]+)+)"
)
TAG_CONTEXT_RE = re.compile(
    r"(?i)\b(?:release\s+tag|git\s+tag)\s*(?::\s*|=\s*|is\s+)`?([A-Za-z0-9][A-Za-z0-9_.-]{1,80})`?"
)


def git(root: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(root), *args], text=True, stderr=subprocess.PIPE).strip()


def encode(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def in_scope(path: str) -> bool:
    return path.startswith(SCOPE) or path == "AGENTS.md" or path.startswith("README")


def inventory(root: Path, ref: str) -> list[dict]:
    rows = []
    for entry in git(root, "ls-tree", "-rlz", "--full-tree", ref).split("\0"):
        if not entry:
            continue
        metadata, path = entry.split("\t", 1)
        mode, kind, oid, size = metadata.split()
        rows.append(
            dict(
                path=path,
                mode=mode,
                object_type=kind,
                blob_sha=oid,
                size_bytes=None if size == "-" else int(size),
                audit_scope=in_scope(path),
                text_candidate=Path(path).suffix.lower() in TEXT_SUFFIXES,
            )
        )
    return sorted(rows, key=lambda row: row["path"])


def read_blob(root: Path, ref: str, path: str) -> str | None:
    try:
        raw = subprocess.check_output(["git", "-C", str(root), "show", f"{ref}:{path}"], stderr=subprocess.PIPE)
    except subprocess.CalledProcessError:
        return None
    if b"\0" in raw or len(raw) > MAX_TEXT_BYTES:
        return None
    return raw.decode("utf-8", errors="replace")


def line_for(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def ref_id(source_path: str, line: int, kind: str, target: str) -> str:
    value = f"{source_path}:{line}:{kind}:{target}"
    return "REF-" + hashlib.sha1(value.encode(), usedforsecurity=False).hexdigest()[:12]


def add_ref(rows: list[dict], source_path: str, text: str, kind: str, target: str, line: int, raw: str) -> None:
    if kind not in REF_TYPES or not target:
        return
    rows.append(
        dict(
            id=ref_id(source_path, line, kind, target),
            source_path=source_path,
            line=line,
            type=kind,
            target=target,
            raw=raw[:240],
        )
    )


def extract_references(root: Path, ref: str, rows: list[dict]) -> list[dict]:  # noqa: C901
    refs: list[dict] = []
    for row in rows:
        if (
            not row["text_candidate"]
            or row["size_bytes"] is None
            or row["size_bytes"] > MAX_TEXT_BYTES
            or Path(row["path"]).name in REFERENCE_EXCLUDED_BASENAMES
        ):
            continue
        text = read_blob(root, ref, row["path"])
        if text is None:
            continue
        source = row["path"]
        seen: set[tuple[str, str, int]] = set()

        def collect(
            kind: str,
            target: str,
            start: int,
            raw: str,
            *,
            source_path: str = source,
            source_text: str = text,
            seen_refs: set = seen,
        ) -> None:
            key = (kind, target, line_for(source_text, start))
            if key not in seen_refs:
                seen_refs.add(key)
                add_ref(refs, source_path, source_text, kind, target, key[2], raw)

        for match in GH_RE.finditer(text):
            url = match.group(0).rstrip(".,;")
            collect("github_url", url, match.start(), match.group(0))
            parsed = urlparse(url)
            bits = parsed.path.strip("/").split("/")
            if len(bits) >= 4 and bits[2].lower() in {"pull", "issues"}:
                collect(
                    "pull_request" if bits[2].lower() == "pull" else "issue",
                    f"{bits[0]}/{bits[1]}#{bits[3]}",
                    match.start(),
                    match.group(0),
                )
            elif len(bits) >= 4 and bits[2].lower() == "commit":
                collect("commit_sha", bits[3].lower(), match.start(), match.group(0))
            elif len(bits) >= 5 and bits[2].lower() == "releases" and bits[3].lower() == "tag":
                collect("release_tag", bits[4], match.start(), match.group(0))
        for match in MD_LINK_RE.finditer(text):
            target = unquote(match.group(1) or match.group(2)).strip()
            if target.startswith(("mailto:", "javascript:")):
                continue
            collect("markdown_link", target, match.start(), match.group(0))
            if target.startswith(".github/workflows/") or target.startswith("github/workflows/"):
                collect("workflow", target.lstrip("./"), match.start(), match.group(0))
        for match in HEX_RE.finditer(text):
            # Do not treat decimal-heavy dates or IDs as SHAs unless the token is hex-only.
            token = match.group(1)
            if any(c.isalpha() for c in token.lower()):
                collect("commit_sha", token.lower(), match.start(), match.group(0))
        for match in PATH_RE.finditer(text):
            if match.end() < len(text) and text[match.end()] in "${*?":
                continue
            target = match.group(1).rstrip(".,;:)")
            kind = (
                "evidence_path"
                if target.startswith("docs/evidence/")
                else ("workflow" if target.startswith(".github/workflows/") else "repo_path")
            )
            collect(kind, target, match.start(), match.group(0))
        for match in TAG_CONTEXT_RE.finditer(text):
            collect("release_tag", match.group(1), match.start(), match.group(0))
        for match in re.finditer(r"(?i)\b(?:PR|pull request)\s*#?(\d+)\b", text):
            collect("pull_request", match.group(1), match.start(), match.group(0))
        for match in re.finditer(r"(?i)\bissue\s*#?(\d+)\b", text):
            collect("issue", match.group(1), match.start(), match.group(0))
    return sorted(refs, key=lambda x: (x["source_path"], x["line"], x["type"], x["target"], x["id"]))


def heading_anchors(text: str) -> set[str]:
    anchors = set()
    for line in text.splitlines():
        match = re.match(r"^#{1,6}\s+(.+?)\s*#*$", line)
        if match:
            slug = re.sub(r"[^\w\- ]", "", match.group(1).lower()).strip().replace(" ", "-")
            anchors.add(slug)
    return anchors


def normalize_repo_path(target: str) -> str:
    return target[2:] if target.startswith("./") else target


def tracked_directory(paths: set[str], target: str) -> bool:
    prefix = target.rstrip("/") + "/"
    return any(path.startswith(prefix) for path in paths)


def unique_tracked_suffix(paths: set[str], target: str) -> str | None:
    normalized = normalize_repo_path(target).lstrip("/")
    suffix = "/" + normalized
    matches = sorted(path for path in paths if path.endswith(suffix))
    return matches[0] if len(matches) == 1 else None


def graph_node_id(prefix: str, value: str) -> str:
    digest = hashlib.sha1(value.encode(), usedforsecurity=False).hexdigest()[:12]
    return f"{prefix}-{digest}"


def validate_references(root: Path, ref: str, inventory_rows: list[dict], refs: list[dict]) -> list[dict]:  # noqa: C901
    paths = {row["path"] for row in inventory_rows}
    results = []
    for item in refs:
        status, reason, resolved = "unverified", "remote reference requires network or human review", None
        target = item["target"]
        if item["type"] == "commit_sha":
            try:
                git(root, "cat-file", "-e", f"{target}^{{commit}}")
                status, reason = "resolved", "commit resolves in local repository"
            except subprocess.CalledProcessError:
                status, reason = (
                    "unverified",
                    "hex token does not resolve as a local commit; it may be historical, external, or a non-commit hash",
                )
        elif item["type"] in {"repo_path", "evidence_path", "workflow"}:
            resolved = normalize_repo_path(target)
            if resolved in paths:
                status, reason = "resolved", "tracked path exists at audited SHA"
            elif tracked_directory(paths, resolved):
                status, reason = "resolved", "tracked directory exists at audited SHA"
            elif suffix_match := unique_tracked_suffix(paths, resolved):
                resolved = suffix_match
                status, reason = "resolved", "unique tracked suffix resolves the context-relative path"
            else:
                status, reason = (
                    "unverified",
                    "path-like token is not tracked at audited SHA; it may be generated, runtime-only, symbolic, or stale",
                )
        elif item["type"] == "markdown_link":
            if target.startswith(("#", "/")):
                base, fragment = item["source_path"], target[1:] if target.startswith("#") else ""
                resolved = base if target.startswith("#") else target.lstrip("/")
            elif "://" in target:
                status, reason = "unverified", "external link is intentionally not fetched offline"
                results.append({**item, "status": status, "reason": reason, "resolved_path": None})
                continue
            else:
                base, fragment = (target.split("#", 1) + [""])[:2] if "#" in target else (target, "")
                resolved = posixpath.normpath(posixpath.join(posixpath.dirname(item["source_path"]), base))
            if resolved in paths:
                if fragment and resolved.lower().endswith((".md", ".mdx")):
                    source = read_blob(root, ref, resolved) or ""
                    status = "resolved" if fragment.lower() in heading_anchors(source) else "broken"
                    reason = (
                        "path and heading anchor resolve"
                        if status == "resolved"
                        else "path exists but heading anchor is absent"
                    )
                else:
                    status, reason = "resolved", "local link target exists"
            elif tracked_directory(paths, resolved):
                status, reason = "resolved", "local directory link target exists"
            elif resolved == item["source_path"] and target.startswith("#"):
                source = read_blob(root, ref, resolved) or ""
                status = "resolved" if target[1:].lower() in heading_anchors(source) else "broken"
                reason = "self heading anchor resolves" if status == "resolved" else "self heading anchor is absent"
            else:
                status, reason = "broken", "local Markdown target is absent"
        elif item["type"] == "github_url":
            status, reason = "unverified", "GitHub URL retained as remote evidence; no network assertion"
        elif item["type"] in {"issue", "pull_request", "release_tag"}:
            status, reason = "unverified", "remote or symbolic reference requires human/network verification"
        results.append({**item, "status": status, "reason": reason, "resolved_path": resolved})
    return sorted(results, key=lambda x: (x["status"], x["source_path"], x["line"], x["id"]))


def inventory_outputs(root: Path, ref: str) -> dict[str, str]:
    rows = inventory(root, ref)
    evidence_rows = [r for r in rows if r["path"].startswith(("docs/evidence/", "docs/research/", "docs/adr/"))]
    policy_rows = [
        r
        for r in rows
        if r["path"] == "AGENTS.md"
        or r["path"].startswith(".github/")
        or ("contract" in r["path"] and r["path"].startswith("docs/"))
        or r["path"] in ("docs/README.md", "docs/project-handoff.md")
    ]
    result = {
        "inventories/summary.json": encode(
            dict(
                schema_version=1,
                source_sha=ref,
                total=len(rows),
                roots=dict(sorted(Counter(r["path"].split("/")[0] for r in rows).items())),
                scoped=sum(r["audit_scope"] for r in rows),
                evidence_candidates=len(evidence_rows),
                policy_candidates=len(policy_rows),
            )
        )
    }
    refs = extract_references(root, ref, rows)
    validations = validate_references(root, ref, rows, refs)
    type_counts = dict(sorted(Counter(x["type"] for x in refs).items()))
    status_counts = dict(sorted(Counter(x["status"] for x in validations).items()))
    unverified_type_counts = dict(
        sorted(Counter(x["type"] for x in validations if x["status"] == "unverified").items())
    )
    reason_counts = dict(sorted(Counter(x["reason"] for x in validations).items()))
    result["reference-summary.json"] = encode(
        dict(
            schema_version=1,
            source_sha=ref,
            total=len(refs),
            by_type=type_counts,
            by_status=status_counts,
            unverified_by_type=unverified_type_counts,
            by_reason=reason_counts,
        )
    )
    result.update(normalized_outputs(root, ref, rows, validations))
    return result


def source_records(root: Path, ref: str) -> list[dict]:
    source_doc = json.loads((root / ATLAS / "SOURCES.json").read_text())
    if source_doc.get("audited_sha") != ref:
        raise ValueError("SOURCES.json audited_sha does not match the generated source snapshot")
    records = source_doc.get("records")
    if not isinstance(records, list):
        raise ValueError("SOURCES.json records must be a list")
    required = {
        "id",
        "title",
        "category",
        "status",
        "source_type",
        "source_path",
        "source_sha",
        "authority",
        "protects",
        "summary",
        "verification",
    }
    for record in records:
        missing = required - set(record)
        if missing:
            raise ValueError(f"evidence record {record.get('id')} missing: {', '.join(sorted(missing))}")
        if record["source_sha"] != ref:
            raise ValueError(f"evidence record {record['id']} is not pinned to the audited SHA")
    return sorted(records, key=lambda record: record["id"])


def validate_sources(records: list[dict], inventory_rows: list[dict]) -> list[dict]:
    paths = {row["path"] for row in inventory_rows}
    return [
        {
            "id": record["id"],
            "source_path": record["source_path"],
            "status": "resolved" if record["source_path"] in paths else "broken",
            "reason": "source path exists at audited SHA"
            if record["source_path"] in paths
            else "source path is absent at audited SHA",
        }
        for record in records
    ]


def report_link(source_path: str) -> str:
    return f"../../../../{source_path}"


def render_authority_map(records: list[dict], ref: str) -> str:
    lines = [
        "# Project authority map",
        "",
        f"Curated from source-grounded records pinned to `{ref}`.",
        "",
        "| Boundary | Current authority | Lifecycle | Protects |",
        "| --- | --- | --- | --- |",
    ]
    for record in records:
        if record["status"] == "current":
            lines.append(
                f"| `{record['category']}` | [{record['title']}]({report_link(record['source_path'])}) | `{record['status']}` | {', '.join(record['protects']) or '—'} |"
            )
    lines.extend(
        [
            "",
            "Historical, research and evidence records remain traceable in `evidence-index.json`; they do not establish live runtime state.",
            "",
        ]
    )
    return "\n".join(lines)


def render_atlas(records: list[dict], ref: str) -> str:
    lines = [
        "# Evidence atlas",
        "",
        f"Navigation view generated from curated records at `{ref}`.",
        "",
        "| Area | Current authority | Key evidence | Verification | Historical predecessor / scope |",
        "| --- | --- | --- | --- | --- |",
    ]
    for record in records:
        if record["status"] == "current":
            related = (
                record.get("supersedes") or "; ".join(record.get("notes", [])) or "No historical predecessor asserted."
            )
            lines.append(
                f"| **{record['category']}** | [{record['title']}]({report_link(record['source_path'])}) | {record['summary']} | {record['verification']} | {related} |"
            )
    lines.extend(["", "Status is a repository evidence lifecycle at the audited SHA. It is not deployment proof.", ""])
    return "\n".join(lines)


def render_gaps(gaps: list[dict], validation_counts: dict[str, int], ref: str) -> str:
    lines = [
        "# Evidence gaps",
        "",
        f"Offline gap analysis for `{ref}`.",
        "",
        "This report distinguishes confirmed local reference gaps from remote or symbolic references that were intentionally not fetched.",
        "",
        "| Class | Count | Severity / confidence |",
        "| --- | ---: | --- |",
        f"| Broken local reference | {validation_counts.get('broken', 0)} | review / high for path absence |",
        f"| Remote or symbolic reference not checked | {validation_counts.get('unverified', 0)} | review / medium; network or human verification required |",
        f"| Curated source record gap | {sum(g['kind'] == 'source_record' for g in gaps)} | review / high |",
        "",
        "Representative gaps (first 50 by stable ID):",
        "",
        "| ID | Kind | Source | Detail |",
        "| --- | --- | --- | --- |",
    ]
    for gap in sorted(gaps, key=lambda item: item["id"])[:50]:
        lines.append(
            f"| `{gap['id']}` | `{gap['kind']}` | `{gap.get('source_path', 'SOURCES.json')}` | {gap['reason']} |"
        )
    lines.append("")
    return "\n".join(lines)


def normalized_outputs(root: Path, ref: str, inventory_rows: list[dict], validations: list[dict]) -> dict[str, str]:  # noqa: C901
    records = source_records(root, ref)
    source_checks = validate_sources(records, inventory_rows)
    nodes = [
        {
            "id": r["id"],
            "node_type": "evidence_record",
            "title": r["title"],
            "category": r["category"],
            "status": r["status"],
            "source_path": r["source_path"],
        }
        for r in records
    ]
    source_nodes: dict[str, str] = {}
    boundary_nodes: dict[str, str] = {}
    for record in records:
        source_path = record["source_path"]
        source_nodes.setdefault(source_path, graph_node_id("SRC", source_path))
        for boundary in record["protects"]:
            boundary_nodes.setdefault(boundary, graph_node_id("BND", boundary))
    nodes.extend(
        {
            "id": node_id,
            "node_type": "source_document",
            "title": source_path,
            "source_path": source_path,
        }
        for source_path, node_id in sorted(source_nodes.items())
    )
    nodes.extend(
        {
            "id": node_id,
            "node_type": "protected_boundary",
            "title": boundary,
        }
        for boundary, node_id in sorted(boundary_nodes.items())
    )
    edges = []
    record_ids = {record["id"] for record in records}
    for record in records:
        edges.append({"from": record["id"], "to": source_nodes[record["source_path"]], "type": "grounded_in"})
        edges.extend(
            {"from": record["id"], "to": boundary_nodes[target], "type": "protects"} for target in record["protects"]
        )
        if record.get("supersedes"):
            target = record["supersedes"]
            if target not in record_ids:
                raise ValueError(f"evidence record {record['id']} supersedes unknown record id: {target}")
            edges.append({"from": record["id"], "to": target, "type": "supersedes"})
    node_ids = {node["id"] for node in nodes}
    if any(edge["from"] not in node_ids or edge["to"] not in node_ids for edge in edges):
        raise ValueError("authority graph contains an edge with an unknown endpoint")
    gaps = []
    for item in validations:
        if item["status"] == "broken":
            gaps.append(
                {
                    "id": "GAP-" + item["id"],
                    "kind": "broken_local_reference",
                    "severity": "low",
                    "confidence": "high",
                    "source_path": item["source_path"],
                    "line": item["line"],
                    "reason": item["reason"],
                    "reference_id": item["id"],
                    "recommended_follow_up": "Confirm whether the link is historical, intentionally stale, or should be repaired in its owning document.",
                }
            )
    for check in source_checks:
        if check["status"] == "broken":
            gaps.append(
                {
                    "id": "GAP-SOURCE-" + check["id"],
                    "kind": "source_record",
                    "severity": "medium",
                    "confidence": "high",
                    "source_path": check["source_path"],
                    "reason": check["reason"],
                    "recommended_follow_up": "Repair the curated record before treating it as evidence.",
                }
            )
    counts = dict(sorted(Counter(item["status"] for item in validations).items()))
    return {
        "evidence-index.json": encode({"schema_version": 1, "source_sha": ref, "records": records}),
        "authority-graph.json": encode(
            {
                "schema_version": 1,
                "source_sha": ref,
                "nodes": nodes,
                "edges": sorted(edges, key=lambda edge: (edge["from"], edge["type"], edge["to"])),
            }
        ),
        "source-validation.json": encode({"schema_version": 1, "source_sha": ref, "records": source_checks}),
        "gaps.json": encode(
            {"schema_version": 1, "source_sha": ref, "counts": counts, "gaps": sorted(gaps, key=lambda gap: gap["id"])}
        ),
        "reports/PROJECT_AUTHORITY_MAP.md": render_authority_map(records, ref),
        "reports/EVIDENCE_ATLAS.md": render_atlas(records, ref),
        "reports/EVIDENCE_GAPS.md": render_gaps(gaps, counts, ref),
    }


def preflight_write(root: Path, expected_head: str | None, outputs: dict[str, str]) -> None:  # noqa: C901
    if expected_head is None or git(root, "rev-parse", "HEAD") != expected_head:
        raise ValueError("--write requires --expect-head equal to the reviewed full HEAD SHA")
    branch = git(root, "branch", "--show-current")
    if not branch:
        raise ValueError("write requires an attached task branch")
    sources = json.loads((root / ATLAS / "SOURCES.json").read_text())
    audited_sha = sources.get("audited_sha")
    if not isinstance(audited_sha, str) or not audited_sha:
        raise ValueError("SOURCES.json must record audited_sha")
    git(root, "merge-base", "--is-ancestor", audited_sha, "HEAD")
    status_raw = subprocess.check_output(
        ["git", "-C", str(root), "status", "--porcelain=v1", "-z", "--untracked-files=all"], text=True
    )
    for entry in status_raw.split("\0"):
        if not entry:
            continue
        # Rename/copy records need two paths; reject instead of guessing ownership.
        if len(entry) < 4 or entry[:2].strip() in {"R", "C"} or "R" in entry[:2] or "C" in entry[:2]:
            raise ValueError("unexpected or renamed dirty path; review manually before generation")
        path = entry[3:]
        if not any(path == p or path.startswith(p) for p in OWNED):
            raise ValueError(f"unowned dirty path: {path}")
    for name in outputs:
        path = root / ATLAS / name
        if ".." in Path(name).parts or Path(name).is_absolute():
            raise ValueError("output escaped atlas")
        if any(p.is_symlink() for p in [path, *path.parents]):
            raise ValueError("symlink output is not allowed")
    if not isinstance(sources.get("records"), list):
        raise ValueError("invalid SOURCES.records")


def apply_outputs(root: Path, outputs: dict[str, str], write: bool, expected_head: str | None) -> list[str]:
    if write:
        # Validate every anchor/path before the first write. A failed preflight writes nothing.
        preflight_write(root, expected_head, outputs)
    changed = []
    for name, content in sorted(outputs.items()):
        path = root / ATLAS / name
        if not path.exists() or path.read_text() != content:
            changed.append(name)
            if write:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content)
    return changed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--check", action="store_true", help="read-only drift check (default)")
    parser.add_argument("--write", action="store_true", help="regenerate after complete write preflight")
    parser.add_argument("--expect-head", help="reviewed full HEAD SHA, required for --write")
    args = parser.parse_args()
    try:
        if args.check and args.write:
            raise ValueError("--check and --write are mutually exclusive")
        sources = json.loads((args.root / ATLAS / "SOURCES.json").read_text())
        ref = git(args.root, "rev-parse", "--verify", sources["audited_sha"] + "^{commit}")
        outputs = inventory_outputs(args.root, ref)
        changed = apply_outputs(args.root, outputs, args.write, args.expect_head)
        if changed and not args.write:
            print("ERROR generated output drift: " + ", ".join(changed))
            return 1
        print(f"PASS inventory at {ref}: {len(outputs)} artifacts; {len(changed)} changed")
        return 0
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError) as exc:
        print(f"ERROR {exc}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
