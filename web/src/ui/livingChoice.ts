// Disposable, cosmetic visit context. Never domain truth or persistence authority.
export type LivingChoice = "walk-10-minutes" | "sleep-routine" | "low-sodium-meal";
export function livingChoice(value: unknown): LivingChoice | null {
  return value === "walk-10-minutes" || value === "sleep-routine" || value === "low-sodium-meal" ? value : null;
}
export function readLivingChoice(search: string): LivingChoice | null {
  const values = new URLSearchParams(search).getAll("living_choice");
  return values.length === 1 ? livingChoice(values[0]) : null;
}
export function livingChoiceQuery(value: unknown): string {
  const choice = livingChoice(value);
  return choice ? `&living_choice=${choice}` : "";
}
export const livingChoiceLabel: Record<LivingChoice, string> = {
  "walk-10-minutes": "10분 걷기",
  "sleep-routine": "수면 시간 지키기",
  "low-sodium-meal": "덜 짜게 먹기",
};
