import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  expect,
  test,
  type Page,
  type TestInfo,
} from "@playwright/test";

import {
  companionAssetManifest,
} from "../src/ui/companionAssets.generated";

type CandidateRecord = Readonly<{
  candidateId: string;
  speciesKey: string;
  candidateVersion: string;
  candidateVariantKey: string;
  viewerVariant: "standard" | "light";
  sourceRevision: string | null;
  sha256: string;
  bytes: number;
  reviewFile: string;
}>;

type ReviewInput = Readonly<{
  documentType: string;
  status: string;
  family: string;
  speciesCount: number;
  candidateCount: number;
  candidates: readonly CandidateRecord[];
  runtimeActivation: boolean;
  productionQualified: boolean;
}>;

type ScreenId = "S01" | "S02" | "S10";

type CaseRecord = Readonly<{
  status: "passed" | "failed";
  species: string;
  candidateId: string;
  candidateSha256: string;
  screen: ScreenId;
  viewport: Readonly<{
    width: number;
    height: number;
  }>;
  activeRequestUrl: string;
  activeRequestCount: number;
  renderer: string | null;
  layoutOverflow: boolean;
  subjectBounds: unknown;
  durationMs: number;
  error?: string;
}>;

const assetRootRaw =
  process.env.SK7_CANDIDATE_REVIEW_ROOT;

const outputRootRaw =
  process.env.SK7_CANDIDATE_SCREEN_OUTPUT;

if (!assetRootRaw) {
  throw new Error(
    "SK7_CANDIDATE_REVIEW_ROOT is required",
  );
}

if (!outputRootRaw) {
  throw new Error(
    "SK7_CANDIDATE_SCREEN_OUTPUT is required",
  );
}

const assetRoot = path.resolve(
  assetRootRaw,
);

const outputRoot = path.resolve(
  outputRootRaw,
);

mkdirSync(
  outputRoot,
  {
    recursive: true,
  },
);

const input = JSON.parse(
  readFileSync(
    path.join(
      assetRoot,
      "candidate-review-input.json",
    ),
    "utf8",
  ),
) as ReviewInput;

if (
  input.documentType
  !== "COMPANION_CANDIDATE_BROWSER_REVIEW_INPUT"
  || input.status !== "prepared-not-qualified"
  || input.family !== "world-v2"
  || input.speciesCount !== 4
  || input.candidateCount !== 8
  || input.runtimeActivation !== false
  || input.productionQualified !== false
) {
  throw new Error(
    "Unexpected World v2 review input contract",
  );
}

const liteCandidates = input.candidates
  .filter(
    candidate =>
      candidate.viewerVariant === "light",
  )
  .sort(
    (left, right) =>
      left.speciesKey.localeCompare(
        right.speciesKey,
      ),
  );

if (
  liteCandidates.length !== 4
  || new Set(
    liteCandidates.map(
      candidate => candidate.speciesKey,
    ),
  ).size !== 4
) {
  throw new Error(
    "Expected four unique World v2 lite candidates",
  );
}

const expectedSpecies = new Set([
  "koala",
  "mouse",
  "pig",
  "owl",
]);

if (
  liteCandidates.some(
    candidate =>
      !expectedSpecies.has(
        candidate.speciesKey,
      ),
  )
) {
  throw new Error(
    "Unexpected World v2 screen candidate species",
  );
}

const viewports = [
  {
    width: 1366,
    height: 768,
  },
  {
    width: 390,
    height: 844,
  },
  {
    width: 320,
    height: 844,
  },
] as const;

const screens = [
  "S01",
  "S02",
  "S10",
] as const;

const activeBearLiteUrl =
  companionAssetManifest.bear.lite.url;

const records: CaseRecord[] = [];

const progressFile = path.join(
  outputRoot,
  "screen-integration-progress.json",
);

const finalFile = path.join(
  outputRoot,
  "screen-integration.json",
);

function writeProgress() {
  const tmp = progressFile + ".partial";

  writeFileSync(
    tmp,
    JSON.stringify(
      {
        status:
          "in_progress_not_qualified",
        expectedCases:
          liteCandidates.length
          * screens.length
          * viewports.length,
        completedCases:
          records.length,
        records,
      },
      null,
      2,
    ) + "\n",
  );

  renameSync(
    tmp,
    progressFile,
  );
}

