import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { scoreModelV2Locally } from "../lib/model-v2/runtime";
import { ModelV2LocalError } from "../lib/model-v2/errors";
import { seoulDate } from "../lib/seoulDate";
import { useSeoulDate } from "../lib/useSeoulDate";
import { modelV2PresentationMode, modelV2PreviewEndLabel, visibleModelV2Output } from "../ui/modelV2VisibilityPolicy";
import { Scene } from "./SceneShell";
import { ModelV2Outcome } from "./ModelV2Outcome";
import { buildPayload, clockParts, EMPTY_DRAFT, finiteNumber, TIME_FIELD_KEYS, type Draft } from "./modelV2Draft";
import { FIELDS, formatTimeKorean, INPUT_STEPS, PROGRESS_STEPS, reviewValue, STEPS, stepProblem, type InputStep, type Step, type StepProblem } from "./modelV2Steps";
import type { ModelV2Continuation } from "./modelV2Continuation";
import type { ModelV2ExecutionGuard } from "./modelV2ExecutionGuard";
import "./ModelV2InputFlow.css";

type Props = {
  guard: ModelV2ExecutionGuard;
  guestCue?: string;
  bloodPressureStatus: string;
  bloodPressureSupport: string;
  continuation: ModelV2Continuation;
  challengeStatus: string;
  challengeSupport: string;
  onContinue: () => void;
  onReturnToToday: () => void;
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
    const closeFromOutsideClick = (event: MouseEvent) => {
      const insideTimeField = event.composedPath().some(
        (entry) => entry instanceof Element && entry.classList.contains("model-v2-time-field"),
      );
      if (insideTimeField) return;
      onClose();
    };
    document.addEventListener("click", closeFromOutsideClick);
    return () => document.removeEventListener("click", closeFromOutsideClick);
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
  guard,
  guestCue,
  bloodPressureStatus,
  bloodPressureSupport,
  continuation,
  challengeStatus,
  challengeSupport,
  onContinue,
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
  const previewOpen = modelV2PresentationMode(today) === "research_preview"
    && modelV2PresentationMode(seoulDate()) === "research_preview";

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
  const isLastInputStep = inputStep === INPUT_STEPS[INPUT_STEPS.length - 1];
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

    const token = guard.capture();
    if (!token) return;
    requestInFlight.current = true;
    setPending(true);
    clearFeedback();
    setFocusRequest({ id: "model-v2-pending" });

    try {
      const localResult = await scoreModelV2Locally(payload);
      if (!mounted.current || !guard.isCurrent(token)) return;
      setPreviewOutput(visibleModelV2Output(localResult.continuousOutput, seoulDate()));
      setResultState("processed");
      setFocusRequest({ id: "model-v2-result-title" });
    } catch (error) {
      if (!mounted.current || !guard.isCurrent(token)) return;
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

  function renderField(key: keyof Draft, contextId?: string) {
    const field = FIELDS[key];
    const label = field.inputLabel ?? field.label;
    const invalid = invalidFields.includes(key);
    const isTime = field.type === "time";
    const complete = isTime && clockParts(draft[key]) !== null;
    const alcoholAmountLocked = key === "alcoholAmount" && isNonDrinkingAlcoholFrequency(draft.alcoholFrequency);
    const help = key === "alcoholAmount"
      ? alcoholAmountLocked ? "음주량은 ‘해당 없음’으로 처리돼요. 따로 답하지 않아도 돼요." : "보통 한 번에 마시는 양을 선택해 주세요."
      : field.help;
    const describedBy = [contextId, help ? `${field.id}-help` : null, isTime ? `${field.id}-status` : null, invalid ? INPUT_ERROR_ID : null].filter(Boolean).join(" ") || undefined;
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
        <span id={`${field.id}-label`}>{label}{field.unit && field.unit !== label && <> <span className="unit">{field.unit}</span></>}</span>
        {help && <span id={`${field.id}-help`} className="model-v2-field-help">{help}</span>}
        {field.options ? (
          <select {...shared}>
            <option value="">선택</option>
            {field.options.map(([value, label, inputLabel]) => <option key={value} value={value}>{inputLabel ?? label}</option>)}
          </select>
        ) : (
          <input {...shared} type={field.type} min={field.min} max={field.max} step={field.step} inputMode={field.inputMode}
            data-time-complete={isTime ? String(complete) : undefined} />
        )}
      </label>
    );
  }

  return (
    <Scene id="S11" eyebrow="입력 기반 위험군 선별 신호" title="이번 이용에만 생활정보를 살펴봐요" tone="secondary" className="signal-scene model-v2-flow">
      <div className="model-v2-layout" data-model-v2-processed={processed ? "true" : undefined}>
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
          <p className="model-v2-privacy-note">이번 입력에만 사용 · 입력과 결과 저장 안 함</p>
        </aside>

        <form ref={formRef} className="measurement-panel model-v2-panel" data-model-v2-step={step}
          onSubmit={submit} noValidate autoComplete="off"
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) event.preventDefault();
          }}
          aria-describedby={resultState === "input_invalid" ? INPUT_ERROR_ID : undefined}>
          {processed ? (
            <ModelV2Outcome
              draft={draft}
              previewOutput={previewOpen ? previewOutput : null}
              bloodPressureStatus={bloodPressureStatus}
              bloodPressureSupport={bloodPressureSupport}
              continuation={continuation}
              challengeStatus={challengeStatus}
              challengeSupport={challengeSupport}
              onContinue={onContinue}
              onReturnToToday={onReturnToToday}
            />
          ) : (
            <>
              <header className="model-v2-step-heading section-header">
                <p className="model-v2-kicker">{step === "intro" ? "입력 전에 잠깐" : step === "review" ? "분석 전 마지막 확인" : `${progressIndex + 1}번째 이야기`}</p>
                <h2 id={STEP_TITLE_ID} tabIndex={-1}>{step === "intro" ? "생활정보를 입력해요" : STEPS[step].label}</h2>
                {step !== "intro" && <p>{STEPS[step].description}</p>}
              </header>

              {resultState === "input_invalid" && <p id={INPUT_ERROR_ID} className="notice-error status-notice" role="alert" tabIndex={-1}>{message}</p>}
              {pending && <p id="model-v2-pending" className="status-notice" role="status" tabIndex={-1}>생활정보 분석 중입니다. 잠시 기다려 주세요.</p>}
              {resultState === "temporarily_unavailable" && <p id="model-v2-unavailable" className="notice-warning status-notice" role="status" tabIndex={-1}>지금은 생활정보 분석을 완료할 수 없습니다. 자동으로 다시 요청하지 않습니다. 입력은 이 화면에 남아 있어요. 잠시 후 직접 다시 요청할 수 있습니다.</p>}

              {step === "intro" && <section className="model-v2-intro section-header" aria-labelledby={STEP_TITLE_ID}>
                <div className="model-v2-intro-mark" aria-hidden="true" />
                {guestCue && <p className="model-v2-guest-cue">{guestCue}</p>}
                <p>기본 정보·활동·수면·생활습관을 입력합니다.</p>
                <p><strong>이번 입력과 결과는 저장되지 않으며 화면을 나가거나 새로고침하면 사라집니다.</strong></p>
                {previewOpen ? (
                  <>
                    <p>{modelV2PreviewEndLabel}까지 ‘연구/개발 미리보기 · 내부 연속 출력’을 소수로 표시합니다.</p>
                    <p>이 값은 확률·진단·위험등급이 아니며 치료·예방 효과를 뜻하지 않습니다.</p>
                  </>
                ) : (
                  <p>이 도구는 개인별 모델 점수·백분율·등급을 제공하지 않습니다.</p>
                )}
                <details className="model-v2-notice-details">
                  <summary>입력 정보 이용 안내</summary>
                  <p>질문은 기본 정보, 최근 7일 활동, 평일·주말 수면, 흡연·음주와 입력 확인으로 구성돼요.</p>
                  <p>입력은 생활정보 정리와 입력 기반 위험군 선별 신호 계산에만 사용해요.</p>
                  <p>학습·재학습, 광고·마케팅, 프로필 보강에 사용하지 않습니다.</p>
                  <p>혈압 관찰, 챌린지 기록, 이전 결과, 다른 사용자의 정보와 자동으로 결합하지 않습니다.</p>
                  <p>혈압 기록은 별도로 저장되며, 이 도구를 건너뛰어도 기록과 챌린지를 이용할 수 있어요.</p>
                </details>
              </section>}

              {showOlderApplicabilityNotice && (step === "basics" || step === "review") && <p className="notice-warning status-notice" role="status">
                만 80세 이상에서는 이 참고의 적용 근거가 상대적으로 약합니다. 이 내용만으로 건강 상태를 판단하지 말고, 실제 혈압을 확인해 보세요.
              </p>}

              {step === "basics" && <>
                <p id="model-v2-measurement-help" className="model-v2-field-help">키와 몸무게는 알고 있는 측정값을 입력해 주세요.</p>
                <div className="field-grid">{STEPS.basics.fields.map((key) => renderField(key, key === "height" || key === "weight" ? "model-v2-measurement-help" : undefined))}</div>
              </>}

              {step === "activity" && <>
                {renderField("walkingDays")}
                <fieldset className="model-v2-question-group section-header" aria-describedby="model-v2-walking-help model-v2-walking-zero-help">
                  <legend>그중 걷는 날에는 하루 평균 얼마나 걸었나요?</legend>
                  <p id="model-v2-walking-help" className="model-v2-field-help">걷지 않은 날은 평균에 넣지 않아요. 예를 들어 40분은 0시간 40분으로 입력해 주세요.</p>
                  <div className="field-grid">
                    {renderField("walkingHours", "model-v2-walking-help model-v2-walking-zero-help")}
                    {renderField("walkingMinutes", "model-v2-walking-help model-v2-walking-zero-help")}
                  </div>
                  <p id="model-v2-walking-zero-help" className="model-v2-field-help">걷기 일수가 0일이면 시간과 분도 모두 0으로 입력해 주세요.</p>
                </fieldset>
                {renderField("strengthDays")}
              </>}

              {step === "sleep" && <>
                <p id="model-v2-sleep-help" className="model-v2-sleep-caption">시간 선택 {timeCompleteCount} / 4 · 각 시각의 오전·오후를 확인해 주세요. 자정은 오전 12:00이에요.</p>
                <fieldset className="model-v2-question-group section-header">
                  <legend>평일에는 보통 몇 시에 취침하고 기상하나요?</legend>
                  <div className="field-grid">{renderField("weekdayBed", "model-v2-sleep-help")}{renderField("weekdayWake", "model-v2-sleep-help")}</div>
                </fieldset>
                <fieldset className="model-v2-question-group section-header">
                  <legend>주말에는 보통 몇 시에 취침하고 기상하나요?</legend>
                  <div className="field-grid">{renderField("weekendBed", "model-v2-sleep-help")}{renderField("weekendWake", "model-v2-sleep-help")}</div>
                </fieldset>
                <p className="model-v2-field-help">일정이 자주 바뀐다면 시간을 억지로 정하지 않아도 돼요. 네 시각을 정하기 어려운 경우에는 이 도구를 건너뛰어도 혈압 기록과 다른 기능은 그대로 이용할 수 있어요.</p>
              </>}

              {step === "habits" && <div className="field-grid model-v2-fields-single">{STEPS.habits.fields.map((key) => renderField(key))}</div>}

              {step === "review" && <>
                <div className="model-v2-review">
                  {INPUT_STEPS.map((item) => <section className="model-v2-review-group section-header" aria-labelledby={`model-v2-review-${item}`} key={item}>
                    <header><h3 id={`model-v2-review-${item}`}>{STEPS[item].label}</h3><button type="button" className="text-button" disabled={pending} onClick={() => goTo(item, true)} aria-label={`${STEPS[item].label} 수정`}>수정</button></header>
                    <dl>{STEPS[item].fields.map((key) => <div key={key}><dt>{FIELDS[key].label}</dt><dd>{reviewValue(key, draft)}</dd></div>)}</dl>
                  </section>)}
                </div>
                <div className="model-v2-review-notice status-notice">
                  <p>이번 입력과 결과는 저장되지 않아요. 화면을 나가거나 새로고침하면 사라져요.</p>
                  <p>혈압 기록과 7일 생활 챌린지는 별도로 이용할 수 있어요.</p>
                  <label className="signal-consent" htmlFor="model-notice-accepted">
                    <input id="model-notice-accepted" type="checkbox" checked={noticeAccepted}
                      onChange={(event) => { setNoticeAccepted(event.target.checked); clearFeedback(); }} disabled={pending}
                      aria-invalid={consentInvalid || undefined} aria-describedby={consentInvalid ? INPUT_ERROR_ID : undefined} />
                    입력과 결과가 저장되지 않는다는 안내를 확인했어요.
                  </label>
                </div>
              </>}

              <div className="model-v2-actions action-group">
                {step !== "intro" && <button type="button" className="secondary" disabled={pending} onClick={() => goTo(progressIndex === 0 ? "intro" : PROGRESS_STEPS[progressIndex - 1])}>이전</button>}
                {step === "intro" ? <button key="intro" type="button" onClick={() => goTo("basics")}>입력 시작하기</button>
                  : step === "review" ? <button key="submit" ref={submitRef} type="submit" disabled={pending}>{pending ? "생활정보 분석 중" : "생활정보 분석하기"}</button>
                    : <button key={step} type="button" disabled={pending} onClick={advance}>{editingReview ? "입력 확인으로 돌아가기" : isLastInputStep ? "입력 확인하기" : "다음"}</button>}
              </div>
            </>
          )}
        </form>
      </div>
    </Scene>
  );
}
