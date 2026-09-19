from __future__ import annotations

import argparse
import asyncio
import json
import math
import threading
import time
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
from deadline_arm_a import (
    AUTH_PATH,
    BP_PATH,
    CHALLENGE_RPC_PATH,
    LEGACY_PATH,
    SCENARIOS,
    DependencyServer,
    DependencyState,
    wait_dependency_quiet,
)

LOGICAL_READ_BUDGET_S = 8.0
UPSTREAM_HOP_CAP_S = 5.0
SERVER_BUDGETS_S = (6.5, 7.0, 7.5)
RETRY_MARGIN_S = 0.25


def utc() -> str:
    return datetime.now(UTC).isoformat()


def percentile(values: list[float], probability: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = (len(ordered) - 1) * probability
    low = math.floor(index)
    high = math.ceil(index)
    return ordered[low] + (ordered[high] - ordered[low]) * (index - low)


class BudgetExpiredError(Exception):
    pass


def attempt_result(
    started: float,
    status: int,
    code: str | None,
    server_budget_s: float,
) -> dict[str, Any]:
    return {
        "status": status,
        "code": code,
        "elapsed_ms": (time.perf_counter() - started) * 1000,
        "server_budget_s": max(server_budget_s, 0.0),
    }


async def request_with_remaining_budget(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    server_deadline: float,
    *,
    json_body: dict[str, str] | None = None,
) -> httpx.Response:
    remaining = min(UPSTREAM_HOP_CAP_S, server_deadline - time.monotonic())
    if remaining <= 0:
        raise BudgetExpiredError

    try:
        return await asyncio.wait_for(
            client.request(method, url, json=json_body),
            timeout=remaining,
        )
    except (TimeoutError, httpx.HTTPError) as error:
        raise BudgetExpiredError from error


async def authenticate_candidate(
    client: httpx.AsyncClient,
    dependency_url: str,
    server_deadline: float,
    attempt_started: float,
    server_budget_s: float,
) -> dict[str, Any] | None:
    try:
        response = await request_with_remaining_budget(
            client,
            "GET",
            dependency_url + AUTH_PATH,
            server_deadline,
        )
    except BudgetExpiredError:
        return attempt_result(
            attempt_started,
            503,
            "auth_unavailable",
            server_budget_s,
        )

    if response.status_code in {401, 403}:
        return attempt_result(
            attempt_started,
            401,
            "supabase_session_invalid",
            server_budget_s,
        )
    if response.status_code != 200:
        return attempt_result(
            attempt_started,
            503,
            "auth_unavailable",
            server_budget_s,
        )
    return None


async def fetch_candidate_data(
    client: httpx.AsyncClient,
    dependency_url: str,
    server_deadline: float,
) -> list[httpx.Response]:
    async def bp() -> httpx.Response:
        return await request_with_remaining_budget(
            client,
            "GET",
            dependency_url + BP_PATH,
            server_deadline,
        )

    async def legacy() -> httpx.Response:
        return await request_with_remaining_budget(
            client,
            "GET",
            dependency_url + LEGACY_PATH,
            server_deadline,
        )

    async def challenge() -> httpx.Response:
        return await request_with_remaining_budget(
            client,
            "POST",
            dependency_url + CHALLENGE_RPC_PATH,
            server_deadline,
            json_body={
                "p_start_on": "2026-09-01",
                "p_end_on": "2026-09-07",
            },
        )

    tasks = [
        asyncio.create_task(bp()),
        asyncio.create_task(legacy()),
        asyncio.create_task(challenge()),
    ]
    try:
        return list(await asyncio.gather(*tasks))
    except BudgetExpiredError:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        raise


def candidate_shape_ok(responses: list[httpx.Response]) -> bool:
    if any(response.status_code >= 400 for response in responses):
        return False
    try:
        blood_pressure = responses[0].json()
        challenge_events = responses[1].json()
        challenge_window = responses[2].json()
    except ValueError:
        return False
    return (
        isinstance(blood_pressure, list)
        and isinstance(challenge_events, list)
        and isinstance(challenge_window, dict)
        and "active_challenge" in challenge_window
        and isinstance(challenge_window.get("challenge_checkins"), list)
    )


async def candidate_attempt(
    client: httpx.AsyncClient,
    dependency_url: str,
    server_budget_s: float,
    logical_deadline: float,
) -> dict[str, Any]:
    attempt_started = time.perf_counter()
    logical_remaining = logical_deadline - time.monotonic()
    usable_server_budget = min(server_budget_s, logical_remaining)
    if usable_server_budget <= 0:
        return attempt_result(
            attempt_started,
            0,
            "request_timeout",
            0.0,
        )

    server_deadline = time.monotonic() + usable_server_budget
    auth_failure = await authenticate_candidate(
        client,
        dependency_url,
        server_deadline,
        attempt_started,
        usable_server_budget,
    )
    if auth_failure is not None:
        return auth_failure

    try:
        responses = await fetch_candidate_data(
            client,
            dependency_url,
            server_deadline,
        )
    except BudgetExpiredError:
        return attempt_result(
            attempt_started,
            503,
            "observation_storage_not_ready",
            usable_server_budget,
        )

    if not candidate_shape_ok(responses):
        return attempt_result(
            attempt_started,
            503,
            "observation_storage_not_ready",
            usable_server_budget,
        )
    return attempt_result(
        attempt_started,
        200,
        None,
        usable_server_budget,
    )


def retryable(attempt: dict[str, Any]) -> bool:
    return (attempt["status"] == 0 and attempt["code"] in {"network_error", "request_timeout"}) or attempt[
        "status"
    ] in {502, 503, 504}


async def maybe_retry(
    client: httpx.AsyncClient,
    dependency_url: str,
    server_budget_s: float,
    logical_deadline: float,
    first_attempt: dict[str, Any],
    retry_floor_s: float,
) -> dict[str, Any] | None:
    remaining = logical_deadline - time.monotonic()
    if not retryable(first_attempt) or remaining < retry_floor_s:
        return None

    try:
        return await asyncio.wait_for(
            candidate_attempt(
                client,
                dependency_url,
                server_budget_s,
                logical_deadline,
            ),
            timeout=max(remaining, 0.001),
        )
    except TimeoutError:
        return {
            "status": 0,
            "code": "request_timeout",
            "elapsed_ms": max(remaining, 0.0) * 1000,
            "server_budget_s": max(remaining, 0.0),
        }


async def coordinated_logical_load(
    dependency_url: str,
    state: DependencyState,
    server_budget_s: float,
    retry_floor_s: float,
) -> dict[str, Any]:
    logical_started = time.monotonic()
    logical_deadline = logical_started + LOGICAL_READ_BUDGET_S
    before = state.snapshot()

    async with httpx.AsyncClient(timeout=None, trust_env=False) as client:
        first = await candidate_attempt(
            client,
            dependency_url,
            server_budget_s,
            logical_deadline,
        )
        attempts = [first]
        second = await maybe_retry(
            client,
            dependency_url,
            server_budget_s,
            logical_deadline,
            first,
            retry_floor_s,
        )
        if second is not None:
            attempts.append(second)

    user_visible_elapsed_ms = (time.monotonic() - logical_started) * 1000
    await wait_dependency_quiet(state, timeout_s=8.0)
    quiescence_elapsed_ms = (time.monotonic() - logical_started) * 1000

    after = state.snapshot()
    calls = Counter(after["calls"]) - Counter(before["calls"])
    final = attempts[-1]
    return {
        "status": final["status"],
        "code": final["code"],
        "user_visible_elapsed_ms": user_visible_elapsed_ms,
        "quiescence_elapsed_ms": quiescence_elapsed_ms,
        "attempt_count": len(attempts),
        "retry_count": len(attempts) - 1,
        "attempts": attempts,
        "upstream_calls": dict(calls),
    }


def summarize(samples: list[dict[str, Any]]) -> dict[str, Any]:
    visible = [float(sample["user_visible_elapsed_ms"]) for sample in samples]
    quiescence = [float(sample["quiescence_elapsed_ms"]) for sample in samples]
    status_counts = Counter(str(sample["status"]) for sample in samples)
    retries = [int(sample["retry_count"]) for sample in samples]
    auth_calls = [int(sample["upstream_calls"].get("auth", 0)) for sample in samples]
    data_calls = [int(sample["upstream_calls"].get("data", 0)) for sample in samples]

    return {
        "sample_count": len(samples),
        "status_counts": dict(status_counts),
        "completion_rate": status_counts.get("200", 0) / len(samples),
        "user_visible_latency_ms": {
            "p50": percentile(visible, 0.50),
            "p95": percentile(visible, 0.95),
            "p99": percentile(visible, 0.99),
            "max": max(visible),
        },
        "dependency_quiescence_latency_ms": {
            "p50": percentile(quiescence, 0.50),
            "p95": percentile(quiescence, 0.95),
            "max": max(quiescence),
        },
        "retry_count": {
            "total": sum(retries),
            "max_per_logical_load": max(retries),
        },
        "upstream_auth_calls": {
            "total": sum(auth_calls),
            "max_per_logical_load": max(auth_calls),
        },
        "upstream_data_calls": {
            "total": sum(data_calls),
            "max_per_logical_load": max(data_calls),
        },
    }


async def measure_scenario(
    dependency_url: str,
    state: DependencyState,
    server_budget_s: float,
    retry_floor_s: float,
    scenario: Any,
    samples: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    await wait_dependency_quiet(state)
    state.set_scenario(scenario)
    measured: list[dict[str, Any]] = []
    print(f"  SCENARIO {scenario.name}: {samples} logical loads", flush=True)

    for index in range(samples):
        sample = await coordinated_logical_load(
            dependency_url,
            state,
            server_budget_s,
            retry_floor_s,
        )
        measured.append(sample)
        print(
            f"    {index + 1}/{samples} "
            f"status={sample['status']} "
            f"attempts={sample['attempt_count']} "
            f"visible_ms={sample['user_visible_elapsed_ms']:.1f} "
            f"quiet_ms={sample['quiescence_elapsed_ms']:.1f} "
            f"auth={sample['upstream_calls'].get('auth', 0)} "
            f"data={sample['upstream_calls'].get('data', 0)}",
            flush=True,
        )

    return measured, summarize(measured)


async def measure_budget(
    dependency_url: str,
    state: DependencyState,
    server_budget_s: float,
    retry_floor_s: float,
    samples: int,
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, dict[str, Any]]]:
    budget_raw: dict[str, list[dict[str, Any]]] = {}
    budget_results: dict[str, dict[str, Any]] = {}
    print(
        f"BUDGET {server_budget_s:.1f}s: logical={LOGICAL_READ_BUDGET_S:.1f}s retry_floor={retry_floor_s:.3f}s",
        flush=True,
    )

    for scenario in SCENARIOS:
        raw_samples, summary = await measure_scenario(
            dependency_url,
            state,
            server_budget_s,
            retry_floor_s,
            scenario,
            samples,
        )
        budget_raw[scenario.name] = raw_samples
        budget_results[scenario.name] = summary

    return budget_raw, budget_results


async def measure_all_budgets(
    dependency_url: str,
    state: DependencyState,
    retry_floor_s: float,
    samples: int,
) -> tuple[
    dict[str, dict[str, list[dict[str, Any]]]],
    dict[str, dict[str, dict[str, Any]]],
]:
    raw: dict[str, dict[str, list[dict[str, Any]]]] = {}
    results: dict[str, dict[str, dict[str, Any]]] = {}

    for server_budget in SERVER_BUDGETS_S:
        budget_key = f"{server_budget:.1f}s"
        budget_raw, budget_results = await measure_budget(
            dependency_url,
            state,
            server_budget,
            retry_floor_s,
            samples,
        )
        raw[budget_key] = budget_raw
        results[budget_key] = budget_results

    return raw, results


def evaluate_budget(
    arm_a: dict[str, Any],
    candidate: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    arm_a_results = arm_a["results"]
    successful_a = [name for name, result in arm_a_results.items() if float(result["completion_rate"]) == 1.0]
    failed_a = [name for name, result in arm_a_results.items() if float(result["completion_rate"]) < 1.0]

    preserved_success = all(float(candidate[name]["completion_rate"]) == 1.0 for name in successful_a)
    bounded_tail = all(
        float(candidate[name]["user_visible_latency_ms"]["p95"] or 0) <= LOGICAL_READ_BUDGET_S * 1000 + 250
        for name in failed_a
    )
    no_call_increase = all(
        int(candidate[name]["upstream_auth_calls"]["total"]) <= int(arm_a_results[name]["upstream_auth_calls"]["total"])
        and int(candidate[name]["upstream_data_calls"]["total"])
        <= int(arm_a_results[name]["upstream_data_calls"]["total"])
        for name in failed_a
    )
    meaningful_tail_reduction = all(
        float(candidate[name]["user_visible_latency_ms"]["p95"] or 0)
        < float(arm_a_results[name]["latency_ms"]["p95"] or 0) * 0.90
        for name in failed_a
    )
    viable = preserved_success and bounded_tail and no_call_increase and meaningful_tail_reduction

    return {
        "viable": viable,
        "preserved_arm_a_successes": preserved_success,
        "bounded_failed_scenario_tail": bounded_tail,
        "no_failed_scenario_call_increase": no_call_increase,
        "meaningful_failed_scenario_tail_reduction": meaningful_tail_reduction,
        "arm_a_success_scenarios": successful_a,
        "arm_a_failed_scenarios": failed_a,
    }


def choose_decision(
    evaluations: dict[str, dict[str, Any]],
) -> tuple[str, list[str], list[str]]:
    viable_budgets = [budget for budget, evaluation in evaluations.items() if evaluation["viable"]]
    if viable_budgets:
        return (
            "COORDINATED_BUDGET_CANDIDATE_SUPPORTED",
            viable_budgets,
            [
                "at least one coordinated server budget preserved every Arm A success",
                "tested Arm A failure tails stayed inside the single 8 s logical-read boundary",
                "tested failed scenarios did not increase upstream Auth/Data call counts",
                "no circuit breaker is authorized by this experiment",
            ],
        )

    regressed = any(not evaluation["preserved_arm_a_successes"] for evaluation in evaluations.values())
    if regressed:
        return (
            "CANDIDATE_REGRESSION",
            [],
            ["every tested coordinated budget regressed at least one scenario that Arm A completed"],
        )

    return (
        "NO_CLEAR_BENEFIT",
        [],
        ["the tested coordinated budgets did not satisfy all preservation, tail, and call-amplification gates"],
    )


def load_arm_a_result(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("decision") != "COORDINATED_BUDGET_EXPERIMENT_WARRANTED":
        raise RuntimeError("Arm A did not authorize the Arm B experiment")
    if data.get("production_access") is not False:
        raise RuntimeError("Arm A evidence has an unexpected production-access claim")
    return data


def build_report(
    args: argparse.Namespace,
    arm_a_path: Path,
    arm_a: dict[str, Any],
    retry_floor_s: float,
    results: dict[str, dict[str, dict[str, Any]]],
    evaluations: dict[str, dict[str, Any]],
    decision: str,
    viable_budgets: list[str],
    reasons: list[str],
) -> dict[str, Any]:
    return {
        "schema_version": "architecture-run-03-arm-b-v1",
        "recorded_at": utc(),
        "research_source_commit": args.source_commit,
        "arm_a_result": str(arm_a_path),
        "arm_a_source_commit": arm_a.get("source_commit"),
        "measurement_scope": (
            "algorithmic coordinated-budget prototype + the same synthetic loopback "
            "Auth/Data dependency used by Arm A; no product source is modified"
        ),
        "logical_read_budget_ms": int(LOGICAL_READ_BUDGET_S * 1000),
        "upstream_hop_cap_ms": int(UPSTREAM_HOP_CAP_S * 1000),
        "server_budgets_ms": [int(value * 1000) for value in SERVER_BUDGETS_S],
        "retry_floor_ms": retry_floor_s * 1000,
        "retry_floor_basis": (
            "Arm A control P95 plus 250 ms margin; retry starts only when that much logical budget remains"
        ),
        "samples_per_scenario": args.samples,
        "production_access": False,
        "production_mutation": False,
        "product_source_modified": False,
        "write_semantics_exercised": False,
        "results": results,
        "evaluations": evaluations,
        "viable_budgets": viable_budgets,
        "decision": decision,
        "decision_reasons": reasons,
    }


def summary_lines(report: dict[str, Any]) -> list[str]:
    lines = [
        "# Run 03 Arm B summary",
        "",
        f"- research source: `{report['research_source_commit']}`",
        f"- Arm A source: `{report['arm_a_source_commit']}`",
        f"- samples/scenario: `{report['samples_per_scenario']}`",
        f"- retry floor: `{report['retry_floor_ms']:.1f} ms`",
        f"- decision: `{report['decision']}`",
        (f"- viable budgets: `{', '.join(report['viable_budgets']) if report['viable_budgets'] else 'none'}`"),
        "- production access: `false`",
        "- production mutation: `false`",
        "",
    ]

    for budget, budget_results in report["results"].items():
        lines += [
            f"## Server budget {budget}",
            "",
            "| scenario | completion | visible p50 ms | visible p95 ms | quiet p95 ms | retries | auth calls | data calls |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
        for scenario in SCENARIOS:
            item = budget_results[scenario.name]
            lines.append(
                f"| {scenario.name} | {item['completion_rate']:.2f} | "
                f"{item['user_visible_latency_ms']['p50']:.1f} | "
                f"{item['user_visible_latency_ms']['p95']:.1f} | "
                f"{item['dependency_quiescence_latency_ms']['p95']:.1f} | "
                f"{item['retry_count']['total']} | "
                f"{item['upstream_auth_calls']['total']} | "
                f"{item['upstream_data_calls']['total']} |"
            )
        evaluation = report["evaluations"][budget]
        lines += [
            "",
            f"- viable: `{str(evaluation['viable']).lower()}`",
            (f"- preserved Arm A successes: `{str(evaluation['preserved_arm_a_successes']).lower()}`"),
            (f"- bounded failure tail: `{str(evaluation['bounded_failed_scenario_tail']).lower()}`"),
            (f"- no failed-scenario call increase: `{str(evaluation['no_failed_scenario_call_increase']).lower()}`"),
            "",
        ]

    lines += ["## Decision reasons", ""]
    lines += [f"- {reason}" for reason in report["decision_reasons"]]
    lines += [
        "",
        "## Scope limit",
        "",
        "- This is a research candidate, not an implementation approval.",
        "- It does not modify API/Auth/browser timeout code.",
        "- It does not exercise writes or authorize write retry.",
        "- It does not authorize a circuit breaker.",
    ]
    return lines


def write_evidence(
    output: Path,
    report: dict[str, Any],
    raw: dict[str, dict[str, list[dict[str, Any]]]],
) -> None:
    (output / "RESULT.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (output / "SAMPLES.json").write_text(
        json.dumps(raw, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (output / "SUMMARY.md").write_text(
        "\n".join(summary_lines(report)) + "\n",
        encoding="utf-8",
    )


async def run(args: argparse.Namespace) -> dict[str, Any]:
    output = args.output.resolve()
    if output.exists():
        raise RuntimeError(f"output already exists: {output}")
    output.mkdir(parents=True)

    arm_a_path = args.arm_a_result.resolve()
    arm_a = load_arm_a_result(arm_a_path)
    control_p95_ms = float(arm_a["results"]["control"]["latency_ms"]["p95"])
    retry_floor_s = control_p95_ms / 1000 + RETRY_MARGIN_S

    state = DependencyState()
    dependency = DependencyServer(("127.0.0.1", 0), state)
    dependency_url = f"http://127.0.0.1:{int(dependency.server_address[1])}"
    thread = threading.Thread(target=dependency.serve_forever, daemon=True)
    thread.start()

    try:
        raw, results = await measure_all_budgets(
            dependency_url,
            state,
            retry_floor_s,
            args.samples,
        )
    finally:
        dependency.shutdown()
        dependency.server_close()
        thread.join(timeout=5)

    evaluations = {budget: evaluate_budget(arm_a, result) for budget, result in results.items()}
    decision, viable_budgets, reasons = choose_decision(evaluations)
    report = build_report(
        args,
        arm_a_path,
        arm_a,
        retry_floor_s,
        results,
        evaluations,
        decision,
        viable_budgets,
        reasons,
    )
    write_evidence(output, report, raw)
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--arm-a-result", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--samples", type=int, default=3)
    args = parser.parse_args()

    if args.samples < 1 or args.samples > 10:
        raise SystemExit("--samples must be between 1 and 10")

    report = asyncio.run(run(args))
    print("")
    print("=== RUN 03 ARM B COMPLETE ===")
    print(f"Decision: {report['decision']}")
    print(f"Viable budgets: {', '.join(report['viable_budgets']) or 'none'}")
    print(f"Evidence: {args.output.resolve()}")


if __name__ == "__main__":
    main()
