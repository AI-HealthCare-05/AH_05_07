import assert from "node:assert/strict";
import {
  randomBytes,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import {
  spawnSync,
} from "node:child_process";
import {
  fileURLToPath,
} from "node:url";

import {
  deviceClasses,
  loadCandidateFiles,
} from "./companion-candidate-device-review-lib.mjs";

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
  value,
  parent,
) {
  const relative =
    path.relative(
      parent,
      value,
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

async function occupied(
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
        500,
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
        error => {
          if (
            error.code
            === "ECONNREFUSED"
          ) {
            finish(false);

            return;
          }

          throw error;
        },
      );
    },
  );
}

function lanAddresses() {
  const values = [];

  for (
    const entries
    of Object.values(
      os.networkInterfaces(),
    )
  ) {
    for (
      const entry
      of entries ?? []
    ) {
      if (
        entry.family === "IPv4"
        && !entry.internal
      ) {
        values.push(
          entry.address,
        );
      }
    }
  }

  return [
    ...new Set(values),
  ];
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

const device =
  arg(
    "--device",
    "",
  );

const port =
  Number(
    arg(
      "--port",
      "4175",
    ),
  );

assert(
  existsSync(
    candidateRoot,
  ),
  "candidate root is missing",
);

assert(
  deviceClasses.includes(
    device,
  ),
  "--device must be android, iphone or ipad",
);

assert(
  !existsSync(output),
  "use a new output directory",
);

assert(
  !inside(
    output,
    root,
  ),
  "device evidence must stay outside repository",
);

if (
  await occupied(
    port,
  )
) {
  console.log(
    JSON.stringify({
      status:
        "deferred-port-occupied",
      port,
      processKilled:
        false,
      alternatePortUsed:
        false,
    }),
  );

  process.exit(2);
}

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

const evidence =
  path.join(
    output,
    "evidence",
  );

mkdirSync(
  evidence,
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
  "device review build failed",
);

const token =
  randomBytes(24)
    .toString("hex");

const addresses =
  lanAddresses();

assert(
  addresses.length > 0,
  "no LAN IPv4 address found",
);

const urls =
  addresses.map(
    address => {
      const url =
        new URL(
          `http://${address}:${port}/`,
        );

      url.searchParams.set(
        "candidate",
        "koala",
      );

      url.searchParams.set(
        "screen",
        "S01",
      );

      url.searchParams.set(
        "device",
        device,
      );

      url.searchParams.set(
        "token",
        token,
      );

      return url.href;
    },
  );

writeFileSync(
  path.join(
    evidence,
    "session.json",
  ),
  JSON.stringify(
    {
      documentType:
        "COMPANION_WORLD_V2_PHYSICAL_DEVICE_SESSION",
      status:
        "started-not-qualified",
      deviceClass:
        device,
      port,
      candidateCount:
        4,
      caseCount:
        12,
      productionActivationApproved:
        false,
    },
    null,
    2,
  ) + "\n",
);

console.log("");
console.log(
  "=== OPEN ONE OF THESE URLs ON THE PHYSICAL DEVICE ===",
);

for (
  const url
  of urls
) {
  console.log(url);
}

console.log("");
console.log(
  "Use the PASS/FAIL controls at the bottom of the phone/tablet screen.",
);

console.log(
  "PASS automatically advances through all 12 World4 × S01/S02/S10 cases.",
);

console.log(
  "The server will close automatically when all 12 cases are recorded.",
);

console.log("");

const server =
  path.join(
    web,
    "scripts",
    "serve-companion-candidate-device-review.mjs",
  );

const execution =
  spawnSync(
    process.execPath,
    [
      server,
      "--build",
      build,
      "--candidate-root",
      candidateRoot,
      "--evidence",
      evidence,
      "--token",
      token,
      "--port",
      String(port),
    ],
    {
      cwd:
        web,
      stdio:
        "inherit",
    },
  );

const summaryFile =
  path.join(
    evidence,
    "physical-device-summary.json",
  );

if (
  !existsSync(
    summaryFile,
  )
) {
  console.error(
    "Physical device review ended without a final summary.",
  );

  process.exitCode =
    execution.status
    ?? 1;
} else {
  const summary =
    JSON.parse(
      readFileSync(
        summaryFile,
        "utf8",
      ),
    );

  console.log("");
  console.log(
    "=== PHYSICAL DEVICE REVIEW COMPLETE ===",
  );

  console.log(
    JSON.stringify(
      summary,
      null,
      2,
    ),
  );

  if (
    execution.status === 0
    && summary.status === "passed"
    && summary.expectedCases === 12
    && summary.completedCases === 12
    && summary.passedCases === 12
    && summary.failedCases === 0
    && summary.qualified === true
  ) {
    console.log("");
    console.log(
      `${device.toUpperCase()} PHYSICAL DEVICE: 12 / 12 PASS`,
    );

    process.exitCode =
      0;
  } else {
    console.error("");
    console.error(
      `${device.toUpperCase()} PHYSICAL DEVICE: NOT QUALIFIED`,
    );

    process.exitCode =
      1;
  }
}
