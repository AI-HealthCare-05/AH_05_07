"""Prepare staged companion candidates for the isolated local character viewer."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import struct
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[2]
CATALOG_SIZE = 12

NAME_MAP = {
    "koala": "코알라",
    "mouse": "생쥐",
    "pig": "돼지",
    "owl": "부엉이",
    "bear": "곰",
    "rabbit": "토끼",
    "cat": "고양이",
    "dog": "강아지",
    "red_panda": "레서판다",
    "otter": "수달",
    "capybara": "카피바라",
    "hedgehog": "고슴도치",
    "penguin": "펭귄",
    "fox": "여우",
    "squirrel": "다람쥐",
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def is_inside(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def safe_relative(value: object) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError("candidate sourceFile must be a non-empty relative path")

    if "\\" in value or ":" in value or "\x00" in value or value.startswith("/"):
        raise ValueError("unsafe candidate sourceFile")

    path = PurePosixPath(value)

    if any(part in {"", ".", ".."} for part in path.parts):
        raise ValueError("unsafe candidate sourceFile")

    return path.as_posix()


def viewer_variant(variant_key: str) -> str:
    if variant_key in {"standard", "optimized-standard"}:
        return "standard"

    if variant_key in {"lite", "optimized-lite"}:
        return "light"

    raise ValueError(f"unsupported review variant: {variant_key}")


def candidate_family(candidate: dict, family: str) -> bool:
    provenance = candidate.get("provenance") or {}

    if family == "world-v2":
        return (
            candidate.get("version") == "v002"
            and candidate.get("variantKey") in {"lite", "standard"}
            and provenance.get("sourceRevision") == "world-v2-001"
        )

    if family == "optimized-v1":
        return candidate.get("variantKey") in {
            "optimized-lite",
            "optimized-standard",
        }

    raise ValueError("unsupported candidate family")


def validate_glb(data: bytes) -> None:
    if len(data) < 20:
        raise ValueError("candidate GLB is too small")

    magic, version, total_length = struct.unpack_from("<III", data, 0)

    if magic != 0x46546C67:
        raise ValueError("candidate GLB magic mismatch")

    if version != 2:
        raise ValueError("candidate GLB version is not 2")

    if total_length != len(data):
        raise ValueError("candidate GLB length mismatch")

    json_length, json_type = struct.unpack_from("<II", data, 12)

    if json_type != 0x4E4F534A:
        raise ValueError("candidate GLB has no JSON first chunk")

    if 20 + json_length > len(data):
        raise ValueError("candidate GLB JSON chunk exceeds container")


def archive_member(zf: zipfile.ZipFile, source_file: str) -> str:
    source = safe_relative(source_file)
    parts = PurePosixPath(source).parts

    suffixes = {source}

    if len(parts) > 1:
        suffixes.add("/".join(parts[1:]))

    matches = []

    for raw in zf.namelist():
        if raw.endswith("/"):
            continue

        name = raw.strip("/")

        if any(
            name == suffix or name.endswith("/" + suffix)
            for suffix in suffixes
        ):
            matches.append(raw)

    matches = sorted(set(matches))

    if len(matches) != 1:
        raise ValueError(
            f"expected exactly one archive member for "
            f"{source_file}, got {matches}"
        )

    return matches[0]


def load_inventory(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))

    if data.get("schemaVersion") != 1:
        raise ValueError("unsupported candidate schemaVersion")

    if data.get("status") != "staging":
        raise ValueError("candidate inventory is not staging")

    if not isinstance(data.get("candidates"), list):
        raise ValueError("candidate inventory has no candidate list")

    return data


def prepare(
    inventory_path: Path,
    archive_path: Path,
    output: Path,
    family: str,
    expected_archive_sha256: str | None = None,
) -> dict:
    inventory_path = inventory_path.resolve()
    archive_path = archive_path.resolve()
    output = output.resolve()

    if output.exists():
        raise ValueError("review output already exists")

    if output == ROOT or is_inside(output, ROOT):
        raise ValueError(
            "candidate review assets must stay outside the repository"
        )

    partial = output.with_name(output.name + ".partial")

    if partial.exists():
        raise ValueError(
            "partial candidate review output already exists"
        )

    inventory = load_inventory(inventory_path)

    inventory_sha256 = sha256_file(inventory_path)
    archive_sha256 = sha256_file(archive_path)

    if (
        expected_archive_sha256 is not None
        and archive_sha256 != expected_archive_sha256
    ):
        raise ValueError("archive SHA-256 mismatch")

    selected = [
        candidate
        for candidate in inventory["candidates"]
        if candidate_family(candidate, family)
    ]

    if not selected:
        raise ValueError("candidate family is empty")

    candidate_ids = [
        candidate.get("candidateId")
        for candidate in selected
    ]

    candidate_sha = [
        candidate.get("sha256")
        for candidate in selected
    ]

    if len(candidate_ids) != len(set(candidate_ids)):
        raise ValueError("duplicate candidateId in selected family")

    if len(candidate_sha) != len(set(candidate_sha)):
        raise ValueError("duplicate SHA-256 in selected family")

    grouped: dict[str, dict[str, dict]] = {}

    for candidate in selected:
        species = candidate.get("speciesKey")

        if (
            not isinstance(species, str)
            or not re.fullmatch(
                r"[a-z][a-z0-9_]{1,47}",
                species,
            )
        ):
            raise ValueError("invalid species key")

        role = viewer_variant(
            candidate.get("variantKey", "")
        )

        variants = grouped.setdefault(
            species,
            {},
        )

        if role in variants:
            raise ValueError(
                f"duplicate {species}/{role} candidate"
            )

        variants[role] = candidate

    if len(grouped) > CATALOG_SIZE:
        raise ValueError(
            "viewer supports at most 12 candidate species"
        )

    for species, variants in grouped.items():
        if set(variants) != {
            "standard",
            "light",
        }:
            raise ValueError(
                f"{species} does not have both "
                "standard/light review variants"
            )

    partial.mkdir(
        parents=True,
        exist_ok=False,
    )

    mappings = []

    try:
        with zipfile.ZipFile(archive_path) as zf:
            for species in sorted(grouped):
                species_dir = partial / species
                species_dir.mkdir()

                for role in (
                    "standard",
                    "light",
                ):
                    candidate = grouped[
                        species
                    ][role]

                    source_file = safe_relative(
                        candidate["sourceFile"]
                    )

                    member = archive_member(
                        zf,
                        source_file,
                    )

                    data = zf.read(member)

                    validate_glb(data)

                    actual_sha = sha256_bytes(data)

                    if (
                        actual_sha
                        != candidate["sha256"]
                    ):
                        raise ValueError(
                            f"{candidate['candidateId']} "
                            "SHA-256 mismatch"
                        )

                    if (
                        len(data)
                        != candidate["bytes"]
                    ):
                        raise ValueError(
                            f"{candidate['candidateId']} "
                            "byte-size mismatch"
                        )

                    relative = (
                        f"{species}/{role}.glb"
                    )

                    destination = (
                        partial / relative
                    )

                    destination.write_bytes(
                        data
                    )

                    mappings.append({
                        "candidateId":
                            candidate[
                                "candidateId"
                            ],
                        "speciesKey":
                            species,
                        "candidateVersion":
                            candidate[
                                "version"
                            ],
                        "candidateVariantKey":
                            candidate[
                                "variantKey"
                            ],
                        "viewerVariant":
                            role,
                        "sourceRevision":
                            candidate[
                                "provenance"
                            ].get(
                                "sourceRevision"
                            ),
                        "sourceFile":
                            source_file,
                        "archiveMember":
                            member,
                        "sha256":
                            actual_sha,
                        "bytes":
                            len(data),
                        "reviewFile":
                            relative,
                    })

        by_species = {}

        for mapping in mappings:
            by_species.setdefault(
                mapping["speciesKey"],
                {},
            )[
                mapping["viewerVariant"]
            ] = mapping

        animals = []

        for species in sorted(
            by_species
        ):
            pair = by_species[
                species
            ]

            animals.append({
                "id":
                    species,
                "name":
                    NAME_MAP.get(
                        species,
                        species
                        .replace("_", " ")
                        .title(),
                    ),
                "status":
                    "review_candidate",
                "motion":
                    "in_place",
                "hero":
                    None,
                "standard":
                    pair[
                        "standard"
                    ][
                        "reviewFile"
                    ],
                "light":
                    pair[
                        "light"
                    ][
                        "reviewFile"
                    ],
                "note":
                    (
                        "Review-only #594 "
                        "candidate. This "
                        "viewer does not "
                        "activate a production "
                        "companion."
                    ),
            })

        slot = 1

        while len(animals) < CATALOG_SIZE:
            animals.append({
                "id":
                    f"pending-{slot:02d}",
                "name":
                    f"Unused review slot "
                    f"{slot}",
                "status":
                    "pending",
                "motion":
                    "in_place",
                "hero":
                    None,
                "standard":
                    None,
                "light":
                    None,
                "note":
                    "Unused review slot; "
                    "not an asset.",
            })

            slot += 1

        catalog = {
            "schema_version": 1,
            "source_commit": (
                "candidate-inventory-sha256:"
                + inventory_sha256
            ),
            "animals": animals,
        }

        evidence = {
            "documentType":
                "COMPANION_CANDIDATE_"
                "BROWSER_REVIEW_INPUT",
            "status":
                "prepared-not-qualified",
            "family":
                family,
            "candidateInventorySha256":
                inventory_sha256,
            "sourceArchiveSha256":
                archive_sha256,
            "speciesCount":
                len(grouped),
            "candidateCount":
                len(mappings),
            "candidates":
                mappings,
            "runtimeActivation":
                False,
            "r2Mutation":
                False,
            "productionQualified":
                False,
        }

        (
            partial
            / "catalog.json"
        ).write_text(
            json.dumps(
                catalog,
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        (
            partial
            / "candidate-review-input.json"
        ).write_text(
            json.dumps(
                evidence,
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        partial.rename(output)

    except Exception:
        shutil.rmtree(
            partial,
            ignore_errors=True,
        )
        raise

    return evidence


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__
    )

    parser.add_argument(
        "--inventory",
        required=True,
        type=Path,
    )

    parser.add_argument(
        "--archive",
        required=True,
        type=Path,
    )

    parser.add_argument(
        "--output",
        required=True,
        type=Path,
    )

    parser.add_argument(
        "--family",
        required=True,
        choices=(
            "world-v2",
            "optimized-v1",
        ),
    )

    parser.add_argument(
        "--archive-sha256",
    )

    args = parser.parse_args()

    result = prepare(
        args.inventory,
        args.archive,
        args.output,
        args.family,
        args.archive_sha256,
    )

    print(
        json.dumps({
            "status":
                "prepared",
            "family":
                result["family"],
            "speciesCount":
                result["speciesCount"],
            "candidateCount":
                result["candidateCount"],
            "output":
                str(
                    args.output.resolve()
                ),
        })
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
