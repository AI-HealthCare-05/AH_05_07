#!/usr/bin/env python3
"""Increment B: hash-pinned, read-only cohorts to closed-schema aggregate evidence.

No fitting, raw source/target/ID columns, final-test access, row output or CIs.
Run as a module from the repository root. See the research contract for estimands.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import platform
import re
import subprocess
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pyarrow
import sklearn
from threadpoolctl import threadpool_limits

from app.services.model_v2_inference import (
    CANONICAL_CATEGORIES,
    CATEGORICAL,
    EXPECTED_ARTIFACT_SHA256,
    EXPECTED_SCHEMA_VERSION,
    FEATURES,
    NUMERIC,
    load_verified_artifact,
)
from app.services.model_v2_input_adapter import ADAPTER_VERSION

REPO = Path(__file__).resolve().parents[2]
CONTRACT = "docs/research/model-v2-reference-distribution-contract.md"
SCRIPT = "scripts/model/analyze_model_v2_reference_distribution.py"
TEST = "tests/model/test_model_v2_reference_distribution.py"
ARTIFACT = "model-v2-r1/knhanes-2024/logistic-release-v1/model-v2-r1-a.joblib"
ROLES = {
    "development_2024": {
        "path": "model-v2-g3/knhanes-2024/development/development.parquet",
        "sha256": "e56089bcd6dfce076cd41e58e708e44af4dc4281e161c6bacf4115bc9a332adb",
        "n": 4157,
        "psu": 134,
        "year": 2024,
    },
    "validation_2024": {
        "path": "model-v2-g3/knhanes-2024/locked-validation/validation.parquet",
        "sha256": "71774e13e7b994e023253d78f8310a1374610c652644a7a87aeabe88f1c00fd7",
        "n": 978,
        "psu": 31,
        "year": 2024,
    },
    "temporal_2023": {
        "path": "model-v2-g7/knhanes-2023/logistic-transport-v1/external-cohort.parquet",
        "sha256": "0741896ea09257b7a2a49aa8f2afafbec6e70995324fa49f5f2b5703bdc10334",
        "n": 5789,
        "psu": 192,
        "year": 2023,
    },
}
QUANTILES = {f"p{p:02d}": p / 100 for p in (1, 5, 10, 25, 50, 75, 90, 95, 99)}
TAILS = {k: QUANTILES[k] for k in ("p01", "p05", "p95", "p99")}
DOMAINS = {
    "age_years": (19, None),
    "bmi_from_height_weight": (0, None),
    "walking_days_7d": (0, 7),
    "walking_minutes_per_active_day": (0, 1440),
    "weekday_sleep_minutes": (0, 1440),
    "weekend_sleep_minutes": (0, 1440),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def canonical(value) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def checked_values(values, weights=None, *, scores=True):
    x = np.asarray(values, dtype=float)
    w = np.ones(len(x)) if weights is None else np.asarray(weights, dtype=float)
    if x.ndim != 1 or not len(x) or w.shape != x.shape:
        raise ValueError("nonempty aligned vectors required")
    if not np.isfinite(x).all() or (scores and ((x < 0) | (x > 1)).any()):
        raise ValueError("scores must be finite and within [0,1]")
    if not np.isfinite(w).all() or (w <= 0).any() or not np.isfinite(w.sum()):
        raise ValueError("weights must be finite and strictly positive")
    return x, w


def cdf(values, query, weights=None, convention="right"):
    x, w = checked_values(values, weights)
    q = np.asarray(query, dtype=float)
    if not np.isfinite(q).all():
        raise ValueError("CDF query must be finite")
    if convention not in {"left", "right", "mid"}:
        raise ValueError("unknown CDF convention")
    order = np.argsort(x, kind="stable")
    cumulative = np.r_[0.0, np.cumsum(w[order])]
    cumulative /= cumulative[-1]
    left = cumulative[np.searchsorted(x[order], q, side="left")]
    right = cumulative[np.searchsorted(x[order], q, side="right")]
    return {"left": left, "right": right, "mid": (left + right) / 2}[convention]


def quantile(values, probability, weights=None, *, scores=True):
    x, w = checked_values(values, weights, scores=scores)
    q = np.asarray(probability, dtype=float)
    if not np.isfinite(q).all() or ((q < 0) | (q > 1)).any():
        raise ValueError("quantiles must be in [0,1]")
    order = np.argsort(x, kind="stable")
    cumulative = np.cumsum(w[order])
    index = np.searchsorted(cumulative, q * cumulative[-1], side="left")
    return x[order][np.minimum(index, len(x) - 1)]


def quantile_table(x, w=None):
    return {k: float(quantile(x, p, w)) for k, p in QUANTILES.items()}


def weight_diagnostics(weights):
    _, w = checked_values(np.zeros(len(weights)), weights)
    shares = w / w.sum()
    return {
        "n": len(w),
        "sum": float(w.sum()),
        "min": float(w.min()),
        "max": float(w.max()),
        "max_share": float(shares.max()),
        "cv": float(w.std(ddof=0) / w.mean()),
        "top_one_percent_share": float(np.sort(shares)[-math.ceil(len(w) / 100) :].sum()),
        "kish_neff": float(1 / np.square(shares).sum()),
    }


def design_diagnostics(frame):
    clusters = frame[["kstrata", "psu"]].drop_duplicates()
    counts = clusters.groupby("kstrata", observed=True).size()
    return {
        "psu": len(clusters),
        "strata": len(counts),
        "singleton_strata": int((counts == 1).sum()),
        "psus_per_stratum": {
            **{str(n): int((counts == n).sum()) for n in range(1, 5)},
            "5_plus": int((counts >= 5).sum()),
        },
    }


def complete_mask(frame):
    """Use observed semantic values, never the pipeline's imputed values."""
    return frame[FEATURES].notna().all(axis=1).to_numpy()


