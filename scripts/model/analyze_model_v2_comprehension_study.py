#!/usr/bin/env python3
"""B4: human-comprehension study protocol synthetic dry-run.

Generate synthetic response data, test scoring, randomization, missing/invalid
handling, critical-item gating, confidence-bound calculation, and deterministic
report generation. No real participants.
"""

from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[2]
SCRIPT = "scripts/model/analyze_model_v2_comprehension_study.py"
TEST = "tests/model/test_model_v2_comprehension_study.py"
CONTRACT = "docs/research/model-v2-comprehension-study-protocol.md"

# Frozen reference comparator identity carried forward from B3.
B3_BASELINE = "b2bd45aa78971e8bb23e13283db0e3a6b8e4cb1f"
B3_EVIDENCE = "docs/evidence/model-v2-finite-reference.json"

ARMS = ["A", "B", "C", "D", "E"]
ARM_LABELS = {
    "A": "Current-style raw output",
    "B": "Named finite-reference percentile",
    "C": "Distribution marker without percentile number",
    "D": "100-position explanation",
    "E": "No comparison",
}

CRITICAL_ITEMS = [
    {"id": "q1", "construct": "disease_probability", "correct": False},
    {"id": "q2", "construct": "peer_match", "correct": False},
    {"id": "q3", "construct": "health_severity", "correct": False},
    {"id": "q4", "construct": "diagnosis", "correct": False},
    {"id": "q5", "construct": "causal_improvement", "correct": False},
    {"id": "q6", "construct": "actual_comparator", "correct": "frozen_reference"},
]

QUESTION_TEXT_BY_ARM = {
    "A": {
        "q1": "표시된 내부 연속 출력은 질환이 있을 확률을 뜻하는가?",
        "q2": "표시된 내부 연속 출력은 나이·성별이 비슷한 사람만 비교한 값인가?",
        "q3": "표시된 내부 연속 출력은 건강상태의 좋고 나쁨이나 심각도를 뜻하는가?",
        "q4": "표시된 내부 연속 출력은 진단인가?",
        "q5": "나중에 내부 연속 출력이 낮아지면 생활습관 때문에 건강이 좋아졌다고 증명되는가?",
        "q6": "이 화면에서 실제로 보여주는 값은 무엇인가?",
    },
    "B": {
        "q1": "표시된 약 82백분위는 질환이 있을 확률 82%를 뜻하는가?",
        "q2": "표시된 약 82백분위는 나이·성별이 비슷한 사람만 비교한 값인가?",
        "q3": "표시된 약 82백분위는 건강상태가 나쁜 사람 중 상위 18%를 뜻하는가?",
        "q4": "표시된 약 82백분위는 진단인가?",
        "q5": "나중에 이 위치가 낮아지면 생활습관 때문에 건강이 좋아졌다고 증명되는가?",
        "q6": "이 위치를 계산할 때 실제로 비교되는 대상은 무엇인가?",
    },
    "C": {
        "q1": "분포 위의 표시 위치는 질환이 있을 확률을 뜻하는가?",
        "q2": "분포 위의 표시 위치는 나이·성별이 비슷한 사람만 비교한 값인가?",
        "q3": "분포 위의 표시 위치는 건강상태의 좋고 나쁨이나 심각도를 뜻하는가?",
        "q4": "분포 위의 표시 위치는 진단인가?",
        "q5": "나중에 표시 위치가 낮아지면 생활습관 때문에 건강이 좋아졌다고 증명되는가?",
        "q6": "이 분포 위치를 계산할 때 실제로 비교되는 대상은 무엇인가?",
    },
    "D": {
        "q1": "표시된 약 82번째 지점은 질환이 있을 확률 82%를 뜻하는가?",
        "q2": "표시된 약 82번째 지점은 나이·성별이 비슷한 사람만 비교한 값인가?",
        "q3": "표시된 약 82번째 지점은 건강상태가 나쁜 사람 중 상위 18%를 뜻하는가?",
        "q4": "표시된 약 82번째 지점은 진단인가?",
        "q5": "나중에 이 위치가 낮아지면 생활습관 때문에 건강이 좋아졌다고 증명되는가?",
        "q6": "이 위치를 계산할 때 실제로 비교되는 대상은 무엇인가?",
    },
    "E": {
        "q1": "표시된 내부 연속 출력은 질환이 있을 확률을 뜻하는가?",
        "q2": "표시된 내부 연속 출력은 나이·성별이 비슷한 사람만 비교한 값인가?",
        "q3": "표시된 내부 연속 출력은 건강상태의 좋고 나쁨이나 심각도를 뜻하는가?",
        "q4": "표시된 내부 연속 출력은 진단인가?",
        "q5": "나중에 내부 연속 출력이 낮아지면 생활습관 때문에 건강이 좋아졌다고 증명되는가?",
        "q6": "이 화면에서 실제로 보여주는 값은 무엇인가?",
    },
}

