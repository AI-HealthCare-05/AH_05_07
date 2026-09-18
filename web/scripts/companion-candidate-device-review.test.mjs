import assert from "node:assert/strict";
import test from "node:test";

import {
  reviewCases,
  summarizeEvents,
  validateEvent,
} from "./companion-candidate-device-review-lib.mjs";

function event(
  candidate,
  screen,
  decision = "pass",
) {
  return {
    documentType:
      "COMPANION_WORLD_V2_PHYSICAL_DEVICE_EVENT",
    deviceClass:
      "android",
    candidate,
    screen,
    decision,
    viewportWidth:
      390,
    viewportHeight:
      844,
    devicePixelRatio:
      3,
    rendererReady:
      true,
    activeRequestCount:
      1,
    layoutOverflow:
      false,
    canvasVisible:
      true,
    targetInViewport:
      true,
    subjectVisible:
      true,
    humanVisibleConfirmed:
      true,
    renderer:
      "fixture",
    frameSample:
      null,
    productionActivationApproved:
      false,
  };
}

test(
  "matrix contains 12 physical-device cases",
  () => {
    assert.equal(
      reviewCases().length,
      12,
    );
  },
);

test(
  "12 passing cases qualify one device class",
  () => {
    const events =
      reviewCases().map(
        item =>
          event(
            item.candidate,
            item.screen,
          ),
      );

    assert.deepEqual(
      summarizeEvents(
        events,
        "android",
      ),
      {
        deviceClass:
          "android",
        expectedCases:
          12,
        completedCases:
          12,
        passedCases:
          12,
        failedCases:
          0,
        complete:
          true,
        qualified:
          true,
      },
    );
  },
);

test(
  "one failure prevents qualification",
  () => {
    const events =
      reviewCases().map(
        (item, index) =>
          event(
            item.candidate,
            item.screen,
            index === 0
              ? "fail"
              : "pass",
          ),
      );

    const result =
      summarizeEvents(
        events,
        "android",
      );

    assert.equal(
      result.complete,
      true,
    );

    assert.equal(
      result.qualified,
      false,
    );

    assert.equal(
      result.failedCases,
      1,
    );
  },
);

test(
  "pass requires explicit human visible confirmation",
  () => {
    const broken = {
      ...event(
        "owl",
        "S10",
      ),
      humanVisibleConfirmed:
        false,
    };

    assert.throws(
      () =>
        validateEvent(
          broken,
        ),
    );
  },
);

test(
  "pass requires visible candidate subject",
  () => {
    const broken = {
      ...event(
        "owl",
        "S10",
      ),
      subjectVisible:
        false,
    };

    assert.throws(
      () =>
        validateEvent(
          broken,
        ),
    );
  },
);

test(
  "pass requires ready renderer and no overflow",
  () => {
    const broken = {
      ...event(
        "koala",
        "S01",
      ),
      layoutOverflow:
        true,
    };

    assert.throws(
      () =>
        validateEvent(
          broken,
        ),
    );
  },
);
