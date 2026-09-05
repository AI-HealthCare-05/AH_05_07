"""Validate aggregate uncertainty structure and arithmetic, not private predictions."""

import argparse
import json
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.model.uncertainty_evidence import validate_uncertainty
from scripts.model.validation_uncertainty import load_reference


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, required=True)
    args = parser.parse_args()
    try:
        validate_uncertainty(json.loads(args.evidence.read_text(encoding="utf-8")), load_reference())
    except Exception:
        print("Uncertainty evidence validation failed")
        return 1
    print("Uncertainty evidence structure/arithmetic passed; human review required")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
