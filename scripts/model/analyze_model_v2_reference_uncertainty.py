#!/usr/bin/env python3
"""B2: preserve B, review authorized design coverage, publish PSU deletion sensitivity.

No SE/CI, survey replicates, fitting, row output or G8 access. See the contract.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from threadpoolctl import threadpool_limits

from scripts.model import analyze_model_v2_reference_distribution as b

REPO = Path(__file__).resolve().parents[2]
SCRIPT = "scripts/model/analyze_model_v2_reference_uncertainty.py"
TEST = "tests/model/test_model_v2_reference_uncertainty.py"
CONTRACT = "docs/research/model-v2-reference-uncertainty-contract.md"
B_EVIDENCE = "docs/evidence/model-v2-reference-distribution.json"
B_FILE_SHA = "52e93da3762b6357b65d8977238c5b74d0878e78d40cb19c60659a2ff4189fe2"
B_PAYLOAD_SHA = "91f073359507e2934dd58cea354c8acaac3fed49ede5924bba2405e2a16445ab"
BASELINE = "e96803fbd77f59947465365634b90e66a76d247c"
GUIDE_SHA = "921818c62267bd2949dd08e7d0143ef8cd30eb3086722e696481aa162ba42ce3"
SUBSETS = ("full", "product_complete")
ANCHORS = {f"p{p:02d}": p / 100 for p in (1, 5, 10, 50, 90, 95, 99)}
TAILS = {k: p for k, p in ANCHORS.items() if p != 0.5}
AGE_GROUPS = {
    "19_29": (19, 30),
    "30_39": (30, 40),
    "40_49": (40, 50),
    "50_59": (50, 60),
    "60_69": (60, 70),
    "70_79": (70, 80),
    "80_plus_topcoded": (80, np.inf),
}
METHODS = (
    "linearization",
    "woodruff",
    "jkn",
    "rao_wu",
    "supplied_replicates",
    "split_randomization",
    "lonely_remove",
    "lonely_certainty",
    "lonely_adjust",
    "lonely_average",
    "strata_collapsing",
    "domain",
)


def read_b_evidence():
    path = REPO / B_EVIDENCE
    if b.sha256(path) != B_FILE_SHA:
        raise ValueError("B evidence file mismatch; stop and investigate")
    envelope = json.loads(path.read_text())
    payload = envelope["payload"]
    if envelope["payload_sha256"] != B_PAYLOAD_SHA or hashlib.sha256(b.canonical(payload)).hexdigest() != B_PAYLOAD_SHA:
        raise ValueError("B evidence payload mismatch")
    b.validate_tree(payload, b.aggregate_schema())
    if payload["identity"]["model_sha256"] != b.EXPECTED_ARTIFACT_SHA256:
        raise ValueError("reference/model SHA mismatch")
    return payload


def verify_b_reproduction(frames, pipeline, prior):
    """Compare statistics only; B's immutable provenance remains B's provenance."""
    cohorts, temporal, coverage = b.analyze_cohorts(frames, pipeline)
    current = {"cohorts": cohorts, "validation_vs_temporal": temporal, "coverage": coverage}
    expected = {k: prior[k] for k in current}
    if b.round_aggregates(current) != expected:
        raise ValueError("B result not reproduced; stop and investigate")


def checked_structure(frame):
    required = {"wt_itvex", "kstrata", "psu"}
    if not isinstance(frame, pd.DataFrame) or not required.issubset(frame.columns) or frame.empty:
        raise ValueError("nonempty survey structure required")
    if frame[["kstrata", "psu"]].isna().any().any():
        raise ValueError("missing survey structure")
    for name in ("kstrata", "psu"):
        if frame[name].map(lambda x: isinstance(x, str) and not x.strip()).any():
            raise ValueError("empty survey label")
        if frame[name].map(lambda x: isinstance(x, (int, float)) and not np.isfinite(x)).any():
            raise ValueError("nonfinite survey label")
    b.checked_values(np.zeros(len(frame)), frame["wt_itvex"].to_numpy())
    return frame[["kstrata", "psu"]].drop_duplicates().groupby("kstrata", observed=True).size()


def multiplicity_histogram(counts):
    return {**{str(n): int((counts == n).sum()) for n in range(1, 5)}, "5_plus": int((counts >= 5).sum())}


def frame_support(frame):
    checked_structure(frame)
    w = frame["wt_itvex"].to_numpy(dtype=float)
    age = frame["age_years"].to_numpy(dtype=float)
    if not np.isfinite(age).all() or (age < 19).any() or (age > 80).any():
        raise ValueError("unexpected prepared adult age support")
    return {
        "n": len(frame),
        "sum_weights": float(w.sum()),
        "design": b.design_diagnostics(frame),
        "age_support": b.numeric_support(frame, "age_years", w),
        "age_groups": {
            name: {
                "n": int(((age >= lo) & (age < hi)).sum()),
                "weight_share": float(w[(age >= lo) & (age < hi)].sum() / w.sum()),
            }
            for name, (lo, hi) in AGE_GROUPS.items()
        },
        "categories": {name: b.categorical_support(frame, name, w) for name in b.CATEGORICAL},
    }


def coverage_review(development, validation):
    dev_counts, val_counts = checked_structure(development), checked_structure(validation)
    del dev_counts  # Validation's singleton origin is compared with the authorized union below.
    dev_units = set(map(tuple, development[["kstrata", "psu"]].to_numpy()))
    val_units = set(map(tuple, validation[["kstrata", "psu"]].to_numpy()))
    if dev_units & val_units:
        raise ValueError("development/validation PSU overlap")
    union = pd.concat([development, validation], ignore_index=True)
    union_counts = checked_structure(union)
    val_strata = set(val_counts.index)
    singleton = val_counts[val_counts == 1].index
    union_at_singletons = union_counts.reindex(singleton)
    represented = union["kstrata"].isin(val_strata).to_numpy()
    wu = union["wt_itvex"].to_numpy(dtype=float)
    wv = validation["wt_itvex"].to_numpy(dtype=float)
    supports = {
        "development": frame_support(development),
        "validation": frame_support(validation),
        "authorized_union": frame_support(union),
    }
    return {
        "frames": supports,
        "validation_psu_fraction_of_union": len(val_units) / len(dev_units | val_units),
        "validation_row_fraction_of_union": len(validation) / len(union),
        "validation_weight_fraction_of_union": float(wv.sum() / wu.sum()),
        "union_strata_absent_in_validation": len(set(union_counts.index) - val_strata),
        "union_psus_in_absent_strata": int(union_counts.loc[~union_counts.index.isin(val_strata)].sum()),
        "union_weight_share_in_absent_strata": float(wu[~represented].sum() / wu.sum()),
        "validation_singletons_with_additional_authorized_psus": int((union_at_singletons > 1).sum()),
        "validation_singletons_unresolved_in_authorized_union": int((union_at_singletons == 1).sum()),
        "union_psu_multiplicity_at_validation_singletons": multiplicity_histogram(union_at_singletons),
        "validation_weight_share_in_singleton_strata": float(
            wv[validation["kstrata"].isin(singleton)].sum() / wv.sum()
        ),
        "age_group_share_difference_validation_minus_union_pp": {
            k: 100
            * (
                supports["validation"]["age_groups"][k]["weight_share"]
                - supports["authorized_union"]["age_groups"][k]["weight_share"]
            )
            for k in AGE_GROUPS
        },
        "category_max_abs_share_difference_validation_vs_union_pp": {
            name: 100
            * max(
                abs(
                    supports["validation"]["categories"][name]["categories"][str(c)]["weight_share"]
                    - supports["authorized_union"]["categories"][name]["categories"][str(c)]["weight_share"]
                )
                for c in b.CANONICAL_CATEGORIES[name]
            )
            for name in b.CATEGORICAL
        },
    }


def tail_support(frame, scores):
    checked_structure(frame)
    x, w = b.checked_values(scores, frame["wt_itvex"].to_numpy())
    if len(frame) != len(x):
        raise ValueError("unaligned scores and design")
    result = {}
    for key, probability in TAILS.items():
        cutoff = float(b.quantile(x, probability, w))
        mask = x <= cutoff if probability < 0.5 else x >= cutoff
        design = b.design_diagnostics(frame.loc[mask])
        result[key] = {
            "cutoff": cutoff,
            "n": int(mask.sum()),
            "psu": design["psu"],
            "strata": design["strata"],
            "weight_share": float(w[mask].sum() / w.sum()),
            "kish_neff": b.weight_diagnostics(w[mask])["kish_neff"],
        }
    return result


def deletion_sensitivity(frame, scores):
    """Exhaust all observed PSU deletions; no jackknife scaling or inferential SE."""
    counts = checked_structure(frame)
    x, w = b.checked_values(scores, frame["wt_itvex"].to_numpy())
    if len(frame) != len(x):
        raise ValueError("unaligned scores and design")
    units = frame[["kstrata", "psu"]].drop_duplicates()
    if len(units) < 2:
        raise ValueError("cannot delete the only PSU")
    support = np.unique(x)
    baseline_cdf = b.cdf(x, support, w)
    quantiles = np.array([b.quantile(x, p, w) for p in ANCHORS.values()])
    base_at_anchors = b.cdf(x, quantiles, w)
    maxima, removed_shares, anchor_changes, quantile_changes = [], [], [], []
    lost_strata = 0
    for stratum, psu in units.itertuples(index=False, name=None):
        removed = (frame["kstrata"].eq(stratum) & frame["psu"].eq(psu)).to_numpy()
        keep = ~removed
        share = float(w[removed].sum() / w.sum())
        # The remaining support is a subset of the original support. Both CDFs
        # are constant between these jumps; right values cover every supremum.
        maximum = float(np.max(np.abs(b.cdf(x[keep], support, w[keep]) - baseline_cdf)))
        if maximum > share + 1e-12:
            raise ValueError("PSU deletion mixture bound violated")
        maxima.append(100 * maximum)
        removed_shares.append(share)
        anchor_changes.append(100 * (b.cdf(x[keep], quantiles, w[keep]) - base_at_anchors))
        quantile_changes.append(b.quantile(x[keep], list(ANCHORS.values()), w[keep]) - quantiles)
        lost_strata += int(counts.loc[stratum] == 1)
    changes, shifts = np.asarray(anchor_changes), np.asarray(quantile_changes)
    return {
        "method": "exhaustive_observed_psu_deletion_not_sampling_uncertainty",
        "deletions": len(units),
        "deletions_losing_a_stratum": lost_strata,
        "removed_weight_share_min": min(removed_shares),
        "removed_weight_share_max": max(removed_shares),
        "exact_max_cdf_movement_pp": max(maxima),
        "median_deletion_max_cdf_movement_pp": float(np.median(maxima)),
        "anchors": {
            key: {
                "baseline_quantile": float(quantiles[i]),
                "baseline_cdf_pp": float(100 * base_at_anchors[i]),
                "cdf_change_min_pp": float(changes[:, i].min()),
                "cdf_change_max_pp": float(changes[:, i].max()),
                "cdf_abs_change_max_pp": float(np.abs(changes[:, i]).max()),
                "quantile_shift_min": float(shifts[:, i].min()),
                "quantile_shift_max": float(shifts[:, i].max()),
            }
            for i, key in enumerate(ANCHORS)
        },
    }


def sensitivity_matrix(prior, deletions):
    val = prior["cohorts"]["validation_2024"]
    return {
        subset: {
            "weighting_max_mapping_pp": val["subsets"][subset]["weighted_vs_unweighted"]["exact_max_pp"],
            "full_complete_max_mapping_pp": val["full_vs_product_complete"]["mapping"]["exact_max_pp"],
            "temporal_max_mapping_pp": prior["validation_vs_temporal"][subset]["mapping"]["exact_max_pp"],
            "tie_left_right_max_pp": val["subsets"][subset]["ties"]["right_minus_left_max_pp"],
            "tie_mid_right_max_pp": val["subsets"][subset]["ties"]["right_minus_mid_max_pp"],
            "observed_psu_deletion_max_mapping_pp": deletions[subset]["exact_max_cdf_movement_pp"],
            "candidate_lonely_method_interval_difference_pp": None,
        }
        for subset in SUBSETS
    }


def analyze(frames, pipeline, prior):
    verify_b_reproduction(frames, pipeline, prior)
    development, validation = frames["development_2024"], frames["validation_2024"]
    with threadpool_limits(limits=1):
        scores = pipeline.predict_proba(b.canonical_features(validation))[:, 1]
    coverage, deletions, tails = {}, {}, {}
    for subset in SUBSETS:
        dm = np.ones(len(development), dtype=bool) if subset == "full" else b.complete_mask(development)
        vm = np.ones(len(validation), dtype=bool) if subset == "full" else b.complete_mask(validation)
        coverage[subset] = coverage_review(development.loc[dm], validation.loc[vm])
        deletions[subset] = deletion_sensitivity(validation.loc[vm], scores[vm])
        tails[subset] = tail_support(validation.loc[vm], scores[vm])
    return {
        "coverage": coverage,
        "psu_deletion_sensitivity": deletions,
        "validation_tails": tails,
        "sensitivity_matrix": sensitivity_matrix(prior, deletions),
    }


def aggregate_schema():
    old = b.aggregate_schema()
    old_subset = old["cohorts"]["validation_2024"]["subsets"]["full"]
    support = {
        "n": b.NUMBER,
        "sum_weights": b.NUMBER,
        "design": old_subset["design"],
        "age_support": old_subset["numeric_support"]["age_years"],
        "age_groups": {k: b.fields("n weight_share") for k in AGE_GROUPS},
        "categories": old_subset["categorical_support"],
    }
    coverage = {
        "frames": {k: support for k in ("development", "validation", "authorized_union")},
        **b.fields(
            "validation_psu_fraction_of_union validation_row_fraction_of_union validation_weight_fraction_of_union "
            "union_strata_absent_in_validation union_psus_in_absent_strata union_weight_share_in_absent_strata "
            "validation_singletons_with_additional_authorized_psus validation_singletons_unresolved_in_authorized_union "
            "validation_weight_share_in_singleton_strata"
        ),
        "union_psu_multiplicity_at_validation_singletons": b.fields("1 2 3 4 5_plus"),
        "age_group_share_difference_validation_minus_union_pp": dict.fromkeys(AGE_GROUPS, b.NUMBER),
        "category_max_abs_share_difference_validation_vs_union_pp": dict.fromkeys(b.CATEGORICAL, b.NUMBER),
    }
    deletion = {
        "method": {"exhaustive_observed_psu_deletion_not_sampling_uncertainty"},
        **b.fields(
            "deletions deletions_losing_a_stratum removed_weight_share_min removed_weight_share_max "
            "exact_max_cdf_movement_pp median_deletion_max_cdf_movement_pp"
        ),
        "anchors": {
            k: b.fields(
                "baseline_quantile baseline_cdf_pp cdf_change_min_pp cdf_change_max_pp "
                "cdf_abs_change_max_pp quantile_shift_min quantile_shift_max"
            )
            for k in ANCHORS
        },
    }
    return {
        "identity": {
            "baseline_commit": {BASELINE},
            "analysis_source_commit": "commit",
            "model_sha256": {b.EXPECTED_ARTIFACT_SHA256},
            "schema_version": {b.EXPECTED_SCHEMA_VERSION},
            "adapter_version": {b.ADAPTER_VERSION},
            "b_evidence_file_sha256": {B_FILE_SHA},
            "b_evidence_payload_sha256": {B_PAYLOAD_SHA},
            "reviewed_local_kdca_guide_sha256": {GUIDE_SHA},
            "source_sha256": old["identity"]["source_sha256"],
            "source_file_sha256": b.fields("script contract tests b_script split_script g3_manifest", b.HASH),
            "created_at_utc": "timestamp",
            "runtime_versions": old["identity"]["runtime_versions"],
            "weight": {"wt_itvex"},
            "cdf": {"right_inclusive"},
            "quantile": {"inverse_ecdf_no_interpolation"},
            "validity": {"research_only_no_product_authorization"},
        },
        "b_statistics_reproduced": {True},
        "committed_g3_metadata_only": {
            "annual_eligible_psus": {192},
            "final_role_psus": {27},
            "final_role_rows": {804},
        },
        "coverage": {k: coverage for k in SUBSETS},
        "psu_deletion_sensitivity": {k: deletion for k in SUBSETS},
        "validation_tails": {
            s: {k: b.fields("cutoff n psu strata weight_share kish_neff") for k in TAILS} for s in SUBSETS
        },
        "sensitivity_matrix": {
            s: {
                **b.fields(
                    "weighting_max_mapping_pp full_complete_max_mapping_pp temporal_max_mapping_pp "
                    "tie_left_right_max_pp tie_mid_right_max_pp observed_psu_deletion_max_mapping_pp"
                ),
                "candidate_lonely_method_interval_difference_pp": {None},
            }
            for s in SUBSETS
        },
        "uncertainty": {
            "decision": {"HOLD_SURVEY_UNCERTAINTY"},
            "confidence_intervals_computed": {False},
            "standard_errors_computed": {False},
            "lonely_psu_policy": {"fail_for_inference"},
            "methods": {k: {"not_estimated_design_assumptions_unresolved"} for k in METHODS},
        },
        "safety": {
            k: {False}
            for k in (
                "final_test_opened",
                "final_test_hashed",
                "final_test_scored",
                "retrained",
                "participant_output_written",
                "production_semantics_changed",
            )
        },
    }


def serialize_evidence(payload):
    b.validate_tree(payload, aggregate_schema())
    rounded = b.round_aggregates(payload)
    envelope = {"payload": rounded, "payload_sha256": hashlib.sha256(b.canonical(rounded)).hexdigest()}
    return json.dumps(envelope, sort_keys=True, indent=2, allow_nan=False) + "\n"


def identity(created_at):
    datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%SZ")
    files = {
        "script": SCRIPT,
        "contract": CONTRACT,
        "tests": TEST,
        "b_script": b.SCRIPT,
        "split_script": "scripts/data/prepare_model_v2_g3_split.py",
        "g3_manifest": "docs/research/model-v2-g3-split-manifest.md",
    }
    tracked = [
        *files.values(),
        B_EVIDENCE,
        b.CONTRACT,
        b.TEST,
        "app/services/model_v2_inference.py",
        "app/services/model_v2_input_adapter.py",
    ]
    for path in tracked:
        subprocess.run(["git", "ls-files", "--error-unmatch", path], cwd=REPO, check=True, capture_output=True)
    if subprocess.check_output(["git", "diff", "HEAD", "--", *tracked], cwd=REPO):
        raise ValueError("commit the research implementation and contract before analysis")
    inherited = b.identity(created_at)
    return {
        "baseline_commit": BASELINE,
        "analysis_source_commit": inherited["analysis_source_commit"],
        "model_sha256": b.EXPECTED_ARTIFACT_SHA256,
        "schema_version": b.EXPECTED_SCHEMA_VERSION,
        "adapter_version": b.ADAPTER_VERSION,
        "b_evidence_file_sha256": B_FILE_SHA,
        "b_evidence_payload_sha256": B_PAYLOAD_SHA,
        "reviewed_local_kdca_guide_sha256": GUIDE_SHA,
        "source_sha256": inherited["source_sha256"],
        "source_file_sha256": {k: b.sha256(REPO / p) for k, p in files.items()},
        "created_at_utc": created_at,
        "runtime_versions": inherited["runtime_versions"],
        "weight": "wt_itvex",
        "cdf": "right_inclusive",
        "quantile": "inverse_ecdf_no_interpolation",
        "validity": "research_only_no_product_authorization",
    }


def run(root, output, created_at, reference_model_sha=b.EXPECTED_ARTIFACT_SHA256):
    if reference_model_sha != b.EXPECTED_ARTIFACT_SHA256:
        raise ValueError("reference/model SHA mismatch")
    output = Path(output)
    if output.exists():
        raise ValueError("refusing to overwrite existing evidence")
    metadata, prior = identity(created_at), read_b_evidence()
    frames, pipeline = b.load_sources(root, reference_model_sha)
    payload = {
        "identity": metadata,
        "b_statistics_reproduced": True,
        "committed_g3_metadata_only": {"annual_eligible_psus": 192, "final_role_psus": 27, "final_role_rows": 804},
        **analyze(frames, pipeline, prior),
        "uncertainty": {
            "decision": "HOLD_SURVEY_UNCERTAINTY",
            "confidence_intervals_computed": False,
            "standard_errors_computed": False,
            "lonely_psu_policy": "fail_for_inference",
            "methods": dict.fromkeys(METHODS, "not_estimated_design_assumptions_unresolved"),
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
    parser.add_argument("--created-at", required=True)
    parser.add_argument("--reference-model-sha", default=b.EXPECTED_ARTIFACT_SHA256)
    args = parser.parse_args()
    try:
        digest = run(args.data_root, args.output, args.created_at, args.reference_model_sha)
    except (ValueError, OSError, RuntimeError, subprocess.SubprocessError):
        print("HOLD_SURVEY_UNCERTAINTY: prerequisite/integrity failure; no evidence published")
        return 1
    print(f"Aggregate evidence SHA-256 {digest}; conditional sensitivity only, no SE/CI")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
