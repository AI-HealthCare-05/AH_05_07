"""Optional local contact sheet from unedited browser PNGs; requires existing Pillow."""

import argparse
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def contact(report_path, animal, output):
    if output.exists():
        raise ValueError("Preserve previous contact sheet; choose a new output")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    rows = [item for item in report["playback"] if item["animal"] == animal and item["variant"] == "standard"]
    if not rows:
        raise ValueError("Animal is absent from the verified report")
    font = ImageFont.load_default(size=18)
    width, height = 840, 90 + 270 * len(rows)
    sheet = Image.new("RGB", (width, height), "#f4f2eb")
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 15), f"{animal} | actual browser pose captures | standard / light", font=font, fill="#303b37")
    draw.text((20, 42), "Functional review only; not final visual-quality approval", font=font, fill="#52634e")
    for row, item in enumerate(rows):
        for column, variant in enumerate(("standard", "light")):
            name = re.sub(r"[^a-zA-Z0-9_-]", "_", item["clip"])
            source = report_path.parent / f"{animal}-{variant}-{name}.png"
            with Image.open(source) as picture:
                picture.thumbnail((400, 225), Image.Resampling.LANCZOS)
                x, y = 10 + column * 420, 88 + row * 270
                sheet.paste(picture, (x + (400 - picture.width) // 2, y))
            point = item.get("capturedPoseTimeSeconds")
            time = f"{point:.3f}s" if point is not None else "sample time not matched"
            draw.text((x, y + 231), f"{variant} / {item['clip']} / {time}", font=font, fill="#303b37")
    temporary = output.with_name(output.name + ".partial")
    sheet.save(temporary, format="PNG")
    temporary.rename(output)
    print(f"Contact sheet created from {len(rows) * 2} browser captures")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--animal", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    contact(args.report, args.animal, args.output)
