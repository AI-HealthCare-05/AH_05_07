import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { LAB_OUT_DIR, WEB_ROOT } from "./isolation-guard.mjs";
import {
  REVIEW_MODES,
  assertDeviceClass,
  parsePinnedAssetContract,
  safeStaticPath,
  verifyPinnedAssetBytes,
} from "./physical-review-lib.mjs";

const labRoot = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const args = process.argv.slice(2);

function arg(name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

function inside(value, parent) {
  const relative = path.relative(parent, value);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function mimeType(file) {
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
  })[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

function lanAddresses() {
  const values = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) values.push(entry.address);
    }
  }
  return [...new Set(values)];
}

function reviewBootstrap(config) {
  const serialized = JSON.stringify(config);
  return [
    "<script>",
    "(() => {",
    "\"use strict\";",
    "const config = " + serialized + ";",
    "const mode = new URLSearchParams(location.search).get(\"mode\");",
    "if (!config.reviewModes.includes(mode)) { document.documentElement.textContent = \"Invalid W1 physical review mode.\"; return; }",
    "const originalFetch = window.fetch.bind(window);",
    "let assetProxyRequests = 0;",
    "window.fetch = (input, init) => {",
    "  const requested = input instanceof Request ? input.url : String(input);",
    "  if (requested === config.assetUrl) {",
    "    assetProxyRequests += 1;",
    "    return originalFetch(\"/__transcend-review/pinned-bear.glb?token=\" + encodeURIComponent(config.token), init);",
    "  }",
    "  return originalFetch(input, init);",
    "};",
    "Object.defineProperty(window, \"__SK7_W1_PHYSICAL_REVIEW__\", {",
    "  configurable: true,",
    "  value: { config, assetProxyRequests: () => assetProxyRequests },",
    "});",
    "document.addEventListener(\"DOMContentLoaded\", () => {",
    "  const box = document.createElement(\"aside\");",
    "  box.style.cssText = \"position:sticky;top:0;z-index:2147483647;padding:10px;background:#fff8c5;color:#111;border:2px solid #111;font:14px/1.4 system-ui,sans-serif\";",
    "  box.textContent = \"PHYSICAL W1 REVIEW · \" + config.deviceClass + \" · \" + mode + \" · exact pinned bear proxy. Use Start W1 playable, real touch Move/Look, Grove station, Stop and Reset. Confirm resource diagnostics drain to zero. This is not production activation.\";",
    "  document.body.prepend(box);",
    "});",
    "})();",
    "</script>",
  ].join("\n");
}

const deviceClass = assertDeviceClass(arg("--device"));
const output = path.resolve(arg("--output"));
const port = Number(arg("--port", "4175"));

assert(output && output !== path.resolve("."), "--output is required");
assert(!existsSync(output), "use a new output directory");
assert(!inside(output, WEB_ROOT), "physical review output must stay outside web repository");
assert(Number.isInteger(port) && port > 1024 && port < 65536, "invalid port");

const build = spawnSync("npm", ["run", "build"], {
  cwd: labRoot,
  stdio: "inherit",
  env: process.env,
});
assert.equal(build.status, 0, "Transcend Lab build failed");

const sourceSha = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: WEB_ROOT,
  encoding: "utf8",
}).stdout.trim();
assert.match(sourceSha, /^[0-9a-f]{40}$/);

const assetSource = readFileSync(
  path.join(labRoot, "src/platform/embodiment/labEmbodimentPort.ts"),
  "utf8",
);
const assetContract = parsePinnedAssetContract(assetSource);
const assetResponse = await fetch(assetContract.url, {
  headers: { Accept: "model/gltf-binary,application/octet-stream;q=0.9" },
});
assert(assetResponse.ok, "pinned asset download failed: " + assetResponse.status);
const assetBytes = Buffer.from(await assetResponse.arrayBuffer());
verifyPinnedAssetBytes(assetBytes, assetContract);

mkdirSync(output, { recursive: false });
writeFileSync(path.join(output, "pinned-bear.glb"), assetBytes);
const token = randomBytes(24).toString("hex");
writeFileSync(
  path.join(output, "session-metadata.json"),
  JSON.stringify({
    documentType: "SK7_TRANSCEND_W1_PHYSICAL_REVIEW_SESSION",
    sourceSha,
    deviceClass,
    asset: assetContract,
    generatedAt: new Date().toISOString(),
    reviewModes: REVIEW_MODES,
    qualificationScope: "physical W1 usability review only; no production activation",
  }, null, 2) + "\n",
);

const server = createServer((request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://" + (request.headers.host ?? "review.local"));
    if (url.pathname === "/__transcend-review/pinned-bear.glb") {
      if (url.searchParams.get("token") !== token) {
        response.writeHead(403).end();
        return;
      }
      response.writeHead(200, {
        "content-type": "model/gltf-binary",
        "content-length": assetBytes.byteLength,
        "cache-control": "no-store",
      });
      response.end(assetBytes);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }

    if (url.pathname === "/") {
      if (url.searchParams.get("token") !== token) {
        response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
        response.end("W1 physical review token required.");
        return;
      }
      let html = readFileSync(path.join(LAB_OUT_DIR, "index.html"), "utf8");
      html = html.replace(
        "</head>",
        reviewBootstrap({
          token,
          deviceClass,
          sourceSha,
          assetUrl: assetContract.url,
          reviewModes: REVIEW_MODES,
        }) + "\n</head>",
      );
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      });
      if (request.method === "HEAD") response.end();
      else response.end(html);
      return;
    }

    const file = safeStaticPath(LAB_OUT_DIR, url.pathname);
    if (!existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    const bytes = readFileSync(file);
    response.writeHead(200, {
      "content-type": mimeType(file),
      "content-length": bytes.byteLength,
      "cache-control": "no-store",
    });
    if (request.method === "HEAD") response.end();
    else response.end(bytes);
  } catch (error) {
    response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }));
  }
});

server.listen(port, "0.0.0.0", () => {
  const urls = lanAddresses().map((address) => ({
    address,
    normal: "http://" + address + ":" + port + "/?token=" + token + "&mode=normal",
    reducedMotion: "http://" + address + ":" + port + "/?token=" + token + "&mode=reduced-motion",
  }));
  console.log(JSON.stringify({
    status: "ready",
    sourceSha,
    deviceClass,
    port,
    output,
    asset: assetContract,
    urls,
    androidLoopback: {
      reverseCommand: "adb reverse tcp:" + port + " tcp:" + port,
      normal: "http://127.0.0.1:" + port + "/?token=" + token + "&mode=normal",
      reducedMotion: "http://127.0.0.1:" + port + "/?token=" + token + "&mode=reduced-motion",
    },
    notes: [
      "Use a real physical browser; desktop emulation, Playwright WebKit, and iOS Simulator do not qualify.",
      "The exact pinned bear bytes are verified before serving through a review-only same-origin proxy.",
      "R2, Cloudflare, production routes, APIs, Auth, Data and Model V2 are unchanged.",
      "WSL NAT/LAN reachability is an operator/network prerequisite; this tool does not add a tunnel or change Windows networking.",
    ],
  }, null, 2));
});