def canonical_features(frame):
    x = frame[FEATURES].copy()
    for name in NUMERIC:
        x[name] = pd.to_numeric(x[name], errors="raise")
    for name in CATEGORICAL:
        values = x[name].astype("object")
        x[name] = values.where(pd.notna(values), np.nan)
    return x


def mapping_difference(first, first_weights, second, second_weights):
    """Uniform-score summaries + exact supremum, not a row-frequency average."""
    grid = np.linspace(0, 1, 10001)
    difference = np.abs(cdf(first, grid, first_weights) - cdf(second, grid, second_weights)) * 100
    jumps = np.unique(np.r_[0, first, second, 1])
    right = np.abs(cdf(first, jumps, first_weights) - cdf(second, jumps, second_weights)) * 100
    left = np.abs(cdf(first, jumps, first_weights, "left") - cdf(second, jumps, second_weights, "left")) * 100
    exact = np.maximum(right, left)
    maximum_score = jumps[np.argmax(exact)]
    bin_start = min(0.99, np.floor(maximum_score * 100) / 100)
    anchors = {k: float(quantile(first, p, first_weights)) for k, p in TAILS.items()}
    return {
        "uniform_score_grid_median_pp": float(np.median(difference)),
        "uniform_score_grid_p90_pp": float(np.quantile(difference, 0.90)),
        "uniform_score_grid_p95_pp": float(np.quantile(difference, 0.95)),
        "exact_max_pp": float(exact.max()),
        "max_score_bin_lower": float(bin_start),
        "max_score_bin_upper": float(bin_start + 0.01),
        "lower_5pct_tail_max_pp": float(exact[jumps <= anchors["p05"]].max()),
        "upper_5pct_tail_max_pp": float(exact[jumps >= anchors["p95"]].max()),
        "anchor_abs_pp": {
            k: float(abs(cdf(first, s, first_weights) - cdf(second, s, second_weights)) * 100)
            for k, s in anchors.items()
        },
    }


