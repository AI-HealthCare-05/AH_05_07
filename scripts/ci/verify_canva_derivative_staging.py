#!/usr/bin/env python3
"""Validate the local, unbound SK7 Canva derivative review package.

The script deliberately uses only the Python standard library.  It validates
the exact files that a future delivery change may consider; it never uploads,
copies, serves, or binds them to the application.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
import tempfile
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SCHEMA = "sk7-canva-derivative-review-v1"


@dataclass(frozen=True)
class AssetRule:
    register_id: str
    source_id: str
    filename: str
    role: str
    mime: str
    min_width: int
    min_height: int
    max_bytes: int
    exact_width: int | None = None
    exact_height: int | None = None
    alpha_required: bool = False
    decorative: bool = True


ASSETS = (
    AssetRule(
        "CANVA-ID-001",
        "MAHUP7kjh_0",
        "sk7-app-icon-512-v01.png",
        "app icon master",
        "image/png",
        512,
        512,
        512_000,
        exact_width=512,
        exact_height=512,
        decorative=False,
    ),
    AssetRule(
        "CANVA-ID-002",
        "MAHUPyj8tPc",
        "sk7-apple-touch-icon-180-v01.png",
        "Apple touch icon",
        "image/png",
        180,
        180,
        256_000,
        exact_width=180,
        exact_height=180,
        decorative=False,
    ),
    AssetRule(
        "CANVA-BG-001",
        "DAHUPf9rvoo",
        "sk7-calm-clay-desktop-v01.webp",
        "desktop scene layer",
        "image/webp",
        1280,
        720,
        1_500_000,
    ),
    AssetRule(
        "CANVA-BG-002",
        "DAHUPljPCy8",
        "sk7-calm-clay-mobile-v01.webp",
        "mobile scene layer",
        "image/webp",
        720,
        1280,
        1_200_000,
    ),
    AssetRule(
        "CANVA-CHAR-001",
        "MAHUPsGl3QY",
        "sk7-character-base-cream-v01.png",
        "neutral decorative character",
        "image/png",
        256,
        256,
        600_000,
        alpha_required=True,
    ),
    AssetRule(
        "CANVA-CHAR-002",
        "MAHUPqpW1LA",
        "sk7-character-saved-v01.png",
        "confirmed-save decorative character",
        "image/png",
        256,
        256,
        600_000,
        alpha_required=True,
    ),
    AssetRule(
        "CANVA-CHAR-003-empty",
        "MAHUPpTX-fo",
        "sk7-character-empty-v01.png",
        "empty-state decorative character",
        "image/png",
        256,
        256,
        600_000,
        alpha_required=True,
    ),
    AssetRule(
        "CANVA-CHAR-003-retry",
        "MAHUPmW52-Y",
        "sk7-character-retry-v01.png",
        "retry-state decorative character",
        "image/png",
        256,
        256,
        600_000,
        alpha_required=True,
    ),
    AssetRule(
        "CANVA-CHAR-003-locked",
        "MAHUPoEyTFQ",
        "sk7-character-locked-v01.png",
        "locked-state decorative character",
        "image/png",
        256,
        256,
        600_000,
        alpha_required=True,
    ),
)

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
PNG_METADATA_CHUNKS = {b"eXIf", b"tEXt", b"zTXt", b"iTXt", b"tIME"}
WEBP_METADATA_CHUNKS = {b"EXIF", b"XMP "}


class ValidationError(ValueError):
    """A review package does not meet the versioned staging contract."""


def parse_png(data: bytes) -> dict[str, Any]:
    if not data.startswith(PNG_SIGNATURE):
        raise ValidationError("not a PNG signature")

    offset = len(PNG_SIGNATURE)
    width = height = color_type = None
    has_alpha = False
    metadata: list[str] = []
    saw_iend = False
    saw_idat = False

    while offset < len(data):
        if offset + 12 > len(data):
            raise ValidationError("truncated PNG chunk")
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        chunk_type = data[offset + 4 : offset + 8]
        chunk_end = offset + 12 + length
        if chunk_end > len(data):
            raise ValidationError("PNG chunk length exceeds file")
        chunk_data = data[offset + 8 : offset + 8 + length]
        if chunk_type == b"IHDR":
            if length != 13 or width is not None:
                raise ValidationError("invalid PNG IHDR")
            width, height, _bit_depth, color_type, _compression, _filter, _interlace = struct.unpack(
                ">IIBBBBB", chunk_data
            )
            has_alpha = color_type in {4, 6}
        elif chunk_type == b"tRNS":
            has_alpha = True
        elif chunk_type in PNG_METADATA_CHUNKS:
            metadata.append(chunk_type.decode("ascii"))
        elif chunk_type == b"IDAT":
            saw_idat = True
        elif chunk_type == b"IEND":
            saw_iend = True
            break
        offset = chunk_end

    if width is None or height is None or not saw_idat or not saw_iend:
        raise ValidationError("PNG is missing IHDR, IDAT, or IEND")
    return {
        "mime": "image/png",
        "width": width,
        "height": height,
        "has_alpha": has_alpha,
        "metadata_chunks": metadata,
    }


def parse_webp(data: bytes) -> dict[str, Any]:
    if len(data) < 12 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise ValidationError("not a WebP RIFF container")

    offset = 12
    width = height = None
    metadata: list[str] = []
    while offset < len(data):
        if offset + 8 > len(data):
            raise ValidationError("truncated WebP chunk")
        chunk_type = data[offset : offset + 4]
        length = struct.unpack("<I", data[offset + 4 : offset + 8])[0]
        start = offset + 8
        end = start + length
        if end > len(data):
            raise ValidationError("WebP chunk length exceeds file")
        chunk = data[start:end]
        if chunk_type in WEBP_METADATA_CHUNKS:
            metadata.append(chunk_type.decode("ascii").strip())
        elif chunk_type == b"VP8X" and len(chunk) >= 10:
            width = int.from_bytes(chunk[4:7], "little") + 1
            height = int.from_bytes(chunk[7:10], "little") + 1
        elif chunk_type == b"VP8L" and len(chunk) >= 5 and chunk[0] == 0x2F:
            bits = int.from_bytes(chunk[1:5], "little")
            width = (bits & 0x3FFF) + 1
            height = ((bits >> 14) & 0x3FFF) + 1
        elif chunk_type == b"VP8 " and len(chunk) >= 10 and chunk[3:6] == b"\x9d\x01\x2a":
            width = struct.unpack("<H", chunk[6:8])[0] & 0x3FFF
            height = struct.unpack("<H", chunk[8:10])[0] & 0x3FFF
        offset = end + (length % 2)

    if not width or not height:
        raise ValidationError("WebP is missing a readable image dimension chunk")
    return {
        "mime": "image/webp",
        "width": width,
        "height": height,
        "has_alpha": False,
        "metadata_chunks": metadata,
    }


def inspect_asset(path: Path, rule: AssetRule) -> dict[str, Any]:
    if not path.is_file():
        raise ValidationError(f"missing required file: {rule.filename}")
    data = path.read_bytes()
    if len(data) > rule.max_bytes:
        raise ValidationError(
            f"{rule.filename} is {len(data):,} bytes; budget is {rule.max_bytes:,} bytes"
        )
    if rule.mime == "image/png":
        result = parse_png(data)
    elif rule.mime == "image/webp":
        result = parse_webp(data)
    else:  # pragma: no cover - all rules are constants above
        raise ValidationError(f"unsupported expected MIME type: {rule.mime}")

    if result["mime"] != rule.mime:
        raise ValidationError(f"{rule.filename} MIME does not match its registered extension")
    if rule.exact_width is not None and result["width"] != rule.exact_width:
        raise ValidationError(f"{rule.filename} must be exactly {rule.exact_width}px wide")
    if rule.exact_height is not None and result["height"] != rule.exact_height:
        raise ValidationError(f"{rule.filename} must be exactly {rule.exact_height}px high")
    if result["width"] < rule.min_width or result["height"] < rule.min_height:
        raise ValidationError(
            f"{rule.filename} is {result['width']}x{result['height']}; minimum is "
            f"{rule.min_width}x{rule.min_height}"
        )
    if rule.alpha_required and not result["has_alpha"]:
        raise ValidationError(f"{rule.filename} must retain an alpha-capable PNG channel")
    if result["metadata_chunks"]:
        chunks = ", ".join(result["metadata_chunks"])
        raise ValidationError(f"{rule.filename} contains removable metadata chunks: {chunks}")

    return {
        "register_id": rule.register_id,
        "canva_source_id": rule.source_id,
        "filename": rule.filename,
        "role": rule.role,
        "mime": result["mime"],
        "width": result["width"],
        "height": result["height"],
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "metadata_clean": True,
        "decorative": rule.decorative,
        "css_fallback": "existing CSS scene / semantic HTML remains required",
        "manual_review": {
            "text_free": None,
            "viewport_fit": None,
            "blocked_image_fallback": None,
        },
    }


def inspect_package(assets_dir: Path) -> list[dict[str, Any]]:
    if not assets_dir.is_dir():
        raise ValidationError(f"assets directory does not exist: {assets_dir}")
    expected = {rule.filename for rule in ASSETS}
    actual = {path.name for path in assets_dir.iterdir() if path.is_file()}
    unexpected = sorted(actual - expected)
    if unexpected:
        raise ValidationError(f"unregistered file(s) in review package: {', '.join(unexpected)}")
    return [inspect_asset(assets_dir / rule.filename, rule) for rule in ASSETS]


def build_manifest(records: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "schema": SCHEMA,
        "delivery_status": "review-only-unbound",
        "runtime_binding": False,
        "r2_upload": False,
        "assets": records,
        "manual_review_instructions": (
            "Set all manual_review values to true only after a sanitized visual review. "
            "The reviewer must verify text-free imagery, target viewport fit, and the "
            "existing semantic HTML/CSS fallback while the image is blocked."
        ),
    }


def verify_manifest(records: list[dict[str, Any]], manifest_path: Path, require_manual_review: bool) -> None:
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValidationError(f"manifest does not exist: {manifest_path}") from exc
    except json.JSONDecodeError as exc:
        raise ValidationError(f"manifest is not valid JSON: {manifest_path}") from exc

    if manifest.get("schema") != SCHEMA:
        raise ValidationError("manifest schema is not the SK7 derivative review schema")
    if manifest.get("delivery_status") != "review-only-unbound":
        raise ValidationError("manifest must remain review-only-unbound in this issue")
    if manifest.get("runtime_binding") is not False or manifest.get("r2_upload") is not False:
        raise ValidationError("this staging package must not claim runtime binding or R2 upload")

    manifest_records = {asset.get("filename"): asset for asset in manifest.get("assets", [])}
    for record in records:
        saved = manifest_records.get(record["filename"])
        if saved is None:
            raise ValidationError(f"manifest is missing {record['filename']}")
        for key in ("register_id", "canva_source_id", "mime", "width", "height", "bytes", "sha256", "metadata_clean"):
            if saved.get(key) != record[key]:
                raise ValidationError(f"manifest differs from file for {record['filename']}: {key}")
        if require_manual_review:
            review = saved.get("manual_review", {})
            incomplete = [key for key in ("text_free", "viewport_fit", "blocked_image_fallback") if review.get(key) is not True]
            if incomplete:
                raise ValidationError(
                    f"manual review remains incomplete for {record['filename']}: {', '.join(incomplete)}"
                )


def write_png(path: Path, width: int, height: int, alpha: bool, with_text_chunk: bool = False) -> None:
    color_type = 6 if alpha else 2
    channels = 4 if alpha else 3
    row = b"\x00" + (b"\x00" * width * channels)
    compressed = zlib.compress(row * height)

    def chunk(name: bytes, body: bytes) -> bytes:
        return struct.pack(">I", len(body)) + name + body + struct.pack(">I", zlib.crc32(name + body) & 0xFFFFFFFF)

    output = PNG_SIGNATURE
    output += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, color_type, 0, 0, 0))
    if with_text_chunk:
        output += chunk(b"tEXt", b"Author\x00not allowed")
    output += chunk(b"IDAT", compressed)
    output += chunk(b"IEND", b"")
    path.write_bytes(output)


def write_webp_header(path: Path, width: int, height: int) -> None:
    # This tiny VP8X container exercises the dimension and metadata parser; it
    # is intentionally not a substitute for a visual image decoder test.
    body = b"\x00\x00\x00\x00" + (width - 1).to_bytes(3, "little") + (height - 1).to_bytes(3, "little")
    chunk = b"VP8X" + struct.pack("<I", len(body)) + body
    path.write_bytes(b"RIFF" + struct.pack("<I", len(b"WEBP") + len(chunk)) + b"WEBP" + chunk)


def run_self_test() -> None:
    with tempfile.TemporaryDirectory() as raw_dir:
        root = Path(raw_dir)
        directory = root / "assets"
        directory.mkdir()
        for rule in ASSETS:
            path = directory / rule.filename
            if rule.mime == "image/png":
                width = rule.exact_width or rule.min_width
                height = rule.exact_height or rule.min_height
                write_png(path, width, height, rule.alpha_required)
            else:
                write_webp_header(path, rule.min_width, rule.min_height)
        records = inspect_package(directory)
        if len(records) != len(ASSETS):
            raise AssertionError("self-test did not inspect every expected derivative")
        manifest_path = root / "review-v1.json"
        manifest = build_manifest(records)
        for record in manifest["assets"]:
            record["manual_review"] = {
                "text_free": True,
                "viewport_fit": True,
                "blocked_image_fallback": True,
            }
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        verify_manifest(records, manifest_path, require_manual_review=True)
        write_png(directory / ASSETS[0].filename, 512, 512, False, with_text_chunk=True)
        try:
            inspect_package(directory)
        except ValidationError as exc:
            if "metadata" not in str(exc):
                raise AssertionError("self-test rejected the wrong condition") from exc
        else:
            raise AssertionError("self-test did not reject PNG text metadata")
    print("Canva derivative staging self-test: passed")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets-dir", type=Path, help="untracked directory containing the exact nine exported derivatives")
    parser.add_argument("--write-manifest", type=Path, help="write exact file metadata into a review-only JSON manifest")
    parser.add_argument("--manifest", type=Path, help="verify an existing review-only JSON manifest")
    parser.add_argument("--require-manual-review", action="store_true", help="require the three sanitized review attestations for every asset")
    parser.add_argument("--self-test", action="store_true", help="run parser and policy controls without real assets")
    args = parser.parse_args()

    if args.self_test:
        if any((args.assets_dir, args.write_manifest, args.manifest, args.require_manual_review)):
            parser.error("--self-test cannot be combined with asset package options")
        run_self_test()
        return 0
    if args.assets_dir is None:
        parser.error("--assets-dir is required unless --self-test is used")
    if args.write_manifest and args.manifest:
        parser.error("choose either --write-manifest or --manifest")
    if args.require_manual_review and not args.manifest:
        parser.error("--require-manual-review requires --manifest")

    try:
        records = inspect_package(args.assets_dir)
        if args.write_manifest:
            args.write_manifest.parent.mkdir(parents=True, exist_ok=True)
            args.write_manifest.write_text(json.dumps(build_manifest(records), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"review-only manifest written: {args.write_manifest}")
        if args.manifest:
            verify_manifest(records, args.manifest, args.require_manual_review)
            print(f"Canva derivative staging verification: passed ({len(records)} assets)")
    except ValidationError as exc:
        print(f"Canva derivative staging verification: failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
