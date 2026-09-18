import { clockParts, finiteNumber, type Draft } from "./modelV2Draft";

export type InputStep = "basics" | "habits" | "activity" | "sleep";
export type Step = "intro" | InputStep | "review";

export const INPUT_STEPS: readonly InputStep[] = ["basics", "activity", "sleep", "habits"];
export const PROGRESS_STEPS = [...INPUT_STEPS, "review"] as const;
export const STEPS = {
  basics: { label: "기본 정보", description: "이번 생활정보 계산에 필요한 기본 항목이에요.", fields: ["age", "sex", "height", "weight"] },
  habits: { label: "흡연·음주", description: "일반담배를 피우는 현재 상태와 최근 1년의 음주 경험을 알려 주세요.", fields: ["smoking", "alcoholFrequency", "alcoholAmount"] },
  activity: { label: "최근 7일 활동", description: "최근 7일 동안 걸은 날과 근력운동을 한 날을 떠올려 주세요.", fields: ["walkingDays", "walkingHours", "walkingMinutes", "strengthDays"] },
  sleep: { label: "평일·주말 수면", description: "평일과 주말에 보통 취침하고 기상하는 시각을 알려 주세요.", fields: ["weekdayBed", "weekdayWake", "weekendBed", "weekendWake"] },
  review: { label: "입력 확인", description: "입력한 내용이 맞는지 확인해 주세요. 수정한 뒤 이 화면으로 돌아올 수 있어요." },
} as const;

type Field = {
  id: string;
  label: string;
  inputLabel?: string;
  help?: string;
  type?: "number" | "time";
  unit?: string;
  min?: string;
  max?: string;
  step?: string;
  inputMode?: "numeric" | "decimal";
  options?: readonly (readonly [value: string, label: string, inputLabel?: string])[];
};

// Keep concise review/result copy separate from survey questions and option copy.
// The transient product mapping remains in buildPayload, separate from presentation.
export const FIELDS: Record<keyof Draft, Field> = {
  age: { id: "model-age", label: "만 나이", type: "number", min: "19", step: "1", inputMode: "numeric" },
  sex: { id: "model-sex", label: "성별", options: [["1", "남성"], ["2", "여성"]] },
  height: { id: "model-height", label: "키", unit: "cm", type: "number", min: "1", step: "0.1", inputMode: "decimal" },
  weight: { id: "model-weight", label: "몸무게", unit: "kg", type: "number", min: "1", step: "0.1", inputMode: "decimal" },
  smoking: { id: "model-smoking", label: "흡연 상태", inputLabel: "일반담배(궐련) 흡연 상태는 어떤가요?",
    help: "일반담배만 기준으로 답해 주세요. 전자담배 등 다른 담배 제품은 포함하지 않아요.", options: [
    ["daily_current", "현재 매일 흡연", "현재 매일 피워요"], ["occasional_current", "현재 가끔 흡연", "현재 가끔 피워요"],
    ["former_currently_not_smoking", "과거 흡연, 현재 금연", "전에 피웠지만 지금은 피우지 않아요"], ["never_smoked", "비흡연", "피운 적이 없어요"],
  ] },
  alcoholFrequency: { id: "model-alcohol-frequency", label: "음주 빈도", inputLabel: "최근 1년 동안 술을 얼마나 자주 마셨나요?", options: [
    ["none_past_year", "최근 1년간 마시지 않음", "최근 1년 동안 마시지 않았어요"], ["lt_monthly", "월 1회 미만", "한 달에 1번 미만"],
    ["monthly_once", "월 1회 정도", "한 달에 1번 정도"], ["monthly_2_4", "월 2~4회", "한 달에 2~4번"],
    ["weekly_2_3", "주 2~3회", "일주일에 2~3번"], ["weekly_4_plus", "주 4회 이상", "일주일에 4번 이상"],
    ["lifetime_nonapplicable", "평생 마시지 않음", "술을 마신 적이 없어요"],
  ] },
  alcoholAmount: { id: "model-alcohol-amount", label: "한 번 마실 때 음주량", inputLabel: "술을 마실 때, 보통 한 번에 몇 잔 마시나요?", options: [
    ["1_2_drinks", "1~2잔"], ["3_4_drinks", "3~4잔"], ["5_6_drinks", "5~6잔"],
    ["7_9_drinks", "7~9잔"], ["10_plus_drinks", "10잔 이상"], ["none", "해당 없음"],
  ] },
  walkingDays: { id: "model-walking-days", label: "최근 7일 걷기 일수", inputLabel: "최근 7일 동안 걸은 날은 며칠인가요?",
    help: "같은 날 여러 번 걸었어도 하루로 세어 주세요.", type: "number", min: "0", max: "7", step: "1", inputMode: "numeric" },
  walkingHours: { id: "model-walking-hours", label: "걷는 날 하루 평균 시간", inputLabel: "시간", unit: "시간", type: "number", min: "0", max: "24", step: "1", inputMode: "numeric" },
  walkingMinutes: { id: "model-walking-minutes", label: "걷는 날 하루 평균 분", inputLabel: "분", unit: "분", type: "number", min: "0", max: "59", step: "1", inputMode: "numeric" },
  strengthDays: { id: "model-strength", label: "최근 7일 근력운동", inputLabel: "최근 7일 동안 근력운동을 한 날은 며칠인가요?", options: [
    ["0_days", "0일", "하지 않았어요 · 0일"], ["1_day", "1일"], ["2_days", "2일"],
    ["3_days", "3일"], ["4_days", "4일"], ["5_plus_days", "5일 이상"],
  ] },
  weekdayBed: { id: "model-weekday-bed", label: "평일 취침 시간", type: "time" },
  weekdayWake: { id: "model-weekday-wake", label: "평일 기상 시간", type: "time" },
  weekendBed: { id: "model-weekend-bed", label: "주말 취침 시간", type: "time" },
  weekendWake: { id: "model-weekend-wake", label: "주말 기상 시간", type: "time" },
};

