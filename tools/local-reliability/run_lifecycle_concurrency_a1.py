"""Deterministically reproduce Run 02 A1 using an isolated local PostgreSQL stack only.

Research-only. This runner never accepts a remote database URL, never logs in to
Supabase, never links a project, and never starts the product web/API services.
"""

from __future__ import annotations

import argparse
import io
import json
import shutil
import socket
import subprocess
import tarfile
import time
from pathlib import Path
from types import SimpleNamespace

from run import EXCLUDED, Run, StageError, digest, require_local_docker, utc, write_json

USER_ID = "a1020000-0000-4000-8000-000000000001"
CHALLENGE_ID = "a1020000-0000-4000-8000-000000000002"
CHECKIN_ID = "a1020000-0000-4000-8000-000000000003"
INITIAL_ACTION = "walk-10-minutes"
REPLACEMENT_ACTION = "sleep-routine"
SELECT_APP = "sk7_run02_a1_selection"
CHECKIN_APP = "sk7_run02_a1_checkin"


class A1Run(Run):
    """Reuse only the proven local-stack ownership/cleanup controls."""

    def prepare_db_only(self) -> None:
        for port in range(self.base_port, self.base_port + 10):
            with socket.socket() as check:
                check.bind(("127.0.0.1", port))

        self.output.mkdir(parents=True)
        self.report["measurement_scope"] = (
            "isolated local PostgreSQL trigger concurrency; synthetic rows only; no product web/API"
        )
        self.report["mocked_response"] = False
        self.report["production_validation"] = False
        self.report["method"] = {
            "type": "deterministic two-session PostgreSQL interleaving",
            "gate": "observe check-in backend waiting on a PostgreSQL Lock before releasing selection transaction",
        }
        self.save()

        self.report["environment"]["supabase_cli"] = self.command(
            "supabase-version", [self.cli, "--version"]
        ).strip()
        self.report["environment"]["docker"] = self.command(
            "docker-version", ["docker", "version", "--format", "{{.Server.Version}}"]
        ).strip()

        context = json.loads(self.command("docker-local-context", ["docker", "context", "inspect"]))[0]
        require_local_docker(context["Endpoints"]["docker"]["Host"])
        self.report["environment"]["docker_local_socket_checked"] = True
        self.before_containers = set(self.command("container-inventory-before", ["docker", "ps", "-q"]).split())

        # Freeze only the migrations needed to reconstruct the local database.
        archive = subprocess.check_output(
            ["git", "archive", self.commit, "supabase/migrations"],
            cwd=self.repo,
        )
        self.source.mkdir()
        with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
            bundle.extractall(self.source, filter="data")

        self.stack.mkdir()
        self.cli_command("local-config-init", "init")
        self.configure_stack()
        shutil.copytree(
            self.source / "supabase/migrations",
            self.stack / "supabase/migrations",
            dirs_exist_ok=True,
        )

        write_json(
            self.output / "resume.json",
            {
                "project_id": self.project,
                "source_commit": self.commit,
                "status": "prepared",
                "recovery": (
                    "Local-only stack. Stop only this project with "
                    "supabase stop --project-id <project_id> --no-backup "
                    "--workdir <this output>/stack. Never use --all."
                ),
            },
        )
        self.save()

    def start_db_only(self) -> None:
        self.started_stack = True
        self.cli_command("local-stack-start", "start", "--exclude", EXCLUDED, timeout=420)

        containers = self.command(
            "owned-container-inventory",
            [
                "docker",
                "ps",
                "--filter",
                f"label=com.supabase.cli.project={self.project}",
                "--format",
                "{{.Names}}",
            ],
        ).split()
        if not containers:
            raise StageError("No owned local Supabase containers identified")

        db_name = f"supabase_db_{self.project}"
        if db_name not in containers:
            raise StageError("Owned local PostgreSQL container was not found")

        self.report["environment"]["containers"] = []
        for name in containers:
            limit = "1g" if name == db_name else "384m"
            self.command(
                "owned-container-budget",
                ["docker", "update", "--memory", limit, "--memory-swap", limit, "--cpus", "1", name],
            )
            detail = json.loads(self.command("owned-image-provenance", ["docker", "inspect", name]))[0]
            self.report["environment"]["containers"].append(
                {
                    "role": name.removesuffix("_" + self.project),
                    "image": detail["Config"]["Image"],
                    "image_id": detail["Image"],
                }
            )

        self.report["checks"]["isolated_local_database_started"] = True
        self.save()

    def finish_db_only(self) -> None:
        self.report["ended_at"] = utc()
        self.report["status"] = "passed" if self.report["cleanup"]["status"] == "passed" else "failed"
        self.save()

        files = []
        for name in ("a1-result.json", "report.json"):
            path = self.output / name
            if path.exists():
                files.append(
                    {
                        "name": name,
                        "bytes": path.stat().st_size,
                        "sha256": digest(path),
                    }
                )
        write_json(
            self.output / "manifest.json",
            {
                "source_commit": self.commit,
                "files": files,
                "production_access": False,
                "backup": "local disk only; independent backup not configured",
            },
        )


def docker_psql_command(
    run: Run,
    *,
    app_name: str | None = None,
    interactive: bool = False,
) -> list[str]:
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

    # The expected marker is emitted by an unblocked local statement. Keep the
    # deadline as a safety bound for process exit; the normal path is immediate.
    deadline = time.monotonic() + timeout
    while True:
        if time.monotonic() >= deadline:
            raise StageError(f"PostgreSQL session did not reach {marker}")
        line = process.stdout.readline()
        if line == "" and process.poll() is not None:
            raise StageError(f"PostgreSQL session exited before {marker}")
        if marker in line:
            return


def seed_fixture(run: Run) -> None:
    psql(
        run,
        f"""
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
""",
        app_name="sk7_run02_a1_seed",
    )


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
    raise StageError(
        f"check-in session never reached a row-lock wait; last observed={last or '(none)'}"
    )


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
        checkin_exit = checkin.returncode if checkin.returncode is not None else -1
        classification = classify(state, checkin_exit, checkin_stderr)

        return {
            "schema_version": "architecture-run-02-a1-v2",
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
            "checkin_command_exit": checkin_exit,
            "checkin_error_class": (
                "action_mismatch"
                if "challenge_checkin_action_mismatch" in checkin_stderr
                else "selection_locked"
                if "challenge_selection_locked" in checkin_stderr
                else "nonzero_other"
                if checkin_exit != 0
                else "none"
            ),
            "production_access": False,
            "production_mutation": False,
            "new_dependency": False,
        }
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
    parser.add_argument("--supabase-bin", required=True)
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
        run = A1Run(run_args)
        run.prepare_db_only()
        try:
            run.start_db_only()
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

        run.finish_db_only()

        print(f"A1 classification: {result['classification']}")
        print(f"Result: {run.output / 'a1-result.json'}")
        if result["classification"] == "CONFIRMED_BOUNDARY_DEFECT":
            print(
                "STOP: invariant violation reproduced; do not expand architecture "
                "or change product semantics yet."
            )
        return 0
    except (StageError, OSError, subprocess.SubprocessError, ValueError, json.JSONDecodeError) as error:
        if run and run.output.exists():
            run.report["status"] = "failed"
            run.report["failure"] = (
                str(error) if isinstance(error, StageError) else type(error).__name__
            )
            run.save()
            try:
                run.cleanup()
            except Exception:
                pass
        print(
            "A1 reproduction stopped before classification; inspect sanitized report.json.",
            file=__import__("sys").stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
