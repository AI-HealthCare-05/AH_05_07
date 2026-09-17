import assert from "node:assert/strict";
import test from "node:test";

import { resolveNpmInvocation } from "./npm-command.mjs";

test("resolveNpmInvocation preserves POSIX argv", () => {
  assert.deepEqual(
    resolveNpmInvocation(
      ["run", "build", "--", "--outDir", "test-results/ui-release/normal"],
      { platform: "linux" },
    ),
    {
      file: "npm",
      args: ["run", "build", "--", "--outDir", "test-results/ui-release/normal"],
    },
  );
});

test("resolveNpmInvocation uses ComSpec for safe Windows argv", () => {
  assert.deepEqual(
    resolveNpmInvocation(
      ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4182"],
      {
        platform: "win32",
        comspec: "C:\\Windows\\System32\\cmd.exe",
      },
    ),
    {
      file: "C:\\Windows\\System32\\cmd.exe",
      args: [
        "/d",
        "/s",
        "/c",
        "npm.cmd run preview -- --host 127.0.0.1 --port 4182",
      ],
    },
  );
});

test("resolveNpmInvocation rejects Windows shell metacharacters", () => {
  assert.throws(
    () => resolveNpmInvocation(["run", "bad&token"], { platform: "win32" }),
    /unsafe Windows npm token/,
  );
});
