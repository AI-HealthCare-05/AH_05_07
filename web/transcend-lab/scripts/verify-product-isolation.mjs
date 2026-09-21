import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { PRODUCT_OUT_DIR } from "./isolation-guard.mjs";

const markers = [
  /transcend-lab/i,
  /CompanionInteractionLab/,
  /phase1-cross-route-relocation-v1/,
];
const textExtensions = new Set([".html", ".js", ".css", ".json", ".map", ".txt"]);

if (!existsSync(PRODUCT_OUT_DIR)) {
  throw new Error(`product build output is absent: ${PRODUCT_OUT_DIR}`);
}

const pending = [PRODUCT_OUT_DIR];
const violations = [];
while (pending.length) {
  const current = pending.pop();
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    const relative = path.relative(PRODUCT_OUT_DIR, absolute).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      pending.push(absolute);
      continue;
    }
    if (markers.some((marker) => marker.test(relative))) violations.push(`filename:${relative}`);
    if (!textExtensions.has(path.extname(entry.name))) continue;
    const content = readFileSync(absolute, "utf8");
    if (markers.some((marker) => marker.test(content))) violations.push(`content:${relative}`);
  }
}

if (violations.length) {
  throw new Error(`default product build contains Lab markers:\n${violations.join("\n")}`);
}
process.stdout.write("Default product build contains no Transcend Lab marker or entry.\n");
