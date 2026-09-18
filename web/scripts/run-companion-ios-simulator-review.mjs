import assert from "node:assert/strict";
import {
  createHash,
  randomBytes,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import path from "node:path";
import {
  spawn,
  spawnSync,
} from "node:child_process";
import {
  fileURLToPath,
} from "node:url";

import {
  loadCandidateFiles,
  reviewCases,
} from "./companion-candidate-device-review-lib.mjs";

import {
  qualifiesSimulatorSnapshot,
  selectBootedIPhone,
  simulatorCaseUrl,
} from "./companion-ios-simulator-review-lib.mjs";

const root =
  fileURLToPath(
    new URL(
      "../../",
      import.meta.url,
    ),
  );

const web =
  path.join(
    root,
    "web",
  );

const developerDir =
  process.env.DEVELOPER_DIR
  || "/Applications/Xcode.app/Contents/Developer";

process.env.DEVELOPER_DIR =
  developerDir;

const args =
  process.argv.slice(2);

function arg(
  name,
  fallback,
) {
  const index =
    args.indexOf(name);

  return index >= 0
    ? args[index + 1]
    : fallback;
}

function inside(
  child,
  parent,
) {
  const relative =
    path.relative(
      parent,
      child,
    );

  return (
    relative === ""
    || (
      !relative.startsWith("..")
      && !path.isAbsolute(
        relative,
      )
    )
  );
}

function run(
  executable,
  values,
) {
  const result =
    spawnSync(
      executable,
      values,
      {
        encoding:
          "utf8",
        env: {
          ...process.env,
          DEVELOPER_DIR:
            developerDir,
        },
      },
    );

  if (
    result.status !== 0
  ) {
    throw new Error(
      [
        executable,
        ...values,
        result.stdout ?? "",
        result.stderr ?? "",
      ].join("\n"),
    );
  }

  return (
    result.stdout
    ?? ""
  ).trim();
}

function sleep(
  milliseconds,
) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        milliseconds,
      ),
  );
}

async function portOpen(
  port,
) {
  return await new Promise(
    resolve => {
      const socket =
        net.createConnection({
          host:
            "127.0.0.1",
          port,
        });

      const finish =
        value => {
          socket.removeAllListeners();
          socket.destroy();
          resolve(value);
        };

      socket.setTimeout(
        300,
      );

      socket.once(
        "connect",
        () =>
          finish(true),
      );

      socket.once(
        "timeout",
        () =>
          finish(false),
      );

      socket.once(
        "error",
        () =>
          finish(false),
      );
    },
  );
}

async function waitPort(
  port,
  timeoutMs = 20_000,
) {
  const deadline =
    Date.now()
    + timeoutMs;

  while (
    Date.now()
    < deadline
  ) {
    if (
      await portOpen(
        port,
      )
    ) {
      return;
    }

    await sleep(
      150,
    );
  }

  throw new Error(
    `port ${port} did not open`,
  );
}

async function stopChild(
  child,
) {
  if (
    !child
    || child.exitCode !== null
  ) {
    return;
  }

  child.kill(
    "SIGTERM",
  );

  await Promise.race([
    new Promise(
      resolve =>
        child.once(
          "exit",
          resolve,
        ),
    ),
    sleep(
      1200,
    ),
  ]);

  if (
    child.exitCode === null
  ) {
    child.kill(
      "SIGKILL",
    );
  }
}

async function webdriver(
  base,
  method,
  route,
  body,
) {
  const response =
    await fetch(
      base + route,
      {
        method,
        headers:
          body === undefined
            ? undefined
            : {
                "Content-Type":
                  "application/json",
              },
        body:
          body === undefined
            ? undefined
            : JSON.stringify(
                body,
              ),
        signal:
          AbortSignal.timeout(
            90_000,
          ),
      },
    );

  const raw =
    await response.text();

  let payload;

  try {
    payload =
      JSON.parse(raw);
  } catch {
    throw new Error(
      `Non-JSON WebDriver response: ${raw}`,
    );
  }

  if (
    !response.ok
    || payload?.value?.error
  ) {
    throw new Error(
      `WebDriver ${method} ${route}: `
      + JSON.stringify(
        payload,
      ),
    );
  }

  return payload.value;
}

