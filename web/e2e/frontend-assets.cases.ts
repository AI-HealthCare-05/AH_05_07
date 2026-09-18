import { expect, test, type Page } from '@playwright/test';

const companionOff = process.env.SK7_UI_TEST_COMPANION === 'off';
const headers = {
  'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
  'Access-Control-Allow-Headers': 'authorization,content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

async function syntheticWindow(page: Page) {
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  let writes = 0;
  await page.route('http://e2e.invalid/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (request.method() !== 'GET') {
      writes += 1;
      return route.abort();
    }
    if (url.pathname.endsWith('/window')) {
      return route.fulfill({
        status: 200, headers, contentType: 'application/json',
        body: JSON.stringify({
          start_on: url.searchParams.get('start_on'), end_on: url.searchParams.get('end_on'),
          blood_pressure_observations: [], challenge_checkins: [], active_challenge: null,
          challenge_events: [{ id: 'frontend-assets-synthetic-legacy', observed_on: '2026-09-05', action_id: 'walk-10-minutes', status: 'completed' }],
        }),
      });
    }
    return route.abort();
  });
  return { writes: () => writes };
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const [width, height] of [[1366, 768], [1440, 900], [390, 844], [320, 568]]) {
  test(`S01 native CTA and preference ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await syntheticWindow(page);
    await page.addInitScript(() => localStorage.setItem('sk7-companion-species', 'rabbit'));
    await page.goto('/?companion_species=cat');
    const cta = page.locator('.journey-demo-entry-button');
    await expect(cta).toBeVisible();
    await cta.focus();
    expect(await cta.evaluate(el => el.tagName)).toBe('BUTTON');
    const bounds = await cta.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    if (!companionOff) {
      const picker = page.locator('#login-companion-species');
      await expect(picker).toHaveValue('rabbit');
      expect(await picker.evaluate(el => el.tagName)).toBe('SELECT');
      await picker.selectOption('cat');
      await expect(page.locator('[data-login-companion]')).toHaveAttribute('data-login-companion-species', 'cat');
      expect(await page.evaluate(() => localStorage.getItem('sk7-companion-species'))).toBe('cat');
      await expect(page.locator('.login-companion-bubble [data-ui-icon="companion"]')).toHaveAttribute('aria-hidden', 'true');
    }
    await noHorizontalOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`S01-${width}.png`), fullPage: true });
  });

  test(`S02 glyphs preserve primary action and no writes ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const state = await syntheticWindow(page);
    await page.goto('/?e2e=signed-in&screen=S02');
    const home = page.locator('.journey-today');
    await expect(home).toBeVisible();
    const navButtons = page.locator('.primary-nav button');
    const glyphs = page.locator('.primary-nav svg[data-nav-icon]');
    await expect(glyphs).toHaveCount(await navButtons.count());
    expect(await glyphs.evaluateAll(elements => elements.every(el => {
      const css = getComputedStyle(el);
      return css.transform === 'none' && css.borderTopWidth === '0px' && el.getAttribute('aria-hidden') === 'true';
    }))).toBe(true);
    await expect(home.locator('.today-record-icon--observation [data-ui-icon="observation"]')).toHaveCount(1);
    await expect(home.locator('.today-record-icon--participation [data-ui-icon="participation"]')).toHaveCount(1);
    await expect(home.locator('canvas')).toHaveCount(0);
    await noHorizontalOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`S02-${width}.png`), fullPage: true });
    await home.locator('.home-lead button').press('Enter');
    await expect(page.locator('#S04-title')).toBeFocused();
    expect(state.writes()).toBe(0);
  });

  test(`S08 empty-filter art preserves reset and focus ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await syntheticWindow(page);
    await page.goto('/?e2e=signed-in&screen=S08');
    const explorer = page.locator('.record-explorer');
    await expect(explorer).toBeVisible();
    const bp = explorer.locator('.record-explorer-buttons button').filter({ hasText: '혈압' }).first();
    await bp.click();
    await expect(bp).toHaveAttribute('aria-pressed', 'true');
    expect(await bp.locator('.record-filter-check').evaluate(el => getComputedStyle(el).visibility)).toBe('visible');
    await expect(explorer.locator('.record-explorer-empty [data-ui-object="notebook"]')).toHaveCount(1);
    await expect(explorer.getByRole('heading', { name: '선택한 조건에 맞는 기록이 없어요.' })).toBeVisible();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`S08-${width}.png`), fullPage: true });
    await explorer.getByRole('button', { name: '전체 기록 보기', exact: true }).press('Enter');
    await expect(explorer.locator('.record-explorer-filter').first().getByRole('button').first()).toBeFocused();
  });

  test(`S10 facts and decorative book remain separate ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await syntheticWindow(page);
    await page.goto('/?e2e=signed-in&screen=S10');
    await expect(page.locator('.recap-week-summary [data-ui-icon="observation"]')).toHaveCount(1);
    await expect(page.locator('.recap-week-summary [data-ui-icon="participation"]')).toHaveCount(1);
    await expect(page.locator('[data-week-fact="observation-count"]')).toContainText('0');
    const art = page.locator('.recap-tools-object');
    await expect(art).toHaveAttribute('aria-hidden', 'true');
    if (width <= 580) await expect(art).toBeHidden();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`S10-${width}.png`), fullPage: true });
    await page.locator('.recap-records-jump').press('Enter');
    await expect(page.locator('#recap-journal-records')).toBeFocused();
  });
}

test('blocked UI derivatives do not change text, actions, facts or introduce a canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const state = await syntheticWindow(page);
  await page.route('**/assets/ui/v1/**', route => route.abort());
  await page.goto('/?e2e=signed-in&screen=S10');
  const art = page.locator('.recap-tools-object');
  await art.scrollIntoViewIfNeeded();
  await expect(art.locator('img')).toBeHidden();
  await expect(page.getByRole('heading', { name: '이 7일의 기록을 한눈에 정리해요' })).toBeVisible();
  await expect(page.locator('.recap-records-jump')).toBeEnabled();
  await expect(page.locator('[data-week-fact="observation-count"]')).toContainText('0');
  expect(state.writes()).toBe(0);
});

test('forced colors retain keyboard outline and suppress optional raster art', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await syntheticWindow(page);
  await page.goto('/?e2e=signed-in&screen=S02');
  const button = page.locator('.home-lead button');
  await page.keyboard.press('Tab');
  await button.focus();
  expect(await button.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await expect(button).toBeEnabled();
  await noHorizontalOverflow(page);
});
