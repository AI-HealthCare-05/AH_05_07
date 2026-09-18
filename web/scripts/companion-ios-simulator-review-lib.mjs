import assert from "node:assert/strict";

export function selectBootedIPhone(
  simctl,
) {
  for (
    const [
      runtime,
      devices,
    ]
    of Object.entries(
      simctl.devices ?? {},
    )
  ) {
    if (
      !runtime.includes(
        ".SimRuntime.iOS-",
      )
    ) {
      continue;
    }

    const device =
      devices.find(
        item =>
          item.state === "Booted"
          && item.isAvailable !== false
          && /^iPhone\b/i.test(
            item.name,
          ),
      );

    if (device) {
      return {
        name:
          device.name,
        udid:
          device.udid,
        runtime,
      };
    }
  }

  throw new Error(
    "No booted iPhone Simulator found",
  );
}

export function simulatorCaseUrl({
  base,
  token,
  candidate,
  screen,
}) {
  const url =
    new URL(
      "/",
      base,
    );

  url.searchParams.set(
    "candidate",
    candidate,
  );

  url.searchParams.set(
    "screen",
    screen,
  );

  url.searchParams.set(
    "device",
    "iphone",
  );

  url.searchParams.set(
    "token",
    token,
  );

  if (
    screen !== "S01"
  ) {
    url.searchParams.set(
      "e2e",
      "signed-in",
    );
  }

  return url.href;
}

export function qualifiesSimulatorSnapshot(
  snapshot,
) {
  assert(
    snapshot
    && typeof snapshot === "object",
  );

  return (
    snapshot.ready === true
    && snapshot.activeRequestCount === 1
    && snapshot.layoutOverflow === false
    && snapshot.canvasVisible === true
    && snapshot.targetInViewport === true
    && snapshot.subjectVisible === true
    && (
      snapshot.screen !== "S10"
      || snapshot.s10LookEnabled === true
    )
  );
}