const SNAPSHOT = `
const screen =
  new URL(location.href)
    .searchParams
    .get("screen")
  || "S01";

const target =
  screen === "S01"
    ? document.querySelector(
        "[data-login-companion]"
      )
    : document.querySelector(
        ".living-visual-stage[data-living-scene='"
        + screen
        + "']"
      );

if (target) {
  target.scrollIntoView({
    block: "center",
    inline: "nearest",
    behavior: "auto"
  });
}

const canvas =
  screen === "S01"
    ? document.querySelector(
        "[data-login-companion] canvas[data-companion-canvas]"
      )
    : document.querySelector(
        ".living-three-scene canvas"
      );

const intersects =
  element => {
    if (!element) {
      return false;
    }

    const rect =
      element.getBoundingClientRect();

    return (
      rect.width > 1
      && rect.height > 1
      && rect.right > 0
      && rect.bottom > 0
      && rect.left < innerWidth
      && rect.top < innerHeight
    );
  };

const ready =
  screen === "S01"
    ? document.querySelector(
        "[data-login-companion] [data-companion-status]"
      )?.getAttribute(
        "data-companion-status"
      ) === "ready"
    : document.querySelector(
        "[data-living-scene-status]"
      )?.getAttribute(
        "data-living-scene-status"
      ) === "ready";

let canvasVisible =
  false;

if (canvas) {
  const style =
    getComputedStyle(
      canvas
    );

  canvasVisible =
    style.display !== "none"
    && style.visibility !== "hidden"
    && Number(
      style.opacity || "1"
    ) > 0
    && intersects(
      canvas
    );
}

let subjectVisible =
  false;

let subjectBounds =
  null;

if (screen === "S01") {
  subjectVisible =
    canvasVisible
    && intersects(
      document.querySelector(
        "[data-login-companion] .companion-runtime-slot"
      )
    );
} else {
  const scene =
    document.querySelector(
      ".living-three-scene[data-subject-bounds]"
    );

  const raw =
    scene?.getAttribute(
      "data-subject-bounds"
    );

  if (raw) {
    try {
      subjectBounds =
        JSON.parse(raw);

      const width =
        Number(
          subjectBounds.right
        )
        - Number(
          subjectBounds.left
        );

      const height =
        Number(
          subjectBounds.top
        )
        - Number(
          subjectBounds.bottom
        );

      subjectVisible =
        Number(
          subjectBounds.right
        ) > -1
        && Number(
          subjectBounds.left
        ) < 1
        && Number(
          subjectBounds.top
        ) > -1
        && Number(
          subjectBounds.bottom
        ) < 1
        && width > 0.05
        && height > 0.05;
    } catch {
      subjectVisible =
        false;
    }
  }
}

let renderer =
  null;

if (canvas) {
  const gl =
    canvas.getContext(
      "webgl2"
    )
    || canvas.getContext(
      "webgl"
    );

  if (gl) {
    const debug =
      gl.getExtension(
        "WEBGL_debug_renderer_info"
      );

    const key =
      debug
        ? debug.UNMASKED_RENDERER_WEBGL
        : gl.RENDERER;

    renderer =
      String(
        gl.getParameter(
          key
        )
      );
  }
}

return {
  screen,
  candidate:
    window
      .__SK7_PHYSICAL_REVIEW__
      ?.candidate
    ?? null,
  ready,
  activeRequestCount:
    window
      .__SK7_PHYSICAL_REVIEW__
      ?.activeRequestCount
    ?? 0,
  layoutOverflow:
    document
      .documentElement
      .scrollWidth
    > innerWidth,
  canvasVisible,
  targetInViewport:
    intersects(
      target
    ),
  subjectVisible,
  subjectBounds,
  s10LookEnabled:
    screen !== "S10"
    || document
      .querySelector(
        ".living-three-scene"
      )
      ?.getAttribute(
        "data-companion-look-enabled"
      ) === "true",
  viewportWidth:
    innerWidth,
  viewportHeight:
    innerHeight,
  devicePixelRatio:
    devicePixelRatio || 1,
  renderer,
  userAgent:
    navigator.userAgent
};
`;

async function waitQualified(
  driverBase,
  sessionId,
) {
  const deadline =
    Date.now()
    + 40_000;

  let latest =
    null;

  while (
    Date.now()
    < deadline
  ) {
    latest =
      await webdriver(
        driverBase,
        "POST",
        `/session/${sessionId}/execute/sync`,
        {
          script:
            SNAPSHOT,
          args:
            [],
        },
      );

    if (
      qualifiesSimulatorSnapshot(
        latest,
      )
    ) {
      return latest;
    }

    await sleep(
      300,
    );
  }

  throw new Error(
    "Simulator case did not qualify: "
    + JSON.stringify(
        latest,
      ),
  );
}

