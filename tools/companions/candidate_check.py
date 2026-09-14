"""Pre-publish binary check for one SK7 companion candidate.

Runs the existing independent GLB audit for both delivery variants, verifies the
candidate inputs stayed byte-identical across the combined check, and publishes a
small deterministic summary plus the two full audit reports. This tool does not
build, render, open a browser, upload, publish, or approve visual quality.
"""

import argparse
import hashlib
import json
import shutil
import struct
import subprocess
import tempfile
from pathlib import Path

from glb_audit import CLIPS, AuditError, audit_asset, load_json, require

VARIANTS = ("standard", "light")
INPUT_FILES = ("standard.glb", "light.glb", "asset-manifest.json", "generator.py")


def file_identity(path):
    payload = path.read_bytes()
    return {"bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}


def candidate_identity(asset_dir):
    asset_dir = Path(asset_dir).resolve()
    identities = {}
    for name in INPUT_FILES:
        path = asset_dir / name
        require(path.resolve().parent == asset_dir and path.is_file(), "candidate_file_boundary")
        identities[name] = file_identity(path)
    return identities


def variant_summary(result, report_name, report_sha256):
    return {
        "status": result["status"],
        "bytes": result["bytes"],
        "sha256": result["sha256"],
        "triangles": result["geometry"]["triangles"],
        "rendered_triangles": result["geometry"]["rendered_triangles"],
        "materials": result["geometry"]["materials"],
        "textures": result["materials"]["textures"],
        "skin_joints": result["skin_joints"],
        "clip_durations_seconds": {name: result["clips"][name]["duration_seconds"] for name in CLIPS},
        "report": report_name,
        "report_sha256": report_sha256,
    }


def json_payload(value):
    return (json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2) + "\n").encode("utf-8")


def write_new_json(path, value):
    payload = json_payload(value)
    with path.open("xb") as stream:
        stream.write(payload)
        stream.flush()
    require(path.read_bytes() == payload, "candidate_report_write_mismatch")
    return hashlib.sha256(payload).hexdigest()


def run_candidate_check(asset_dir, output, repository=None, auditor=audit_asset):
    require(str(asset_dir).strip(), "candidate_asset_directory_required")
    require(str(output).strip(), "candidate_output_directory_required")
    if repository is not None:
        require(str(repository).strip(), "candidate_repository_directory_required")

    repository = Path(repository).resolve() if repository is not None else Path(__file__).resolve().parents[2]
    asset_dir = Path(asset_dir).resolve()
    output = Path(output).resolve()

    require(asset_dir.is_dir(), "candidate_asset_directory_required")
    require(output.parent.is_dir() and not output.exists(), "new_candidate_output_directory_required")
    require(
        not output.is_relative_to(repository) and not repository.is_relative_to(output),
        "candidate_output_outside_repository",
    )
    require(
        not output.is_relative_to(asset_dir) and not asset_dir.is_relative_to(output),
        "candidate_output_must_not_overlap_inputs",
    )

    before = candidate_identity(asset_dir)
    manifest = load_json((asset_dir / "asset-manifest.json").read_bytes())
    reports = {variant: auditor(asset_dir, variant, repository) for variant in VARIANTS}
    after = candidate_identity(asset_dir)
    require(before == after, "candidate_inputs_changed_during_check")

    expected_durations = {name: manifest.get("clip_duration_seconds") for name in CLIPS}
    require(manifest.get("clips") == list(CLIPS), "candidate_manifest_clip_contract")
    for variant, result in reports.items():
        require(set(result.get("clips", {})) == set(CLIPS), "candidate_runtime_clip_contract")
        actual_durations = {name: result["clips"][name].get("duration_seconds") for name in CLIPS}
        require(actual_durations == expected_durations, "candidate_runtime_duration_contract")
        require(
            result.get("bytes") == before[f"{variant}.glb"]["bytes"]
            and result.get("sha256") == before[f"{variant}.glb"]["sha256"],
            "candidate_runtime_identity_contract",
        )

    stage = Path(tempfile.mkdtemp(prefix=f".{output.name}.pending-", dir=output.parent))
    try:
        report_hashes = {}
        for variant in VARIANTS:
            report_name = f"{variant}-binary-audit.json"
            report_hashes[variant] = write_new_json(stage / report_name, reports[variant])

        summary = {
            "schema_version": 1,
            "status": "candidate_binary_pass_visual_review_required",
            "candidate": asset_dir.name,
            "species": manifest.get("species"),
            "quality_status": manifest.get("quality_status"),
            "human_review": manifest.get("human_review"),
            "basis_commit": manifest.get("basis_commit"),
            "generator_repository_commit": manifest.get("generator_repository_commit"),
            "clips": list(CLIPS),
            "clip_duration_seconds": manifest.get("clip_duration_seconds"),
            "inputs": before,
            "variants": {
                variant: variant_summary(reports[variant], f"{variant}-binary-audit.json", report_hashes[variant])
                for variant in VARIANTS
            },
            "limitations": [
                "No Blender render or browser playback was run",
                "No visual quality, collision, foot contact, performance, publication or product approval is claimed",
                "The result is a pre-publish candidate check only",
            ],
        }
        write_new_json(stage / "candidate-check.json", summary)
        stage.rename(output)
    except Exception:
        shutil.rmtree(stage, ignore_errors=True)
        raise
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset-dir", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--repository", help="Defaults to the repository containing this checker")
    args = parser.parse_args()
    try:
        summary = run_candidate_check(args.asset_dir, args.output, args.repository)
    except (
        AuditError,
        OSError,
        KeyError,
        TypeError,
        AttributeError,
        IndexError,
        OverflowError,
        RecursionError,
        struct.error,
        subprocess.TimeoutExpired,
    ) as error:
        print("SK7_COMPANION_CANDIDATE_FAIL", str(error) if isinstance(error, AuditError) else type(error).__name__)
        return 1
    print(
        "SK7_COMPANION_CANDIDATE_PASS",
        summary.get("species"),
        summary["variants"]["standard"]["triangles"],
        summary["variants"]["light"]["triangles"],
        "triangles",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
