import { lazy, Suspense, Component, type ErrorInfo, type ReactNode } from "react";

import { resolveCompanionRuntimeConfig, type CompanionSelection } from "../ui/companion";

export type CompanionFraming = "default" | "journey-s05";
export type CompanionInteractionActivation = "disabled" | "immediate" | "after-idle";

export type CompanionRuntimeBoundaryProps = {
  mode: unknown;
  selection: CompanionSelection | null;
  reducedMotion?: boolean;
  framing?: CompanionFraming;
};

let companionRendererModulePromise: ReturnType<typeof importCompanionRenderer> | null = null;

function importCompanionRenderer() {
  return import("./CompanionReviewRenderer");
}

function loadCompanionRenderer() {
  if (!companionRendererModulePromise) {
    companionRendererModulePromise = importCompanionRenderer().catch((error) => {
      companionRendererModulePromise = null;
      throw error;
    });
  }
  return companionRendererModulePromise;
}

/** Warm only the renderer module. GLB loading remains lazy and selection-bound. */
export function warmCompanionRendererModule() {
  void loadCompanionRenderer().catch(() => undefined);
}

const CompanionReviewRenderer = lazy(loadCompanionRenderer);

class RendererErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The companion is decorative. Keep renderer failures out of the user's UI.
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** All policy checks happen before the lazy renderer import. */
export function CompanionRuntimeBoundary({ mode, selection, reducedMotion = false, framing = "default" }: CompanionRuntimeBoundaryProps) {
  const config = resolveCompanionRuntimeConfig(mode, { reducedMotion });
  if (!config.enabled || !selection) return null;
  const interactionActivation: CompanionInteractionActivation = config.reducedMotion
    ? "disabled"
    : config.mode === "review"
      && selection.species === "bear"
      && selection.variant === "lite"
      && selection.clip === "idle"
      ? "immediate"
      : config.mode === "production"
        && selection.screen === "S05"
        && selection.species === "bear"
        && selection.variant === "lite"
        && selection.clip === "celebrate"
        && selection.sequence === "celebrate_then_idle"
        ? "after-idle"
        : "disabled";

  const tactileEligible = interactionActivation !== "disabled";

  return (
    <div
      className="companion-runtime-slot"
      aria-hidden="true"
      data-companion-interactive={tactileEligible ? "true" : "false"}
      data-companion-interaction-activation={interactionActivation}
      style={interactionActivation === "immediate" ? { pointerEvents: "auto" } : undefined}
    >
      <RendererErrorBoundary>
        <Suspense fallback={null}>
          <CompanionReviewRenderer
            selection={selection}
            reducedMotion={config.reducedMotion}
            framing={framing}
            interactionActivation={interactionActivation}
          />
        </Suspense>
      </RendererErrorBoundary>
    </div>
  );
}