function sha256(
  bytes,
) {
  return createHash(
    "sha256",
  )
    .update(
      bytes,
    )
    .digest(
      "hex",
    );
}

const candidateRoot =
  path.resolve(
    arg(
      "--candidate-root",
      "",
    ),
  );

const output =
  path.resolve(
    arg(
      "--output",
      "",
    ),
  );

const serverPort =
  Number(
    arg(
      "--server-port",
      "4176",
    ),
  );

const driverPort =
  Number(
    arg(
      "--driver-port",
      "4444",
    ),
  );

assert(
  existsSync(
    candidateRoot,
  ),
  "candidate root is missing",
);

assert(
  !existsSync(
    output,
  ),
  "use a new output directory",
);

assert(
  !inside(
    output,
    root,
  ),
  "output must stay outside repository",
);

assert.equal(
  await portOpen(
    serverPort,
  ),
  false,
  `port ${serverPort} is occupied`,
);

assert.equal(
  await portOpen(
    driverPort,
  ),
  false,
  `port ${driverPort} is occupied`,
);

const candidates =
  loadCandidateFiles(
    candidateRoot,
  );

mkdirSync(
  output,
  {
    recursive:
      false,
  },
);

const build =
  path.join(
    output,
    "build",
  );

const serverEvidence =
  path.join(
    output,
    "server-evidence",
  );

const screenshots =
  path.join(
    output,
    "screenshots",
  );

mkdirSync(
  serverEvidence,
);

mkdirSync(
  screenshots,
);

const xcodeVersion =
  run(
    "/usr/bin/xcodebuild",
    [
      "-version",
    ],
  );

const safariDriverVersion =
  run(
    "/usr/bin/safaridriver",
    [
      "--version",
    ],
  );

const simctl =
  JSON.parse(
    run(
      "/usr/bin/xcrun",
      [
        "simctl",
        "list",
        "devices",
        "booted",
        "-j",
      ],
    ),
  );

const simulator =
  selectBootedIPhone(
    simctl,
  );

run(
  "/usr/bin/xcrun",
  [
    "simctl",
    "bootstatus",
    simulator.udid,
    "-b",
  ],
);

