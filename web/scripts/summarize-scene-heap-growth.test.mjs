import assert from "node:assert/strict";
import test from "node:test";
import { summarizeGrowthSnapshot, compareGrowth } from "./summarize-scene-heap-growth.mjs";

test("keeps native timing separate, accounts removals, and never emits snapshot contents", () => {
  const meta = { node_fields: ["type", "name", "self_size"], node_types: [["code", "native", "string", "object"]] };
  const strings = ["private source or record", "PerformanceResourceTiming", "private URL", "private class"];
  const before = summarizeGrowthSnapshot({ snapshot: { meta }, strings, nodes: [0, 0, 100, 1, 1, 200, 2, 2, 40, 3, 3, 20] });
  const after = summarizeGrowthSnapshot({ snapshot: { meta }, strings, nodes: [0, 0, 180, 1, 1, 500] });
  const delta = compareGrowth(before, after);
  assert.equal(delta.nonNativeSelfBytes, 20);
  assert.equal(delta.nativeSelfBytes, 300);
  assert.deepEqual(delta.byType.string, { count: -1, selfBytes: -40 });
  assert.deepEqual(delta.code["other code"], { count: 0, selfBytes: 80 });
  assert.deepEqual(delta.nativeTiming.PerformanceResourceTiming, { count: 0, selfBytes: 300 });
  assert.equal(JSON.stringify({ before, after, delta }).includes("private"), false);
});
