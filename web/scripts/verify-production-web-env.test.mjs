import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateProductionWebEnv } from "./verify-production-web-env.mjs";

const script = fileURLToPath(new URL("./verify-production-web-env.mjs", import.meta.url));
const publishable = "sb_publishable_public-test-value";
const valid = {
  WORKERS_CI: "1",
  VITE_API_BASE_URL: "https://api.example.test",
  VITE_SUPABASE_URL: "https://project.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: publishable,
};

function jwt(role) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role })}.signature`;
}

test("ordinary local and CI environments are not enforced", () => {
  assert.deepEqual(validateProductionWebEnv({}), { enforced: false, errors: [] });
  const run = spawnSync(process.execPath, [script], { encoding: "utf8", env: {} });
  assert.equal(run.status, 0);
  assert.match(run.stdout, /skipped outside Workers Builds/);
});

test("valid Workers public build variables pass", () => {
  assert.deepEqual(validateProductionWebEnv(valid), { enforced: true, errors: [] });
});

test("legacy anon JWT remains accepted", () => {
  const result = validateProductionWebEnv({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: jwt("anon") });
  assert.deepEqual(result.errors, []);
});

test("all missing variables are named without exposing values", () => {
  const result = validateProductionWebEnv({ WORKERS_CI: "1" });
  assert.equal(result.errors.length, 3);
  for (const name of ["VITE_API_BASE_URL", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
    assert.ok(result.errors.some((error) => error.includes(name)));
  }
});

test("non-HTTPS URLs and non-origin URLs are rejected", () => {
  const http = validateProductionWebEnv({ ...valid, VITE_API_BASE_URL: "http://api.example.test" });
  assert.ok(http.errors.some((error) => error.includes("VITE_API_BASE_URL")));
  const path = validateProductionWebEnv({ ...valid, VITE_SUPABASE_URL: "https://project.supabase.co/rest/v1" });
  assert.ok(path.errors.some((error) => error.includes("VITE_SUPABASE_URL")));
});

test("secret and service_role Supabase keys are rejected", () => {
  const secret = validateProductionWebEnv({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_do-not-print" });
  assert.ok(secret.errors.some((error) => error.includes("secret keys")));
  assert.ok(secret.errors.every((error) => !error.includes("do-not-print")));
  const service = validateProductionWebEnv({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: jwt("service_role") });
  assert.ok(service.errors.some((error) => error.includes("service_role")));
});

test("Workers command exits nonzero when required variables are missing", () => {
  const run = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { WORKERS_CI: "1", SENTINEL_SECRET: "never-print-this" },
  });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /VITE_API_BASE_URL/);
  assert.match(run.stderr, /VITE_SUPABASE_URL/);
  assert.match(run.stderr, /VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(`${run.stdout}${run.stderr}`, /never-print-this/);
});
