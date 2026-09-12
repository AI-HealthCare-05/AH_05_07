import { clockParts, finiteNumber, type Draft } from "./modelV2Draft";

export type InputStep = "basics" | "habits" | "activity" | "sleep";
export type Step = "intro" | InputStep | "review";

export const INPUT_STEPS: readonly InputStep[] = ["basics", "habits", "activity", "sleep"];
export const PROGRESS_STEPS = [...INPUT_STEPS, "review"] as const;
export const STEPS = {
  basics: { label: "기본 정보", description: "나이와 체격부터 차근차근 입력해 주세요.", fields: ["age", "sex", "height", "weight"] },
  habits: { label: "생활 습관", description: "현재 흡연 상태와 평소 음주 습관을 선택해 주세요.", fields: ["smoking", "alcoholFrequency", "alcoholAmount"] },
  activity: { label: "활동", description: "최근 7일 동안의 걷기와 근력운동을 떠올려 주세요.", fields: ["walkingDays", "walkingHours", "walkingMinutes", "strengthDays"] },
  sleep: { label: "수면", description: "평일과 주말에 잠들고 일어나는 시간을 각각 선택해 주세요.", fields: ["weekdayBed", "weekdayWake", "weekendBed", "weekendWake"] },
  review: { label: "입력 확인", description: "보내려던 내용이 맞는지 확인해 주세요. 각 항목에서 다시 수정할 수 있어요." },
} as const;

type Field = {
  id: string;
  label: string;
  type?: "number" | "time";
  unit?: string;
  min?: string;
  max?: string;
  step?: string;
  inputMode?: "numeric" | "decimal";
  options?: readonly (readonly [string, string])[];
};

// Labels and option values are shared by the controls and transient review.
// The browser-to-API mapping remains in buildPayload, separate from presentation.
export const FIELDS: Record<keyof Draft, Field> = {
  age: { id: "model-age", label: "나이", type: "number", min: "19", step: "1", inputMode: "numeric" },
  sex: { id: "model-sex", label: "성별", options: [["1", "남성"], ["2", "여성"]] },
  height: { id: "model-height", label: "키", unit: "cm", type: "number", min: "1", step: "0.1", inputMode: "decimal" },
  weight: { id: "model-weight", label: "몸무게", unit: "kg", type: "number", min: "1", step: "0.1", inputMode: "decimal" },
  smoking: { id: "model-smoking", label: "흡연 상태", options: [
    ["daily_current", "현재 매일 흡연"], ["occasional_current", "현재 가끔 흡연"],
    ["former_currently_not_smoking", "과거 흡연, 현재 금연"], ["never_smoked", "비흡연"],
  ] },
  alcoholFrequency: { id: "model-alcohol-frequency", label: "음주 빈도", options: [
    ["none_past_year", "최근 1년간 마시지 않음"], ["lt_monthly", "월 1회 미만"],
    ["monthly_once", "월 1회 정도"], ["monthly_2_4", "월 2~4회"],
    ["weekly_2_3", "주 2~3회"], ["weekly_4_plus", "주 4회 이상"],
    ["lifetime_nonapplicable", "평생 마시지 않음"],
  ] },
  alcoholAmount: { id: "model-alcohol-amount", label: "한 번 마실 때 음주량", options: [
    ["1_2_drinks", "1~2잔"], ["3_4_drinks", "3~4잔"], ["5_6_drinks", "5~6잔"],
    ["7_9_drinks", "7~9잔"], ["10_plus_drinks", "10잔 이상"], ["none", "해당 없음"],
  ] },
  walkingDays: { id: "model-walking-days", label: "최근 7일 걷기 일수", type: "number", min: "0", max: "7", step: "1", inputMode: "numeric" },
  walkingHours: { id: "model-walking-hours", label: "걷는 날 하루 평균 시간", unit: "시간", type: "number", min: "0", max: "24", step: "1", inputMode: "numeric" },
  walkingMinutes: { id: "model-walking-minutes", label: "걷는 날 추가 시간", unit: "분", type: "number", min: "0", max: "59", step: "1", inputMode: "numeric" },
  strengthDays: { id: "model-strength", label: "최근 7일 근력운동", options: [
    ["0_days", "0일"], ["1_day", "1일"], ["2_days", "2일"],
    ["3_days", "3일"], ["4_days", "4일"], ["5_plus_days", "5일 이상"],
  ] },
  weekdayBed: { id: "model-weekday-bed", label: "평일 취침 시간", type: "time" },
  weekdayWake: { id: "model-weekday-wake", label: "평일 기상 시간", type: "time" },
  weekendBed: { id: "model-weekend-bed", label: "주말 취침 시간", type: "time" },
  weekendWake: { id: "model-weekend-wake", label: "주말 기상 시간", type: "time" },
};

export type StepProblem = { step: InputStep; fields: (keyof Draft)[]; message: string };

export function stepProblem(step: InputStep, draft: Draft): StepProblem | null {
  // Preserve the existing explicit client checks. Native min/step attributes
  // are hints, not new eligibility rules; the API owns combination validation.
  const missing = STEPS[step].fields.filter((key) => {
    if (FIELDS[key].type === "time") return clockParts(draft[key]) === null;
    if (FIELDS[key].type === "number") return finiteNumber(draft[key]) === null;
    return !draft[key];
  });
  if (missing.length) return {
    step, fields: missing,
    message: step === "sleep" ? "시간 항목을 모두 선택해 주세요." : "필수 입력 항목을 모두 확인해 주세요.",
  };
  if (step === "basics" && finiteNumber(draft.age)! < 19) return {
    step, fields: ["age"], message: "이 기능은 만 19세 이상에서만 사용할 수 있습니다.",
  };
  return null;
}

export function reviewValue(key: keyof Draft, draft: Draft): string {
  const field = FIELDS[key];
  if (field.options) return field.options.find(([value]) => value === draft[key])?.[1] ?? "선택 필요";
  const unit = field.unit ?? (key === "age" ? "세" : key === "walkingDays" ? "일" : "");
  return `${draft[key]}${unit ? ` ${unit}` : ""}`;
}
