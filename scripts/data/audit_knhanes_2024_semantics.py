#!/usr/bin/env python3
"""
KNHANES 2024 G2-A semantic metadata audit.

Reads ONLY the official hn24_all SAS metadata and selected low-cardinality
aggregate counts. It does not fit models, create splits, compute performance
metrics, rank features, calibrate, or select thresholds.

Primary purpose:
- recover official Korean variable labels/value labels embedded in SAS
- identify exact BP / hypertension / anthropometry / smoking / alcohol /
  physical-activity / sleep variables by semantics, not only column names
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import UTC, datetime
from pathlib import Path

import pyreadstat

EXPECTED_NAMES = {"hn24_all.sas7bdat"}

DOMAIN_KEYWORDS = {
    "blood_pressure": ["혈압", "수축기", "이완기"],
    "hypertension": ["고혈압", "혈압약", "의사진단", "현재 치료"],
    "age": ["만나이", "연령", "나이"],
    "sex_gender": ["성별", "남자", "여자"],
    "anthropometry": ["신장", "키", "체중", "허리둘레", "체질량지수", "BMI"],
    "smoking": ["흡연", "담배", "궐련", "전자담배", "니코틴"],
    "alcohol": ["음주", "술", "알코올"],
    "physical_activity": ["신체활동", "운동", "걷기", "유산소"],
    "sleep": ["수면", "잠", "취침", "기상", "평일 수면", "주중 수면", "주말 수면"],
}

NAME_HINTS = {
    "blood_pressure": re.compile(r"^HE_(?:sbp|dbp)(?:[123])?$", re.I),
    "hypertension": re.compile(r"^(?:DI1_|HE_HP)", re.I),
    "age": re.compile(r"^age$", re.I),
    "sex_gender": re.compile(r"^sex$", re.I),
    "anthropometry": re.compile(r"^HE_(?:ht|wt|wc|BMI|BMI_pct)$", re.I),
    "smoking": re.compile(r"^(?:BS|sm_)", re.I),
    "alcohol": re.compile(r"^BD", re.I),
    "physical_activity": re.compile(r"^(?:BE|pa_)", re.I),
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def find_main(root: Path) -> Path:
    raw = root / "raw"
    candidates = [p.resolve() for p in raw.rglob("hn24_all.sas7bdat") if p.is_file()]
    if not candidates:
        raise SystemExit(f"STOP: hn24_all.sas7bdat not found under {raw}")

    hashes = {}
    for p in candidates:
        hashes.setdefault(sha256(p), []).append(p)

    if len(hashes) > 1:
        raise SystemExit(
            "STOP: multiple non-identical hn24_all.sas7bdat files found. Resolve provenance before semantic audit."
        )

    return sorted(candidates)[0]


def text_matches(label: str, keywords: list[str]) -> bool:
    normalized = (label or "").strip()
    return any(k.lower() in normalized.lower() for k in keywords)


def sanitize_value(v):
    if v is None:
        return None
    if isinstance(v, (str, int, float, bool)):
        return v
    return str(v)


def discover_domains(
    names: list[str],
    name_to_label: dict[str, str | None],
) -> tuple[dict[str, list[str]], list[str]]:
    domains = {key: [] for key in DOMAIN_KEYWORDS}

    for name in names:
        label = name_to_label.get(name) or ""
        for domain, keywords in DOMAIN_KEYWORDS.items():
            hint = NAME_HINTS.get(domain)
            by_label = text_matches(label, keywords)
            by_name = bool(hint and hint.search(name))
            if by_label or by_name:
                domains[domain].append(name)

    for domain, values in domains.items():
        domains[domain] = list(dict.fromkeys(values))

    selected = list(dict.fromkeys(name for domain_names in domains.values() for name in domain_names))
    return domains, selected


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, type=Path)
    args = ap.parse_args()

    root = args.root.expanduser().resolve()
    audit_dir = root / "audit"
    audit_dir.mkdir(parents=True, exist_ok=True)

    sas = find_main(root)

    # Metadata-only first: exact variable labels and value-label dictionaries.
    _, meta = pyreadstat.read_sas7bdat(str(sas), metadataonly=True)

    names = list(meta.column_names)
    name_to_label = dict(meta.column_names_to_labels or {})
    variable_value_labels = dict(meta.variable_value_labels or {})

    domains, selected = discover_domains(names, name_to_label)

    # Read only semantically selected columns to obtain aggregate code counts.
    # 6,997 rows means this remains a bounded audit, not model development.
    df, _ = pyreadstat.read_sas7bdat(
        str(sas),
        usecols=selected if selected else None,
    )

    variable_records = {}
    for name in selected:
        s = df[name]
        unique_non_null = int(s.nunique(dropna=True))

        code_counts = None
        if unique_non_null <= 30:
            vc = s.value_counts(dropna=False)
            code_counts = {str(sanitize_value(k)): int(v) for k, v in vc.items()}

        raw_labels = variable_value_labels.get(name, {}) or {}
        value_labels = {str(sanitize_value(k)): str(v) for k, v in raw_labels.items()}

        variable_records[name] = {
            "label": name_to_label.get(name),
            "dtype": str(s.dtype),
            "non_null": int(s.notna().sum()),
            "missing": int(s.isna().sum()),
            "n_unique_non_null": unique_non_null,
            "value_labels": value_labels,
            "aggregate_code_counts_if_low_cardinality": code_counts,
        }

    out = {
        "audit_gate": "Model V2 G2-A",
        "dataset": "KNHANES 2024 annual main DB",
        "source": {
            "file": sas.name,
            "sha256": sha256(sas),
            "rows_reported_by_metadata": meta.number_rows,
            "columns_reported_by_metadata": meta.number_columns,
        },
        "created_at_utc": datetime.now(UTC).isoformat(),
        "semantic_source": "official SAS variable labels/value labels embedded in hn24_all",
        "domains": domains,
        "variables": variable_records,
        "safety": {
            "participant_values_written": False,
            "model_fitting_performed": False,
            "split_performed": False,
            "performance_metrics_computed": False,
            "feature_ranking_performed": False,
            "calibration_performed": False,
            "threshold_selection_performed": False,
        },
        "unresolved_after_this_audit": [
            "Final target formula is not selected by this script.",
            "Product feature set is not selected by this script.",
            "Survey-weight modelling role remains unresolved.",
            "2022/2023 pooling remains unapproved.",
            "Every selected semantic mapping should be checked against the downloaded official user guide/codebook before G3 freeze.",
        ],
    }

    outfile = audit_dir / "semantic-audit-2024-main.json"
    outfile.write_text(
        json.dumps(out, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("=== KNHANES 2024 G2-A semantic metadata audit ===")
    print(f"source: {sas.name}")
    print(f"metadata rows={meta.number_rows} cols={meta.number_columns}")

    for domain in (
        "blood_pressure",
        "hypertension",
        "age",
        "sex_gender",
        "anthropometry",
        "smoking",
        "alcohol",
        "physical_activity",
        "sleep",
    ):
        print(f"\n[{domain}]")
        for name in domains[domain]:
            label = name_to_label.get(name) or ""
            print(f"  {name}: {label}")

    print(f"\nwrote: {outfile}")
    for k, v in out["safety"].items():
        print(f"{k}: {v}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
