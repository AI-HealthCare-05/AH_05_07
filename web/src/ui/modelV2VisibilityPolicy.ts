// Executable presentation policy for docs/model-v2-product-contract.md / #396.
// Keep this outside the sealed inference graph: it never changes computation.
export const MODEL_V2_PREVIEW_WINDOW = Object.freeze({
  start: "2026-09-17",
  end: "2026-10-17",
});

export type ModelV2PresentationMode = "research_preview" | "non_numeric";

// The caller supplies the current Asia/Seoul calendar date (useSeoulDate for
// rollover/resume, seoulDate again at asynchronous completion). Invalid dates
// fail closed. The end date is inclusive; the next KST midnight expires output.
export function modelV2PresentationMode(kstDate: string): ModelV2PresentationMode {
  const { start, end } = MODEL_V2_PREVIEW_WINDOW;
  return /^\d{4}-\d{2}-\d{2}$/.test(kstDate)
    && Number.isFinite(Date.parse(`${kstDate}T00:00:00+09:00`))
    && new Date(`${kstDate}T00:00:00Z`).toISOString().slice(0, 10) === kstDate
    && start <= kstDate && kstDate <= end
    ? "research_preview"
    : "non_numeric";
}

// Do not retain a raw output outside the authorized window or round it here.
export function visibleModelV2Output(output: number | null, kstDate: string): number | null {
  return modelV2PresentationMode(kstDate) === "research_preview"
    && output !== null && Number.isFinite(output) ? output : null;
}

const [endYear, endMonth, endDay] = MODEL_V2_PREVIEW_WINDOW.end.split("-");
export const modelV2PreviewEndLabel = `${endYear}년 ${Number(endMonth)}월 ${Number(endDay)}일(KST)`;
