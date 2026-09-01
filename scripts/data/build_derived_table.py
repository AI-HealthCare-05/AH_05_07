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


def load(module: str, columns: list[str]) -> pd.DataFrame:
    path = args.raw_dir / files[module]
    frame = pd.read_sas(path, format="xport", encoding="utf-8")
    return frame.loc[:, columns]


bp_columns = manifest["label"]["prohibited_predictors"]
bp = load("blood_pressure", [key, *bp_columns])
label = (
    (bp[["BPXSY1", "BPXSY2", "BPXSY3"]].mean(axis=1) >= 130) | (bp[["BPXDI1", "BPXDI2", "BPXDI3"]].mean(axis=1) >= 80)
).astype("int8")
table = pd.DataFrame({key: bp[key], manifest["label"]["name"]: label})

sources = {
    "demographics": ["RIAGENDR", "RIDAGEYR"],
    "body_measures": ["BMXBMI"],
    "physical_activity": ["PAQ605", "PAQ620"],
    "smoking": ["SMQ020"],
    "alcohol": ["ALQ101"],
    "sleep": ["SLD012"],
}
for module, columns in sources.items():
    table = table.merge(load(module, [key, *columns]), on=key, how="inner", validate="one_to_one")

assert not set(bp_columns) & set(table.columns)
assert set(manifest["candidate_predictors"]) <= set(table.columns)
args.output.parent.mkdir(parents=True, exist_ok=True)
table.to_parquet(args.output, index=False)
print(f"derived rows: {len(table)}")
