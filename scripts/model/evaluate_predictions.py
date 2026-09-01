"""Write calibration and subgroup summaries for one local validation prediction file."""

import argparse
import json
from pathlib import Path

import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score

parser = argparse.ArgumentParser()
parser.add_argument("predictions", type=Path)
parser.add_argument("result", type=Path)
args = parser.parse_args()

frame = pd.read_parquet(args.predictions)
required = {"hypertension_risk_group", "prediction", "RIAGENDR", "RIDAGEYR"}
assert required <= set(frame.columns), f"missing: {sorted(required - set(frame.columns))}"


def metrics(rows: pd.DataFrame) -> dict[str, float | int]:
    return {
        "rows": len(rows),
        "auroc": roc_auc_score(rows.hypertension_risk_group, rows.prediction),
        "pr_auc": average_precision_score(rows.hypertension_risk_group, rows.prediction),
        "brier": brier_score_loss(rows.hypertension_risk_group, rows.prediction),
    }


frame["age_band"] = pd.cut(frame.RIDAGEYR, bins=[0, 39, 59, 150], labels=["18-39", "40-59", "60+"])
observed, predicted = calibration_curve(frame.hypertension_risk_group, frame.prediction, n_bins=10)
report = {
    "overall": metrics(frame),
    "calibration": [
        {"observed": float(item[0]), "predicted": float(item[1])} for item in zip(observed, predicted, strict=True)
    ],
    "subgroups": {},
}
for column in ("RIAGENDR", "age_band"):
    report["subgroups"][column] = {
        str(value): metrics(rows)
        for value, rows in frame.groupby(column, observed=True)
        if rows.hypertension_risk_group.nunique() == 2
    }

args.result.write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
