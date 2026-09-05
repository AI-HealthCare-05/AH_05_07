"""Aggregate validation metrics; individual material stays local."""

if __name__ == "__main__":
    raise SystemExit("Use scripts/model/compare_baselines.py for verified frozen-input evaluation")

import numpy as np
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score

from scripts.model.evaluation_rules import CONFIG


def unavailable(reason):
    return {"status": "unavailable", "reason": reason, "value": None}


def available(value):
    if not np.isfinite(value):
        return unavailable("nonfinite_metric")
    return {"status": "ok", "reason": None, "value": float(value)}


def check_predictions(y, probability):
    y, probability = np.asarray(y), np.asarray(probability)
    if (
        y.ndim != 1
        or probability.shape != y.shape
        or not np.isin(y, [0, 1]).all()
        or not np.isfinite(probability).all()
        or ((probability < 0) | (probability > 1)).any()
    ):
        raise ValueError("invalid_predictions")
    return y, probability


def metrics(y, probability):
    y, probability = check_predictions(y, probability)
    reason = "empty_group" if len(y) == 0 else "insufficient_rows"
    result = {"rows": len(y)}
    if len(y) < CONFIG["minimum_report_rows"]:
        return {**result, **{key: unavailable(reason) for key in ("auroc", "pr_auc", "brier")}}
    result["brier"] = available(brier_score_loss(y, probability))
    for name, function in (("auroc", roc_auc_score), ("pr_auc", average_precision_score)):
        result[name] = unavailable("single_class") if len(np.unique(y)) < 2 else available(function(y, probability))
    return result


def calibration(y, probability):
    y, probability = check_predictions(y, probability)
    bins = CONFIG["calibration_bins"]
    indices = np.minimum((probability * bins).astype(int), bins - 1)
    result = []
    for index in range(bins):
        mask = indices == index
        count = int(mask.sum())
        reason = "empty_bin" if count == 0 else "insufficient_rows"
        result.append(
            {
                "bin": index,
                "rows": count,
                "observed": available(y[mask].mean())
                if count >= CONFIG["minimum_report_rows"]
                else unavailable(reason),
                "predicted": available(probability[mask].mean())
                if count >= CONFIG["minimum_report_rows"]
                else unavailable(reason),
            }
        )
    return result


def report(frame, probability, label):
    y, probability = check_predictions(frame[label].to_numpy(), probability)
    masks = {
        "sex_1": frame.RIAGENDR == 1,
        "sex_2": frame.RIAGENDR == 2,
        "sex_missing": frame.RIAGENDR == -1,
        "age_18_39": frame.RIDAGEYR.between(18, 39),
        "age_40_59": frame.RIDAGEYR.between(40, 59),
        "age_60_80": frame.RIDAGEYR.between(60, 80),
    }
    return {
        "overall": metrics(y, probability),
        "calibration": calibration(y, probability),
        "subgroups": {name: metrics(y[mask], probability[mask]) for name, mask in masks.items()},
    }


def relative_comparison(reports):
    baseline = reports["logistic_regression"]["overall"]
    candidate = reports["histogram_gradient_boosting"]["overall"]
    if any(model[key]["status"] != "ok" for model in (baseline, candidate) for key in ("auroc", "pr_auc", "brier")):
        return "not_computable"
    passes = (
        candidate["pr_auc"]["value"] > baseline["pr_auc"]["value"]
        and candidate["brier"]["value"] <= baseline["brier"]["value"]
        and candidate["auroc"]["value"] >= baseline["auroc"]["value"]
    )
    return "candidate_meets_relative_conditions" if passes else "retain_logistic_baseline"
