"""Deterministically reproduce the Run 02 A1 challenge-selection/check-in race.

Research-only. Uses the existing isolated local-reliability stack, synthetic local
rows, and two PostgreSQL sessions. Never accepts or connects to a remote DB URL.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import time
from pathlib import Path
from types import SimpleNamespace

from run import Run, StageError, utc, write_json

USER_ID = "a1020000-0000-4000-8000-000000000001"
CHALLENGE_ID = "a1020000-0000-4000-8000-000000000002"
CHECKIN_ID = "a1020000-0000-4000-8000-000000000003"
INITIAL_ACTION = "walk-10-minutes"
REPLACEMENT_ACTION = "sleep-routine"
SELECT_APP = "sk7_run02_a1_selection"
CHECKIN_APP = "sk7_run02_a1_checkin"


def docker_psql_command(run: Run, *, app_name: str | None = None, interactive: bool = False) -> list[str]:
    command = ["docker", "exec"]
    if interactive:
        command.append("-i")
    if app_name:
        command += ["-e", f"PGAPPNAME={app_name}"]
    command += [
        f"supabase_db_{run.project}",
        "psql",
        "-X",
        "-q",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-A",
        "-t",
    ]
    return command


def psql(run: Run, sql: str, *, app_name: str | None = None, timeout: float = 20) -> str:
    result = subprocess.run(
        docker_psql_command(run, app_name=app_name) + ["-c", sql],
        cwd=run.source,
        env=run.env,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        raise StageError(f"local PostgreSQL command failed: exit {result.returncode}")
    return result.stdout.strip()


def start_psql(run: Run, *, app_name: str):
    return subprocess.Popen(
        docker_psql_command(run, app_name=app_name, interactive=True),
        cwd=run.source,
        env=run.env,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )


def send(process: subprocess.Popen[str], sql: str) -> None:
    if process.stdin is None:
        raise StageError("PostgreSQL session stdin unavailable")
    process.stdin.write(sql.rstrip() + "\n")
    process.stdin.flush()


def wait_for_marker(process: subprocess.Popen[str], marker: str, timeout: float = 10) -> None:
    if process.stdout is None:
        raise StageError("PostgreSQL session stdout unavailable")
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        line = process.stdout.readline()
        if line == "" and process.poll() is not None:
            raise StageError(f"PostgreSQL session exited before {marker}")
        if marker in line:
            return
    raise StageError(f"PostgreSQL session did not reach {marker}")


def seed_fixture(run: Run) -> None:
    sql = f"""
BEGIN;
INSERT INTO auth.users (id, email)
VALUES ('{USER_ID}', 'run02-a1@example.invalid');

SET ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '{USER_ID}';

INSERT INTO public.active_challenges
  (id, user_id, action_id, starts_on, ends_on)
VALUES
  (
    '{CHALLENGE_ID}',
    '{USER_ID}',
    '{INITIAL_ACTION}',
    (timezone('Asia/Seoul', now()))::date,
    (timezone('Asia/Seoul', now()))::date + 6
  );
COMMIT;
"""
    psql(run, sql, app_name="sk7_run02_a1_seed")


def wait_until_checkin_waits_on_lock(run: Run, timeout: float = 10) -> str:
    deadline = time.monotonic() + timeout
    last = ""
    while time.monotonic() < deadline:
        last = psql(
            run,
            f"""
SELECT coalesce(wait_event_type, '') || ':' || coalesce(wait_event, '')
FROM pg_stat_activity
WHERE application_name = '{CHECKIN_APP}'
  AND state = 'active'
ORDER BY backend_start DESC
LIMIT 1;
""",
            app_name="sk7_run02_a1_probe",
        )
        if last.startswith("Lock:"):
            return last
        time.sleep(0.05)
    raise StageError(f"check-in session never reached a row-lock wait; last observed={last or '(none)'}")


def final_state(run: Run) -> dict[str, object]:
    row = psql(
        run,
        f"""
SELECT json_build_object(
  'active_action', a.action_id,
  'first_checkin_set', a.first_checkin_on IS NOT NULL,
  'checkin_count', count(c.id),
  'checkin_action', max(c.action_id)
)::text
FROM public.active_challenges a
LEFT JOIN public.challenge_checkins c
  ON c.challenge_id = a.id
 AND c.user_id = a.user_id
