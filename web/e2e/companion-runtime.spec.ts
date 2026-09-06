import { expect, test } from "@playwright/test";

import {
  companionClips,
  companionExcludedScreens,
  companionReviewScreens,
  companionSpecies,
  getCompanionDecision,
  getCompanionScreenDisposition,
  isCompanionReviewCandidate,
  resolveCompanionRuntimeConfig,
} from "../src/ui/companion";

test("companion contract keeps the S2 candidate and clip sets fixed", () => {
  expect(companionSpecies).toHaveLength(11);
  expect(companionSpecies).not.toContain("seal");
  expect(companionClips).toEqual(["idle", "greet", "move", "curious", "celebrate", "rest", "special"]);
  expect(companionReviewScreens).toEqual(["S02", "S03", "S05", "S10"]);
  expect(companionExcludedScreens).toEqual(["S04", "S07", "S08", "S09", "S11", "S12", "S13", "S14"]);
});

test("mode parsing is fail closed and review mode is lazy review-only", () => {
  expect(resolveCompanionRuntimeConfig(undefined)).toEqual({ mode: "off", enabled: false, assetLoading: "disabled", networkPolicy: "none", reducedMotion: false });
  expect(resolveCompanionRuntimeConfig("on").mode).toBe("off");
  expect(resolveCompanionRuntimeConfig("production").mode).toBe("off");
  expect(resolveCompanionRuntimeConfig("review")).toEqual({ mode: "review", enabled: true, assetLoading: "lazy-review", networkPolicy: "single-approved-glb", reducedMotion: false });
  expect(resolveCompanionRuntimeConfig("review", { reducedMotion: true }).reducedMotion).toBe(true);
});

test("screen and animation policy never uses health or model facts", () => {
  expect(getCompanionScreenDisposition("S02")).toBe("review_candidate");
  expect(isCompanionReviewCandidate("S02")).toBe(true);
  expect(getCompanionScreenDisposition("S11")).toBe("excluded");
  expect(isCompanionReviewCandidate("S11")).toBe(false);
  expect(getCompanionScreenDisposition("S13")).toBe("excluded");
  expect(isCompanionReviewCandidate("S13")).toBe(false);
  expect(getCompanionDecision("S02", "idle")).toEqual({ status: "allowed", reason: "general_review_candidate" });
  expect(getCompanionDecision("S05", "celebrate", "save_success")).toEqual({ status: "conditional", reason: "save_success_only" });
  expect(getCompanionDecision("S02", "celebrate", "save_success").status).toBe("blocked");
  expect(getCompanionDecision("S02", "move").status).toBe("blocked");
  expect(getCompanionDecision("S02", "move", "non_semantic")).toEqual({ status: "conditional", reason: "non_semantic_scene_movement_only" });
  expect(getCompanionDecision("S02", "special").status).toBe("blocked");
  expect(getCompanionDecision("S11", "idle").status).toBe("blocked");
});

test("production default does not request companion assets or alter the existing fixture UI", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/?fixture=VP-10");
  await expect(page.getByRole("heading", { name: "오늘의 기록" })).toBeVisible();
  expect(requests.filter((url) => /\.(glb|gltf|bin)(\?|$)/i.test(url))).toEqual([]);
  expect(requests.filter((url) => /companion/i.test(url))).toEqual([]);
  await expect(page.locator("[data-scene=\"S02\"]")).toBeVisible();
});
