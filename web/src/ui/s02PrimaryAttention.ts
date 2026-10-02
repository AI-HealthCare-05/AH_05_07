export const s02PrimaryAttentionEventName = "sk7:s02-primary-attention";

export type S02PrimaryAttentionDetail = Readonly<{
  kind: "primary-action";
  clientX: number;
  clientY: number;
}>;

/**
 * Presentation-only bridge from the existing S02 primary action to the
 * decorative companion. Carries only the trigger's screen position.
 */
export function dispatchS02PrimaryAttention(trigger: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  if (
    rect.width <= 0
    || rect.height <= 0
    || !Number.isFinite(rect.left)
    || !Number.isFinite(rect.top)
  ) return;

  const detail: S02PrimaryAttentionDetail = Object.freeze({
    kind: "primary-action",
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  });

  window.dispatchEvent(
    new CustomEvent<S02PrimaryAttentionDetail>(
      s02PrimaryAttentionEventName,
      { detail },
    ),
  );
}
