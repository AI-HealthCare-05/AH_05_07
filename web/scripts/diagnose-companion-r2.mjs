const url = "https://sk7-companion.gkrry.com/companion/v1/bear/v007/lite.glb";
const origin = "http://127.0.0.1:4173";

const response = await fetch(url, { headers: { Origin: origin } });
const result = {
  status: response.status,
  accessControlAllowOrigin: response.headers.get("access-control-allow-origin"),
  contentType: response.headers.get("content-type"),
  cfMitigated: response.headers.get("cf-mitigated"),
  redirected: response.redirected,
};
await response.body?.cancel();
console.log("companion runtime transport", JSON.stringify(result));
if (
  result.status !== 200
  || result.accessControlAllowOrigin !== origin
  || result.contentType !== "model/gltf-binary"
  || result.cfMitigated !== null
  || result.redirected
) {
  throw new Error("companion runtime delivery transport assertion failed");
}