WHERE a.id = '{CHALLENGE_ID}'
GROUP BY a.id, a.action_id, a.first_checkin_on;
""",
        app_name="sk7_run02_a1_final",
    )
    if not row:
        raise StageError("A1 final state was not observable")
    return json.loads(row)


def classify(state: dict[str, object], checkin_exit: int, checkin_stderr: str) -> str:
    mismatch = (
        state.get("active_action") == REPLACEMENT_ACTION
        and state.get("first_checkin_set") is True
        and state.get("checkin_count") == 1
        and state.get("checkin_action") == INITIAL_ACTION
    )
    if mismatch:
        return "CONFIRMED_BOUNDARY_DEFECT"

    if (
        state.get("active_action") == REPLACEMENT_ACTION
        and state.get("checkin_count") == 0
        and (
            "challenge_checkin_action_mismatch" in checkin_stderr
            or "challenge_selection_locked" in checkin_stderr
            or checkin_exit != 0
        )
    ):
        return "PRESERVED_BY_EXISTING_CONTRACT"

    return "INSUFFICIENT_REPRODUCTION"


def experiment(run: Run) -> dict[str, object]:
    seed_fixture(run)
    selection = start_psql(run, app_name=SELECT_APP)
    checkin = None
    try:
        send(
            selection,
            f"""
BEGIN;
SET ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '{USER_ID}';
UPDATE public.active_challenges
SET action_id = '{REPLACEMENT_ACTION}'
WHERE id = '{CHALLENGE_ID}';
SELECT 'A1_SELECTION_LOCKED';
""",
        )
        wait_for_marker(selection, "A1_SELECTION_LOCKED")

        checkin_sql = f"""
BEGIN;
SET ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '{USER_ID}';
INSERT INTO public.challenge_checkins
  (id, challenge_id, user_id, action_id, observed_on, status)
VALUES
  (
    '{CHECKIN_ID}',
    '{CHALLENGE_ID}',
    '{USER_ID}',
    '{INITIAL_ACTION}',
    (timezone('Asia/Seoul', now()))::date,
    'completed'
  );
COMMIT;
"""
        checkin = subprocess.Popen(
            docker_psql_command(run, app_name=CHECKIN_APP) + ["-c", checkin_sql],
            cwd=run.source,
            env=run.env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        wait_event = wait_until_checkin_waits_on_lock(run)

        send(selection, "COMMIT;\nSELECT 'A1_SELECTION_COMMITTED';")
        wait_for_marker(selection, "A1_SELECTION_COMMITTED")

        checkin_stdout, checkin_stderr = checkin.communicate(timeout=15)
        del checkin_stdout  # Never retain raw command output.

        state = final_state(run)
        classification = classify(state, checkin.returncode or 0, checkin_stderr)

        result = {
            "schema_version": "architecture-run-02-a1-v1",
            "recorded_at": utc(),
            "source_commit": run.commit,
            "question": "challenge selection vs first check-in race",
            "classification": classification,
            "deterministic_gate": {
                "selection_update_holds_active_challenge_row_lock": True,
                "checkin_reached_database_lock_wait_before_selection_commit": True,
                "observed_wait_event": wait_event,
            },
            "final_state": {
                "active_action": state.get("active_action"),
                "first_checkin_set": state.get("first_checkin_set"),
                "checkin_count": state.get("checkin_count"),
                "checkin_action": state.get("checkin_action"),
            },
            "checkin_command_exit": checkin.returncode,
            "checkin_error_class": (
                "action_mismatch"
                if "challenge_checkin_action_mismatch" in checkin_stderr
                else "selection_locked"
                if "challenge_selection_locked" in checkin_stderr
                else "nonzero_other"
                if checkin.returncode
                else "none"
            ),
            "production_access": False,
            "production_mutation": False,
            "new_dependency": False,
        }
        return result
    finally:
        for process in (checkin, selection):
            if process is not None and process.poll() is None:
                process.kill()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    pass


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--commit", default="HEAD")
    parser.add_argument("--supabase-bin", default="supabase")
    parser.add_argument("--port", type=int, default=46321)
    args = parser.parse_args()

    run = None
    result = None
    try:
        run_args = SimpleNamespace(
            output=args.output,
            commit=args.commit,
            supabase_bin=args.supabase_bin,
            port=args.port,
            wait_for_measurement_signal=False,
        )
        run = Run(run_args)
        run.prepare()
        try:
            run.start_stack()
            result = experiment(run)
            write_json(run.output / "a1-result.json", result)
            run.report["architecture_run_02_a1"] = {
                "classification": result["classification"],
                "deterministic_lock_wait_observed": True,
                "production_access": False,
            }
            run.save()
        finally:
            run.cleanup()
        run.finish()

        print(f"A1 classification: {result['classification']}")
        print(f"Result: {run.output / 'a1-result.json'}")
        if result["classification"] == "CONFIRMED_BOUNDARY_DEFECT":
            print("STOP: invariant violation reproduced; do not expand architecture or change product semantics yet.")
        return 0
    except (StageError, OSError, subprocess.SubprocessError, ValueError, json.JSONDecodeError) as error:
        if run and run.output.exists():
            run.report["status"] = "failed"
            run.report["failure"] = str(error) if isinstance(error, StageError) else type(error).__name__
            run.save()
            try:
                run.cleanup()
            except Exception:
                pass
        print("A1 reproduction stopped before classification; inspect the sanitized report only.", file=__import__("sys").stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