DEFAULT_CREATED_AT_UTC = "2026-09-19T04:00:00Z"


def question_text(arm: str, item_id: str) -> str:
    # Return neutral arm-specific wording for one fixed comprehension construct.
    if arm not in QUESTION_TEXT_BY_ARM:
        raise ValueError("unknown arm")
    try:
        return QUESTION_TEXT_BY_ARM[arm][item_id]
    except KeyError as exc:
        raise ValueError("unknown critical item") from exc


# Synthetic correctness probabilities per arm and item for the dry-run.
SYNTHETIC_PROBABILITIES: dict[str, list[float]] = {
    "A": [0.95, 0.93, 0.92, 0.94, 0.90, 0.88],
    "B": [0.85, 0.92, 0.91, 0.93, 0.89, 0.86],
    "C": [0.90, 0.91, 0.90, 0.92, 0.88, 0.82],
    "D": [0.78, 0.90, 0.89, 0.91, 0.87, 0.85],
    "E": [0.96, 0.94, 0.93, 0.95, 0.91, 0.87],
}

Q6_CORRECT_LABEL = "frozen_reference"
Q6_INCORRECT_LABELS = ["peer_comparison", "disease_probability", "diagnosis", "unsure"]


def binomial_sf(k: int, n: int, p: float) -> float:
    """Return P(X >= k) for X ~ Binomial(n, p)."""
    if k <= 0:
        return 1.0
    if k > n:
        return 0.0
    if p <= 0.0:
        return 0.0
    if p >= 1.0:
        return 1.0
    log_p = math.log(p)
    log_q = math.log1p(-p)
    log_n_fact = math.lgamma(n + 1)
    total = 0.0
    for i in range(k, n + 1):
        log_term = log_n_fact - math.lgamma(i + 1) - math.lgamma(n - i + 1)
        log_term += i * log_p + (n - i) * log_q
        total += math.exp(log_term)
    return min(total, 1.0)


def clopper_pearson_lower(k: int, n: int, alpha: float = 0.05) -> float:
    """Exact one-sided lower 95% confidence bound for a binomial proportion."""
    if n == 0:
        return 0.0
    if not 0 <= k <= n:
        raise ValueError("k must be in [0, n]")
    if k == 0:
        return 0.0
    if k == n:
        return alpha ** (1.0 / n)
    lo, hi = 0.0, 1.0
    for _ in range(80):
        mid = (lo + hi) / 2.0
        if binomial_sf(k, n, mid) > alpha:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2.0


