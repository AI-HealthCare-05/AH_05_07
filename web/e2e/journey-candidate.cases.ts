import { expect, test, type Page } from '@playwright/test';

const companionOff = process.env.SK7_UI_TEST_COMPANION === 'off';

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
    if (width <= 580) {
      expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(navBox.y);
      const trailTouchBoxes = await page.locator('.home-trail-dates > li > button').evaluateAll(buttons => buttons.map(button => {
        const box = button.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }));
      expect(trailTouchBoxes.every(box => box.width >= 44 && box.height >= 44)).toBe(true);
    }
    if (width === 320 && height === 568) {
      const legendBox = await page.locator('.home-trail-legend').boundingBox();
      expect(legendBox).not.toBeNull();
      expect(legendBox!.y + legendBox!.height).toBeLessThanOrEqual(navBox.y);
      await expect(page.locator('.journey-view-frame')).toBeHidden();
      await expect(page.locator('.journey-view-caption')).toBeHidden();
    }
    const recipe = await page.locator('[data-scene-recipe]').getAttribute('data-scene-recipe');
    await primary.click();
    await expect(page.locator('#S04-title')).toBeFocused();
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
    const sheet = page.locator('[data-scene="S04"].journey-sheet');
    const contextRegion = sheet.locator('.bp-sheet-context');
    const pairRegion = sheet.locator('.bp-measurement-pair');
    await expect(sheet).toBeVisible();
    await expect(contextRegion).toBeVisible();
    await expect(pairRegion).toBeVisible();
    const periodField = page.locator('#period');
    const pairBox = await pairRegion.boundingBox();
    expect(pairBox).not.toBeNull();
    const periodBox = await periodField.boundingBox();
    expect(periodBox).not.toBeNull();
    expect(periodBox!.y).toBeLessThan(pairBox!.y);
    expect(dateBox!.y).toBeLessThan(pairBox!.y);
    if (width <= 350) expect(pairBox!.y + pairBox!.height).toBeLessThanOrEqual(navBox!.y);
    const separator = page.locator('.bp-measurement-separator');
    await expect(separator).toBeVisible();
    await expect(separator).toHaveAttribute('aria-hidden', 'true');
    const saveButton = page.getByRole('button', { name: '혈압 기록 저장', exact: true });
    await expect(saveButton).toBeVisible();
    if (width <= 580) await saveButton.scrollIntoViewIfNeeded();
    const saveBox = await saveButton.boundingBox();
    expect(saveBox).not.toBeNull();
    expect(saveBox!.y).toBeGreaterThanOrEqual(0);
    expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(width <= 580 ? navBox!.y : height);
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
    await expect(nextStep).toContainText(/오늘 화면에서.*확인할 수 있어요/);
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
    await expect(page.locator('.recap-tools-intro')).toContainText(/리포트.*내보내기/);
    await page.goBack();
    await expect(page.locator('#S02-title')).toBeFocused();
    await expect(page.locator('.home-lead')).toHaveAttribute('data-home-concept', 'today-detail');
    await page.locator('.home-lead button').click();
    await expect(page.locator('#S07-title')).toBeFocused();
    const todayReview = page.locator('.journey-today-review');
    const todayDetail = todayReview.locator('[data-record-priority="blood-pressure"]');
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
    const destinationButtons = page.locator('.home-links button[data-home-destination]');
    const destinations = await destinationButtons.evaluateAll(buttons =>
      buttons.map(button => button.getAttribute('data-home-destination')),
    );
    expect(destinations.every((destination): destination is string => Boolean(destination))).toBe(true);
    for (let i = 0; i < destinations.length; i++) {
      await destinationButtons.nth(i).click();
      await expect(page.locator(`[data-scene="${destinations[i]}"]`)).toBeVisible();
      await page.goBack();
      await expect(page.locator('.journey-today')).toBeVisible();
    }
  });
}

