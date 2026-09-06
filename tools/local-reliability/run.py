"""Create, measure and remove an owned synthetic local stack; never accepts a remote URL."""

import argparse
import hashlib
import io
import json
import os
import platform
import re
import shutil
import socket
import subprocess
import sys
import tarfile
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

from metrics import measure, request, summarize

EXCLUDED = "realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"
PRESERVED = (
    "uv.lock",
    "web/package-lock.json",
    "data/manifest/nhanes_2017_2020.json",
    "docs/evidence/model-gate-1b.json",
    "docs/evidence/model-comparison.json",
    "docs/evidence/model-uncertainty.json",
)


def utc():
    return datetime.now(UTC).isoformat()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require_local_docker(endpoint):
    if not endpoint.startswith(("npipe://", "unix://")):
        raise StageError("Docker context is not a local named pipe or Unix socket")


def write_json(path, value):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    temporary.replace(path)


class StageError(Exception):
    pass


class Run:
    def __init__(self, args):
        self.repo = Path(__file__).resolve().parents[2]
        self.output = args.output.resolve()
        if self.output.exists() or self.output == self.repo or self.repo in self.output.parents:
            raise StageError("Output must be a new external directory")
        self.cli = str(Path(args.supabase_bin).resolve()) if Path(args.supabase_bin).exists() else args.supabase_bin
        self.commit = (
            subprocess.check_output(["git", "rev-parse", f"{args.commit}^{{commit}}"], cwd=self.repo).decode().strip()
        )
        self.project = "sk7-g2-" + uuid.uuid4().hex[:10]
        self.base_port = args.port
        self.wait_for_signal = args.wait_for_measurement_signal
        self.api_port = self.base_port + 3
        self.web_port = self.base_port + 4
        self.source = self.output / "checkout"
        self.stack = self.output / "stack"
        self.processes = []
        self.started_stack = False
        self.env = self.clean_environment()
        self.report = {
            "schema_version": "local-reliability-v1",
            "status": "running",
            "source_commit": self.commit,
            "started_at": utc(),
            "environment": {"os": platform.platform(), "logical_cpus": os.cpu_count()},
            "measurement_scope": "actual loopback FastAPI -> local Supabase Auth/PostgREST/PostgreSQL; synthetic only",
            "mocked_response": False,
            "host_load_context": "uncontrolled background work"
            if not self.wait_for_signal
            else "measurement gated by a local coordinator signal; see coordinator note",
            "production_validation": False,
            "natural_30_day_expiry_observed": False,
            "method": {
                "timer": "perf_counter_ns; full response read; milliseconds",
                "quantile": "Hyndman-Fan type 7; linear interpolation at (n-1)*p",
                "cold": "fresh API process per endpoint after readiness polling; Auth/DB remain warm; /ready already touched; not infrastructure cold",
                "warmup": "one endpoint call before measured warm phases",
                "warm": "20 sequential requests, then 40 requests with 4 concurrent client threads",
                "arrival": "closed loop, next call when worker finishes; no intentional inter-request delay",
                "connections": "urllib opener per call; no persistent client pool; one Uvicorn worker",
                "errors": "unexpected status / all samples; expected 401/422/503 are contract checks, not availability failures",
            },
            "stages": [],
            "measurements": {},
            "checks": {},
            "cleanup": {"status": "pending"},
        }

    @staticmethod
    def clean_environment():
        # Deliberate allowlist: do not inherit production URLs, credentials or .env overrides.
        keys = (
            "PATH",
            "PATHEXT",
            "SYSTEMROOT",
            "WINDIR",
            "COMSPEC",
            "TEMP",
            "TMP",
            "HOME",
            "USERPROFILE",
            "APPDATA",
            "LOCALAPPDATA",
            "PROGRAMFILES",
            "PROGRAMFILES(X86)",
            "PROGRAMDATA",
            "SYSTEMDRIVE",
            "PROCESSOR_ARCHITECTURE",
            "NUMBER_OF_PROCESSORS",
        )
        env = {key: value for key, value in os.environ.items() if key.upper() in keys}
        env.update({"CI": "true", "DO_NOT_TRACK": "1", "SUPABASE_AGENT": "no", "PYTHONUTF8": "1"})
        return env

    def save(self):
        write_json(self.output / "report.json", self.report)

    def command(self, stage, command, cwd=None, timeout=600):
        started = time.perf_counter()
        try:
            result = subprocess.run(
                command,
                cwd=cwd or (self.source if self.source.exists() else self.repo),
                env=self.env,
                capture_output=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired as error:
            self.report["stages"].append({"name": stage, "exit_code": None, "timeout_s": timeout})
            self.save()
            raise StageError(f"{stage}: bounded command deadline exceeded") from error
        self.report["stages"].append(
            {"name": stage, "exit_code": result.returncode, "elapsed_s": time.perf_counter() - started}
        )
        self.save()
        if result.returncode:
            raise StageError(f"{stage}: exit {result.returncode}; output intentionally not retained")
        return result.stdout.decode("utf-8", errors="replace")

    def cli_command(self, stage, *args, timeout=600):
        return self.command(stage, [self.cli, *args, "--workdir", str(self.stack), "--agent", "no"], timeout=timeout)

    def prepare(self):
        for port in range(self.base_port, self.base_port + 10):
            with socket.socket() as check:
                check.bind(("127.0.0.1", port))
        self.output.mkdir(parents=True)
        self.save()
        self.report["environment"]["uv"] = self.command("uv-version", ["uv", "--version"]).strip()
        self.report["environment"]["node"] = self.command("node-version", ["node", "--version"]).strip()
        self.report["environment"]["supabase_cli"] = self.command("supabase-version", [self.cli, "--version"]).strip()
        self.report["environment"]["docker"] = self.command(
            "docker-version", ["docker", "version", "--format", "{{.Server.Version}}"]
        ).strip()
        context = json.loads(self.command("docker-local-context", ["docker", "context", "inspect"]))[0]
        require_local_docker(context["Endpoints"]["docker"]["Host"])
        self.report["environment"]["docker_local_socket_checked"] = True
        self.before_containers = set(self.command("container-inventory-before", ["docker", "ps", "-q"]).split())
        archive = subprocess.check_output(["git", "archive", self.commit], cwd=self.repo)
        self.source.mkdir()
        with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
            bundle.extractall(self.source, filter="data")
        self.report["source_hashes"] = {name: digest(self.source / name) for name in PRESERVED}
        tool_names = ("run.py", "metrics.py", "test_controls.py", "verify_report.py")
        self.report["tool_hashes"] = {name: digest(Path(__file__).parent / name) for name in tool_names}
        tool_snapshot = self.output / "runner-source"
        tool_snapshot.mkdir()
        for name in tool_names:
            shutil.copyfile(Path(__file__).parent / name, tool_snapshot / name)
        self.command("frozen-python-install", ["uv", "sync", "--frozen", "--group", "app", "--group", "ai"])
        self.python = str(self.source / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python"))
        version_code = "import sys,importlib.metadata as m,json; print(json.dumps({'python':sys.version.split()[0],**{n:m.version(n) for n in ['fastapi','uvicorn','httpx','pydantic','scikit-learn']}}))"
        self.report["environment"]["python_packages"] = json.loads(
            self.command("python-versions", [self.python, "-c", version_code])
        )
        npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
        if not npm:
            raise StageError("npm is unavailable")
        self.command("clean-web-install", [npm, "ci", "--no-audit", "--no-fund"], self.source / "web")
        self.command("web-build", [npm, "run", "build"], self.source / "web")
        self.command(
            "web-secret-boundary", [self.python, "scripts/ci/verify_secret_boundary.py", "--web-dist", "web/dist"]
        )
        self.stack.mkdir()
        self.cli_command("local-config-init", "init")
        self.configure_stack()
        shutil.copytree(self.source / "supabase/migrations", self.stack / "supabase/migrations")
        shutil.copytree(self.source / "supabase/tests", self.stack / "supabase/tests")
        write_json(
            self.output / "resume.json",
            {
                "project_id": self.project,
                "source_commit": self.commit,
                "owned_api_port": self.api_port,
                "owned_web_port": self.web_port,
                "status": "prepared",
                "recovery": "Do not reuse this output. Inspect report and stop only this project with supabase stop --project-id <project_id> --no-backup --workdir <this output>/stack. No --all or global prune.",
            },
        )

    def configure_stack(self):
        path = self.stack / "supabase/config.toml"
        original = path.read_text(encoding="utf-8")
        sections = re.split(r"(?m)^(\[[^\n]+\])\s*$", original)
        replacements = {
            "api": {"port": str(self.base_port), "auto_expose_new_tables": "false"},
            "db": {"port": str(self.base_port + 1), "shadow_port": str(self.base_port + 2)},
            "db.pooler": {"enabled": "false", "port": str(self.base_port + 5)},
            "studio": {"enabled": "false", "port": str(self.base_port + 6)},
            "inbucket": {"enabled": "false", "port": str(self.base_port + 7)},
            "analytics": {"enabled": "false", "port": str(self.base_port + 8)},
            "db.seed": {"enabled": "false"},
            "auth": {"site_url": f'"http://127.0.0.1:{self.web_port}"', "additional_redirect_urls": "[]"},
            "auth.email": {"enable_confirmations": "false"},
        }
        sections[0] = re.sub(r"(?m)^project_id\s*=.*$", f'project_id = "{self.project}"', sections[0])
        for index in range(1, len(sections), 2):
            section = sections[index].strip("[]")
            for key, value in replacements.get(section, {}).items():
                pattern = rf"(?m)^{key}\s*=.*$"
                if re.search(pattern, sections[index + 1]):
                    sections[index + 1] = re.sub(pattern, f"{key} = {value}", sections[index + 1])
                else:
                    sections[index + 1] += f"\n{key} = {value}\n"
        path.write_text(
            sections[0] + "".join("\n" + sections[i] + "\n" + sections[i + 1] for i in range(1, len(sections), 2)),
            encoding="utf-8",
        )

    def start_stack(self):
        self.started_stack = True  # Cleanup also covers a partially failed start.
        self.cli_command("local-stack-start", "start", "--exclude", EXCLUDED, timeout=420)
        containers = self.command(
            "owned-container-inventory",
            ["docker", "ps", "--filter", f"label=com.supabase.cli.project={self.project}", "--format", "{{.Names}}"],
        ).split()
        if not containers:
            raise StageError("No owned containers identified")
        self.report["environment"]["containers"] = []
        for name in containers:
            # Apply a bounded budget only to containers bearing this run's exact project label.
            limit = "1g" if name.startswith("supabase_db_") else "384m"
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
        status = json.loads(self.cli_command("local-status-in-memory", "status", "-o", "json"))
        self.supabase = f"http://127.0.0.1:{self.base_port}"
        if status.get("API_URL") != self.supabase:
            raise StageError("Unexpected local API URL")
        self.key = status.get("PUBLISHABLE_KEY") or status.get("ANON_KEY")
        if not self.key:
            raise StageError("Local publishable configuration unavailable")
        self.cli_command("postgres-ownership-retention-pgtap", "test", "db", "--local", "supabase/tests")
        self.report["checks"]["pgtap"] = (
            "existing ownership, active-challenge and exact-time retention suites passed; transactional synthetic fixtures"
        )
        self.start_services()

    def spawn(self, args, env=None):
        process = subprocess.Popen(
            args, cwd=self.source, env=env or self.env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        self.processes.append(process)
        return process

    def start_services(self, web=True):
        env = {
            **self.env,
            "ENABLE_LEGACY_MYSQL": "false",
            "SUPABASE_URL": self.supabase,
            "SUPABASE_PUBLISHABLE_KEY": self.key,
            "API_CORS_ORIGINS": f"http://127.0.0.1:{self.web_port}",
            "HTTP_PROXY": "",
            "HTTPS_PROXY": "",
            "ALL_PROXY": "",
            "NO_PROXY": "127.0.0.1,localhost",
        }
        self.api = f"http://127.0.0.1:{self.api_port}"
        self.api_process = self.spawn(
            [
                self.python,
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(self.api_port),
                "--workers",
                "1",
                "--no-access-log",
                "--log-level",
                "critical",
            ],
            env,
        )
        if web:
            self.spawn(
                [self.python, "-m", "http.server", str(self.web_port), "--bind", "127.0.0.1", "--directory", "web/dist"]
            )
        started = time.perf_counter()
        for _ in range(100):
            if self.api_process.poll() is not None:
                raise StageError("Local API startup exited")
            if request(self.api, "/ready")[0] == 200:
                break
            time.sleep(0.1)
        else:
            raise StageError("Local API readiness deadline exceeded")
        self.report["environment"].setdefault("api_startup_to_readiness_s", []).append(time.perf_counter() - started)
        if not web:
            return
        self.command(
            "built-web-api-smoke",
            [
                self.python,
                "scripts/ci/verify_deployment_smoke.py",
                "--web-base-url",
                f"http://127.0.0.1:{self.web_port}",
                "--api-base-url",
                self.api,
            ],
        )

    def signup(self):
        # Random disposable local identity stays in memory; no email delivery service is running.
        status, content, _ = request(
            self.supabase,
            "/auth/v1/signup",
            "POST",
            body={"email": f"synthetic-{uuid.uuid4().hex}@example.invalid", "password": uuid.uuid4().hex + "Aa1!"},
            key=self.key,
        )
        if status != 200 or not content or not content.get("access_token"):
            raise StageError("Local synthetic signup did not produce a session")
        return content["access_token"]

    @staticmethod
    def expect(result, status, stage):
        if result[0] != status:
            raise StageError(f"{stage}: unexpected status {result[0]}")
        return result[1]

    def exercise(self):
        owner, other = self.signup(), self.signup()
        today = datetime.now().astimezone().date().isoformat()
        body = {"observed_on": today, "period": "morning", "systolic": 120, "diastolic": 80}
        prefix = "/api/v1/observations"
        query = f"?start_on={today}&end_on={today}"
        created = self.expect(
            request(self.api, prefix + "/blood-pressure", "POST", owner, body), 201, "synthetic create"
        )
        record = created["id"]
        window = self.expect(request(self.api, prefix + "/window" + query, token=owner), 200, "owner read")
        if len(window["blood_pressure_observations"]) != 1:
            raise StageError("Owner read did not return one synthetic row")
        foreign = self.expect(request(self.api, prefix + "/window" + query, token=other), 200, "other read")
        if foreign["blood_pressure_observations"]:
            raise StageError("Cross-user disclosure")
        for method in ("PUT", "DELETE"):
            self.expect(
                request(
                    self.api, prefix + "/blood-pressure/" + record, method, other, body if method == "PUT" else None
                ),
                404,
                "cross-user mutation",
            )
        self.expect(request(self.api, prefix + "/blood-pressure", "POST", owner, body), 409, "duplicate create")
        self.expect(
            request(self.api, prefix + "/challenges/active", "POST", owner, {"action_id": "walk-10-minutes"}),
            200,
            "challenge select",
        )
        checkin = self.expect(
            request(
                self.api,
                prefix + "/challenges/active/checkins",
                "POST",
                owner,
                {"observed_on": today, "status": "completed"},
            ),
            201,
            "checkin create",
        )
        self.expect(
            request(self.api, prefix + "/challenges/active", "POST", owner, {"action_id": "sleep-regular"}),
            409,
            "challenge lock",
        )
        self.expect(
            request(self.api, prefix + "/challenges/checkins/" + checkin["id"], "PUT", owner, {"status": "skipped"}),
            200,
            "status update",
        )
        endpoints = {
            "GET /live": ("/live", "GET", "", None, 200),
            "GET /ready": ("/ready", "GET", "", None, 200),
            "GET /observations/window (owner)": (prefix + "/window" + query, "GET", owner, None, 200),
            "GET /observations/export (owner)": (prefix + "/export" + query, "GET", owner, None, 200),
            "PUT /observations/blood-pressure (owner)": (prefix + "/blood-pressure/" + record, "PUT", owner, body, 200),
            "GET /observations/window (anonymous)": (prefix + "/window" + query, "GET", "", None, 401),
            "POST /observations/blood-pressure (invalid)": (
                prefix + "/blood-pressure",
                "POST",
                owner,
                {**body, "extra": True},
                422,
            ),
            "POST /risk-signal (not ready)": (
                "/api/v1/risk-signal",
                "POST",
                "",
                {"sex": 1, "age_years": 40, "bmi": 23},
                503,
            ),
        }
        for label, (path, method, token, payload, expected) in endpoints.items():
            self.api_process.terminate()
            self.api_process.wait(timeout=10)
            self.start_services(web=False)

            def call(p=path, m=method, t=token, b=payload):
                return request(self.api, p, m, t, b)

            phases = [
                measure(call, expected, "first_endpoint_call", 1, 1),
                measure(call, expected, "warm_sequential", 20, 1),
                measure(call, expected, "warm_concurrent", 40, 4),
            ]
            self.report["measurements"][label] = phases
            self.save()
            if any(phase["unexpected_count"] for phase in phases):
                raise StageError("Measurement observed an unexpected response; stopping without automatic retry")
        self.expect(
            request(self.api, prefix + "/challenges/checkins/" + checkin["id"], "DELETE", owner), 204, "checkin delete"
        )
        self.expect(request(self.api, prefix + "/blood-pressure/" + record, "DELETE", owner), 204, "observation delete")
        empty = self.expect(request(self.api, prefix + "/window" + query, token=owner), 200, "delete visibility")
        if empty["blood_pressure_observations"] or empty["challenge_checkins"]:
            raise StageError("Deleted synthetic rows still visible")
        self.report["checks"].update(
            {
                "actual_api_owner_crud_export": True,
                "cross_user_read_write_denied": True,
                "anonymous_401": True,
                "input_422": True,
                "duplicate_409": True,
                "first_checkin_action_lock": True,
                "status_only_checkin_edit_delete": True,
                "model_not_ready_503": True,
            }
        )
        self.storage_failure(owner, prefix + "/window" + query)

    def await_measurement_window(self):
        if not self.wait_for_signal:
            return
        write_json(self.output / "measurement-ready.json", {"ready_at": utc(), "deadline_seconds": 300})
        for _ in range(300):
            signal = self.output / "start-measurement.json"
            if signal.exists():
                note = json.loads(signal.read_text(encoding="utf-8"))
                if set(note) != {"renderer_paused", "other_background_work"} or note["renderer_paused"] is not True:
                    raise StageError("Invalid measurement coordination signal")
                self.report["measurement_coordination"] = note
                self.save()
                return
            time.sleep(1)
        raise StageError("Measurement coordination deadline exceeded")

    def storage_failure(self, owner, path):
        container = "supabase_rest_" + self.project
        labels = json.loads(self.command("storage-fault-target-check", ["docker", "inspect", container]))[0]["Config"][
            "Labels"
        ]
        if labels.get("com.supabase.cli.project") != self.project:
            raise StageError("Fault injection target ownership mismatch")
        self.command("owned-postgrest-stop", ["docker", "stop", container])
        try:
            sample = request(self.api, path, token=owner)
            self.expect(sample, 503, "local storage failure normalization")
            if sample[1]["detail"]["code"] != "observation_storage_not_ready":
                raise StageError("Unexpected sanitized storage failure contract")
            self.report["measurements"]["GET /observations/window (injected local storage failure)"] = [
                summarize([sample], 503, "bounded_fault_injection", 1, utc(), utc())
            ]
        finally:
            self.command("owned-postgrest-restart", ["docker", "start", container])
        for _ in range(30):
            if request(self.api, path, token=owner)[0] == 200:
                self.report["checks"]["local_storage_failure_recovery"] = True
                return
            time.sleep(0.2)
        raise StageError("Local storage did not recover")

    def cleanup(self):
        failures = []
        for process in reversed(self.processes):
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=10)
            if process.poll() is None:
                failures.append("owned child process remains")
        if self.started_stack:
            try:
                self.cli_command(
                    "owned-stack-cleanup", "stop", "--project-id", self.project, "--no-backup", timeout=120
                )
            except (StageError, subprocess.TimeoutExpired):
                failures.append("owned stack cleanup failed; use resume.json")
        if hasattr(self, "before_containers"):
            after = set(self.command("container-inventory-after", ["docker", "ps", "-q"]).split())
            # Compare IDs, but never publish them or inspect unrelated container data.
            self.report["cleanup"]["preexisting_running_containers_preserved"] = self.before_containers <= after
            if not self.before_containers <= after:
                failures.append("a preexisting container is no longer running; investigate without modifying it")
            owned = self.command(
                "owned-container-cleanup-check",
                ["docker", "ps", "-aq", "--filter", f"label=com.supabase.cli.project={self.project}"],
            ).split()
            volumes = self.command(
                "owned-volume-cleanup-check",
                ["docker", "volume", "ls", "-q", "--filter", f"label=com.supabase.cli.project={self.project}"],
            ).split()
            self.report["cleanup"].update({"owned_container_count": len(owned), "owned_volume_count": len(volumes)})
            if owned or volumes:
                failures.append("owned synthetic storage remains")
        self.report["cleanup"].update(
            {
                "status": "passed" if not failures else "failed",
                "failures": failures,
                "raw_logs_retained": False,
                "credentials_or_row_exports_retained": False,
            }
        )
        self.save()

    def finish(self):
        after = {name: digest(self.source / name) for name in PRESERVED}
        self.report["checks"]["preserved_source_bytes"] = after == self.report["source_hashes"]
        if after != self.report["source_hashes"]:
            raise StageError("Frozen evidence or lock bytes changed")
        self.report["ended_at"] = utc()
        self.report["status"] = "passed" if self.report["cleanup"]["status"] == "passed" else "failed"
        self.save()
        write_json(
            self.output / "manifest.json",
            {
                "source_commit": self.commit,
                "files": [
                    {
                        "name": "report.json",
                        "bytes": (self.output / "report.json").stat().st_size,
                        "sha256": digest(self.output / "report.json"),
                    }
                ],
                "backup": "local disk only; independent backup not configured",
            },
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--commit", default="HEAD")
    parser.add_argument("--supabase-bin", default="supabase")
    parser.add_argument("--port", type=int, default=45321)
    parser.add_argument("--wait-for-measurement-signal", action="store_true")
    args = parser.parse_args()
    run = None
    try:
        run = Run(args)
        run.prepare()
        try:
            run.start_stack()
            run.await_measurement_window()
            run.exercise()
        finally:
            run.cleanup()
        run.finish()
        print("Local synthetic verification passed; aggregate report.json and manifest.json saved.")
        return 0 if run.report["status"] == "passed" else 1
    except (StageError, OSError, subprocess.SubprocessError, ValueError) as error:
        if run and run.output.exists():
            run.report["status"] = "failed"
            run.report["failure"] = str(error) if isinstance(error, StageError) else type(error).__name__
            run.save()
        print(
            "Local verification stopped; sanitized stage and resume record preserved. No automatic rerun.",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
