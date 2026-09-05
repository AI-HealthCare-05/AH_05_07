"""Deterministic, local-only NHANES preparation. Errors never contain row values."""

import hashlib
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split


def numeric_values(values: pd.Series) -> pd.Series:
    try:
        return pd.to_numeric(values, errors="raise")
    except (ValueError, TypeError) as error:
        raise ValueError("unexpected nonnumeric source value; review the source schema") from error


def validate_keys(frame: pd.DataFrame, key: str) -> None:
    values = pd.to_numeric(frame[key], errors="coerce")
    if values.isna().any() or not np.isfinite(values).all() or (values <= 0).any() or (values % 1 != 0).any():
        raise ValueError("join key must contain positive finite integers")
    if values.duplicated().any():
        raise ValueError("duplicate join key; no data was silently deduplicated")
    frame[key] = values.astype("int64")


def load_modules(raw_dir: Path, manifest: dict[str, Any]) -> dict[str, pd.DataFrame]:
    modules = {}
    for module, filename in manifest["files"].items():
        fields = [manifest["join_key"], *manifest["module_columns"][module]]
        frame = pd.read_sas(raw_dir / filename, format="xport", encoding="utf-8")
        if not set(fields) <= set(frame.columns):
            raise ValueError(f"{module}: required columns are missing")
        frame = frame.loc[:, fields].copy()
        validate_keys(frame, manifest["join_key"])
        modules[module] = frame
    return modules


def derive_table(modules: dict[str, pd.DataFrame], manifest: dict[str, Any]) -> pd.DataFrame:
    key = manifest["join_key"]
    modules = {name: frame.copy() for name, frame in modules.items()}
    for frame in modules.values():
        validate_keys(frame, key)
    table = modules["demographics"]
    population = manifest["population"]
    age = numeric_values(table["RIDAGEYR"])
    table = table.loc[age.between(population["minimum_age"], population["maximum_coded_age"])].copy()
    for name, frame in modules.items():
        if name != "demographics":
            table = table.merge(frame, on=key, how="left", validate="one_to_one")
    bp_columns = manifest["label"]["prohibited_predictors"]
    readings = table[bp_columns].apply(numeric_values)
    readings = readings.where(np.isfinite(readings) & (readings > 0))
    systolic = readings[[x for x in bp_columns if x.startswith("BPXOSY")]].mean(axis=1)
    diastolic = readings[[x for x in bp_columns if x.startswith("BPXODI")]].mean(axis=1)
    eligible = systolic.notna() & diastolic.notna()
    bmi = numeric_values(table["BMXBMI"])
    eligible &= bmi.between(*population["bmi_range"])
    table = table.loc[eligible].copy()
    table[manifest["label"]["name"]] = ((systolic[eligible] >= 130) | (diastolic[eligible] >= 80)).astype("int8")
    for feature, spec in manifest["predictor_specs"].items():
        values = numeric_values(table[feature]).astype("float64")
        known = values.isna() | values.isin(spec["missing_codes"])
        if spec["kind"] == "categorical":
            known |= values.isin(spec["valid_values"])
        else:
            known |= values.between(spec["minimum"], spec["maximum"])
        if not known.all():
            raise ValueError(f"{feature}: unexpected source values; review the codebook")
        table[feature] = values.mask(values.isin(spec["missing_codes"]))
    columns = [key, *manifest["candidate_predictors"], manifest["label"]["name"]]
    table = table.loc[:, columns].sort_values(key).reset_index(drop=True)
    if table.empty:
        raise ValueError("no eligible rows after the declared exclusions")
    return table


def split_table(frame: pd.DataFrame, manifest: dict[str, Any]) -> tuple[dict[str, pd.DataFrame], dict[str, float]]:
    key, target = manifest["join_key"], manifest["label"]["name"]
    features = manifest["candidate_predictors"]
    if set(frame.columns) != {key, target, *features}:
        raise ValueError("derived columns do not exactly match the predictor/label contract")
    frame = frame.copy()
    validate_keys(frame, key)
    if frame[target].isna().any() or set(frame[target].unique()) != {0, 1}:
        raise ValueError("label must contain both binary classes and no missing values")
    frame = frame.sort_values(key).reset_index(drop=True)
    split = manifest["split"]
    holdout_ratio = split["validation"] + split["test"]
    train, holdout = train_test_split(
        frame, test_size=holdout_ratio, random_state=split["seed"], stratify=frame[target]
    )
    validation, test = train_test_split(
        holdout, test_size=split["test"] / holdout_ratio, random_state=split["seed"], stratify=holdout[target]
    )
    partitions = {"train": train.copy(), "validation": validation.copy(), "test": test.copy()}
    fill_values = {}
    for feature, spec in manifest["predictor_specs"].items():
        values = pd.to_numeric(frame[feature], errors="raise")
        observed = values.dropna()
        valid = (
            observed.isin(spec["valid_values"])
            if spec["kind"] == "categorical"
            else observed.between(spec["minimum"], spec["maximum"])
        )
        if not valid.all() or not np.isfinite(observed).all():
            raise ValueError(f"{feature}: invalid derived values")
        if spec["kind"] == "categorical":
            fill = float(manifest["preprocessing"]["categorical_missing"])
        else:
            fill = float(train[feature].median()) if train[feature].notna().any() else float("nan")
            if not math.isfinite(fill):
                raise ValueError(f"{feature}: no observed training values for median imputation")
        fill_values[feature] = fill
        for partition in partitions.values():
            partition[feature] = partition[feature].fillna(fill).astype("float64")
    for partition in partitions.values():
        if set(partition[target].unique()) != {0, 1}:
            raise ValueError("each partition must contain both classes; increase the eligible sample")
    return partitions, fill_values


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_splits(
    partitions: dict[str, pd.DataFrame], fill_values: dict[str, float], output: Path, manifest: dict[str, Any]
) -> dict[str, Any]:
    output.mkdir(parents=True, exist_ok=False)
    key = manifest["join_key"]
    hashes = {}
    for name, partition in partitions.items():
        path = output / f"{name}.parquet"
        partition.sort_values(key).reset_index(drop=True).to_parquet(path, index=False)
        hashes[name] = sha256(path)
    digest_input = "\n".join(
        f"{name}:{','.join(map(str, sorted(partition[key].tolist())))}" for name, partition in partitions.items()
    )
    metadata = {
        "semantics_version": manifest["semantics_version"],
        "seed": manifest["split"]["seed"],
        "features": manifest["candidate_predictors"],
        "fill_values": fill_values,
        "split_digest": hashlib.sha256(digest_input.encode()).hexdigest(),
        "row_counts": {name: len(frame) for name, frame in partitions.items()},
        "partition_sha256": hashes,
    }
    (output / "split_metadata.json").write_text(
        json.dumps(metadata, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
    return metadata
