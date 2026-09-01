"""Audit locally downloaded NHANES files against the committed manifest."""

import argparse
import json
from pathlib import Path


def read_columns(path: Path) -> set[str]:
    if path.suffix.lower() == ".csv":
        return set(path.read_text(encoding="utf-8").splitlines()[0].split(","))

    try:
        import pandas as pd
    except ImportError as error:
        raise SystemExit(
            "XPT audit needs pandas; use a local CSV export or install the ai dependency group."
        ) from error

    return set(pd.read_sas(path, format="xport", encoding="utf-8", chunksize=1).read(1).columns)


parser = argparse.ArgumentParser()
parser.add_argument("raw_dir", type=Path)
args = parser.parse_args()

manifest = json.loads(Path("data/manifest/nhanes_2017_2020.json").read_text(encoding="utf-8"))
required = {
    "demographics": {"SEQN", "RIAGENDR", "RIDAGEYR"},
    "body_measures": {"SEQN", "BMXBMI"},
    "blood_pressure": {"SEQN", *manifest["label"]["prohibited_predictors"]},
}

missing_files: list[str] = []
for module, fields in required.items():
    filename = manifest["files"][module]
    path = args.raw_dir / filename
    if not path.exists():
        missing_files.append(filename)
        continue
    missing = fields - read_columns(path)
    assert not missing, f"{filename}: missing {sorted(missing)}"

assert not missing_files, f"missing files: {missing_files}"
print("schema audit: passed")
