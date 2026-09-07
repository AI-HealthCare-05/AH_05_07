import { signedInScreenIds, type ScreenId } from "./journey";

const assetOrigin = "https://sk7-assets.gomdory.com/visual/v1";

export type VisualAssetId =
  | "shared.calmClay.desktop"
  | "shared.calmClay.mobile"
  | "scene.S02.homeBase"
  | "scene.S05.saveSuccess"
  | "scene.S06.challengeLocked"
  | "scene.S12.empty"
  | "scene.S13.retry";

export type VisualAssetRecord = Readonly<{
  id: VisualAssetId;
  currentObjectKey: string;
  currentUrl: string;
  plannedV2ObjectKey: string | null;
  mime: "image/webp";
  decorative: true;
  screens: readonly ScreenId[];
  role: string;
  active: boolean;
  loading: "lazy" | "eager";
  fetchPriority: "low" | "auto";
  reason: string;
}>;

const sharedScreens = signedInScreenIds;

export const visualAssetCatalog: Readonly<Record<VisualAssetId, VisualAssetRecord>> = {
  "shared.calmClay.desktop": {
    id: "shared.calmClay.desktop",
    currentObjectKey: "visual/v1/backgrounds/sk7-calm-clay-desktop-v01.webp",
    currentUrl: `${assetOrigin}/backgrounds/sk7-calm-clay-desktop-v01.webp`,
    plannedV2ObjectKey: "visual/v2/shared/backgrounds/calm-clay/desktop.webp",
    mime: "image/webp",
    decorative: true,
    screens: sharedScreens,
    role: "restrained desktop scene background layer",
    active: true,
    loading: "lazy",
    fetchPriority: "low",
    reason: "CSS Calm Clay remains the required fallback and semantic content stays above the image.",
  },
  "shared.calmClay.mobile": {
    id: "shared.calmClay.mobile",
    currentObjectKey: "visual/v1/backgrounds/sk7-calm-clay-mobile-v01.webp",
    currentUrl: `${assetOrigin}/backgrounds/sk7-calm-clay-mobile-v01.webp`,
    plannedV2ObjectKey: "visual/v2/shared/backgrounds/calm-clay/mobile.webp",
    mime: "image/webp",
    decorative: true,
    screens: sharedScreens,
    role: "restrained mobile scene background layer",
    active: true,
    loading: "lazy",
    fetchPriority: "low",
    reason: "Uses the separately exported mobile source with lower opacity; no desktop crop or upscale.",
  },
  "scene.S02.homeBase": {
    id: "scene.S02.homeBase",
    currentObjectKey: "visual/v1/characters/sk7-character-base-cream-v01.webp",
    currentUrl: `${assetOrigin}/characters/sk7-character-base-cream-v01.webp`,
    plannedV2ObjectKey: "visual/v2/scenes/s02/home-base.webp",
    mime: "image/webp",
    decorative: true,
    screens: ["S02"],
    role: "small neutral home illustration",
    active: true,
    loading: "lazy",
    fetchPriority: "low",
    reason: "Reserved for non-interactive desktop whitespace; suppressed below 581px for hierarchy safety.",
  },
  "scene.S05.saveSuccess": {
    id: "scene.S05.saveSuccess",
    currentObjectKey: "visual/v1/characters/sk7-character-saved-v01.webp",
    currentUrl: `${assetOrigin}/characters/sk7-character-saved-v01.webp`,
    plannedV2ObjectKey: "visual/v2/scenes/s05/save-success.webp",
    mime: "image/webp",
    decorative: true,
    screens: ["S05"],
    role: "reserved two-dimensional save confirmation illustration",
    active: false,
    loading: "lazy",
    fetchPriority: "low",
    reason: "Reserved; production S05 companion has visual priority.",
  },
  "scene.S06.challengeLocked": {
    id: "scene.S06.challengeLocked",
    currentObjectKey: "visual/v1/characters/sk7-character-locked-v01.webp",
    currentUrl: `${assetOrigin}/characters/sk7-character-locked-v01.webp`,
    plannedV2ObjectKey: "visual/v2/scenes/s06/challenge-locked.webp",
    mime: "image/webp",
    decorative: true,
    screens: ["S06"],
    role: "locked challenge state illustration",
    active: true,
    loading: "lazy",
    fetchPriority: "low",
    reason: "HTML retains the locked state and selected action meaning; the image is optional decoration.",
  },
  "scene.S12.empty": {
    id: "scene.S12.empty",
    currentObjectKey: "visual/v1/characters/sk7-character-empty-v01.webp",
    currentUrl: `${assetOrigin}/characters/sk7-character-empty-v01.webp`,
    plannedV2ObjectKey: "visual/v2/scenes/s12/empty-state.webp",
    mime: "image/webp",
    decorative: true,
    screens: ["S12"],
    role: "confirmed empty-state illustration",
    active: true,
    loading: "lazy",
    fetchPriority: "low",
    reason: "HTML retains the empty-state explanation and both next actions.",
  },
  "scene.S13.retry": {
    id: "scene.S13.retry",
    currentObjectKey: "visual/v1/characters/sk7-character-retry-v01.webp",
    currentUrl: `${assetOrigin}/characters/sk7-character-retry-v01.webp`,
    plannedV2ObjectKey: "visual/v2/scenes/s13/retry-state.webp",
    mime: "image/webp",
    decorative: true,
    screens: ["S13"],
    role: "load-failure recovery illustration",
    active: true,
    loading: "lazy",
    fetchPriority: "low",
    reason: "Error copy and retry action remain primary; the illustration is bounded and optional.",
  },
} as const;

export type SceneVisuals = Readonly<{
  background: Readonly<{
    desktop: VisualAssetRecord;
    mobile: VisualAssetRecord;
  }>;
  illustration?: VisualAssetRecord;
}>;

export function resolveSceneVisuals(screen: ScreenId): SceneVisuals {
  const illustration = Object.values(visualAssetCatalog).find(
    (asset) => asset.active && asset.screens.includes(screen) && asset.id.startsWith("scene."),
  );
  return {
    background: {
      desktop: visualAssetCatalog["shared.calmClay.desktop"],
      mobile: visualAssetCatalog["shared.calmClay.mobile"],
    },
    illustration,
  };
}

// Compatibility exports for callers that only need the current v1 URLs.
export const sceneBackgrounds = {
  desktop: visualAssetCatalog["shared.calmClay.desktop"].currentUrl,
  mobile: visualAssetCatalog["shared.calmClay.mobile"].currentUrl,
} as const;

export function characterAssetFor(screen: ScreenId) {
  return resolveSceneVisuals(screen).illustration?.currentUrl;
}
