import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { guestModelV2Isolation, guestModelV2IsolationForRoots } from "./verify-guest-model-v2-isolation.mjs";

function tempDir() {
  return mkdtempSync(resolve(tmpdir(), "guest-isolation-"));
}

test("Guest reachable runtime graph excludes App, Supabase, API, and auth/session bootstrap modules", () => {
  const { violations } = guestModelV2Isolation();
  assert.deepEqual(violations, []);
});

test("shared local Model V2 runtime is intentionally reachable from Guest path", () => {
  const { runtimeModules } = guestModelV2Isolation();
  assert.ok(
    runtimeModules.some((module) => module.endsWith("/lib/model-v2/runtime.ts")),
    "expected shared Model V2 runtime to be reachable",
  );
});

test("a synthetic runtime import of a forbidden module causes failure", () => {
  const dir = tempDir();
  const entry = resolve(dir, "SyntheticGuestEntry.tsx");
  const forbidden = resolve(dir, "App.tsx");
  writeFileSync(entry, `import { something } from "./App";\nexport const x = something;\n`);
  writeFileSync(forbidden, "export const something = 1;\n");
  const { violations } = guestModelV2IsolationForRoots([entry]);
  assert.ok(violations.some((v) => v.forbidden === "App.tsx"), "expected App.tsx runtime import to be a violation");
});

test("a type-only forbidden import is ignored if that matches current intended runtime semantics", () => {
  const dir = tempDir();
  const entry = resolve(dir, "SyntheticGuestEntry.tsx");
  const forbidden = resolve(dir, "App.tsx");
  writeFileSync(entry, `import type { Something } from "./App";\nexport const x: Something = 1;\n`);
  writeFileSync(forbidden, "export type Something = number;\n");
  const { violations } = guestModelV2IsolationForRoots([entry]);
  assert.deepEqual(violations, []);
});

test("a synthetic allowed local Model V2 runtime import remains accepted", () => {
  const dir = tempDir();
  const entry = resolve(dir, "SyntheticGuestEntry.tsx");
  const runtime = resolve(dir, "runtime.ts");
  writeFileSync(entry, `import { score } from "./runtime";\nexport const x = score;\n`);
  writeFileSync(runtime, "export function score() { return 0; }\n");
  const { violations, runtimeModules } = guestModelV2IsolationForRoots([entry]);
  assert.deepEqual(violations, []);
  assert.ok(runtimeModules.includes(runtime), "expected local runtime module to be reachable");
});
