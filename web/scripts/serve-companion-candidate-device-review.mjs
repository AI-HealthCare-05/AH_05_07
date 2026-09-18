import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

import {
  deviceClasses,
  loadCandidateFiles,
  screens,
  species,
  summarizeEvents,
  validateEvent,
} from "./companion-candidate-device-review-lib.mjs";

const args =
  process.argv.slice(2);

function arg(
  name,
  fallback,
) {
  const index =
    args.indexOf(name);

  return index >= 0
    ? args[index + 1]
    : fallback;
}

const build =
  path.resolve(
    arg(
      "--build",
      "",
    ),
  );

const candidatesRoot =
  path.resolve(
    arg(
      "--candidate-root",
      "",
    ),
  );

const evidence =
  path.resolve(
    arg(
      "--evidence",
      "",
    ),
  );

const token =
  arg(
    "--token",
    "",
  );

const port =
  Number(
    arg(
      "--port",
      "4175",
    ),
  );

assert(
  statSync(build).isDirectory(),
);

assert(
  statSync(candidatesRoot).isDirectory(),
);

assert.match(
  token,
  /^[0-9a-f]{32,128}$/,
);

assert(
  Number.isInteger(port)
  && port > 1024
  && port < 65536,
);

const candidateFiles =
  loadCandidateFiles(
    candidatesRoot,
  );

const generated =
  readFileSync(
    path.join(
      process.cwd(),
      "src/ui/companionAssets.generated.ts",
    ),
    "utf8",
  );

const manifestText =
  generated.match(
    /export const companionAssetManifest = ([\s\S]*?) as const\b/,
  )?.[1];

assert(
  manifestText,
  "active companion manifest not found",
);

const activeManifest =
  JSON.parse(
    manifestText,
  );

const bearLiteUrl =
  activeManifest.bear.lite.url;

const files =
  new Map();

const mime = {
  ".html":
    "text/html; charset=utf-8",
  ".js":
    "text/javascript; charset=utf-8",
  ".css":
    "text/css; charset=utf-8",
  ".svg":
    "image/svg+xml",
  ".webp":
    "image/webp",
  ".png":
    "image/png",
  ".jpg":
    "image/jpeg",
  ".jpeg":
    "image/jpeg",
  ".woff2":
    "font/woff2",
  ".glb":
    "model/gltf-binary",
};

function addTree(
  root,
  relative = "",
) {
  for (
    const entry
    of readdirSync(
      path.join(
        root,
        relative,
      ),
      {
        withFileTypes:
          true,
      },
    )
  ) {
    const next =
      path.join(
        relative,
        entry.name,
      );

    if (
      entry.isDirectory()
    ) {
      addTree(
        root,
        next,
      );

      continue;
    }

    if (
      !entry.isFile()
    ) {
      continue;
    }

    files.set(
      "/"
      + next
        .split(path.sep)
        .join("/"),
      readFileSync(
        path.join(
          root,
          next,
        ),
      ),
    );
  }
}

addTree(build);

for (
  const [
    candidate,
    item,
  ]
  of candidateFiles
) {
  files.set(
    `/candidate-media/${candidate}.glb`,
    item.bytes,
  );
}

const eventsFile =
  path.join(
    evidence,
    "physical-device-events.ndjson",
  );

function readEvents() {
  try {
    return readFileSync(
      eventsFile,
      "utf8",
    )
      .split("\n")
      .filter(Boolean)
      .map(line =>
        JSON.parse(line),
      );
  } catch {
    return [];
  }
}

