import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./styles.css";
import "./components/journey-candidate.css";

const PRELOAD_RECOVERY_KEY = "sk7:vite-preload-recovery-at";
const PRELOAD_RECOVERY_COOLDOWN_MS = 60_000;

// A tab can survive a web deployment while still running an older Vite entry
// bundle whose hashed lazy chunk no longer exists. Recover once by reloading
// the current HTML instead of leaving an optional presentation layer missing.
window.addEventListener("vite:preloadError", (event) => {
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