def tie_diagnostics(x, w):
    unique, inverse, counts = np.unique(x, return_inverse=True, return_counts=True)
    mass = np.bincount(inverse, weights=w) / w.sum()
    duplicates = counts > 1
    return {
        "duplicate_groups": int(duplicates.sum()),
        "rows_in_duplicate_groups": int(counts[duplicates].sum()),
        "max_multiplicity": int(counts.max()),
        "max_duplicate_group_weight_pp": float(mass[duplicates].max() * 100) if duplicates.any() else 0.0,
        "right_minus_left_max_pp": float(mass.max() * 100),
        "right_minus_mid_max_pp": float(mass.max() * 50),
        "unweighted_right_minus_left_max_pp": float(counts.max() / len(x) * 100),
        "tail_right_minus_left_max_pp": {
            k: float(mass[unique <= quantile(x, p, w) if p < 0.5 else unique >= quantile(x, p, w)].max() * 100)
            for k, p in TAILS.items()
        },
    }


def tail_support(frame, x, w):
    result = {}
    for key, p in TAILS.items():
        cutoff = float(quantile(x, p, w))
        mask = x <= cutoff if p < 0.5 else x >= cutoff
        design = design_diagnostics(frame.loc[mask])
        result[key] = {
            "cutoff": cutoff,
            "n": int(mask.sum()),
            "weight_share": float(w[mask].sum() / w.sum()),
            "kish_neff": weight_diagnostics(w[mask])["kish_neff"],
            "psu": design["psu"],
            "strata": design["strata"],
        }
    return result


def numeric_support(frame, name, w):
    values = frame[name].to_numpy(dtype=float)
    observed = np.isfinite(values)
    lower, upper = DOMAINS[name]
    outside = (values < lower) | ((values > upper) if upper is not None else False)
    if name == "bmi_from_height_weight":
        outside |= values <= 0
    if name == "walking_days_7d":
        outside |= observed & (values != np.floor(values))
    present = values[observed]
    return {
        "missing_n": int((~observed).sum()),
        "missing_share": float((~observed).mean()),
        "missing_weight_share": float(w[~observed].sum() / w.sum()),
        "min": float(present.min()) if len(present) else None,
        "max": float(present.max()) if len(present) else None,
        "weighted_p01": float(quantile(present, 0.01, w[observed], scores=False)) if len(present) else None,
        "weighted_p99": float(quantile(present, 0.99, w[observed], scores=False)) if len(present) else None,
        "outside_product_domain_n": int((outside & observed).sum()),
    }


def categorical_support(frame, name, w):
    values = frame[name]
    categories = {}
    for category in CANONICAL_CATEGORIES[name]:
        mask = values.eq(category).fillna(False).to_numpy(dtype=bool)
        categories[str(category)] = {"n": int(mask.sum()), "weight_share": float(w[mask].sum() / w.sum())}
    missing = values.isna().to_numpy()
    return {
        "missing_n": int(missing.sum()),
        "missing_weight_share": float(w[missing].sum() / w.sum()),
        "noncanonical_n": int((values.notna() & ~values.isin(CANONICAL_CATEGORIES[name])).sum()),
        "absent_categories_n": sum(item["n"] == 0 for item in categories.values()),
        "rare_category_weight_share": sum(
            item["weight_share"] for item in categories.values() if item["weight_share"] < 0.01
        ),
        "categories": categories,
    }


