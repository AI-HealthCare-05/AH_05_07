import path from "node:path";

import {
  defineConfig,
} from "@playwright/test";

const assetRoot =
  process.env.SK7_CANDIDATE_REVIEW_ROOT;

const outputRoot =
  process.env.SK7_CANDIDATE_SCREEN_OUTPUT;

if (!assetRoot) {
  throw new Error(
    "SK7_CANDIDATE_REVIEW_ROOT is required",
  );
}

if (!outputRoot) {
  throw new Error(
    "SK7_CANDIDATE_SCREEN_OUTPUT is required",
  );
}

const useSoftwareWebGL =
  Boolean(
    process.env.CI
    || process.env.GITHUB_ACTIONS,
  );

const buildRoot =
  path.join(
    outputRoot,
    "candidate-screen-build",
  );

const quotedBuildRoot =
  JSON.stringify(
    buildRoot,
  );

export default defineConfig({
  testDir:
    "./e2e",

  testMatch:
    "companion-candidate-screen-integration.spec.ts",

  workers:
    1,

  fullyParallel:
    false,

  outputDir:
    path.join(
      outputRoot,
      "playwright",
    ),

  reporter: [
    [
      "list",
    ],
    [
      "json",
      {
        outputFile:
          path.join(
            outputRoot,
            "playwright-results.json",
          ),
      },
    ],
  ],

  use: {
    baseURL:
      "http://127.0.0.1:4173",

    screenshot:
      "off",

    trace:
      "off",

    launchOptions: {
      args:
        useSoftwareWebGL
          ? [
              "--use-gl=angle",
              "--use-angle=swiftshader",
              "--enable-unsafe-swiftshader",
            ]
          : [],
    },
  },

  webServer: {
    command:
      `npm run build -- --outDir ${quotedBuildRoot}`
      + ` && npm run preview -- --outDir ${quotedBuildRoot}`
      + " --host 127.0.0.1 --port 4173 --strictPort",

    env: {
      VITE_API_BASE_URL:
        "http://e2e.invalid",

      VITE_SUPABASE_URL:
        "https://e2e.invalid",

      VITE_SUPABASE_PUBLISHABLE_KEY:
        "e2e-test-publishable-key",

      VITE_SK7_E2E_MODE:
        "1",

      VITE_SK7_UI_MODE:
        "journey",

      VITE_SK7_SCENE_MODE:
        "production",

      VITE_SK7_COMPANION_MODE:
        "production",

      VITE_SK7_EVIDENCE_MODE:
        "",

      VITE_SK7_EVIDENCE_FIXTURE:
        "",
    },

    port:
      4173,

    reuseExistingServer:
      false,
  },
});
