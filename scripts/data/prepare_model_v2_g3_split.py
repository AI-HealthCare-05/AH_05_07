#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd
import pyreadstat

SPLIT_NAMESPACE = "SK7-V2-G3-20260907"
SOURCE_NAME = "hn24_all.sas7bdat"
EXPECTED_SOURCE_SHA256 = "ff74cb84432cb1f10ba63d1a3aba54215ef38e47afef29547f83127aea9fc47f"

RAW_COLUMNS = [
    "ID",
    "age",
    "sex",
    "HE_prg",
    "HE_HP",
    "HE_ht",
    "HE_wt",
    "BS1_1",
    "BS3_1",
    "BD1_11",
    "BD2_1",
    "BE3_31",
    "BE3_32",
    "BE3_33",
    "BE5_1",
    "BP16_11",
    "BP16_12",
    "BP16_13",
    "BP16_14",
    "BP16_21",
    "BP16_22",
    "BP16_23",
    "BP16_24",
    "wt_itvex",
    "kstrata",
    "psu",
]

FEATURE_COLUMNS = [
    "age_years",
    "sex_knhanes",
    "bmi_from_height_weight",
    "cigarette_smoking_state",
    "alcohol_frequency",
    "alcohol_amount_category",
    "walking_days_7d",
    "walking_minutes_per_active_day",
    "strength_days_7d",
    "weekday_sleep_minutes",
    "weekend_sleep_minutes",
]

OUTPUT_COLUMNS = ["ID", "v2_hypertension_state", *FEATURE_COLUMNS, "wt_itvex", "kstrata", "psu"]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def find_source(root: Path) -> Path:
    candidates = sorted(p.resolve() for p in (root / "raw").rglob(SOURCE_NAME) if p.is_file())
    if not candidates:
        raise SystemExit(f"STOP: {SOURCE_NAME} not found")
    hashes = {sha256(p) for p in candidates}
    if len(hashes) != 1:
        raise SystemExit("STOP: multiple non-identical source files")
    source = candidates[0]
    actual = sha256(source)
    if actual != EXPECTED_SOURCE_SHA256:
        raise SystemExit(f"STOP: source hash mismatch: {actual}")
    return source


def num(s: pd.Series) -> pd.Series:
    return pd.to_numeric(s, errors="coerce")


def derive_bmi(h: pd.Series, w: pd.Series) -> pd.Series:
    h, w = num(h), num(w)
    out = pd.Series(float("nan"), index=h.index)
    ok = (h > 0) & (w > 0)
    out.loc[ok] = w.loc[ok] / ((h.loc[ok] / 100.0) ** 2)
    return out


def derive_smoking(bs1: pd.Series, bs3: pd.Series) -> pd.Series:
    lifetime = num(bs1)
    current = num(bs3)
    out = pd.Series(pd.NA, index=lifetime.index, dtype="string")

    out.loc[current == 1] = "daily_current"
    out.loc[current == 2] = "occasional_current"
    out.loc[current == 3] = "former_currently_not_smoking"

    # Official code: BS1_1=3 means "피운 적 없음".
    # BS1_1=1 means <100 lifetime cigarettes, so it is NOT a never-smoker code.
    out.loc[out.isna() & (lifetime == 3)] = "never_smoked"

    # 8/9 and unresolved branching remain missing.
    return out


def derive_alcohol_frequency(s: pd.Series) -> pd.Series:
    s = num(s)
    out = pd.Series(pd.NA, index=s.index, dtype="string")
    labels = {
        1: "none_past_year",
        2: "lt_monthly",
        3: "monthly_once",
        4: "monthly_2_4",
        5: "weekly_2_3",
        6: "weekly_4_plus",
        8: "lifetime_nonapplicable",
    }
    for code, label in labels.items():
        out.loc[s == code] = label
    return out


def derive_alcohol_amount(freq: pd.Series, amount: pd.Series) -> pd.Series:
    f, a = num(freq), num(amount)
    out = pd.Series(pd.NA, index=f.index, dtype="string")
    labels = {1: "1_2_drinks", 2: "3_4_drinks", 3: "5_6_drinks", 4: "7_9_drinks", 5: "10_plus_drinks"}
    for code, label in labels.items():
        out.loc[a == code] = label
    out.loc[f.isin([1, 8])] = "none"
    return out


