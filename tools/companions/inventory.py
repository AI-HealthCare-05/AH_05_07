"""Inventory only catalog-selected local graphics candidates; never infer quality approval."""

import argparse
import hashlib
import platform
import re
import stat
from collections import Counter
from pathlib import Path, PurePosixPath, PureWindowsPath

from glb_audit import CLIPS, AuditError, load_json, require, write_report

VIEWS = ("front", "side", "back", "hero")
VARIANTS = ("standard", "light")
KNOWN_FILES = {
    "source.blend",
    "rigged.blend",
    "standard.blend",
    "light.blend",
    "standard.glb",
    "light.glb",
    "generator.py",
    "asset-manifest.json",
    "motion-preview.webm",
    "ground-preview.webm",
    *(f"{view}.png" for view in VIEWS),
    *(f"{variant}-{view}.png" for variant in VARIANTS for view in VIEWS),
    *(f"{variant}-{clip}-{pose}.png" for variant in VARIANTS for clip in CLIPS for pose in ("quarter", "mid")),
    *(f"{variant}-reimport-check.json" for variant in VARIANTS),
}
REQUIRED_FILES = {
    "source.blend",
    "standard.blend",
    "light.blend",
    "standard.glb",
    "light.glb",
    "generator.py",
    "asset-manifest.json",
}
COMMIT = re.compile(r"[0-9a-f]{40}\Z")
IDENTIFIER = re.compile(r"[a-z][a-z0-9_]*\Z")
SEGMENT = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]*\Z")


def signature(path):
    info = path.stat()
    require(
        not getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_HIDDEN", 2),
        "hidden_artifact_forbidden",
    )
    require(stat.S_ISREG(info.st_mode), "regular_artifact_required")
    return info.st_size, info.st_mtime_ns, info.st_dev, info.st_ino


def contained(path, boundary):
    resolved = path.resolve()
    require(resolved != boundary and resolved.is_relative_to(boundary), "artifact_path_escape")
    return resolved


def catalog_path(value, root, kind):
    require(isinstance(value, str) and "\\" not in value and not PureWindowsPath(value).drive, "invalid_relative_path")
    parts = PurePosixPath(value).parts
    require(
        not value.startswith("/")
        and len(parts) == 2
        and all(SEGMENT.fullmatch(part) and part not in (".", "..") for part in parts)
        and value == "/".join(parts),
        "simple_candidate_relative_path_required",
    )
    require(parts[1] in KNOWN_FILES, "unrecognized_catalog_artifact")
    require(parts[1] == f"{kind}.glb" if kind in VARIANTS else parts[1].endswith(".png"), "catalog_artifact_type")
    contained(root / parts[0], root)
    contained(root.joinpath(*parts), root)
    return parts


def read_control(path, boundary, controls):
    contained(path, boundary)
    size = signature(path)[0]
    require(size <= 2 * 1024 * 1024, "control_json_too_large")
    before = path.read_bytes()
    require(len(before) == size, "control_changed_during_read")
    controls[path] = before
    return load_json(before)


def file_record(path, root, boundary, signatures):
    contained(path, boundary)
    before = signature(path)
    digest = hashlib.sha256()
    total = 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
            total += len(chunk)
    require(signature(path) == before and total == before[0], "artifact_changed_during_hash")
    signatures[path] = before
    return {
        "path": path.relative_to(root).as_posix(),
        "format": path.suffix.removeprefix("."),
        "bytes": total,
        "sha256": digest.hexdigest(),
    }


