import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { journeyReviewFixture } from './journey-review-fixture.mjs';
const output = process.argv[2];
if (!output) throw new Error('Pass a before/after output directory');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [width, height] of [[320, 568], [390, 844], [1366, 768]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
    await page.addInitScript(journeyReviewFixture);
    // Only public, already registered media; fixture transport stays local.
    await page.route('**/review-media/**', async route => {
      const pathname = new URL(route.request().url()).pathname.replace('/review-media', '');
      const response = await route.fetch({ url: `https://sk7-companion.gkrry.com${pathname}` });
      await route.fulfill({ response });
    });
    await page.goto(process.env.JOURNEY_URL ?? 'http://127.0.0.1:4176/?e2e=signed-in&screen=S02');
    await page.locator('[data-scene="S02"]').waitFor();
    await page.locator('.living-scene-fallback img').evaluate(img => img.decode());
    const capture = async screen => {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${output}/${screen}-${width}x${height}.png`, fullPage: true });
      await page.screenshot({ path: `${output}/${screen}-${width}x${height}-viewport.png` });
    };
    await capture('S02');
    await page.getByRole('button', { name: '혈압 기록하기', exact: true }).click();
    await page.getByLabel(/수축기/).fill('120');
    await page.getByLabel(/이완기/).fill('80');
    await page.locator('#S04-title').focus();
    await capture('S04');
    await page.getByRole('button', { name: '혈압 기록 저장', exact: true }).click();
    await page.locator('[data-saved-scene-status="ready"]').waitFor({ timeout: 25000 });
    await capture('S05');
    await page.getByRole('button', { name: '오늘의 기록 보기', exact: true }).click();
    await page.locator('[data-scene="S02"]').waitFor();
    await page.close();
    console.log(`${width}x${height}: S02 → S04 → confirmed mock S05 → S02 captured`);
  }
} finally { await browser.close(); }