function candidateBytes(
  candidate: CandidateRecord,
) {
  const file = path.resolve(
    assetRoot,
    candidate.reviewFile,
  );

  const relative = path.relative(
    assetRoot,
    file,
  );

  if (
    relative.startsWith("..")
    || path.isAbsolute(relative)
  ) {
    throw new Error(
      "candidate review file escaped asset root",
    );
  }

  const bytes = readFileSync(file);

  if (
    bytes.byteLength
    !== candidate.bytes
  ) {
    throw new Error(
      `candidate byte mismatch: ${candidate.candidateId}`,
    );
  }

  return bytes;
}

async function installCandidateAsset(
  page: Page,
  candidate: CandidateRecord,
) {
  const bytes = candidateBytes(
    candidate,
  );

  let count = 0;

  await page.route(
    activeBearLiteUrl,
    async route => {
      count += 1;

      await route.fulfill({
        status: 200,
        headers: {
          "Access-Control-Allow-Origin":
            "http://127.0.0.1:4173",
          "Cache-Control":
            "no-store",
          "Content-Type":
            "model/gltf-binary",
          "X-SK7-Candidate-Review":
            candidate.candidateId,
        },
        body: bytes,
      });
    },
  );

  return () => count;
}

async function installSyntheticApi(
  page: Page,
) {
  await page.route(
    "http://e2e.invalid/**",
    async route => {
      const request =
        route.request();

      const url = new URL(
        request.url(),
      );

      const headers = {
        "Access-Control-Allow-Origin":
          "http://127.0.0.1:4173",
        "Access-Control-Allow-Headers":
          "authorization,content-type",
        "Access-Control-Allow-Methods":
          "GET,POST,PUT,DELETE,OPTIONS",
      };

      if (
        request.method()
        === "OPTIONS"
      ) {
        await route.fulfill({
          status: 204,
          headers,
        });

        return;
      }

      if (
        url.pathname
        === "/api/v1/observations/window"
      ) {
        const endOn =
          url.searchParams.get(
            "end_on",
          )
          ?? "2026-09-11";

        await route.fulfill({
          status: 200,
          headers,
          contentType:
            "application/json",
          body: JSON.stringify({
            start_on:
              url.searchParams.get(
                "start_on",
              ),
            end_on:
              endOn,
            blood_pressure_observations: [
              {
                id:
                  "candidate-integration-existing",
                observed_on:
                  endOn,
                period:
                  "morning",
                systolic:
                  118,
                diastolic:
                  76,
              },
            ],
            challenge_events: [],
            active_challenge: {
              id:
                "candidate-integration-challenge",
              action_id:
                "walk-10-minutes",
              starts_on:
                endOn,
              ends_on:
                endOn,
            },
            challenge_checkins: [
              {
                id:
                  "candidate-integration-checkin",
                challenge_id:
                  "candidate-integration-challenge",
                observed_on:
                  endOn,
                action_id:
                  "walk-10-minutes",
                status:
                  "completed",
              },
            ],
          }),
        });

        return;
      }

      await route.abort();
    },
  );
}

async function readRenderer(
  page: Page,
  selector: string,
) {
  return page
    .locator(selector)
    .evaluate(
      (canvas: HTMLCanvasElement) => {
        const gl =
          canvas.getContext(
            "webgl2",
          )
          ?? canvas.getContext(
            "webgl",
          );

        if (!gl) {
          return null;
        }

        const extension =
          gl.getExtension(
            "WEBGL_debug_renderer_info",
          );

        const key =
          extension
            ? extension
                .UNMASKED_RENDERER_WEBGL
            : gl.RENDERER;

        return String(
          gl.getParameter(key),
        );
      },
    );
}

async function pageOverflow(
  page: Page,
) {
  return page.evaluate(
    () =>
      document
        .documentElement
        .scrollWidth
      > document
        .documentElement
        .clientWidth,
  );
}

async function subjectBounds(
  page: Page,
) {
  const locator = page.locator(
    "[data-subject-bounds]",
  );

  if (
    await locator.count()
    !== 1
  ) {
    return null;
  }

  const raw =
    await locator.getAttribute(
      "data-subject-bounds",
    );

  if (!raw) {
    return null;
  }

  const value = JSON.parse(
    raw,
  ) as {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width?: number;
    height?: number;
  };

  expect(
    value.left,
  ).toBeGreaterThanOrEqual(
    -1,
  );

  expect(
    value.right,
  ).toBeLessThanOrEqual(
    1,
  );

  expect(
    value.bottom,
  ).toBeGreaterThanOrEqual(
    -1,
  );

  expect(
    value.top,
  ).toBeLessThanOrEqual(
    1,
  );

  return value;
}

