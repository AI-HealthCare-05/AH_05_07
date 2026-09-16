import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/canonical-origin.js", import.meta.url), "utf8");
const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");

function run(href) {
  const url = new URL(href);
  let replaced = null;
  const location = {
    href: url.toString(),
    hostname: url.hostname,
    replace(value) { replaced = value; },
  };
  vm.runInNewContext(source, { URL, window: { location } });
  return replaced;
}

test("fallback app redirects to hyeol.app before the Vite entry", () => {
  assert.equal(
    run("https://ah-05-07-pages.ahnsangkyoon.workers.dev/auth/confirm?token_hash=synthetic&type=email#x"),
    "https://hyeol.app/auth/confirm?token_hash=synthetic&type=email#x",
  );
  assert.ok(indexHtml.indexOf("/canonical-origin.js") < indexHtml.indexOf("/src/main.tsx"));
});

test("canonical and explicit operator fallback stay in place", () => {
  assert.equal(run("https://hyeol.app/?screen=S14"), null);
  assert.equal(
    run("https://ah-05-07-pages.ahnsangkyoon.workers.dev/?fallback=1&screen=S14"),
    null,
  );
});
