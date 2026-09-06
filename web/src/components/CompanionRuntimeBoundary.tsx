import { resolveCompanionRuntimeConfig } from "../ui/companion";

export type CompanionRuntimeBoundaryProps = {
  mode: unknown;
  reducedMotion?: boolean;
};

/**
 * Keeps the future companion runtime behind a fail-closed, non-visual boundary.
 * Both modes intentionally render no assets until S2 usage and rights are approved.
 */
export function CompanionRuntimeBoundary({ mode, reducedMotion = false }: CompanionRuntimeBoundaryProps) {
  const config = resolveCompanionRuntimeConfig(mode, { reducedMotion });
  if (!config.enabled) return null;

  // Review mode is intentionally a no-op until a separately approved asset source exists.
  // Keeping the reduced-motion value in this contract prevents a future renderer from
  // having to infer motion preferences from health or model state.
  void config.reducedMotion;
  return null;
}
