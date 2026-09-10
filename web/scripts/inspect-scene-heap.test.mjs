import assert from "node:assert/strict";
import test from "node:test";
import { inspectHeap } from "./inspect-scene-heap.mjs";

function fixture() {
  return {
    snapshot: { meta: {
      node_fields: ["type", "name", "id", "self_size", "edge_count", "detachedness"],
      node_types: [["synthetic", "object", "native", "string"]],
      edge_fields: ["type", "name_or_index", "to_node"],
      edge_types: [["property", "weak"]],
    } },
    strings: ["(GC roots)", "Window / https://private.invalid/record", "HTMLCanvasElement", "weakShortcut", "cache", "canvas", "synthetic-private-value"],
    nodes: [0, 0, 1, 0, 2, 0, 1, 1, 3, 32, 2, 0, 2, 2, 5, 64, 0, 2, 3, 6, 7, 64, 0, 0],
    edges: [1, 3, 12, 0, 4, 6, 0, 5, 12, 0, 5, 18],
  };
}

test("finds a strong retaining path without treating a weak shortcut as retention", () => {
  const { report } = inspectHeap(fixture());
  assert.equal(report.canvasNativeCount, 1);
  assert.equal(report.canvasRetainingPaths[0].rootReached, true);
  assert.deepEqual(report.canvasRetainingPaths[0].path.map(step => step.via), ["cache", "canvas"]);
});

test("baseline object identities exclude existing canvases from newly retained paths", () => {
  const snapshot = fixture();
  const initial = inspectHeap(snapshot);
  const final = inspectHeap(snapshot, initial.ids);
  assert.deepEqual(final.report.canvasRetainingPaths, []);
  assert.equal(final.report.classes.find(value => value.name === "HTMLCanvasElement").newCount, 0);
});

test("summary omits page URLs and string values", () => {
  const serialized = JSON.stringify(inspectHeap(fixture()).report);
  assert.equal(serialized.includes("private.invalid"), false);
  assert.equal(serialized.includes("synthetic-private-value"), false);
  assert.equal(serialized.includes('"name":"Window"'), true);
});

test("rejects inconsistent snapshot edge counts", () => {
  const snapshot = fixture();
  snapshot.edges.pop();
  assert.throws(() => inspectHeap(snapshot));
});
