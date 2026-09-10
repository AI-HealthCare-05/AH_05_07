import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// Offline only. Emit fixed category names and counts, never snapshot strings,
// source text, URLs, DOM attributes or object identities.
const types = new Set(["synthetic", "native", "string", "object shape", "code", "array", "number", "symbol", "object", "concatenated string", "closure", "sliced string", "regexp", "hidden", "bigint"]);
const codeNames = new Set(["system / ScopeInfo", "system / TrustedByteArray", "(constant pool)", "system / Code", "system / BytecodeArray", "system / InstructionStream", "(context local names)", "system / FeedbackVector"]);
const timingNames = new Set(["PerformanceLongAnimationFrameTiming", "PerformanceEventTiming", "PerformanceScriptTiming", "TaskAttributionTiming", "LayoutShift", "PerformanceResourceTiming", "PerformanceLongTaskTiming", "LayoutShiftAttribution", "PerformanceSoftNavigation"]);

export function summarizeGrowthSnapshot(snapshot) {
  const { nodes, strings } = snapshot;
  const meta = snapshot.snapshot.meta;
  const fields = meta.node_fields;
  const offsets = Object.fromEntries(["type", "name", "self_size"].map(name => {
    const offset = fields.indexOf(name);
    assert.ok(offset >= 0, `Missing ${name}`);
    return [name, offset];
  }));
  assert.equal(nodes.length % fields.length, 0);
  const nodeTypes = meta.node_types[offsets.type];
  const byType = {}, code = {}, nativeTiming = {};
  function add(group, name, bytes) {
    const entry = group[name] ??= { count: 0, selfBytes: 0 };
    entry.count++; entry.selfBytes += bytes;
  }
  for (let i = 0; i < nodes.length; i += fields.length) {
    const type = nodeTypes[nodes[i + offsets.type]];
    assert.ok(types.has(type), "Unsupported snapshot node type");
    const name = strings[nodes[i + offsets.name]], bytes = nodes[i + offsets.self_size];
    assert.ok(Number.isSafeInteger(bytes) && bytes >= 0);
    add(byType, type, bytes);
    if (type === "code") add(code, codeNames.has(name) ? name : "other code", bytes);
    if (type === "native" && timingNames.has(name)) add(nativeTiming, name, bytes);
  }
  return { byType, code, nativeTiming,
    nonNativeSelfBytes: Object.entries(byType).filter(([type]) => type !== "native").reduce((total, [, value]) => total + value.selfBytes, 0),
    nativeSelfBytes: byType.native?.selfBytes ?? 0 };
}

export function compareGrowth(before, after) {
  function delta(group) {
    return Object.fromEntries([...new Set([...Object.keys(before[group]), ...Object.keys(after[group])])].sort().map(key => [key, {
      count: (after[group][key]?.count ?? 0) - (before[group][key]?.count ?? 0),
      selfBytes: (after[group][key]?.selfBytes ?? 0) - (before[group][key]?.selfBytes ?? 0),
    }]));
  }
  return { byType: delta("byType"), code: delta("code"), nativeTiming: delta("nativeTiming"),
    nonNativeSelfBytes: after.nonNativeSelfBytes - before.nonNativeSelfBytes,
    nativeSelfBytes: after.nativeSelfBytes - before.nativeSelfBytes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [beforePath, afterPath, output] = process.argv.slice(2);
  assert.ok(beforePath && afterPath && output, "Usage: node web/scripts/summarize-scene-heap-growth.mjs <before.heapsnapshot> <after.heapsnapshot> <output.json>");
  const snapshots = [];
  for (const file of [beforePath, afterPath]) {
    const bytes = await readFile(file);
    snapshots.push({ sha256: createHash("sha256").update(bytes).digest("hex"), ...summarizeGrowthSnapshot(JSON.parse(bytes)) });
  }
  await writeFile(output, JSON.stringify({
    method: "Offline fixed-category self-size accounting of existing snapshots; no device rerun. Native sizes are separate from JavaScript. Snapshot self sizes are not CDP JSHeapUsedSize, retained/dominator size, process PSS or GPU bytes.",
    before: snapshots[0], after: snapshots[1], delta: compareGrowth(snapshots[0], snapshots[1]),
  }, null, 2) + "\n", { mode: 0o600 });
  console.log("Sanitized heap-growth accounting written.");
}
