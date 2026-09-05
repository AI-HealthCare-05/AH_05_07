"""Assemble an explicitly selected local review package and verify its bytes."""

import argparse
import hashlib
import json
import shutil
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

BASE = "d3d1a1a2903c558778eef7be0f249057e40ee769"
NS = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}


def digest(file):
    with file.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def verify(folder):
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    expected = {row["file"] for row in manifest["files"]}
    actual = {
        str(p.relative_to(folder)).replace("\\", "/")
        for p in folder.rglob("*")
        if p.is_file() and p.name != "manifest.json"
    }
    assert actual == expected, "Unexpected or missing package file"
    for row in manifest["files"]:
        file = (folder / row["file"]).resolve()
        assert file.is_relative_to(folder.resolve()), "Path outside package"
        assert file.stat().st_size == row["bytes"]
        assert digest(file) == row["sha256"]
    print(f"PASS: {len(expected)} package files match size and SHA-256")


def inspect_deck(args):
    from pypdf import PdfReader

    pdf = PdfReader(args.pdf)
    assert len(pdf.pages) == 7
    with zipfile.ZipFile(args.pptx) as archive:
        slides = [archive.read(f"ppt/slides/slide{i}.xml") for i in range(1, 8)]
        notes = []
        for i in range(1, 8):
            node = ET.fromstring(archive.read(f"ppt/notesSlides/notesSlide{i}.xml"))
            notes.append("\n".join(t.text or "" for t in node.findall(".//a:t", NS)))
        points = json.loads((args.repo / "docs/evidence/model-uncertainty.json").read_text(encoding="utf-8"))["groups"][
            "overall"
        ]["metrics"]
        table_text = slides[3].decode()
        for metric in points.values():
            for point in metric["point"].values():
                assert f"{point['value']:.4f}" in table_text
            for bound in metric["interval"]["difference"]:
                assert f"{bound:.4f}" in table_text
        assert all("제출 검토본" in x.decode() for x in slides)
        assert all(BASE in note and "https://github.com/" in note for note in notes)
    return notes


def assemble(args):
    assert all([args.repo, args.pptx, args.pdf, args.playback, args.recording])
    assert not (args.folder / "manifest.json").exists(), "Preserve existing package"
    assert (args.folder / "sk7-mvp1-review.mp4").is_file()
    notes = inspect_deck(args)
    playback = json.loads(args.playback.read_text(encoding="utf-8"))
    recording = json.loads(args.recording.read_text(encoding="utf-8"))
    assert playback["ended"] and playback["error"] is None
    assert 180 <= playback["duration"] <= 300 and playback["rate"] == 1
    assert recording["writes"] == 0 and recording["external_requests"] == 0
    for source, name in [(args.pptx, "sk7-mvp1-review.pptx"), (args.pdf, "sk7-mvp1-review.pdf")]:
        target = args.folder / name
        assert not target.exists()
        shutil.copyfile(source, target)
    sources = "# SK7 제출 검토본: 슬라이드별 근거와 발표자 노트\n\n"
    for i, note in enumerate(notes, 1):
        sources += f"## {i}장\n\n{note}\n\n"
    (args.folder / "sk7-mvp1-sources.md").write_text(sources, encoding="utf-8")
    for relative in [
        "docs/diagrams/mvp1-architecture.svg",
        "docs/diagrams/mvp1-erd.svg",
        *[f"docs/evidence/mvp1/{s}-1366.png" for s in ["normal", "empty", "error", "not-ready"]],
        *[
            f"tools/{name}"
            for name in [
                "submission-slides.mjs",
                "submission-record.cjs",
                "submission-render.ps1",
                "submission-video-check.cjs",
                "submission-package.py",
            ]
        ],
        "docs/mvp1-submission-package.md",
    ]:
        source = args.repo / relative
        category = "sources" if relative.startswith("tools/") else "references"
        target = args.folder / category / source.name
        target.parent.mkdir(exist_ok=True)
        assert not target.exists()
        shutil.copyfile(source, target)
    checks = {
        "status": "review_copy_not_final_delivery",
        "pptx": "7 slides; editable text and 3 native tables; source notes; PowerPoint render inspected",
        "pdf": "7 pages; Poppler render inspected; Malgun Gothic font resources; no visible replacement",
        "metrics": "rounded table points and difference intervals match approved aggregate JSON",
        "video": playback,
        "browser": {key: recording[key] for key in ["synthetic_only", "writes", "external_requests", "mock_get_count"]},
        "limits": "Local synthetic review only; not production verification or acceptance. Silent captioned video.",
    }
    (args.folder / "validation.json").write_text(
        json.dumps(checks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    files = []
    for file in sorted(args.folder.rglob("*")):
        if file.is_file():
            files.append(
                {
                    "file": file.relative_to(args.folder).as_posix(),
                    "format": file.suffix.removeprefix("."),
                    "bytes": file.stat().st_size,
                    "sha256": digest(file),
                    "production_basis_commit": BASE,
                    "validation": "See validation.json; hashes recomputed from this file",
                }
            )
    manifest = {
        "schema_version": 1,
        "status": "submission_review_in_progress",
        "production_basis_commit": BASE,
        "files": files,
    }
    (args.folder / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    verify(args.folder)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("folder", type=Path)
    parser.add_argument("--verify", action="store_true")
    parser.add_argument("--repo", type=Path)
    parser.add_argument("--pptx", type=Path)
    parser.add_argument("--pdf", type=Path)
    parser.add_argument("--playback", type=Path)
    parser.add_argument("--recording", type=Path)
    args = parser.parse_args()
    if args.verify:
        verify(args.folder)
    else:
        assemble(args)


if __name__ == "__main__":
    main()