function fixtureScript() {
  const config = {
    token,
    bearLiteUrl,
    species,
    screens,
    deviceClasses,
  };

  return `
(() => {
  const CONFIG =
    ${JSON.stringify(config)};

  const params =
    new URLSearchParams(
      location.search
    );

  const candidate =
    CONFIG.species.includes(
      params.get("candidate")
    )
      ? params.get("candidate")
      : "koala";

  const screen =
    CONFIG.screens.includes(
      params.get("screen")
    )
      ? params.get("screen")
      : "S01";

  const deviceClass =
    CONFIG.deviceClasses.includes(
      params.get("device")
    )
      ? params.get("device")
      : "android";

  localStorage.setItem(
    "sk7-companion-species",
    "bear"
  );

  const state = {
    candidate,
    screen,
    deviceClass,
    activeRequestCount: 0,
    humanVisibleConfirmed: false,
  };

  Object.defineProperty(
    window,
    "__SK7_PHYSICAL_REVIEW__",
    {
      value: state,
    }
  );

  const nativeFetch =
    window.fetch.bind(window);

  const syntheticWindow = () => {
    const today =
      "2026-09-11";

    return {
      start_on:
        "2026-09-05",
      end_on:
        today,
      blood_pressure_observations: [
        {
          id:
            "physical-review-existing",
          observed_on:
            today,
          period:
            "morning",
          systolic:
            118,
          diastolic:
            76,
        },
      ],
      challenge_events: [],
      active_challenge: {
        id:
          "physical-review-challenge",
        action_id:
          "walk-10-minutes",
        starts_on:
          today,
        ends_on:
          today,
      },
      challenge_checkins: [
        {
          id:
            "physical-review-checkin",
          challenge_id:
            "physical-review-challenge",
          observed_on:
            today,
          action_id:
            "walk-10-minutes",
          status:
            "completed",
        },
      ],
    };
  };

  window.fetch =
    async (
      input,
      init,
    ) => {
      const url =
        new URL(
          typeof input
            === "string"
              ? input
              : input instanceof URL
                ? input.href
                : input.url,
          location.href,
        );

      const method =
        (
          init?.method
          ?? (
            input instanceof Request
              ? input.method
              : "GET"
          )
        ).toUpperCase();

      if (
        url.origin
        === "http://e2e.invalid"
      ) {
        if (
          method === "GET"
          && url.pathname
            === "/api/v1/observations/window"
        ) {
          return new Response(
            JSON.stringify(
              syntheticWindow()
            ),
            {
              status: 200,
              headers: {
                "Content-Type":
                  "application/json",
              },
            },
          );
        }

        throw new Error(
          "Physical review blocks API writes"
        );
      }

      if (
        url.href
        === CONFIG.bearLiteUrl
      ) {
        if (
          method !== "GET"
        ) {
          throw new Error(
            "Candidate GLB is read-only"
          );
        }

        state.activeRequestCount += 1;

        return nativeFetch(
          "/candidate-media/"
          + candidate
          + ".glb",
          {
            cache:
              "no-store",
          },
        );
      }

      if (
        url.origin
          === "https://sk7-companion.gkrry.com"
        && /\\.glb(?:$|\\?)/i.test(
          url.href
        )
      ) {
        throw new Error(
          "Unexpected companion identity in physical review"
        );
      }

      if (
        url.origin
        !== location.origin
      ) {
        throw new Error(
          "Unsupported external request in physical review: "
          + url.href
        );
      }

      if (
        !["GET", "HEAD", "POST"]
          .includes(method)
      ) {
        throw new Error(
          "Unsupported review request"
        );
      }

      return nativeFetch(
        input,
        init,
      );
    };

  function reviewUrl(
    nextCandidate,
    nextScreen,
  ) {
    const next =
      new URL(
        "/",
        location.origin,
      );

    next.searchParams.set(
      "candidate",
      nextCandidate,
    );

    next.searchParams.set(
      "screen",
      nextScreen,
    );

    next.searchParams.set(
      "device",
      deviceClass,
    );

    next.searchParams.set(
      "token",
      CONFIG.token,
    );

    if (
      nextScreen !== "S01"
    ) {
      next.searchParams.set(
        "e2e",
        "signed-in",
      );
    }

    return next.href;
  }

  function readyState() {
    if (
      screen === "S01"
    ) {
      return (
        document
          .querySelector(
            "[data-login-companion] [data-companion-status]"
          )
          ?.getAttribute(
            "data-companion-status"
          )
        === "ready"
      );
    }

    return (
      document
        .querySelector(
          "[data-living-scene-status]"
        )
        ?.getAttribute(
          "data-living-scene-status"
        )
      === "ready"
    );
  }

  function reviewTarget() {
    return screen === "S01"
      ? document.querySelector(
          "[data-login-companion]"
        )
      : document.querySelector(
          ".living-visual-stage[data-living-scene='"
          + screen
          + "']"
        );
  }

  function reviewCanvas() {
    return screen === "S01"
      ? document.querySelector(
          "[data-login-companion] canvas[data-companion-canvas]"
        )
      : document.querySelector(
          ".living-three-scene canvas"
        );
  }

  function rectIntersectsViewport(
    element,
  ) {
    if (!element) {
      return false;
    }

    const rect =
      element.getBoundingClientRect();

    return (
      rect.width > 1
      && rect.height > 1
      && rect.right > 0
      && rect.bottom > 0
      && rect.left < window.innerWidth
      && rect.top < window.innerHeight
    );
  }

  function canvasVisibleState() {
    const canvas =
      reviewCanvas();

    if (!canvas) {
      return false;
    }

    const style =
      getComputedStyle(
        canvas
      );

    return (
      style.display !== "none"
      && style.visibility !== "hidden"
      && Number(style.opacity || "1") > 0
      && rectIntersectsViewport(
        canvas
      )
    );
  }

  function targetInViewportState() {
    return rectIntersectsViewport(
      reviewTarget()
    );
  }

  function subjectVisibleState() {
    if (screen === "S01") {
      return (
        canvasVisibleState()
        && rectIntersectsViewport(
          document.querySelector(
            "[data-login-companion] .companion-runtime-slot"
          )
        )
      );
    }

    const runtime =
      document.querySelector(
        ".living-three-scene[data-subject-bounds]"
      );

    const raw =
      runtime?.getAttribute(
        "data-subject-bounds"
      );

    if (!raw) {
      return false;
    }

    try {
      const bounds =
        JSON.parse(raw);

      const width =
        Number(bounds.right)
        - Number(bounds.left);

      const height =
        Number(bounds.top)
        - Number(bounds.bottom);

      const intersects =
        Number(bounds.right) > -1
        && Number(bounds.left) < 1
        && Number(bounds.top) > -1
        && Number(bounds.bottom) < 1;

      return (
        intersects
        && width > 0.05
        && height > 0.05
      );
    } catch {
      return false;
    }
  }

  function automaticReady() {
    return (
      readyState()
      && state.activeRequestCount === 1
      && document.documentElement.scrollWidth
        <= window.innerWidth
      && canvasVisibleState()
      && targetInViewportState()
      && subjectVisibleState()
    );
  }

  async function focusReviewTarget() {
    for (
      let attempt = 0;
      attempt < 80;
      attempt += 1
    ) {
      const target =
        reviewTarget();

      if (target) {
        target.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "auto",
        });

        if (
          readyState()
          && state.activeRequestCount === 1
        ) {
          return;
        }
      }

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            125,
          )
      );
    }
  }

  function rendererString() {
    const canvas =
      screen === "S01"
        ? document.querySelector(
            "[data-login-companion] canvas"
          )
        : document.querySelector(
            ".living-three-scene canvas"
          );

    if (!canvas) {
      return null;
    }

    const gl =
      canvas.getContext(
        "webgl2"
      )
      ?? canvas.getContext(
        "webgl"
      );

    if (!gl) {
      return null;
    }

    const debug =
      gl.getExtension(
        "WEBGL_debug_renderer_info"
      );

    const key =
      debug
        ? debug.UNMASKED_RENDERER_WEBGL
        : gl.RENDERER;

    return String(
      gl.getParameter(key)
    );
  }

  async function frameSample() {
    const intervals = [];
    let previous =
      performance.now();

    const end =
      previous + 1500;

    await new Promise(resolve => {
      function step(now) {
        intervals.push(
          now - previous
        );

        previous = now;

        if (
          now < end
        ) {
          requestAnimationFrame(
            step
          );
        } else {
          resolve();
        }
      }

      requestAnimationFrame(
        step
      );
    });

    const valid =
      intervals
        .slice(1)
        .filter(
          value =>
            Number.isFinite(value)
            && value > 0
        )
        .sort(
          (a, b) => a - b
        );

    if (!valid.length) {
      return null;
    }

    const mean =
      valid.reduce(
        (sum, value) =>
          sum + value,
        0,
      )
      / valid.length;

    const p95 =
      valid[
        Math.min(
          valid.length - 1,
          Math.floor(
            valid.length
            * 0.95
          ),
        )
      ];

    return {
      sampleCount:
        valid.length,
      fpsFromMeanInterval:
        1000 / mean,
      frameMsP95:
        p95,
    };
  }

  function caseOrder() {
    return CONFIG.species
      .flatMap(
        item =>
          CONFIG.screens
            .map(
              value => ({
                candidate:
                  item,
                screen:
                  value,
              })
            )
      );
  }

  async function submit(
    decision,
  ) {
    if (
      decision === "pass"
      && (
        !automaticReady()
        || !state.humanVisibleConfirmed
      )
    ) {
      alert(
        "PASS 조건이 아직 충족되지 않았습니다. "
        + "캐릭터가 실제로 보이는지 확인하고 체크박스를 선택해 주세요."
      );

      return;
    }

    const rendererReady =
      readyState();

    const overflow =
      document
        .documentElement
        .scrollWidth
      > window.innerWidth;

    const event = {
      documentType:
        "COMPANION_WORLD_V2_PHYSICAL_DEVICE_EVENT",
      deviceClass,
      candidate,
      screen,
      decision,
      viewportWidth:
        window.innerWidth,
      viewportHeight:
        window.innerHeight,
      devicePixelRatio:
        window.devicePixelRatio
        || 1,
      rendererReady,
      activeRequestCount:
        state.activeRequestCount,
      layoutOverflow:
        overflow,
      canvasVisible:
        canvasVisibleState(),
      targetInViewport:
        targetInViewportState(),
      subjectVisible:
        subjectVisibleState(),
      humanVisibleConfirmed:
        state.humanVisibleConfirmed,
      renderer:
        rendererString(),
      frameSample:
        await frameSample(),
      productionActivationApproved:
        false,
    };

    const response =
      await nativeFetch(
        "/review-event?token="
        + CONFIG.token,
        {
          method:
            "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify(
              event
            ),
        },
      );

    if (!response.ok) {
      alert(
        "기록 실패: "
        + await response.text()
      );

      return;
    }

    if (
      decision === "fail"
    ) {
      alert(
        "FAIL이 기록되었습니다. 화면을 확인한 뒤 다른 케이스로 이동하세요."
      );

      return;
    }

    const order =
      caseOrder();

    const index =
      order.findIndex(
        item =>
          item.candidate
            === candidate
          && item.screen
            === screen
      );

    const next =
      order[
        index + 1
      ];

    if (!next) {
      alert(
        "이 기기의 12개 케이스 입력이 끝났습니다."
      );

      return;
    }

    location.href =
      reviewUrl(
        next.candidate,
        next.screen,
      );
  }

  function installToolbar() {
    const bar =
      document.createElement(
        "aside"
      );

    bar.id =
      "sk7-physical-review";

    Object.assign(
      bar.style,
      {
        position:
          "fixed",
        zIndex:
          "2147483647",
        left:
          "8px",
        right:
          "8px",
        bottom:
          "8px",
        padding:
          "9px",
        background:
          "rgba(20,20,20,.94)",
        color:
          "white",
        font:
          "12px system-ui",
        borderRadius:
          "10px",
        boxShadow:
          "0 2px 12px rgba(0,0,0,.3)",
      },
    );

    const info =
      document.createElement(
        "div"
      );

    info.style.marginBottom =
      "7px";

    function refresh() {
      const autoReady =
        automaticReady();

      info.textContent =
        deviceClass
        + " · "
        + candidate
        + " · "
        + screen
        + " · "
        + window.innerWidth
        + "×"
        + window.innerHeight
        + " · ready="
        + readyState()
        + " · glb="
        + state.activeRequestCount
        + " · canvas="
        + canvasVisibleState()
        + " · subject="
        + subjectVisibleState()
        + " · auto="
        + autoReady;

      pass.disabled =
        !autoReady
        || !state.humanVisibleConfirmed;
    }

    setInterval(
      refresh,
      500,
    );

    const visibleLabel =
      document.createElement(
        "label"
      );

    Object.assign(
      visibleLabel.style,
      {
        display:
          "flex",
        alignItems:
          "center",
        gap:
          "7px",
        marginBottom:
          "8px",
        fontSize:
          "14px",
      },
    );

    const visibleCheck =
      document.createElement(
        "input"
      );

    visibleCheck.type =
      "checkbox";

    visibleCheck.style.width =
      "20px";

    visibleCheck.style.height =
      "20px";

    visibleCheck.onchange =
      () => {
        state.humanVisibleConfirmed =
          visibleCheck.checked;
      };

    visibleLabel.append(
      visibleCheck,
      document.createTextNode(
        "캐릭터가 실제 화면에 보입니다"
      ),
    );

    const pass =
      document.createElement(
        "button"
      );

    pass.textContent =
      "PASS";

    pass.disabled =
      true;

    const fail =
      document.createElement(
        "button"
      );

    fail.textContent =
      "FAIL";

    for (
      const button
      of [pass, fail]
    ) {
      Object.assign(
        button.style,
        {
          minHeight:
            "42px",
          marginRight:
            "8px",
          padding:
            "0 18px",
          fontSize:
            "16px",
        },
      );
    }

    pass.onclick =
      () =>
        submit("pass");

    fail.onclick =
      () =>
        submit("fail");

    bar.append(
      info,
      visibleLabel,
      pass,
      fail,
    );

    document.body.append(
      bar
    );

    refresh();
    void focusReviewTarget();
  }

  if (
    document.readyState
    === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      installToolbar,
      {
        once: true,
      },
    );
  } else {
    installToolbar();
  }
})();
`;
}

