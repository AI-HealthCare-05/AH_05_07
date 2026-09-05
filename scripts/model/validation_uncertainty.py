"""Future actual execution entry: fixed refit, reproduction gate, paired bootstrap."""

import argparse
import json
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.ci.verify_model_gate_1b_contract import evidence_findings, repository_alignment_findings
from scripts.data.contract import load_manifest, outside_repository
from scripts.data.preparation import sha256
from scripts.model.compare_baselines import fit_predictions
from scripts.model.comparison_evidence import canonical_digest, validate_evidence
from scripts.model.comparison_inputs import ROOT, environment, git, load_inputs
from scripts.model.evaluate_predictions import relative_comparison, report
from scripts.model.evaluation_rules import config_digest
from scripts.model.paired_bootstrap import bootstrap_reports
from scripts.model.uncertainty_evidence import same_result, validate_uncertainty
from scripts.model.uncertainty_rules import UNCERTAINTY_CONFIG, uncertainty_digest


def load_reference():
    reference = json.loads((ROOT / "docs/evidence/model-comparison.json").read_text(encoding="utf-8"))
    gate = json.loads((ROOT / "docs/evidence/model-gate-1b.json").read_text(encoding="utf-8"))
    if evidence_findings(gate) or repository_alignment_findings(gate, ROOT):
        raise ValueError("gate_mismatch")
    validate_evidence(reference, gate, load_manifest(), sha256(ROOT / "uv.lock"))
    return reference


def reproduce(manifest, frames, fills, reference):
    predictions = fit_predictions(manifest, frames, fills)
    reports = {
        name: report(frames["validation"], values, manifest["label"]["name"]) for name, values in predictions.items()
    }
    try:
        same_result(reports, reference["models"])
        same_result(relative_comparison(reports), reference["relative_comparison"])
    except ValueError:
        raise ValueError("point_reproduction_mismatch") from None
    return predictions


def run(split_dir, output):
    environment()
    if git("status", "--porcelain", "--untracked-files=all"):
        raise ValueError("dirty_checkout")
    commit = git("rev-parse", "HEAD")
    original_config, new_config = config_digest(), uncertainty_digest()
    reference = load_reference()
    split_dir, output = outside_repository(split_dir), outside_repository(output)
    if output.exists() or output == split_dir or output in split_dir.parents or split_dir in output.parents:
        raise ValueError("output_exists_or_overlaps")
    manifest, frames, fills, provenance = load_inputs(split_dir)
    if provenance != reference["provenance"]:
        raise ValueError("provenance_mismatch")
    output.mkdir(parents=True, exist_ok=False)
    stage = "refit_and_reproduction"
    try:
        predictions = reproduce(manifest, frames, fills, reference)
        stage = "bootstrap"
        groups = bootstrap_reports(frames["validation"], predictions, manifest["label"]["name"])
        stage = "stability"
        _, _, _, final_provenance = load_inputs(split_dir)
        if (
            final_provenance != provenance
            or load_reference() != reference
            or config_digest() != original_config
            or uncertainty_digest() != new_config
            or git("rev-parse", "HEAD") != commit
            or git("status", "--porcelain", "--untracked-files=all")
        ):
            raise ValueError("execution_changed")
        evidence = {
            "schema_version": 1,
            "status": "exploratory_uncertainty_not_promoted",
            "original_comparison_sha256": canonical_digest(reference),
            "original_execution_commit": reference["execution_commit"],
            "execution_commit": commit,
            "provenance": provenance,
            "comparison_config_sha256": original_config,
            "uncertainty_config": UNCERTAINTY_CONFIG,
            "uncertainty_config_sha256": new_config,
            "reproduction": {"status": "passed", "scope": UNCERTAINTY_CONFIG["reproduction_scope"]},
            "groups": groups,
            "test_used": False,
            "release_approved": False,
        }
        stage = "evidence"
        validate_uncertainty(evidence, reference)
        with (output / "uncertainty-evidence.json").open("x", encoding="utf-8") as stream:
            stream.write(json.dumps(evidence, indent=2, allow_nan=False) + "\n")
    except Exception as error:
        reason = "point_reproduction_mismatch" if str(error) == "point_reproduction_mismatch" else "stage_failed"
        (output / "failure.json").write_text(
            json.dumps({"status": "failed", "stage": stage, "reason": reason}), encoding="utf-8"
        )
        raise RuntimeError(stage) from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split-dir", type=Path, required=True)
    parser.add_argument("--work-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        run(args.split_dir, args.work_dir)
    except Exception as error:
        stage = (
            str(error)
            if str(error) in {"refit_and_reproduction", "bootstrap", "stability", "evidence"}
            else "preflight"
        )
        print("Uncertainty stopped at " + stage + "; results preserved", file=sys.stderr)
        return 1
    print("Exploratory uncertainty complete; human review required; no promotion")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
