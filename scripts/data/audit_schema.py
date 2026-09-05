"""Audit locally downloaded NHANES files against the committed manifest."""

import argparse
from pathlib import Path

from contract import load_manifest, outside_repository


def read_columns(path: Path) -> set[str]:
    if path.suffix.lower() == ".csv":
        return set(path.read_text(encoding="utf-8").splitlines()[0].split(","))

    try:
        import pandas as pd
    except ImportError as error:
        raise SystemExit(
            "XPT audit needs pandas; use a local CSV export or install the ai dependency group."
        ) from error

    with pd.read_sas(path, format="xport", encoding="utf-8", chunksize=1) as reader:
        return set(reader.read(1).columns)


parser = argparse.ArgumentParser()
parser.add_argument("raw_dir", type=Path)
args = parser.parse_args()

manifest = load_manifest()
args.raw_dir = outside_repository(args.raw_dir)
join_key = manifest["join_key"]
required = {module: {join_key, *columns} for module, columns in manifest["module_columns"].items()}

missing_files: list[str] = []
for module, fields in required.items():
    filename = manifest["files"][module]
    path = args.raw_dir / filename
    if not path.exists():
        missing_files.append(filename)
        continue
    missing = fields - read_columns(path)
    if missing:
        raise ValueError(f"{filename}: missing required columns")

if missing_files:
    raise ValueError(f"missing files: {missing_files}")
print("schema audit: passed")
