import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const output = process.argv[2];
if (!output) throw new Error('Pass a before/after output directory');
const baseURL = process.env.RECAP_URL ?? 'http://127.0.0.1:4178';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const measurements = [];
try {
  for (const [width, height] of [[320, 568], [390, 844], [1366, 768]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
    const capture = async state => {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${output}/S10-${state}-${width}x${height}-viewport.png` });
      await page.screenshot({ path: `${output}/S10-${state}-${width}x${height}.png`, fullPage: true });
    };
    await page.goto(`${baseURL}/?e2e=signed-in&screen=S10&recap_fixture=mixed`);
    await expect(page.locator('[data-record-lane="blood-pressure"] .record-action')).toHaveCount(2);
    await page.locator('.living-scene-fallback img').evaluate(img => img.decode());
    await capture('current');
    measurements.push({ viewport: `${width}x${height}`, stage: await page.locator('[data-living-scene="S10"]').boundingBox(), horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
    if (width === 390) {
      await page.getByRole('button', { name: '이전 7일 보기', exact: true }).click();
      await expect(page.locator('[data-dashboard-window]')).toHaveAttribute('data-dashboard-window', 'prior');
      await page.locator('.living-scene-fallback img').evaluate(img => img.decode());
      await capture('prior');
      await page.goto(`${baseURL}/?e2e=signed-in&screen=S10&recap_fixture=refresh-error`);
      await page.getByRole('button', { name: '새로고침', exact: true }).click();
      await expect(page.getByText('최신 여부를 확인하지 못했어요', { exact: true })).toBeVisible();
      await page.locator('.living-scene-fallback img').evaluate(img => img.decode());
      await capture('stale');
    }
    await page.close();
    console.log(`S10 ${width}x${height} captured (local synthetic, Seoul 2026-09-11, reduced motion)`);
  }
  await writeFile(`${output}/capture.json`, JSON.stringify({ synthetic: true, fixedTime: '2026-09-11T03:00:00Z', motion: 'reduce', measurements }, null, 2) + '\n');
} finally { await browser.close(); }