const buildRun =
  spawnSync(
    "npm",
    [
      "run",
      "build",
      "--",
      "--outDir",
      build,
    ],
    {
      cwd:
        web,
      stdio:
        "inherit",
      env: {
        ...process.env,
        DEVELOPER_DIR:
          developerDir,
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
    },
  );

assert.equal(
  buildRun.status,
  0,
  "iOS Simulator review build failed",
);

const token =
  randomBytes(24)
    .toString(
      "hex",
    );

let localServer =
  null;

let driver =
  null;

let sessionId =
  null;

try {
  localServer =
    spawn(
      process.execPath,
      [
        path.join(
          web,
          "scripts",
          "serve-companion-candidate-device-review.mjs",
        ),
        "--build",
        build,
        "--candidate-root",
        candidateRoot,
        "--evidence",
        serverEvidence,
        "--token",
        token,
        "--port",
        String(
          serverPort,
        ),
      ],
      {
        cwd:
          web,
        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
        env: {
          ...process.env,
          DEVELOPER_DIR:
            developerDir,
        },
      },
    );

  localServer.stdout.pipe(
    process.stdout,
  );

  localServer.stderr.pipe(
    process.stderr,
  );

  await waitPort(
    serverPort,
  );

  driver =
    spawn(
      "/usr/bin/safaridriver",
      [
        "--port",
        String(
          driverPort,
        ),
      ],
      {
        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
        env: {
          ...process.env,
          DEVELOPER_DIR:
            developerDir,
        },
      },
    );

  driver.stdout.pipe(
    process.stdout,
  );

  driver.stderr.pipe(
    process.stderr,
  );

  await waitPort(
    driverPort,
  );

  const driverBase =
    `http://127.0.0.1:${driverPort}`;

  const session =
    await webdriver(
      driverBase,
      "POST",
      "/session",
      {
        capabilities: {
          alwaysMatch: {
            browserName:
              "safari",
            platformName:
              "ios",
            "safari:useSimulator":
              true,
            "safari:deviceType":
              "iPhone",
            "safari:deviceUDID":
              simulator.udid,
          },
        },
      },
    );

  sessionId =
    session.sessionId;

  assert(
    sessionId,
    "SafariDriver session ID missing",
  );

  console.log("");
  console.log(
    `Simulator: ${simulator.name}`,
  );
  console.log(
    `Runtime: ${simulator.runtime}`,
  );
  console.log(
    `Safari: ${session.capabilities?.browserVersion ?? "unreported"}`,
  );
  console.log("");

  const baseUrl =
    `http://127.0.0.1:${serverPort}`;

  const records =
    [];

  for (
    const item
    of reviewCases()
  ) {
    const url =
      simulatorCaseUrl({
        base:
          baseUrl,
        token,
        candidate:
          item.candidate,
        screen:
          item.screen,
      });

    await webdriver(
      driverBase,
      "POST",
      `/session/${sessionId}/url`,
      {
        url,
      },
    );

    const snapshot =
      await waitQualified(
        driverBase,
        sessionId,
      );

    assert.equal(
      snapshot.candidate,
      item.candidate,
    );

    assert.equal(
      snapshot.screen,
      item.screen,
    );

    const screenshot64 =
      await webdriver(
        driverBase,
        "GET",
        `/session/${sessionId}/screenshot`,
      );

    const screenshotBytes =
      Buffer.from(
        screenshot64,
        "base64",
      );

    const screenshotName =
      `${item.candidate}-${item.screen}.png`;

    writeFileSync(
      path.join(
        screenshots,
        screenshotName,
      ),
      screenshotBytes,
    );

    const candidate =
      candidates.get(
        item.candidate,
      );

    records.push({
      candidate:
        item.candidate,
      candidateId:
        candidate.candidateId,
      candidateSha256:
        candidate.sha256,
      screen:
        item.screen,
      viewportWidth:
        snapshot.viewportWidth,
      viewportHeight:
        snapshot.viewportHeight,
      devicePixelRatio:
        snapshot.devicePixelRatio,
      rendererReady:
        snapshot.ready,
      activeRequestCount:
        snapshot.activeRequestCount,
      layoutOverflow:
        snapshot.layoutOverflow,
      canvasVisible:
        snapshot.canvasVisible,
      targetInViewport:
        snapshot.targetInViewport,
      subjectVisible:
        snapshot.subjectVisible,
      subjectBounds:
        snapshot.subjectBounds,
      s10LookEnabled:
        snapshot.s10LookEnabled,
      renderer:
        snapshot.renderer,
      userAgent:
        snapshot.userAgent,
      screenshot:
        screenshotName,
      screenshotBytes:
        screenshotBytes.length,
      screenshotSha256:
        sha256(
          screenshotBytes,
        ),
      status:
        "passed",
    });

    console.log(
      `PASS ${item.candidate} ${item.screen}`,
    );
  }

  assert.equal(
    records.length,
    12,
  );

  const result = {
    documentType:
      "COMPANION_WORLD_V2_IOS_SIMULATOR_QUALIFICATION",
    status:
      "passed",
    scope:
      "automated-ios-simulator-safari-webdriver",
    physicalDevice:
      false,
    physicalIPhoneQualified:
      false,
    simulatorQualified:
      true,
    expectedCases:
      12,
    passedCases:
      12,
    failedCases:
      0,
    species: [
      "koala",
      "mouse",
      "pig",
      "owl",
    ],
    screens: [
      "S01",
      "S02",
      "S10",
    ],
    candidateVariant:
      "lite",
    environment: {
      simulatorName:
        simulator.name,
      simulatorRuntime:
        simulator.runtime,
      xcodeVersion,
      safariDriverVersion,
      browserName:
        session.capabilities?.browserName
        ?? "Safari",
      browserVersion:
        session.capabilities?.browserVersion
        ?? null,
      platformName:
        session.capabilities?.platformName
        ?? "iOS",
      platformVersion:
        session.capabilities?.[
          "safari:platformVersion"
        ]
        ?? null,
    },
    records,
    productionActivationApproved:
      false,
    productionReady:
      false,
  };

  writeFileSync(
    path.join(
      output,
      "ios-simulator-qualification.json",
    ),
    JSON.stringify(
      result,
      null,
      2,
    )
    + "\n",
  );

  console.log("");
  console.log(
    "IOS SIMULATOR SAFARI: 12 / 12 PASS",
  );
} finally {
  if (
    sessionId
  ) {
    try {
      await webdriver(
        `http://127.0.0.1:${driverPort}`,
        "DELETE",
        `/session/${sessionId}`,
      );
    } catch {
    }
  }

  await stopChild(
    driver,
  );

  await stopChild(
    localServer,
  );
}
