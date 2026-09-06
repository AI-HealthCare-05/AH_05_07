"""Fetch one pinned official package into a new external directory; no install scripts."""

import argparse
import base64
import hashlib
import io
import json
import tarfile
import urllib.request
from pathlib import Path

VERSION = "0.185.1"
URL = f"https://registry.npmjs.org/three/-/three-{VERSION}.tgz"
INTEGRITY = "5aojFCXKwnjBRZvUnt3WFfEcvUJgkN5LlijRFN95hMy8WVkG4I0QNcJE+OuWvuJ0bOdStrbfXn0pkd6/QyiAlg=="
ROOT = Path(__file__).resolve().parents[2]


def prepare(output):
    output = output.resolve()
    if output.exists() or output == ROOT or ROOT in output.parents:
        raise ValueError("Choose a new directory outside the repository")
    with urllib.request.urlopen(URL, timeout=60) as response:
        archive = response.read(30_000_001)
    if len(archive) > 30_000_000 or base64.b64encode(hashlib.sha512(archive).digest()).decode() != INTEGRITY:
        raise ValueError("Official package integrity mismatch")
    staged = output.with_name(output.name + ".partial")
    staged.mkdir(parents=True, exist_ok=False)
    files = []
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as package:
        for member in package.getmembers():
            relative = Path(member.name).relative_to("package")
            if not member.isfile() or ".." in relative.parts:
                continue
            if not (
                str(relative).replace("\\", "/").startswith(("build/", "examples/jsm/"))
                or str(relative) in ("LICENSE", "package.json")
            ):
                continue
            content = package.extractfile(member).read()
            destination = staged / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(content)
            files.append(
                {"path": relative.as_posix(), "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}
            )
    (staged / "vendor-manifest.json").write_text(
        json.dumps({"version": VERSION, "source": URL, "integrity": "sha512-" + INTEGRITY, "files": files}, indent=2),
        encoding="utf-8",
    )
    staged.rename(output)
    print(f"Pinned Three.js {VERSION} verified; {len(files)} local files")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    prepare(args.output)