test('journey day selection exposes separate facts locally and returns to today', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const boundaryRequests: string[] = [];
  page.on('request', request => {
    if (/e2e\.invalid|ThreeSceneRenderer|CompanionReviewRenderer|\.glb(?:\?|$)/.test(request.url())) boundaryRequests.push(request.url());
  });
  await candidate(page, true);
  const calendarToggle = page.getByRole('button', { name: /날짜별 기록 자세히/ });
  const trail = page.locator('.home-trail-dates');
  const today = trail.locator('[data-trail-date="2026-09-11"] > button');
  const earlier = trail.locator('[data-trail-date="2026-09-05"] > button');
  const detail = page.locator('#today-trail-detail');
  await expect(trail).toBeVisible();
  await expect(trail.locator('li[data-trail-date] > button')).toHaveCount(7);
  await expect(today).toHaveAttribute('aria-pressed', 'true');
  await expect(today).toHaveAttribute('aria-current', 'date');
  await expect(detail).toHaveAttribute('data-selected-date', '2026-09-11');
  // A. Before selecting another date on mobile.
  await expect(calendarToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(trail).toBeVisible();
  await expect(detail).not.toBeVisible();
  const stage = await page.locator('[data-scene-recipe]').elementHandle();
  const requestsBeforeSelection = [...boundaryRequests];
  await earlier.press('Space');
  await expect(earlier).toBeFocused();
  await expect(earlier).toHaveAttribute('aria-pressed', 'true');
  await expect(today).toHaveAttribute('aria-pressed', 'false');
  await expect(today).toHaveAttribute('aria-current', 'date');
  // B. After selecting the earlier date.
  await expect(calendarToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute('data-selected-date', '2026-09-05');
  await expect(detail).toContainText('정자');
  await expect(detail.locator('dl')).toHaveText('혈압 관찰0건챌린지 참여기록 없음');
  await expect(page.locator('.journey-facts')).toHaveText('혈압 관찰1건챌린지 참여기록 없음');
  await expect(trail.locator('[data-trail-date="2026-09-11"] .trail-facts')).toHaveText('혈압 관찰1건챌린지 참여기록 없음');
  await expect(page.locator('[data-scene-date]')).toHaveAttribute('data-scene-date', '2026-09-05');
  expect(await stage!.evaluate(node => node.isConnected)).toBe(true);
  await calendarToggle.click();
  await expect(calendarToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(trail).toBeVisible();
  await expect(detail).not.toBeVisible();
  await calendarToggle.click();
  await expect(calendarToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute('data-selected-date', '2026-09-05');
  await expect(detail.locator('dl')).toHaveText('혈압 관찰0건챌린지 참여기록 없음');
  await page.getByRole('button', { name: '오늘로 돌아오기', exact: true }).press('Enter');
  // C. After "오늘로 돌아오기".
  await expect(today).toHaveAttribute('aria-pressed', 'true');
  await expect(today).toHaveAttribute('aria-current', 'date');
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute('data-selected-date', '2026-09-11');
  await expect(trail.locator('button[aria-pressed="true"]')).toHaveCount(1);
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
  const legendFontPx = await page.locator('.home-trail-legend').evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  expect(legendFontPx).toBeGreaterThanOrEqual(16);
  await page.locator('.home-lead button').click();
  await page.getByLabel(/수축기/).fill('120');
  await page.getByLabel(/이완기/).fill('80');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('button', { name: '혈압 기록 저장', exact: true }).press('Enter');
  await expect(page.locator('#S05-title')).toBeFocused();
  await expect(page.locator('[data-companion-status], [data-saved-scene-status], canvas')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('.journey-today')).toBeVisible();
});

test('core record loop reaches detail and seven-day review after one confirmed save', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const posts = await candidate(page);

  await page.locator('.home-lead button').click();
  await expect(page.locator('[data-scene="S04"]')).toBeVisible();
  await expect(page.locator('[data-scene="S04"]').getByRole('button', { name: /오늘 화면으로 돌아가기/ })).toBeVisible();
  await page.getByLabel(/수축기/).fill('120');
  await page.getByLabel(/이완기/).fill('80');
  await page.getByRole('button', { name: '혈압 기록 저장', exact: true }).click();

  await expect(page.locator('[data-scene="S05"]')).toBeVisible();
  await page.locator('[data-scene="S05"]').getByRole('button', { name: '오늘의 기록 보기', exact: true }).click();
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await expect(page.locator('[data-trail-date="2026-09-11"] .trail-facts')).toContainText('혈압 관찰1건');

  await page.getByRole('button', { name: '기록 찾아보기', exact: true }).first().click();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();

  const pressureRecord = page.locator('[data-record-kind="blood-pressure"]').first();
  await expect(pressureRecord).toBeVisible();
  await pressureRecord.getByRole('button', { name: '상세 보기' }).click();

  await expect(page.locator('[data-scene="S09"]')).toBeVisible();
  await expect(page.locator('[data-record-detail-kind="blood-pressure"]')).toContainText('120/80 mmHg');

  await page.locator('[data-scene="S09"]').getByRole('button', { name: '목록으로 돌아가기', exact: true }).click();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();

  await page.locator('[data-scene="S08"]').getByRole('button', { name: '최근 7일 돌아보기', exact: true }).click();
  await expect(page.locator('[data-scene="S10"]')).toBeVisible();
  await expect(page.locator('[data-week-fact="observation-count"]')).toHaveText('1건');
  await expect(page.locator('[data-week-summary]')).toContainText('기록이 있는 날 1일');

  await page.locator('[data-scene="S10"]').getByRole('button', { name: '오늘 화면으로 돌아가기', exact: true }).click();
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();

  expect(posts()).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('review companion identity preference persists without health semantics', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await candidate(page);

  await page.goto('/?e2e=signed-in&screen=S14');
  const select = page.getByLabel('캐릭터 선택');

  if (companionOff) {
    await expect(select).toHaveCount(0);
    await expect(page.locator('.companion-identity-settings')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    return;
  }

  await expect(select).toBeVisible();
  await expect(select.locator('option')).toHaveCount(11);
  await expect(select).toHaveValue('bear');
  await expect(page.locator('.companion-identity-settings')).toContainText(/기록·분석.*영향이 없어요/);

  await select.selectOption('rabbit');
  await expect(select).toHaveValue('rabbit');
  expect(await page.evaluate(() => localStorage.getItem('sk7-companion-species'))).toBe('rabbit');

  await page.reload();
  await expect(page.getByLabel('캐릭터 선택')).toHaveValue('rabbit');

  await page.evaluate(() => localStorage.setItem('sk7-companion-species', 'not-a-species'));
  await page.reload();
  await expect(page.getByLabel('캐릭터 선택')).toHaveValue('bear');

  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