def generate_synthetic_responses(
    n_per_arm: int = 60,
    missing_rate: float = 0.03,
    invalid_rate: float = 0.02,
    seed: int = 20260919,
) -> list[dict[str, Any]]:
    """Generate deterministic synthetic comprehension responses."""
    rng = random.Random(seed)
    rows: list[dict[str, Any]] = []
    participant_id = 0
    for arm in ARMS:
        probs = SYNTHETIC_PROBABILITIES[arm]
        for _ in range(n_per_arm):
            participant_id += 1
            row: dict[str, Any] = {
                "participant_id": f"synthetic-{participant_id:04d}",
                "arm": arm,
                "responses": {},
            }
            for idx, item in enumerate(CRITICAL_ITEMS):
                draw = rng.random()
                if draw < missing_rate:
                    row["responses"][item["id"]] = None
                elif draw < missing_rate + invalid_rate:
                    row["responses"][item["id"]] = "invalid"
                else:
                    if item["id"] == "q6":
                        if rng.random() < probs[idx]:
                            row["responses"][item["id"]] = Q6_CORRECT_LABEL
                        else:
                            row["responses"][item["id"]] = rng.choice(Q6_INCORRECT_LABELS)
                    else:
                        if rng.random() < probs[idx]:
                            row["responses"][item["id"]] = item["correct"]
                        else:
                            row["responses"][item["id"]] = not item["correct"]
            rows.append(row)
    return rows


def score_response(item: dict[str, Any], response: Any) -> bool:
    """Score a single response. Missing/invalid/unsure are incorrect."""
    if response is None or response == "invalid" or response == "unsure":
        return False
    return response == item["correct"]


def score_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Add scored flags to each row."""
    scored: list[dict[str, Any]] = []
    for row in rows:
        item_scores = {}
        for item in CRITICAL_ITEMS:
            item_scores[item["id"]] = score_response(item, row["responses"].get(item["id"]))
        scored.append({**row, "item_scores": item_scores, "all_correct": all(item_scores.values())})
    return scored


def arm_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Summarize one arm's scored responses."""
    n = len(rows)
    missing = sum(1 for row in rows for item in CRITICAL_ITEMS if row["responses"].get(item["id"]) is None)
    invalid = sum(1 for row in rows for item in CRITICAL_ITEMS if row["responses"].get(item["id"]) == "invalid")
    item_stats = {}
    for item in CRITICAL_ITEMS:
        correct = sum(row["item_scores"][item["id"]] for row in rows)
        lb = clopper_pearson_lower(correct, n)
        item_stats[item["id"]] = {
            "correct": correct,
            "rate": correct / n if n else 0.0,
            "lower_bound_95": lb,
            "pass_observed": correct / n >= 0.90 if n else False,
            "pass_bound": lb >= 0.80,
        }
    overall_correct = sum(sum(row["item_scores"].values()) for row in rows)
    all_correct_count = sum(row["all_correct"] for row in rows)
    return {
        "n": n,
        "missing_responses": missing,
        "invalid_responses": invalid,
        "item_stats": item_stats,
        "overall_understanding": overall_correct / (n * len(CRITICAL_ITEMS)) if n else 0.0,
        "all_correct_rate": all_correct_count / n if n else 0.0,
        "all_correct_lower_bound": clopper_pearson_lower(all_correct_count, n),
        "passes_gating": (
            all(stats["pass_observed"] and stats["pass_bound"] for stats in item_stats.values())
            and (overall_correct / (n * len(CRITICAL_ITEMS)) >= 0.80 if n else False)
        ),
    }


