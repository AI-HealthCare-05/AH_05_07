import { buildPayload } from "../../src/components/modelV2Draft";
import { adaptProductInput } from "../../src/lib/model-v2/adapter";
import { evaluateSemantic, loadVerifiedModel, scoreModelV2Locally, scoreProduct } from "../../src/lib/model-v2/runtime";

type Case = { kind: "product" | "semantic"; input: unknown };
const started = performance.now();
const model = await loadVerifiedModel();
const verification = {
  draftPayload: buildPayload,
  coldLoadMs: performance.now() - started,
  run(cases: Case[]) {
    return cases.map((testCase) => {
      try {
        const semantic = testCase.kind === "product" ? adaptProductInput(testCase.input) : testCase.input;
        const result = evaluateSemantic(model, semantic);
        const projection = testCase.kind === "product" ? scoreProduct(model, testCase.input) : {
          schema_version: model.schema_version, product_wording: model.product_wording,
        };
        return { ok: true, semantic, ...result, projection };
      } catch (error) {
        return { ok: false, error: error instanceof Error && error.message === "input_invalid" ? "input_invalid" : "inference_unavailable" };
      }
    });
  },
  mutated(cases: Case[]) {
    const original = model.linear.weights[0];
    model.linear.weights[0] += 0.125;
    try { return this.run(cases); } finally { model.linear.weights[0] = original; }
  },
  async publicExecutionGuard(input: unknown) {
    // Prove the changed async facade carries the real continuous value and the
    // two-field projection, for the ordinary synthetic product and an older-age
    // variant, before the deliberate poison test below.
    const candidates = [input, { ...(input as Record<string, unknown>), age_years: 80 }];
    for (const candidate of candidates) {
      const result = await scoreModelV2Locally(candidate);
      if (!Number.isFinite(result.continuousOutput)) throw new Error("mismatch");
      const expected = evaluateSemantic(model, adaptProductInput(candidate)).score;
      if (result.continuousOutput !== expected) throw new Error("mismatch");
      const keys = Object.keys(result).sort();
      if (keys.length !== 2 || keys[0] !== "continuousOutput" || keys[1] !== "projection") throw new Error("mismatch");
      const projection = scoreProduct(model, candidate);
      if (result.projection.schema_version !== projection.schema_version
        || result.projection.product_wording !== projection.product_wording) throw new Error("mismatch");
    }

    // Test-only poison after digest verification. Finite positive scale passes
    // the artifact shape guard but overflows during actual preprocessing.
    // This proves the exact async S11 facade executes, not just scoreProduct.
    const original = JSON.parse;
    JSON.parse = (...args) => {
      const parsed = original(...args);
      if (parsed?.format === "sk7-model-v2-local-v1") parsed.numeric.scale[0] = Number.MIN_VALUE;
      return parsed;
    };
    try { await scoreModelV2Locally(input); return "unexpected_success"; }
    catch (error) { return error instanceof Error ? error.message : "unexpected_error"; }
    finally { JSON.parse = original; }
  },
  benchmark(input: unknown) {
    const samples: number[] = [];
    for (let run = 0; run < 30; run += 1) {
      const start = performance.now();
      for (let i = 0; i < 1_000; i += 1) scoreProduct(model, input);
      samples.push((performance.now() - start) / 1_000);
    }
    return samples;
  },
};
Object.assign(window, { verification });
