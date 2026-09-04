import { expect, test } from "@playwright/test";

test("production build ignores a fixture query parameter", async ({ page }) => {
  await page.goto("/?fixture=VP-10");
  await expect(page.getByRole("heading", { name: "7일 기록" })).toHaveCount(0);
  await expect(page.getByText("웹 환경변수를 설정한 뒤 시작할 수 있습니다.")).toBeVisible();
});
