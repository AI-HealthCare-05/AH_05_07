import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { preview } from 'vite';
const web = fileURLToPath(new URL('../', import.meta.url));
const browser = await chromium.launch();
try {
  for (const [ui, scene, journey, staticPoster] of [
    [undefined, 'off', false, false], [undefined, 'review', true, false],
    ['journey', 'off', true, true], ['journey', 'production', true, true],
    ['journey', 'review', true, false], ['legacy', 'review', false, false], ['invalid', 'review', false, false],
  ]) {
    const outDir = 'test-results/ui-release/matrix';
    const env = { ...process.env, VITE_SK7_SCENE_MODE: scene, VITE_SK7_COMPANION_MODE: 'off',
      VITE_SK7_E2E_MODE: '1', VITE_SK7_EVIDENCE_MODE: '', VITE_SK7_EVIDENCE_FIXTURE: '',
      VITE_API_BASE_URL: 'http://e2e.invalid', VITE_SUPABASE_URL: 'https://e2e.invalid', VITE_SUPABASE_PUBLISHABLE_KEY: 'e2e-test-publishable-key' };
    delete env.VITE_SK7_UI_MODE;
    if (ui !== undefined) env.VITE_SK7_UI_MODE = ui;
    execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build', '--', '--outDir', outDir], { cwd: web, env, stdio: 'pipe' });
    const server = await preview({ root: web, build: { outDir }, preview: { host: '127.0.0.1', port: 4183, strictPort: true } });
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    try {
      await page.addInitScript(() => { localStorage.setItem('VITE_SK7_UI_MODE', 'journey'); localStorage.setItem('scene', 'review'); });
      await page.goto('http://127.0.0.1:4183/?fixture=VP-10&screen=S02&ui=journey&VITE_SK7_UI_MODE=journey&scene=review');
      await page.locator('[data-scene="S02"]').waitFor();
      assert.equal(await page.locator('.journey-today').count(), Number(journey));
      assert.equal(await page.locator('[data-static-landscape]').count(), Number(staticPoster));
      assert.equal(await page.locator('[data-living-scene]').count(), Number(scene === 'review'));
      assert.equal(await page.locator('canvas').count(), 0);
      console.log(`PASS actual build: UI=${ui ?? 'unset'} SCENE=${scene}; URL/storage ignored; companion off; reduced motion`);
    } finally { await page.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
  }
} finally { await browser.close(); }
