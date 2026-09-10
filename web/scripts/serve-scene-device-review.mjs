import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Local-only manual Safari/Simulator fixture for the already measured build.
// No API writes, public listener, persistent inputs, cache clearing or OS changes.
const root = fileURLToPath(new URL("../../", import.meta.url));
const dist = path.join(root, "web/dist");
const referencePath = process.argv[2] ?? path.join(root, "docs/evidence/scene-android-performance-after-fix.json");
const reference = JSON.parse(await readFile(referencePath));
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const fixtureSha256 = sha256(await readFile(fileURLToPath(import.meta.url)));
for (const [name, digest] of Object.entries(reference.build)) {
  assert.equal(sha256(await readFile(path.join(dist, name))), digest, "Build differs from the recorded candidate");
}
const records = [];
// The public GLB's existing CORS policy permits this exact review origin.
const port = 4173;

function fixture() {
  const originalFetch = window.fetch.bind(window);
  let saves = 0, contexts = 0, contextCreations = 0, errors = 0, renderer = null;
  const diagnostics = [];
  const seen = new WeakSet();
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (url.origin === "http://e2e.invalid") {
      let body, status = 200;
      if (method === "GET" && url.pathname === "/api/v1/observations/window") {
        const start_on = url.searchParams.get("start_on"), end_on = url.searchParams.get("end_on");
        body = { start_on, end_on, blood_pressure_observations: [{ id: "synthetic-existing", observed_on: end_on, period: "morning", systolic: 118, diastolic: 76 }], challenge_events: [], challenge_checkins: [], active_challenge: null };
      } else if (method === "POST" && url.pathname === "/api/v1/observations/blood-pressure") {
        const value = JSON.parse(init?.body ?? "{}");
        if (value.systolic !== 120 || value.diastolic !== 80) throw new Error("Use only the synthetic 120/80 fixture");
        saves++; status = 201; body = { id: "synthetic-save", ...value };
      } else throw new Error("Unsupported synthetic request");
      return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    }
    if (method !== "GET" || ![location.origin, "https://sk7-companion.gkrry.com"].includes(url.origin)) throw new Error("Unsupported fixture request");
    try {
      const response = await originalFetch(input, init);
      if (!response.ok && diagnostics.length < 8) diagnostics.push("asset-http-error");
      return response;
    } catch (error) { if (diagnostics.length < 8) diagnostics.push("asset-fetch-error"); throw error; }
  };
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...args) {
    const context = getContext.apply(this, args);
    if (context && /^webgl/.test(args[0]) && !seen.has(context)) {
      seen.add(context); contexts++; contextCreations++;
      const extension = context.getExtension("WEBGL_debug_renderer_info");
      if (extension) renderer = String(context.getParameter(extension.UNMASKED_RENDERER_WEBGL)).slice(0, 200);
      this.addEventListener("webglcontextlost", () => { contexts--; record(); }, { once: true });
    }
    return context;
  };
  window.addEventListener("error", () => { errors++; }, true);
  window.addEventListener("unhandledrejection", () => { errors++; });
  let previous = "";
  function record() {
    const scene = document.querySelector("[data-scene]");
    if (!scene) return;
    const canvas = document.querySelector("canvas");
    const slot = document.querySelector("[data-saved-scene-status]")?.getBoundingClientRect();
    const input = document.querySelector("#systolic");
    const state = {
      screen: scene.getAttribute("data-scene"),
      livingStatus: document.querySelector("[data-living-scene-status]")?.getAttribute("data-living-scene-status") ?? null,
      savedStatus: document.querySelector("[data-saved-scene-status]")?.getAttribute("data-saved-scene-status") ?? null,
      phase: document.querySelector("[data-saved-scene-phase]")?.getAttribute("data-saved-scene-phase") ?? null,
      celebrateCount: Number(document.querySelector("[data-saved-scene-celebrate-count]")?.getAttribute("data-saved-scene-celebrate-count") ?? 0),
      saves, contexts, contextCreations, errors, canvasCount: document.querySelectorAll("canvas").length,
      canvasWidth: canvas?.width ?? 0, canvasHeight: canvas?.height ?? 0,
      visualViewportNarrowerThanDocument: document.documentElement.scrollWidth > innerWidth,
      layoutOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      layoutWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
      visualScale: window.visualViewport?.scale ?? 1,
      scrollY, visualOffsetTop: window.visualViewport?.offsetTop ?? 0,
      slotTop: slot?.top ?? 0, slotBottom: slot?.bottom ?? 0,
      inputFontPx: input ? parseFloat(getComputedStyle(input).fontSize) : 0,
      width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      secureContext: window.isSecureContext, subtleCrypto: Boolean(window.crypto?.subtle),
      visibility: document.visibilityState, userAgent: navigator.userAgent, renderer,
      diagnostics,
    };
    const serialized = JSON.stringify(state);
    if (previous === serialized) return;
    previous = serialized;
    void originalFetch("/__probe", { method: "POST", headers: { "Content-Type": "application/json" }, body: serialized, keepalive: true });
  }
  document.addEventListener("DOMContentLoaded", () => {
    new MutationObserver(record).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-scene", "data-living-scene-status", "data-saved-scene-status", "data-saved-scene-phase", "data-saved-scene-celebrate-count", "width", "height"] });
    record();
  });
  document.addEventListener("visibilitychange", record);
  window.addEventListener("resize", record);
  let scrollTimer;
  const settledViewport = () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(record, 150); };
  window.addEventListener("scroll", settledViewport, { passive: true });
  window.visualViewport?.addEventListener("resize", settledViewport);
  window.visualViewport?.addEventListener("scroll", settledViewport);
}

