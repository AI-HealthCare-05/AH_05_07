import type { ThirdPersonCameraConfig } from "./thirdPersonCamera";
import type { WorldFixture } from "./worldFixtureGeometry";

export type WorldSceneDestination = Readonly<{
  id: string;
  label: string;
  x: number;
  z: number;
  radius: number;
}>;

export type WorldSceneProfile = Readonly<{
  groundSize: number;
  fixtures: readonly WorldFixture[];
  destination: WorldSceneDestination;
  camera: Readonly<{
    seed: ThirdPersonCameraConfig;
    shapeRadius: number;
    distanceLimits: Readonly<{ min: number; max: number }>;
    lookSensitivity: number;
  }>;
  actor: Readonly<{
    modelHeight: number;
    footOffset: number;
  }>;
}>;
