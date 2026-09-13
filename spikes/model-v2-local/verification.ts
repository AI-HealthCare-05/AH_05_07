import { adaptProductInput } from "./adapter";
import { evaluateSemantic, loadVerifiedModel, scoreProduct } from "./runtime";

declare const __MODEL_SHA__: string;
type Case = { kind: "product" | "semantic"; input: unknown };
const started = performance.now();
const model = await loadVerifiedModel(__MODEL_SHA__);
const verification = {
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
  publicExecutionGuard(input: unknown) {
    const original = model.linear.weights[0];
    model.linear.weights[0] = NaN;
    try { scoreProduct(model, input); return "unexpected_success"; }
    catch (error) { return error instanceof Error ? error.message : "unexpected_error"; }
    finally { model.linear.weights[0] = original; }
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