def subset_summary(frame, x):
    w = frame["wt_itvex"].to_numpy(dtype=float)
    checked_values(x, w)
    mean = np.average(x, weights=w)
    normalization_error = np.max(np.abs(cdf(x, x, w) - cdf(x, x, w / w.mean())))
    if normalization_error > 1e-12:
        raise ValueError("weight scaling invariance failed")
    return {
        "weights": weight_diagnostics(w),
        "design": design_diagnostics(frame),
        "score": {
            "unweighted_mean": float(np.mean(x)),
            "weighted_mean": float(mean),
            "unweighted_sd": float(np.std(x)),
            "weighted_sd": float(np.sqrt(np.average((x - mean) ** 2, weights=w))),
            "unweighted_quantiles": quantile_table(x),
            "weighted_quantiles": quantile_table(x, w),
        },
        "weight_normalization_max_abs_cdf_difference": float(normalization_error),
        "weighted_vs_unweighted": mapping_difference(x, w, x, None),
        "ties": tie_diagnostics(x, w),
        "tails": tail_support(frame, x, w),
        "numeric_support": {k: numeric_support(frame, k, w) for k in FEATURES if k in NUMERIC},
        "categorical_support": {k: categorical_support(frame, k, w) for k in FEATURES if k in CATEGORICAL},
    }


def compare(first_frame, first_scores, second_frame, second_scores):
    first_w = first_frame["wt_itvex"].to_numpy(dtype=float)
    second_w = second_frame["wt_itvex"].to_numpy(dtype=float)
    return {
        "mapping": mapping_difference(first_scores, first_w, second_scores, second_w),
        "weighted_quantile_shift_second_minus_first": {
            k: float(quantile(second_scores, p, second_w) - quantile(first_scores, p, first_w))
            for k, p in QUANTILES.items()
        },
    }


def analyze_cohorts(frames, pipeline):
    reports, scored = {}, {}
    for role, frame in frames.items():
        with threadpool_limits(limits=1):
            scores = pipeline.predict_proba(canonical_features(frame))[:, 1]
        checked_values(scores, frame["wt_itvex"].to_numpy())
        mask = complete_mask(frame)
        if not mask.any():
            raise ValueError("HOLD: product-complete subset empty")
        scored[role] = {"full": (frame, scores), "product_complete": (frame.loc[mask], scores[mask])}
        reports[role] = {
            "subsets": {k: subset_summary(*v) for k, v in scored[role].items()},
            "full_vs_product_complete": compare(frame, scores, frame.loc[mask], scores[mask]),
            "complete_n_fraction": float(mask.mean()),
            "complete_weight_fraction": float(frame.loc[mask, "wt_itvex"].sum() / frame["wt_itvex"].sum()),
        }
    temporal = {
        subset: compare(*scored["validation_2024"][subset], *scored["temporal_2023"][subset])
        for subset in ("full", "product_complete")
    }
    dev_strata = set(frames["development_2024"]["kstrata"])
    val_strata = set(frames["validation_2024"]["kstrata"])
    dev_psus = set(map(tuple, frames["development_2024"][["kstrata", "psu"]].to_numpy()))
    val_psus = set(map(tuple, frames["validation_2024"][["kstrata", "psu"]].to_numpy()))
    if dev_psus & val_psus:
        raise ValueError("development/validation PSU overlap")
    coverage = {
        "authorized_development_validation_strata_union": len(dev_strata | val_strata),
        "validation_missing_from_authorized_union": len(dev_strata - val_strata),
        "development_validation_psu_overlap": 0,
    }
    return reports, temporal, coverage


def approved_path(root, relative):
    """No arbitrary role paths and no symlink aliases into unapproved data."""
    allowed = {ARTIFACT, *(item["path"] for item in ROLES.values())}
    if relative not in allowed:
        raise ValueError("unapproved source path")
    root = Path(root).expanduser().absolute()
    if root.resolve() != root:
        raise ValueError("source root must not be a symlink")
    path = root / relative
    if path.resolve() != path or REPO in path.parents:
        raise ValueError("source must be outside repository without symlinks")
    if not path.is_file():
        raise ValueError("HOLD — required approved local research source unavailable")
    return path


