"""Single bounded train/validation comparison CLI. No test reads or serialization."""

import argparse
import json
import sys
import warnings
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.exceptions import ConvergenceWarning
from sklearn.linear_model import LogisticRegression
from threadpoolctl import threadpool_limits

from scripts.data.contract import outside_repository
from scripts.data.preparation import sha256
from scripts.model.comparison_evidence import validate_evidence
from scripts.model.comparison_inputs import ROOT, environment, git, load_inputs
from scripts.model.evaluate_predictions import relative_comparison, report
from scripts.model.evaluation_rules import CONFIG, config_digest
from scripts.model.preprocessing import make_preprocessor


def model_factories():
    return {
        "logistic_regression": LogisticRegression(random_state=CONFIG["seed"], **CONFIG["logistic_regression"]),
        "histogram_gradient_boosting": HistGradientBoostingClassifier(
            random_state=CONFIG["seed"], **CONFIG["histogram_gradient_boosting"]
        ),
    }


def fit_predictions(manifest, frames, fills):
    features, label = manifest["candidate_predictors"], manifest["label"]["name"]
    preprocess = make_preprocessor(manifest, fills)
    train = preprocess.fit_transform(frames["train"][features])
    validation = preprocess.transform(frames["validation"][features])
    predictions = {}
    with threadpool_limits(limits=CONFIG["threads"]), warnings.catch_warnings():
        warnings.simplefilter("error", ConvergenceWarning)
        warnings.simplefilter("error", RuntimeWarning)
        for name, model in model_factories().items():
            model.fit(train.copy(), frames["train"][label].to_numpy(copy=True))
            if list(model.classes_) != [0, 1]:
                raise ValueError("invalid_model_classes")
            probability = model.predict_proba(validation.copy())
            if probability.shape != (len(validation), 2):
                raise ValueError("invalid_probability_shape")
            if (
                not np.isfinite(probability).all()
                or not np.allclose(probability.sum(axis=1), 1)
                or ((probability < 0) | (probability > 1)).any()
            ):
                raise ValueError("invalid_probability")
            predictions[name] = probability[:, 1].copy()
    return predictions


def fit_reports(manifest, frames, fills):
    predictions = fit_predictions(manifest, frames, fills)
    return {
        name: report(frames["validation"], values, manifest["label"]["name"]) for name, values in predictions.items()
    }


def run(split_dir, output):
    environment()
    if git("status", "--porcelain", "--untracked-files=all"):
        raise ValueError("dirty_checkout")
    commit = git("rev-parse", "HEAD")
    split_dir, output = outside_repository(split_dir), outside_repository(output)
    if output.exists() or output == split_dir or output in split_dir.parents or split_dir in output.parents:
        raise ValueError("output_exists_or_overlaps")
    manifest, frames, fills, provenance = load_inputs(split_dir)
    output.mkdir(parents=True, exist_ok=False)
    stage = "fit_and_validation"
    try:
        reports = fit_reports(manifest, frames, fills)
        stage = "input_stability"
        _, _, _, final_provenance = load_inputs(split_dir)
        if (
            final_provenance != provenance
            or git("rev-parse", "HEAD") != commit
            or git("status", "--porcelain", "--untracked-files=all")
        ):
            raise ValueError("inputs_or_checkout_changed")
        evidence = {
            "schema_version": 1,
            "status": "validation_compared_not_promoted",
            "execution_commit": commit,
            "provenance": provenance,
            "config": CONFIG,
            "config_sha256": config_digest(),
            "models": reports,
            "relative_comparison": relative_comparison(reports),
            "test_used": False,
            "release_approved": False,
        }
        stage = "evidence_validation"
        gate = json.loads((ROOT / "docs/evidence/model-gate-1b.json").read_text(encoding="utf-8"))
        validate_evidence(evidence, gate, manifest, sha256(ROOT / "uv.lock"))
        stage = "evidence_write"
        with (output / "comparison-evidence.json").open("x", encoding="utf-8") as stream:
            stream.write(json.dumps(evidence, indent=2, allow_nan=False) + "\n")
    except Exception as error:
        reason = "convergence_warning" if isinstance(error, ConvergenceWarning) else "comparison_failed"
        (output / "failure.json").write_text(
            json.dumps({"status": "failed", "stage": stage, "reason": reason}), encoding="utf-8"
        )
        raise RuntimeError(reason) from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split-dir", required=True, type=Path)
    parser.add_argument("--work-dir", required=True, type=Path)
    args = parser.parse_args()
    try:
        run(args.split_dir, args.work_dir)
    except Exception as error:
        safe_reasons = {
            "convergence_warning",
            "comparison_failed",
            "dirty_checkout",
            "python_mismatch",
            "environment_mismatch",
            "output_exists_or_overlaps",
            "gate_evidence_mismatch",
            "metadata_mismatch",
            "input_hash_mismatch",
            "columns_or_count_mismatch",
            "invalid_label",
            "invalid_feature",
            "partition_overlap",
            "single_class_train",
            "training_fill_mismatch",
        }
        reason = str(error) if str(error) in safe_reasons else "preflight_or_comparison_failed"
        print("Comparison stopped: " + reason + "; existing results preserved", file=sys.stderr)
        return 1
    print("Validation comparison complete; human aggregate review required; no promotion")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
