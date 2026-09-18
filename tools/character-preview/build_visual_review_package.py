"""Build an immutable offline human-review package from World v2 browser evidence."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SPECIES = ("koala", "mouse", "owl", "pig")
SCREENS = ("S01", "S02", "S10")
VIEWPORTS = ((1366, 768), (390, 844), (320, 844))
CLIPS = ("celebrate", "curious", "greet", "idle", "move", "rest", "special")
VIEWER_VARIANTS = ("standard", "light")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inside(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def png_dimensions(path: Path) -> tuple[int, int]:
    header = path.read_bytes()[:24]

    if (
        len(header) < 24
        or header[:8] != b"\x89PNG\r\n\x1a\n"
        or header[12:16] != b"IHDR"
    ):
        raise ValueError(f"not a PNG: {path}")

    width, height = struct.unpack(">II", header[16:24])

    if width <= 0 or height <= 0:
        raise ValueError(f"invalid PNG dimensions: {path}")

    return width, height


def normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def find_screen_image(
    candidates: list[Path],
    species: str,
    screen: str,
    width: int,
    height: int,
) -> Path:
    tokens = (
        normalized(species),
        normalized(screen),
        f"{width}x{height}",
    )

    matches = []

    for path in candidates:
        haystack = normalized(path.as_posix())

        if all(token in haystack for token in tokens):
            matches.append(path)

    if len(matches) != 1:
        raise ValueError(
            f"expected one screenshot for {species}/{screen}/{width}x{height}, "
            f"got {[str(x) for x in matches]}"
        )

    return matches[0]


def candidate_map(candidate_input: dict) -> dict[tuple[str, str], dict]:
    result = {}

    for item in candidate_input["candidates"]:
        viewer_variant = item["viewerVariant"]

        if viewer_variant == "light":
            canonical_variant = "lite"
        elif viewer_variant == "standard":
            canonical_variant = "standard"
        else:
            raise ValueError(f"unexpected viewer variant: {viewer_variant}")

        key = (item["speciesKey"], canonical_variant)

        if key in result:
            raise ValueError(f"duplicate candidate mapping: {key}")

        result[key] = item

    expected = {
        (species, variant)
        for species in SPECIES
        for variant in ("lite", "standard")
    }

    if set(result) != expected:
        raise ValueError("candidate input does not contain exact World v2 family")

    return result


def validate_sources(
    candidate_root: Path,
    prequal_root: Path,
    screen_root: Path,
) -> tuple[dict, dict, dict, dict]:
    candidate = load_json(candidate_root / "candidate-review-input.json")
    qualification = load_json(prequal_root / "candidate-qualification.json")
    verification = load_json(prequal_root / "verification.json")
    screen = load_json(screen_root / "screen-integration.json")

    if (
        candidate.get("family") != "world-v2"
        or candidate.get("candidateCount") != 8
        or candidate.get("speciesCount") != 4
        or candidate.get("runtimeActivation") is not False
        or candidate.get("productionQualified") is not False
    ):
        raise ValueError("unexpected World v2 candidate evidence")

    if (
        qualification.get("status") != "passed"
        or qualification.get("family") != "world-v2"
        or qualification.get("candidateCount") != 8
        or qualification.get("clipVariantChecks") != 56
        or qualification.get("productionReady") is not False
    ):
        raise ValueError("isolated browser prequalification is incomplete")

    if (
        verification.get("status") != "passed"
        or verification.get("availableAnimalsTested") != 4
        or verification.get("clipVariantChecks") != 56
    ):
        raise ValueError("isolated browser verification is incomplete")

    if (
        screen.get("status") != "passed"
        or screen.get("expectedCases") != 36
        or screen.get("passedCases") != 36
        or screen.get("failedCases") != 0
        or screen.get("productionReady") is not False
    ):
        raise ValueError("SK7 screen integration evidence is incomplete")

    return candidate, qualification, verification, screen


def copy_png(source: Path, destination: Path) -> dict:
    width, height = png_dimensions(source)

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)

    if sha256_file(source) != sha256_file(destination):
        raise ValueError("copied screenshot identity changed")

    return {
        "path": destination.as_posix(),
        "sha256": sha256_file(destination),
        "width": width,
        "height": height,
        "bytes": destination.stat().st_size,
    }


def build_package(
    candidate_root: Path,
    prequal_root: Path,
    screen_root: Path,
    output: Path,
) -> dict:
    candidate_root = candidate_root.resolve()
    prequal_root = prequal_root.resolve()
    screen_root = screen_root.resolve()
    output = output.resolve()

    for source in (candidate_root, prequal_root, screen_root):
        if not source.is_dir():
            raise ValueError(f"missing evidence directory: {source}")

    if output.exists():
        raise ValueError("review package output already exists")

    if output == ROOT or inside(output, ROOT):
        raise ValueError("review package must stay outside repository")

    partial = output.with_name(output.name + ".partial")

    if partial.exists():
        raise ValueError("partial review package already exists")

    candidate, qualification, verification, screen = validate_sources(
        candidate_root,
        prequal_root,
        screen_root,
    )

    candidates = candidate_map(candidate)

    screen_pngs = sorted(
        (screen_root / "playwright").rglob("candidate-screen.png")
    )

    if len(screen_pngs) != 36:
        raise ValueError(
            f"expected 36 screen screenshots, got {len(screen_pngs)}"
        )

    screen_records = {
        (
            item["species"],
            item["screen"],
            item["viewport"]["width"],
            item["viewport"]["height"],
        ): item
        for item in screen["records"]
    }

    if len(screen_records) != 36:
        raise ValueError("screen evidence does not contain 36 unique cases")

    partial.mkdir(parents=True)

    screen_items = []
    pose_items = []

    try:
        for species in SPECIES:
            lite = candidates[(species, "lite")]

            for screen_id in SCREENS:
                for width, height in VIEWPORTS:
                    key = (species, screen_id, width, height)
                    record = screen_records.get(key)

                    if not record or record["status"] != "passed":
                        raise ValueError(f"missing passing screen record: {key}")

                    source = find_screen_image(
                        screen_pngs,
                        species,
                        screen_id,
                        width,
                        height,
                    )

                    relative = Path(
                        "images",
                        "screens",
                        species,
                        screen_id.lower(),
                        f"{width}x{height}.png",
                    )

                    copied = copy_png(source, partial / relative)

                    screen_items.append({
                        "kind": "screen",
                        "speciesKey": species,
                        "candidateId": lite["candidateId"],
                        "candidateSha256": lite["sha256"],
                        "variantKey": "lite",
                        "screen": screen_id,
                        "viewport": {
                            "width": width,
                            "height": height,
                        },
                        "renderer": record.get("renderer"),
                        "subjectBounds": record.get("subjectBounds"),
                        "activeRequestCount": record.get("activeRequestCount"),
                        "layoutOverflow": record.get("layoutOverflow"),
                        **{
                            **copied,
                            "path": relative.as_posix(),
                        },
                    })

        asset_manifest = {
            (item["animal"], item["variant"]): item
            for item in verification["assetManifest"]
        }

        if len(asset_manifest) != 8:
            raise ValueError("isolated verifier asset manifest is not 8 binaries")

        for species in SPECIES:
            for viewer_variant in VIEWER_VARIANTS:
                canonical_variant = (
                    "lite" if viewer_variant == "light" else "standard"
                )

                candidate_item = candidates[(species, canonical_variant)]
                browser_asset = asset_manifest[(species, viewer_variant)]

                if browser_asset["sha256"] != candidate_item["sha256"]:
                    raise ValueError(
                        f"browser asset identity differs for "
                        f"{species}/{canonical_variant}"
                    )

                for clip in CLIPS:
                    source = prequal_root / (
                        f"{species}-{viewer_variant}-{clip}.png"
                    )

                    if not source.is_file():
                        raise ValueError(f"missing pose screenshot: {source.name}")

                    relative = Path(
                        "images",
                        "poses",
                        species,
                        canonical_variant,
                        f"{clip}.png",
                    )

                    copied = copy_png(source, partial / relative)

                    pose_items.append({
                        "kind": "pose",
                        "speciesKey": species,
                        "candidateId": candidate_item["candidateId"],
                        "candidateSha256": candidate_item["sha256"],
                        "variantKey": canonical_variant,
                        "clip": clip,
                        **{
                            **copied,
                            "path": relative.as_posix(),
                        },
                    })

        if len(screen_items) != 36 or len(pose_items) != 56:
            raise ValueError("review package image count mismatch")

        manifest = {
            "documentType": "COMPANION_WORLD_V2_VISUAL_REVIEW_PACKAGE",
            "status": "ready-for-human-review",
            "family": "world-v2",
            "sourceEvidence": {
                "candidateReviewInputSha256": sha256_file(
                    candidate_root / "candidate-review-input.json"
                ),
                "browserQualificationSha256": sha256_file(
                    prequal_root / "candidate-qualification.json"
                ),
                "browserVerificationSha256": sha256_file(
                    prequal_root / "verification.json"
                ),
                "screenIntegrationSha256": sha256_file(
                    screen_root / "screen-integration.json"
                ),
            },
            "species": list(SPECIES),
            "screenScreenshotCount": len(screen_items),
            "poseScreenshotCount": len(pose_items),
            "imageCount": len(screen_items) + len(pose_items),
            "candidates": [
                {
                    "speciesKey": species,
                    "variantKey": variant,
                    "candidateId": candidates[(species, variant)]["candidateId"],
                    "sha256": candidates[(species, variant)]["sha256"],
                    "bytes": candidates[(species, variant)]["bytes"],
                }
                for species in SPECIES
                for variant in ("lite", "standard")
            ],
            "screenImages": screen_items,
            "poseImages": pose_items,
            "productionActivationApproved": False,
            "productionReady": False,
        }

        manifest_file = partial / "review-manifest.json"
        manifest_file.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        manifest_sha = sha256_file(manifest_file)

        decision = {
            "documentType": "COMPANION_WORLD_V2_VISUAL_REVIEW_DECISION",
            "status": "pending-human-review",
            "reviewPackageManifestSha256": manifest_sha,
            "scope": "visual-art-review-only",
            "species": [
                {
                    "speciesKey": species,
                    "liteCandidateId": candidates[(species, "lite")]["candidateId"],
                    "liteSha256": candidates[(species, "lite")]["sha256"],
                    "standardCandidateId": candidates[
                        (species, "standard")
                    ]["candidateId"],
                    "standardSha256": candidates[
                        (species, "standard")
                    ]["sha256"],
                    "decision": "pending",
                    "silhouette": "pending",
                    "motion": "pending",
                    "screenFit": {
                        "S01": "pending",
                        "S02": "pending",
                        "S10": "pending",
                    },
                    "notes": "",
                }
                for species in SPECIES
            ],
            "overallDecision": "pending",
            "reviewer": "",
            "reviewedAt": "",
            "productionActivationApproved": False,
        }

        (partial / "decision-template.json").write_text(
            json.dumps(decision, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        build_html(
            partial,
            manifest,
            manifest_sha,
        )

        partial.rename(output)

    except Exception:
        shutil.rmtree(partial, ignore_errors=True)
        raise

    return {
        "status": "ready-for-human-review",
        "manifestSha256": manifest_sha,
        "screenImages": len(screen_items),
        "poseImages": len(pose_items),
        "images": len(screen_items) + len(pose_items),
        "output": str(output),
    }


def build_html(root: Path, manifest: dict, manifest_sha: str) -> None:
    by_species_screens = {species: [] for species in SPECIES}
    by_species_poses = {species: [] for species in SPECIES}

    for item in manifest["screenImages"]:
        by_species_screens[item["speciesKey"]].append(item)

    for item in manifest["poseImages"]:
        by_species_poses[item["speciesKey"]].append(item)

    sections = []

    for species in SPECIES:
        screen_cards = []

        for item in by_species_screens[species]:
            screen_cards.append(
                f"""
                <figure>
                  <img loading="lazy" src="{html.escape(item['path'])}">
                  <figcaption>
                    {html.escape(item['screen'])}
                    · {item['viewport']['width']}×{item['viewport']['height']}
                    · lite
                  </figcaption>
                </figure>
                """
            )

        pose_cards = []

        for item in by_species_poses[species]:
            pose_cards.append(
                f"""
                <figure>
                  <img loading="lazy" src="{html.escape(item['path'])}">
                  <figcaption>
                    {html.escape(item['variantKey'])}
                    · {html.escape(item['clip'])}
                  </figcaption>
                </figure>
                """
            )

        lite = next(
            c for c in manifest["candidates"]
            if c["speciesKey"] == species and c["variantKey"] == "lite"
        )

        standard = next(
            c for c in manifest["candidates"]
            if c["speciesKey"] == species and c["variantKey"] == "standard"
        )

        sections.append(
            f"""
            <section>
              <h2>{html.escape(species)}</h2>
              <p class="identity">
                lite <code>{lite['sha256']}</code><br>
                standard <code>{standard['sha256']}</code>
              </p>
              <h3>실제 SK7 화면</h3>
              <div class="screen-grid">
                {''.join(screen_cards)}
              </div>
              <h3>동작 / 변형 25% pose</h3>
              <div class="pose-grid">
                {''.join(pose_cards)}
              </div>
            </section>
            """
        )

    document = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>World v2 사람 시각 검토</title>
<style>
body {{
  margin: 0 auto;
  max-width: 1600px;
  padding: 28px;
  font-family: system-ui, sans-serif;
  background: #f6f5f0;
  color: #20231f;
}}
header, section {{
  background: white;
  border: 1px solid #ddd;
  border-radius: 14px;
  padding: 22px;
  margin-bottom: 24px;
}}
h1, h2, h3 {{ line-height: 1.2; }}
.warning {{
  padding: 12px;
  background: #fff5d6;
  border-radius: 8px;
}}
.screen-grid {{
  display: grid;
  grid-template-columns: repeat(auto-fit,minmax(280px,1fr));
  gap: 14px;
}}
.pose-grid {{
  display: grid;
  grid-template-columns: repeat(auto-fit,minmax(180px,1fr));
  gap: 12px;
}}
figure {{
  margin: 0;
  padding: 8px;
  background: #fafafa;
  border: 1px solid #ddd;
  border-radius: 8px;
}}
img {{
  width: 100%;
  height: auto;
  display: block;
  background: #eee;
}}
figcaption {{
  margin-top: 6px;
  font-size: 13px;
}}
.identity {{
  overflow-wrap: anywhere;
  font-size: 12px;
}}
code {{
  font-family: ui-monospace, monospace;
}}
</style>
</head>
<body>
<header>
<h1>World v2 사람 시각 검토 패키지</h1>
<p>manifest SHA-256: <code>{manifest_sha}</code></p>
<p>화면 이미지 36장 + 동작/변형 pose 56장 = 총 92장</p>
<p class="warning">
이 페이지는 사람의 시각·아트 판단을 돕는 자료입니다.
화면이 정상적으로 보인다는 이유만으로 production 승인으로 해석하지 않습니다.
결정은 decision-template.json에 별도로 기록합니다.
</p>
</header>
{''.join(sections)}
</body>
</html>
"""

    (root / "index.html").write_text(
        document,
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate-root", required=True, type=Path)
    parser.add_argument("--prequal-root", required=True, type=Path)
    parser.add_argument("--screen-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)

    args = parser.parse_args()

    result = build_package(
        args.candidate_root,
        args.prequal_root,
        args.screen_root,
        args.output,
    )

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
