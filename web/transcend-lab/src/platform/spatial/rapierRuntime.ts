import packageManifest from "../../../package.json" with { type: "json" };

export type RapierModule = typeof import("@dimforge/rapier3d-compat");
export const EXPECTED_RAPIER_VERSION = packageManifest.dependencies["@dimforge/rapier3d-compat"];
let ready: Promise<RapierModule> | null = null;

/** Shared initialization for the two real Lab physics owners; never product code. */
export function loadLabRapier(): Promise<RapierModule> {
  ready ??= import("@dimforge/rapier3d-compat").then(async module => {
    await module.init();
    if (module.version() !== EXPECTED_RAPIER_VERSION) {
      throw new Error(`Unexpected Rapier runtime ${module.version()}; expected ${EXPECTED_RAPIER_VERSION}`);
    }
    return module;
  }).catch(error => {
    // A failed initialization must not poison later explicit start attempts.
    ready = null;
    throw error;
  });
  return ready;
}
