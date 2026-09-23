#!/usr/bin/env python3
"""Offline, pinned-Git-tree repository evidence audit (standard library only)."""

from __future__ import annotations

import argparse
import hashlib
import json
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
HEX_RE = re.compile(r"(?<![0-9a-f])([0-9a-f]{7,40})(?![0-9a-f])", re.I)
GH_RE = re.compile(r"https?://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/(?:pull|issues)/\d+(?:[^\s)]*)?", re.I)
MD_LINK_RE = re.compile(r'!?(?:\[[^\]]*\])\((?:<([^>]+)>|([^\s)]+))(?:\s+["\'][^"\']*["\'])?\)')
PATH_RE = re.compile(
    r"(?<![A-Za-z0-9_./-])((?:docs|scripts|tests|web|infra|ops|supabase|tools|\.github)(?:/[A-Za-z0-9_.@+-]+)+)"
)
TAG_RE = re.compile(r"(?<![A-Za-z0-9])((?:v\d+|release[-_/][A-Za-z0-9_.-]+))(?![A-Za-z0-9])", re.I)


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
        if not row["text_candidate"] or row["size_bytes"] is None or row["size_bytes"] > MAX_TEXT_BYTES:
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
            target = match.group(1).rstrip(".,;:)")
            kind = (
                "evidence_path"
                if target.startswith("docs/evidence/")
                else ("workflow" if target.startswith(".github/workflows/") else "repo_path")
            )
            collect(kind, target, match.start(), match.group(0))
        for match in TAG_RE.finditer(text):
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
                status, reason = "broken", "commit does not resolve in local repository"
        elif item["type"] in {"repo_path", "evidence_path", "workflow"}:
            resolved = target.lstrip("./")
            status = "resolved" if resolved in paths else "broken"
            reason = (
                "tracked path exists at audited SHA"
                if status == "resolved"
                else "tracked path is absent at audited SHA"
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
                resolved = str((Path(item["source_path"]).parent / base).as_posix())
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
    subsets = {
        "repository-files": rows,
        "evidence-files": [r for r in rows if r["path"].startswith(("docs/evidence/", "docs/research/", "docs/adr/"))],
        "policy-files": [
            r
            for r in rows
            if r["path"] == "AGENTS.md"
            or r["path"].startswith(".github/")
            or ("contract" in r["path"] and r["path"].startswith("docs/"))
            or r["path"] in ("docs/README.md", "docs/project-handoff.md")
        ],
    }
    result = {}
    for name, files in subsets.items():
        result[f"inventories/{name}.json"] = encode(dict(schema_version=1, source_sha=ref, files=files))
        lines = [
            f"# {name}",
            "",
            f"Snapshot: `{ref}`. {len(files)} tracked entries.",
            "",
            "Metadata only; binary contents are not read. Policy/evidence subsets are discovery filters, not authority assignments.",
            "",
            "| Path | Bytes | Git object |",
            "| --- | ---: | --- |",
        ]
        lines.extend(f"| `{r['path']}` | {r['size_bytes']} | `{r['blob_sha']}` |" for r in files)
        result[f"inventories/{name}.md"] = "\n".join(lines) + "\n"
    result["inventories/summary.json"] = encode(
        dict(
            schema_version=1,
            source_sha=ref,
            total=len(rows),
            roots=dict(sorted(Counter(r["path"].split("/")[0] for r in rows).items())),
            scoped=sum(r["audit_scope"] for r in rows),
        )
    )
    refs = extract_references(root, ref, rows)
    validations = validate_references(root, ref, rows, refs)
    result["references.json"] = encode(dict(schema_version=1, source_sha=ref, references=refs))
    result["validation.json"] = encode(
        dict(
            schema_version=1,
            source_sha=ref,
            references=validations,
            counts=dict(sorted(Counter(x["status"] for x in validations).items())),
        )
    )
    result["references.md"] = render_references(ref, refs)
    result["validation.md"] = render_validation(ref, validations)
    return result


def render_references(ref: str, refs: list[dict]) -> str:
    lines = [
        "# Extracted repository references",
        "",
        f"A deterministic scan of text candidates at `{ref}`. Extraction is descriptive; validation is separate.",
        "",
        "| ID | Source | Line | Type | Target |",
        "| --- | --- | ---: | --- | --- |",
    ]
    lines.extend(
        f"| `{r['id']}` | `{r['source_path']}` | {r['line']} | `{r['type']}` | `{r['target'].replace('|', '\\|')}` |"
        for r in refs
    )
    lines.append("")
    return "\n".join(lines)


def render_validation(ref: str, rows: list[dict]) -> str:
    counts = Counter(r["status"] for r in rows)
    lines = [
        "# Repository reference validation",
        "",
        f"Source snapshot: `{ref}`. Offline validation does not claim remote URL, PR, issue or tag existence.",
        "",
        "Counts: " + ", ".join(f"`{k}`={counts[k]}" for k in sorted(counts)),
        "",
        "| Status | Source | Line | Type | Target | Reason |",
        "| --- | --- | ---: | --- | --- | --- |",
    ]
    lines.extend(
        f"| `{r['status']}` | `{r['source_path']}` | {r['line']} | `{r['type']}` | `{r['target'].replace('|', '\\|')}` | {r['reason']} |"
        for r in rows
    )
    lines.append("")
    return "\n".join(lines)


def preflight_write(root: Path, expected_head: str | None, outputs: dict[str, str]) -> None:  # noqa: C901
    if expected_head is None or git(root, "rev-parse", "HEAD") != expected_head:
        raise ValueError("--write requires --expect-head equal to the reviewed full HEAD SHA")
    state = json.loads((root / ATLAS / "STATE.json").read_text())
    branch = git(root, "branch", "--show-current")
    if not branch or branch != state["branch"]:
        raise ValueError("write requires the attached task branch recorded in STATE")
    git(root, "merge-base", "--is-ancestor", state["base_sha"], "HEAD")
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
    if not isinstance(json.loads((root / ATLAS / "SOURCES.json").read_text())["records"], list):
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
