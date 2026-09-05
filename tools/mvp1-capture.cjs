// Capture existing synthetic fixtures; never authenticate or call a deployed API.
const { chromium } = require('../web/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = 'http://127.0.0.1:4185';
const output = path.resolve(process.argv[2] || 'docs/evidence/mvp1');
const states = [
  ['normal', 'VP-10', 'S10'],
  ['empty', 'VP-04', 'S12'],
  ['error', 'VP-11a', 'S13'],
  ['not-ready', 'VP-10', 'S11'],
];
(async () => {
  const browser = await chromium.launch();
  try {
    fs.mkdirSync(output, { recursive: true });
    for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
      const external = [];
      await context.route('**/*', (route) => {
        if (new URL(route.request().url()).origin !== base) {
          external.push(route.request().url());
          return route.abort();
        }
        return route.continue();
      });
      const page = await context.newPage();
      for (const [name, fixture, scene] of states) {
        await page.goto(`${base}/?fixture=${fixture}&screen=${scene}`);
        await page.locator(`[data-scene="${scene}"]`).waitFor();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        // Capture provenance banner only; no product text or behavior is substituted.
        await page.evaluate(() => {
          const banner = document.createElement('div');
          banner.textContent = '합성 fixture · 로컬 제출 검토용 · 운영 실행 증거 아님';
          banner.style.cssText = 'position:relative;background:#183136;color:white;padding:8px;text-align:center;font:12px sans-serif;z-index:999';
          document.body.prepend(banner);
        });
        await page.screenshot({ path: path.join(output, `${name}-${viewport.width}.png`), fullPage: true });
      }
      assert.deepEqual(external, [], 'Unexpected non-local request');
      await context.close();
    }
    console.log('PASS: 8 synthetic captures; loopback-only requests; no horizontal overflow');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
