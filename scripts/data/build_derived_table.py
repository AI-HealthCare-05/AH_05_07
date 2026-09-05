"""Build a local, leakage-checked NHANES training table."""

import argparse

from contract import load_manifest, outside_repository
from preparation import derive_table, load_modules


def main() -> None:
    from pathlib import Path

    parser = argparse.ArgumentParser()
    parser.add_argument("raw_dir", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    raw_dir, output = outside_repository(args.raw_dir), outside_repository(args.output)
    if output.exists():
        raise ValueError("output already exists; choose a new work directory")
    manifest = load_manifest()
    table = derive_table(load_modules(raw_dir, manifest), manifest)
    output.parent.mkdir(parents=True, exist_ok=True)
    table.to_parquet(output, index=False)
    print("derived table: passed")


if __name__ == "__main__":
    main()
