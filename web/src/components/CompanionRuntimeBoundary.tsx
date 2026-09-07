import { lazy, Suspense, Component, type ErrorInfo, type ReactNode } from "react";

import { resolveCompanionRuntimeConfig, type CompanionSelection } from "../ui/companion";

export type CompanionRuntimeBoundaryProps = {
  mode: unknown;
  selection: CompanionSelection | null;
  reducedMotion?: boolean;
};

const CompanionReviewRenderer = lazy(() => import("./CompanionReviewRenderer"));

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
export function CompanionRuntimeBoundary({ mode, selection, reducedMotion = false }: CompanionRuntimeBoundaryProps) {
  const config = resolveCompanionRuntimeConfig(mode, { reducedMotion });
  if (!config.enabled || !selection) return null;

  return (
    <div className="companion-runtime-slot" aria-hidden="true">
      <RendererErrorBoundary>
        <Suspense fallback={null}>
          <CompanionReviewRenderer selection={selection} reducedMotion={config.reducedMotion} />
        </Suspense>
      </RendererErrorBoundary>
    </div>
  );
}
