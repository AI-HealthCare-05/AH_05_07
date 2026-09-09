#!/usr/bin/env python3
"""Offline verification for repository-owned API release provenance manifests."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

REQUIRED_TOP_LEVEL_KEYS = (
    "schema",
    "release",
    "audit_issue",
    "source",
    "repository_inputs",
    "cloud_build",
    "api_image",
    "cloud_run",
    "model_v2",
    "verification",
    "limitations",
)

EXPECTED_SCHEMA = "ah-05-07.api-release-provenance.v1"

HEX40_RE = re.compile(r"^[0-9a-f]{40}$")
HEX64_RE = re.compile(r"^[0-9a-f]{64}$")
SHA256_DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-"
    r"[0-9a-f]{4}-[0-9a-f]{12}$"
)


class VerificationError(RuntimeError):
    """Raised when the manifest cannot be verified offline."""


def run_git(repo_root: Path, *args: str, text: bool = False) -> bytes | str:
    command = ["git", "-C", str(repo_root), *args]
    try:
        return subprocess.check_output(command, text=text)
    except subprocess.CalledProcessError as exc:
        raise VerificationError(f"git command failed: {' '.join(command)}") from exc


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_object_exists(repo_root: Path, object_name: str) -> bool:
    result = subprocess.run(
        ["git", "-C", str(repo_root), "cat-file", "-e", object_name],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return result.returncode == 0


def git_file_bytes(repo_root: Path, source: str, relpath: str) -> bytes:
    result = run_git(repo_root, "show", f"{source}:{relpath}")
    assert isinstance(result, bytes)
    return result


def verify_equal(
    label: str,
    actual: Any,
    expected: Any,
    failures: list[str],
) -> None:
    if actual == expected:
        print(f"PASS {label}")
        return

    print(f"FAIL {label}")
    print(f"  actual:   {actual}")
    print(f"  expected: {expected}")
    failures.append(label)


def verify_condition(
    label: str,
    condition: bool,
    failures: list[str],
    detail: str | None = None,
) -> None:
    if condition:
        print(f"PASS {label}")
        return

    print(f"FAIL {label}")
    if detail:
        print(f"  {detail}")
    failures.append(label)


def is_nonempty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def is_nonnegative_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def validate_manifest_schema(
    manifest: dict[str, Any],
    failures: list[str],
) -> None:
    print("--- MANIFEST SCHEMA ---")

    verify_equal(
        "schema value",
        manifest["schema"],
        EXPECTED_SCHEMA,
        failures,
    )

    verify_condition(
        "release",
        is_nonempty_string(manifest["release"]),
        failures,
    )
    verify_condition(
        "audit_issue",
        is_nonnegative_int(manifest["audit_issue"]) and manifest["audit_issue"] > 0,
        failures,
    )

    source = manifest["source"]
    verify_condition(
        "source.repository",
        is_nonempty_string(source["repository"]),
        failures,
    )
    verify_condition(
        "source.commit_sha format",
        isinstance(source["commit_sha"], str) and HEX40_RE.fullmatch(source["commit_sha"]) is not None,
        failures,
    )
    verify_condition(
        "source.tree_sha format",
        isinstance(source["tree_sha"], str) and HEX40_RE.fullmatch(source["tree_sha"]) is not None,
        failures,
    )

    repository_inputs = manifest["repository_inputs"]
    verify_condition(
        "repository_inputs mapping",
        isinstance(repository_inputs, dict),
        failures,
    )

    for relpath, entry in repository_inputs.items():
        if relpath == "application_copy_inputs":
            continue

        label = f"repository input schema: {relpath}"
        valid = isinstance(entry, dict)

        if valid and "state" in entry:
            valid = entry["state"] == "absent_at_source"
        elif valid and "sha256" in entry:
            valid = isinstance(entry["sha256"], str) and HEX64_RE.fullmatch(entry["sha256"]) is not None
        else:
            valid = False

        verify_condition(label, valid, failures)

    copy_inputs = repository_inputs["application_copy_inputs"]
    copy_paths = copy_inputs["paths"]

    verify_condition(
        "application_copy_inputs.paths",
        isinstance(copy_paths, list) and bool(copy_paths) and all(is_nonempty_string(item) for item in copy_paths),
        failures,
    )
    verify_condition(
        "application_copy_inputs.git_archive_sha256 format",
        isinstance(copy_inputs["git_archive_sha256"], str)
        and HEX64_RE.fullmatch(copy_inputs["git_archive_sha256"]) is not None,
        failures,
    )

    cloud_build = manifest["cloud_build"]

    verify_condition(
        "cloud_build.id format",
        isinstance(cloud_build["id"], str) and UUID_RE.fullmatch(cloud_build["id"]) is not None,
        failures,
    )
    verify_condition(
        "cloud_build.location",
        is_nonempty_string(cloud_build["location"]),
        failures,
    )
    verify_equal(
        "cloud_build.status",
        cloud_build["status"],
        "SUCCESS",
        failures,
    )

    build_source = cloud_build["source"]
    verify_equal(
        "cloud_build.source.type",
        build_source["type"],
        "gcs_storage_source",
        failures,
    )
    verify_condition(
        "cloud_build.source.bucket",
        is_nonempty_string(build_source["bucket"]),
        failures,
    )
    verify_condition(
        "cloud_build.source.object",
        is_nonempty_string(build_source["object"]),
        failures,
    )
    verify_condition(
        "cloud_build.source.generation",
        isinstance(build_source["generation"], str) and build_source["generation"].isdigit(),
        failures,
    )
    verify_condition(
        "cloud_build.source.sha256 format",
        isinstance(build_source["sha256"], str) and HEX64_RE.fullmatch(build_source["sha256"]) is not None,
        failures,
    )
    verify_equal(
        "cloud_build.source.resolved_repo_source",
        build_source["resolved_repo_source"],
        "absent",
        failures,
    )

    context = cloud_build["uploaded_context_verification"]
    count_fields = (
        "uploaded_entries",
        "git_tracked_entries",
        "common_entries",
        "tar_only_entries",
        "content_mismatches",
    )
    for field in count_fields:
        verify_condition(
            f"uploaded_context_verification.{field}",
            is_nonnegative_int(context[field]),
            failures,
        )

    git_only_entries = context["git_only_entries"]
    verify_condition(
        "uploaded_context_verification.git_only_entries",
        isinstance(git_only_entries, list) and all(is_nonempty_string(item) for item in git_only_entries),
        failures,
    )

    if all(is_nonnegative_int(context[field]) for field in count_fields) and isinstance(git_only_entries, list):
        verify_equal(
            "uploaded context count consistency",
            context["uploaded_entries"],
            context["common_entries"] + context["tar_only_entries"],
            failures,
        )
        verify_equal(
            "Git context count consistency",
            context["git_tracked_entries"],
            context["common_entries"] + len(git_only_entries),
            failures,
        )

    verify_equal(
        "uploaded_context_verification.result",
        context["result"],
        "PASS",
        failures,
    )
    verify_equal(
        "uploaded_context_verification.tar_only_entries",
        context["tar_only_entries"],
        0,
        failures,
    )
    verify_equal(
        "uploaded_context_verification.content_mismatches",
        context["content_mismatches"],
        0,
        failures,
    )

    external_images = cloud_build["resolved_external_images"]
    verify_condition(
        "resolved_external_images mapping",
        isinstance(external_images, dict) and bool(external_images),
        failures,
    )
    if isinstance(external_images, dict):
        for image, digest in external_images.items():
            verify_condition(
                f"resolved external image: {image}",
                is_nonempty_string(image)
                and isinstance(digest, str)
                and SHA256_DIGEST_RE.fullmatch(digest) is not None,
                failures,
            )

    api_image = manifest["api_image"]
    verify_condition(
        "api_image.digest format",
        isinstance(api_image["digest"], str) and SHA256_DIGEST_RE.fullmatch(api_image["digest"]) is not None,
        failures,
    )

    cloud_run = manifest["cloud_run"]
    verify_condition(
        "cloud_run.revision",
        is_nonempty_string(cloud_run["revision"]),
        failures,
    )
    verify_condition(
        "cloud_run.verified_image_digest format",
        isinstance(cloud_run["verified_image_digest"], str)
        and SHA256_DIGEST_RE.fullmatch(cloud_run["verified_image_digest"]) is not None,
        failures,
    )
    verify_condition(
        "cloud_run.traffic",
        is_nonempty_string(cloud_run["traffic"]),
        failures,
    )

    model_v2 = manifest["model_v2"]
    verify_equal(
        "model_v2.reference_only",
        model_v2["reference_only"],
        True,
        failures,
    )
    verify_condition(
        "model_v2.artifact_sha256 format",
        isinstance(model_v2["artifact_sha256"], str) and HEX64_RE.fullmatch(model_v2["artifact_sha256"]) is not None,
        failures,
    )
    verify_condition(
        "model_v2.schema_version",
        is_nonempty_string(model_v2["schema_version"]),
        failures,
    )

    verification = manifest["verification"]
    expected_verification = {
        "source_archive_sha256_match": "PASS",
        "uploaded_context_matches_recorded_git_source": "PASS",
        "native_git_to_cloud_build_source_binding": "ABSENT",
        "historical_external_image_resolution": "PASS",
        "production_revision_image_identity": "PASS",
    }
    for field, expected in expected_verification.items():
        verify_equal(
            f"verification.{field}",
            verification[field],
            expected,
            failures,
        )

    limitations = manifest["limitations"]
    verify_condition(
        "limitations",
        isinstance(limitations, list) and bool(limitations) and all(is_nonempty_string(item) for item in limitations),
        failures,
    )


def validate_top_level_structure(
    manifest: dict[str, Any],
    failures: list[str],
) -> bool:
    print("--- MANIFEST STRUCTURE ---")
    for key in REQUIRED_TOP_LEVEL_KEYS:
        if key in manifest:
            print(f"PASS {key}")
        else:
            print(f"FAIL {key}")
            failures.append(key)

    return not failures


def verify_manifest(manifest_path: Path, repo_root: Path) -> int:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    failures: list[str] = []

    if not validate_top_level_structure(manifest, failures):
        print("\n--- RESULT ---")
        print("RELEASE_PROVENANCE_VERIFICATION=FAIL")
        return 1

    validate_manifest_schema(manifest, failures)

    if failures:
        print("\n--- RESULT ---")
        print("RELEASE_PROVENANCE_VERIFICATION=FAIL")
        print("failed_checks=" + ",".join(failures))
        return 1

    source = manifest["source"]["commit_sha"]

    print("\n--- SOURCE IDENTITY ---")

    if not git_object_exists(repo_root, f"{source}^{{commit}}"):
        print(f"FAIL source commit unavailable: {source}")
        failures.append("source.commit_sha")
    else:
        actual_commit = run_git(
            repo_root,
            "rev-parse",
            f"{source}^{{commit}}",
            text=True,
        )
        assert isinstance(actual_commit, str)
        verify_equal(
            "source.commit_sha",
            actual_commit.strip(),
            source,
            failures,
        )

        actual_tree = run_git(
            repo_root,
            "rev-parse",
            f"{source}^{{tree}}",
            text=True,
        )
        assert isinstance(actual_tree, str)
        verify_equal(
            "source.tree_sha",
            actual_tree.strip(),
            manifest["source"]["tree_sha"],
            failures,
        )

    print("\n--- REPOSITORY INPUTS ---")

    repository_inputs = manifest["repository_inputs"]

    for relpath, entry in repository_inputs.items():
        if relpath == "application_copy_inputs":
            continue

        object_name = f"{source}:{relpath}"

        if "state" in entry:
            actual_state = "present" if git_object_exists(repo_root, object_name) else "absent_at_source"
            verify_equal(
                relpath,
                actual_state,
                entry["state"],
                failures,
            )
            continue

        if not git_object_exists(repo_root, object_name):
            print(f"FAIL {relpath}: missing at source commit")
            failures.append(relpath)
            continue

        actual_sha256 = sha256_bytes(git_file_bytes(repo_root, source, relpath))
        verify_equal(
            relpath,
            actual_sha256,
            entry["sha256"],
            failures,
        )

    archive_entry = repository_inputs["application_copy_inputs"]
    archive_paths = archive_entry["paths"]

    archive = run_git(
        repo_root,
        "archive",
        "--format=tar",
        source,
        "--",
        *archive_paths,
    )
    assert isinstance(archive, bytes)

    verify_equal(
        "application_copy_inputs.git_archive_sha256",
        sha256_bytes(archive),
        archive_entry["git_archive_sha256"],
        failures,
    )

    print("\n--- INTERNAL RELEASE CONSISTENCY ---")

    verify_equal(
        "api image == Cloud Run verified image",
        manifest["api_image"]["digest"],
        manifest["cloud_run"]["verified_image_digest"],
        failures,
    )

    print("\n--- RESULT ---")
    if failures:
        print("RELEASE_PROVENANCE_VERIFICATION=FAIL")
        print("failed_checks=" + ",".join(failures))
        return 1

    print("RELEASE_PROVENANCE_VERIFICATION=PASS")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Verify an API release provenance manifest using only local repository Git objects and manifest contents."
        )
    )
    parser.add_argument(
        "manifest",
        nargs="?",
        default="docs/architecture/release-s11-api.json",
        help="path to the release provenance JSON manifest",
    )
    parser.add_argument(
        "--repo-root",
        default=".",
        help="repository root containing the source Git objects",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest_path = Path(args.manifest).resolve()
    repo_root = Path(args.repo_root).resolve()

    try:
        return verify_manifest(manifest_path, repo_root)
    except (
        OSError,
        KeyError,
        TypeError,
        ValueError,
        VerificationError,
    ) as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        print("RELEASE_PROVENANCE_VERIFICATION=FAIL")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
