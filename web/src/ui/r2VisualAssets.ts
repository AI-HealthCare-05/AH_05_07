import type { ScreenId } from "./journey";

const assetOrigin = "https://sk7-assets.gomdory.com/visual/v1";

export const sceneBackgrounds = {
  desktop: `${assetOrigin}/backgrounds/sk7-calm-clay-desktop-v01.webp`,
  mobile: `${assetOrigin}/backgrounds/sk7-calm-clay-mobile-v01.webp`,
} as const;

const characterAssets: Partial<Record<ScreenId, string>> = {
  S02: `${assetOrigin}/characters/sk7-character-base-cream-v01.webp`,
  S05: `${assetOrigin}/characters/sk7-character-saved-v01.webp`,
  S06: `${assetOrigin}/characters/sk7-character-locked-v01.webp`,
  S12: `${assetOrigin}/characters/sk7-character-empty-v01.webp`,
  S13: `${assetOrigin}/characters/sk7-character-retry-v01.webp`,
};

export function characterAssetFor(screen: ScreenId) {
  return characterAssets[screen];
}