async function setSavedBear(
  page: Page,
) {
  await page.addInitScript(
    () => {
      localStorage.setItem(
        "sk7-companion-species",
        "bear",
      );
    },
  );
}

async function expectInside(
  outer:
    | ReturnType<Page["locator"]>,
  inner:
    | ReturnType<Page["locator"]>,
) {
  const [
    outerBox,
    innerBox,
  ] = await Promise.all([
    outer.boundingBox(),
    inner.boundingBox(),
  ]);

  expect(
    outerBox,
  ).not.toBeNull();

  expect(
    innerBox,
  ).not.toBeNull();

  expect(
    innerBox!.x,
  ).toBeGreaterThanOrEqual(
    outerBox!.x - 1,
  );

  expect(
    innerBox!.x
    + innerBox!.width,
  ).toBeLessThanOrEqual(
    outerBox!.x
    + outerBox!.width
    + 1,
  );

  expect(
    innerBox!.y,
  ).toBeGreaterThanOrEqual(
    outerBox!.y - 1,
  );

  expect(
    innerBox!.y
    + innerBox!.height,
  ).toBeLessThanOrEqual(
    outerBox!.y
    + outerBox!.height
    + 1,
  );
}

async function runCase(
  page: Page,
  testInfo: TestInfo,
  candidate: CandidateRecord,
  screen: ScreenId,
  viewport:
    (typeof viewports)[number],
) {
  const started =
    Date.now();

  const pageErrors: string[] = [];

  page.on(
    "pageerror",
    error => {
      pageErrors.push(
        error.message,
      );
    },
  );

  const companionRequests:
    string[] = [];

  page.on(
    "request",
    request => {
      if (
        /sk7-companion\.gkrry\.com\/companion\/v1\/.+\.glb(?:\?|$)/i
          .test(
            request.url(),
          )
      ) {
        companionRequests.push(
          request.url(),
        );
      }
    },
  );

  const requestCount =
    await installCandidateAsset(
      page,
      candidate,
    );

  await page.setViewportSize(
    viewport,
  );

  await page.clock.setFixedTime(
    new Date(
      "2026-09-11T03:00:00Z",
    ),
  );

  await setSavedBear(
    page,
  );

  let renderer:
    string | null = null;

  let bounds:
    unknown = null;

  try {
    if (
      screen === "S01"
    ) {
      await page.goto("/");

      const narrator =
        page.locator(
          "[data-login-companion]",
        );

      const character =
        narrator.locator(
          ".login-companion-character",
        );

      const slot =
        narrator.locator(
          ".companion-runtime-slot",
        );

      const runtime =
        narrator.locator(
          "[data-companion-status]",
        );

      const canvas =
        narrator.locator(
          "[data-companion-canvas]",
        );

      await expect(
        narrator,
      ).toHaveAttribute(
        "data-login-companion-species",
        "bear",
      );

      await expect(
        runtime,
      ).toHaveAttribute(
        "data-companion-status",
        "ready",
        {
          timeout: 30_000,
        },
      );

      await expect(
        runtime,
      ).toHaveAttribute(
        "data-companion-framing",
        "login-narrator",
      );

      await expect(
        runtime,
      ).toHaveAttribute(
        "data-companion-interaction-enabled",
        "false",
      );

      await expect(
        canvas,
      ).toHaveCount(1);

      await expectInside(
        character,
        slot,
      );

      renderer =
        await readRenderer(
          page,
          "[data-login-companion] [data-companion-canvas]",
        );

      await narrator.screenshot({
        path:
          testInfo.outputPath(
            "candidate-screen.png",
          ),
      });
    } else {
      await installSyntheticApi(
        page,
      );

      await page.goto(
        `/?e2e=signed-in&screen=${screen}`,
      );

      const stage =
        page.locator(
          `.living-visual-stage[data-living-scene="${screen}"]`,
        );

      await stage
        .scrollIntoViewIfNeeded();

      const runtime =
        page.locator(
          "[data-living-scene-status]",
        );

      const canvas =
        page.locator(
          ".living-three-scene canvas",
        );

      await expect(
        runtime,
      ).toHaveAttribute(
        "data-living-scene-status",
        "ready",
        {
          timeout: 30_000,
        },
      );

      await expect(
        canvas,
      ).toHaveCount(1);

      await expect(
        page.locator(
          "[data-companion-status]",
        ),
      ).toHaveCount(0);

      await expectInside(
        stage,
        canvas,
      );

      bounds =
        await subjectBounds(
          page,
        );

      expect(
        bounds,
      ).not.toBeNull();

      if (
        screen === "S10"
      ) {
        await expect(
          page.locator(
            ".living-three-scene",
          ),
        ).toHaveAttribute(
          "data-companion-look-enabled",
          "true",
        );
      }

      renderer =
        await readRenderer(
          page,
          ".living-three-scene canvas",
        );

      await stage.screenshot({
        path:
          testInfo.outputPath(
            "candidate-screen.png",
          ),
      });
    }

    expect(
      await pageOverflow(
        page,
      ),
    ).toBe(false);

    expect(
      pageErrors,
    ).toEqual([]);

    expect(
      requestCount(),
    ).toBe(1);

    expect(
      companionRequests,
    ).toEqual([
      activeBearLiteUrl,
    ]);

    const record:
      CaseRecord = {
        status:
          "passed",
        species:
          candidate.speciesKey,
        candidateId:
          candidate.candidateId,
        candidateSha256:
          candidate.sha256,
        screen,
        viewport,
        activeRequestUrl:
          activeBearLiteUrl,
        activeRequestCount:
          requestCount(),
        renderer,
        layoutOverflow:
          false,
        subjectBounds:
          bounds,
        durationMs:
          Date.now() - started,
      };

    records.push(
      record,
    );

    writeProgress();

    await testInfo.attach(
      "candidate-screen-case",
      {
        body:
          JSON.stringify(
            record,
            null,
            2,
          ),
        contentType:
          "application/json",
      },
    );
  } catch (error) {
    const record:
      CaseRecord = {
        status:
          "failed",
        species:
          candidate.speciesKey,
        candidateId:
          candidate.candidateId,
        candidateSha256:
          candidate.sha256,
        screen,
        viewport,
        activeRequestUrl:
          activeBearLiteUrl,
        activeRequestCount:
          requestCount(),
        renderer,
        layoutOverflow:
          await pageOverflow(
            page,
          ).catch(
            () => false,
          ),
        subjectBounds:
          bounds,
        durationMs:
          Date.now() - started,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      };

    records.push(
      record,
    );

    writeProgress();

    throw error;
  }
}

