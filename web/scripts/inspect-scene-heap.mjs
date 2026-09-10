import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// Raw snapshots stay local. Never emit string values, source text, URLs or DOM attributes.
function safeName(name, type) {
  if (["string", "concatenated string", "sliced string", "code"].includes(type)) return `<${type}>`;
  if (name.startsWith("Window")) return "Window";
  const tag = name.match(/^(?:Detached )?<([a-zA-Z][\w-]*)/);
  if (tag) return `<${tag[1]}>`;
  if (/^(?:Detached )?[\w$]+$/.test(name) || /^\([\w /-]+\)$/.test(name) || /^system \/ [\w ]+$/.test(name)) return name;
  return "<internal>";
}

export function inspectHeap(snapshot, baselineIds = new Set()) {
  const { nodes, edges, strings } = snapshot;
  const meta = snapshot.snapshot.meta;
  const nf = meta.node_fields, ef = meta.edge_fields;
  const ni = name => { const i = nf.indexOf(name); assert.ok(i >= 0, `Missing node field ${name}`); return i; };
  const ei = name => { const i = ef.indexOf(name); assert.ok(i >= 0, `Missing edge field ${name}`); return i; };
  const nt = ni("type"), nn = ni("name"), id = ni("id"), size = ni("self_size"), ec = ni("edge_count");
  const et = ei("type"), en = ei("name_or_index"), to = ei("to_node");
  const nodeTypes = meta.node_types[nt], edgeTypes = meta.edge_types[et];
  const nodeCount = nodes.length / nf.length;
  assert.ok(Number.isInteger(nodeCount));
  const detachedField = nf.indexOf("detachedness");
  const starts = new Uint32Array(nodeCount + 1);
  const ids = new Set();
  const classes = new Map();
  const canvases = [];
  for (let i = 0; i < nodeCount; i++) {
    const offset = i * nf.length, type = nodeTypes[nodes[offset + nt]];
    const name = safeName(strings[nodes[offset + nn]], type);
    ids.add(nodes[offset + id]);
    starts[i + 1] = starts[i] + nodes[offset + ec] * ef.length;
    if (["native", "object"].includes(type)) {
      const key = `${type}:${name}`;
      const value = classes.get(key) ?? { type, name, count: 0, selfBytes: 0, newCount: 0 };
      value.count++; value.selfBytes += nodes[offset + size];
      if (!baselineIds.has(nodes[offset + id])) value.newCount++;
      classes.set(key, value);
    }
    if (type === "native" && /canvas/i.test(name)) canvases.push(i);
  }
  assert.equal(starts[nodeCount], edges.length);

  // A shortest strong path is evidence of one retaining route, not a dominator proof.
  const parents = new Int32Array(nodeCount).fill(-1);
  const parentEdges = new Int32Array(nodeCount).fill(-1);
  const queue = new Uint32Array(nodeCount);
  parents[0] = 0; queue[0] = 0;
  let head = 0, tail = 1;
  while (head < tail) {
    const source = queue[head++];
    for (let e = starts[source]; e < starts[source + 1]; e += ef.length) {
      if (edgeTypes[edges[e + et]] === "weak") continue;
      const target = edges[e + to] / nf.length;
      assert.ok(Number.isInteger(target) && target >= 0 && target < nodeCount);
      if (parents[target] !== -1) continue;
      parents[target] = source; parentEdges[target] = e;
      queue[tail++] = target;
    }
  }
  const paths = canvases.filter(i => !baselineIds.has(nodes[i * nf.length + id])).slice(0, 12).map(target => {
    const route = [];
    let current = target;
    while (current !== 0 && parents[current] !== -1 && route.length < 40) {
      const e = parentEdges[current], type = edgeTypes[edges[e + et]], offset = current * nf.length;
      const edgeName = ["element", "hidden"].includes(type) ? `<${type}:${edges[e + en]}>` : safeName(strings[edges[e + en]] ?? "", "edge");
      route.push({ via: edgeName, edgeType: type, type: nodeTypes[nodes[offset + nt]], name: safeName(strings[nodes[offset + nn]], nodeTypes[nodes[offset + nt]]) });
      current = parents[current];
    }
    return { id: nodes[target * nf.length + id], detachedness: detachedField < 0 ? null : nodes[target * nf.length + detachedField],
      reachableByStrongPath: parents[target] !== -1, rootReached: current === 0, path: route.reverse() };
  });
  return { ids, report: { nodeCount, canvasNativeCount: canvases.length,
    classes: [...classes.values()].sort((a, b) => b.selfBytes - a.selfBytes), canvasRetainingPaths: paths } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [before, after, output] = process.argv.slice(2);
  assert.ok(before && after && output, "Usage: node web/scripts/inspect-scene-heap.mjs <before.heapsnapshot> <after.heapsnapshot> <summary.json>");
  const initial = inspectHeap(JSON.parse(await readFile(before, "utf8")));
  const final = inspectHeap(JSON.parse(await readFile(after, "utf8")), initial.ids);
  const beforeClasses = new Map(initial.report.classes.map(value => [`${value.type}:${value.name}`, value]));
  const changes = final.report.classes.map(value => ({ ...value,
    deltaCount: value.count - (beforeClasses.get(`${value.type}:${value.name}`)?.count ?? 0),
    deltaSelfBytes: value.selfBytes - (beforeClasses.get(`${value.type}:${value.name}`)?.selfBytes ?? 0),
  })).filter(value => value.deltaCount || value.deltaSelfBytes).sort((a, b) => b.deltaSelfBytes - a.deltaSelfBytes);
  await writeFile(output, JSON.stringify({ initialNodeCount: initial.report.nodeCount, finalNodeCount: final.report.nodeCount,
    initialCanvasNativeCount: initial.report.canvasNativeCount, finalCanvasNativeCount: final.report.canvasNativeCount,
    changes: changes.slice(0, 60), canvasRetainingPaths: final.report.canvasRetainingPaths }, null, 2) + "\n");
  console.log(`Sanitized heap comparison written to ${output}`);
}