def load_sources(root, reference_model_sha=EXPECTED_ARTIFACT_SHA256):
    if reference_model_sha != EXPECTED_ARTIFACT_SHA256:
        raise ValueError("reference/model SHA mismatch")
    artifact_path = approved_path(root, ARTIFACT)
    # The existing loader hashes before joblib deserialization. enabled=True is
    # local explicit research inference, not an environment/runtime mutation.
    artifact = load_verified_artifact(artifact_path, enabled=True)
    frames = {}
    for role, config in ROLES.items():
        path = approved_path(root, config["path"])
        if sha256(path) != config["sha256"]:
            raise ValueError("approved cohort SHA mismatch")
        frame = pd.read_parquet(path, columns=[*FEATURES, "wt_itvex", "kstrata", "psu"])
        design = design_diagnostics(frame)
        if len(frame) != config["n"] or design["psu"] != config["psu"]:
            raise ValueError("approved cohort count mismatch")
        if frame[["kstrata", "psu"]].isna().any().any():
            raise ValueError("missing survey design metadata")
        checked_values(np.zeros(len(frame)), frame["wt_itvex"].to_numpy())
        frames[role] = frame
    return frames, artifact["pipeline"]


# A closed aggregate schema. No arbitrary keys, arrays, category labels, strings,
# per-PSU summaries or per-participant objects can pass the publication boundary.
NUMBER = "number"
NULLABLE = "nullable_number"
HASH = "sha256"


def fields(names, kind=NUMBER):
    return dict.fromkeys(names.split(), kind)


def aggregate_schema():
    quantiles = dict.fromkeys(QUANTILES, NUMBER)
    anchors = dict.fromkeys(TAILS, NUMBER)
    mapping = {
        **fields(
            "uniform_score_grid_median_pp uniform_score_grid_p90_pp uniform_score_grid_p95_pp exact_max_pp max_score_bin_lower max_score_bin_upper lower_5pct_tail_max_pp upper_5pct_tail_max_pp"
        ),
        "anchor_abs_pp": anchors,
    }
    comparison = {"mapping": mapping, "weighted_quantile_shift_second_minus_first": quantiles}
    subset = {
        "weights": fields("n sum min max max_share cv top_one_percent_share kish_neff"),
        "design": {**fields("psu strata singleton_strata"), "psus_per_stratum": fields("1 2 3 4 5_plus")},
        "score": {
            **fields("unweighted_mean weighted_mean unweighted_sd weighted_sd"),
            "unweighted_quantiles": quantiles,
            "weighted_quantiles": quantiles,
        },
        "weight_normalization_max_abs_cdf_difference": NUMBER,
        "weighted_vs_unweighted": mapping,
        "ties": {
            **fields(
                "duplicate_groups rows_in_duplicate_groups max_multiplicity max_duplicate_group_weight_pp right_minus_left_max_pp right_minus_mid_max_pp unweighted_right_minus_left_max_pp"
            ),
            "tail_right_minus_left_max_pp": anchors,
        },
        "tails": {k: fields("cutoff n weight_share kish_neff psu strata") for k in TAILS},
        "numeric_support": {
            k: {
                **fields("missing_n missing_share missing_weight_share outside_product_domain_n"),
                **fields("min max weighted_p01 weighted_p99", NULLABLE),
            }
            for k in FEATURES
            if k in NUMERIC
        },
        "categorical_support": {
            k: {
                **fields(
                    "missing_n missing_weight_share noncanonical_n absent_categories_n rare_category_weight_share"
                ),
                "categories": {str(c): fields("n weight_share") for c in CANONICAL_CATEGORIES[k]},
            }
            for k in FEATURES
            if k in CATEGORICAL
        },
    }
    return {
        "identity": {
            "model_sha256": HASH,
            "schema_version": {EXPECTED_SCHEMA_VERSION},
            "adapter_version": {ADAPTER_VERSION},
            "analysis_source_commit": "commit",
            "analysis_script_sha256": HASH,
            "contract_sha256": HASH,
            "created_at_utc": "timestamp",
            "feature_order": {str(i + 1): {name} for i, name in enumerate(FEATURES)},
            "source_sha256": {role: {item["sha256"]} for role, item in ROLES.items()},
            "source_year": {role: NUMBER for role in ROLES},
            "cohort_contract_sha256": fields("g3 g7", HASH),
            "product_source_sha256": fields("python_adapter browser_adapter browser_steps", HASH),
            "runtime_versions": fields("python numpy pandas pyarrow scikit_learn joblib", "version"),
            "weight": {"wt_itvex"},
            "weight_policy": {"raw_survey_weight_and_unweighted_sensitivity"},
            "cdf": {"right_inclusive_research_point_estimate"},
            "tie_policy": {"left_right_mid_compared_product_unapproved"},
            "quantile": {"inverse_ecdf_no_interpolation"},
            "validity": {"research_snapshot_only_no_product_authorization_recheck_identity_before_reuse"},
            "eligibility": {"frozen_G3_G7_age19plus_target_design_present_positive_weight_not_explicitly_pregnant"},
            "subset_policy": {"full_and_all_11_semantic_features_observed_before_imputation"},
        },
        "cohorts": {
            role: {
                "subsets": {"full": subset, "product_complete": subset},
                "full_vs_product_complete": comparison,
                **fields("complete_n_fraction complete_weight_fraction"),
            }
            for role in ROLES
        },
        "validation_vs_temporal": {"full": comparison, "product_complete": comparison},
        "coverage": fields(
            "authorized_development_validation_strata_union validation_missing_from_authorized_union development_validation_psu_overlap"
        ),
        "uncertainty": {
            "confidence_intervals_computed": {False},
            "status": {"HOLD_pending_split_aware_survey_variance_review"},
        },
        "safety": {
            k: {False}
            for k in (
                "final_test_opened",
                "retrained",
                "recalibrated",
                "threshold_selected",
                "participant_output_written",
                "production_semantics_changed",
            )
        },
    }


