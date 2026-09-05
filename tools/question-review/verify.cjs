// Synthetic browser checks only. Uses the repository's existing locked Playwright.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('../../web/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
const output = path.resolve(process.argv[2] || path.join(root, 'web/test-results/question-review'));
const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');
const appCode = ['index.html', 'review.js', 'review-data.js', 'review.css'].map(read).join('\n');
assert(!/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|serviceWorker|eval)\b/.test(appCode));
assert(!/document\.cookie|\bimport\s|\brequire\s*\(/.test(appCode));
assert(!/<(?:form|input|textarea|iframe)\b|contenteditable/i.test(appCode));
assert(appCode.includes("connect-src 'none'"));
// Production bundle must exist; fail rather than skip the isolation check.
const dist = path.join(root, 'web/dist');
assert(fs.existsSync(path.join(dist, 'index.html')), 'Run npm --prefix web run build first');
function checkDist(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) checkDist(file);
    else assert(!/입력 질문 검토실|question-review|review-data\.js/.test(fs.readFileSync(file, 'utf8')), 'Review package leaked into production build');
  }
}
checkDist(dist);
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  try {
    let visited = 0;
    for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      const errors = [];
      const network = [];
      await context.route(/^https?:/, (route) => { network.push(route.request().url()); return route.abort(); });
      await context.addInitScript(() => {
        window.reviewViolations = [];
        for (const name of ['localStorage', 'sessionStorage', 'indexedDB']) {
          Object.defineProperty(window, name, { get() { window.reviewViolations.push(name); throw Error('No storage'); } });
        }
        document.addEventListener('securitypolicyviolation', (e) => window.reviewViolations.push(e.violatedDirective));
      });
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('request', (request) => { if (!request.url().startsWith('file:')) network.push(request.url()); });
      await page.goto(pathToFileURL(path.join(__dirname, 'index.html')).href);
      assert.equal(await page.locator('#features button').count(), 8);
      assert.equal(await page.locator('input,textarea,form,[contenteditable]').count(), 0);
      const fixtures = await page.evaluate(() => window.REVIEW);
      assert.deepEqual(fixtures.map((f) => f.id), ['RIAGENDR', 'RIDAGEYR', 'BMXBMI', 'PAQ605', 'PAQ620', 'SMQ020', 'ALQ111', 'SLD012']);
      // Actual keyboard activation and tab/shift-tab focus, including source links.
      await page.keyboard.press('Tab');
      assert.equal(await page.locator(':focus').getAttribute('class'), 'skip');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator(':focus').getAttribute('id'), 'question');
      await page.locator('[data-feature="SMQ020"]').focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      assert.equal(await page.locator(':focus').getAttribute('data-feature'), 'ALQ111');
      await page.keyboard.press('Space');
      assert.equal(await page.locator('[data-feature="ALQ111"]').getAttribute('aria-pressed'), 'true');
      await page.locator('[data-case="sips"]').focus();
      await page.keyboard.press('Space');
      assert.match(await page.locator('#code').textContent(), /코드 2/);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.locator(':focus').getAttribute('data-case'), 'past-drink');
      for (const feature of fixtures) {
        await page.locator(`[data-feature="${feature.id}"]`).click();
        for (const example of feature.cases) {
          await page.locator(`[data-case="${example.id}"]`).click();
          assert.equal(await page.locator('#code').textContent(), example.result);
          assert.equal(await page.locator('#case-detail').textContent(), example.detail);
          assert.equal(await page.locator('#cases [aria-pressed="true"]').count(), 1);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${feature.id}/${example.id}: overflow`);
          if (/미지원|미확정/.test(example.result)) assert(!/코드\s*-?\d|결측/.test(example.result));
          visited++;
        }
        for (const link of await page.locator('#sources a').all()) {
          assert.equal(new URL(await link.getAttribute('href')).hostname, 'wwwn.cdc.gov');
          assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
          await link.focus();
          await page.keyboard.press('Tab');
          await page.keyboard.press('Shift+Tab');
          assert(await link.evaluate((el) => el === document.activeElement && getComputedStyle(el).outlineStyle !== 'none'));
        }
      }
      // Independent semantic counterexamples: don't accept blanket yes/no or missing mappings.
      const result = (id, example) => fixtures.find((f) => f.id === id).cases.find((c) => c.id === example).result;
      assert.match(result('SMQ020', 'former'), /코드 1/);
      assert.match(result('SMQ020', 'current-under100'), /코드 2/);
      assert.match(result('ALQ111', 'past-drink'), /코드 1/);
      assert.equal(result('PAQ605', 'exercise-only'), '미지원');
      assert.match(result('PAQ605', 'unknown'), /코드 9/);
      assert.match(result('PAQ605', 'refused'), /코드 7/);
      assert.match(result('PAQ605', 'missing'), /\. \(결측\)/);
      for (const id of ['tie-low', 'tie-high', 'midnight', 'shift']) assert.equal(result('SLD012', id), '변환 미확정');
      assert.match(result('SLD012', 'low-bin'), /3시간 미만/);
      assert.match(result('RIDAGEYR', 'age80plus'), /80세 이상/);
      assert.equal(result('BMXBMI', 'unknown-origin'), '미지원');
      await page.locator('[data-feature="SLD012"]').click();
      await page.locator('[data-case="tie-low"]').click();
      await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); });
      await page.screenshot({ path: path.join(output, `review-${viewport.width}.png`), fullPage: true });
      if (viewport.width === 1366) await page.screenshot({ path: path.join(output, 'review-1366-viewport.png') });
      assert.deepEqual(errors, []);
      assert.deepEqual(network, []);
      assert.deepEqual(await page.evaluate(() => window.reviewViolations), []);
      assert.deepEqual(await context.cookies(), []);
      await context.close();
    }
    console.log(`PASS: ${visited} synthetic case/viewport checks; keyboard, layout, no network/storage, production isolation`);
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
