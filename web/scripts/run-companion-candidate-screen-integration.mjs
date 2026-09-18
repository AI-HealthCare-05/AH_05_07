import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import net from "node:net";
import path from "node:path";
import {
  spawnSync,
} from "node:child_process";
import {
  fileURLToPath,
} from "node:url";

const repo = fileURLToPath(
  new URL(
    "../../",
    import.meta.url,
  ),
);

const web = path.join(
  repo,
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

  return relative === ""
    || (
      !relative.startsWith("..")
      && !path.isAbsolute(
        relative,
      )
    );
}

async function portIsOccupied(
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
        750,
      );

      socket.once(
        "connect",
        () => finish(true),
      );

      socket.once(
        "timeout",
        () => finish(false),
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

const assetArg =
  arg(
    "--assets",
    undefined,
  );

const outputArg =
  arg(
    "--output",
    undefined,
  );

assert(
  assetArg,
  "--assets is required",
);

assert(
  outputArg,
  "--output is required",
);

const assets =
  path.resolve(
    assetArg,
  );

const output =
  path.resolve(
    outputArg,
  );

assert(
  existsSync(assets)
  && statSync(assets).isDirectory(),
  "candidate review asset root is missing",
);

assert(
  !inside(
    assets,
    repo,
  ),
  "candidate review asset root must stay outside repository",
);

assert(
  !existsSync(output),
  "use a new output directory",
);

assert(
  !inside(
    output,
    repo,
  ),
  "screen integration evidence must stay outside repository",
);

assert(
  !inside(
    output,
    assets,
  )
  && !inside(
    assets,
    output,
  ),
  "candidate input and result directories must not overlap",
);

const inputFile =
  path.join(
    assets,
    "candidate-review-input.json",
  );

assert(
  existsSync(inputFile),
  "candidate-review-input.json is missing",
);

const input =
  JSON.parse(
    readFileSync(
      inputFile,
      "utf8",
    ),
  );

assert.equal(
  input.family,
  "world-v2",
);

assert.equal(
  input.speciesCount,
  4,
);

assert.equal(
  input.candidateCount,
  8,
);

assert.equal(
  input.runtimeActivation,
  false,
);

assert.equal(
  input.productionQualified,
  false,
);

const lite =
  input.candidates.filter(
    candidate =>
      candidate.viewerVariant
      === "light",
  );

assert.equal(
  lite.length,
  4,
);

assert.deepEqual(
  new Set(
    lite.map(
      candidate =>
        candidate.speciesKey,
    ),
  ),
  new Set([
    "koala",
    "mouse",
    "pig",
    "owl",
  ]),
);

if (
  await portIsOccupied(
    4173,
  )
) {
  console.log(
    JSON.stringify({
      status:
        "deferred-port-occupied",
      port:
        4173,
      processKilled:
        false,
      alternatePortUsed:
        false,
    }),
  );

  process.exitCode = 2;
} else {
  console.log(
    "PORT_4173=FREE",
  );

  const playwright =
    process.platform
    === "win32"
      ? path.join(
          web,
          "node_modules",
          ".bin",
          "playwright.cmd",
        )
      : path.join(
          web,
          "node_modules",
          ".bin",
          "playwright",
        );

  assert(
    existsSync(playwright),
    "Playwright is not installed in this worktree; run npm --prefix web ci first",
  );

  mkdirSync(
    output,
    {
      recursive:
        false,
    },
  );

  const execution =
    spawnSync(
      playwright,
      [
        "test",
        "--config=playwright.candidate-screen-integration.config.ts",
      ],
      {
        cwd:
          web,

        stdio:
          "inherit",

        env: {
          ...process.env,

          SK7_CANDIDATE_REVIEW_ROOT:
            assets,

          SK7_CANDIDATE_SCREEN_OUTPUT:
            output,
        },
      },
    );

  const summaryFile =
    path.join(
      output,
      "screen-integration.json",
    );

  if (
    execution.status !== 0
  ) {
    console.error(
      JSON.stringify({
        status:
          "browser-run-failed",
        exitCode:
          execution.status,
        evidencePreserved:
          true,
        output,
      }),
    );

    process.exitCode =
      execution.status
      ?? 1;
  } else {
    assert(
      existsSync(
        summaryFile,
      ),
      "screen integration summary was not produced",
    );

    const summary =
      JSON.parse(
        readFileSync(
          summaryFile,
          "utf8",
        ),
      );

    assert.equal(
      summary.status,
      "passed",
    );

    assert.equal(
      summary.expectedCases,
      36,
    );

    assert.equal(
      summary.completedCases,
      36,
    );

    assert.equal(
      summary.passedCases,
      36,
    );

    assert.equal(
      summary.failedCases,
      0,
    );

    assert.equal(
      summary.candidateVariant,
      "lite",
    );

    assert.equal(
      summary.candidateSubstitutionOnly,
      true,
    );

    assert.equal(
      summary.activeRegistryModified,
      false,
    );

    assert.equal(
      summary.activeManifestModified,
      false,
    );

    assert.equal(
      summary.runtimeUrlModified,
      false,
    );

    assert.equal(
      summary.r2Modified,
      false,
    );

    assert.equal(
      summary.productionReady,
      false,
    );

    console.log(
      JSON.stringify({
        status:
          "passed",
        cases:
          summary.passedCases,
        species:
          summary.species.length,
        screens:
          summary.screens.length,
        viewports:
          summary.viewports.length,
        productionReady:
          false,
        output,
      }),
    );
  }
}
