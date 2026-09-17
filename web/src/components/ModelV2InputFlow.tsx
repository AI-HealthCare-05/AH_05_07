import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { scoreModelV2Locally } from "../lib/model-v2/runtime";
import { ModelV2LocalError } from "../lib/model-v2/errors";
import { seoulDate } from "../lib/seoulDate";
import { useSeoulDate } from "../lib/useSeoulDate";
import { Scene } from "./SceneShell";
import { buildPayload, clockParts, EMPTY_DRAFT, finiteNumber, TIME_FIELD_KEYS, type Draft } from "./modelV2Draft";
import { FIELDS, formatTimeKorean, INPUT_STEPS, PROGRESS_STEPS, reviewValue, STEPS, stepProblem, type InputStep, type Step, type StepProblem } from "./modelV2Steps";
import "./ModelV2InputFlow.css";

type Props = {
  session: Session;
  captureRequestContext: (activeSession: Session | null) => ModelV2RequestContext | null;
  isCurrentRequestContext: (requestContext: ModelV2RequestContext) => boolean;
  onStartBloodPressure: () => void;
  onReturnToToday: () => void;
};

export type ModelV2RequestContext = {
  userId: string;
  generation: number;
  accessToken: string;
};

type ResultState = "idle" | "input_invalid" | "temporarily_unavailable" | "processed";
const INPUT_ERROR_ID = "model-v2-input-error";
const STEP_TITLE_ID = "model-v2-step-title";

type WheelPart = "period" | "hour" | "minute";
type TimeSelection = { period?: 0 | 1; hour?: number; minute?: number };

const WHEEL_VALUES: Record<WheelPart, readonly number[]> = {
  period: [0, 1], hour: Array.from({ length: 12 }, (_, index) => index + 1),
  minute: Array.from({ length: 60 }, (_, index) => index),
};

function isNonDrinkingAlcoholFrequency(value: string) {
  return value === "none_past_year" || value === "lifetime_nonapplicable";
}

function wheelText(part: WheelPart, value: number) {
  if (part === "period") return value === 0 ? "오전" : "오후";
  if (part === "hour") return `${value}시`;
  return `${String(value).padStart(2, "0")}분`;
}

function selectionFromTime(value: string): TimeSelection {
  const parts = clockParts(value);
  if (!parts) return {};
  const [hour, minute] = parts;
  return { period: hour < 12 ? 0 : 1, hour: hour % 12 || 12, minute };
}