def manifest_details(manifest, animal, records):
    require(manifest.get("species") == animal["id"], "manifest_species_mismatch")
    require(COMMIT.fullmatch(manifest.get("basis_commit", "")), "invalid_basis_commit")
    require(COMMIT.fullmatch(manifest.get("generator_repository_commit", "")), "invalid_generator_commit")
    require(manifest.get("generator_source_matches_commit") is True, "generator_alignment_not_declared")
    require(
        manifest.get("clips") == list(CLIPS) and manifest.get("clip_duration_seconds") == 4, "manifest_clip_contract"
    )
    require(isinstance(manifest.get("generator"), str), "generator_tool_required")
    variants = manifest.get("variants", {})
    require(set(variants) == set(VARIANTS), "manifest_two_variants_required")
    details = {}
    for variant in VARIANTS:
        value = variants[variant]
        require(value.get("file") == f"{variant}.glb", "manifest_variant_filename")
        for field in ("triangles", "bytes", "textures"):
            require(
                type(value.get(field)) is int and value[field] >= (1 if field != "textures" else 0),
                "manifest_variant_count",
            )
        require(re.fullmatch(r"[0-9a-f]{64}", value.get("sha256", "")), "invalid_declared_digest")
        actual = records.get(value["file"])
        if actual is not None:
            require(
                actual["bytes"] == value["bytes"] and actual["sha256"] == value["sha256"],
                "generated_asset_digest_mismatch",
            )
        details[variant] = {
            "present": actual is not None,
            "manifest_declared_triangles": value["triangles"],
            "manifest_declared_textures": value["textures"],
            "manifest_digest_matches": actual is not None,
        }
    generator = records.get("generator.py")
    require(re.fullmatch(r"[0-9a-f]{64}", manifest.get("source_script_sha256", "")), "invalid_generator_digest")
    if generator is not None:
        require(generator["sha256"] == manifest["source_script_sha256"], "generator_digest_mismatch")
    return {
        "basis_commit": manifest["basis_commit"],
        "generator_repository_commit": manifest["generator_repository_commit"],
        "generator_tool": manifest["generator"],
        "generator_source_sha256": manifest["source_script_sha256"],
        "generator_digest_matches": generator is not None,
        "generator_git_alignment": "Manifest declaration only; this inventory does not rerun Git/blob or GLB structural audits",
        "manifest_declared_clips": manifest["clips"],
        "manifest_declared_clip_count": len(manifest["clips"]),
        "manifest_declared_duration_seconds": manifest["clip_duration_seconds"],
        "manifest_quality_status": manifest.get("quality_status"),
        "manifest_human_review": manifest.get("human_review"),
        "variants": details,
    }


def candidate_record(animal, root, controls, signatures):
    links = {key: catalog_path(animal[key], root, key) for key in (*VARIANTS, "hero") if animal.get(key) is not None}
    folders = {parts[0] for parts in links.values()}
    require(len(folders) <= 1, "catalog_mixed_candidate_folders")
    record = {
        "id": animal["id"],
        "name": animal.get("name"),
        "catalog_status": animal["status"],
        "catalog_note": animal.get("note"),
        "quality_pass_inferred": False,
    }
    if not folders:
        return {
            **record,
            "selection": "not_selected",
            "packaging_status": "not_selected",
            "files": [],
            "missing_artifacts": [],
        }
    folder = next(iter(folders))
    require(re.fullmatch(re.escape(animal["id"]) + r"-v[0-9]+", folder), "candidate_folder_identity")
    directory = root / folder
    boundary = contained(directory, root)
    files = {}
    if directory.exists():
        require(directory.is_dir(), "candidate_directory_required")
        for path in sorted(directory.iterdir()):
            if path.name in KNOWN_FILES:
                files[path.name] = file_record(path, root, boundary, signatures)
    missing = sorted((REQUIRED_FILES | {parts[1] for parts in links.values()}) - set(files))
    manifest = None
    if "asset-manifest.json" in files:
        manifest_path = directory / "asset-manifest.json"
        control = read_control(manifest_path, root, controls)
        require(
            hashlib.sha256(controls[manifest_path]).hexdigest() == files["asset-manifest.json"]["sha256"],
            "manifest_changed_between_hash_and_parse",
        )
        manifest = manifest_details(control, animal, files)
    return {
        **record,
        "selection": folder,
        "packaging_status": "missing_artifacts" if missing else "inventoried_not_quality_approved",
        "missing_artifacts": [f"{folder}/{name}" for name in missing],
        "missing_catalog_references": [key for key in (*VARIANTS, "hero") if key not in links],
        "files": list(files.values()),
        "generated_manifest": manifest,
    }


