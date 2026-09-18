import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export const species = [
  "koala",
  "mouse",
  "pig",
  "owl",
];

export const screens = [
  "S01",
  "S02",
  "S10",
];

export const deviceClasses = [
  "android",
  "iphone",
  "ipad",
];

export const expectedLite = {
  koala: {
    sha256:
      "9fa34f6339b7699ffeeac48e688dabe349207b7a6c465b4ffda7a53f159b6657",
    bytes: 547288,
  },
  mouse: {
    sha256:
      "efbcd9e0ece9f31088accf16868b885d0af54be7621b392fbdddead38433b0e7",
    bytes: 626692,
  },
  pig: {
    sha256:
      "e228d555af6eed3c986a65dec69c33cd55e638162c322bde3852a9041bd2e76a",
    bytes: 559404,
  },
  owl: {
    sha256:
      "4e4b6e7b2aa6e276da8c63c8d01eedc2fc35835da853b0d918d468d13d886861",
    bytes: 662592,
  },
};

export function sha256(bytes) {
  return createHash("sha256")
    .update(bytes)
    .digest("hex");
}

export function reviewCases() {
  return species.flatMap(candidate =>
    screens.map(screen => ({
      candidate,
      screen,
      key: `${candidate}:${screen}`,
    })),
  );
}

export function loadCandidateFiles(root) {
  const input = JSON.parse(
    readFileSync(
      path.join(
        root,
        "candidate-review-input.json",
      ),
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

  const result = new Map();

  for (const candidate of input.candidates) {
    if (
      candidate.viewerVariant
      !== "light"
    ) {
      continue;
    }

    assert(
      species.includes(
        candidate.speciesKey,
      ),
    );

    const expected =
      expectedLite[
        candidate.speciesKey
      ];

    assert.equal(
      candidate.sha256,
      expected.sha256,
    );

    assert.equal(
      candidate.bytes,
      expected.bytes,
    );

    const file = path.resolve(
      root,
      candidate.reviewFile,
    );

    const relative =
      path.relative(
        root,
        file,
      );

    assert(
      !relative.startsWith("..")
      && !path.isAbsolute(
        relative,
      ),
      "candidate file escaped review root",
    );

    const bytes =
      readFileSync(file);

    assert.equal(
      bytes.byteLength,
      expected.bytes,
    );

    assert.equal(
      sha256(bytes),
      expected.sha256,
    );

    result.set(
      candidate.speciesKey,
      {
        ...candidate,
        file,
        bytes,
      },
    );
  }

  assert.equal(
    result.size,
    4,
  );

  return result;
}

export function validateEvent(
  event,
) {
  assert.equal(
    event.documentType,
    "COMPANION_WORLD_V2_PHYSICAL_DEVICE_EVENT",
  );

  assert(
    deviceClasses.includes(
      event.deviceClass,
    ),
  );

  assert(
    species.includes(
      event.candidate,
    ),
  );

  assert(
    screens.includes(
      event.screen,
    ),
  );

  assert(
    [
      "pass",
      "fail",
    ].includes(
      event.decision,
    ),
  );

  assert(
    Number.isFinite(
      event.viewportWidth,
    )
    && event.viewportWidth > 0,
  );

  assert(
    Number.isFinite(
      event.viewportHeight,
    )
    && event.viewportHeight > 0,
  );

  assert(
    Number.isFinite(
      event.devicePixelRatio,
    )
    && event.devicePixelRatio > 0,
  );

  assert.equal(
    event.activeRequestCount,
    1,
  );

  if (
    event.decision === "pass"
  ) {
    assert.equal(
      event.rendererReady,
      true,
    );

    assert.equal(
      event.layoutOverflow,
      false,
    );
  }

  assert.equal(
    event.productionActivationApproved,
    false,
  );

  return event;
}

export function summarizeEvents(
  events,
  deviceClass,
) {
  assert(
    deviceClasses.includes(
      deviceClass,
    ),
  );

  const latest = new Map();

  for (const raw of events) {
    const event =
      validateEvent(raw);

    if (
      event.deviceClass
      !== deviceClass
    ) {
      continue;
    }

    latest.set(
      `${event.candidate}:${event.screen}`,
      event,
    );
  }

  const cases =
    reviewCases();

  const completed =
    cases.filter(
      item =>
        latest.has(
          item.key,
        ),
    );

  const passed =
    cases.filter(
      item =>
        latest.get(
          item.key,
        )?.decision === "pass",
    );

  return {
    deviceClass,
    expectedCases:
      cases.length,
    completedCases:
      completed.length,
    passedCases:
      passed.length,
    failedCases:
      completed.length
      - passed.length,
    complete:
      completed.length
      === cases.length,
    qualified:
      passed.length
      === cases.length,
  };
}
