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
export type CompanionRuntimeScreen = CompanionReviewScreen | "S01";
export type CompanionPolicyScreen = ScreenId | "S01";

export const companionExcludedScreens = ["S04", "S07", "S08", "S09", "S11", "S12", "S13", "S14"] as const;

export type CompanionMode = "off" | "review" | "production";
export type CompanionRuntimeConfig = Readonly<{
  mode: CompanionMode;
  enabled: boolean;
  assetLoading: "disabled" | "lazy-review" | "lazy-production";
  networkPolicy: "none" | "single-approved-glb";
  reducedMotion: boolean;
}>;

export type CompanionRuntimeOptions = Readonly<{
  /** The host owns media-query detection and passes only this presentation fact. */
  reducedMotion?: boolean;
}>;

export type CompanionSelectionContext = "save_success" | "non_semantic";
export type CompanionAnimationSequence = "celebrate_then_idle";
export type CompanionSelection = Readonly<{
  screen: CompanionRuntimeScreen;
  species: CompanionSpecies;
  variant: CompanionVariant;
  clip: CompanionClip;
  context?: CompanionSelectionContext;
  sequence?: CompanionAnimationSequence;
  /** Explicit non-production selection may use the read-only review catalog. */
  assetScope?: "review-catalog";
}>;
export type CompanionDecision = Readonly<{
  status: "allowed" | "conditional" | "blocked";
  reason: string;
}>;

const generalClips: ReadonlySet<CompanionClip> = new Set(["idle", "greet", "curious", "rest"]);

/** Only exact, explicitly configured values can open a companion boundary. */
export function resolveCompanionMode(rawMode: unknown): CompanionMode {
  if (rawMode === "review" || rawMode === "production") return rawMode;
  return "off";
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
    enabled: mode !== "off",
    assetLoading: mode === "review" ? "lazy-review" : mode === "production" ? "lazy-production" : "disabled",
    networkPolicy: mode === "off" ? "none" : "single-approved-glb",
    reducedMotion: options.reducedMotion === true,
  };
}

/**
 * Production is intentionally narrower than review. This resolver has no query input:
 * only explicitly approved fixed profiles can be constructed.
 */
/**
 * Dedicated S01 presentation profile.
 * Species comes only from the non-medical companion identity preference.
 * Query parameters and health/challenge/model facts never choose this profile.
 */
export function resolveLoginCompanion(species: CompanionSpecies): CompanionSelection {
  return {
    screen: "S01",
    species,
    variant: "lite",
    clip: "greet",
  };
}

/** One confirmed save presentation, independent of persistence implementation. */
export function resolveConfirmedSaveCompanion(species: CompanionSpecies): CompanionSelection {
  return {
    screen: "S05",
    species,
    variant: "lite",
    clip: "celebrate",
    context: "save_success",
    sequence: "celebrate_then_idle",
  };
}

export function resolveProductionCompanion(
  mode: CompanionMode,
  screen: ScreenId,
  confirmedSave: boolean,
  species: CompanionSpecies = "bear",
): CompanionSelection | null {
  if (mode !== "production") return null;
  if (screen === "S10") {
    return {
      screen: "S10",
      species,
      variant: "lite",
      clip: "idle",
    };
  }
  if (screen !== "S05" || !confirmedSave) return null;
  return resolveConfirmedSaveCompanion(species);
}

export function isCompanionReviewCandidate(screen: ScreenId): screen is CompanionReviewScreen {
  return (companionReviewScreens as readonly string[]).includes(screen);
}

export function getCompanionScreenDisposition(
  screen: CompanionPolicyScreen,
): "review_candidate" | "login_narrator" | "excluded" {
  if (screen === "S01") return "login_narrator";
  return isCompanionReviewCandidate(screen) ? "review_candidate" : "excluded";
}

/**
 * Animation selection receives only a screen, clip, and non-health UI context. It cannot
 * be driven by blood pressure, risk, model, adherence, or improvement facts.
 */
export function getCompanionDecision(
  screen: CompanionPolicyScreen,
  clip: CompanionClip,
  context?: CompanionSelectionContext,
): CompanionDecision {
  const disposition = getCompanionScreenDisposition(screen);
  if (disposition === "login_narrator") {
    return clip === "greet"
      ? { status: "allowed", reason: "login_narrator_greet_only" }
      : { status: "blocked", reason: "login_narrator_fixed_greet" };
  }
  if (disposition === "excluded") {
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
  return {
    screen,
    species,
    variant,
    clip,
    ...(context ? { context } : {}),
    assetScope: "review-catalog",
  };
}
