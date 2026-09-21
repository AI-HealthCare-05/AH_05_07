import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { LAB_OUT_DIR, LAB_ROOT, PRODUCT_OUT_DIR, assertLabIsolation } from "./isolation-guard.mjs";

test("accepts only the dedicated root and output", () => {
  assert.equal(assertLabIsolation().root, LAB_ROOT);
  assert.equal(assertLabIsolation().outDir, LAB_OUT_DIR);
});

test("rejects web/dist as a direct output", () => {
  assert.throws(
    () => assertLabIsolation({ root: LAB_ROOT, outDir: PRODUCT_OUT_DIR }),
    /output must resolve exactly|may not resolve/,
  );
});

test("rejects a symlink alias to web/dist", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "transcend-isolation-"));
  try {
    const product = path.join(fixture, "dist");
    const alias = path.join(fixture, "alias");
    mkdirSync(product);
    symlinkSync(product, alias, "dir");
    assert.throws(
      () => assertLabIsolation({ root: LAB_ROOT, outDir: alias }),
      /output must resolve exactly|may not resolve/,
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