export type StepProblem = { step: InputStep; fields: (keyof Draft)[]; message: string };

export function formatTimeKorean(value: string): string {
  const parts = clockParts(value);
  if (!parts) return "선택 필요";
  const [hour, minute] = parts;
  const period = hour < 12 ? "오전" : "오후";
  const twelveHour = hour % 12 || 12;
  return `${period} ${twelveHour}:${String(minute).padStart(2, "0")}`;
}

export function stepProblem(step: InputStep, draft: Draft): StepProblem | null {
  // Native min/step attributes are hints, not generic eligibility rules.
  // Mirror only these explicit adapter checks; final semantic validation stays in the adapter.
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
    step, fields: ["age"], message: "이 도구는 만 19세 이상부터 이용할 수 있어요.",
  };
  if (step === "activity") {
    for (const [key, maximum, message] of [
      ["walkingDays", 7, "걷기 일수는 0~7일 중 소수점 없이 입력해 주세요."],
      ["walkingHours", 24, "시간은 0~24 중 소수점 없이 입력해 주세요."],
      ["walkingMinutes", 59, "분은 0~59 중 소수점 없이 입력해 주세요."],
    ] as const) {
      const value = finiteNumber(draft[key])!;
      if (!Number.isInteger(value) || value < 0 || value > maximum) return {
        step, fields: [key], message,
      };
    }
  }
  if (step === "habits") {
    const nonDrinking = draft.alcoholFrequency === "none_past_year"
      || draft.alcoholFrequency === "lifetime_nonapplicable";
    if (nonDrinking && draft.alcoholAmount !== "none") return {
      step, fields: ["alcoholAmount"],
      message: "마시지 않았다고 답한 경우 음주량은 ‘해당 없음’으로 처리돼요. 음주 빈도를 다시 확인해 주세요.",
    };
    if (!nonDrinking && draft.alcoholAmount === "none") return {
      step, fields: ["alcoholAmount"],
      message: "술을 마셨다고 답한 경우에는 ‘해당 없음’을 선택할 수 없어요. 보통 한 번에 마시는 양을 선택해 주세요.",
    };
  }
  return null;
}

export function reviewValue(key: keyof Draft, draft: Draft): string {
  const field = FIELDS[key];
  if (field.options) return field.options.find(([value]) => value === draft[key])?.[1] ?? "선택 필요";
  if (field.type === "time") return formatTimeKorean(draft[key]);
  const unit = field.unit ?? (key === "age" ? "세" : key === "walkingDays" ? "일" : "");
  return `${draft[key]}${unit ? ` ${unit}` : ""}`;
}
