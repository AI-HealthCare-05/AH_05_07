const showcaseAssets = {
    today: {
        url: "https://sk7-companion.gkrry.com/showcase/v1/images/today-hero-public-v1-604f516ad843.webp",
        sha256: "604f516ad843319598f8821d37dc391644a792a3103e957e20515d4b95fe8ea2",
        bytes: 35462,
        alt: "SK7 오늘의 기록 화면 상단. 날짜별 혈압 기록으로 이어지는 제품 화면과 작은 Companion이 함께 보입니다.",
    },
    journey: {
        url: "https://sk7-companion.gkrry.com/showcase/v1/images/seven-day-journey-public-v1-b745ac5f5974.webp",
        sha256: "b745ac5f5974bb438d5176c631972ba1dbb1a65ddd369f4b9b2d792bf8dbf8eb",
        bytes: 14826,
        alt: "SK7 7일 돌아보기 화면의 날짜별 여정. 일곱 개의 장소가 하나의 길로 이어져 있습니다.",
    },
    companion: {
        url: "https://sk7-companion.gkrry.com/showcase/v1/images/companion-context-public-v1-dbedf827f6a0.webp",
        sha256: "dbedf827f6a0d736519c2a635b0f58be5c80543f22348c329ff107397aec5565",
        bytes: 38472,
        alt: "SK7 제품 화면 안에서 정원 대문 옆에 머무는 작은 곰 Companion.",
    },
    poster: {
        url: "https://sk7-companion.gkrry.com/showcase/v1/images/showcase-poster-public-v1-2b8e766efde1.jpg",
        sha256: "2b8e766efde16a31f57014be65328a67724dec5697f243b0626144e3abf1c60c",
        bytes: 36630,
        alt: "SK7 시연 영상 포스터. 로그인 없이 예시 데이터로 먼저 둘러볼 수 있다는 안내가 보입니다.",
    },
};

const root = document.documentElement;
root.classList.add("js");
const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const saveData = navigator.connection?.saveData === true;
function syncMotionPreference() {
    const reduced = reduceMotionQuery.matches || saveData;
    root.classList.toggle("sc-reduced-motion", reduced);
    return reduced;
}
let reducedMotion = syncMotionPreference();
reduceMotionQuery.addEventListener?.("change", () => {
    reducedMotion = syncMotionPreference();
});
function bindEvidenceAsset(image) {
    const key = image.dataset.scAsset;
    if (!key || !(key in showcaseAssets))
        return;
    const asset = showcaseAssets[key];
    const figure = image.closest("[data-sc-evidence]");
    image.alt = asset.alt;
    image.addEventListener("load", () => {
        figure?.setAttribute("data-sc-loaded", "");
        figure?.removeAttribute("data-sc-failed");
    }, { once: true });
    image.addEventListener("error", () => {
        figure?.setAttribute("data-sc-failed", "");
        figure?.removeAttribute("data-sc-loaded");
    }, { once: true });
    image.src = asset.url;
}
document.querySelectorAll("img[data-sc-asset]").forEach(bindEvidenceAsset);
const revealNodes = Array.from(document.querySelectorAll("[data-sc-reveal]"));
if (!reducedMotion && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting)
                continue;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
        }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.14 });
    revealNodes.forEach((node) => observer.observe(node));
}
else {
    revealNodes.forEach((node) => node.classList.add("is-visible"));
}
const journey = document.querySelector("[data-sc-journey]");
const days = Array.from(document.querySelectorAll("[data-sc-day]"));
let raf = 0;
function paintJourneyProgress() {
    raf = 0;
    if (!journey || reducedMotion || window.innerWidth < 901 || document.hidden) {
        days.forEach((day) => day.removeAttribute("data-active"));
        return;
    }
    const rect = journey.getBoundingClientRect();
    const distance = Math.max(1, rect.height + window.innerHeight * 0.35);
    const progress = Math.max(0, Math.min(1, (window.innerHeight * 0.72 - rect.top) / distance));
    const activeIndex = Math.min(6, Math.floor(progress * 7));
    days.forEach((day, index) => {
        if (index <= activeIndex)
            day.setAttribute("data-active", "true");
        else
            day.removeAttribute("data-active");
    });
}
function scheduleJourneyProgress() {
    if (raf)
        return;
    raf = requestAnimationFrame(paintJourneyProgress);
}
window.addEventListener("scroll", scheduleJourneyProgress, { passive: true });
window.addEventListener("resize", scheduleJourneyProgress, { passive: true });
document.addEventListener("visibilitychange", scheduleJourneyProgress);
scheduleJourneyProgress();
const responseToggle = document.querySelector("[data-sc-response-toggle]");
const responseNote = document.getElementById("response-note");
responseToggle?.addEventListener("click", () => {
    if (!responseNote)
        return;
    const expanded = responseToggle.getAttribute("aria-expanded") === "true";
    responseToggle.setAttribute("aria-expanded", String(!expanded));
    responseNote.hidden = expanded;
});
