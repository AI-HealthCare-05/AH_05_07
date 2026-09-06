"""Read-only verification of a supplied selected companion inventory and asset root.

This tool never generates, renders, copies, moves, uploads, or approves assets.
It checks only the selected direct artifacts covered by the inventory contract.
"""

import argparse
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

from glb_audit import AuditError, load_json, require
from inventory import create_inventory

EXPECTED_SELECTED_COUNT = 11
EXPECTED_CLIP_COUNT = 77
EXPECTED_VARIANTS = {"standard": 11, "light": 11}
CONTROL_LIMIT_BYTES = 2 * 1024 * 1024


def read_control(path):
    require(path.is_file() and path.stat().st_size <= CONTROL_LIMIT_BYTES, "control_file_required")
    payload = path.read_bytes()
    return payload, load_json(payload)


def selected_rows(inventory):
    rows = inventory.get("candidates")
    require(isinstance(rows, list), "inventory_candidates_required")
    return [row for row in rows if row.get("selection") != "not_selected"]


def rows_by_id(rows):
    indexed = {row.get("id"): row for row in rows}
    require(None not in indexed and len(indexed) == len(rows), "candidate_id_duplicate")
    return indexed


def flat_files(rows):
    files = [item for row in rows for item in row.get("files", [])]
    paths = [item.get("path") for item in files]
    require(
        all(isinstance(path, str) for path in paths) and len(paths) == len(set(paths)), "inventory_file_path_duplicate"
    )
    return files


def byte_duplicates(files):
    grouped = defaultdict(list)
    for item in files:
        digest = item.get("sha256")
        require(isinstance(digest, str) and len(digest) == 64, "inventory_file_digest_invalid")
        grouped[digest].append(item["path"])
    duplicates = [paths for paths in grouped.values() if len(paths) > 1]
    for paths in duplicates:
        require(all(Path(path).name == "generator.py" for path in paths), "unexpected_byte_duplicate")
    return duplicates


def check_checkpoint(checkpoint_path, inventory_path, inventory_bytes):
    _, checkpoint = read_control(checkpoint_path)
    asset_inventory = checkpoint.get("asset_inventory")
    require(isinstance(asset_inventory, dict), "checkpoint_inventory_reference_required")
    require(Path(asset_inventory.get("path", "")).name == inventory_path.name, "checkpoint_inventory_name_mismatch")
    require(asset_inventory.get("bytes") == len(inventory_bytes), "checkpoint_inventory_size_mismatch")
    require(
        asset_inventory.get("sha256") == hashlib.sha256(inventory_bytes).hexdigest(),
        "checkpoint_inventory_digest_mismatch",
    )


