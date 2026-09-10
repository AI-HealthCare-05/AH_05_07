import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Temporary phone review: serve a frozen build and synthetic browser responses.
// No API server, input collector, telemetry endpoint, or filesystem passthrough.
const root = fileURLToPath(new URL("../../", import.meta.url));
const dist = path.join(root, "web/dist");
const reference = JSON.parse(await readFile(process.argv[2] ?? path.join(root, "docs/evidence/scene-ios-simulator-safari-position-fix.json")));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const files = new Map();
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary" };
for (const [name, digest] of Object.entries(reference.build)) {
  const bytes = await readFile(path.join(dist, name));
  assert.equal(hash(bytes), digest, "Build differs from recorded position-fix candidate");
  files.set(`/${name}`, bytes);
}
files.set("/favicon.svg", await readFile(path.join(dist, "favicon.svg")));
async function addPosters(directory) {
  for (const entry of await readdir(path.join(dist, directory), { withFileTypes: true })) {
    const name = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await addPosters(name);
    else if (entry.isFile() && path.extname(name) === ".webp") files.set(`/${name}`, await readFile(path.join(dist, name)));
  }
}
await addPosters("scene-review");

// Freeze the exact manifest GLBs at this origin; the public origin's CORS policy
// is unchanged. This mirror is unsuitable for production CDN/cache acceptance.
const generated = await readFile(path.join(root, "web/src/ui/companionAssets.generated.ts"), "utf8");
const assets = JSON.parse(generated.match(/export const companionAssetManifest = ([\s\S]*?) as const\b/)[1]);
const remoteAssets = Object.values(assets).flatMap(variants => Object.values(variants));
const outcomes = await Promise.allSettled(remoteAssets.map(async asset => {
  const url = new URL(asset.url);
  assert.equal(url.origin, "https://sk7-companion.gkrry.com");
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(30_000), redirect: "error" });
  assert.ok(response.ok, "Approved GLB download failed");
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.length, asset.bytes);
  assert.equal(hash(bytes), asset.sha256, "Approved GLB digest mismatch");
  files.set(`/review-media${url.pathname}`, bytes);
}));
for (const outcome of outcomes) if (outcome.status === "rejected") throw outcome.reason;

function fixture() {
  const nativeFetch = window.fetch.bind(window);
  let saved = null;
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (url.origin === "http://e2e.invalid") {
      if (method === "GET" && url.pathname === "/api/v1/observations/window") {
        const start_on = url.searchParams.get("start_on"), end_on = url.searchParams.get("end_on");
        const observation = saved ?? { id: "synthetic-existing", observed_on: end_on, period: "morning", systolic: 118, diastolic: 76 };
        return json({ start_on, end_on, blood_pressure_observations: observation.observed_on >= start_on && observation.observed_on <= end_on ? [observation] : [], challenge_events: [], challenge_checkins: [], active_challenge: null });
      }
      if (method === "POST" && url.pathname === "/api/v1/observations/blood-pressure") {
        const value = JSON.parse(init?.body ?? "{}");
        if (value.systolic !== 120 || value.diastolic !== 80 || !/^\d{4}-\d{2}-\d{2}$/.test(value.observed_on) || !["morning", "evening"].includes(value.period)) {
          return json({ code: "validation_error", message: "검토용 수치 120 / 80을 입력해 주세요." }, 422);
        }
        saved = { id: "synthetic-save", observed_on: value.observed_on, period: value.period, systolic: 120, diastolic: 80 };
        return json(saved, 201);
      }
      throw new Error("This review supports only synthetic observation and save requests");
    }
    if (method !== "GET") throw new Error("No network writes in the phone review");
    if (url.origin === "https://sk7-companion.gkrry.com" && /^\/companion\/v1\/[^/]+\/v\d+\/(lite|standard)\.glb$/.test(url.pathname)) {
      return nativeFetch(`/review-media${url.pathname}`, { signal: init?.signal ?? (input instanceof Request ? input.signal : undefined) });
    }
    if (url.origin !== location.origin) throw new Error("Unsupported review request");
    return nativeFetch(input, init);
  };
}

const script = `(${fixture.toString()})();`;
const scriptHash = createHash("sha256").update(script).digest("base64");
const html = files.get("/index.html").toString().replace("<head>", `<head><script>${script}</script>`).replace("<title>", "<title>스마트폰 검토 · ");
files.set("/index.html", Buffer.from(html));
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": `default-src 'none'; script-src 'self' 'sha256-${scriptHash}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://sk7-companion.gkrry.com https://sk7-assets.gomdory.com; connect-src 'self'; font-src 'self' data:; worker-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
};
createServer((req, res) => {
  try {
    if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405, headers); res.end(); return; }
    const url = new URL(req.url, "http://127.0.0.1:4175");
    if (url.pathname === "/" && url.searchParams.get("e2e") !== "signed-in") {
      res.writeHead(302, { ...headers, Location: "/?e2e=signed-in&screen=S02&review=phone-position-1" }); res.end(); return;
    }
    const name = url.pathname === "/" ? "/index.html" : url.pathname;
    const bytes = files.get(name);
    if (!bytes) { res.writeHead(404, headers); res.end("Not found"); return; }
    res.writeHead(200, { ...headers, "Content-Type": types[path.extname(name)], "Content-Length": bytes.length });
    res.end(req.method === "HEAD" ? undefined : bytes);
  } catch { res.writeHead(400, headers); res.end(); }
}).listen(4175, "127.0.0.1", () => console.log(`Frozen synthetic phone review on http://127.0.0.1:4175 (${files.size} public files; ${remoteAssets.length} verified GLBs)`));
