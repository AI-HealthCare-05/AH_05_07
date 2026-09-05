"""Behavioral regressions for missing labels, source semantics and frozen splits."""

import copy

import numpy as np
import pandas as pd
import pytest

from scripts.data.contract import load_manifest, validate_manifest
from scripts.data.preparation import derive_table, split_table, write_splits
from scripts.model.preprocessing import make_preprocessor


@pytest.fixture
def manifest():
    return load_manifest()


def synthetic_modules(manifest, count=120):
    key = np.arange(1, count + 1)
    modules = {}
    for name, columns in manifest["module_columns"].items():
        values = {"SEQN": key}
        for column in columns:
            if column.startswith("BPXOSY"):
                values[column] = np.where(key % 2 == 0, 140.0, 110.0)
            elif column.startswith("BPXODI"):
                values[column] = np.full(count, 70.0)
            else:
                values[column] = np.full(count, {"RIDAGEYR": 40, "BMXBMI": 24, "SLD012": 7}.get(column, 1), dtype=float)
        modules[name] = pd.DataFrame(values)
    return modules


def test_missing_and_partial_bp_never_become_false_negative(manifest):
    modules = synthetic_modules(manifest)
    bp = modules["blood_pressure"]
    cols = manifest["label"]["prohibited_predictors"]
    bp.loc[0, cols] = np.nan
    bp.loc[1, [x for x in cols if x.startswith("BPXODI")]] = np.nan
    bp.loc[2, cols] = [np.nan, 130, np.nan, np.nan, 70, np.nan]
    bp.loc[3, cols] = [120, 120, 120, 80, 80, 80]
    bp.loc[4, cols] = [np.inf, 0, -1, np.nan, 0, -1]
    table = derive_table(modules, manifest).set_index("SEQN")
    assert {1, 2, 5}.isdisjoint(table.index)
    assert table.loc[3, manifest["label"]["name"]] == 1
    assert table.loc[4, manifest["label"]["name"]] == 1
    assert not set(cols) & set(table.columns)


def test_adult_bmi_scope_and_absent_questionnaire_rows(manifest):
    modules = synthetic_modules(manifest)
    modules["demographics"].loc[0, "RIDAGEYR"] = 17
    modules["body_measures"].loc[1, "BMXBMI"] = np.nan
    modules["body_measures"].loc[2, "BMXBMI"] = 81
    modules["alcohol"] = modules["alcohol"].iloc[4:]
    table = derive_table(modules, manifest).set_index("SEQN")
    assert {1, 2, 3}.isdisjoint(table.index)
    assert pd.isna(table.loc[4, "ALQ111"])


@pytest.mark.parametrize(
    "feature,module",
    [("PAQ605", "physical_activity"), ("PAQ620", "physical_activity"), ("SMQ020", "smoking"), ("ALQ111", "alcohol")],
)
def test_special_codes_are_missing_not_numeric_answers(manifest, feature, module):
    modules = synthetic_modules(manifest)
    modules[module].loc[:1, feature] = [7, 9]
    table = derive_table(modules, manifest)
    assert table.loc[:1, feature].isna().all()
    modules[module].loc[2, feature] = 3
    with pytest.raises(ValueError, match="unexpected source"):
        derive_table(modules, manifest)


def test_sleep_end_categories_remain_distinct(manifest):
    modules = synthetic_modules(manifest)
    modules["sleep"].loc[:3, "SLD012"] = [2, 3, 13.5, 14]
    table = derive_table(modules, manifest)
    partitions, fills = split_table(table, manifest)
    prep = make_preprocessor(manifest, fills).fit(partitions["train"][manifest["candidate_predictors"]])
    transformed = prep.transform(table.iloc[:4][manifest["candidate_predictors"]])
    assert len(np.unique(transformed, axis=0)) == 4
    modules["sleep"].loc[0, "SLD012"] = 2.5
    with pytest.raises(ValueError, match="unexpected source"):
        derive_table(modules, manifest)


@pytest.mark.parametrize("bad", [np.nan, 1, -1, 1.5, np.inf])
def test_invalid_or_duplicate_join_keys_fail_without_values(manifest, bad):
    modules = synthetic_modules(manifest)
    modules["alcohol"]["SEQN"] = modules["alcohol"]["SEQN"].astype(float)
    modules["alcohol"].loc[1, "SEQN"] = bad
    with pytest.raises(ValueError, match="join key"):
        derive_table(modules, manifest)


