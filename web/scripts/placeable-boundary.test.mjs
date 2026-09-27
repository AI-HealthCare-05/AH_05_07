import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { assertDefaultEntryIsolation, assertPlaceableModule, E2_WORLD_SEAMS, placeableBoundary } from "./placeable-boundary.mjs";

const chunk = (fileName, modules, imports = [], dynamicImports = []) => ({ type: "chunk", fileName,
  modules: Object.fromEntries(modules.map((id) => [id, {}])), imports, dynamicImports });

test("only narrow E1/generic seams enter the product, never the Lab or Rapier", () => {
  for (const seam of E2_WORLD_SEAMS) assert.doesNotThrow(() => assertPlaceableModule(`/web/transcend-lab/src/${seam}`));
  for (const file of ["CompanionInteractionLab.tsx", "labRuntime.ts", "worldPlayableStage.ts", "platform/spatial/kinematicWorld.ts"]) {
    assert.throws(() => assertPlaceableModule(`/web/transcend-lab/src/${file}`), /outside its narrow seams/);
  }
  assert.throws(() => assertPlaceableModule("/web/node_modules/@dimforge/rapier3d-compat/rapier.js"), /physics runtime/);
});

test("built default/Classic/guest chunks may dynamically reach E2 but cannot eagerly execute it", () => {
  const bundle = {
    entry: chunk("index.js", ["/web/src/main.tsx", "/web/src/placeable/contract.ts"], [], ["e2.js", "app.js"]),
    app: chunk("app.js", ["/web/src/App.tsx"]), guest: chunk("guest.js", ["/web/src/GuestJourneySandbox.tsx"]),
    e2: chunk("e2.js", ["/web/src/placeable/ProductPlaceableEntry.tsx"], [], ["world.js"]),
    world: chunk("world.js", ["/web/src/placeable/PlaceableWorld.tsx"]),
  };
  assert.doesNotThrow(() => assertDefaultEntryIsolation(bundle));
  for (const key of ["entry", "app", "guest"]) {
    bundle[key].imports.push("e2.js");
    assert.throws(() => assertDefaultEntryIsolation(bundle), /eagerly executes E2/);
    bundle[key].imports.pop();
  }
  bundle.e2.imports.push("world.js"); assert.throws(() => assertDefaultEntryIsolation(bundle), /eagerly executes E2/);
  bundle.e2.imports.pop();
  bundle.entry.imports.push("world.js"); assert.throws(() => assertDefaultEntryIsolation(bundle), /eagerly executes E2/);
  bundle.entry.imports.pop();
  bundle.entry.modules["/web/src/placeable/ProductPlaceableEntry.tsx"] = {};
  assert.throws(() => assertDefaultEntryIsolation(bundle), /eagerly executes E2/);
});

test("renderer cannot import account, API, controller or health state", () => {
  const plugin = placeableBoundary(); plugin.configResolved({ root: "/web" });
  for (const source of ["placeable/PlaceableWorld.tsx", "placeable/livingChoiceMarker.ts", "ui/livingChoice.ts"]) {
    const id = `/web/src/${source}`;
    for (const imported of ["lib/supabase.ts", "lib/api.ts", "placeable/controller.ts", "placeable/persistence.ts", "App.tsx", "ui/LivingChoiceLink.tsx"]) {
      assert.throws(() => plugin.moduleParsed({ id, importedIds: [`/web/src/${imported}`], dynamicallyImportedIds: [] }), /product state/);
    }
  }
});

test("actual bootstrap preserves default, Classic direct URLs, guest and auth; E2 is explicit opt-in", async () => {
  const contractSource = readFileSync(new URL("../src/placeable/contract.ts", import.meta.url), "utf8");
  const mainSource = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
  const compile = (source) => ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const contract = {};
  runInNewContext(compile(contractSource), { exports: contract, URLSearchParams });
  for (const [search, hash, expected] of [
    ["", "", "./App"], ["?screen=S02", "", "./App"], ["?screen=S07", "", "./App"],
    ["?experience=e2&screen=S02", "", "./App"], ["?experience=e2&guest=1", "", "./GuestJourneySandbox"],
    ["?experience=e2&code=synthetic", "", "./App"], ["?experience=e2&auth=email-confirm", "", "./App"],
    ["?experience=e2", "#access_token=synthetic", "./App"], ["?experience=e2", "#type=recovery", "./App"],
    ["?experience=e2&view=classic", "", "./placeable/ProductPlaceableEntry"],
    ["?experience=e2&view=3d", "", "./placeable/ProductPlaceableEntry"],
  ]) {
    const loaded = [], rendered = [];
    runInNewContext(compile(mainSource), {
      exports: {}, URLSearchParams, Promise,
      window: { location: { search, hash }, addEventListener() {} }, document: { getElementById() { return {}; } },
      require(id) {
        if (id === "react") return { StrictMode: "StrictMode" };
        if (id === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }) };
        if (id === "react-dom/client") return { createRoot: () => ({ render: (value) => rendered.push(value) }) };
        if (id.endsWith(".css")) return {};
        if (id === "./placeable/contract") return contract;
        if (id === "./ui/themePreference") return { applyThemePreference() {}, readThemePreference() {} };
        loaded.push(id); return { default: id };
      },
    });
    await setImmediate();
    assert.deepEqual(loaded, [expected], search + hash);
    assert.equal(rendered.length, 1);
    if (expected === "./App" || expected === "./GuestJourneySandbox") assert.equal(rendered[0].type, "StrictMode");
  }
});