test.afterAll(
  async () => {
    const expectedCases =
      liteCandidates.length
      * screens.length
      * viewports.length;

    const passed =
      records.filter(
        record =>
          record.status
          === "passed",
      ).length;

    const failed =
      records.filter(
        record =>
          record.status
          === "failed",
      ).length;

    const summary = {
      documentType:
        "COMPANION_CANDIDATE_SK7_SCREEN_INTEGRATION",
      status:
        records.length
          === expectedCases
          && failed === 0
          ? "passed"
          : "failed-or-incomplete",
      scope:
        "local-production-path-with-candidate-response-substitution",
      family:
        "world-v2",
      expectedCases,
      completedCases:
        records.length,
      passedCases:
        passed,
      failedCases:
        failed,
      species:
        liteCandidates.map(
          candidate =>
            candidate.speciesKey,
        ),
      screens,
      viewports,
      candidateVariant:
        "lite",
      runtimeSelectionIdentity:
        "bear-lite-active-contract",
      candidateSubstitutionOnly:
        true,
      activeRegistryModified:
        false,
      activeManifestModified:
        false,
      runtimeUrlModified:
        false,
      r2Modified:
        false,
      productionReady:
        false,
      records,
    };

    writeFileSync(
      finalFile,
      JSON.stringify(
        summary,
        null,
        2,
      ) + "\n",
    );
  },
);

for (
  const candidate
  of liteCandidates
) {
  for (
    const screen
    of screens
  ) {
    for (
      const viewport
      of viewports
    ) {
      test(
        `${candidate.speciesKey} ${screen} ${viewport.width}x${viewport.height}`,
        async ({
          page,
        }, testInfo) => {
          await runCase(
            page,
            testInfo,
            candidate,
            screen,
            viewport,
          );
        },
      );
    }
  }
}
