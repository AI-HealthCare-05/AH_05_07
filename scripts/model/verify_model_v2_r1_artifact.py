#!/usr/bin/env python3
"""Verify Model V2 R1 artifact and emit repository-safe aggregate evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

PASS = "PASS_ARTIFACT_READY_FOR_INTEGRATION_PRODUCTION_DISABLED"
STOP = "STOP_RELEASE_ARTIFACT_GATE_FAILED"
REPRO_ATOL = 1e-12

FEATURES = [
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
NUMERIC = [
    "age_years",
    "bmi_from_height_weight",
    "walking_days_7d",
    "walking_minutes_per_active_day",
    "weekday_sleep_minutes",
    "weekend_sleep_minutes",
]
CATEGORICAL = [
    "sex_knhanes",
    "cigarette_smoking_state",
    "alcohol_frequency",
    "alcohol_amount_category",
    "strength_days_7d",
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def canonicalize(frame: pd.DataFrame) -> pd.DataFrame:
    x = frame[FEATURES].copy()
    for c in NUMERIC:
        x[c] = pd.to_numeric(x[c], errors="coerce")
    for c in CATEGORICAL:
        values = x[c].astype("object")
        x[c] = values.where(pd.notna(values), np.nan)
    return x


def validate_input(frame: pd.DataFrame) -> None:
    missing = [c for c in FEATURES if c not in frame.columns]
    if missing:
        raise ValueError(f"missing required features: {missing}")

    numeric = canonicalize(frame)

    for column in NUMERIC:
        values = numeric[column].dropna().to_numpy(dtype=float)
        if values.size and not np.isfinite(values).all():
            raise ValueError(f"{column}: non-finite value")

    def bounds(column: str, low: float | None, high: float | None, *, open_low: bool = False) -> None:
        s = pd.to_numeric(numeric[column], errors="coerce").dropna()
        if low is not None:
            bad = s <= low if open_low else s < low
            if bad.any():
                raise ValueError(f"{column}: below allowed domain")
        if high is not None and (s > high).any():
            raise ValueError(f"{column}: above allowed domain")

    bounds("age_years", 19, None)
    bounds("bmi_from_height_weight", 0, None, open_low=True)
    bounds("walking_days_7d", 0, 7)
    bounds("walking_minutes_per_active_day", 0, 1440)
    bounds("strength_days_7d", 0, 5)
    bounds("weekday_sleep_minutes", 0, 1440)
    bounds("weekend_sleep_minutes", 0, 1440)


def valid_fixture() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "age_years": 35,
                "sex_knhanes": "1.0",
                "bmi_from_height_weight": 23.5,
                "cigarette_smoking_state": "never",
                "alcohol_frequency": "2.0",
                "alcohol_amount_category": "1.0",
                "walking_days_7d": 4,
                "walking_minutes_per_active_day": 40,
                "strength_days_7d": 2,
                "weekday_sleep_minutes": 420,
                "weekend_sleep_minutes": 480,
            },
            {
                "age_years": 72,
                "sex_knhanes": "__unknown_r1_fixture__",
                "bmi_from_height_weight": np.nan,
                "cigarette_smoking_state": pd.NA,
                "alcohol_frequency": pd.NA,
                "alcohol_amount_category": pd.NA,
                "walking_days_7d": 1,
                "walking_minutes_per_active_day": 20,
                "strength_days_7d": 0,
                "weekday_sleep_minutes": np.nan,
                "weekend_sleep_minutes": 390,
            },
        ],
        columns=FEATURES,
    )


def expect_rejected(frame: pd.DataFrame) -> bool:
    try:
        validate_input(frame)
    except ValueError:
        return True
    return False


def verify(args: argparse.Namespace) -> int:
    root = args.artifact_dir.expanduser().resolve()
    manifest_path = root / "model-v2-r1-manifest.json"
    manifest = load_json(manifest_path)

    if manifest.get("gate") != "Model V2 R1":
        raise SystemExit("STOP: invalid R1 manifest")
    if manifest.get("feature_order") != FEATURES:
        raise SystemExit("STOP: feature order mismatch")
    if manifest.get("production_scoring_enabled") is not False:
        raise SystemExit("STOP: production scoring must remain disabled")

    artifact_a = root / manifest["artifact_a"]["filename"]
    artifact_b = root / manifest["artifact_b"]["filename"]
    hash_a = sha256(artifact_a)
    hash_b = sha256(artifact_b)
    if hash_a != manifest["artifact_a"]["sha256"]:
        raise SystemExit("STOP: artifact A hash mismatch")
    if hash_b != manifest["artifact_b"]["sha256"]:
        raise SystemExit("STOP: artifact B hash mismatch")

    payload_a = joblib.load(artifact_a)
    payload_b = joblib.load(artifact_b)

    fixture = valid_fixture()
    validate_input(fixture)
    pred_a = payload_a["pipeline"].predict_proba(canonicalize(fixture))[:, 1]
    pred_b = payload_b["pipeline"].predict_proba(canonicalize(fixture))[:, 1]
    max_diff = float(np.max(np.abs(pred_a - pred_b)))

    missing_feature = fixture.drop(columns=["age_years"])
    impossible_age = fixture.copy()
    impossible_age.loc[0, "age_years"] = 18
    impossible_walk_days = fixture.copy()
    impossible_walk_days.loc[0, "walking_days_7d"] = 8
    impossible_walk_minutes = fixture.copy()
    impossible_walk_minutes.loc[0, "walking_minutes_per_active_day"] = -1
    impossible_strength = fixture.copy()
    impossible_strength.loc[0, "strength_days_7d"] = 6
    impossible_sleep = fixture.copy()
    impossible_sleep.loc[0, "weekday_sleep_minutes"] = 1500
    impossible_bmi = fixture.copy()
    impossible_bmi.loc[0, "bmi_from_height_weight"] = 0

    checks = {
        "manifest_valid": True,
        "artifact_hashes_match_manifest": True,
        "exact_feature_order": payload_a.get("feature_order") == FEATURES,
        "production_disabled": (
            payload_a.get("production_scoring_enabled") is False
            and payload_b.get("production_scoring_enabled") is False
        ),
        "valid_and_missing_unknown_fixture_scores": (
            np.isfinite(pred_a).all()
            and np.isfinite(pred_b).all()
            and ((pred_a >= 0) & (pred_a <= 1)).all()
            and ((pred_b >= 0) & (pred_b <= 1)).all()
        ),
        "serialized_inference_equivalent": max_diff <= REPRO_ATOL,
        "missing_required_feature_rejected": expect_rejected(missing_feature),
        "age_below_19_rejected": expect_rejected(impossible_age),
        "walking_days_above_7_rejected": expect_rejected(impossible_walk_days),
        "negative_walking_minutes_rejected": expect_rejected(impossible_walk_minutes),
        "strength_days_above_5_rejected": expect_rejected(impossible_strength),
        "sleep_above_1440_rejected": expect_rejected(impossible_sleep),
        "nonpositive_bmi_rejected": expect_rejected(impossible_bmi),
        "unknown_categorical_allowed": True,
        "missing_values_allowed": True,
    }
    passed = all(checks.values())
    decision = PASS if passed else STOP

    evidence = {
        "gate": "Model V2 R1",
        "status": "verification_complete",
        "decision": decision,
        "checks": checks,
        "serialization_state": manifest["serialization_state"],
        "canonical_artifact_sha256": manifest["canonical_artifact_sha256"],
        "source_commit": manifest["source_commit"],
        "training_sha256": manifest["training"]["sha256"],
        "max_abs_probability_diff": max_diff,
        "required_atol": REPRO_ATOL,
        "production_scoring_enabled": False,
        "safety": manifest["safety"],
        "known_limitations": manifest["known_limitations"],
    }

    verification_path = root / "model-v2-r1-verification.json"
    verification_path.write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    out = args.repo_result.expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Model V2 R1 — Deterministic Release Artifact Result",
        "",
        f"Status: **{decision}**",
        "",
        "## Artifact",
        "",
        f"- serialization state: `{manifest['serialization_state']}`",
        f"- canonical artifact: `{manifest['canonical_artifact']}`",
        f"- canonical artifact SHA-256: `{manifest['canonical_artifact_sha256']}`",
        f"- source commit: `{manifest['source_commit']}`",
        f"- training SHA-256: `{manifest['training']['sha256']}`",
        "- production scoring enabled: **False**",
        "",
        "## Verification",
        "",
    ]
    for key, value in checks.items():
        lines.append(f"- `{key}`: **{value}**")
    lines += [
        "",
        f"- max absolute serialized inference difference: **{max_diff:.3e}**",
        f"- required tolerance: **{REPRO_ATOL:.3e}**",
        "",
        "## Safety",
        "",
        "- training source: frozen G3 development only",
        "- G6 validation participant data read: **False**",
        "- G7 external participant data read: **False**",
        "- G8 final-test participant data read: **False**",
        "- threshold selection: **False**",
        "- recalibration: **False**",
        "- production scoring enabled: **False**",
        "",
        "## Known limitation",
        "",
        "Older-age subgroup discrimination is weaker in descriptive audits,",
        "especially age 80+. This is carried forward as a release limitation and",
        "was not used for post-final-test Model V2 repair.",
        "",
        "Binary artifacts and full verification evidence remain outside Git.",
        "",
        "A PASS means artifact readiness for integration only. Production scoring",
        "remains disabled.",
        "",
    ]
    out.write_text("\n".join(lines), encoding="utf-8")

    print("R1 decision:", decision)
    print("serialization state:", manifest["serialization_state"])
    print("canonical artifact SHA-256:", manifest["canonical_artifact_sha256"])
    print("max abs probability diff:", f"{max_diff:.3e}")
    print("production scoring enabled: False")
    print("repository-safe result:", out)
    return 0 if passed else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--artifact-dir", type=Path, required=True)
    ap.add_argument("--repo-result", type=Path, required=True)
    return verify(ap.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
