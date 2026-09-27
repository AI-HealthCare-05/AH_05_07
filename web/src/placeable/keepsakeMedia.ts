import type { Keepsake } from "./contract";
import { livingChoice, type LivingChoice } from "../ui/livingChoice";

// Media contract v0. Immutable identities: changed artwork needs a new asset id.
// Original, code-authored E3/E4 geometry; no generated or third-party image input.
// Rights: repository-authored product source; no separate external asset license.
const family = {
  visualRole: "supporting garden-edge stone medallion",
  palette: "Radiant Storyworld / warm limestone and muted natural accents",
  provenance: "Original repository-authored procedural geometry and SVG, E3/E4",
  rights: "Repository product source; no external media or third-party license dependency",
  renderer: "still procedural Three.js medallion",
  fallback: "equivalent Classic SVG plus semantic name and removal controls",
} as const;
export const keepsakeMedia = {
  "plaza-ribbon-v1": { ...family, assetId: "plaza-ribbon-v1", label: "광장의 리본", accent: "#8d7970", motif: "ribbon" },
  "quiet-moon-v1": { ...family, assetId: "quiet-moon-v1", label: "고요한 달", accent: "#82769a", motif: "moon" },
  "garden-leaf-v1": { ...family, assetId: "garden-leaf-v1", label: "정원의 잎", accent: "#70856c", motif: "leaf" },
} as const satisfies Record<Keepsake, typeof family & { assetId: Keepsake; label: string; accent: string; motif: string }>;
const candidates: Record<LivingChoice, Keepsake> = {
  "walk-10-minutes": "plaza-ribbon-v1",
  "sleep-routine": "quiet-moon-v1",
  "low-sodium-meal": "garden-leaf-v1",
};
export function keepsakeCandidate(value: unknown): Keepsake | null {
  const choice = livingChoice(value);
  return choice ? candidates[choice] : null;
}