def derive_walk_days(s: pd.Series) -> pd.Series:
    s = num(s)
    out = pd.Series(float("nan"), index=s.index)
    for code in range(1, 9):
        out.loc[s == code] = float(code - 1)
    return out


def derive_walk_minutes(days: pd.Series, hours: pd.Series, minutes: pd.Series) -> pd.Series:
    d, h, m = num(days), num(hours), num(minutes)
    h = h.mask(h.isin([88, 99]))
    m = m.mask(m.isin([88, 99]))
    out = pd.Series(float("nan"), index=d.index)
    out.loc[d == 1] = 0.0
    ok = d.isin(range(2, 9)) & h.notna() & m.notna() & (h >= 0) & m.between(0, 59)
    out.loc[ok] = h.loc[ok] * 60.0 + m.loc[ok]
    return out


def derive_strength(s: pd.Series) -> pd.Series:
    s = num(s)
    out = pd.Series(pd.NA, index=s.index, dtype="string")
    mapping = {
        1: "0_days",
        2: "1_day",
        3: "2_days",
        4: "3_days",
        5: "4_days",
        6: "5_plus_days",
    }
    for code, value in mapping.items():
        out.loc[s == code] = value
    return out


def derive_sleep(
    bed_hour: pd.Series,
    bed_minute: pd.Series,
    wake_hour: pd.Series,
    wake_minute: pd.Series,
) -> pd.Series:
    bh = num(bed_hour)
    bm = num(bed_minute)
    wh = num(wake_hour)
    wm = num(wake_minute)

    bh = bh.mask(bh.isin([88, 99]))
    bm = bm.mask(bm.isin([88, 99]))
    wh = wh.mask(wh.isin([88, 99]))
    wm = wm.mask(wm.isin([88, 99]))

    valid = bh.between(0, 24) & bm.between(0, 59) & wh.between(0, 24) & wm.between(0, 59)

    # Mirror the official Cycle 9 SAS clock adjustment.
    bh_adjusted = bh.where(~bh.between(1, 12), bh + 24)
    wh_adjusted = wh.where(~wh.between(1, 12), wh + 24)

    bed_minutes = bh_adjusted * 60 + bm
    wake_minutes = wh_adjusted * 60 + wm
    duration = wake_minutes - bed_minutes
    duration = duration.where(duration >= 0, duration + 1440)

    return duration.where(valid)


def role_for(kstrata, psu) -> str:
    raw = f"{SPLIT_NAMESPACE}|{kstrata}|{psu}".encode()
    u = int(hashlib.sha256(raw).hexdigest()[:16], 16) / float(16**16)
    if u < 0.70:
        return "development"
    if u < 0.85:
        return "validation"
    return "final_test"


