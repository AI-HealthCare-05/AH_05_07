"""Evidence inputs retain Git blob bytes even with automatic CRLF checkout."""

import hashlib
import subprocess

from scripts.data.contract import ROOT

INPUTS = ("data/manifest/nhanes_2017_2020.json", "uv.lock")


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True).stdout


def test_evidence_inputs_match_git_blobs_with_autocrlf(tmp_path):
    source = tmp_path / "source"
    source.mkdir()
    git(source, "init")
    git(source, "config", "core.autocrlf", "false")
    git(source, "config", "core.attributesFile", "")
    for relative in INPUTS:
        path = source / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(git(ROOT, "show", f"HEAD:{relative}"))
    (source / ".gitattributes").write_bytes((ROOT / ".gitattributes").read_bytes())
    # This unprotected file proves that the checkout actually performs CRLF conversion.
    (source / "control.txt").write_bytes(b"first\nsecond\n")
    git(source, "add", ".")
    git(
        source,
        "-c",
        "user.name=Synthetic Test",
        "-c",
        "user.email=synthetic@example.invalid",
        "commit",
        "-m",
        "fixture",
    )

    checkout = tmp_path / "fresh checkout"
    git(tmp_path, "clone", "--no-checkout", str(source), str(checkout))
    git(checkout, "config", "core.autocrlf", "true")
    git(checkout, "config", "core.attributesFile", "")
    git(checkout, "checkout", "HEAD")
    assert (checkout / "control.txt").read_bytes() == b"first\r\nsecond\r\n"
    for relative in INPUTS:
        blob = git(checkout, "show", f"HEAD:{relative}")
        actual = (checkout / relative).read_bytes()
        assert b"\r\n" not in actual
        assert actual == blob
        assert hashlib.sha256(actual).digest() == hashlib.sha256(blob).digest()
    assert not git(checkout, "status", "--porcelain")
