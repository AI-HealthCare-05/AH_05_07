import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { installCompanionFramingProbe } from './companion-framing-probe.mjs';
const output = process.argv[2];
if (!output) throw new Error('Pass a new candidate capture directory');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  if (process.argv.includes('--saved-only')) {
    // Refresh only the changed S05 companion evidence. Keep failed media, other
    // screens and the normal login capture on their original source/build identity.
    const measurements = [];
    for (const [width, height] of [[390, 844], [320, 568], [1366, 768]]) {
      for (const phase of ['neutral', 'celebrate', 'idle']) {
        const page = await browser.newPage({ viewport: { width, height }, reducedMotion: phase === 'neutral' ? 'reduce' : 'no-preference' });
        await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
        await page.addInitScript(installCompanionFramingProbe);
        await page.goto('http://127.0.0.1:4181/?e2e=signed-in&screen=S04');
        // The registered clips are four seconds; their maximum ear height occurs
        // at one second. Pause the test RAF there for a reproducible app capture.
        if (phase !== 'neutral') await page.evaluate(phase => window.__companionFramingProbe.pauseAfter(phase, phase === 'celebrate' ? 59 : 60), phase);
        await page.getByLabel(/수축기/).fill('120'); await page.getByLabel(/이완기/).fill('80');
        await page.getByRole('button', { name: '혈압 기록 저장', exact: true }).click();
        await page.locator('[data-companion-status="ready"]').waitFor({ timeout: 30000 });
        if (phase !== 'neutral') await page.waitForFunction(() => window.__companionFramingProbe.report().paused, undefined, { timeout: 20000 });
        const name = `synthetic-S05-companion${phase === 'idle' ? '' : `-${phase}`}-${width}.png`;
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `${output}/${name}`, fullPage: true });
        measurements.push({ name, viewport: { width, height }, phase, bounds: await page.evaluate(() => window.__companionFramingProbe.sample()) });
        if (width === 320 && phase === 'neutral') {
          await page.locator('#S05-title').focus();
          await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
          const name = 'synthetic-S05-actions-scrolled-320.png';
          await page.screenshot({ path: `${output}/${name}` });
          measurements.push({ name, viewport: { width, height }, phase: 'neutral; keyboard focus on continue', scrollY: await page.evaluate(() => window.scrollY) });
        }
        await page.close();
      }
    }
    console.log(JSON.stringify(measurements, null, 2));
  } else {
  for (const [width, height] of [[390, 844], [320, 568], [1366, 768]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
    const capture = async name => {
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
  }
} finally { await browser.close(); }
