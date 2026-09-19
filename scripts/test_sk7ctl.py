from __future__ import annotations

import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from scripts import sk7ctl


def git(cwd: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=True,
        text=True,
        capture_output=True,
    ).stdout.strip()


class Sk7ctlTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.real_root = sk7ctl.repository_root(Path(__file__).resolve().parent.parent)

    def test_clean_and_dirty_git_status_parsing(self) -> None:
        self.assertEqual(sk7ctl.parse_porcelain_z(""), [])
        dirty = " M tracked.py\0?? new file.txt\0R  renamed.py\0old.py\0"
        self.assertEqual(
            sk7ctl.parse_porcelain_z(dirty),
            ["tracked.py", "new file.txt", "renamed.py", "old.py"],
        )

    def test_linked_worktree_uses_common_git_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            repo = Path(temporary) / "repo"
            linked = Path(temporary) / "linked"
            repo.mkdir()
            git(repo, "init", "-b", "main")
            git(repo, "config", "user.email", "test@example.com")
            git(repo, "config", "user.name", "Test")
            (repo / "seed").write_text("seed\n", encoding="utf-8")
            git(repo, "add", "seed")
            git(repo, "commit", "-m", "seed")
            git(repo, "worktree", "add", "-b", "linked", str(linked))
            expected = (repo / ".git" / "sk7ctl" / "state.json").resolve()
            self.assertEqual(sk7ctl.state_path(linked), expected)

    def test_two_failures_escalate_without_reset(self) -> None:
        task = self._task()
        task["failed_attempts"].extend(
            [
                {"approach": "first", "hypothesis": None},
                {"approach": "second", "hypothesis": None},
            ]
        )
        self.assertEqual(sk7ctl.loop_state(task), "ESCALATE")
        state = sk7ctl.empty_state()
        state["tasks"] = [task]
        state["active_task"] = task["id"]
        state["next_action"] = "Try implementation three."
        self.assertEqual(sk7ctl.effective_next(state, task), "Measure/reclassify/escalate first.")
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            sk7ctl.print_loop(task)
        self.assertIn("Do not begin a third implementation attempt.", output.getvalue())

    def test_expired_hypothesis_is_not_active_and_handoff_has_sections(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            repo = self._repo(Path(temporary))
            state = sk7ctl.empty_state()
            task = self._task()
            task["invariants"] = ["preserve source"]
            state["tasks"] = [task]
            state["active_task"] = task["id"]
            state["expired_hypotheses"] = ["temporary threshold 0.7"]
            state["next_action"] = "Run the focused unit test."
            handoff = sk7ctl.render_handoff(repo, state)
            active = handoff.split("## ACTIVE", 1)[1].split("## VERIFIED", 1)[0]
            self.assertNotIn("temporary threshold 0.7", active)
            self.assertIn("## ACTIVE", handoff)
            self.assertIn("## EXPIRED / DO NOT CARRY FORWARD", handoff)
            self.assertIn("## NEXT", handoff)

    def test_protected_change_never_gets_routine_only_pass(self) -> None:
        lane = sk7ctl.infer_lane(["api/routes.py", "docs/note.md"])
        self.assertEqual(lane, "protected")
        plan = sk7ctl.verification_plan(["api/routes.py"], lane, "focused", self.real_root)
        self.assertTrue(any("cannot establish PASS" in item["scope"] for item in plan))

    def test_docs_only_uses_diff_check_without_build(self) -> None:
        plan = sk7ctl.verification_plan(["AGENTS.md", "docs/note.md"], "routine", "focused", self.real_root)
        self.assertIn("git diff --check -- <task paths>", self._displays(plan))
        self.assertNotIn("cd web && npm run build", self._displays(plan))
        self.assertTrue(any(item["display"] == "web build" and item["cost"] == "SKIP" for item in plan))

    def test_saved_scene_e2e_only_selects_targeted_suite_without_build(self) -> None:
        plan = sk7ctl.verification_plan(["web/e2e/saved-scene-review.spec.ts"], "routine", "focused", self.real_root)
        self.assertIn("cd web && npm run test:e2e:saved-scene", self._displays(plan))
        self.assertNotIn("cd web && npm run build", self._displays(plan))
        targeted = next(item for item in plan if item["display"].endswith("test:e2e:saved-scene"))
        self.assertEqual(targeted["cost"], "MODERATE")
        self.assertIn("focused", targeted["profiles"])

    def test_multiple_e2e_specs_select_and_dedupe_targeted_suites(self) -> None:
        plan = sk7ctl.verification_plan(
            [
                "web/e2e/diorama-scene-review.spec.ts",
                "web/e2e/living-scene-review.spec.ts",
                "web/e2e/saved-scene-review.spec.ts",
            ],
            "routine",
            "focused",
            self.real_root,
        )
        names = [item.get("name") for item in plan]
        self.assertEqual(names.count("S02 and S10 review scenes"), 1)
        self.assertEqual(names.count("saved-scene migration parity"), 1)

    def test_web_runtime_source_includes_build(self) -> None:
        plan = sk7ctl.verification_plan(["web/src/App.tsx"], "routine", "focused", self.real_root)
        self.assertIn("cd web && npm run build", self._displays(plan))

    def test_scene_named_e2e_spec_does_not_add_manifest_check(self) -> None:
        plan = sk7ctl.verification_plan(["web/e2e/diorama-scene-review.spec.ts"], "routine", "focused", self.real_root)
        self.assertNotIn("cd web && npm run verify:scene-manifest", self._displays(plan))

    def test_unknown_e2e_spec_escalates_to_complete_pr_gate(self) -> None:
        plan = sk7ctl.verification_plan(["web/e2e/new-flow.spec.ts"], "routine", "focused", self.real_root)
        regression = next(item for item in plan if item.get("name") == "browser regression")
        self.assertEqual(regression["cost"], "EXPENSIVE")
        self.assertNotIn("focused", regression["profiles"])

    def test_scene_runtime_selects_manifest_build_browser_and_manual_device_checks(self) -> None:
        plan = sk7ctl.verification_plan(
            ["web/src/components/scene/ThreeSceneRenderer.tsx"], "routine", "focused", self.real_root
        )
        displays = self._displays(plan)
        self.assertIn("cd web && npm run verify:scene-manifest", displays)
        self.assertIn("cd web && npm run build", displays)
        self.assertIn("cd web && npm run test:e2e:scene", displays)
        device = next(item for item in plan if item["display"].startswith("representative Android/iOS"))
        self.assertFalse(device["run"])

    def test_routine_plan_skips_full_browser_matrix(self) -> None:
        plan = sk7ctl.verification_plan(["web/src/App.tsx"], "routine", "focused", self.real_root)
        full_matrix = [item for item in plan if item["display"] == "full Browser E2E matrix"]
        self.assertEqual(len(full_matrix), 1)
        self.assertEqual(full_matrix[0]["cost"], "SKIP")
        self.assertFalse(full_matrix[0]["run"])

    def test_preexisting_protected_dirty_is_excluded_from_routine_task_lane(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            repo = self._repo(Path(temporary))
            self._write(repo, "infra/legacy-web-redirect/worker.ts", "pre-existing\n")
            task = self._task()
            task["task_paths"] = ["scripts/sk7ctl.py", "scripts/test_sk7ctl.py"]
            task["preexisting_dirty_paths"] = sk7ctl.dirty_files(repo)
            self._write(repo, "scripts/sk7ctl.py", "task\n")
            self._write(repo, "scripts/test_sk7ctl.py", "tests\n")

            task_changes, preexisting, out_of_scope = sk7ctl.classify_changes(
                sk7ctl.dirty_files(repo),
                sk7ctl.changed_files(repo),
                task,
            )

            self.assertEqual(task_changes, ["scripts/sk7ctl.py", "scripts/test_sk7ctl.py"])
            self.assertEqual(preexisting, ["infra/legacy-web-redirect/worker.ts"])
            self.assertEqual(out_of_scope, [])
            self.assertEqual(sk7ctl.infer_lane(task_changes), "routine")

            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                sk7ctl.print_dirty_sections(task_changes, preexisting, out_of_scope)
            self.assertIn("PRE-EXISTING / UNRELATED:\n- infra/legacy-web-redirect/worker.ts", output.getvalue())

    def test_plan_start_records_explicit_scope_and_dirty_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            repo = self._repo(Path(temporary))
            self._write(repo, "infra/legacy-web-redirect/worker.ts", "pre-existing\n")
            store = sk7ctl.StateStore(Path(temporary) / "state.json")
            args = type(
                "Args",
                (),
                {
                    "plan_command": "start",
                    "title": "sk7ctl v0.1",
                    "lane": "unknown",
                    "path": ["./scripts/sk7ctl.py", "scripts/test_sk7ctl.py"],
                    "invariant": [],
                    "guard": [],
                    "manual_gate": [],
                    "next": "Verify the task.",
                },
            )()

            with contextlib.redirect_stdout(io.StringIO()):
                sk7ctl.cmd_plan(args, repo, store)

            task = sk7ctl.active_task(store.load())
            self.assertEqual(task["task_paths"], ["scripts/sk7ctl.py", "scripts/test_sk7ctl.py"])
            self.assertEqual(task["preexisting_dirty_paths"], ["infra/legacy-web-redirect/worker.ts"])

    def test_superseded_guard_and_expired_hypothesis_do_not_enter_new_active_handoff(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            repo = self._repo(Path(temporary))
            state = sk7ctl.empty_state()
            old_task = self._task()
            old_task["guards"] = ["temporary incident guard"]
            old_task["status"] = "superseded"
            new_task = self._task()
            new_task.update({"id": "task-2", "title": "new task", "guards": []})
            state["tasks"] = [old_task, new_task]
            state["active_task"] = "task-2"
            state["expired_hypotheses"] = ["temporary threshold 0.7"]

            handoff = sk7ctl.render_handoff(repo, state)
            active = handoff.split("## ACTIVE", 1)[1].split("## VERIFIED", 1)[0]
            expired = handoff.split("## EXPIRED / DO NOT CARRY FORWARD", 1)[1].split("## NEXT", 1)[0]
            self.assertNotIn("temporary incident guard", active)
            self.assertNotIn("temporary threshold 0.7", active)
            self.assertIn("temporary threshold 0.7", expired)

    def test_protected_path_in_task_scope_infers_protected(self) -> None:
        task = self._task()
        task["task_paths"] = ["infra/legacy-web-redirect"]
        task["preexisting_dirty_paths"] = ["infra/legacy-web-redirect/worker.ts"]
        task_changes, _, _ = sk7ctl.classify_changes(
            ["infra/legacy-web-redirect/worker.ts"],
            ["infra/legacy-web-redirect/worker.ts"],
            task,
        )
        self.assertEqual(sk7ctl.infer_lane(task_changes), "protected")

    def test_new_dirty_path_after_task_start_is_out_of_scope_warning(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            repo = self._repo(Path(temporary))
            self._write(repo, "infra/legacy-web-redirect/worker.ts", "pre-existing\n")
            task = self._task()
            task["task_paths"] = ["docs/task-note.md"]
            task["preexisting_dirty_paths"] = sk7ctl.dirty_files(repo)
            self._write(repo, "docs/task-note.md", "task\n")
            self._write(repo, "web/new-unrelated.ts", "new unrelated\n")
            state = sk7ctl.empty_state()
            state["tasks"] = [task]
            state["active_task"] = task["id"]
            store = sk7ctl.StateStore(Path(temporary) / "state.json")
            store.save(state)

            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                result = sk7ctl.cmd_verify(type("Args", (), {"run": True, "profile": "focused"})(), repo, store)

            self.assertEqual(result, 2)
            self.assertIn("LANE: routine", output.getvalue())
            self.assertIn("OUT-OF-SCOPE DIRTY:\n- web/new-unrelated.ts", output.getvalue())
            self.assertIn("not part of routine PASS", output.getvalue())
            self.assertEqual(
                store.load()["last_verification"]["out_of_scope_files"],
                ["web/new-unrelated.ts"],
            )

    def test_malformed_and_unknown_schema_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "state.json"
            path.write_text("{not-json", encoding="utf-8")
            with self.assertRaises(sk7ctl.Sk7Error):
                sk7ctl.StateStore(path).load()
            path.write_text(json.dumps({**sk7ctl.empty_state(), "schema_version": 999}), encoding="utf-8")
            with self.assertRaises(sk7ctl.Sk7Error):
                sk7ctl.StateStore(path).load()

    # --- Local verification router v1 tests ---

    def test_s02_focused_ui_is_moderate_and_selected_in_focused(self) -> None:
        plan = sk7ctl.verification_plan(["web/src/components/JourneyToday.tsx"], "routine", "focused", self.real_root)
        suite = next(item for item in plan if item.get("name") == "S02 focused UI")
        self.assertEqual(suite["cost"], "MODERATE")
        self.assertIn("focused", suite["profiles"])
        self.assertTrue(suite["run"])

    def test_s10_focused_ui_is_moderate_and_selected_in_focused(self) -> None:
        plan = sk7ctl.verification_plan(["web/src/components/JourneyRecap.tsx"], "routine", "focused", self.real_root)
        suite = next(item for item in plan if item.get("name") == "S10 focused UI")
        self.assertEqual(suite["cost"], "MODERATE")
        self.assertIn("focused", suite["profiles"])
        self.assertTrue(suite["run"])

    def test_app_shell_selects_auth_and_journey_ui_not_full_matrix(self) -> None:
        plan = sk7ctl.verification_plan(["web/src/App.tsx"], "routine", "focused", self.real_root)
        names = {item.get("name") for item in plan}
        self.assertIn("normal auth boundaries", names)
        self.assertIn("journey UI", names)
        self.assertNotIn("browser regression", names)

    def test_scene_companion_runtime_selects_review_scene_suite(self) -> None:
        plan = sk7ctl.verification_plan(["web/src/components/VisualStage.tsx"], "routine", "focused", self.real_root)
        names = {item.get("name") for item in plan}
        self.assertIn("S02 and S10 review scenes", names)
        self.assertIn("cd web && npm run build", self._displays(plan))

    def _model_test_item(self, plan: list[dict[str, object]]) -> dict[str, object] | None:
        return next((item for item in plan if item["display"].startswith("python3 -m pytest tests/model")), None)

    def _data_test_item(self, plan: list[dict[str, object]]) -> dict[str, object] | None:
        return next((item for item in plan if item["display"].startswith("python3 -m pytest tests/data")), None)

    def test_b3_only_research_runs_finite_reference_comprehension_test(self) -> None:
        plan = sk7ctl.verification_plan(
            ["scripts/model/analyze_model_v2_finite_reference_comprehension.py"],
            "routine",
            "focused",
            self.real_root,
        )
        item = self._model_test_item(plan)
        self.assertIsNotNone(item)
        self.assertEqual(item["argv"], [sys.executable, "-m", "pytest", sk7ctl.MODEL_B3_TEST])

    def test_shared_model_helper_widens_to_all_model_tests(self) -> None:
        plan = sk7ctl.verification_plan(["scripts/model/preprocessing.py"], "routine", "focused", self.real_root)
        item = self._model_test_item(plan)
        self.assertIsNotNone(item)
        self.assertEqual(set(item["argv"]), {sys.executable, "-m", "pytest", *sk7ctl.MODEL_TEST_FILES})

    def test_b_shared_widens_to_b_and_b3_tests(self) -> None:
        plan = sk7ctl.verification_plan(
            ["scripts/model/analyze_model_v2_reference_distribution.py"],
            "routine",
            "focused",
            self.real_root,
        )
        item = self._model_test_item(plan)
        self.assertIsNotNone(item)
        self.assertIn(sk7ctl.MODEL_B_TEST, item["argv"])
        self.assertIn(sk7ctl.MODEL_B3_TEST, item["argv"])
        self.assertNotIn(sk7ctl.MODEL_B2_TEST, item["argv"])

    def test_data_preparation_only_runs_targeted_data_test(self) -> None:
        plan = sk7ctl.verification_plan(["scripts/data/preparation.py"], "routine", "focused", self.real_root)
        item = self._data_test_item(plan)
        self.assertIsNotNone(item)
        self.assertEqual(item["argv"], [sys.executable, "-m", "pytest", *sk7ctl.DATA_TEST_FILES])

    def test_unknown_protected_path_is_not_routine_pass(self) -> None:
        plan = sk7ctl.verification_plan(["src/unknown.py"], "unknown", "focused", self.real_root)
        self.assertTrue(any("full Browser E2E matrix" in item["display"] for item in plan))

    def test_full_profile_includes_expensive_browser_regression(self) -> None:
        plan = sk7ctl.verification_plan(["web/e2e/new-flow.spec.ts"], "routine", "full", self.real_root)
        suite = next(item for item in plan if item.get("name") == "browser regression")
        self.assertEqual(suite["cost"], "EXPENSIVE")
        self.assertIn("full", suite["profiles"])

    def test_pr_profile_includes_expensive_browser_regression_for_unknown_spec(self) -> None:
        plan = sk7ctl.verification_plan(["web/e2e/new-flow.spec.ts"], "routine", "pr", self.real_root)
        suite = next(item for item in plan if item.get("name") == "browser regression")
        self.assertEqual(suite["cost"], "EXPENSIVE")
        self.assertIn("pr", suite["profiles"])
        self.assertNotIn("focused", suite["profiles"])

    def test_focused_profile_skips_expensive_browser_regression(self) -> None:
        plan = sk7ctl.verification_plan(["web/e2e/new-flow.spec.ts"], "routine", "focused", self.real_root)
        suite = next(item for item in plan if item.get("name") == "browser regression")
        self.assertEqual(suite["cost"], "EXPENSIVE")
        self.assertNotIn("focused", suite["profiles"])

    def test_passing_check_summary_includes_log_path(self) -> None:
        item = sk7ctl._check(
            cost="CHEAP",
            display="true",
            cwd=".",
            argv=["true"],
            scope="smoke",
            profiles={"focused"},
        )
        rc, output, duration, log_path = sk7ctl._run_check(item, self.real_root, dict(os.environ))
        summary = sk7ctl._format_result(item, rc, output, duration, log_path)
        self.assertEqual(rc, 0)
        self.assertIn("PASS", summary)
        self.assertIn("full log:", summary)
        self.assertTrue(log_path.exists())
        self.assertIn("/tmp/", str(log_path))

    def test_failing_check_excerpt_is_bounded(self) -> None:
        # Produce a 200-line stdout stream and assert only the tail is surfaced.
        item = sk7ctl._check(
            cost="CHEAP",
            display="seq",
            cwd=".",
            argv=["python3", "-c", "import sys; [print(f'line {i}') for i in range(200)]; sys.exit(1)"],
            scope="smoke",
            profiles={"focused"},
        )
        rc, output, duration, log_path = sk7ctl._run_check(item, self.real_root, dict(os.environ))
        summary = sk7ctl._format_result(item, rc, output, duration, log_path)
        self.assertEqual(rc, 1)
        self.assertIn("FAIL", summary)
        self.assertIn("full log:", summary)
        self.assertIn("line 199", summary)
        self.assertNotIn("line 0", summary)
        excerpt = summary.split("--- failure excerpt ---", 1)[1].split("--- end excerpt ---", 1)[0]
        self.assertLessEqual(len(excerpt.strip().splitlines()), 85)
        self.assertTrue(log_path.exists())

    def test_s10_change_does_not_run_saved_scene_suite(self) -> None:
        plan = sk7ctl.verification_plan(["web/src/components/JourneyRecap.tsx"], "routine", "focused", self.real_root)
        names = {item.get("name") for item in plan}
        self.assertIn("S10 focused UI", names)
        self.assertNotIn("saved-scene migration parity", names)

    def test_selector_policy_unit_test_is_cheap(self) -> None:
        plan = sk7ctl.verification_plan(
            ["web/scripts/select-pr-browser-suites.mjs"], "routine", "focused", self.real_root
        )
        suite = next(item for item in plan if item.get("name") == "selector policy unit test")
        self.assertEqual(suite["cost"], "CHEAP")
        self.assertIn("focused", suite["profiles"])

    @staticmethod
    def _displays(plan: list[dict[str, object]]) -> list[object]:
        return [item["display"] for item in plan]

    @staticmethod
    def _task() -> dict[str, object]:
        return {
            "id": "task-1",
            "title": "test task",
            "lane": "routine",
            "invariants": [],
            "guards": [],
            "failed_attempts": [],
            "successful_approaches": [],
            "override_reason": None,
            "status": "active",
            "task_paths": ["scripts/sk7ctl.py"],
            "preexisting_dirty_paths": [],
        }

    @staticmethod
    def _write(repo: Path, relative: str, content: str) -> None:
        path = repo / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    @staticmethod
    def _repo(base: Path) -> Path:
        repo = base / "repo"
        repo.mkdir()
        git(repo, "init", "-b", "main")
        git(repo, "config", "user.email", "test@example.com")
        git(repo, "config", "user.name", "Test")
        (repo / "seed").write_text("seed\n", encoding="utf-8")
        git(repo, "add", "seed")
        git(repo, "commit", "-m", "seed")
        return repo


if __name__ == "__main__":
    unittest.main()