def create_inventory(assets):
    root = Path(assets).resolve()
    repository = Path(__file__).resolve().parents[2]
    require(
        root.is_dir() and not root.is_relative_to(repository) and not repository.is_relative_to(root),
        "external_assets_directory_required",
    )
    controls, signatures = {}, {}
    catalog = read_control(root / "catalog.json", root, controls)
    require(catalog.get("schema_version") == 1 and isinstance(catalog.get("animals"), list), "catalog_schema")
    require(COMMIT.fullmatch(catalog.get("source_commit", "")), "invalid_catalog_basis_commit")
    ids = [animal.get("id") for animal in catalog["animals"]]
    require(
        ids
        and all(isinstance(value, str) and IDENTIFIER.fullmatch(value) for value in ids)
        and len(set(ids)) == len(ids),
        "catalog_unique_ids",
    )
    for animal in catalog["animals"]:
        require(isinstance(animal.get("status"), str) and animal["status"], "catalog_status_required")
    candidates = [candidate_record(animal, root, controls, signatures) for animal in catalog["animals"]]
    selected = {row["selection"] for row in candidates if row["selection"] != "not_selected"}
    prior = []
    for path in sorted(root.iterdir()):
        if path.name in selected or not any(
            re.fullmatch(re.escape(animal_id) + r"-v[0-9]+", path.name) for animal_id in ids
        ):
            continue
        # Inspect only the directory entry, never resolve or enter an unselected candidate.
        prior.append(
            {
                "path": path.name,
                "counted": False,
                "contents_read": False,
                "reason": "not_selected_by_catalog; prior quality/failure status not inferred",
            }
        )
    for path, original in controls.items():
        contained(path, root)
        require(path.read_bytes() == original, "catalog_or_manifest_changed_during_inventory")
    for path, before in signatures.items():
        contained(path, root)
        require(signature(path) == before, "artifact_stat_changed_during_inventory")
    present = {
        variant: sum(any(Path(file["path"]).name == f"{variant}.glb" for file in row["files"]) for row in candidates)
        for variant in VARIANTS
    }
    return {
        "schema_version": 1,
        "status": "local_submission_review_inventory_not_release_approval",
        "catalog_sha256": hashlib.sha256(controls[root / "catalog.json"]).hexdigest(),
        "catalog_basis_commit": catalog["source_commit"],
        "inventory_tool": {
            "python": platform.python_version(),
            "script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        },
        "summary": {
            "catalog_animals": len(candidates),
            "selected_candidate_folders": len(selected),
            "catalog_status_counts": dict(sorted(Counter(row["catalog_status"] for row in candidates).items())),
            "present_variant_files": present,
            "known_artifact_files": sum(len(row["files"]) for row in candidates),
            "known_artifact_total_bytes": sum(file["bytes"] for row in candidates for file in row["files"]),
            "candidates_with_missing_artifacts": sum(
                row["packaging_status"] == "missing_artifacts" for row in candidates
            ),
            "manifest_declared_candidate_clip_count": sum(
                row.get("generated_manifest", {}).get("manifest_declared_clip_count", 0)
                for row in candidates
                if row.get("generated_manifest")
            ),
            "quality_or_completion_count_inferred": False,
        },
        "candidates": candidates,
        "unselected_candidates_not_counted": prior,
        "integrity": {
            "catalog_and_generated_manifests_bytes_unchanged": True,
            "inventoried_file_stat_stability_checked": True,
        },
        "scope": [
            "Only direct known filenames in explicitly selected candidate folders; no global recursion or unselected file reads",
            "GLB bytes and generator digest checked against the generated manifest; clip/triangle counts are manifest declarations, not a new binary geometry audit",
            "Other artifact digests describe the bytes read; stat stability is checked, not a second complete content hash",
            "Catalog state is preserved verbatim; presence and successful inventory never imply visual, motion, human or release approval",
            "Separate QA output folders, old versions, hidden and unrecognized files are excluded",
        ],
        "resume": "Review catalog statuses and missing_artifacts; run again with a new output filename after changes. This command does not generate or approve assets.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        output = args.output.resolve()
        repository = Path(__file__).resolve().parents[2]
        require(
            output.suffix == ".json" and not output.name.startswith(".") and not output.is_relative_to(repository),
            "external_json_output_required",
        )
        require(output.parent.is_dir() and not output.exists(), "new_output_file_required")
        write_report(create_inventory(args.assets), output)
    except (AuditError, OSError, KeyError, TypeError, AttributeError, ValueError) as error:
        print("SK7_COMPANION_INVENTORY_FAIL", str(error) if isinstance(error, AuditError) else type(error).__name__)
        return 1
    print("SK7_COMPANION_INVENTORY_WRITTEN", str(output), "quality approval not inferred")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