function sanitize(value) {
  const result = {};
  for (const key of ["celebrateCount", "saves", "contexts", "contextCreations", "errors", "canvasCount", "canvasWidth", "canvasHeight", "width", "height", "dpr", "layoutWidth", "scrollWidth", "visualScale", "scrollY", "visualOffsetTop", "slotTop", "slotBottom", "inputFontPx"]) {
    assert.ok(Number.isFinite(value[key]) && Math.abs(value[key]) < 100_000);
    if (!["scrollY", "visualOffsetTop", "slotTop", "slotBottom"].includes(key)) assert.ok(value[key] >= 0);
    result[key] = value[key];
  }
  for (const key of ["visualViewportNarrowerThanDocument", "layoutOverflow", "reducedMotion", "secureContext", "subtleCrypto"]) { assert.equal(typeof value[key], "boolean"); result[key] = value[key]; }
  for (const [key, allowed] of Object.entries({ screen: ["S02", "S04", "S05", "S08", "S10"], livingStatus: [null, "ready", "poster", "fallback"], savedStatus: [null, "ready", "loading", "fallback"], phase: [null, "idle", "celebrate", "pending"], visibility: ["visible", "hidden"] })) {
    assert.ok(allowed.includes(value[key])); result[key] = value[key];
  }
  assert.match(value.userAgent, /^Mozilla\/5\.0 \(iPhone;/);
  result.userAgent = value.userAgent.slice(0, 250);
  result.renderer = typeof value.renderer === "string" ? value.renderer.replace(/[^\w .(),/-]/g, "").slice(0, 200) : null;
  assert.ok(Array.isArray(value.diagnostics) && value.diagnostics.length <= 8);
  result.diagnostics = value.diagnostics.map(value => { assert.ok(["asset-http-error", "asset-fetch-error"].includes(value)); return value; });
  return result;
}

const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".glb": "model/gltf-binary" };
const server = createServer(async (req, res) => {
  try {
    assert.ok([`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host));
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (req.method === "POST" && url.pathname === "/__probe") {
      assert.equal(req.headers.origin, `http://${req.headers.host}`);
      let body = "";
      for await (const chunk of req) { body += chunk; assert.ok(body.length <= 4096); }
      if (records.length < 500) records.push({ observedAt: new Date().toISOString(), ...sanitize(JSON.parse(body)) });
      res.writeHead(204); res.end(); return;
    }
    assert.equal(req.method, "GET");
    if (url.pathname === "/__evidence") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ scope: "Simulator Safari, local synthetic fixture; not physical iPhone acceptance or a performance measurement", sourceRevision: reference.sourceRevision, sourceFiles: reference.sourceFiles ?? null, build: reference.build, fixtureSha256, records }, null, 2)); return;
    }
    const file = path.resolve(dist, `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`);
    assert.ok(file.startsWith(dist + path.sep));
    let bytes = await readFile(file);
    if (path.extname(file) === ".html") bytes = Buffer.from(bytes.toString().replace("<head>", `<head><script>(${fixture.toString()})();</script>`));
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(bytes);
  } catch { res.writeHead(400); res.end("Unsupported local review request"); }
});
server.listen(port, "127.0.0.1", () => console.log(`Local synthetic Simulator review: http://127.0.0.1:${port}/?e2e=signed-in&screen=S02`));
