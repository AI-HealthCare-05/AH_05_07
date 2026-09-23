export type SceneFirstPaintPhase = "loading" | "ready" | "failed";

export type SceneFirstPaintVisit = Readonly<{
  token: string;
  screen: string;
  assetId: string;
  assetUrl: string;
  phase: SceneFirstPaintPhase;
}>;

export type SceneFirstPaintChannelState = Readonly<{
  activeVisit: SceneFirstPaintVisit | null;
}>;

export type SceneFirstPaintChannelAction = Readonly<
  | { type: "activate"; token: string; screen: string; assetId: string; assetUrl: string }
  | { type: "ready"; token: string }
  | { type: "failed"; token: string }
  | { type: "clear"; token: string }
>;

export const initialSceneFirstPaintChannelState: SceneFirstPaintChannelState;

export function sceneFirstPaintChannelReducer(
  state: SceneFirstPaintChannelState,
  action: SceneFirstPaintChannelAction,
): SceneFirstPaintChannelState;

export function matchesReadySceneWitness(
  witness: SceneFirstPaintVisit | null,
  expected: Readonly<{ screen: string; token: string; assetId: string; assetUrl: string }>,
): boolean;