def reset_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def write_role(df: pd.DataFrame, path: Path, locked: bool) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path, index=False)
    os.chmod(path, 0o400 if locked else 0o600)
    return {"rows": int(len(df)), "sha256": sha256(path), "locked": locked}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=Path, required=True)
    args = ap.parse_args()

    g2_root = args.root.expanduser().resolve()
    source = find_source(g2_root)
    out_root = g2_root.parent.parent / "model-v2-g3" / "knhanes-2024"

    dev_dir = out_root / "development"
    val_dir = out_root / "locked-validation"
    test_dir = out_root / "locked-final-test"
    audit_dir = out_root / "audit"
    for d in (dev_dir, val_dir, test_dir, audit_dir):
        reset_dir(d)

    df, _ = pyreadstat.read_sas7bdat(str(source), usecols=RAW_COLUMNS)
    if df["ID"].isna().any() or df["ID"].duplicated().any():
        raise SystemExit("STOP: invalid participant IDs")

    age, hp, wt, prg = num(df["age"]), num(df["HE_HP"]), num(df["wt_itvex"]), num(df["HE_prg"])
    eligible = (
        (age >= 19)
        & hp.isin([1, 2, 3, 4])
        & df["kstrata"].notna()
        & df["psu"].notna()
        & wt.notna()
        & (wt > 0)
        & (prg != 1)
    )
    c = df.loc[eligible].copy()
    if c.empty:
        raise SystemExit("STOP: empty G3 cohort")

    out = pd.DataFrame(index=c.index)
    out["ID"] = c["ID"].astype(str)
    out["v2_hypertension_state"] = (num(c["HE_HP"]) == 4).astype("int8")
    out["age_years"] = num(c["age"])
    out["sex_knhanes"] = num(c["sex"]).where(num(c["sex"]).isin([1, 2]))
    out["bmi_from_height_weight"] = derive_bmi(c["HE_ht"], c["HE_wt"])
    out["cigarette_smoking_state"] = derive_smoking(c["BS1_1"], c["BS3_1"])
    out["alcohol_frequency"] = derive_alcohol_frequency(c["BD1_11"])
    out["alcohol_amount_category"] = derive_alcohol_amount(c["BD1_11"], c["BD2_1"])
    out["walking_days_7d"] = derive_walk_days(c["BE3_31"])
    out["walking_minutes_per_active_day"] = derive_walk_minutes(c["BE3_31"], c["BE3_32"], c["BE3_33"])
    out["strength_days_7d"] = derive_strength(c["BE5_1"])
    out["weekday_sleep_minutes"] = derive_sleep(c["BP16_11"], c["BP16_12"], c["BP16_13"], c["BP16_14"])
    out["weekend_sleep_minutes"] = derive_sleep(c["BP16_21"], c["BP16_22"], c["BP16_23"], c["BP16_24"])
    out["wt_itvex"] = num(c["wt_itvex"])
    out["kstrata"] = c["kstrata"]
    out["psu"] = c["psu"]
    out["role"] = [role_for(k, p) for k, p in zip(out["kstrata"], out["psu"], strict=True)]

    if out.groupby(["kstrata", "psu"])["role"].nunique().max() != 1:
        raise SystemExit("STOP: PSU crosses split roles")

    parts = {r: out.loc[out["role"] == r, OUTPUT_COLUMNS].copy() for r in ("development", "validation", "final_test")}
    if any(x.empty for x in parts.values()):
        raise SystemExit("STOP: empty role")

    dev_meta = write_role(parts["development"], dev_dir / "development.parquet", False)
    val_meta = write_role(parts["validation"], val_dir / "validation.parquet", True)
    test_meta = write_role(parts["final_test"], test_dir / "final-test.parquet", True)

    (val_dir / "DO_NOT_OPEN_UNTIL_G6.txt").write_text("Validation locked until G6 approval.\n", encoding="utf-8")
    (test_dir / "DO_NOT_OPEN_UNTIL_G8.txt").write_text(
        "Final internal test locked until explicit G8 approval.\n", encoding="utf-8"
    )

    manifest = {
        "gate": "Model V2 G3",
        "created_at_utc": datetime.now(UTC).isoformat(),
        "source": {"file": source.name, "sha256": sha256(source)},
        "split_namespace": SPLIT_NAMESPACE,
        "split_unit": ["kstrata", "psu"],
        "role_rows": {r: int(len(x)) for r, x in parts.items()},
        "role_cluster_counts": {r: int(x[["kstrata", "psu"]].drop_duplicates().shape[0]) for r, x in parts.items()},
        "files": {"development": dev_meta, "validation": val_meta, "final_test": test_meta},
        "development_feature_missingness_only": {
            col: {
                "missing": int(parts["development"][col].isna().sum()),
                "non_missing": int(parts["development"][col].notna().sum()),
            }
            for col in FEATURE_COLUMNS
        },
        "safety": {
            "participant_ids_in_manifest": False,
            "validation_target_distribution_written": False,
            "final_test_target_distribution_written": False,
            "model_fitting_performed": False,
            "performance_metrics_computed": False,
            "validation_performance_accessed": False,
            "final_test_performance_accessed": False,
        },
    }
    mpath = audit_dir / "g3-split-manifest.json"
    mpath.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=== Model V2 G3 cohort/split preparation ===")
    print("source rows:", len(df))
    print("eligible cohort:", len(c))
    print("development:", len(parts["development"]))
    print("validation:", len(parts["validation"]), "(LOCKED)")
    print("final_test:", len(parts["final_test"]), "(LOCKED)")
    print("manifest:", mpath)
    print("model fitting: False")
    print("performance metrics: False")
    print("validation performance accessed: False")
    print("final-test performance accessed: False")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
