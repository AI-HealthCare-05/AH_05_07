import type { ScreenId } from "./journey";

/** The S2-approved candidate set. Runtime assets are intentionally not bundled here. */
export const companionSpecies = [
  "bear",
  "rabbit",
  "cat",
  "dog",
  "red_panda",
  "otter",
  "capybara",
  "hedgehog",
  "penguin",
  "fox",
  "squirrel",
] as const;

export type CompanionSpecies = (typeof companionSpecies)[number];

export const companionVariants = ["standard", "lite"] as const;
export type CompanionVariant = (typeof companionVariants)[number];

export const companionClips = ["idle", "greet", "move", "curious", "celebrate", "rest", "special"] as const;
export type CompanionClip = (typeof companionClips)[number];

export const companionReviewScreens = ["S02", "S03", "S05", "S10"] as const;
export type CompanionReviewScreen = (typeof companionReviewScreens)[number];

export const companionExcludedScreens = ["S04", "S07", "S08", "S09", "S11", "S12", "S13", "S14"] as const;

export type CompanionMode = "off" | "review";
export type CompanionRuntimeConfig = Readonly<{
  mode: CompanionMode;
  enabled: boolean;
  assetLoading: "disabled" | "lazy-review";
  networkPolicy: "none" | "single-approved-glb";
  reducedMotion: boolean;
}>;

export type CompanionRuntimeOptions = Readonly<{
  /** The host owns media-query detection and passes only this presentation fact. */
  reducedMotion?: boolean;
}>;

export type CompanionSelectionContext = "save_success" | "non_semantic";
export type CompanionSelection = Readonly<{
  screen: CompanionReviewScreen;
  species: CompanionSpecies;
  variant: CompanionVariant;
  clip: CompanionClip;
  context?: CompanionSelectionContext;
}>;
export type CompanionDecision = Readonly<{
  status: "allowed" | "conditional" | "blocked";
  reason: string;
}>;

const generalClips: ReadonlySet<CompanionClip> = new Set(["idle", "greet", "curious", "rest"]);

/** Only an explicit review value can open the future local review boundary. */
export function resolveCompanionMode(rawMode: unknown): CompanionMode {
  return rawMode === "review" ? "review" : "off";
}

/**
 * This is a policy boundary, not an asset loader. No GLB URL, fetch, or asset import
 * belongs in this module. The renderer opens only after this policy has returned a
 * complete explicit selection.
 */
export function resolveCompanionRuntimeConfig(
  rawMode: unknown,
  options: CompanionRuntimeOptions = {},
): CompanionRuntimeConfig {
  const mode = resolveCompanionMode(rawMode);
  return {
    mode,
    enabled: mode === "review",
    assetLoading: mode === "review" ? "lazy-review" : "disabled",
    networkPolicy: mode === "review" ? "single-approved-glb" : "none",
    reducedMotion: options.reducedMotion === true,
  };
}

export function isCompanionReviewCandidate(screen: ScreenId): screen is CompanionReviewScreen {
  return (companionReviewScreens as readonly string[]).includes(screen);
}

export function getCompanionScreenDisposition(screen: ScreenId): "review_candidate" | "excluded" {
  return isCompanionReviewCandidate(screen) ? "review_candidate" : "excluded";
}

/**
 * Animation selection receives only a screen, clip, and non-health UI context. It cannot
 * be driven by blood pressure, risk, model, adherence, or improvement facts.
 */
export function getCompanionDecision(
  screen: ScreenId,
  clip: CompanionClip,
  context?: CompanionSelectionContext,
): CompanionDecision {
  if (getCompanionScreenDisposition(screen) === "excluded") {
    return { status: "blocked", reason: "screen_excluded" };
  }
  if (clip === "special") {
    return { status: "blocked", reason: "clip_on_hold" };
  }
  if (clip === "celebrate") {
    return screen === "S05" && context === "save_success"
      ? { status: "conditional", reason: "save_success_only" }
      : { status: "blocked", reason: "save_success_context_required" };
  }
  if (clip === "move") {
    return context === "non_semantic"
      ? { status: "conditional", reason: "non_semantic_scene_movement_only" }
      : { status: "blocked", reason: "non_semantic_context_required" };
  }
  if (generalClips.has(clip)) {
    return { status: "allowed", reason: "general_review_candidate" };
  }
  return { status: "blocked", reason: "unknown_policy" };
}

export function isCompanionSpecies(value: string): value is CompanionSpecies {
  return (companionSpecies as readonly string[]).includes(value);
}

export function isCompanionClip(value: string): value is CompanionClip {
  return (companionClips as readonly string[]).includes(value);
}

export function isCompanionVariant(value: string): value is CompanionVariant {
  return (companionVariants as readonly string[]).includes(value);
}

/**
 * Review selection is explicit and fail-closed. Query parameters never choose a
 * species, variant, or clip by default. The save-success context is supplied by
 * the host after a real or deterministic synthetic save event.
 */
export function resolveCompanionSelection(
  screen: ScreenId,
  search: URLSearchParams,
  hostContext?: CompanionSelectionContext,
): CompanionSelection | null {
  if (!isCompanionReviewCandidate(screen)) return null;
  const species = search.get("companion_species");
  const variant = search.get("companion_variant");
  const clip = search.get("companion_clip");
  if (!species || !isCompanionSpecies(species) || !variant || !isCompanionVariant(variant) || !clip || !isCompanionClip(clip)) {
    return null;
  }
  const queryContext = search.get("companion_context") === "non_semantic" ? "non_semantic" : undefined;
  const context = hostContext ?? queryContext;
  if (getCompanionDecision(screen, clip, context).status === "blocked") return null;
  return { screen, species, variant, clip, ...(context ? { context } : {}) };
}
