import { expect, test } from "@playwright/test";

test("empty signed-in fixture states that no observations exist", async ({ page }) => {
  await page.goto("/?fixture=VP-04");
  await expect(page.getByText("아직 혈압 관찰 기록이 없습니다.")).toBeVisible();
  await expect(page.getByText("아직 챌린지 참여 기록이 없습니다.")).toBeVisible();
});

test("record fixture masks measurement values in evidence mode", async ({ page }) => {
  await page.goto("/?fixture=VP-10");
  await expect(page.getByText("•••/•• mmHg").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "사실로 다시 보기" })).toBeVisible();
});

test("load failure fixture offers retry without claiming an empty record set", async ({ page }) => {
  await page.goto("/?fixture=VP-11a");
  await expect(page.getByRole("alert")).toContainText("아직 기록이 없다는 뜻은 아니에요.");
  await expect(page.getByRole("button", { name: "다시 불러오기" })).toBeVisible();
});
