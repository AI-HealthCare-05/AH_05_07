// Only safe, value-free error codes may cross into the product layer.
export class ModelV2LocalError extends Error {
  constructor(readonly code: "input_invalid" | "inference_unavailable") {
    super(code);
    this.name = "ModelV2LocalError";
  }
}
