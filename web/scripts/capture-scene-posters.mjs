// Explicit authoring command. Builds an isolated review preview from authored
// camera inputs; never replaces the build-verified runtime module or deploys it.
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { build, preview } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const web = path.join(root, "web");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const manifest = JSON.parse(await fs.readFile(path.join(web, "src/ui/scene-manifest.v2.json"), "utf8"));
const recipes = manifest.recipes.filter(recipe => recipe.mode === "realtime");
const character = manifest.assets.find(asset => asset.kind === "character");
const directory = "scene-review/s02/v1";
const output = path.join(web, "public", directory);
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "sk7-poster-preview-"));
const sources = ["web/src/components/scene/environment.ts", "web/src/components/scene/ThreeSceneRenderer.tsx", "web/scripts/capture-scene-posters.mjs"];
const sourceHashes = Object.fromEntries(await Promise.all(sources.map(async source => [source, hash(await fs.readFile(path.join(root, source)))])));
let server, browser;
try {
  await build({ root: web, build: { outDir: temporary, emptyOutDir: true },
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("http://e2e.invalid"), "import.meta.env.VITE_SK7_E2E_MODE": '"1"', "import.meta.env.VITE_SK7_SCENE_MODE": '"review"' },
    plugins: [{ name: "authored-scene-capture", enforce: "pre", load(id) {
      if (id === path.join(web, "src/ui/sceneManifest.generated.ts")) return `export const sceneManifest = ${JSON.stringify(manifest)} as const;`;
    } }],
  });
  server = await preview({ root: web, build: { outDir: temporary }, preview: { host: "127.0.0.1", port: 4173, strictPort: true } });
  browser = await chromium.launch();
  await fs.mkdir(output, { recursive: true });
  const posters = [];
  for (const [profile, width, height] of [["mobile320", 320, 844], ["mobile390", 390, 844], ["desktop", 1366, 900]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.route("http://e2e.invalid/**", route => {
      const url = new URL(route.request().url());
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:4173", "Access-Control-Allow-Headers": "authorization,content-type" }, body: JSON.stringify({
        start_on: url.searchParams.get("start_on"), end_on: url.searchParams.get("end_on"), blood_pressure_observations: [], active_challenge: null, challenge_checkins: [],
        challenge_events: [{ id: "synthetic-poster", observed_on: url.searchParams.get("end_on"), action_id: "walk-10-minutes", status: "skipped" }],
      }) });
    });
    // The calendar order is explicit; a recipe array reorder must not retag pixels.
    const landmarks = ["garden-gate", "herb-garden", "shade-tree", "footbridge", "reading-shelter", "pavilion", "sunset-overlook"];
    for (const [index, landmarkId] of landmarks.entries()) {
      const recipe = recipes.find(entry => entry.landmarkId === landmarkId);
      await page.clock.setFixedTime(new Date(`2026-09-${String(index + 7).padStart(2, "0")}T03:00:00Z`));
      await page.goto("http://127.0.0.1:4173/?e2e=signed-in&screen=S02");
      const stage = page.locator(`.living-visual-stage[data-scene-recipe="${recipe.id}"]`);
      await stage.scrollIntoViewIfNeeded();
      await page.locator('[data-living-scene-status="ready"]').waitFor({ timeout: 20000 });
      const metrics = await stage.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight, background: getComputedStyle(element).backgroundColor }));
      await page.addStyleTag({ content: `.living-visual-stage{border-radius:0!important;width:${metrics.width}px!important;height:${metrics.height}px!important}` });
      const png = await stage.screenshot();
      const encoded = await page.evaluate(async base64 => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        canvas.getContext("2d").drawImage(bitmap, 0, 0);
        const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.9 });
        bitmap.close();
        return { bytes: Array.from(new Uint8Array(await blob.arrayBuffer())), width: canvas.width, height: canvas.height };
      }, png.toString("base64"));
      const bytes = Buffer.from(encoded.bytes), sha256 = hash(bytes);
      const objectKey = `${directory}/${landmarkId}-${profile}-${sha256.slice(0, 16)}.webp`;
      await fs.writeFile(path.join(web, "public", objectKey), bytes);
      const stats = await page.locator(".living-three-scene").evaluate(element => ({ drawCalls: Number(element.dataset.drawCalls), triangles: Number(element.dataset.triangles), subjectBounds: JSON.parse(element.dataset.subjectBounds) }));
      posters.push({ id: `poster-${landmarkId}-${profile}`, landmarkId, profile, width: encoded.width, height: encoded.height, viewport: { width, height }, stage: metrics, ...stats,
        compositionHash: hash(JSON.stringify(recipe.compositions[profile])),
        delivery: { url: `/${objectKey}`, objectKey, sha256, byteLength: bytes.length, mime: "image/webp" },
      });
      console.log(`${landmarkId} ${profile}: ${bytes.length} bytes`);
    }
    await context.close();
  }
  const evidence = { status: "review-only", deliveryStatus: "local-review; R2 authentication pending", intendedR2Bucket: "sk7-assets-prod", intendedPublicOrigin: "https://sk7-companion.gkrry.com",
    source: "Repository-authored Three.js scene captured with Chromium; PNG to WebP encoding only, no image generation or retouching", sourceHashes,
    characterSha256: character.delivery.sha256, characterRightsReference: character.provenance.reviewReference,
    visualDirectionReferences: ["DAHUPjn8shI", "DAHUPjDn-Rw"], visualDirectionUse: "Canva reference contract only; these posters are not Canva exports",
    renderer: { three: "0.185.1", chromium: browser.version(), deviceScaleFactor: 2, rendererDprCap: 1.25, webpQuality: 0.9 },
    posters,
  };
  await fs.writeFile(path.join(root, "docs/evidence/scene-clay-posters.json"), `${JSON.stringify(evidence, null, 2)}\n`);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
  await fs.rm(temporary, { recursive: true, force: true });
}
