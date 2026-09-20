import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";

import type { ScreenId } from "../ui/journey";

export type JourneyFeedbackPhase = "loading" | "content" | "error";

type JourneyTransitionOptions = {
  viewportRef: RefObject<HTMLElement | null>;
  activeScreen: ScreenId;
  phase: JourneyFeedbackPhase;
  sessionGeneration: number;
  journeyPresentation: boolean;
  suspended: boolean;
  reducedMotion: boolean;
};

type PresentationSnapshot = Pick<JourneyTransitionOptions, "activeScreen" | "phase" | "sessionGeneration">;

const transitionTiming = {
  enter: {
    keyframes: [
      { opacity: 0.9, transform: "translateY(4px)" },
      { opacity: 1, transform: "none" },
    ],
    duration: 160,
  },
  reveal: {
    keyframes: [
      { opacity: 0.92 },
      { opacity: 1 },
    ],
    duration: 120,
  },
} as const;

/** Presentation-only motion over the existing viewport DOM. */
export function useJourneyTransition({
  viewportRef,
  activeScreen,
  phase,
  sessionGeneration,
  journeyPresentation,
  suspended,
  reducedMotion,
}: JourneyTransitionOptions) {
  const previous = useRef<PresentationSnapshot | null>(null);
  const ownedAnimation = useRef<Animation | null>(null);

  const cancelOwnedAnimation = useCallback(() => {
    const animation = ownedAnimation.current;
    ownedAnimation.current = null;
    if (!animation) return;
    try {
      animation.cancel();
    } catch {
      // Cancellation is best-effort; the CSS state is already fully visible.
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) cancelOwnedAnimation();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [cancelOwnedAnimation]);

  useLayoutEffect(() => {
    const prior = previous.current;
    const current = { activeScreen, phase, sessionGeneration };
    previous.current = current;
    cancelOwnedAnimation();

    if (
      !prior
      || !journeyPresentation
      || suspended
      || reducedMotion
      || document.hidden
      || prior.sessionGeneration !== sessionGeneration
      || phase !== "content"
      || activeScreen === "S05"
      || activeScreen === "S13"
    ) return;

    const transition = prior.phase === "loading"
      ? transitionTiming.reveal
      : prior.phase === "content" && prior.activeScreen !== activeScreen
        ? transitionTiming.enter
        : null;
    if (!transition) return;

    const target = viewportRef.current?.querySelector<HTMLElement>(".scene-copy");
    if (!target || typeof target.animate !== "function") return;

    try {
      const animation = target.animate([...transition.keyframes], {
        duration: transition.duration,
        easing: "cubic-bezier(.16, 1, .3, 1)",
      });
      ownedAnimation.current = animation;
      void animation.finished
        .catch(() => undefined)
        .then(() => {
          if (ownedAnimation.current === animation) ownedAnimation.current = null;
        });
    } catch {
      ownedAnimation.current = null;
    }
  }, [
    activeScreen,
    cancelOwnedAnimation,
    journeyPresentation,
    phase,
    reducedMotion,
    sessionGeneration,
    suspended,
    viewportRef,
  ]);

  useEffect(() => () => cancelOwnedAnimation(), [cancelOwnedAnimation]);
}