def validate_tree(value, schema):
    if isinstance(schema, dict):
        if not isinstance(value, dict) or set(value) != set(schema):
            raise ValueError("aggregate schema keys mismatch")
        for key, child in schema.items():
            validate_tree(value[key], child)
    elif isinstance(schema, set):
        if isinstance(value, (dict, list)) or value not in schema:
            raise ValueError("aggregate enum mismatch")
    elif schema in (NUMBER, NULLABLE):
        if value is None and schema == NULLABLE:
            return
        if type(value) not in (int, float) or not math.isfinite(value):
            raise ValueError("aggregate finite scalar required")
    else:
        patterns = {
            HASH: r"[0-9a-f]{64}",
            "commit": r"[0-9a-f]{40}",
            "version": r"[0-9]+(?:\.[0-9]+){1,3}",
            "timestamp": r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z",
        }
        if not isinstance(value, str) or not re.fullmatch(patterns[schema], value):
            raise ValueError("aggregate metadata format mismatch")


def round_aggregates(value):
    if isinstance(value, dict):
        return {k: round_aggregates(v) for k, v in value.items()}
    return round(value, 6) if isinstance(value, float) else value


def serialize_evidence(payload):
    validate_tree(payload, aggregate_schema())
    if payload["identity"]["model_sha256"] != EXPECTED_ARTIFACT_SHA256:
        raise ValueError("reference/model SHA mismatch")
    rounded = round_aggregates(payload)
    envelope = {"payload": rounded, "payload_sha256": hashlib.sha256(canonical(rounded)).hexdigest()}
    return json.dumps(envelope, sort_keys=True, indent=2, allow_nan=False) + "\n"


