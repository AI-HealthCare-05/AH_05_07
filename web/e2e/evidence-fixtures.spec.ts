import { expect, test } from "@playwright/test";

test("empty fixture opens the dedicated empty state without inventing facts", async ({ page }) => {
  await page.goto("/?fixture=VP-04");
  await expect(page.locator('[data-scene="S12"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "아직 기록이 없어도 괜찮아요" })).toBeVisible();
  await expect(page.getByRole("button", { name: "혈압 기록하기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "7일 챌린지 시작하기" })).toBeVisible();
});

test("record dashboard fixture masks measurements and does not invent a model result", async ({ page }) => {
  await page.goto("/?fixture=VP-10&screen=S10");
  await expect(page.getByText("•••/•• mmHg").first()).toBeVisible();
  await expect(page.locator('[data-scene="S10"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "선택한 7일을 돌아봐요" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "혈압 관찰" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "챌린지 참여" })).toBeVisible();
  await page.getByRole("button", { name: "입력 기반 위험군 선별 신호" }).click();
  await expect(page.getByText("현재는 점수, 확률, 등급을 표시하지 않습니다.")).toBeVisible();
});

test("load failure fixture offers retry without rendering a dashboard as empty", async ({ page }) => {
  await page.goto("/?fixture=VP-11a");
  await expect(page.locator('[data-scene="S13"]')).toContainText("아직 기록이 없다는 뜻은 아니에요.");
  await expect(page.getByRole("button", { name: "다시 불러오기" })).toBeVisible();
  await expect(page.locator('[data-scene="S12"]')).toHaveCount(0);
});
