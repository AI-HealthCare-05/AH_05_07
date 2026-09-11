import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const output = process.argv[2];
if (!output) throw new Error('Pass a new candidate capture directory');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [width, height] of [[390, 844], [320, 568], [1366, 768]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
    const capture = async name => {
      if (process.argv.includes("--saved-only") && !name.startsWith("S05")) return;
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${output}/synthetic-${name}-${width}.png`, fullPage: true });
    };
    await page.goto('http://127.0.0.1:4181/?e2e=signed-in&screen=S02');
    await page.locator('[data-static-landscape="S02"] img').evaluate(img => img.decode());
    await capture('S02');
    await page.locator('.home-lead button').click();
    await page.getByLabel(/수축기/).fill('120'); await page.getByLabel(/이완기/).fill('80');
    await page.locator('#S04-title').focus();
    if (width === 390) await capture('S04');
    await page.getByRole('button', { name: '혈압 기록 저장', exact: true }).click();
    await page.locator('[data-companion-status="ready"][data-companion-phase="idle"]').waitFor({ timeout: 30000 });
    await capture('S05-companion');
    if (width !== 320) {
      await page.goto('http://127.0.0.1:4181/?e2e=signed-in&screen=S10&recap_fixture=mixed');
      await page.locator('[data-static-landscape="S10"] img').evaluate(img => img.decode());
      await capture('S10');
    }
    if (width === 390) {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.route('**/review-media/**', route => route.abort());
      await page.goto('http://127.0.0.1:4181/?e2e=signed-in&screen=S04');
      await page.getByLabel(/수축기/).fill('120'); await page.getByLabel(/이완기/).fill('80');
      await page.getByRole('button', { name: '혈압 기록 저장', exact: true }).click();
      await page.locator('[data-companion-status="error"]').waitFor({ timeout: 30000 });
      await capture('S05-failed-media');
    }
    await page.close();
  }
  if (process.argv.includes('--normal')) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto('http://127.0.0.1:4182/?e2e=signed-in&fixture=VP-10&screen=S02');
    await page.getByLabel('이메일', { exact: true }).waitFor();
    await page.screenshot({ path: `${output}/normal-login-390.png`, fullPage: true, animations: "disabled" });
    await page.close();
  }
} finally { await browser.close(); }