def identity(created_at):
    datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%SZ")
    tracked = [SCRIPT, TEST, CONTRACT, "app/services/model_v2_inference.py", "app/services/model_v2_input_adapter.py"]
    for path in tracked:
        subprocess.run(["git", "ls-files", "--error-unmatch", path], cwd=REPO, check=True, capture_output=True)
    dirty = subprocess.check_output(["git", "diff", "HEAD", "--", *tracked], cwd=REPO)
    if dirty:
        raise ValueError("commit the research implementation and contract before analysis")
    return {
        "model_sha256": EXPECTED_ARTIFACT_SHA256,
        "schema_version": EXPECTED_SCHEMA_VERSION,
        "adapter_version": ADAPTER_VERSION,
        "analysis_source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip(),
        "analysis_script_sha256": sha256(REPO / SCRIPT),
        "contract_sha256": sha256(REPO / CONTRACT),
        "created_at_utc": created_at,
        "feature_order": {str(i + 1): v for i, v in enumerate(FEATURES)},
        "source_sha256": {role: item["sha256"] for role, item in ROLES.items()},
        "source_year": {role: item["year"] for role, item in ROLES.items()},
        "cohort_contract_sha256": {
            "g3": sha256(REPO / "docs/research/model-v2-g3-freeze-contract.md"),
            "g7": sha256(REPO / "docs/research/model-v2-g7-external-evaluation-contract.md"),
        },
        "product_source_sha256": {
            "python_adapter": sha256(REPO / "app/services/model_v2_input_adapter.py"),
            "browser_adapter": sha256(REPO / "web/src/lib/model-v2/adapter.ts"),
            "browser_steps": sha256(REPO / "web/src/components/modelV2Steps.ts"),
        },
        "runtime_versions": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "pyarrow": pyarrow.__version__,
            "scikit_learn": sklearn.__version__,
            "joblib": joblib.__version__,
        },
        "weight": "wt_itvex",
        "weight_policy": "raw_survey_weight_and_unweighted_sensitivity",
        "cdf": "right_inclusive_research_point_estimate",
        "tie_policy": "left_right_mid_compared_product_unapproved",
        "quantile": "inverse_ecdf_no_interpolation",
        "validity": "research_snapshot_only_no_product_authorization_recheck_identity_before_reuse",
        "eligibility": "frozen_G3_G7_age19plus_target_design_present_positive_weight_not_explicitly_pregnant",
        "subset_policy": "full_and_all_11_semantic_features_observed_before_imputation",
    }


def run(root, output, created_at, reference_model_sha=EXPECTED_ARTIFACT_SHA256):
    if reference_model_sha != EXPECTED_ARTIFACT_SHA256:
        raise ValueError("reference/model SHA mismatch")
    output = Path(output)
    if output.exists():
        raise ValueError("refusing to overwrite existing evidence")
    metadata = identity(created_at)
    frames, pipeline = load_sources(root, reference_model_sha)
    cohorts, temporal, coverage = analyze_cohorts(frames, pipeline)
    payload = {
        "identity": metadata,
        "cohorts": cohorts,
        "validation_vs_temporal": temporal,
        "coverage": coverage,
        "uncertainty": {
            "confidence_intervals_computed": False,
            "status": "HOLD_pending_split_aware_survey_variance_review",
        },
        "safety": dict.fromkeys(aggregate_schema()["safety"], False),
    }
    serialized = serialize_evidence(payload)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8") as stream:
        stream.write(serialized)
    return hashlib.sha256(serialized.encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--created-at", required=True, help="fixed UTC timestamp, YYYY-MM-DDTHH:MM:SSZ")
    parser.add_argument("--reference-model-sha", default=EXPECTED_ARTIFACT_SHA256)
    args = parser.parse_args()
    try:
        digest = run(args.data_root, args.output, args.created_at, args.reference_model_sha)
    except (ValueError, OSError, RuntimeError, subprocess.SubprocessError) as exc:
        # Avoid source values, paths and library exception payloads in console logs.
        print(f"HOLD_REFERENCE_RESEARCH: prerequisite/integrity failure ({type(exc).__name__}); no evidence published")
        return 1
    print(f"Aggregate evidence written; SHA-256 {digest}; confidence intervals withheld pending survey design review")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
