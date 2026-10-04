import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";
import "./components/journey-candidate.css";
import "./components/journey-today.css";
import "./components/journey-feedback.css";
import "./components/frontend-assets.css";
import "./modern-palette.css";
import "./theme-presets.css";
import { applyThemePreference, readThemePreference } from "./ui/themePreference";
import { isPlaceableRoute } from "./placeable/contract";

applyThemePreference(readThemePreference());

const PRELOAD_RECOVERY_KEY = "sk7:vite-preload-recovery-at";
const PRELOAD_RECOVERY_COOLDOWN_MS = 60_000;

// A tab can survive a web deployment while still running an older Vite entry
// bundle whose hashed lazy chunk no longer exists. Recover once by reloading
// the current HTML instead of leaving an optional presentation layer missing.
window.addEventListener("vite:preloadError", (event) => {
  // Mounted product My Space, Guest plaza and Garden own local recovery
  // and semantic exits. Before they mount, root chunk failures still need
  // the one-shot reload.
  if (document.querySelector(".placeable-experience")
    || document.querySelector('[data-guest-space="plaza"]')
    || document.querySelector('[data-living-city-space="garden-nook"]')) return;
  const now = Date.now();

  try {
    const previous = Number(
      window.sessionStorage.getItem(PRELOAD_RECOVERY_KEY) ?? "0",
    );

    if (
      Number.isFinite(previous) &&
      now - previous < PRELOAD_RECOVERY_COOLDOWN_MS
    ) {
      return;
    }

    window.sessionStorage.setItem(PRELOAD_RECOVERY_KEY, String(now));
  } catch {
    // Storage may be unavailable in a restrictive browser mode.
    // Preserve the normal error path instead of risking a reload loop.
    return;
  }

  event.preventDefault();
  window.location.reload();
});

async function mountApplication() {
  const guestJourney = new URLSearchParams(window.location.search).get("guest") === "1";
  const placeable = isPlaceableRoute(window.location.search, window.location.hash);
  const { default: Root } = placeable
    ? await import("./placeable/ProductPlaceableEntry")
    : guestJourney
    ? await import("./GuestJourneySandbox")
    : await import("./App");

  createRoot(document.getElementById("root")!).render(
    placeable ? <Root /> : <StrictMode><Root /></StrictMode>,
  );
}

void mountApplication();
