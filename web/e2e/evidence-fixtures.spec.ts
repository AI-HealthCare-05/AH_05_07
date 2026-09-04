import { expect, test } from "@playwright/test";

test("empty dashboard fixture keeps the three facts separate", async ({ page }) => {
  await page.goto("/?fixture=VP-04");
  await expect(page.getByRole("heading", { name: "7일 대시보드" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "입력 기반 위험군 선별 신호" })).toBeVisible();
  await expect(page.getByText("준비 중")).toBeVisible();
  await expect(page.getByText("아직 혈압 관찰 기록이 없습니다.")).toBeVisible();
  await expect(page.getByText("아직 챌린지 참여 기록이 없습니다.")).toBeVisible();
});

test("record dashboard fixture masks measurements and does not invent a model result", async ({ page }) => {
  await page.goto("/?fixture=VP-10");
  await expect(page.getByText("•••/•• mmHg").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "7일 대시보드" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "혈압 관찰" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "챌린지 참여" })).toBeVisible();
  await expect(page.getByText("현재는 점수, 확률, 등급을 표시하지 않습니다.")).toBeVisible();
});

test("load failure fixture offers retry without rendering a dashboard as empty", async ({ page }) => {
  await page.goto("/?fixture=VP-11a");
  await expect(page.getByRole("alert")).toContainText("아직 기록이 없다는 뜻은 아니에요.");
  await expect(page.getByRole("button", { name: "다시 불러오기" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "7일 대시보드" })).toHaveCount(0);
});