def test_manifest_ratios_row_order_and_file_digests(manifest, tmp_path):
    manifest["split"].update(train=0.6, validation=0.2, test=0.2)
    validate_manifest(manifest)
    table = derive_table(synthetic_modules(manifest, 200), manifest)
    a, fills_a = split_table(table, manifest)
    b, fills_b = split_table(table.sample(frac=1, random_state=9), manifest)
    assert [len(a[x]) for x in a] == [120, 40, 40]
    meta_a = write_splits(a, fills_a, tmp_path / "a", manifest)
    meta_b = write_splits(b, fills_b, tmp_path / "b", manifest)
    assert meta_a == meta_b
    assert set(a["train"].SEQN).isdisjoint(a["validation"].SEQN)
    assert set(a["train"].SEQN).isdisjoint(a["test"].SEQN)
    assert set(a["test"].SEQN).isdisjoint(a["validation"].SEQN)
    with pytest.raises(FileExistsError):
        write_splits(a, fills_a, tmp_path / "a", manifest)


def test_imputation_is_train_only_and_categorical_missing_is_explicit(manifest):
    table = derive_table(synthetic_modules(manifest), manifest)
    initial, _ = split_table(table, manifest)
    held_out = set(initial["validation"].SEQN) | set(initial["test"].SEQN)
    table.loc[table.SEQN.isin(held_out), "BMXBMI"] = 79
    train_ids = list(initial["train"].SEQN)
    table.loc[table.SEQN == train_ids[0], "BMXBMI"] = np.nan
    table["ALQ111"] = np.nan
    partitions, fills = split_table(table, manifest)
    assert fills["BMXBMI"] == 24
    assert fills["ALQ111"] == -1
    assert set(partitions["train"].ALQ111) == {-1}
    table.loc[~table.SEQN.isin(held_out), "BMXBMI"] = np.nan
    with pytest.raises(ValueError, match="no observed training"):
        split_table(table, manifest)


@pytest.mark.parametrize("corruption", ["label_missing", "single_class", "leak", "invalid_category"])
def test_corrupt_derived_input_is_rejected(manifest, corruption):
    table = derive_table(synthetic_modules(manifest), manifest)
    if corruption == "label_missing":
        table[manifest["label"]["name"]] = table[manifest["label"]["name"]].astype(float)
        table.loc[0, manifest["label"]["name"]] = np.nan
    elif corruption == "single_class":
        table[manifest["label"]["name"]] = 0
    elif corruption == "leak":
        table["BPXOSY1"] = 130
    else:
        table.loc[0, "SMQ020"] = 9
    with pytest.raises(ValueError):
        split_table(table, manifest)


def test_manifest_rejects_ratio_and_policy_drift(manifest):
    changed = copy.deepcopy(manifest)
    changed["split"]["test"] = 0.2
    with pytest.raises(ValueError, match="sum"):
        validate_manifest(changed)
    changed = copy.deepcopy(manifest)
    changed["preprocessing"]["categorical_missing"] = 1
    with pytest.raises(ValueError, match="preprocessing"):
        validate_manifest(changed)


def test_shared_pipeline_round_trip_with_missing_categories(manifest, tmp_path):
    import joblib
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import Pipeline

    modules = synthetic_modules(manifest)
    modules["body_measures"]["BMXBMI"] = np.where(modules["body_measures"].SEQN % 2, 22.0, 26.0)
    modules["alcohol"].loc[:10, "ALQ111"] = 9
    table = derive_table(modules, manifest)
    partitions, fills = split_table(table, manifest)
    features = manifest["candidate_predictors"]
    pipeline = Pipeline(
        [("preprocess", make_preprocessor(manifest, fills)), ("model", LogisticRegression(max_iter=2000))]
    )
    pipeline.fit(partitions["train"][features], partitions["train"][manifest["label"]["name"]])
    sample = table.iloc[:5][features]
    expected = pipeline.predict_proba(sample)
    artifact = tmp_path / "synthetic.joblib"
    joblib.dump(pipeline, artifact)
    loaded = joblib.load(artifact)
    np.testing.assert_array_equal(expected, loaded.predict_proba(sample))
    unknown = sample.copy()
    unknown.loc[:, "ALQ111"] = 8
    with pytest.raises(ValueError, match="unknown categories"):
        loaded.predict_proba(unknown)


def test_unexpected_text_is_not_silently_converted_to_missing(manifest):
    modules = synthetic_modules(manifest)
    modules["alcohol"]["ALQ111"] = modules["alcohol"]["ALQ111"].astype(object)
    modules["alcohol"].loc[0, "ALQ111"] = "synthetic-private-marker"
    with pytest.raises(ValueError, match="nonnumeric source") as error:
        derive_table(modules, manifest)
    assert "synthetic-private-marker" not in str(error.value)
