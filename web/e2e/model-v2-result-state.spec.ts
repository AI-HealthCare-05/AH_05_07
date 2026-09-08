import { expect, test } from "@playwright/test";

const states = [
  { state: "not_ready", status: "아직 준비 중이에요", heading: "검증된 모델이 준비되기 전에는 결과를 표시하지 않습니다." },
  { state: "input_invalid", status: "입력을 확인해 주세요", heading: "이 입력으로는 신호를 준비할 수 없습니다." },
  { state: "temporarily_unavailable", status: "잠시 사용할 수 없어요", heading: "지금은 신호 결과를 준비할 수 없습니다." },
  { state: "result_available_not_user_visible", status: "결과 표시 검토 중", heading: "기술적으로 결과가 준비되어도 아직 화면에는 표시하지 않습니다." },
] as const;

const prohibited = ["저위험", "중위험", "고위험", "정상", "비정상", "안전", "치료 효과", "예방 성공"];

test("S11 defaults to not_ready and exposes no result value", async ({ page }) => {
  await page.goto("/?fixture=VP-10&screen=S11");
  const scene = page.locator('[data-scene="S11"]');
  const card = scene.locator("[data-model-v2-result-state]");
  await expect(scene).toBeVisible();
  await expect(card).toHaveAttribute("data-model-v2-result-state", "not_ready");
  await expect(card).toContainText("아직 준비 중이에요");
  await expect(card).toContainText("현재는 점수, 확률, 등급을 표시하지 않습니다.");
  const text = await scene.innerText();
  for (const term of prohibited) expect(text).not.toContain(term);
  expect(text).not.toContain("model.joblib");
  expect(text).not.toContain("/secret/");
});

for (const state of states) {
  test(`S11 synthetic-only state: ${state.state}`, async ({ page }) => {
    await page.goto(`/?fixture=VP-10&screen=S11&model_v2_state=${state.state}`);
    const card = page.locator('[data-scene="S11"] [data-model-v2-result-state]');
    await expect(card).toHaveAttribute("data-model-v2-result-state", state.state);
    await expect(card).toContainText(state.status);
    await expect(card).toContainText(state.heading);
    const text = await card.innerText();
    for (const term of prohibited) expect(text).not.toContain(term);
    expect(text).not.toMatch(/\b0\.\d+\b/);
    expect(text).not.toMatch(/\b\d{1,3}%\b/);
  });
}

test("invalid synthetic state falls back to not_ready", async ({ page }) => {
  await page.goto("/?fixture=VP-10&screen=S11&model_v2_state=score_0_73");
  await expect(page.locator('[data-scene="S11"] [data-model-v2-result-state]'))
    .toHaveAttribute("data-model-v2-result-state", "not_ready");
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 390, height: 844 },
  { width: 1366, height: 768 },
]) {
  test(`S11 remains usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/?fixture=VP-10&screen=S11");
    const scene = page.locator('[data-scene="S11"]');
    await expect(scene).toBeVisible();
    const box = await scene.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
    await expect(page.getByRole("button", { name: "입력 기반 위험군 선별 신호" })).toBeVisible();
  });
}
