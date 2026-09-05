"""Paired row bootstrap, using only in-memory labels and probabilities."""

import numpy as np

from scripts.model.evaluate_predictions import available, check_predictions, metrics, unavailable
from scripts.model.uncertainty_rules import METRICS
from scripts.model.uncertainty_rules import UNCERTAINTY_CONFIG as RULES


def scores(y, probability):
    """Tie-aware AUROC/AP and Brier; tests compare with locked sklearn."""
    brier = float(np.mean((y - probability) ** 2))
    positive = y.sum()
    negative = len(y) - positive
    if not positive or not negative:
        return np.array([np.nan, np.nan, brier])
    order = np.argsort(-probability, kind="stable")
    sorted_y, sorted_p = y[order], probability[order]
    ends = np.flatnonzero(np.r_[sorted_p[1:] != sorted_p[:-1], True])
    tp = np.cumsum(sorted_y)[ends]
    fp = (ends + 1) - tp
    recall = tp / positive
    auroc = np.trapezoid(np.r_[0, recall], np.r_[0, fp / negative])
    ap = np.sum(np.diff(np.r_[0, recall]) * tp / (ends + 1))
    return np.array([auroc, ap, brier])


def difference_point(lr, hgb):
    if lr["status"] != "ok":
        return unavailable(lr["reason"])
    if hgb["status"] != "ok":
        return unavailable(hgb["reason"])
    return available(hgb["value"] - lr["value"])


def summarize_draws(points, draws, rows):
    """draws axes: replicate, model (LR/HGB), metric; arrays never serialized."""
    result = {}
    attempted = len(draws)
    for index, name in enumerate(METRICS):
        lr, hgb = points[0][name], points[1][name]
        difference = difference_point(lr, hgb)
        paired = draws[:, :, index]
        valid = np.isfinite(paired).all(axis=1) & np.isfinite(paired[:, 1] - paired[:, 0])
        count = int(valid.sum())
        reason = None
        if rows < RULES["minimum_report_rows"]:
            reason = "empty_group" if rows == 0 else "insufficient_rows"
        elif difference["status"] != "ok":
            reason = difference["reason"]
        elif count < RULES["minimum_valid_replicates"]:
            reason = "insufficient_valid_replicates"
        limits = {"lr": None, "hgb": None, "difference": None}
        if reason is None:
            values = paired[valid]
            for key, vector in (
                ("lr", values[:, 0]),
                ("hgb", values[:, 1]),
                ("difference", values[:, 1] - values[:, 0]),
            ):
                limits[key] = np.quantile(vector, RULES["quantiles"], method=RULES["quantile_method"]).tolist()
        result[name] = {
            "point": {"lr": lr, "hgb": hgb, "difference": difference},
            "interval": {
                "status": "ok" if reason is None else "unavailable",
                "reason": reason,
                "valid_replicates": count,
                "invalid_replicates": attempted - count,
                **limits,
            },
        }
    return {"rows": rows, "attempted_replicates": attempted, "metrics": result}


def bootstrap_group(y, lr, hgb):
    y, lr = check_predictions(y, lr)
    _, hgb = check_predictions(y, hgb)
    points = (metrics(y, lr), metrics(y, hgb))
    n = len(y)
    draws = np.empty((0, 2, 3))
    if n >= RULES["minimum_report_rows"]:
        rng = np.random.Generator(np.random.PCG64(RULES["seed"]))
        draws = np.empty((RULES["replicates"], 2, 3))
        for index in range(RULES["replicates"]):
            rows = rng.integers(0, n, size=n)
            draws[index, 0] = scores(y[rows], lr[rows])
            draws[index, 1] = scores(y[rows], hgb[rows])
    return summarize_draws(points, draws, n)


def bootstrap_reports(frame, predictions, label):
    masks = {
        "overall": np.ones(len(frame), dtype=bool),
        "sex_1": frame.RIAGENDR == 1,
        "sex_2": frame.RIAGENDR == 2,
        "sex_missing": frame.RIAGENDR == -1,
        "age_18_39": frame.RIDAGEYR.between(18, 39),
        "age_40_59": frame.RIDAGEYR.between(40, 59),
        "age_60_80": frame.RIDAGEYR.between(60, 80),
    }
    y = frame[label].to_numpy()
    return {
        name: bootstrap_group(
            y[mask], predictions["logistic_regression"][mask], predictions["histogram_gradient_boosting"][mask]
        )
        for name, mask in masks.items()
    }
