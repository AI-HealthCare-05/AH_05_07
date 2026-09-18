"""Run the World v2 GLB -> Blender editable checkpoint -> reopen gate."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[2]

EXPECTED_MASTER_SHA = "5f7541e8f48a0f3dd7bf58e0cf6f82d19a25063c38f8c018567bdfb727cebed2"

WORLD8 = {
    "koala-world-v2-001-lite.glb": "9fa34f6339b7699ffeeac48e688dabe349207b7a6c465b4ffda7a53f159b6657",
    "koala-world-v2-001-standard.glb": "27c5e1582a727533bd45fbaa815474f49d37178d0993d6dcb8cf374e2e8f3208",
    "mouse-world-v2-001-lite.glb": "efbcd9e0ece9f31088accf16868b885d0af54be7621b392fbdddead38433b0e7",
    "mouse-world-v2-001-standard.glb": "fc82de1c761f5975711fd4bb775698645c44b50e6a578264ab04f14a06b98c62",
    "pig-world-v2-001-lite.glb": "e228d555af6eed3c986a65dec69c33cd55e638162c322bde3852a9041bd2e76a",
    "pig-world-v2-001-standard.glb": "ecbb40473145750026c91c0d1f6b14142db05887ab2acf1f91693433ba7b849b",
    "owl-world-v2-001-lite.glb": "4e4b6e7b2aa6e276da8c63c8d01eedc2fc35835da853b0d918d468d13d886861",
    "owl-world-v2-001-standard.glb": "1e773423d08ba333d628517ad49ce5cb926cd4a967d482efb3acab2ae5b0b5b5",
}

EXPECTED_BYTES = {
    "koala-world-v2-001-lite.glb": 547288,
    "koala-world-v2-001-standard.glb": 1010084,
    "mouse-world-v2-001-lite.glb": 626692,
    "mouse-world-v2-001-standard.glb": 1120212,
    "pig-world-v2-001-lite.glb": 559404,
    "pig-world-v2-001-standard.glb": 978524,
    "owl-world-v2-001-lite.glb": 662592,
    "owl-world-v2-001-standard.glb": 1183524,
}

EXPECTED_ACTIONS = {
    "celebrate",
    "curious",
    "greet",
    "idle",
    "move",
    "rest",
    "special",
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inside(
    child: Path,
    parent: Path,
) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def archive_member(
    names: list[str],
    filename: str,
) -> str:
    suffix = "/02_World_Factory/SK7_World_Factory_v2/assets/companions/" + filename

    matches = [name for name in names if name.endswith(suffix)]

    if len(matches) != 1:
        raise ValueError(f"expected exactly one archive member for {filename}, got {matches}")

    candidate = PurePosixPath(matches[0])

    if candidate.is_absolute() or ".." in candidate.parts:
        raise ValueError("unsafe archive member")

    return matches[0]


def load_report(
    path: Path,
) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def structural_key(
    report: dict,
) -> dict:
    return {
        "objects": report["objects"],
        "meshes": report["meshes"],
        "armatures": report["armatures"],
        "bones": report["bones"],
        "actions": report["actions"],
        "materials": report["materials"],
        "meshVertices": report["meshVertices"],
        "meshPolygons": report["meshPolygons"],
    }


def validate_report(
    report: dict,
) -> None:
    if report["meshes"] <= 0:
        raise ValueError("Blender report has no mesh")

    if report["armatures"] != 1:
        raise ValueError("Blender report must contain one armature")

    if report["bones"] <= 0:
        raise ValueError("Blender report has no bones")

    if report["meshVertices"] <= 0:
        raise ValueError("Blender report has no vertices")

    if report["meshPolygons"] <= 0:
        raise ValueError("Blender report has no polygons")

    missing = EXPECTED_ACTIONS - set(report["actions"])

    if missing:
        raise ValueError(f"Blender report missing actions: {sorted(missing)}")


def run(  # noqa: C901
    archive: Path,
    blender: Path,
    output: Path,
) -> dict:
    archive = archive.resolve()
    blender = blender.resolve()
    output = output.resolve()

    if output == ROOT or inside(output, ROOT):
        raise ValueError("output must stay outside repository")

    if output.exists():
        raise ValueError("output already exists")

    if not archive.is_file():
        raise ValueError("archive not found")

    if not blender.is_file():
        raise ValueError("Blender executable not found")

    archive_sha = sha256_file(archive)

    if archive_sha != EXPECTED_MASTER_SHA:
        raise ValueError("Master archive SHA-256 mismatch")

    probe = ROOT / "tools" / "character-preview" / "blender_world_v2_probe.py"

    if not probe.is_file():
        raise ValueError("Blender probe script is missing")

    partial = output.with_name(output.name + ".partial")

    if partial.exists():
        raise ValueError("partial output already exists")

    partial.mkdir(parents=True)

    records = []

    try:
        with zipfile.ZipFile(archive) as zf:
            names = [name for name in zf.namelist() if not name.endswith("/")]

            for filename in sorted(WORLD8):
                member = archive_member(
                    names,
                    filename,
                )

                data = zf.read(member)

                actual_sha = sha256_bytes(data)

                if actual_sha != WORLD8[filename]:
                    raise ValueError(f"GLB SHA mismatch: {filename}")

                if len(data) != EXPECTED_BYTES[filename]:
                    raise ValueError(f"GLB byte mismatch: {filename}")

                stem = Path(filename).stem

                case_dir = partial / stem

                case_dir.mkdir()

                glb = case_dir / filename

                blend = case_dir / f"{stem}.blend"

                import_report = case_dir / "import.json"

                reopen_report = case_dir / "reopen.json"

                glb.write_bytes(data)

                subprocess.run(
                    [
                        str(blender),
                        "--background",
                        "--factory-startup",
                        "--python",
                        str(probe),
                        "--",
                        "import",
                        str(glb),
                        str(blend),
                        str(import_report),
                    ],
                    check=True,
                )

                if not blend.is_file():
                    raise ValueError(f"Blend checkpoint missing: {filename}")

                if not import_report.is_file():
                    raise ValueError(f"Import report missing: {filename}")

                subprocess.run(
                    [
                        str(blender),
                        "--background",
                        str(blend),
                        "--python",
                        str(probe),
                        "--",
                        "reopen",
                        str(reopen_report),
                    ],
                    check=True,
                )

                if not reopen_report.is_file():
                    raise ValueError(f"Reopen report missing: {filename}")

                imported = load_report(import_report)

                reopened = load_report(reopen_report)

                validate_report(imported)

                validate_report(reopened)

                if structural_key(imported) != structural_key(reopened):
                    raise ValueError(f"import/reopen structure mismatch: {filename}")

                records.append(
                    {
                        "filename": filename,
                        "archiveMember": member,
                        "glbBytes": len(data),
                        "glbSha256": actual_sha,
                        "blendBytes": blend.stat().st_size,
                        "blendSha256": sha256_file(blend),
                        "blenderVersion": imported["blenderVersion"],
                        "objects": imported["objects"],
                        "meshes": imported["meshes"],
                        "armatures": imported["armatures"],
                        "bones": imported["bones"],
                        "actions": imported["actions"],
                        "materials": imported["materials"],
                        "meshVertices": imported["meshVertices"],
                        "meshPolygons": imported["meshPolygons"],
                        "checkpoint": (f"{stem}/{stem}.blend"),
                        "importReport": f"{stem}/import.json",
                        "reopenReport": f"{stem}/reopen.json",
                        "editableCheckpointSaved": True,
                        "reopenQualified": True,
                    }
                )

        if len(records) != 8:
            raise ValueError("World8 result count mismatch")

        blender_versions = sorted({record["blenderVersion"] for record in records})

        if len(blender_versions) != 1:
            raise ValueError("multiple Blender versions in one gate run")

        result = {
            "documentType": "COMPANION_WORLD_V2_BLENDER_REIMPORT",
            "status": "passed",
            "scope": "glb-to-editable-blend-reimport-and-reopen",
            "sourceArchiveSha256": archive_sha,
            "binaryCount": 8,
            "passedBinaryCount": 8,
            "failedBinaryCount": 0,
            "blenderVersion": blender_versions[0],
            "nativeAuthoringBlendRecovered": False,
            "editableReimportQualified": True,
            "checkpointReopenQualified": True,
            "productionActivationApproved": False,
            "productionReady": False,
            "records": records,
        }

        (partial / "blender-reimport.json").write_text(
            json.dumps(
                result,
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )

        partial.rename(output)

        return result

    except Exception:
        shutil.rmtree(
            partial,
            ignore_errors=True,
        )
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)

    parser.add_argument(
        "--archive",
        required=True,
        type=Path,
    )

    parser.add_argument(
        "--blender",
        required=True,
        type=Path,
    )

    parser.add_argument(
        "--output",
        required=True,
        type=Path,
    )

    args = parser.parse_args()

    result = run(
        args.archive,
        args.blender,
        args.output,
    )

    print(
        json.dumps(
            {
                "status": result["status"],
                "binaries": result["binaryCount"],
                "blenderVersion": result["blenderVersion"],
                "editableReimportQualified": result["editableReimportQualified"],
                "productionReady": result["productionReady"],
            }
        )
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