def summarize_by_arm(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Return summaries keyed by arm."""
    by_arm: dict[str, list[dict[str, Any]]] = {arm: [] for arm in ARMS}
    for row in rows:
        by_arm[row["arm"]].append(row)
    return {arm: arm_summary(by_arm[arm]) for arm in ARMS}


def sample_size_table(
    sample_sizes: tuple[int, ...] = (50, 100, 200, 300, 500, 1000),
    true_rates: tuple[float, ...] = (0.80, 0.85, 0.90, 0.95),
) -> list[dict[str, Any]]:
    """Operating-characteristic table for per-item gating."""
    table: list[dict[str, Any]] = []
    for n in sample_sizes:
        # Smallest k with observed rate >= 90%.
        min_obs_k = math.ceil(0.90 * n)
        # Smallest k with one-sided 95% lower bound >= 80%.
        lo, hi = 0, n + 1
        while lo < hi:
            mid = (lo + hi) // 2
            if mid <= n and clopper_pearson_lower(mid, n) >= 0.80:
                hi = mid
            else:
                lo = mid + 1
        min_lb_k = lo if lo <= n else n + 1
        min_pass_k = max(min_obs_k, min_lb_k)

        for p in true_rates:
            p_obs_ge_90 = binomial_sf(min_obs_k, n, p)
            p_lb_ge_80 = binomial_sf(min_lb_k, n, p)
            p_pass = binomial_sf(min_pass_k, n, p)
            table.append(
                {
                    "n": n,
                    "true_rate": p,
                    "p_obs_ge_90": round(p_obs_ge_90, 4),
                    "p_lb_ge_80": round(p_lb_ge_80, 4),
                    "p_pass": round(p_pass, 4),
                }
            )
    return table


def deterministic_report(
    seed: int = 20260919,
    created_at_utc: str = DEFAULT_CREATED_AT_UTC,
) -> dict[str, Any]:
    """Run the full synthetic dry-run with no hidden wall-clock dependency."""
    rows = generate_synthetic_responses(seed=seed)
    scored = score_rows(rows)
    by_arm = summarize_by_arm(scored)
    table = sample_size_table()
    return {
        "protocol_baseline": B3_BASELINE,
        "created_at_utc": created_at_utc,
        "synthetic": True,
        "note": "SYNTHETIC DRY-RUN ONLY; NOT EVIDENCE FROM REAL USERS",
        "n_total": len(scored),
        "by_arm": by_arm,
        "sample_size_table": table,
    }


def render_markdown(report: dict[str, Any]) -> str:
    """Render a concise Markdown report."""
    lines: list[str] = [
        "# B4 Synthetic Dry-run Report",
        "",
        f"**Baseline:** `{report['protocol_baseline']}`",
        f"**Created:** {report['created_at_utc']}",
        f"**{report['note']}**",
        "",
        f"Total synthetic participants: {report['n_total']}",
        "",
        "## Arm-level summary",
        "",
        "| Arm | n | All-correct rate | Overall understanding | Passes gating |",
        "| --- | --- | --- | --- | --- |",
    ]
    for arm in ARMS:
        s = report["by_arm"][arm]
        lines.append(
            f"| {arm} | {s['n']} | {s['all_correct_rate']:.2%} | {s['overall_understanding']:.2%} | {'PASS' if s['passes_gating'] else 'FAIL'} |"
        )
    lines.extend(["", "## Per-item results", ""])
    for arm in ARMS:
        lines.append(f"### Arm {arm}")
        lines.append("| Item | Correct | Rate | 95% LB | Obs >=90% | LB >=80% |")
        lines.append("| --- | --- | --- | --- | --- | --- |")
        for item in CRITICAL_ITEMS:
            stats = report["by_arm"][arm]["item_stats"][item["id"]]
            lines.append(
                f"| {item['id']} | {stats['correct']} | {stats['rate']:.2%} | {stats['lower_bound_95']:.2%} | {'Y' if stats['pass_observed'] else 'N'} | {'Y' if stats['pass_bound'] else 'N'} |"
            )
        lines.append("")
    lines.extend(["## Sample-size / operating-characteristic table", ""])
    lines.append(
        "Probability that one critical item passes both the observed-rate (>=90%) "
        "and one-sided 95% lower-bound (>=80%) gates. This is not arm-level joint power."
    )
    lines.append("")
    lines.append("| n | true_rate | P(obs>=90%) | P(LB>=80%) | P(pass both) |")
    lines.append("| --- | --- | --- | --- | --- |")
    for row in report["sample_size_table"]:
        lines.append(
            f"| {row['n']} | {row['true_rate']:.2f} | {row['p_obs_ge_90']:.4f} | {row['p_lb_ge_80']:.4f} | {row['p_pass']:.4f} |"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=20260919)
    parser.add_argument("--output", type=Path, help="optional JSON output path")
    parser.add_argument(
        "--created-at",
        default=DEFAULT_CREATED_AT_UTC,
        help="explicit metadata timestamp; defaults to the frozen B4 protocol timestamp",
    )
    args = parser.parse_args()
    report = deterministic_report(seed=args.seed, created_at_utc=args.created_at)
    print(render_markdown(report))
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(report, sort_keys=True, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
