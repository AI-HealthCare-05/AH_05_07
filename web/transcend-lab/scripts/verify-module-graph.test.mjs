import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

import { LAB_OUT_DIR, LAB_ROOT, WEB_ROOT } from "./isolation-guard.mjs";
import { validateModuleGraph } from "./verify-module-graph.mjs";

const labEntry = path.join(LAB_ROOT, "src/main.tsx");
const admission = path.join(LAB_ROOT, "src/platform/embodiment/labAssetAdmission.ts");
const membership = path.join(WEB_ROOT, "src/ui/companionRuntimeMembership.ts");
const companion = path.join(WEB_ROOT, "src/ui/companion.ts");

function graph(modules) {
  return {
    schemaVersion: "transcend-lab-module-graph.v1",
    root: LAB_ROOT,
    outDir: LAB_OUT_DIR,
    modules,
  };
}

test("accepts a Lab entry that reaches product source only through membership", () => {
  const errors = validateModuleGraph(graph([
    { id: labEntry, isEntry: true, importedIds: [admission], dynamicallyImportedIds: [] },
    { id: admission, isEntry: false, importedIds: [membership], dynamicallyImportedIds: [] },
    { id: membership, isEntry: false, importedIds: [companion], dynamicallyImportedIds: [] },
    { id: companion, isEntry: false, importedIds: [], dynamicallyImportedIds: [] },
  ]));
  assert.deepEqual(errors, []);
});

test("rejects a direct forbidden product import", () => {
  const app = path.join(WEB_ROOT, "src/App.tsx");
  const errors = validateModuleGraph(graph([
    { id: labEntry, isEntry: true, importedIds: [membership, app], dynamicallyImportedIds: [] },
    { id: membership, isEntry: false, importedIds: [], dynamicallyImportedIds: [] },
    { id: app, isEntry: false, importedIds: [], dynamicallyImportedIds: [] },
  ]));
  assert.match(errors.join("\n"), /denied module|outside the Lab\/closure boundary/);
});

test("rejects a forbidden transitive product import", () => {
  const api = path.join(WEB_ROOT, "src/lib/api.ts");
  const errors = validateModuleGraph(graph([
    { id: labEntry, isEntry: true, importedIds: [admission], dynamicallyImportedIds: [] },
    { id: admission, isEntry: false, importedIds: [membership], dynamicallyImportedIds: [] },
    { id: membership, isEntry: false, importedIds: [companion], dynamicallyImportedIds: [] },
    { id: companion, isEntry: false, importedIds: [api], dynamicallyImportedIds: [] },
    { id: api, isEntry: false, importedIds: [], dynamicallyImportedIds: [] },
  ]));
  assert.match(errors.join("\n"), /denied module|outside the Lab\/closure boundary/);
});

test("rejects forbidden package reachability", () => {
  const supabase = path.join(WEB_ROOT, "node_modules/@supabase/supabase-js/dist/index.js");
  const errors = validateModuleGraph(graph([
    { id: labEntry, isEntry: true, importedIds: [membership, supabase], dynamicallyImportedIds: [] },
    { id: membership, isEntry: false, importedIds: [], dynamicallyImportedIds: [] },
    { id: supabase, isEntry: false, importedIds: [], dynamicallyImportedIds: [] },
  ]));
  assert.match(errors.join("\n"), /outside the Lab allowlist|denied module/);
});
