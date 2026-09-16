(() => {
  const fallbackHostname = "ah-05-07-pages.ahnsangkyoon.workers.dev";
  const canonicalOrigin = "https://hyeol.app";

  if (window.location.hostname !== fallbackHostname) return;

  const current = new URL(window.location.href);
  if (current.searchParams.get("fallback") === "1") return;

  const target = new URL(`${current.pathname}${current.search}${current.hash}`, canonicalOrigin);
  window.location.replace(target.toString());
})();
