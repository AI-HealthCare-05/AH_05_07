import { adaptProductInput, FEATURES, validateSemanticInput } from "./adapter";
import { ModelV2LocalError } from "./errors";
import manifest from "./manifest.json";

const CANONICAL_SHA = "d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84";
const SCHEMA = "model-v2-r1-schema-v1";
const WORDING = "입력 기반 위험군 선별 신호";

type Model = {
  format: string;
  canonical_sha256: string;
  schema_version: string;
  product_wording: string;
  feature_order: string[];
  numeric: { names: string[]; median: number[]; mean: number[]; scale: number[] };
  categorical: { names: string[]; categories: (string | number)[][]; fill: string };
  linear: { weights: number[]; intercept: number; classes: number[] };
};
export type Projection = { schema_version: string; product_wording: string };
export type LocalModelV2Result = { projection: Projection; continuousOutput: number };

const unavailable = () => new ModelV2LocalError("inference_unavailable");
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const finiteArray = (value: unknown, size: number): value is number[] =>
  Array.isArray(value) && value.length === size && value.every((n) => typeof n === "number" && Number.isFinite(n));

function validateModel(value: unknown): Model {
  // This accepts one frozen representation, not an extensible model format.
  const model = value as Model | null;
  if (!model || model.format !== "sk7-model-v2-local-v1"
    || model.canonical_sha256 !== CANONICAL_SHA || model.schema_version !== SCHEMA
    || model.product_wording !== WORDING || !same(model.feature_order, FEATURES)
    || !same(model.numeric?.names, [FEATURES[0], FEATURES[2], FEATURES[6], FEATURES[7], FEATURES[9], FEATURES[10]])
    || !same(model.categorical?.names, [FEATURES[1], FEATURES[3], FEATURES[4], FEATURES[5], FEATURES[8]])
    || !finiteArray(model.numeric?.median, 6) || !finiteArray(model.numeric?.mean, 6)
    || !finiteArray(model.numeric?.scale, 6) || model.numeric.scale.some((n) => n <= 0)
    || model.categorical.fill !== "__missing__" || !Array.isArray(model.categorical.categories)
    || model.categorical.categories.length !== 5
    || !model.categorical.categories.every((categories, i) => Array.isArray(categories)
      && categories.length === [2, 5, 8, 7, 7][i]
      && categories.every((category) => typeof category === (i === 0 ? "number" : "string")))
    || !finiteArray(model.linear?.weights, 35) || !Number.isFinite(model.linear.intercept)
    || !same(model.linear.classes, [0, 1])) throw unavailable();
  return model;
}

export async function loadVerifiedModel(): Promise<Model> {
  const expectedHash = manifest.sha256;
  const controller = new AbortController();
  let rejectTimeout!: (error: Error) => void;
  const deadline = new Promise<never>((_, reject) => { rejectTimeout = reject; });
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const timeout = setTimeout(() => {
    controller.abort();
    void reader?.cancel().catch(() => {});
    rejectTimeout(unavailable());
  }, 8_000);
  try {
    if (!globalThis.crypto?.subtle || !/^[a-f0-9]{64}$/.test(expectedHash)) throw unavailable();
    const response = await Promise.race([fetch(`${import.meta.env.BASE_URL}models/model-v2.json`, {
      cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", signal: controller.signal,
    }), deadline]);
    if (!response.ok || !response.body || Number(response.headers.get("Content-Length")) > 32_768) throw unavailable();
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > 32_768) { await reader.cancel(); throw unavailable(); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const digest = await Promise.race([crypto.subtle.digest("SHA-256", bytes), deadline]);
    const actualHash = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
    if (actualHash !== expectedHash) throw unavailable();
    // No parsing or inference occurs before the build-pinned digest matches.
    return validateModel(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } catch {
    controller.abort();
    void reader?.cancel().catch(() => {});
    throw unavailable();
  } finally {
    clearTimeout(timeout);
  }
}

// Internal diagnostics are imported only by the separate test entry.
// The product facade returns only the existing two-field projection.
export function evaluateSemantic(model: Model, input: unknown): { preprocessed: number[]; score: number } {
  const clean = validateSemanticInput(input);
  const preprocessed = model.numeric.names.map((name, i) =>
    ((clean[name] ?? model.numeric.median[i]) as number) - model.numeric.mean[i]);
  for (let i = 0; i < preprocessed.length; i += 1) preprocessed[i] /= model.numeric.scale[i];
  model.categorical.names.forEach((name, i) => {
    const value = clean[name] ?? model.categorical.fill;
    for (const category of model.categorical.categories[i]) preprocessed.push(value === category ? 1 : 0);
  });
  let decision = model.linear.intercept;
  // Match sklearn's dense dot then intercept ordering.
  let dot = 0;
  for (let i = 0; i < preprocessed.length; i += 1) dot += preprocessed[i] * model.linear.weights[i];
  decision += dot;
  if (!preprocessed.every(Number.isFinite) || !Number.isFinite(decision)) throw unavailable();
  const exponential = Math.exp(decision < 0 ? decision : -decision);
  const score = decision < 0 ? exponential / (1 + exponential) : 1 / (1 + exponential);
  if (!Number.isFinite(score)) throw unavailable();
  return { preprocessed, score };
}

export function scoreProduct(model: Model, input: unknown): Projection {
  return projectSemantic(model, adaptProductInput(input));
}

// Validation precedes asset loading; neither input nor numeric output is cached.
// Each deliberate submission performs one verified load, with no retry/fallback.
// The browser-local return carries the two-field product projection plus a raw
// continuous value for the time-boxed S11 research preview. It is never an API
// response and is discarded outside the preview window.
export async function scoreModelV2Locally(input: unknown): Promise<LocalModelV2Result> {
  const semantic = adaptProductInput(input);
  const model = await loadVerifiedModel();
  const { score } = evaluateSemantic(model, semantic);
  return {
    projection: { schema_version: SCHEMA, product_wording: WORDING },
    continuousOutput: score,
  };
}

function projectSemantic(model: Model, semantic: unknown): Projection {
  evaluateSemantic(model, semantic);
  return { schema_version: SCHEMA, product_wording: WORDING };
}