def verify(inventory_path, assets, checkpoint_path=None):
    inventory_bytes, expected = read_control(inventory_path)
    require(expected.get("schema_version") == 1, "inventory_schema_version")
    require(expected.get("status") == "local_submission_review_inventory_not_release_approval", "inventory_status")
    if checkpoint_path is not None:
        check_checkpoint(checkpoint_path, inventory_path, inventory_bytes)

    expected_rows = expected.get("candidates")
    expected_by_id = rows_by_id(expected_rows)
    expected_selected = selected_rows(expected)
    selected_ids = [row["id"] for row in expected_selected]
    selections = [row["selection"] for row in expected_selected]
    require(len(expected_selected) == EXPECTED_SELECTED_COUNT, "selected_candidate_count")
    require(len(selected_ids) == len(set(selected_ids)), "selected_candidate_id_duplicate")
    require(len(selections) == len(set(selections)), "selected_candidate_folder_duplicate")

    seal = expected_by_id.get("seal")
    require(
        seal is not None
        and seal.get("catalog_status") == "needs_revision"
        and seal.get("selection") == "not_selected"
        and not seal.get("files"),
        "seal_selection_contract",
    )
    unselected = expected.get("unselected_candidates_not_counted", [])
    require(
        any(row.get("path") == "seal-v001" and row.get("counted") is False for row in unselected),
        "seal_exclusion_record",
    )

    clip_pairs = []
    for row in expected_selected:
        manifest = row.get("generated_manifest")
        require(isinstance(manifest, dict), "selected_manifest_required")
        clips = manifest.get("manifest_declared_clips")
        require(isinstance(clips, list) and len(clips) == len(set(clips)), "candidate_clip_duplicate")
        clip_pairs.extend((row["id"], clip) for clip in clips)
    require(
        len(clip_pairs) == EXPECTED_CLIP_COUNT and len(set(clip_pairs)) == EXPECTED_CLIP_COUNT, "logical_clip_count"
    )

    expected_files = flat_files(expected_selected)
    expected_duplicates = byte_duplicates(expected_files)
    expected_summary = expected.get("summary", {})
    require(expected_summary.get("selected_candidate_folders") == EXPECTED_SELECTED_COUNT, "summary_selected_count")
    require(expected_summary.get("manifest_declared_candidate_clip_count") == EXPECTED_CLIP_COUNT, "summary_clip_count")
    require(expected_summary.get("present_variant_files") == EXPECTED_VARIANTS, "summary_variant_count")
    require(expected_summary.get("known_artifact_files") == len(expected_files), "summary_file_count")
    require(expected_summary.get("candidates_with_missing_artifacts") == 0, "summary_missing_artifacts")

    actual = create_inventory(assets)
    require(actual.get("catalog_sha256") == expected.get("catalog_sha256"), "catalog_digest_mismatch")
    require(actual.get("catalog_basis_commit") == expected.get("catalog_basis_commit"), "catalog_basis_commit_mismatch")
    actual_by_id = rows_by_id(actual.get("candidates"))
    require(set(actual_by_id) == set(expected_by_id), "catalog_candidate_set_mismatch")
    for identifier, expected_row in expected_by_id.items():
        actual_row = actual_by_id[identifier]
        for field in (
            "catalog_status",
            "selection",
            "packaging_status",
            "missing_artifacts",
            "missing_catalog_references",
        ):
            require(actual_row.get(field) == expected_row.get(field), f"candidate_{field}_mismatch")
        require(actual_row.get("files") == expected_row.get("files"), "inventory_file_manifest_mismatch")
        require(
            actual_row.get("generated_manifest") == expected_row.get("generated_manifest"),
            "generated_manifest_mismatch",
        )

    actual_selected = selected_rows(actual)
    actual_files = flat_files(actual_selected)
    actual_duplicates = byte_duplicates(actual_files)
    require(actual_duplicates == expected_duplicates, "byte_duplicate_set_mismatch")
    require(
        actual.get("summary", {}).get("known_artifact_total_bytes")
        == expected_summary.get("known_artifact_total_bytes"),
        "artifact_size_mismatch",
    )

    return {
        "status": "passed",
        "inventory_basename": inventory_path.name,
        "checkpoint_verified": checkpoint_path is not None,
        "selected_candidate_count": len(expected_selected),
        "unique_logical_clip_count": len(clip_pairs),
        "seal": "needs_revision_not_selected",
        "missing_artifacts": 0,
        "logical_duplicates": 0,
        "byte_duplicate_groups": len(expected_duplicates),
        "byte_duplicate_entries": sum(len(group) for group in expected_duplicates),
        "byte_duplicate_scope": "intentional identical generator.py source groups only",
        "inventoried_file_count": len(expected_files),
        "inventoried_total_bytes": expected_summary.get("known_artifact_total_bytes"),
        "catalog_sha256": expected.get("catalog_sha256"),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--assets", type=Path, required=True)
    parser.add_argument("--checkpoint", type=Path)
    args = parser.parse_args()
    try:
        report = verify(
            args.inventory.resolve(), args.assets.resolve(), args.checkpoint.resolve() if args.checkpoint else None
        )
    except (AuditError, OSError, ValueError, KeyError, TypeError) as error:
        print(
            "SK7_COMPANION_SELECTION_VERIFY_FAIL", str(error) if isinstance(error, AuditError) else type(error).__name__
        )
        return 1
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
