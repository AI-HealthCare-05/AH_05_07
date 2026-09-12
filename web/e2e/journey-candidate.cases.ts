// Imported by saved-scene-review.spec.ts so the existing required CI runs these.
import { expect, test, type Page } from '@playwright/test';

async function candidate(page: Page, hasMeasurement = false, hasChallenge = false) {
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  let posts = 0;
  await page.route('http://e2e.invalid/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4173', 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname.endsWith('/window')) return json({ start_on: '2026-09-05', end_on: '2026-09-11',
      blood_pressure_observations: hasMeasurement || posts ? [{ id: 'synthetic-observation', observed_on: '2026-09-11', period: 'morning', systolic: 120, diastolic: 80 }] : [],
      challenge_events: [{ id: 'synthetic-legacy', observed_on: '2026-09-05', action_id: 'walk-10-minutes', status: 'completed' }],
      active_challenge: hasChallenge ? { id: 'synthetic-challenge', action_id: 'walk-10-minutes', starts_on: '2026-09-11', ends_on: '2026-09-17', first_checkin_on: null, status: 'active' } : null, challenge_checkins: [] });
    if (url.pathname.endsWith('/blood-pressure') && request.method() === 'POST') { posts++; return json({ id: 'synthetic-save', ...request.postDataJSON() }, 201); }
    return route.abort();
  });
  await page.goto('/?e2e=signed-in&screen=S02');
  await expect(page.locator('.journey-today')).toBeVisible();
  return () => posts;
}

for (const [width, height] of [[320, 568], [390, 844], [1366, 768]]) {
  test(`journey candidate primary action, input identity and navigation at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const posts = await candidate(page);
    const primary = page.locator('.home-lead button');
    const buttonBox = (await primary.boundingBox())!;
    const navBox = (await page.locator('.primary-nav').boundingBox())!;
    if (width <= 580) expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(navBox.y);
    const recipe = await page.locator('[data-scene-recipe]').getAttribute('data-scene-recipe');
    await primary.click();
    await expect(page.locator('#S04-title')).toBeFocused();
    const input = await page.locator('#systolic').elementHandle();
    await page.getByLabel(/수축기/).pressSequentially('120');
    await expect(page.getByLabel(/수축기/)).toBeFocused();
    await page.getByLabel(/이완기/).fill('80');
    expect(await input!.evaluate(node => node === document.querySelector('#systolic'))).toBe(true);
    await page.getByRole('button', { name: '혈압 기록 저장', exact: true }).click();
    await expect(page.locator('#S05-title')).toBeFocused();
    await expect(page.locator('.journey-saved')).toBeVisible();
    expect(posts()).toBe(1);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: '오늘의 기록 보기', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.journey-today')).toBeVisible();
    await expect(page.locator('[data-trail-date]')).toHaveCount(7);
    await expect(page.locator('[data-trail-date="2026-09-11"] .trail-facts')).toHaveText('혈압 관찰1건챌린지 참여기록 없음');
    await page.getByRole('link', { name: '7일 돌아보기' }).press('Enter');
    await expect(page.locator('#S10-title')).toBeFocused();
    await page.goBack();
    await expect(page.locator('#S02-title')).toBeFocused();
    // A changed domain fact changes the CTA, never the scenery recipe.
    await expect(page.locator('[data-scene-recipe]')).toHaveAttribute('data-scene-recipe', recipe!);
    await expect(page.locator('[data-saved-scene-status]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

for (const [bp, challenge, lead] of [[false, false, 'blood-pressure'], [true, false, 'challenge'], [true, true, 'today-detail']] as const) {
  test(`journey candidate preserves separate destinations: ${lead}`, async ({ page }) => {
    await candidate(page, bp, challenge);
    await expect(page.locator('.home-lead')).toHaveAttribute('data-home-concept', lead);
    await expect(page.locator('[data-home-concept]')).toHaveCount(3);
    const destinations = await page.locator('.home-links button').evaluateAll(buttons => buttons.map(button => button.getAttribute('data-home-destination')));
    for (let i = 0; i < destinations.length; i++) {
      await page.locator('.home-links button').nth(i).click();
      await expect(page.locator(`[data-scene="${destinations[i]}"]`)).toBeVisible();
      await page.goBack();
      await expect(page.locator('.journey-today')).toBeVisible();
    }
  });
}

test('journey candidate keeps 200% text and absent media usable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/\.(glb|webp)(\?|$)/, route => route.abort());
  await candidate(page);
  await page.locator('html').evaluate(html => { html.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.locator('.home-lead button').click();
  await page.getByLabel(/수축기/).fill('120');
  await page.getByLabel(/이완기/).fill('80');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('button', { name: '혈압 기록 저장', exact: true }).press('Enter');
  await expect(page.locator('#S05-title')).toBeFocused();
  await expect(page.locator('[data-saved-scene-status]')).toHaveAttribute('data-saved-scene-status', 'fallback');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('.journey-today')).toBeVisible();
});
