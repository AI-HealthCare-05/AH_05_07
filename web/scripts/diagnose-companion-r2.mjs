const url = "https://sk7-assets.gomdory.com/companion/v1/bear/v007/lite.glb";
const origin = "http://127.0.0.1:4173";

try {
  const response = await fetch(url, {
    headers: { Origin: origin },
  });

  console.log(
    "companion R2 Node fetch",
    JSON.stringify({
      fetch: "success",
      status: response.status,
      "access-control-allow-origin": response.headers.get("access-control-allow-origin"),
      "access-control-allow-methods": response.headers.get("access-control-allow-methods"),
      "content-type": response.headers.get("content-type"),
      "cache-control": response.headers.get("cache-control"),
      "cf-cache-status": response.headers.get("cf-cache-status"),
      "cf-mitigated": response.headers.get("cf-mitigated"),
      server: response.headers.get("server"),
      "content-length": response.headers.get("content-length"),
    }),
  );

  await response.body?.cancel();
} catch (error) {
  console.log(
    "companion R2 Node fetch",
    JSON.stringify({
      fetch: "failure",
      error: {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      },
    }),
  );
}
