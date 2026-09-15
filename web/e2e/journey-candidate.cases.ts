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
    await expect(page.locator('[data-scene="S04"] .scene-body')).toContainText('날짜와 시간대를 확인한 뒤 수축기·이완기 값을 입력');
    const dateField = page.locator('#observed-on');
    const systolicField = page.locator('#systolic');
    const diastolicField = page.locator('#diastolic');
    await expect(dateField).toBeVisible();
    await expect(systolicField).toBeVisible();
    await expect(diastolicField).toBeVisible();
    const dateBox = await dateField.boundingBox();
    const systolicBox = await systolicField.boundingBox();
    const diastolicBox = await diastolicField.boundingBox();
    expect(dateBox).not.toBeNull();
    expect(systolicBox).not.toBeNull();
    expect(diastolicBox).not.toBeNull();
    expect(systolicBox!.y).toBeGreaterThan(dateBox!.y);
    expect(Math.abs(systolicBox!.y - diastolicBox!.y)).toBeLessThan(4);
    const input = await systolicField.elementHandle();
    await page.getByLabel(/수축기/).pressSequentially('120');
    await expect(page.getByLabel(/수축기/)).toBeFocused();
    await page.getByLabel(/이완기/).fill('80');
    expect(await input!.evaluate(node => node === document.querySelector('#systolic'))).toBe(true);
    await page.getByRole('button', { name: '혈압 기록 저장', exact: true }).click();
    await expect(page.locator('#S05-title')).toBeFocused();
    await expect(page.locator('.journey-saved')).toBeVisible();
    const nextStep = page.locator('.save-next-step');
    const savedActions = page.locator('.journey-saved .split-actions');
    await expect(nextStep).toContainText('오늘의 기록에서 방금 저장한 혈압을 확인해요');
    await expect(nextStep).toContainText('기록이 반영됐는지 확인');
    await expect(nextStep).toContainText('한 건부터 최근 7일에 모아볼 수 있어요');
    await expect(savedActions.getByRole('button')).toHaveCount(2);
    const nextStepBox = await nextStep.boundingBox();
    const actionsBox = await savedActions.boundingBox();
    expect(nextStepBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    expect(nextStepBox!.y).toBeLessThan(actionsBox!.y);
    expect(posts()).toBe(1);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: '오늘의 기록 보기', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.journey-today')).toBeVisible();
    await expect(page.locator('[data-trail-date]')).toHaveCount(7);
    await expect(page.locator('[data-trail-date="2026-09-11"] .trail-facts')).toHaveText('혈압 관찰1건챌린지 참여기록 없음');
    await page.getByRole('link', { name: '7일 돌아보기' }).press('Enter');
    await expect(page.locator('#S10-title')).toBeFocused();
    await expect(page.locator('[data-week-fact="observation-count"]')).toHaveText('1건');
    await expect(page.locator('[data-week-summary]')).toContainText('기록이 있는 날 1일');
    await expect(page.locator('.recap-tools-intro')).toContainText('기록이 한 건만 있어도');
    await page.goBack();
    await expect(page.locator('#S02-title')).toBeFocused();
    await expect(page.locator('.home-lead')).toHaveAttribute('data-home-concept', 'today-detail');
    await page.locator('.home-lead button').click();
    await expect(page.locator('#S07-title')).toBeFocused();
    const todayReview = page.locator('.journey-today-review');
    const todayDetail = todayReview.locator('[data-record-priority="blood-pressure"]');
    await expect(todayReview).toContainText('오늘 남긴 혈압 기록을 먼저 확인');
    await expect(todayDetail).toBeVisible();
    await expect(todayDetail.locator('.fact-lanes > section')).toHaveCount(3);
    await expect(todayDetail.locator('.fact-lanes > .fact-lead')).toContainText('혈압 관찰');
    await expect(todayDetail.locator('.fact-lanes > .fact-lead')).toContainText('120/80 mmHg');
    const leadBox = await todayDetail.locator('.fact-lanes > .fact-lead').boundingBox();
    const secondaryBox = await todayDetail.locator('.fact-lanes > section').nth(1).boundingBox();
    expect(leadBox).not.toBeNull();
    expect(secondaryBox).not.toBeNull();
    if (width > 820) expect(leadBox!.width).toBeGreaterThan(secondaryBox!.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.goBack();
    await expect(page.locator('#S02-title')).toBeFocused();
    // A changed domain fact changes the CTA, never the scenery recipe.
    await expect(page.locator('[data-scene-recipe]')).toHaveAttribute('data-scene-recipe', recipe!);
    await expect(page.locator('[data-saved-scene-status]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

for (const [bp, challenge, lead, state] of [
  [false, false, 'blood-pressure', 'no-bp-no-challenge'],
  [true, false, 'today-detail', 'bp-no-challenge'],
  [true, true, 'today-detail', 'bp-with-challenge'],
] as const) {
  test(`journey candidate preserves separate destinations: ${state} → ${lead}`, async ({ page }) => {
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

test('journey day selection exposes separate facts locally and returns to today', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const boundaryRequests: string[] = [];
  page.on('request', request => {
    if (/e2e\.invalid|ThreeSceneRenderer|CompanionReviewRenderer|\.glb(?:\?|$)/.test(request.url())) boundaryRequests.push(request.url());
  });
  await candidate(page, true);
  const calendarToggle = page.getByRole('button', { name: '날짜별 기록 보기', exact: true });
  if (await calendarToggle.isVisible()) await calendarToggle.click();
  const trail = page.locator('.home-trail-dates');
  const today = trail.locator('[data-trail-date="2026-09-11"] > button');
  const earlier = trail.locator('[data-trail-date="2026-09-05"] > button');
  const detail = page.locator('#today-trail-detail');
  await expect(trail.locator('li[data-trail-date] > button')).toHaveCount(7);
  await expect(today).toHaveAttribute('aria-pressed', 'true');
  await expect(today).toHaveAttribute('aria-current', 'date');
  await expect(detail).toHaveAttribute('data-selected-date', '2026-09-11');
  const stage = await page.locator('[data-scene-recipe]').elementHandle();
  const requestsBeforeSelection = [...boundaryRequests];
  await earlier.press('Space');
  await expect(earlier).toBeFocused();
  await expect(earlier).toHaveAttribute('aria-pressed', 'true');
  await expect(today).toHaveAttribute('aria-pressed', 'false');
  await expect(today).toHaveAttribute('aria-current', 'date');
  await expect(detail).toHaveAttribute('data-selected-date', '2026-09-05');
  await expect(detail).toContainText('정자');
  await expect(detail.locator('dl')).toHaveText('혈압 관찰0건챌린지 참여기록 없음');
  await expect(page.locator('.journey-facts')).toHaveText('혈압 관찰1건챌린지 참여기록 없음');
  await expect(trail.locator('[data-trail-date="2026-09-11"] .trail-facts')).toHaveText('혈압 관찰1건챌린지 참여기록 없음');
  await expect(page.locator('[data-scene-date]')).toHaveAttribute('data-scene-date', '2026-09-11');
  expect(await stage!.evaluate(node => node.isConnected)).toBe(true);
  await page.getByRole('button', { name: '오늘로 돌아오기', exact: true }).press('Enter');
  await expect(today).toHaveAttribute('aria-pressed', 'true');
  await expect(trail.locator('button[aria-pressed="true"]')).toHaveCount(1);
  await expect(detail).toHaveAttribute('data-selected-date', '2026-09-11');
  await expect(detail.locator('dl')).toHaveText('혈압 관찰1건챌린지 참여기록 없음');
  await expect(page.locator('[data-companion-status], [data-saved-scene-status], canvas')).toHaveCount(0);
  expect(boundaryRequests).toEqual(requestsBeforeSelection);
});

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
