"""Build a local, leakage-checked NHANES training table."""

import argparse
import json
from pathlib import Path

import pandas as pd

parser = argparse.ArgumentParser()
parser.add_argument("raw_dir", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()

manifest = json.loads(Path("data/manifest/nhanes_2017_2020.json").read_text(encoding="utf-8"))
key = manifest["join_key"]
files = manifest["files"]
module_columns = manifest["module_columns"]


def load(module: str, columns: list[str]) -> pd.DataFrame:
    path = args.raw_dir / files[module]
    frame = pd.read_sas(path, format="xport", encoding="utf-8")
    return frame.loc[:, columns]


bp_columns = manifest["label"]["prohibited_predictors"]
assert set(module_columns["blood_pressure"]) == set(bp_columns)
bp = load("blood_pressure", [key, *bp_columns])
systolic_columns = sorted(column for column in bp_columns if column.startswith("BPXOSY"))
diastolic_columns = sorted(column for column in bp_columns if column.startswith("BPXODI"))
assert len(systolic_columns) == 3
assert len(diastolic_columns) == 3
label = ((bp[systolic_columns].mean(axis=1) >= 130) | (bp[diastolic_columns].mean(axis=1) >= 80)).astype("int8")
table = pd.DataFrame({key: bp[key], manifest["label"]["name"]: label})

sources = {module: columns for module, columns in module_columns.items() if module != "blood_pressure"}
for module, columns in sources.items():
    table = table.merge(load(module, [key, *columns]), on=key, how="inner", validate="one_to_one")

assert not set(bp_columns) & set(table.columns)
assert set(manifest["candidate_predictors"]) <= set(table.columns)
args.output.parent.mkdir(parents=True, exist_ok=True)
table.to_parquet(args.output, index=False)
print(f"derived rows: {len(table)}")
