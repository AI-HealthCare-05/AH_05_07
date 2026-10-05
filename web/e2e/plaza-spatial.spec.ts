import { expect, test, type Page } from "@playwright/test";
import { emptySnapshot, SOCKETS } from "../src/placeable/contract";
import { STORAGE_KEY } from "../src/placeable/persistence";
import { companionSpecies } from "../src/ui/companion";
import { getMySpaceCompanion } from "../src/ui/mySpaceCompanion";
import { MODEL_FORWARD_YAW_OFFSET } from "../src/placeable/plazaLocomotion";
import { createHash } from "node:crypto";
import { companionIdentityStorageKey } from "../src/ui/companionIdentity";
import {
  PlaceableScene,
  resolveTodayGateProximity,
  TODAY_GATE_APPROACH_RADIUS,
  RECORDS_DESTINATION,
  AI_ANALYSIS_DESTINATION,
  SETTINGS_DESTINATION,
} from "../src/placeable/worldScene";
import { Vector3 } from "three";
import { E1_LIVING_CITY_ENTRY_SCENE_PROFILE } from "../transcend-lab/src/platform/spatial/e1LivingCityEntrySceneProfile";

// Secondary world actions are disclosed through the real semantic control.
async function worldTool(page: Page, name: string, exact?: boolean) {
  const button = page.getByRole("button", { name, exact, includeHidden: true });
  await button.waitFor({ state: "attached" });
  const tools = page.locator(".plaza-help");
  if (await tools.count() && await tools.getAttribute("open") === null) await tools.locator("summary").click();
  return button;
}

const route = "/?experience=e2&view=3d&storage=browser";
type Sample = { x: number; z: number; facing: number; yaw: number; moving: boolean; engaged: boolean;
  actor: { x: number; y: number }; pin: { x: number; y: number }; garden: { x: number; y: number };
  records: { x: number; y: number };
  labels: { id: string; left: number; top: number; visible: boolean }[] };
const sample = (page: Page): Promise<Sample> => page.evaluate(() => (window as any).__plazaSample);

// Test-only observation of the real scene's existing RAF; no runtime debug hook or extra renderer.
async function open(page: Page) {
  await page.goto(route);
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", /idle|neutral/, { timeout: 20000 });
  await page.evaluate(async () => {
    const sceneUrl = performance.getEntriesByType("resource").map(entry => entry.name)
      .filter(url => new URL(url).pathname === "/src/placeable/worldScene.ts").at(-1)!;
    const { PlaceableScene } = await new Function("url", "return import(url)")(sceneUrl);
    const step = PlaceableScene.prototype.step;
    PlaceableScene.prototype.step = function (...args: unknown[]) {
      const result = step.apply(this, args);
      const canvas = document.querySelector('canvas')!, rect = canvas.getBoundingClientRect();
      const screen = (point: any) => { point.project(this.camera); return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 }; };
      const pinHub = this.previewRotor.children.find((child: any) => child.geometry?.type === "SphereGeometry");
      const gardenSign = this.gardenEntrance.getObjectByName("garden-entrance-sign");
      const recordsSign = this.recordsArchive.getObjectByName("records-archive-sign");
      if (!pinHub) throw new Error("test probe: pinwheel hub missing");
      if (!gardenSign) throw new Error("test probe: Garden entrance sign missing");
      if (!recordsSign) throw new Error("test probe: Records archive sign missing");
      (window as any).__plazaSample = { x: this.actor.position.x, z: this.actor.position.z, facing: this.actor.rotation.y,
        yaw: this.cameraRig.yaw, moving: this.locomotion.moving, engaged: this.cameraRig.engaged,
        actor: screen(this.actor.position.clone().setY(0.5)),
        pin: screen(pinHub.getWorldPosition(this.pinwheel.position.clone())),
        garden: screen(gardenSign.getWorldPosition(this.gardenEntrance.position.clone())),
        records: screen(recordsSign.getWorldPosition(this.recordsArchive.position.clone())),
        labels: this.labels() };
      return result;
    };
  });
  await expect.poll(() => sample(page)).toBeTruthy();
}
async function hold(page: Page, key: string, milliseconds = 450) {
  await page.getByTestId("placeable-world-canvas").focus();
  await page.keyboard.down(key); await page.waitForTimeout(milliseconds); await page.keyboard.up(key);
}
async function settle(page: Page) { await expect.poll(async () => (await sample(page)).moving).toBe(false); await page.waitForTimeout(800); }
async function rotate(page: Page, count: number) {
  await page.locator(".plaza-help summary").click();
  for (let n = 0; n < count; n++) await page.getByRole("button", { name: "오른쪽 보기", exact: true }).click();
  await page.waitForTimeout(800);
  await page.locator(".plaza-help summary").click();
}

async function openGardenDestination(page: Page) {
  await page.goto(route);
  await expect(page.getByTestId("placeable-world"))
    .toHaveAttribute("data-companion-pose", /idle|neutral/, { timeout: 20000 });
  await expect(page.locator('[data-world-label="garden-entrance"]'))
    .toBeVisible();
}

