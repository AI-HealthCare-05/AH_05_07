"""Check a local aggregate comparison candidate before human review."""

import argparse
import json
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.ci.verify_model_gate_1b_contract import evidence_findings, repository_alignment_findings
from scripts.data.contract import ROOT, load_manifest
from scripts.data.preparation import sha256
from scripts.model.comparison_evidence import validate_evidence


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", required=True, type=Path)
    args = parser.parse_args()
    try:
        gate = json.loads((ROOT / "docs/evidence/model-gate-1b.json").read_text(encoding="utf-8"))
        if evidence_findings(gate) or repository_alignment_findings(gate, ROOT):
            raise ValueError("gate_mismatch")
        validate_evidence(
            json.loads(args.evidence.read_text(encoding="utf-8")), gate, load_manifest(), sha256(ROOT / "uv.lock")
        )
    except Exception:
        print("Comparison evidence verification failed")
        return 1
    print("Comparison evidence verification passed; human review remains required")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
