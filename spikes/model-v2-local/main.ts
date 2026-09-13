import { loadVerifiedModel, scoreProduct } from "./runtime";

declare const __MODEL_SHA__: string;
const input = document.querySelector<HTMLTextAreaElement>("textarea")!;
const button = document.querySelector<HTMLButtonElement>("button")!;
const output = document.querySelector<HTMLOutputElement>("output")!;
input.value = JSON.stringify({
  age_years: 35, sex_knhanes: 1, height_cm: 170, weight_kg: 68,
  cigarette_smoking_state: "never_smoked", alcohol_frequency: "lt_monthly", alcohol_amount_category: "1_2_drinks",
  walking_days_7d: 4, walking_active_day_hours: 0, walking_active_day_minutes: 40, strength_days_7d: "2_days",
  weekday_bed_hour: 23, weekday_bed_minute: 30, weekday_wake_hour: 7, weekday_wake_minute: 0,
  weekend_bed_hour: 0, weekend_bed_minute: 0, weekend_wake_hour: 8, weekend_wake_minute: 0,
}, null, 2);

loadVerifiedModel(__MODEL_SHA__).then((model) => {
  button.disabled = false;
  output.value = "모델 무결성 확인 완료 · 합성 입력 실행 가능";
  document.querySelector("form")!.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const result = scoreProduct(model, JSON.parse(input.value));
      output.value = JSON.stringify(result, null, 2);
    } catch {
      output.value = "입력을 확인해 주세요. 입력값이나 내부 결과는 전송하지 않았습니다.";
    }
  });
}).catch(() => {
  output.value = "모델을 확인할 수 없어 실행하지 않았습니다. 다시 시도하려면 새로고침해 주세요.";
});
