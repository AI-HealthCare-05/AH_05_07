export const livingReplayAttentionEventName = "sk7:living-replay-attention";

export type LivingReplayAttentionDetail = Readonly<{
  kind: "day-focus";
  clientX: number;
  clientY: number;
}>;

/**
 * Presentation-only bridge from an explicit S10 day focus to the decorative
 * companion. It carries only the trigger's screen position, never record facts.
 */
export function dispatchLivingReplayDayFocus(trigger: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const detail: LivingReplayAttentionDetail = {
    kind: "day-focus",
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };

  window.dispatchEvent(
    new CustomEvent<LivingReplayAttentionDetail>(livingReplayAttentionEventName, { detail }),
  );
}
