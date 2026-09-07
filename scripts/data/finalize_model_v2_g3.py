#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    data = json.loads(args.manifest.expanduser().resolve().read_text(encoding="utf-8"))
    out_path = args.out.expanduser().resolve()

    required_false = [
        "participant_ids_in_manifest",
        "validation_target_distribution_written",
        "final_test_target_distribution_written",
        "model_fitting_performed",
        "performance_metrics_computed",
        "validation_performance_accessed",
        "final_test_performance_accessed",
    ]
    safety = data["safety"]
    bad = [key for key in required_false if safety.get(key) is not False]
    if bad:
        raise SystemExit(f"STOP: unsafe G3 manifest flags: {bad}")

    rows = data["role_rows"]
    clusters = data["role_cluster_counts"]
    total_clusters = sum(int(v) for v in clusters.values())
    if total_clusters != 192:
        raise SystemExit(f"STOP: expected 192 PSU roles, got {total_clusters}")

    lines = [
        "# Model V2 G3 — Repository-safe Split Manifest",
        "",
        "Aggregate/provenance information only. No participant identifiers or row-level",
        "validation/final-test outcomes are stored in Git.",
        "",
        "## Source",
        "",
        f"- file: `{data['source']['file']}`",
        f"- SHA-256: `{data['source']['sha256']}`",
        f"- split namespace: `{data['split_namespace']}`",
        f"- split unit: `{', '.join(data['split_unit'])}`",
        "",
        "## Frozen role counts",
        "",
        "| Role | Rows | PSU clusters | Access |",
        "| --- | ---: | ---: | --- |",
        f"| development | {int(rows['development']):,} | {int(clusters['development']):,} | G4/G5 |",
        f"| validation | {int(rows['validation']):,} | {int(clusters['validation']):,} | locked until G6 |",
        f"| final internal test | {int(rows['final_test']):,} | {int(clusters['final_test']):,} | locked until explicit G8 approval |",
        "",
        f"- eligible cohort rows: **{sum(int(v) for v in rows.values()):,}**",
        f"- assigned PSU clusters: **{total_clusters} / 192**",
        "",
        "Role thresholds are applied to deterministic PSU hashes; row proportions",
        "therefore need not be exactly 70/15/15.",
        "",
        "## Safety state",
        "",
    ]

    lines.extend(f"- `{key}`: **False**" for key in required_false)
    lines.extend(
        [
            "",
            "## Gate state",
            "",
            "- model fitting: **not performed**",
            "- validation performance: **not accessed**",
            "- final-test performance: **not accessed**",
            "- production scoring: **disabled**",
            "",
            "Participant-level role files remain outside Git.",
            "",
        ]
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print("wrote:", out_path)
    print("rows:", rows)
    print("clusters:", clusters)
    print("G3 repository-safe manifest: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