const injection =
  fixtureScript();

const scriptHash =
  createHash("sha256")
    .update(injection)
    .digest("base64");

const originalHtml =
  files
    .get("/index.html")
    .toString();

const reviewHtml =
  originalHtml.replace(
    "<head>",
    "<head><script>"
      + injection
      + "</script>",
  );

files.set(
  "/index.html",
  Buffer.from(
    reviewHtml,
  ),
);

const baseHeaders = {
  "Cache-Control":
    "no-store",
  "X-Content-Type-Options":
    "nosniff",
  "X-Robots-Tag":
    "noindex, nofollow",
  "Referrer-Policy":
    "no-referrer",
  "Content-Security-Policy":
    [
      "default-src 'none'",
      `script-src 'self' 'sha256-${scriptHash}'`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "font-src 'self' data:",
      "worker-src 'self' blob:",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
};

function authorized(
  req,
  url,
) {
  const queryToken =
    url.searchParams.get(
      "token",
    );

  const cookie =
    req.headers.cookie
    ?? "";

  const cookieToken =
    cookie
      .split(";")
      .map(value =>
        value.trim()
      )
      .find(value =>
        value.startsWith(
          "sk7_review="
        )
      )
      ?.slice(
        "sk7_review=".length,
      );

  return (
    queryToken === token
    || cookieToken === token
  );
}

function json(
  res,
  status,
  body,
  extra = {},
) {
  const bytes =
    Buffer.from(
      JSON.stringify(
        body,
        null,
        2,
      ),
    );

  res.writeHead(
    status,
    {
      ...baseHeaders,
      ...extra,
      "Content-Type":
        "application/json; charset=utf-8",
      "Content-Length":
        bytes.length,
    },
  );

  res.end(bytes);
}

const server =
  createServer(
    (req, res) => {
      const url =
        new URL(
          req.url,
          `http://${req.headers.host ?? "localhost"}`,
        );

      if (
        !authorized(
          req,
          url,
        )
      ) {
        res.writeHead(
          403,
          baseHeaders,
        );

        res.end(
          "Forbidden"
        );

        return;
      }

      const setCookie =
        url.searchParams.get(
          "token",
        ) === token
          ? {
              "Set-Cookie":
                `sk7_review=${token}; Path=/; SameSite=Strict`,
            }
          : {};

      if (
        url.pathname
        === "/review-event"
      ) {
        if (
          req.method !== "POST"
        ) {
          res.writeHead(
            405,
            baseHeaders,
          );

          res.end();

          return;
        }

        let body = "";

        req.on(
          "data",
          chunk => {
            body += chunk;

            if (
              body.length
              > 64 * 1024
            ) {
              req.destroy();
            }
          },
        );

        req.on(
          "end",
          () => {
            try {
              const event =
                validateEvent(
                  JSON.parse(body),
                );

              event.recordedAt =
                new Date()
                  .toISOString();

              appendFileSync(
                eventsFile,
                JSON.stringify(
                  event,
                )
                + "\n",
              );

              json(
                res,
                201,
                {
                  status:
                    "recorded",
                },
                setCookie,
              );
            } catch (
              error
            ) {
              json(
                res,
                422,
                {
                  status:
                    "rejected",
                  error:
                    error instanceof Error
                      ? error.message
                      : String(error),
                },
                setCookie,
              );
            }
          },
        );

        return;
      }

      if (
        url.pathname
        === "/review-status"
      ) {
        const device =
          url.searchParams.get(
            "device",
          );

        if (
          !deviceClasses.includes(
            device
          )
        ) {
          json(
            res,
            400,
            {
              error:
                "invalid device class",
            },
            setCookie,
          );

          return;
        }

        json(
          res,
          200,
          summarizeEvents(
            readEvents(),
            device,
          ),
          setCookie,
        );

        return;
      }

      if (
        ![
          "GET",
          "HEAD",
        ].includes(
          req.method,
        )
      ) {
        res.writeHead(
          405,
          baseHeaders,
        );

        res.end();

        return;
      }

      const name =
        url.pathname === "/"
          ? "/index.html"
          : decodeURIComponent(
              url.pathname
            );

      const bytes =
        files.get(name);

      if (!bytes) {
        res.writeHead(
          404,
          baseHeaders,
        );

        res.end(
          "Not found"
        );

        return;
      }

      res.writeHead(
        200,
        {
          ...baseHeaders,
          ...setCookie,
          "Content-Type":
            mime[
              path.extname(name)
                .toLowerCase()
            ]
            ?? "application/octet-stream",
          "Content-Length":
            bytes.length,
        },
      );

      res.end(
        req.method === "HEAD"
          ? undefined
          : bytes,
      );
    },
  );

server.listen(
  port,
  "0.0.0.0",
  () => {
    console.log(
      `SK7 physical device review listening on 0.0.0.0:${port}`,
    );

    console.log(
      `active registered request: ${bearLiteUrl}`,
    );

    console.log(
      `candidate files: ${candidateFiles.size}`,
    );
  },
);
