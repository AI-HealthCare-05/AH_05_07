import { useEffect, useState } from "react";

import { CompanionRuntimeBoundary } from "./CompanionRuntimeBoundary";
import {
  resolveLoginCompanion,
  type CompanionMode,
  type CompanionSpecies,
} from "../ui/companion";

type LoginCompanionNarratorProps = Readonly<{
  mode: CompanionMode;
  species: CompanionSpecies;
}>;

export function LoginCompanionNarrator({
  mode,
  species,
}: LoginCompanionNarratorProps) {
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const selection = resolveLoginCompanion(species);

  return (
    <aside
      className="login-companion-narrator"
      data-login-companion
      data-login-companion-species={species}
      aria-label="둘러보기 안내"
    >
      <div className="login-companion-character" aria-hidden="true">
        <CompanionRuntimeBoundary
          mode={mode}
          selection={selection}
          reducedMotion={reducedMotion}
        />
      </div>
      <p className="login-companion-bubble">
        <span>처음이신가요?</span>
        <strong>저장 없이 먼저 둘러봐도 돼요.</strong>
      </p>
    </aside>
  );
}
