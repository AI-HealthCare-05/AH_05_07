const SHOWCASE_FILM_URL =
  "https://sk7-companion.gkrry.com/showcase/v1/video/showcase-final-v1-9094ae558239.mp4";
const SHOWCASE_POSTER_URL =
  "https://sk7-companion.gkrry.com/showcase/v1/images/showcase-poster-public-v1-2b8e766efde1.jpg";
const SHOWCASE_DETAILS_URL = "/showcase/";

const ROOT_ID = "sk7-showcase-cinema-portal";

function createSeatRow(count, className) {
  const row = document.createElement("div");
  row.className = `sk7-cinema-seat-row ${className}`;
  row.setAttribute("aria-hidden", "true");
  for (let index = 0; index < count; index += 1) {
    const seat = document.createElement("span");
    seat.className = "sk7-cinema-seat";
    row.append(seat);
  }
  return row;
}

function createPortal() {
  if (document.getElementById(ROOT_ID)) return document.getElementById(ROOT_ID);

  const portal = document.createElement("div");
  portal.id = ROOT_ID;
  portal.hidden = true;

  const entry = document.createElement("section");
  entry.className = "sk7-showcase-entry";
  entry.setAttribute("aria-label", "SK7 Showcase");

  const opener = document.createElement("button");
  opener.type = "button";
  opener.className = "sk7-showcase-entry-button";
  opener.setAttribute("aria-haspopup", "dialog");
  opener.innerHTML = `
    <span class="sk7-showcase-entry-kicker">SHOWCASE</span>
    <span class="sk7-showcase-entry-title">Seven days can tell a story.</span>
    <span class="sk7-showcase-entry-meta">04:00&nbsp;&nbsp; WATCH THE FILM <i aria-hidden="true">↗</i></span>
  `;

  entry.append(opener);

  const dialog = document.createElement("dialog");
  dialog.className = "sk7-cinema-dialog";
  dialog.setAttribute("aria-labelledby", "sk7-cinema-title");
  dialog.innerHTML = `
    <div class="sk7-cinema-room">
      <header class="sk7-cinema-topbar">
        <div>
          <p>SK7 SHOWCASE</p>
          <h2 id="sk7-cinema-title">Seven days can tell a story.</h2>
        </div>
        <button type="button" class="sk7-cinema-close" aria-label="Showcase 닫기">CLOSE <span aria-hidden="true">×</span></button>
      </header>

      <div class="sk7-cinema-stage">
        <div class="sk7-cinema-wall sk7-cinema-wall-left" aria-hidden="true"></div>
        <div class="sk7-cinema-wall sk7-cinema-wall-right" aria-hidden="true"></div>

        <div class="sk7-cinema-screen-wrap">
          <div class="sk7-cinema-screen-glow" aria-hidden="true"></div>
          <div class="sk7-cinema-screen">
            <video
              class="sk7-cinema-video"
              controls
              playsinline
              preload="none"
              aria-describedby="sk7-cinema-caption"
            ></video>
            <div class="sk7-cinema-film-status" role="status" aria-live="polite"></div>
          </div>
          <p id="sk7-cinema-caption" class="sk7-cinema-caption">
            SK7의 실제 화면 흐름을 담은 약 4분의 제품 Showcase입니다.
          </p>
        </div>

        <a class="sk7-cinema-details" href="${SHOWCASE_DETAILS_URL}">
          DETAILS <span aria-hidden="true">↗</span>
        </a>

        <div class="sk7-cinema-aisle sk7-cinema-aisle-left" aria-hidden="true"></div>
        <div class="sk7-cinema-aisle sk7-cinema-aisle-right" aria-hidden="true"></div>
        <div class="sk7-cinema-seats" aria-hidden="true"></div>
      </div>
    </div>
  `;

  const seats = dialog.querySelector(".sk7-cinema-seats");
  seats.append(
    createSeatRow(7, "is-back"),
    createSeatRow(9, "is-middle"),
    createSeatRow(11, "is-front"),
  );

  portal.append(entry, dialog);
  document.body.append(portal);

  const video = dialog.querySelector(".sk7-cinema-video");
  const closeButton = dialog.querySelector(".sk7-cinema-close");
  const status = dialog.querySelector(".sk7-cinema-film-status");

  function attachFilm() {
    if (video.getAttribute("src")) return;
    video.poster = SHOWCASE_POSTER_URL;
    video.src = SHOWCASE_FILM_URL;
    video.load();
    status.textContent = "";
    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {
        status.textContent = "재생 버튼을 눌러 영상을 시작할 수 있어요.";
      });
    }
  }

  function detachFilm() {
    video.pause();
    video.removeAttribute("src");
    video.removeAttribute("poster");
    video.load();
    status.textContent = "";
  }

  function openCinema({ updateHistory = true } = {}) {
    if (typeof dialog.showModal !== "function") return;
    dialog.showModal();
    document.body.classList.add("sk7-cinema-open");
    attachFilm();
    if (updateHistory) {
      const url = new URL(window.location.href);
      url.searchParams.set("showcase", "film");
      window.history.replaceState(null, "", url);
    }
  }

  function closeCinema({ updateHistory = true } = {}) {
    if (dialog.open) dialog.close();
    detachFilm();
    document.body.classList.remove("sk7-cinema-open");
    if (updateHistory) {
      const url = new URL(window.location.href);
      url.searchParams.delete("showcase");
      window.history.replaceState(null, "", url);
    }
    opener.focus({ preventScroll: true });
  }

  opener.addEventListener("click", () => openCinema());
  closeButton.addEventListener("click", () => closeCinema());

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeCinema();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeCinema();
  });

  dialog.addEventListener("close", () => {
    detachFilm();
    document.body.classList.remove("sk7-cinema-open");
  });

  const initialUrl = new URL(window.location.href);
  portal.__sk7OpenCinema = openCinema;
  portal.__sk7InitialFilmRequested = initialUrl.searchParams.get("showcase") === "film";

  return portal;
}

function isSignedOutLandingVisible() {
  return Boolean(
    document.querySelector('main.journey-login[data-scene="S01"]') &&
    !document.querySelector(".journey-demo-preview-shell")
  );
}

let scheduled = false;
function syncPortal() {
  scheduled = false;
  const visible = isSignedOutLandingVisible();
  let portal = document.getElementById(ROOT_ID);
  if (!visible && !portal) return;
  portal ??= createPortal();
  portal.hidden = !visible;

  if (
    visible &&
    portal.__sk7InitialFilmRequested &&
    !portal.querySelector(".sk7-cinema-dialog")?.open
  ) {
    portal.__sk7InitialFilmRequested = false;
    portal.__sk7OpenCinema?.({ updateHistory: false });
  }
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  window.queueMicrotask(syncPortal);
}

const root = document.getElementById("root");
if (root) {
  const observer = new MutationObserver(scheduleSync);
  observer.observe(root, { childList: true, subtree: true });
}

window.addEventListener("popstate", scheduleSync);
scheduleSync();