async function gardenTarget(page: Page) {
  const box = await page.locator('[data-world-label="garden-entrance"]').boundingBox();
  if (!box) throw new Error("Garden entrance label is not visible");
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

async function openRecordsDestination(page: Page) {
  await page.goto(route);
  await expect(page.getByTestId("placeable-world"))
    .toHaveAttribute("data-companion-pose", /idle|neutral/, {
      timeout: 20000,
    });
  await expect(page.locator(
    `[data-world-label="${RECORDS_DESTINATION.id}"]`,
  )).toHaveText("기록 찾아보기");
}

async function recordsTarget(page: Page) {
  const canvas = page.getByTestId("placeable-world-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Records canvas is not visible");

  const scene = new PlaceableScene();
  try {
    scene.resize(box.width / box.height);
    scene.scene.updateMatrixWorld(true);

    const sign = scene.recordsArchive.getObjectByName(
      "records-archive-sign",
    );
    if (!sign) throw new Error("Records archive sign is missing");

    const point = sign
      .getWorldPosition(new Vector3())
      .project(scene.camera);

    return {
      x: box.x + (point.x + 1) * box.width / 2,
      y: box.y + (1 - point.y) * box.height / 2,
    };
  } finally {
    scene.dispose();
  }
}


async function openAnalysisDestination(page: Page) {
  await page.goto(route);
  await expect(page.getByTestId("placeable-world"))
    .toHaveAttribute("data-companion-pose", /idle|neutral/, { timeout: 20000 });
  await expect(page.locator(
    `[data-world-label="${AI_ANALYSIS_DESTINATION.id}"]`,
  )).toHaveText("AI 분석");
}

async function analysisTarget(page: Page) {
  const canvas = page.getByTestId("placeable-world-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("AI Analysis canvas is not visible");
  const scene = new PlaceableScene();
  try {
    scene.resize(box.width / box.height);
    scene.scene.updateMatrixWorld(true);
    const board = scene.analysisDesk.getObjectByName("analysis-desk-board");
    if (!board) throw new Error("AI Analysis desk board is missing");
    const point = board.getWorldPosition(new Vector3()).project(scene.camera);
    return {
      x: box.x + (point.x + 1) * box.width / 2,
      y: box.y + (1 - point.y) * box.height / 2,
    };
  } finally {
    scene.dispose();
  }
}

async function openSettingsDestination(page: Page) {
  await page.goto(route);
  await expect(page.getByTestId("placeable-world"))
    .toHaveAttribute("data-companion-pose", /idle|neutral/, {
      timeout: 20000,
    });
  await expect(page.locator(
    `[data-world-label="${SETTINGS_DESTINATION.id}"]`,
  )).toHaveText("설정");
}

async function settingsTarget(page: Page) {
  const canvas = page.getByTestId("placeable-world-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Settings canvas is not visible");

  const scene = new PlaceableScene();
  try {
    scene.resize(box.width / box.height);
    scene.scene.updateMatrixWorld(true);
    const panel = scene.settingsPost.getObjectByName(
      "settings-service-panel",
    );
    if (!panel) throw new Error("Settings service panel is missing");
    const point = panel.getWorldPosition(new Vector3()).project(scene.camera);
    return {
      x: box.x + (point.x + 1) * box.width / 2,
      y: box.y + (1 - point.y) * box.height / 2,
    };
  } finally {
    scene.dispose();
  }
}

async function openPlacementEditor(page: Page) {
  await page.goto(route);
  await expect(page.getByTestId("placeable-world"))
    .toHaveAttribute("data-companion-pose", /idle|neutral/, {
      timeout: 20000,
    });
  await page.getByRole("button", {
    name: "꾸미기",
    exact: true,
  }).click();
  await expect(page.getByTestId("placeable-world"))
    .toHaveAttribute("data-placement-editing", "true");
}

async function socketTarget(
  page: Page,
  socketId: (typeof SOCKETS)[number]["id"],
) {
  const label = page.locator(`[data-world-label="${socketId}"]`);
  await expect(label).toBeVisible();
  const box = await label.boundingBox();
  if (!box) throw new Error(`Socket label ${socketId} is not visible`);
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

test("#942 first step is explicit and only real locomotion dismisses it", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await open(page);

  const world = page.getByTestId("placeable-world");
  const cue = page.getByTestId("plaza-first-step");
  const gate = page.locator('[data-world-label="today-gate"]');

  await expect(world).toHaveAttribute("data-first-step", "prompt");
  await expect(cue).toBeVisible();
  await expect(cue).toContainText("Today Gate로 걸어가 보세요.");
  await expect(cue).toContainText("방향키·WASD 또는 걷기 패드");
  await expect(gate).toHaveAttribute("data-arrival-highlight", "true");

  // Elapsed time alone never pretends that the user moved.
  await page.waitForTimeout(1250);
  await expect(world).toHaveAttribute("data-first-step", "prompt");
  await expect(cue).toBeVisible();

  await page.emulateMedia({ forcedColors: "active" });
  await expect(cue).toHaveCSS("border-top-style", "solid");
  await expect(gate).toHaveCSS("outline-style", "solid");
  await page.emulateMedia({ forcedColors: "none" });

  const before = await sample(page);
  await hold(page, "w", 160);

  await expect(world).toHaveAttribute("data-first-step", "acknowledged");
  await expect(cue).toContainText("첫걸음이 시작됐어요.");
  await expect(cue).toContainText("이제 광장을 자유롭게 둘러보세요.");

  const after = await sample(page);
  expect(after.z).toBeLessThan(before.z);

  await expect(world).toHaveAttribute("data-first-step", "complete", {
    timeout: 3000,
  });
  await expect(cue).toHaveCount(0);
  await expect(gate).not.toHaveAttribute("data-arrival-highlight", "true");
});

test("#948 bounded Today return re-enters Living City without replaying first-step onboarding", async ({ page }) => {
  await page.addInitScript(({ key, snapshot }) => {
    localStorage.setItem(key, JSON.stringify(snapshot));
    const original = Storage.prototype.setItem;
    Object.assign(window, { e948Writes: 0 });
    Storage.prototype.setItem = function (name, value) {
      if (name === key) (window as unknown as { e948Writes: number }).e948Writes++;
      return original.call(this, name, value);
    };
  }, { key: STORAGE_KEY, snapshot: emptySnapshot() });

  const reentryRoute = `${route}&return_space=3d-browser`;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(reentryRoute);

  const world = page.getByTestId("placeable-world");
  const cue = page.getByTestId("plaza-return-cue");
  const firstStep = page.getByTestId("plaza-first-step");
  const gate = page.locator('[data-world-label="today-gate"]');
  const today = page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true });

  await expect(world).toHaveAttribute("data-reentry", "true");
  await expect(world).toHaveAttribute("data-first-step", "complete");
  await expect(firstStep).toHaveCount(0);
  await expect(cue).toBeVisible();
  await expect(cue).toContainText("Today");
  await expect(cue).toContainText("Living City");
  await expect(cue).toContainText("내 공간으로 돌아왔어요.");
  await expect(cue).not.toContainText(/Today Gate|같은 자리|방금 있던 자리/);
  await expect(gate).not.toHaveAttribute("data-arrival-highlight", "true");
  await expect(today).toHaveAttribute("href", "?screen=S02&return_space=3d-browser");
  await expect(cue).toHaveCSS("animation-name", "plaza-return-entry");

  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.reload();
  await expect(world).toHaveAttribute("data-reentry", "true");
  await expect(world).toHaveAttribute("data-first-step", "complete");
  const reducedCue = page.getByTestId("plaza-return-cue");
  await expect(reducedCue).toBeVisible();
  await expect(reducedCue).toHaveCSS("animation-name", "none");
  await expect(reducedCue).toHaveCSS("border-top-style", "solid");

  await page.emulateMedia({ reducedMotion: "no-preference", forcedColors: "none" });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(reentryRoute);
    await expect(page.getByTestId("plaza-return-cue")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }

  expect(await page.evaluate(() => (window as unknown as { e948Writes: number }).e948Writes)).toBe(0);

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${route}&return_space=classic-browser`);
  await expect(world).toHaveAttribute("data-reentry", "false");
  await expect(world).toHaveAttribute("data-first-step", "prompt");
  await expect(page.getByTestId("plaza-return-cue")).toHaveCount(0);
  await expect(page.getByTestId("plaza-first-step")).toBeVisible();
});

test("#952 re-entry authority requires exact raw view/storage while renderer fallback remains ordinary", async ({ page }) => {
  await page.addInitScript(({ key, snapshot }) => {
    localStorage.setItem(key, JSON.stringify(snapshot));
    const original = Storage.prototype.setItem;
    Object.assign(window, { e952Writes: 0 });
    Storage.prototype.setItem = function (name, value) {
      if (name === key) (window as unknown as { e952Writes: number }).e952Writes++;
      return original.call(this, name, value);
    };
  }, { key: STORAGE_KEY, snapshot: emptySnapshot() });

  const cases = [
    {
      href: "/?experience=e2&view=3d&storage=unknown&return_space=3d-browser&return_place=garden-nook",
      view: "3d",
    },
    {
      href: "/?experience=e2&view=3d&return_space=3d-browser&return_place=garden-nook",
      view: "3d",
    },
    {
      href: "/?experience=e2&view=3d&storage=browser&storage=account&return_space=3d-browser&return_place=garden-nook",
      view: "3d",
    },
    {
      href: "/?experience=e2&view=3d&view=classic&storage=browser&return_space=3d-browser&return_place=garden-nook",
      view: "3d",
    },
    {
      href: "/?experience=e2&view=unknown&storage=browser&return_space=classic-browser&return_place=garden-nook",
      view: "classic",
    },
    {
      href: "/?experience=e2&storage=browser&return_space=classic-browser&return_place=garden-nook",
      view: "classic",
    },
  ] as const;

  for (const { href, view } of cases) {
    await page.goto(href);
    const experience = page.getByTestId("placeable-experience");
    await expect(experience).toHaveAttribute("data-mode", "browser");
    await expect(experience).toHaveAttribute("data-view", view);
    await expect(page.getByTestId("garden-experience")).toHaveCount(0);

    if (view === "3d") {
      const world = page.getByTestId("placeable-world");
      await expect(world).toHaveAttribute("data-reentry", "false");
      await expect(world).toHaveAttribute("data-first-step", "prompt");
      await expect(page.getByTestId("plaza-return-cue")).toHaveCount(0);
      await expect(page.getByTestId("plaza-first-step")).toBeVisible();
    } else {
      await expect(page.getByTestId("placeable-world-canvas")).toHaveCount(0);
    }

    expect(await page.evaluate(() => (window as unknown as { e952Writes: number }).e952Writes)).toBe(0);
  }
});

test("#944/#963 Today Gate uses the existing E1 radius and exposes one semantic Today handoff", async ({ page }) => {
  const gate = E1_LIVING_CITY_ENTRY_SCENE_PROFILE.destination;

  expect(resolveTodayGateProximity({ x: gate.x + gate.radius, z: gate.z }))
    .toBe("arrived");
  expect(resolveTodayGateProximity({ x: gate.x + gate.radius + 0.01, z: gate.z }))
    .toBe("approach");
  expect(resolveTodayGateProximity({ x: gate.x + TODAY_GATE_APPROACH_RADIUS, z: gate.z }))
    .toBe("approach");
  expect(resolveTodayGateProximity({ x: gate.x + TODAY_GATE_APPROACH_RADIUS + 0.01, z: gate.z }))
    .toBe("far");

  await page.setViewportSize({ width: 1366, height: 900 });
  await open(page);

  const world = page.getByTestId("placeable-world");
  const canvas = page.getByTestId("placeable-world-canvas");
  const gateLabel = page.locator('[data-world-label="today-gate"]');
  const status = page.getByTestId("plaza-gate-status");
  const today = page.getByRole("link", {
    name: "오늘의 기록으로 가기",
    exact: true,
  });

  await expect(world).toHaveAttribute("data-gate-proximity", "far");
  await expect(status).toHaveCount(0);
  await expect(today).toHaveAttribute("aria-describedby", "placeable-today-context");

  // Time alone cannot manufacture approach or arrival.
  await page.waitForTimeout(600);
  await expect(world).toHaveAttribute("data-gate-proximity", "far");

  // Walk straight toward the Gate until entering the derived approach envelope.
  await canvas.focus();
  await page.keyboard.down("w");
  try {
    await expect(world).toHaveAttribute("data-gate-proximity", "approach", {
      timeout: 4500,
    });
  } finally {
    await page.keyboard.up("w");
  }

  await expect(world).toHaveAttribute("data-first-step", "complete", {
    timeout: 3000,
  });
  await expect(status).toContainText("Today Gate가 가까워지고 있어요.");
  await expect(status).toContainText("조금만 더 걸어가 보세요.");
  await expect(status).toHaveAttribute("id", "plaza-gate-status");
  await expect(today).toHaveAttribute("aria-describedby", "placeable-today-context plaza-gate-status");

  // Arrival requires centering on the real Gate; straight-ahead alone cannot
  // satisfy the authoritative 0.85m radius from the authored start position.
  await canvas.focus();
  await page.keyboard.down("d");
  try {
    await expect.poll(async () => (await sample(page)).x, {
      timeout: 3500,
    }).toBeGreaterThan(-0.25);
  } finally {
    await page.keyboard.up("d");
  }

  await canvas.focus();
  await page.keyboard.down("w");
  try {
    await expect(world).toHaveAttribute("data-gate-proximity", "arrived", {
      timeout: 4000,
    });
  } finally {
    await page.keyboard.up("w");
  }

  await expect(status).toContainText("Today Gate에 도착했어요.");
  await expect(status).toContainText("오늘의 기록으로 이어갈 수 있어요.");
  await expect(today).toHaveAttribute("aria-describedby", "placeable-today-context plaza-gate-status");
  await expect(today).toHaveAttribute(
    "href",
    "?screen=S02&return_space=3d-browser",
  );

  // Editing hides the Gate status, so the semantic control must not retain a
  // dangling description. Closing the editor restores the same arrived state.
  await page.getByRole("button", { name: "꾸미기", exact: true }).click();
  await expect(status).toHaveCount(0);
  await expect(today).toHaveAttribute("aria-describedby", "placeable-today-context");
  await page.keyboard.press("Escape");
  await expect(status).toHaveAttribute("data-state", "arrived");
  await expect(today).toHaveAttribute("aria-describedby", "placeable-today-context plaza-gate-status");

  expect(
    await today.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).not.toBe("rgba(0, 0, 0, 0)");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(gateLabel).toHaveCSS("animation-name", "none");

  await page.emulateMedia({
    reducedMotion: "reduce",
    forcedColors: "active",
  });
  await expect(status).toHaveCSS("border-top-style", "solid");
  await expect(gateLabel).toHaveCSS("outline-style", "solid");

  await page.emulateMedia({
    reducedMotion: "no-preference",
    forcedColors: "none",
  });

  // Walking away must reverse the same visit-local state.
  await canvas.focus();
  await page.keyboard.down("s");
  try {
    await expect(world).toHaveAttribute("data-gate-proximity", "approach", {
      timeout: 2500,
    });
    await expect(today).toHaveAttribute("aria-describedby", "placeable-today-context plaza-gate-status");
    await expect(world).toHaveAttribute("data-gate-proximity", "far", {
      timeout: 4000,
    });
  } finally {
    await page.keyboard.up("s");
  }

  await expect(status).toHaveCount(0);
  await expect(today).toHaveAttribute("aria-describedby", "placeable-today-context");
  expect(
    await today.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).toBe("rgba(0, 0, 0, 0)");
});

test("#967 Gate semantic handoff clears when Plaza world unmounts for Garden", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await open(page);

  const world = page.getByTestId("placeable-world");
  const canvas = page.getByTestId("placeable-world-canvas");
  const today = page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true });
  const status = page.getByTestId("plaza-gate-status");

  await canvas.focus();
  await page.keyboard.down("w");
  try {
    await expect(world).toHaveAttribute("data-gate-proximity", "approach", { timeout: 4500 });
  } finally {
    await page.keyboard.up("w");
  }

  await expect(world).toHaveAttribute("data-first-step", "complete", { timeout: 3000 });

  await canvas.focus();
  await page.keyboard.down("d");
  try {
    await expect.poll(async () => (await sample(page)).x, { timeout: 3500 }).toBeGreaterThan(-0.25);
  } finally {
    await page.keyboard.up("d");
  }

  await canvas.focus();
  await page.keyboard.down("w");
  try {
    await expect(world).toHaveAttribute("data-gate-proximity", "arrived", { timeout: 4000 });
  } finally {
    await page.keyboard.up("w");
  }

  await expect(status).toHaveAttribute("data-state", "arrived");
  await expect(today).toHaveAttribute("aria-describedby", "placeable-today-context plaza-gate-status");

  await page.getByRole("button", { name: "정원 쉼터로 가기", exact: true }).click();
  await expect(page.getByTestId("garden-experience")).toBeVisible();
  await expect(page.getByTestId("plaza-gate-status")).toHaveCount(0);

  await page.getByRole("button", { name: "광장으로 돌아가기", exact: true }).click();
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-gate-proximity", "far");
  await expect(page.getByTestId("plaza-gate-status")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true }))
    .toHaveAttribute("aria-describedby", "placeable-today-context");
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test("#999 resting Plaza is scene-first with distinct civic, place and local actions", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(route);

  const world = page.getByTestId("placeable-world");
  await expect(world).toHaveAttribute(
    "data-companion-pose",
    /idle|neutral/,
    { timeout: 20000 },
  );

  const identity = page.getByTestId("plaza-identity-bar");
  const scope = page.getByTestId("plaza-scope");
  const rail = page.getByTestId("plaza-action-rail");
  const canvas = page.getByTestId("placeable-world-canvas");
  const today = page.getByRole("link", {
    name: "오늘의 기록으로 가기",
    exact: true,
  });
  const records = page.getByRole("link", {
    name: "기록 찾아보기로 가기",
    exact: true,
  });
  const garden = page.getByRole("button", {
    name: "정원 쉼터로 가기",
    exact: true,
  });
  const decorate = page.getByRole("button", {
    name: "꾸미기",
    exact: true,
  });
  const companionStatus = page.getByTestId("companion-response");
  const tools = page.locator(".plaza-help");

  await expect(identity).toBeVisible();
  await expect(scope).toBeVisible();
  await expect(scope).toContainText("이 브라우저의 공간");
  await expect(scope).toContainText("3D 광장");

  await expect(today).toBeVisible();
  await expect(records).toBeVisible();
  await expect(garden).toBeVisible();
  await expect(decorate).toBeVisible();
  await expect(decorate).toHaveAttribute(
    "data-plaza-action",
    "decorate",
  );
  await expect(garden).toHaveAttribute(
    "data-plaza-action",
    "garden",
  );
  await expect(today).toHaveAttribute(
    "data-plaza-action",
    "today",
  );
  await expect(records).toHaveAttribute(
    "data-plaza-action",
    "records",
  );

  const identityBox = (await identity.boundingBox())!;
  const railBox = (await rail.boundingBox())!;
  const worldBox = (await world.boundingBox())!;

  expect(identityBox.height).toBeLessThan(90);
  expect(railBox.height).toBeLessThan(84);
  expect(worldBox.height).toBeGreaterThan(900 * 0.68);

  expect(
    await today.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).toBe("rgba(0, 0, 0, 0)");

  expect(
    await records.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).toBe("rgba(0, 0, 0, 0)");

  expect(
    await decorate.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).not.toBe("rgba(0, 0, 0, 0)");

  await expect(garden).toHaveCSS("border-top-style", "solid");

  // The rendered companion is the normal presence. Its live semantic status
  // remains mounted without becoming a persistent visible card.
  await expect(companionStatus).toHaveAttribute(
    "data-notice",
    "false",
  );
  await expect(companionStatus).toHaveCSS(
    "clip-path",
    "inset(50%)",
  );

  await expect(tools).not.toHaveAttribute("open", /.+/);
  await expect(tools.locator("summary")).toBeVisible();

  await expect(world).toHaveAttribute("data-socket", "unplaced");
  await expect(page.getByText("0/3", { exact: true })).toHaveCount(0);

  await page.screenshot({
    path: test.info().outputPath("999-resting-desktop.png"),
    scale: "css",
  });

  // Editing transforms the same place rather than mounting a second renderer.
  await decorate.click();
  await expect(world).toHaveAttribute(
    "data-placement-editing",
    "true",
  );
  await expect(
    page.getByRole("region", {
      name: "내 공간 꾸미기",
    }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);

  const editingCanvas = (await canvas.boundingBox())!;
  expect(editingCanvas.width).toBeGreaterThan(700);

  await page.screenshot({
    path: test.info().outputPath("999-editing-desktop.png"),
    scale: "css",
  });
});

test("#999 compact, short and enlarged-text compositions remain reachable without overflow", async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 900, height: 500 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(route);

    const world = page.getByTestId("placeable-world");
    await expect(world).toHaveAttribute(
      "data-companion-pose",
      /idle|neutral/,
      { timeout: 20000 },
    );

    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth,
    )).toBe(true);

    const scope = page.getByTestId("plaza-scope");
    const today = page.getByRole("link", {
      name: "오늘의 기록으로 가기",
      exact: true,
    });
    const records = page.getByRole("link", {
      name: "기록 찾아보기로 가기",
      exact: true,
    });
    const garden = page.getByRole("button", {
      name: "정원 쉼터로 가기",
      exact: true,
    });
    const decorate = page.getByRole("button", {
      name: "꾸미기",
      exact: true,
    });

    await expect(scope).toBeVisible();

    for (const action of [today, records, garden, decorate]) {
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeVisible();
      const box = (await action.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    // Reachability may scroll the fixed My Space viewport itself rather than
    // window. Reset the real scroll owner before capturing entry composition.
    await page.getByTestId("placeable-experience").evaluate((element) => {
      element.scrollTop = 0;
      element.scrollLeft = 0;
    });

    await page.screenshot({
      path: test.info().outputPath(
        `999-resting-${viewport.width}x${viewport.height}.png`,
      ),
      scale: "css",
    });
  }

  // Exercise a real 200% text-size path rather than assuming the media rules.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(route);
  await expect(page.getByTestId("placeable-world"))
    .toHaveAttribute("data-companion-pose", /idle|neutral/, {
      timeout: 20000,
    });

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  await page.getByTestId("placeable-experience").evaluate((element) => {
    element.scrollTop = 0;
    element.scrollLeft = 0;
  });

  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= innerWidth,
  )).toBe(true);

  await page.screenshot({
    path: test.info().outputPath("999-text-200-top.png"),
    scale: "css",
  });

  const decorate = page.getByRole("button", {
    name: "꾸미기",
    exact: true,
  });
  await decorate.scrollIntoViewIfNeeded();
  await decorate.click();

  const choose = page.getByRole("button", {
    name: "환영 바람개비 고르기",
    exact: true,
  });
  await choose.scrollIntoViewIfNeeded();
  await expect(choose).toBeVisible();
  await choose.click();

  const confirm = page.getByRole("button", {
    name: "배치 확정하기",
    exact: true,
  });
  await confirm.scrollIntoViewIfNeeded();
  await expect(confirm).toBeVisible();

  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= innerWidth,
  )).toBe(true);

  await page.screenshot({
    path: test.info().outputPath("999-text-200.png"),
    scale: "css",
  });
});

test("#997 spatial socket editing previews the authored locations without writes or navigation leakage", async ({ page }) => {
  await page.addInitScript((key) => {
    Object.assign(window, { e997Writes: 0 });
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) {
        (window as unknown as { e997Writes: number }).e997Writes++;
      }
      return original.call(this, name, value);
    };
  }, STORAGE_KEY);

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(route);
  await expect(page.getByTestId("placeable-world"))
    .toHaveAttribute("data-companion-pose", /idle|neutral/, {
      timeout: 20000,
    });

  for (const socket of SOCKETS) {
    await expect(
      page.locator(`[data-world-label="${socket.id}"]`),
    ).toBeHidden();
  }

  await page.getByRole("button", {
    name: "꾸미기",
    exact: true,
  }).click();

  const world = page.getByTestId("placeable-world");
  const walkPad = page.getByRole("button", {
    name: "드래그하거나 방향키로 광장 걷기",
  });

  await expect(world).toHaveAttribute("data-placement-editing", "true");
  await expect(walkPad).toBeDisabled();

  for (const socket of SOCKETS) {
    await expect(
      page.locator(`[data-world-label="${socket.id}"]`),
    ).toBeVisible();
  }

  // Canvas placement mode owns the gesture. Even a direct Garden tap cannot
  // leak into navigation while the edit surface is active.
  const garden = await gardenTarget(page);
  await page.mouse.click(garden.x, garden.y);
  await expect(page.getByTestId("garden-experience")).toHaveCount(0);

  for (const socket of SOCKETS) {
    const target = await socketTarget(page, socket.id);
    await page.mouse.click(target.x, target.y);

    await expect(world).toHaveAttribute("data-socket", socket.id);
    await expect(page.getByRole("button", {
      name: socket.label,
      exact: true,
    })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("draft-placement"))
      .toContainText(socket.label);
    expect(await page.evaluate(() =>
      (window as unknown as { e997Writes: number }).e997Writes,
    )).toBe(0);
  }

  // Dragging across another socket is a cancelled tap and cannot orbit/select.
  const beforeDrag = await world.getAttribute("data-socket");
  const dragTarget = await socketTarget(page, "gate-left");
  await page.mouse.move(dragTarget.x, dragTarget.y);
  await page.mouse.down();
  await page.mouse.move(
    dragTarget.x + 90,
    dragTarget.y + 18,
    { steps: 8 },
  );
  await page.mouse.up();

  await expect(world).toHaveAttribute("data-socket", beforeDrag!);
  expect(await page.evaluate(() =>
    (window as unknown as { e997Writes: number }).e997Writes,
  )).toBe(0);

  await page.getByRole("button", {
    name: "미리보기 취소",
    exact: true,
  }).click();

  await expect(world).toHaveAttribute("data-placement-editing", "false");
  await expect(world).toHaveAttribute("data-socket", "unplaced");
  for (const socket of SOCKETS) {
    await expect(
      page.locator(`[data-world-label="${socket.id}"]`),
    ).toBeHidden();
  }
  expect(await page.evaluate(() =>
    (window as unknown as { e997Writes: number }).e997Writes,
  )).toBe(0);

  // The existing explicit confirmation remains the sole write path.
  await openPlacementEditor(page);
  const target = await socketTarget(page, "plaza-edge");
  await page.mouse.click(target.x, target.y);
  expect(await page.evaluate(() =>
    (window as unknown as { e997Writes: number }).e997Writes,
  )).toBe(0);

  await page.getByRole("button", {
    name: "배치 확정하기",
    exact: true,
  }).click();

  await expect(page.getByTestId("save-status")).toContainText("저장했어요");
  expect(await page.evaluate(() =>
    (window as unknown as { e997Writes: number }).e997Writes,
  )).toBe(1);
});

test("#997 compact placement keeps static selection identity and semantic fallback", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({
    reducedMotion: "reduce",
    forcedColors: "active",
  });

  await openPlacementEditor(page);

  const world = page.getByTestId("placeable-world");
  await expect(world).toHaveAttribute("data-scenery-profile", "compact");
  await expect(world).toHaveAttribute("data-reduced-motion", "true");
  await expect(world).toHaveAttribute("data-placement-editing", "true");

  for (const socket of SOCKETS) {
    await expect(page.getByRole("button", {
      name: socket.label,
      exact: true,
    })).toBeVisible();
  }

  const visibleSocketLabels = await page.locator(
    '[data-world-label="gate-left"],'
      + '[data-world-label="gate-right"],'
      + '[data-world-label="plaza-edge"]',
  ).evaluateAll((nodes) => nodes.filter((node) => {
    const style = getComputedStyle(node);
    return style.display !== "none"
      && style.visibility !== "hidden"
      && style.opacity !== "0";
  }).length);

  expect(visibleSocketLabels).toBeGreaterThan(0);

  await page.getByRole("button", {
    name: "입구 오른쪽",
    exact: true,
  }).click();

  await expect(world).toHaveAttribute("data-socket", "gate-right");
  await expect(page.getByRole("button", {
    name: "입구 오른쪽",
    exact: true,
  })).toHaveAttribute("aria-pressed", "true");

  const selected = page.locator(
    '[data-world-label="gate-right"]',
  );
  await expect(selected).toHaveAttribute(
    "data-placement-state",
    "preview",
  );
  await expect(selected).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(selected).toHaveCSS(
    "border-top-style",
    "dashed",
  );

  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= innerWidth,
  )).toBe(true);
});

test("#997 renderer failure leaves semantic socket preview available", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openPlacementEditor(page);

  await page.getByTestId("placeable-world-canvas").evaluate(
    (canvas: HTMLCanvasElement) => {
      canvas.getContext("webgl2")!
        .getExtension("WEBGL_lose_context")!
        .loseContext();
    },
  );

  await expect(page.getByRole("alert"))
    .toContainText("3D 광장을 열지 못했어요");

  const semanticSocket = page.getByRole("button", {
    name: "입구 오른쪽",
    exact: true,
  });
  await expect(semanticSocket).toBeVisible();
  await semanticSocket.click();

  await expect(semanticSocket)
    .toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("draft-placement"))
    .toContainText("입구 오른쪽");
  await expect(page.getByTestId("placeable-world"))
    .toHaveAttribute("data-socket", "gate-right");
});

test("Records is a visible drag-safe spatial destination that activates one semantic S08 link", async ({ page }) => {
  await page.addInitScript((key) => {
    Object.assign(window, { recordsWrites: 0 });
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) (window as unknown as { recordsWrites: number }).recordsWrites++;
      return original.call(this, name, value);
    };
  }, STORAGE_KEY);

  await page.setViewportSize({ width: 1366, height: 900 });
  await openRecordsDestination(page);

  const label = page.locator(`[data-world-label="${RECORDS_DESTINATION.id}"]`);
  const link = page.getByRole("link", {
    name: "기록 찾아보기로 가기",
    exact: true,
  });

  await expect(label).toHaveText("기록 찾아보기");
  await expect(label).toBeVisible();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "?screen=S08");
  await expect(link).toHaveAttribute("aria-describedby", "placeable-records-context");
  await expect(link).toHaveAttribute("aria-disabled", "false");

  await page.screenshot({
    path: test.info().outputPath("records-destination-desktop.png"),
    scale: "css",
  });

  const beforeUrl = page.url();
  let point = await recordsTarget(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 90, point.y + 18, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  await expect(page).toHaveURL(beforeUrl);

  // The drag legitimately changed the camera. Start a fresh visit before
  // proving the authored Records object itself is a deliberate canvas tap.
  await openRecordsDestination(page);
  point = await recordsTarget(page);
  await page.mouse.click(point.x, point.y);
  await expect(page).toHaveURL(/\?screen=S08$/);

  expect(await page.evaluate(() =>
    (window as unknown as { recordsWrites: number }).recordsWrites,
  )).toBe(0);
});

test("Records obeys the existing source-settling and placement-tap owner", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openRecordsDestination(page);

  await page.getByRole("button", { name: "꾸미기", exact: true }).click();
  await page.getByRole("button", { name: "환영 바람개비 고르기", exact: true }).click();

  const records = page.getByRole("link", {
    name: "기록 찾아보기로 가기",
    exact: true,
  });
  const handoff = page.locator("#placeable-destination-handoff");

  await expect(records).toHaveAttribute("aria-disabled", "true");
  await expect(records).toHaveAttribute(
    "aria-describedby",
    "placeable-records-context placeable-destination-handoff",
  );

  await records.focus();
  await page.keyboard.press("Enter");
  await expect(handoff).toBeFocused();
  await expect(page).toHaveURL(/experience=e2/);

  const point = await recordsTarget(page);
  await page.mouse.click(point.x, point.y);
  await expect(page).toHaveURL(/experience=e2/);
  await expect(page.getByTestId("draft-placement")).toBeVisible();

  await page.getByRole("button", {
    name: "미리보기 취소",
    exact: true,
  }).click();

  await expect(records).toHaveAttribute("aria-disabled", "false");
  await expect(records).toHaveAttribute(
    "aria-describedby",
    "placeable-records-context",
  );
});

test("Records remains semantic at compact sizes and when the optional world fails", async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(route);
    await expect(page.getByTestId("placeable-world"))
      .toHaveAttribute("data-companion-pose", /idle|neutral/, {
        timeout: 20000,
      });

    const records = page.getByRole("link", {
      name: "기록 찾아보기로 가기",
      exact: true,
    });
    await records.scrollIntoViewIfNeeded();
    await expect(records).toBeVisible();
    await expect(records).toHaveAttribute("href", "?screen=S08");
    expect((await records.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth,
    )).toBe(true);

    await page.getByTestId("placeable-experience").evaluate((element) => {
      element.scrollTop = 0;
      element.scrollLeft = 0;
    });
    await page.screenshot({
      path: test.info().outputPath(
        `records-destination-${viewport.width}x${viewport.height}.png`,
      ),
      scale: "css",
    });
  }

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(route);
  await expect(page.getByTestId("placeable-world"))
    .toHaveAttribute("data-companion-pose", /idle|neutral/, {
      timeout: 20000,
    });

  await page.getByTestId("placeable-world-canvas").evaluate(
    (canvas: HTMLCanvasElement) => {
      canvas.getContext("webgl2")!
        .getExtension("WEBGL_lose_context")!
        .loseContext();
    },
  );

  await expect(page.getByRole("alert"))
    .toContainText("3D 광장을 열지 못했어요");

  const records = page.getByRole("link", {
    name: "기록 찾아보기로 가기",
    exact: true,
  });
  await expect(records).toBeVisible();
  await expect(records).toHaveAttribute("href", "?screen=S08");
});


test("AI Analysis is a neutral navigation-only spatial destination with direct S11 semantics", async ({ page }) => {
  await page.addInitScript((key) => {
    Object.assign(window, { analysisWrites: 0 });
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) {
        (window as unknown as { analysisWrites: number }).analysisWrites++;
      }
      return original.call(this, name, value);
    };
  }, STORAGE_KEY);

  await page.setViewportSize({ width: 1366, height: 900 });
  await openAnalysisDestination(page);

  const label = page.locator(`[data-world-label="${AI_ANALYSIS_DESTINATION.id}"]`);
  const analysis = page.getByRole("link", { name: "AI 분석으로 가기", exact: true });

  await expect(label).toBeVisible();
  await expect(label).toHaveText("AI 분석");
  await expect(label).toHaveAttribute("data-wayfinding-role", "destination");
  await expect(analysis).toBeVisible();
  await expect(analysis).toHaveAttribute("href", "?screen=S11");
  await expect(analysis).toHaveAttribute("aria-describedby", "placeable-analysis-context");

  await page.screenshot({
    path: test.info().outputPath("ai-analysis-destination-desktop.png"),
    scale: "css",
  });

  const beforeUrl = page.url();
  let point = await analysisTarget(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 90, point.y + 18, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  await expect(page).toHaveURL(beforeUrl);

  await openAnalysisDestination(page);
  point = await analysisTarget(page);
  await page.mouse.click(point.x, point.y);
  await expect(page).toHaveURL(/\?screen=S11$/);
  expect(await page.evaluate(() =>
    (window as unknown as { analysisWrites: number }).analysisWrites,
  )).toBe(0);
});

test("AI Analysis obeys source-settling and placement canvas ownership", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openAnalysisDestination(page);

  await page.getByRole("button", { name: "꾸미기", exact: true }).click();
  await page.getByRole("button", { name: "환영 바람개비 고르기", exact: true }).click();

  const analysis = page.getByRole("link", { name: "AI 분석으로 가기", exact: true });
  const handoff = page.locator("#placeable-destination-handoff");

  await expect(analysis).toHaveAttribute("aria-disabled", "true");
  await expect(analysis).toHaveAttribute(
    "aria-describedby",
    "placeable-analysis-context placeable-destination-handoff",
  );

  await analysis.focus();
  await page.keyboard.press("Enter");
  await expect(handoff).toBeFocused();
  await expect(page).toHaveURL(/experience=e2/);

  const point = await analysisTarget(page);
  await page.mouse.click(point.x, point.y);
  await expect(page).toHaveURL(/experience=e2/);
  await expect(page.getByTestId("draft-placement")).toBeVisible();

  await page.getByRole("button", { name: "미리보기 취소", exact: true }).click();
  await expect(analysis).toHaveAttribute("aria-disabled", "false");
  await expect(analysis).toHaveAttribute("aria-describedby", "placeable-analysis-context");
});

test("AI Analysis stays semantic on compact/WebGL paths and Guest Plaza stays unchanged", async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(route);
    await expect(page.getByTestId("placeable-world"))
      .toHaveAttribute("data-companion-pose", /idle|neutral/, { timeout: 20000 });
    const analysis = page.getByRole("link", { name: "AI 분석으로 가기", exact: true });
    await analysis.scrollIntoViewIfNeeded();
    await expect(analysis).toBeVisible();
    await expect(analysis).toHaveAttribute("href", "?screen=S11");
    expect((await analysis.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth,
    )).toBe(true);
  }

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(route);
  await expect(page.getByTestId("placeable-world"))
    .toHaveAttribute("data-companion-pose", /idle|neutral/, { timeout: 20000 });
  await page.getByTestId("placeable-world-canvas").evaluate(
    (canvas: HTMLCanvasElement) => {
      canvas.getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext();
    },
  );
  await expect(page.getByRole("alert")).toContainText("3D 광장을 열지 못했어요");
  await expect(page.getByRole("link", { name: "AI 분석으로 가기", exact: true }))
    .toHaveAttribute("href", "?screen=S11");

  await page.goto("/?guest=1");
  await page.getByRole("button", { name: "3D 공간 둘러보기", exact: true }).click();
  await expect(page.getByTestId("placeable-world-canvas")).toBeVisible();
  await expect(page.locator(
    `[data-world-label="${AI_ANALYSIS_DESTINATION.id}"]`,
  )).toHaveCount(0);
  await expect(page.getByRole("link", {
    name: "AI 분석으로 가기",
    exact: true,
  })).toHaveCount(0);
});

test("Settings is a secondary spatial utility outside the Plaza action rail", async ({ page }) => {
  await page.addInitScript((key) => {
    Object.assign(window, { settingsWrites: 0 });
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) (window as unknown as { settingsWrites: number }).settingsWrites++;
      return original.call(this, name, value);
    };
  }, STORAGE_KEY);

  await page.setViewportSize({ width: 1366, height: 900 });
  await openSettingsDestination(page);

  const label = page.locator(`[data-world-label="${SETTINGS_DESTINATION.id}"]`);
  const settings = page.getByRole("link", { name: "설정으로 가기", exact: true });
  const rail = page.getByTestId("plaza-action-rail");

  await expect(label).toBeVisible();
  await expect(label).toHaveText("설정");
  await expect(settings).toBeVisible();
  await expect(settings).toHaveAttribute("href", "?screen=S14");
  await expect(rail.locator('[data-plaza-action="settings"]')).toHaveCount(0);

  await page.screenshot({
    path: test.info().outputPath("settings-destination-desktop.png"),
    scale: "css",
  });

  const beforeUrl = page.url();
  let point = await settingsTarget(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 90, point.y + 18, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  await expect(page).toHaveURL(beforeUrl);

  await openSettingsDestination(page);
  point = await settingsTarget(page);
  await page.mouse.click(point.x, point.y);
  await expect(page).toHaveURL(/\?screen=S14$/);
  expect(await page.evaluate(() =>
    (window as unknown as { settingsWrites: number }).settingsWrites,
  )).toBe(0);
});

test("Settings obeys source-settling and placement canvas ownership", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openSettingsDestination(page);

  await page.getByRole("button", { name: "꾸미기", exact: true }).click();
  await page.getByRole("button", { name: "환영 바람개비 고르기", exact: true }).click();

  const settings = page.getByRole("link", { name: "설정으로 가기", exact: true });
  const handoff = page.locator("#placeable-destination-handoff");
  await expect(settings).toHaveAttribute("aria-disabled", "true");
  await expect(settings).toHaveAttribute("aria-describedby", "placeable-destination-handoff");

  await settings.focus();
  await page.keyboard.press("Enter");
  await expect(handoff).toBeFocused();
  await expect(page).toHaveURL(/experience=e2/);

  const point = await settingsTarget(page);
  await page.mouse.click(point.x, point.y);
  await expect(page).toHaveURL(/experience=e2/);
  await expect(page.getByTestId("draft-placement")).toBeVisible();

  await page.getByRole("button", { name: "미리보기 취소", exact: true }).click();
  await expect(settings).toHaveAttribute("aria-disabled", "false");
  await expect(settings).not.toHaveAttribute("aria-describedby", /.+/);
});

test("Settings remains a compact semantic utility and stays out of Guest Plaza", async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(route);
    await expect(page.getByTestId("placeable-world"))
      .toHaveAttribute("data-companion-pose", /idle|neutral/, { timeout: 20000 });
    const settings = page.getByRole("link", { name: "설정으로 가기", exact: true });
    await settings.scrollIntoViewIfNeeded();
    await expect(settings).toBeVisible();
    await expect(settings).toHaveAttribute("href", "?screen=S14");
    expect((await settings.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByTestId("placeable-experience").evaluate((element) => {
      element.scrollTop = 0;
      element.scrollLeft = 0;
    });
    await page.screenshot({
      path: test.info().outputPath(`settings-destination-${viewport.width}x${viewport.height}.png`),
      scale: "css",
    });
  }

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(route);
  await expect(page.getByTestId("placeable-world"))
    .toHaveAttribute("data-companion-pose", /idle|neutral/, { timeout: 20000 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
  const enlarged = page.getByRole("link", { name: "설정으로 가기", exact: true });
  await enlarged.scrollIntoViewIfNeeded();
  await expect(enlarged).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("settings-text-200.png"), scale: "css" });

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(route);
  await expect(page.getByTestId("placeable-world"))
    .toHaveAttribute("data-companion-pose", /idle|neutral/, { timeout: 20000 });
  await page.getByTestId("placeable-world-canvas").evaluate((canvas: HTMLCanvasElement) => {
    canvas.getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext();
  });
  await expect(page.getByRole("alert")).toContainText("3D 광장을 열지 못했어요");
  await expect(page.getByRole("link", { name: "설정으로 가기", exact: true }))
    .toHaveAttribute("href", "?screen=S14");

  await page.goto("/?guest=1");
  await page.getByRole("button", { name: "3D 공간 둘러보기", exact: true }).click();
  await expect(page.getByTestId("placeable-world-canvas")).toBeVisible();
  await expect(page.locator(`[data-world-label="${SETTINGS_DESTINATION.id}"]`)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "설정으로 가기", exact: true })).toHaveCount(0);
});

test("Living City wayfinding hierarchy coordinates destinations without changing semantic exits", async ({ page }) => {
  const assertNoVisibleLabelOverlap = async () => {
    const overlaps = await page.locator(".placeable-world-label:visible").evaluateAll((nodes) => {
      const items = nodes.map((node) => ({
        id: (node as HTMLElement).dataset.worldLabel ?? "",
        rect: node.getBoundingClientRect(),
      }));
      const pairs: string[] = [];
      for (let left = 0; left < items.length; left++) {
        for (let right = left + 1; right < items.length; right++) {
          const a = items[left].rect;
          const b = items[right].rect;
          const overlaps = a.left < b.right && a.right > b.left
            && a.top < b.bottom && a.bottom > b.top;
          if (overlaps) pairs.push(`${items[left].id}:${items[right].id}`);
        }
      }
      return pairs;
    });
    expect(overlaps).toEqual([]);
  };

  for (const viewport of [
    { width: 1366, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(route);
    await expect(page.getByTestId("placeable-world"))
      .toHaveAttribute("data-companion-pose", /idle|neutral/, { timeout: 20000 });

    await expect(page.locator('[data-world-label="today-gate"]'))
      .toHaveAttribute("data-wayfinding-role", "primary");
    await expect(page.locator('[data-world-label="garden-entrance"]'))
      .toHaveAttribute("data-wayfinding-role", "destination");
    await expect(page.locator(`[data-world-label="${RECORDS_DESTINATION.id}"]`))
      .toHaveAttribute("data-wayfinding-role", "destination");
    await expect(page.locator(`[data-world-label="${AI_ANALYSIS_DESTINATION.id}"]`))
      .toHaveAttribute("data-wayfinding-role", "destination");
    await expect(page.locator(`[data-world-label="${SETTINGS_DESTINATION.id}"]`))
      .toHaveAttribute("data-wayfinding-role", "utility");

    await expect(page.getByRole("link", {
      name: "기록 찾아보기로 가기",
      exact: true,
    })).toHaveAttribute("href", "?screen=S08");
    await expect(page.getByRole("link", {
      name: "AI 분석으로 가기",
      exact: true,
    })).toHaveAttribute("href", "?screen=S11");
    await expect(page.getByRole("link", {
      name: "설정으로 가기",
      exact: true,
    })).toHaveAttribute("href", "?screen=S14");
    await expect(page.getByRole("button", {
      name: "정원 쉼터로 가기",
      exact: true,
    })).toBeVisible();
    await expect(page.getByRole("link", {
      name: "오늘의 기록으로 가기",
      exact: true,
    })).toBeVisible();

    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth,
    )).toBe(true);
    await assertNoVisibleLabelOverlap();

    await page.getByTestId("placeable-experience").evaluate((element) => {
      element.scrollTop = 0;
      element.scrollLeft = 0;
    });
    await page.screenshot({
      path: test.info().outputPath(
        `wayfinding-${viewport.width}x${viewport.height}.png`,
      ),
      scale: "css",
    });
  }

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(route);
  await expect(page.getByTestId("placeable-world"))
    .toHaveAttribute("data-companion-pose", /idle|neutral/, { timeout: 20000 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
  await page.setViewportSize({ width: 321, height: 568 });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= innerWidth,
  )).toBe(true);
  await assertNoVisibleLabelOverlap();
  await page.screenshot({
    path: test.info().outputPath("wayfinding-text-200.png"),
    scale: "css",
  });

  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole("button", { name: "꾸미기", exact: true }).click();
  await expect(page.getByTestId("placeable-world"))
    .toHaveAttribute("data-placement-editing", "true");
  await expect(page.locator('[data-wayfinding-role="placement"]'))
    .toHaveCount(SOCKETS.length);
  await assertNoVisibleLabelOverlap();
  await page.screenshot({
    path: test.info().outputPath("wayfinding-editing-320x568.png"),
    scale: "css",
  });

  await page.emulateMedia({ forcedColors: "active" });
  await expect(page.locator(`[data-world-label="${RECORDS_DESTINATION.id}"]`))
    .toHaveCSS("border-top-style", "solid");
  await expect(page.locator(`[data-world-label="${SETTINGS_DESTINATION.id}"]`))
    .toHaveCSS("border-top-style", "solid");
});

test("#995 Garden is a visible tappable Plaza destination without proximity navigation or cosmetic writes", async ({ page }) => {
  await page.addInitScript((key) => {
    Object.assign(window, { e995Writes: 0 });
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) (window as unknown as { e995Writes: number }).e995Writes++;
      return original.call(this, name, value);
    };
  }, STORAGE_KEY);

  await page.setViewportSize({ width: 1366, height: 900 });
  await openGardenDestination(page);

  const world = page.getByTestId("placeable-world");
  const gardenLabel = page.locator('[data-world-label="garden-entrance"]');
  const todayLabel = page.locator('[data-world-label="today-gate"]');
  const semanticGarden = page.getByRole("button", {
    name: "정원 쉼터로 가기",
    exact: true,
  });

  await expect(world).toHaveAttribute("data-scenery-profile", "full");
  await expect(gardenLabel).toHaveText("정원 쉼터");
  await expect(todayLabel).toHaveText("오늘의 기록");
  await expect(todayLabel).toBeVisible();
  await expect(semanticGarden).toBeVisible();

  const canvas = page.getByTestId("placeable-world-canvas");
  await canvas.focus();
  await page.keyboard.down("d");
  await page.waitForTimeout(2400);
  await page.keyboard.up("d");
  await page.waitForTimeout(250);

  await expect(page.getByTestId("garden-experience")).toHaveCount(0);

  const target = await gardenTarget(page);
  await page.mouse.click(target.x, target.y);

  await expect(page.getByTestId("garden-experience")).toBeVisible();
  expect(await page.evaluate(() =>
    (window as unknown as { e995Writes: number }).e995Writes,
  )).toBe(0);

  await page.getByRole("button", {
    name: "광장으로 돌아가기",
    exact: true,
  }).click();

  await expect(page.getByTestId("placeable-world")).toBeVisible();
  expect(await page.evaluate(() =>
    (window as unknown as { e995Writes: number }).e995Writes,
  )).toBe(0);

  await page.getByRole("button", {
    name: "정원 쉼터로 가기",
    exact: true,
  }).click();

  await expect(page.getByTestId("garden-experience")).toBeVisible();
  expect(await page.evaluate(() =>
    (window as unknown as { e995Writes: number }).e995Writes,
  )).toBe(0);
});

test("#995 dragging the Garden entrance or tapping it while source-settling never bypasses the parent guard", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openGardenDestination(page);

  let target = await gardenTarget(page);
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.move(target.x + 90, target.y + 18, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  await expect(page.getByTestId("garden-experience")).toHaveCount(0);
  await expect(page.getByTestId("placeable-world")).toBeVisible();

  await page.getByRole("button", { name: "꾸미기", exact: true }).click();
  await page.getByRole("button", { name: "환영 바람개비 고르기" }).click();
  await expect(page.getByTestId("draft-placement")).toBeVisible();

  target = await gardenTarget(page);
  await page.mouse.click(target.x, target.y);
  await expect(page.getByTestId("garden-experience")).toHaveCount(0);

  const blockedGarden = page.getByRole("button", {
    name: "정원 쉼터로 가기",
    exact: true,
  });
  await expect(blockedGarden).toHaveAttribute("aria-disabled", "true");
  await blockedGarden.focus();
  await expect(blockedGarden).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.locator("#placeable-destination-handoff")).toBeFocused();
  await expect(page.locator("#placeable-destination-handoff"))
    .toContainText("미리보기를 먼저 마무리해 주세요");
});

test("#995 Garden remains legible in compact, reduced-motion and forced-colors presentation", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({
    reducedMotion: "reduce",
    forcedColors: "active",
  });

  await page.goto(route);
  await expect(page.getByTestId("placeable-world"))
    .toHaveAttribute("data-companion-pose", /idle|neutral/, {
      timeout: 20000,
    });

  const world = page.getByTestId("placeable-world");
  const garden = page.locator('[data-world-label="garden-entrance"]');
  const today = page.locator('[data-world-label="today-gate"]');

  await expect(world).toHaveAttribute("data-scenery-profile", "compact");
  await expect(world).toHaveAttribute("data-reduced-motion", "true");

  // #999 allows projected destination labels to yield to collision avoidance
  // on a narrow stage. Their semantic identity and forced-colors treatment
  // remain defined even when the resolver hides one of them.
  await expect(garden).toHaveText("정원 쉼터");
  await expect(garden).toHaveCSS("animation-name", "none");
  await expect(garden).toHaveCSS("border-top-style", "solid");
  await expect(today).toHaveText("오늘의 기록");

  const semanticToday = page.getByRole("link", {
    name: "오늘의 기록으로 가기",
    exact: true,
  });
  await semanticToday.scrollIntoViewIfNeeded();
  await expect(semanticToday).toBeVisible();
  await expect(semanticToday).toBeInViewport();

  const semanticGarden = page.getByRole("button", {
    name: "정원 쉼터로 가기",
    exact: true,
  });
  await semanticGarden.scrollIntoViewIfNeeded();
  await expect(semanticGarden).toBeVisible();
  await expect(semanticGarden).toBeInViewport();
  await expect(semanticGarden).toHaveCSS("border-top-style", "solid");

  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= innerWidth,
  )).toBe(true);
});

test("R2 desktop actual locomotion, facing, 90/180 degree camera-relative control, stop, reset and label tracking", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 }); await open(page);
  const initial = await sample(page); expect(initial.engaged).toBe(false);
  await page.screenshot({ path: test.info().outputPath("arrival.png") });
  await hold(page, "w"); await settle(page);
  const forward = await sample(page); expect(forward.z).toBeLessThan(initial.z - 0.2);
  expect(Math.cos(forward.facing)).toBeLessThan(-0.9);
  await hold(page, "s", 700); await settle(page);
  expect(Math.cos((await sample(page)).facing)).toBeGreaterThan(0.9);
  await rotate(page, 3); const ninety = await sample(page);
  await hold(page, "ArrowUp"); await settle(page); const left = await sample(page);
  expect(left.x).toBeLessThan(ninety.x - 0.2); expect(Math.abs(left.z - ninety.z)).toBeLessThan(0.15);
  await rotate(page, 3); const half = await sample(page);
  await hold(page, "w"); await settle(page);
  expect((await sample(page)).z).toBeGreaterThan(half.z + 0.2);
  const label = page.locator('.placeable-world-label').first();
  expect((await sample(page)).labels[0].visible).toBe(false); await expect(label).toBeHidden();
  await page.locator(".plaza-help summary").click();
  await page.getByRole("button", { name: "시점 다시 맞추기" }).click(); await page.waitForTimeout(900);
  expect(Math.abs((await sample(page)).yaw)).toBeLessThan(0.1);
  await page.locator(".plaza-help summary").click();
  await hold(page, "d", 350); // Blur while moving must zero velocity, including deceleration.
  await page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true }).focus();
  const stopped = await sample(page); await page.waitForTimeout(250);
  expect((await sample(page)).x).toBeCloseTo(stopped.x, 4);
  await page.screenshot({ path: test.info().outputPath("follow.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1366);
});

test("R2 raycast taps survive orbit; dragging companion/pinwheel never greets or spins", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 }); await open(page);
  await page.getByRole("button", { name: "꾸미기", exact: true }).click();
  await page.getByRole("button", { name: "환영 바람개비 고르기" }).click();
  await page.getByRole("button", { name: "배치 확정하기", exact: true }).click();
  await expect(page.getByTestId("save-status")).toContainText("저장했어요");
  await expect.poll(async () => (await page.getByTestId("placeable-world-canvas").boundingBox())!.width).toBe(1366);
  await page.waitForTimeout(100); // ResizeObserver and the sampled camera now describe the full stage.
  const start = await sample(page);
  await page.mouse.click(start.actor.x, start.actor.y);
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "greet");
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "idle", { timeout: 8000 });
  for (const target of ["actor", "pin"] as const) {
    const at = (await sample(page))[target], pulse = await page.getByTestId("placeable-world").getAttribute("data-pulse");
    await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.mouse.move(at.x + 70, at.y + 15, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(500);
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "idle");
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-pulse", pulse!);
  }
  const at = (await sample(page)).actor; await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "greet");
  const pin = (await sample(page)).pin; await page.mouse.click(pin.x, pin.y);
  await expect(page.getByTestId("placeable-feedback")).toContainText("바람개비가 돌아가요");
});

for (const [width, height] of [[390, 844], [320, 568]]) test(`R2 ${width}px two touch pointers coexist; controls and Today remain reachable`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await open(page); const before = await sample(page), cdp = await context.newCDPSession(page);
    const help = (await page.locator(".plaza-help summary").boundingBox())!;
    const gardenControl = page.getByRole("button", { name: "정원 쉼터로 가기", exact: true });
    const garden = (await gardenControl.boundingBox())!;
    expect(await page.locator(".plaza-help").getAttribute("open")).toBeNull();
    expect(help.x + help.width <= garden.x || help.y + help.height <= garden.y || garden.y + garden.height <= help.y).toBe(true);
    const pad = (await page.getByRole("button", { name: "드래그하거나 방향키로 광장 걷기" }).boundingBox())!;
    const thumb = { id: 1, x: pad.x + pad.width / 2, y: pad.y + pad.height / 2 };
    const canvas = (await page.getByTestId("placeable-world-canvas").boundingBox())!;
    const camera = { id: 2, x: canvas.x + canvas.width * 0.67, y: canvas.y + canvas.height * 0.48 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [thumb] });
    thumb.y -= 26;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [thumb] });
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "move");
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-first-step", /acknowledged|complete/);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [thumb, camera] });
    camera.x -= 80;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [thumb, camera] });
    await page.waitForTimeout(350);
    expect((await sample(page)).yaw).toBeGreaterThan(before.yaw + 0.2);
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "move");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [thumb] });
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "move");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await settle(page);
    await page.locator(".plaza-help summary").tap();
    await page.getByRole("button", { name: "시점 다시 맞추기" }).tap();
    await page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: test.info().outputPath(`touch-${width}.png`), scale: "css" });
    await page.locator(".plaza-help summary").tap();
    await page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true }).tap();
    await expect(page.getByTestId("placeable-world")).toHaveCount(0);
  } finally { await context.close(); }
});

test("R2 reduced motion, forced colors, context loss, retry and semantic escape", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 }); await page.emulateMedia({ reducedMotion: "reduce" }); await open(page);
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-first-step", "prompt");
  await expect(page.getByTestId("plaza-first-step")).toBeVisible();
  await expect(page.locator('[data-world-label="today-gate"]')).toHaveCSS("animation-name", "none");
  await expect(page.locator('[data-world-label="garden-entrance"]')).toBeVisible();
  await expect(page.locator('[data-world-label="garden-entrance"]')).toHaveCSS("animation-name", "none");
  const before = await sample(page); await hold(page, "ArrowRight");
  expect((await sample(page)).x).toBeGreaterThan(before.x);
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "neutral");
  await rotate(page, 1); expect((await sample(page)).yaw).toBeGreaterThan(0.4);
  await page.emulateMedia({ forcedColors: "active" });
  await expect(page.locator('[data-world-label="garden-entrance"]')).toHaveCSS("border-top-style", "solid");
  await page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true }).focus();
  await expect(page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true })).toHaveCSS("outline-style", "solid");
  await page.screenshot({ path: test.info().outputPath("903-forced-colors-focus.png"), scale: "css" });
  await page.getByTestId("placeable-world-canvas").evaluate((canvas: HTMLCanvasElement) => {
    canvas.getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext();
  });
  await expect(page.getByRole("alert")).toContainText("3D 광장을 열지 못했어요");
  await page.getByRole("button", { name: "3D 다시 열기" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("903-world-failure.png"), scale: "css" });
  await page.getByRole("button", { name: "3D 다시 열기" }).click();
  await expect(page.getByTestId("placeable-world-canvas")).toBeVisible();
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "neutral");
  expect(await page.locator("canvas").count()).toBe(1);
  await page.getByRole("link", { name: "간단한 광장으로 보기" }).click();
  await expect(page.getByTestId("placeable-world-canvas")).toHaveCount(0);
});

test("R2 exact active GLBs calibrate +Z forward and retain existing move capability", async ({ page, request }) => {
  test.setTimeout(90000); await page.goto(route);
  expect(MODEL_FORWARD_YAW_OFFSET).toBe(0);
  for (const species of companionSpecies) {
    const asset = getMySpaceCompanion(species)!;
    const response = await request.get(asset.url); expect(response.ok()).toBe(true);
    const bytes = await response.body(); expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
    const result = await page.evaluate(async (url) => {
      const { GLTFLoader } = await new Function("return import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js')")();
      const gltf = await new GLTFLoader().loadAsync(url); gltf.scene.updateMatrixWorld(true);
      const eyes: any[] = []; gltf.scene.traverse((o: any) => { if (/^Eye_[LR]$/.test(o.name)) eyes.push(o); });
      const positions = eyes.map(o => { o.geometry.computeBoundingBox(); return o.geometry.boundingBox.getCenter(o.position.clone()).applyMatrix4(o.matrixWorld).toArray(); });
      const move = gltf.animations.find((c: any) => c.name === "move");
      const names = gltf.animations.map((c: any) => c.name);
      const { disposeScene } = await new Function("return import('/src/components/scene/disposeScene.ts')")(); disposeScene(gltf.scene);
      return { positions, names, duration: move.duration, tracks: move.tracks.length };
    }, asset.url);
    expect(result.positions).toHaveLength(2);
    for (const eye of result.positions) { expect(eye[2]).toBeGreaterThan(0.25); expect(Math.abs(eye[0])).toBeLessThan(eye[2]); }
    expect(result.names).toContain("move"); expect(result.duration).toBeCloseTo(4); expect(result.tracks).toBeGreaterThan(0);
  }
});

test("R3 actual companion materials remain readable in both atmospheres with one bounded canvas", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1000, height: 760 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(route);
  for (const species of companionSpecies) {
    await page.evaluate(({ key, species }) => localStorage.setItem(key, species), { key: companionIdentityStorageKey, species });
    await page.reload();
    const world = page.getByTestId("placeable-world");
    await expect(world).toHaveAttribute("data-companion", species);
    await expect(world).toHaveAttribute("data-companion-pose", "neutral");
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(await page.getByTestId("placeable-world-canvas").evaluate((canvas: HTMLCanvasElement) => canvas.width * canvas.height)).toBeLessThanOrEqual(2_000_000);
    // Still GLBs and exact arrival camera make these human visual-review artifacts.
    await page.screenshot({ path: test.info().outputPath(`${species}-daylight.png`) });
    await (await worldTool(page, "광장의 불빛 켜기", true)).click();
    await expect(world).toHaveAttribute("data-welcome-phase", "twilight");
    await page.screenshot({ path: test.info().outputPath(`${species}-twilight.png`) });
    const glbs = await page.evaluate(() => performance.getEntriesByType("resource").map(entry => entry.name).filter(name => /\.glb(?:\?|$)/.test(name)));
    expect(glbs).toEqual([new URL(getMySpaceCompanion(species)!.url, page.url()).href]);
  }
  expect(errors).toEqual([]);
});

for (const width of [390, 320]) test(`R3 ${width}px chrome, 200% text and safe-area controls remain reachable`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(route);
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "neutral");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 44, bottom: 34, left: 0, right: 0 } });
  const pad = (await page.locator(".placeable-walk-pad").boundingBox())!;
  expect(pad.y + pad.height).toBeLessThanOrEqual(844 - 34);
  await page.screenshot({ path: test.info().outputPath(`safe-area-${width}.png`) });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const today = page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true });
  await today.focus(); await expect(today).toBeFocused(); await expect(today).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  await page.screenshot({ path: test.info().outputPath(`text-200-${width}.png`) });
  const surfaces = [".placeable-header", ".placeable-destination", ".plaza-help > summary", ".placeable-walk-pad", ".plaza-first-step-cue"];
  const boxes = await Promise.all(surfaces.map(selector => page.locator(selector).boundingBox()));
  for (const [i, a] of boxes.entries()) for (const b of boxes.slice(i + 1)) {
    expect(a && b).toBeTruthy();
    expect(a!.x + a!.width <= b!.x || b!.x + b!.width <= a!.x || a!.y + a!.height <= b!.y || b!.y + b!.height <= a!.y,
      `${surfaces[i]} overlaps another control: ${JSON.stringify({ a, b })}`).toBe(true);
  }
  const garden = page.getByRole("button", { name: "정원 쉼터로 가기", exact: true });
  await garden.scrollIntoViewIfNeeded();
  await expect(garden).toBeInViewport();
  expect((await garden.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole("button", { name: "꾸미기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "내 공간 꾸미기", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "꾸미기", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "정원 쉼터로 가기", exact: true }).click();
  await expect(page.getByTestId("placeable-world-canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "광장으로 돌아가기", exact: true }).click();
  await today.click();
  await expect(page.getByTestId("placeable-world-canvas")).toHaveCount(0);
});