function canonicalTime(selection: TimeSelection): string | null {
  if (selection.period === undefined || selection.hour === undefined || selection.minute === undefined) return null;
  const hour = (selection.hour % 12) + (selection.period === 1 ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${String(selection.minute).padStart(2, "0")}`;
}

const PREVIEW_START = "2026-09-17";
const PREVIEW_END = "2026-10-17";
function isPreviewDate(date: string): boolean {
  return PREVIEW_START <= date && date <= PREVIEW_END;
}

function formatDurationMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

function walkingDuration(draft: Draft): string {
  const hours = finiteNumber(draft.walkingHours);
  const minutes = finiteNumber(draft.walkingMinutes);
  if (hours === null || minutes === null) return "선택 필요";
  return formatDurationMinutes((hours * 60) + minutes);
}

function sleepDuration(start: string, end: string): string {
  const startParts = clockParts(start);
  const endParts = clockParts(end);
  if (!startParts || !endParts) return "선택 필요";

  const startMinutes = (startParts[0] * 60) + startParts[1];
  const endMinutes = (endParts[0] * 60) + endParts[1];
  const duration = (endMinutes - startMinutes + (24 * 60)) % (24 * 60);
  return formatDurationMinutes(duration);
}

function PeriodSelector({ selected, label, disabled, onSelect }: {
  selected: 0 | 1 | undefined; label: string; disabled: boolean; onSelect: (value: 0 | 1) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const values = [0, 1] as const;

  function choose(index: number, moveFocus = false) {
    const bounded = Math.max(0, Math.min(values.length - 1, index));
    onSelect(values[bounded]);
    if (moveFocus) requestAnimationFrame(() => refs.current[bounded]?.focus());
  }

  return <div className="model-v2-period-selector" role="radiogroup" aria-label={`${label} 오전 또는 오후`}>
    {values.map((value, index) => {
      const checked = selected === value;
      const focusable = checked || (selected === undefined && index === 0);
      return <button key={value} ref={(node) => { refs.current[index] = node; }} type="button"
        role="radio" aria-checked={checked} tabIndex={disabled ? -1 : focusable ? 0 : -1}
        disabled={disabled} data-selected={checked || undefined}
        onClick={() => choose(index)}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            event.preventDefault();
            choose((index + 1) % values.length, true);
          } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            event.preventDefault();
            choose((index - 1 + values.length) % values.length, true);
          } else if (event.key === "Home") {
            event.preventDefault();
            choose(0, true);
          } else if (event.key === "End") {
            event.preventDefault();
            choose(values.length - 1, true);
          }
        }}>
        {wheelText("period", value)}
      </button>;
    })}
  </div>;
}

function HourDetentWheel({ selected, label, disabled, onSelect }: {
  selected: number | undefined;
  label: string;
  disabled: boolean;
  onSelect: (value: number, crossesPeriodBoundary: boolean) => void;
}) {
  const values = WHEEL_VALUES.hour;
  const initialIndex = selected === undefined ? 0 : Math.max(0, values.indexOf(selected));
  const [visualIndex, setVisualIndex] = useState(initialIndex);
  const visualIndexRef = useRef(initialIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const wheelAccumulator = useRef(0);
  const lastWheelStep = useRef(0);
  const pointerY = useRef<number | null>(null);

  const wrapIndex = (index: number) => (index + values.length) % values.length;

  function selectIndex(index: number, stepped = false) {
    const current = visualIndexRef.current;
    const normalized = wrapIndex(index);
    const currentValue = values[current];
    const nextValue = values[normalized];
    const crossesPeriodBoundary = stepped && (
      (currentValue === 11 && nextValue === 12) ||
      (currentValue === 12 && nextValue === 11)
    );

    visualIndexRef.current = normalized;
    setVisualIndex(normalized);
    onSelect(nextValue, crossesPeriodBoundary);
  }

  useEffect(() => {
    if (selected === undefined) return;
    const index = values.indexOf(selected);
    if (index >= 0 && index !== visualIndexRef.current) {
      visualIndexRef.current = index;
      setVisualIndex(index);
    }
  }, [selected, values]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const handleWheel = (event: WheelEvent) => {
      if (disabled || event.ctrlKey) return;
      if (event.cancelable) event.preventDefault();

      const line = 40;
      const normalizedDelta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? event.deltaY * line
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? event.deltaY * 180
          : event.deltaY;

      wheelAccumulator.current += normalizedDelta;
      const now = performance.now();

      // Mechanical detent: require a meaningful gesture and permit at most
      // one hour step per short interval, regardless of trackpad momentum.
      if (Math.abs(wheelAccumulator.current) < 56 || now - lastWheelStep.current < 110) return;

      const direction = wheelAccumulator.current > 0 ? 1 : -1;
      wheelAccumulator.current = 0;
      lastWheelStep.current = now;
      selectIndex(visualIndexRef.current + direction, true);
    };

    root.addEventListener("wheel", handleWheel, { passive: false });
    return () => root.removeEventListener("wheel", handleWheel);
  }, [disabled]);

  const visible = [-2, -1, 0, 1, 2] as const;

  return <div ref={rootRef}
    className="model-v2-wheel-column model-v2-hour-detent"
    data-wheel-part="hour"
    role="spinbutton"
    tabIndex={disabled ? -1 : 0}
    aria-label={label}
    aria-valuemin={1}
    aria-valuemax={12}
    aria-valuenow={selected}
    aria-valuetext={selected === undefined ? "선택 필요" : `${selected}시`}
    aria-disabled={disabled || undefined}
    onKeyDown={(event) => {
      if (disabled) return;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        selectIndex(visualIndexRef.current - 1, true);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        selectIndex(visualIndexRef.current + 1, true);
      } else if (event.key === "Home") {
        event.preventDefault();
        selectIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        selectIndex(values.length - 1);
      }
    }}
    onPointerDown={(event) => {
      if (disabled) return;

      // A direct tap on a visible hour is a button selection, not a drag.
      // Do not let the parent spinbutton capture that pointer or the
      // child's click can be swallowed before onClick fires.
      if (event.target !== event.currentTarget) {
        pointerY.current = null;
        return;
      }

      pointerY.current = event.clientY;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }}
    onPointerMove={(event) => {
      if (disabled || pointerY.current === null) return;
      const delta = event.clientY - pointerY.current;
      if (Math.abs(delta) < 30) return;

      // Drag upward reveals later hours; drag downward reveals earlier hours.
      selectIndex(visualIndexRef.current + (delta < 0 ? 1 : -1), true);
      pointerY.current = event.clientY;
    }}
    onPointerUp={() => { pointerY.current = null; }}
    onPointerCancel={() => { pointerY.current = null; }}>
    {visible.map((offset) => {
      const index = wrapIndex(visualIndex + offset);
      const value = values[index];
      return <button key={`${value}-${offset}`} type="button" tabIndex={-1} disabled={disabled}
        data-wheel-row data-wheel-value={value} data-offset={offset}
        data-selected={selected === value || undefined}
        onClick={() => selectIndex(index)}>
        {value}시
      </button>;
    })}
  </div>;
}

function MinuteDetentWheel({ selected, label, disabled, onSelect }: {
  selected: number | undefined; label: string; disabled: boolean; onSelect: (value: number) => void;
}) {
  const values = WHEEL_VALUES.minute;
  const initialIndex = selected === undefined ? 0 : Math.max(0, values.indexOf(selected));
  const [visualIndex, setVisualIndex] = useState(initialIndex);
  const visualIndexRef = useRef(initialIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const wheelAccumulator = useRef(0);
  const lastWheelStep = useRef(0);
  const lastWheelEvent = useRef(0);
  const pointerY = useRef<number | null>(null);

  const wrapIndex = (index: number) => (index + values.length) % values.length;

  function selectIndex(index: number) {
    const normalized = wrapIndex(index);
    visualIndexRef.current = normalized;
    setVisualIndex(normalized);
    onSelect(values[normalized]);
  }

  useEffect(() => {
    if (selected === undefined) return;
    const index = values.indexOf(selected);
    if (index >= 0 && index !== visualIndexRef.current) {
      visualIndexRef.current = index;
      setVisualIndex(index);
    }
  }, [selected, values]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const handleWheel = (event: WheelEvent) => {
      if (disabled || event.ctrlKey) return;
      if (event.cancelable) event.preventDefault();

      const line = 32;
      const normalizedDelta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? event.deltaY * line
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? event.deltaY * 150
          : event.deltaY;

      const now = performance.now();

      // A fresh gesture should not inherit tiny residual deltas from an old one.
      if (now - lastWheelEvent.current > 180) wheelAccumulator.current = 0;
      lastWheelEvent.current = now;
      wheelAccumulator.current += normalizedDelta;

      const magnitude = Math.abs(wheelAccumulator.current);

      // Keep the exact detent model, but accelerate only the number of whole
      // minute detents crossed by a stronger gesture. The result always lands
      // on one exact minute and acceleration is intentionally capped at 3.
      if (magnitude < 30 || now - lastWheelStep.current < 42) return;

      const direction = wheelAccumulator.current > 0 ? 1 : -1;
      const step = magnitude >= 150 ? 3 : magnitude >= 75 ? 2 : 1;

      wheelAccumulator.current = 0;
      lastWheelStep.current = now;
      selectIndex(visualIndexRef.current + (direction * step));
    };

    root.addEventListener("wheel", handleWheel, { passive: false });
    return () => root.removeEventListener("wheel", handleWheel);
  }, [disabled]);

  const visible = [-2, -1, 0, 1, 2] as const;

  return <div ref={rootRef}
    className="model-v2-wheel-column model-v2-minute-detent"
    data-wheel-part="minute"
    role="spinbutton"
    tabIndex={disabled ? -1 : 0}
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={59}
    aria-valuenow={selected}
    aria-valuetext={selected === undefined ? "선택 필요" : `${String(selected).padStart(2, "0")}분`}
    aria-disabled={disabled || undefined}
    onKeyDown={(event) => {
      if (disabled) return;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        selectIndex(visualIndexRef.current - 1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        selectIndex(visualIndexRef.current + 1);
      } else if (event.key === "PageUp") {
        event.preventDefault();
        selectIndex(visualIndexRef.current - 5);
      } else if (event.key === "PageDown") {
        event.preventDefault();
        selectIndex(visualIndexRef.current + 5);
      } else if (event.key === "Home") {
        event.preventDefault();
        selectIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        selectIndex(values.length - 1);
      }
    }}
    onPointerDown={(event) => {
      if (disabled) return;

      // Direct taps belong to the visible minute button. The parent only
      // captures gestures that begin on its own wheel surface.
      if (event.target !== event.currentTarget) {
        pointerY.current = null;
        return;
      }

      pointerY.current = event.clientY;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }}
    onPointerMove={(event) => {
      if (disabled || pointerY.current === null) return;
      const delta = event.clientY - pointerY.current;
      if (Math.abs(delta) < 22) return;

      selectIndex(visualIndexRef.current + (delta < 0 ? 1 : -1));
      pointerY.current = event.clientY;
    }}
    onPointerUp={() => { pointerY.current = null; }}
    onPointerCancel={() => { pointerY.current = null; }}>
    {visible.map((offset) => {
      const index = wrapIndex(visualIndex + offset);
      const value = values[index];
      return <button key={`${value}-${offset}`} type="button" tabIndex={-1} disabled={disabled}
        data-wheel-row data-wheel-value={value} data-offset={offset}
        data-selected={selected === value || undefined}
        onClick={() => selectIndex(index)}>
        {String(value).padStart(2, "0")}분
      </button>;
    })}
  </div>;
}

function TimeWheelPicker({ id, label, value, invalid, describedBy, disabled, open, onOpen, onClose, onChange }: {
  id: string; label: string; value: string; invalid: boolean; describedBy?: string; disabled: boolean; open: boolean;
  onOpen: () => void; onClose: () => void; onChange: (value: string) => void;
}) {
  const selectionRef = useRef<TimeSelection>(selectionFromTime(value));
  const [selection, setSelection] = useState<TimeSelection>(() => selectionRef.current);

  useEffect(() => {
    if (!open) return;
    const closeFromOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".model-v2-time-field")) return;
      onClose();
    };
    document.addEventListener("pointerdown", closeFromOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeFromOutsidePointer);
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    const restored = selectionFromTime(value);
    selectionRef.current = restored;
    setSelection(restored);
  }, [open, value]);

  const complete = clockParts(value) !== null;

  const choose = (part: WheelPart, next: number) => {
    const updated = { ...selectionRef.current, [part]: next } as TimeSelection;
    selectionRef.current = updated;
    setSelection(updated);
    const canonical = canonicalTime(updated);
    if (canonical) onChange(canonical);
  };

  const chooseHour = (next: number, crossesPeriodBoundary: boolean) => {
    const current = selectionRef.current;
    const updated: TimeSelection = { ...current, hour: next };

    // Preserve explicit period selection. Once selected, rotating the hour
    // wheel across the real 12-hour boundary carries AM/PM with it.
    if (crossesPeriodBoundary && current.period !== undefined) {
      updated.period = current.period === 0 ? 1 : 0;
    }

    selectionRef.current = updated;
    setSelection(updated);
    const canonical = canonicalTime(updated);
    if (canonical) onChange(canonical);
  };
  return <div className="model-v2-time-field" data-open={open}
    onPointerDown={open ? (event) => event.stopPropagation() : undefined}>
    <span id={`${id}-label`} className="model-v2-field-label">{label}</span>
    <button id={id} type="button" className="model-v2-time-trigger" disabled={disabled} aria-expanded={open}
      aria-controls={`${id}-picker`} aria-labelledby={`${id}-label ${id}-value`} aria-invalid={invalid || undefined}
      aria-describedby={describedBy} data-time-complete={String(complete)} onClick={open ? onClose : onOpen}>
      <span id={`${id}-value`}>{complete ? formatTimeKorean(value) : "시간 선택"}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <div id={`${id}-picker`} className="model-v2-time-picker" role="group" aria-label={`${label} 시간 선택`}>
      <p className="sr-only">오전 또는 오후, 시, 분을 각각 선택해 주세요. 화살표 위아래 키로 값을 바꿀 수 있습니다.</p>
      <div className="model-v2-wheel-band" aria-hidden="true" />
      <PeriodSelector selected={selection.period} label={label} disabled={disabled} onSelect={(next) => choose("period", next)} />
      <HourDetentWheel selected={selection.hour} label={`${label} 시`} disabled={disabled} onSelect={chooseHour} />
      <MinuteDetentWheel selected={selection.minute} label={`${label} 분`} disabled={disabled} onSelect={(next) => choose("minute", next)} />
      {!canonicalTime(selection) && <p className="model-v2-time-editing" role="status">시간을 모두 선택하면 적용됩니다.</p>}
    </div>}
    <span id={`${id}-status`} className={`model-v2-time-status${invalid ? " field-error" : ""}`} data-complete={complete}>
      {complete ? "선택 완료" : open ? "시간 선택 중" : "시간 선택 필요"}
    </span>
  </div>;
}

export function ModelV2InputFlow({
  session,
  captureRequestContext,
  isCurrentRequestContext,
  onStartBloodPressure,
  onReturnToToday,
}: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [step, setStep] = useState<Step>("intro");
  const [completed, setCompleted] = useState<InputStep[]>([]);
  const [editingReview, setEditingReview] = useState(false);
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [resultState, setResultState] = useState<ResultState>("idle");
  const [message, setMessage] = useState("");
  const [invalidFields, setInvalidFields] = useState<(keyof Draft)[]>([]);
  const [consentInvalid, setConsentInvalid] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ id: string } | null>(null);
  const [openTimeField, setOpenTimeField] = useState<keyof Draft | null>(null);
  const [previewOutput, setPreviewOutput] = useState<number | null>(null);
  const requestInFlight = useRef(false);
  const mounted = useRef(true);
  const formRef = useRef<HTMLFormElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  const today = useSeoulDate();
  const previewOpen = isPreviewDate(today) && isPreviewDate(seoulDate());

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!focusRequest) return;
    formRef.current?.querySelector<HTMLElement>(`#${focusRequest.id}`)?.focus();
  }, [focusRequest]);

  useEffect(() => {
    if (!previewOpen) setPreviewOutput(null);
  }, [previewOpen]);

  const age = finiteNumber(draft.age);
  const showOlderApplicabilityNotice = age !== null && age >= 80;
  const processed = resultState === "processed";
  const inputStep = step !== "intro" && step !== "review" ? step : null;
  const progressIndex = PROGRESS_STEPS.findIndex((item) => item === step);
  const timeCompleteCount = TIME_FIELD_KEYS.filter((key) => clockParts(draft[key])).length;

  function clearFeedback() {
    setResultState("idle");
    setMessage("");
    setInvalidFields([]);
    setConsentInvalid(false);
    setPreviewOutput(null);
  }

  function update(key: keyof Draft, value: string) {
    if (requestInFlight.current) return;
    setDraft((current) => {
      if (key !== "alcoholFrequency") return { ...current, [key]: value };
      const nonDrinking = isNonDrinkingAlcoholFrequency(value);
      return {
        ...current,
        alcoholFrequency: value,
        alcoholAmount: nonDrinking ? "none" : current.alcoholAmount === "none" ? "" : current.alcoholAmount,
      };
    });
    if (inputStep) setCompleted((current) => current.filter((item) => item !== inputStep));
    clearFeedback();
  }

  function goTo(next: Step, fromReview = false) {
    if (requestInFlight.current || processed) return;
    clearFeedback();
    setStep(next);
    setEditingReview(fromReview);
    setFocusRequest({ id: STEP_TITLE_ID });
  }

  function showProblem(problem: StepProblem) {
    setStep(problem.step);
    setResultState("input_invalid");
    setMessage(problem.message);
    setInvalidFields(problem.fields);
    setConsentInvalid(false);
    setFocusRequest({ id: FIELDS[problem.fields[0]].id });
  }

  function advance() {
    if (requestInFlight.current || !inputStep) return;
    const problem = stepProblem(inputStep, draft);
    if (problem) {
      showProblem(problem);
      return;
    }
    setCompleted((current) => current.includes(inputStep) ? current : [...current, inputStep]);
    const next = INPUT_STEPS[INPUT_STEPS.indexOf(inputStep) + 1] ?? "review";
    goTo(editingReview ? "review" : next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Only the explicit final button may submit. Input Enter and intermediate
    // navigation cannot start a request, even if a submit event is dispatched.
    if (step !== "review" || processed || requestInFlight.current
      || (event.nativeEvent as SubmitEvent).submitter !== submitRef.current) return;

    for (const candidate of INPUT_STEPS) {
      const problem = stepProblem(candidate, draft);
      if (problem) {
        setEditingReview(true);
        showProblem(problem);
        return;
      }
    }
    const payload = buildPayload(draft);
    if (!payload) {
      setResultState("input_invalid");
      setMessage("필수 입력 항목을 모두 확인해 주세요.");
      setFocusRequest({ id: INPUT_ERROR_ID });
      return;
    }
    if (!noticeAccepted) {
      setResultState("input_invalid");
      setMessage("입력과 결과가 저장되지 않는다는 안내를 확인해 주세요.");
      setConsentInvalid(true);
      setFocusRequest({ id: "model-notice-accepted" });
      return;
    }

    const requestContext = captureRequestContext(session);
    if (!requestContext) return;
    requestInFlight.current = true;
    setPending(true);
    clearFeedback();
    setFocusRequest({ id: "model-v2-pending" });

    try {
      const localResult = await scoreModelV2Locally(payload);
      if (!mounted.current || !isCurrentRequestContext(requestContext)) return;
      setPreviewOutput(isPreviewDate(seoulDate()) && Number.isFinite(localResult.continuousOutput)
        ? localResult.continuousOutput
        : null);
      setResultState("processed");
      setFocusRequest({ id: "model-v2-result-title" });
    } catch (error) {
      if (!mounted.current || !isCurrentRequestContext(requestContext)) return;
      if (error instanceof ModelV2LocalError && error.code === "input_invalid") {
        setResultState("input_invalid");
        setMessage("입력 조합을 확인해 주세요. 수정한 뒤 다시 시도할 수 있습니다.");
        setFocusRequest({ id: INPUT_ERROR_ID });
        return;
      }
      setResultState("temporarily_unavailable");
      setFocusRequest({ id: "model-v2-unavailable" });
    } finally {
      requestInFlight.current = false;
      if (mounted.current) setPending(false);
    }
  }

  function renderField(key: keyof Draft) {
    const field = FIELDS[key];
    const invalid = invalidFields.includes(key);
    const isTime = field.type === "time";
    const complete = isTime && clockParts(draft[key]) !== null;
    const alcoholAmountLocked = key === "alcoholAmount" && isNonDrinkingAlcoholFrequency(draft.alcoholFrequency);
    const describedBy = [isTime ? `${field.id}-status` : null, invalid ? INPUT_ERROR_ID : null].filter(Boolean).join(" ") || undefined;
    if (isTime) return <TimeWheelPicker key={key} id={field.id} label={field.label} value={draft[key]} invalid={invalid}
      describedBy={describedBy} disabled={pending} open={openTimeField === key}
      onOpen={() => setOpenTimeField(key)} onClose={() => setOpenTimeField(null)} onChange={(value) => update(key, value)} />;
    const shared = {
      id: field.id, value: draft[key], disabled: pending || alcoholAmountLocked, required: true,
      "aria-labelledby": `${field.id}-label`,
      "aria-invalid": invalid || undefined, "aria-describedby": describedBy,
      onChange: (event: { target: { value: string } }) => update(key, event.target.value),
    };
    return (
      <label htmlFor={field.id} key={key}>
        <span id={`${field.id}-label`}>{field.label}{field.unit && <> <span className="unit">{field.unit}</span></>}</span>
        {field.options ? (
          <select {...shared}>
            <option value="">선택</option>
            {field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        ) : (
          <input {...shared} type={field.type} min={field.min} max={field.max} step={field.step} inputMode={field.inputMode}
            data-time-complete={isTime ? String(complete) : undefined} />
        )}
      </label>
    );
  }

  return (
    <Scene id="S11" eyebrow="입력 기반 위험군 선별 신호" title="이번 이용에만 생활정보를 살펴봐요" tone="lavender" className="signal-scene model-v2-flow">
      <div className="model-v2-layout">
        <aside className="model-v2-progress" aria-label="입력 진행 단계">
          <p className="model-v2-progress-caption">{processed ? "입력 과정 완료" : step === "intro" ? "시작 전 · 5단계" : `${progressIndex + 1} / 5 단계`}</p>
          <ol>
            {PROGRESS_STEPS.map((item, index) => {
              const done = item === "review" ? processed : completed.includes(item);
              return <li key={item} aria-current={step === item && !processed ? "step" : undefined} data-complete={done}>
                <span className="model-v2-step-marker" aria-hidden="true">{done ? "✓" : index + 1}</span>
                <span>{STEPS[item].label}</span>
                {done && <span className="sr-only">완료</span>}
              </li>;
            })}
          </ol>
          <p className="model-v2-privacy-note">선택 도구 · 이번 이용에만 사용<br />입력과 결과는 저장되지 않아 기록 목록에서 다시 볼 수 없어요.</p>
        </aside>

        <form ref={formRef} className="measurement-panel model-v2-panel" data-model-v2-step={step}
          onSubmit={submit} noValidate autoComplete="off"
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) event.preventDefault();
          }}
          aria-describedby={resultState === "input_invalid" ? INPUT_ERROR_ID : undefined}>
          {processed ? (
            <>
              <div className="model-v2-outcome" data-model-v2-user-result="processed" role="status" aria-live="polite">
                <span className="model-v2-outcome-mark" aria-hidden="true">✓</span>
                <span className="status-pill">오늘의 시작점</span>
                <h2 id="model-v2-result-title" tabIndex={-1}>오늘의 시작점을 정리했어요.</h2>
                <p>혈압 기록이 아직 없어도 방금 입력한 활동·수면·생활습관을 이 화면에서 한눈에 확인할 수 있어요.</p>

                <div className="model-v2-result-summary" aria-label="입력한 생활정보 요약">
                  <section className="model-v2-result-section">
                    <h3>활동</h3>
                    <dl>
                      <div>
                        <dt>최근 7일 걷기</dt>
                        <dd>{draft.walkingDays}일 · 걷는 날 평균 {walkingDuration(draft)}</dd>
                      </div>
                      <div>
                        <dt>근력운동</dt>
                        <dd>{reviewValue("strengthDays", draft)}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="model-v2-result-section">
                    <h3>수면</h3>
                    <dl>
                      <div>
                        <dt>평일</dt>
                        <dd>{formatTimeKorean(draft.weekdayBed)} → {formatTimeKorean(draft.weekdayWake)} · {sleepDuration(draft.weekdayBed, draft.weekdayWake)}</dd>
                      </div>
                      <div>
                        <dt>주말</dt>
                        <dd>{formatTimeKorean(draft.weekendBed)} → {formatTimeKorean(draft.weekendWake)} · {sleepDuration(draft.weekendBed, draft.weekendWake)}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="model-v2-result-section">
                    <h3>생활 습관</h3>
                    <dl>
                      <div>
                        <dt>흡연</dt>
                        <dd>{reviewValue("smoking", draft)}</dd>
                      </div>
                      <div>
                        <dt>음주</dt>
                        <dd>{reviewValue("alcoholFrequency", draft)} · {reviewValue("alcoholAmount", draft)}</dd>
                      </div>
                    </dl>
                  </section>
                </div>

                <div className="model-v2-result-model-note" aria-label="Model V2 처리 안내">
                  <strong>Model V2 처리가 완료됐어요.</strong>
                  {previewOpen && previewOutput !== null && Number.isFinite(previewOutput) ? (
                    <div data-model-v2-preview>
                      <p id="model-v2-preview-label">연구/개발 미리보기 · 내부 연속 출력</p>
                      <p data-model-v2-preview-value>{previewOutput.toFixed(3)}</p>
                      <p>이 값은 확률·백분율·백분위, 진단, 정상/비정상 판정, 위험군 등급, 중증도 또는 향후 고혈압 발생 가능성을 뜻하지 않습니다. 치료·예방 효과를 뜻하지 않습니다.</p>
                      <p>소수점 셋째 자리 표시는 화면 표시용 반올림이며, 판단 기준이나 등급을 뜻하지 않습니다.</p>
                    </div>
                  ) : (
                    <p>현재 제품에서는 개인별 모델 점수·확률·백분율·등급을 표시하지 않아요.</p>
                  )}
                </div>

                <p className="model-v2-result-disclaimer">
                  이 요약은 입력한 생활정보를 읽기 좋게 정리한 것이며, 건강 상태나 질환 위험도를 판단하는 결과가 아니에요.
                  특정 생활습관이 어떤 결과의 원인이라는 뜻도 아닙니다.
                </p>
                <p>이번 입력과 결과는 저장되지 않아 기록 목록에서 다시 볼 수 없어요. 화면을 나가거나 새로고침하면 사라져요.</p>
                <p>혈압 기록과 7일 생활 챌린지는 이 요약과 별도로 이용할 수 있어요.</p>
              </div>
              <div className="model-v2-actions">
                <button type="button" onClick={onStartBloodPressure}>혈압 기록 남기기</button>
                <button className="text-button" type="button" onClick={onReturnToToday}>오늘의 기록으로 돌아가기</button>
              </div>
            </>
          ) : (
            <>
              <header className="model-v2-step-heading">
                <p className="model-v2-kicker">{step === "intro" ? "입력 전에 잠깐" : step === "review" ? "분석 전 마지막 확인" : `${progressIndex + 1}번째 이야기`}</p>
                <h2 id={STEP_TITLE_ID} tabIndex={-1}>{step === "intro" ? "내 생활정보를 하나씩 살펴봐요" : STEPS[step].label}</h2>
                {step !== "intro" && <p>{STEPS[step].description}</p>}
              </header>

              {resultState === "input_invalid" && <p id={INPUT_ERROR_ID} className="notice notice-error" role="alert" tabIndex={-1}>{message}</p>}
              {pending && <p id="model-v2-pending" className="notice" role="status" tabIndex={-1}>생활정보 분석 중입니다. 잠시 기다려 주세요.</p>}
              {resultState === "temporarily_unavailable" && <p id="model-v2-unavailable" className="notice notice-warning" role="status" tabIndex={-1}>지금은 생활정보 분석을 완료할 수 없습니다. 자동으로 다시 요청하지 않습니다. 입력은 이 화면에 남아 있어요. 잠시 후 직접 다시 요청할 수 있습니다.</p>}

              {step === "intro" && <section className="model-v2-intro" aria-labelledby={STEP_TITLE_ID}>
                <div className="model-v2-intro-mark" aria-hidden="true" />
                <p><strong>선택 도구 · 이번 이용에만 사용</strong></p>
                <p>입력을 마치면 활동·수면·생활습관을 이번 이용에만 보이는 ‘오늘의 시작점’으로 정리해요.</p>
                <p><strong>이번 입력과 결과는 저장되지 않아 기록 목록에서 다시 볼 수 없어요. 화면을 나가거나 새로고침하면 사라져요.</strong></p>
                <p>혈압 기록은 별도로 저장해 최근 7일에서 날짜·시간대별로 다시 확인할 수 있어요.</p>
                {previewOpen ? (
                  <>
                    <p>2026년 10월 17일(KST)까지 ‘연구/개발 미리보기 · 내부 연속 출력’을 소수로 표시합니다.</p>
                    <p>이 값은 확률·백분율·백분위, 진단, 정상/비정상 판정, 위험군 등급, 중증도 또는 향후 고혈압 발생 가능성을 뜻하지 않습니다. 치료·예방 효과를 뜻하지 않습니다.</p>
                  </>
                ) : (
                  <p>이 도구는 개인별 모델 점수·백분율·등급을 제공하지 않습니다.</p>
                )}
                <p>나이, 체격, 생활 습관, 활동, 수면 정보를 바탕으로 연구 데이터에서 함께 나타난 패턴을 확인합니다.</p>
                <p>건강 상태나 앞으로의 변화를 판단하는 결과는 아니며, 의료적 판단을 제공하지 않습니다.</p>
                <p>마지막 확인 단계에서 직접 분석을 시작할 수 있어요.</p>
                <details className="model-v2-notice-details">
                  <summary>입력 정보 이용 안내</summary>
                  <p>학습·재학습, 광고·마케팅, 프로필 보강에 사용하지 않습니다.</p>
                  <p>혈압 관찰, 챌린지 기록, 이전 결과, 다른 사용자의 정보와 자동으로 결합하지 않습니다.</p>
                </details>
              </section>}

              {showOlderApplicabilityNotice && (step === "basics" || step === "review") && <p className="notice notice-warning" role="status">
                만 80세 이상에서는 이 참고의 적용 근거가 상대적으로 약합니다. 이 내용만으로 건강 상태를 판단하지 말고, 실제 혈압을 확인해 보세요.
              </p>}

              {inputStep && inputStep !== "sleep" && <>
                <div className={`field-grid${inputStep === "habits" ? " model-v2-fields-single" : ""}`}>{STEPS[inputStep].fields.map(renderField)}</div>
                {inputStep === "habits" && <p className="model-v2-privacy-note">최근 1년간 또는 평생 마시지 않았다면 음주량은 ‘해당 없음’을 선택해 주세요.</p>}
                {inputStep === "activity" && <p className="model-v2-privacy-note">걷는 날의 시간과 분을 나누어 입력해 주세요. 걷지 않았다면 걷기 일수·시간·분에 각각 0을 입력해 주세요.</p>}
              </>}

              {step === "sleep" && <>
                <p className="model-v2-sleep-caption">시간 선택 {timeCompleteCount} / 4 · 자정은 오전 12:00으로 선택해 주세요.</p>
                <fieldset className="model-v2-sleep-group">
                  <legend>평일</legend>
                  <div className="field-grid">{renderField("weekdayBed")}{renderField("weekdayWake")}</div>
                </fieldset>
                <fieldset className="model-v2-sleep-group">
                  <legend>주말</legend>
                  <div className="field-grid">{renderField("weekendBed")}{renderField("weekendWake")}</div>
                </fieldset>
              </>}

              {step === "review" && <>
                <div className="model-v2-review">
                  {INPUT_STEPS.map((item) => <section className="model-v2-review-group" aria-labelledby={`model-v2-review-${item}`} key={item}>
                    <header><h3 id={`model-v2-review-${item}`}>{STEPS[item].label}</h3><button type="button" className="text-button" disabled={pending} onClick={() => goTo(item, true)} aria-label={`${STEPS[item].label} 수정`}>수정</button></header>
                    <dl>{STEPS[item].fields.map((key) => <div key={key}><dt>{FIELDS[key].label}</dt><dd>{reviewValue(key, draft)}</dd></div>)}</dl>
                  </section>)}
                </div>
                <div className="model-v2-review-notice">
                  <p>이번 입력과 결과는 저장되지 않아 기록 목록에서 다시 볼 수 없어요. 화면을 나가거나 새로고침하면 사라져요.</p>
                  <p>혈압 기록과 7일 생활 챌린지는 별도로 이용할 수 있어요.</p>
                  <label className="signal-consent" htmlFor="model-notice-accepted">
                    <input id="model-notice-accepted" type="checkbox" checked={noticeAccepted}
                      onChange={(event) => { setNoticeAccepted(event.target.checked); clearFeedback(); }} disabled={pending}
                      aria-invalid={consentInvalid || undefined} aria-describedby={consentInvalid ? INPUT_ERROR_ID : undefined} />
                    위 안내를 확인했습니다.
                  </label>
                </div>
              </>}

              <div className="model-v2-actions">
                {step !== "intro" && <button type="button" className="secondary" disabled={pending} onClick={() => goTo(progressIndex === 0 ? "intro" : PROGRESS_STEPS[progressIndex - 1])}>이전</button>}
                {step === "intro" ? <button key="intro" type="button" onClick={() => goTo("basics")}>입력 시작하기</button>
                  : step === "review" ? <button key="submit" ref={submitRef} type="submit" disabled={pending}>{pending ? "생활정보 분석 중" : "생활정보 분석하기"}</button>
                    : <button key={step} type="button" disabled={pending} onClick={advance}>{editingReview ? "입력 확인으로 돌아가기" : step === "sleep" ? "입력 확인하기" : "다음"}</button>}
              </div>
            </>
          )}
        </form>
      </div>
    </Scene>
  );
}
