import assert from "node:assert/strict";
import test from "node:test";

import {
  qualifiesSimulatorSnapshot,
  selectBootedIPhone,
  simulatorCaseUrl,
} from "./companion-ios-simulator-review-lib.mjs";

test(
  "selects the booted iPhone",
  () => {
    const selected =
      selectBootedIPhone({
        devices: {
          "com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
            {
              name:
                "iPhone 17",
              udid:
                "BOOTED",
              state:
                "Booted",
              isAvailable:
                true,
            },
          ],
        },
      });

    assert.equal(
      selected.udid,
      "BOOTED",
    );
  },
);

test(
  "S10 requires visible subject and look controller",
  () => {
    assert.equal(
      qualifiesSimulatorSnapshot({
        screen:
          "S10",
        ready:
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
        s10LookEnabled:
          true,
      }),
      true,
    );

    assert.equal(
      qualifiesSimulatorSnapshot({
        screen:
          "S10",
        ready:
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
          false,
        s10LookEnabled:
          true,
      }),
      false,
    );
  },
);

test(
  "S02 and S10 use synthetic signed-in session",
  () => {
    const url =
      new URL(
        simulatorCaseUrl({
          base:
            "http://127.0.0.1:4176",
          token:
            "fixture-token",
          candidate:
            "owl",
          screen:
            "S10",
        }),
      );

    assert.equal(
      url.searchParams.get("candidate"),
      "owl",
    );

    assert.equal(
      url.searchParams.get("e2e"),
      "signed-in",
    );
  },
);
