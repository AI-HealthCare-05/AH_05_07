import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { scoreModelV2Locally } from "../lib/model-v2/runtime";
import { ModelV2LocalError } from "../lib/model-v2/errors";
import { seoulDate } from "../lib/seoulDate";
import { useSeoulDate } from "../lib/useSeoulDate";
import { modelV2PresentationMode, modelV2PreviewEndLabel, visibleModelV2Output } from "../ui/modelV2VisibilityPolicy";
import { Scene } from "./SceneShell";
import { ModelV2Outcome } from "./ModelV2Outcome";
import { buildPayload, clockParts, EMPTY_DRAFT, finiteNumber, type Draft, type TimeDraftKey } from "./modelV2Draft";
import { FIELDS, formatTimeKorean, INTAKE_QUESTIONS, questionComplete, questionFocusId, stepProblem } from "./modelV2Steps";
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

const DEFAULT_TIME_SELECTION: Readonly<Required<TimeSelection>> = Object.freeze({
  period: 0,
  hour: 12,
  minute: 0,
});

function selectionForPicker(value: string): TimeSelection {
  const restored = selectionFromTime(value);
  return clockParts(value) ? restored : { ...DEFAULT_TIME_SELECTION };
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
        <span className="model-v2-wheel-value">{value}시</span>
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
        <span className="model-v2-wheel-value">{String(value).padStart(2, "0")}분</span>
      </button>;
    })}
  </div>;
}

function TimeWheelPicker({ id, label, value, invalid, describedBy, disabled, open, onOpen, onClose, onChange }: {
  id: string; label: string; value: string; invalid: boolean; describedBy?: string; disabled: boolean; open: boolean;
  onOpen: () => void; onClose: () => void; onChange: (value: string) => void;
}) {
  const selectionRef = useRef<TimeSelection>(selectionForPicker(value));
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
    const restored = selectionForPicker(value);
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

  const acceptDisplayedTime = () => {
    const canonical = canonicalTime(selectionRef.current);
    if (!canonical) return;
    onChange(canonical);
    onClose();
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
      {!complete && <div className="model-v2-time-default">
        <p className="model-v2-time-editing" role="status">기본 표시값이에요. 실제 시각으로 조정하거나 그대로 사용하세요.</p>
        <button type="button" className="secondary model-v2-time-apply" disabled={disabled} onClick={acceptDisplayedTime}>이 시간 사용</button>
      </div>}
    </div>}
    <span id={`${id}-status`} className={`model-v2-time-status${invalid ? " field-error" : ""}`} data-complete={complete}>
      {complete ? "선택 완료" : open ? "시간 선택 중" : "시간 선택 필요"}
    </span>
  </div>;
}

export function ModelV2InputFlow({
  guard, guestCue, bloodPressureStatus, bloodPressureSupport, continuation,
  challengeStatus, challengeSupport, onContinue, onReturnToToday,
}: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [weekendSame, setWeekendSame] = useState(false);
  const [pending, setPending] = useState(false);
  const [resultState, setResultState] = useState<ResultState>("idle");
  const [message, setMessage] = useState("");
  const [invalidFields, setInvalidFields] = useState<(keyof Draft)[]>([]);
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
  const processed = resultState === "processed";
  const completedCount = INTAKE_QUESTIONS.filter((item) => questionComplete(item, draft)).length;
  const showOlderApplicabilityNotice = finiteNumber(draft.age) !== null && finiteNumber(draft.age)! >= 80;
  const nonDrinking = isNonDrinkingAlcoholFrequency(draft.alcoholFrequency);
  const noWalking = draft.walkingDays === "0";
  const walkingTotalMinutes = draft.walkingHours === "" || draft.walkingMinutes === ""
    ? "" : String(Number(draft.walkingHours) * 60 + Number(draft.walkingMinutes));

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (focusRequest) formRef.current?.querySelector<HTMLElement>("#" + focusRequest.id)?.focus();
  }, [focusRequest]);
  useEffect(() => {
    if (!previewOpen) setPreviewOutput(null);
  }, [previewOpen]);

  function clearFeedback() {
    setResultState("idle");
    setMessage("");
    setInvalidFields([]);
    setPreviewOutput(null);
  }

  function update(key: keyof Draft, value: string) {
    if (requestInFlight.current) return;
    setDraft((current) => {
      if (key === "alcoholFrequency") {
        const automatic = isNonDrinkingAlcoholFrequency(value);
        return { ...current, alcoholFrequency: value,
          alcoholAmount: automatic ? "none" : current.alcoholAmount === "none" ? "" : current.alcoholAmount };
      }
      if (key === "walkingDays") {
        if (value === "0") return { ...current, walkingDays: value, walkingHours: "0", walkingMinutes: "0" };
        if (current.walkingDays === "0") return { ...current, walkingDays: value, walkingHours: "", walkingMinutes: "" };
      }
      if (weekendSame && key === "weekdayBed") return { ...current, weekdayBed: value, weekendBed: value };
      if (weekendSame && key === "weekdayWake") return { ...current, weekdayWake: value, weekendWake: value };
      return { ...current, [key]: value };
    });
    clearFeedback();
  }

  function updateWalkingDuration(value: string) {
    if (requestInFlight.current) return;
    setDraft((current) => {
      if (value.trim() === "") return { ...current, walkingHours: "", walkingMinutes: "" };
      const minutes = Number(value);
      if (!Number.isFinite(minutes)) return { ...current, walkingHours: "", walkingMinutes: "" };
      const hours = Math.trunc(minutes / 60);
      return { ...current, walkingHours: String(hours), walkingMinutes: String(minutes - hours * 60) };
    });
    clearFeedback();
  }

  function toggleWeekendSame(checked: boolean) {
    if (requestInFlight.current) return;
    setWeekendSame(checked);
    setOpenTimeField(null);
    if (checked) setDraft((current) => ({ ...current,
      weekendBed: current.weekdayBed, weekendWake: current.weekdayWake }));
    else setDraft((current) => ({ ...current, weekendBed: "", weekendWake: "" }));
    clearFeedback();
  }

  function showFirstProblem() {
    const item = INTAKE_QUESTIONS.find((question) => !questionComplete(question, draft));
    if (!item) return false;
    const sectionProblem = stepProblem(item.section, draft);
    const relevant = sectionProblem && sectionProblem.fields.some((field) =>
      (item.fields as readonly string[]).includes(field)) ? sectionProblem : null;
    const copy = item.id === "age" && finiteNumber(draft.age) !== null && finiteNumber(draft.age)! < 19
      ? "이 도구는 만 19세 이상부터 이용할 수 있어요."
      : relevant && relevant.message !== "필수 입력 항목을 모두 확인해 주세요."
        && relevant.message !== "시간 항목을 모두 선택해 주세요."
        ? relevant.message : item.label + " 항목을 확인해 주세요.";
    setResultState("input_invalid");
    setMessage(copy);
    setInvalidFields(relevant
      ? relevant.fields.filter((field) => (item.fields as readonly string[]).includes(field))
      : [...item.fields] as (keyof Draft)[]);
    setFocusRequest({ id: questionFocusId(item, draft) });
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (processed || requestInFlight.current
      || (event.nativeEvent as SubmitEvent).submitter !== submitRef.current) return;
    if (showFirstProblem()) return;
    const payload = buildPayload(draft);
    if (!payload) {
      setResultState("input_invalid");
      setMessage("입력한 11개 항목을 다시 확인해 주세요.");
      setFocusRequest({ id: INPUT_ERROR_ID });
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

  function renderNumber(key: "age" | "height" | "weight") {
    const field = FIELDS[key];
    const invalid = invalidFields.includes(key);
    return <label className="model-v2-number-field" htmlFor={field.id} key={key}>
      <span className={key === "age" ? "sr-only" : ""}>{field.label}</span>
      <span className="model-v2-number-control">
        <input id={field.id} type="number" value={draft[key]} min={field.min} max={field.max}
          step={field.step} inputMode={field.inputMode} disabled={pending} required
          aria-invalid={invalid || undefined} aria-describedby={invalid ? INPUT_ERROR_ID : undefined}
          onChange={(event) => update(key, event.target.value)} />
        <span aria-hidden="true">{key === "age" ? "세" : field.unit}</span>
      </span>
    </label>;
  }

  function renderSelect(key: "alcoholFrequency" | "alcoholAmount") {
    const field = FIELDS[key];
    const invalid = invalidFields.includes(key);
    return <select id={field.id} value={draft[key]} disabled={pending} required
      aria-label={field.label} aria-invalid={invalid || undefined}
      aria-describedby={invalid ? INPUT_ERROR_ID : undefined}
      onChange={(event) => update(key, event.target.value)}>
      <option value="">선택</option>
      {field.options?.filter(([value]) => key !== "alcoholAmount" || value !== "none")
        .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>;
  }

  function renderChoices(key: "sex" | "smoking" | "walkingDays" | "strengthDays") {
    const field = FIELDS[key];
    const choices = key === "walkingDays"
      ? Array.from({ length: 8 }, (_, day) => [String(day), day + "일"] as const)
      : field.options?.map(([value, label]) => [value, label] as const) ?? [];
    const invalid = invalidFields.includes(key);
    return <div className={"model-v2-choice-list model-v2-choice-" + key} role="radiogroup"
      aria-label={field.label} aria-invalid={invalid || undefined}
      aria-describedby={invalid ? INPUT_ERROR_ID : undefined}>
      {choices.map(([value, label], index) => <label key={value} className="model-v2-choice">
        <input id={index === 0 ? field.id : field.id + "-" + value} type="radio" name={field.id}
          value={value} checked={draft[key] === value} disabled={pending}
          onChange={() => update(key, value)} />
        <span>{label}</span>
      </label>)}
    </div>;
  }

  function renderTime(key: TimeDraftKey) {
    const field = FIELDS[key];
    const invalid = invalidFields.includes(key);
    return <TimeWheelPicker key={key} id={field.id} label={field.label} value={draft[key]} invalid={invalid}
      describedBy={invalid ? INPUT_ERROR_ID : undefined} disabled={pending}
      open={openTimeField === key} onOpen={() => setOpenTimeField(key)}
      onClose={() => setOpenTimeField(null)} onChange={(value) => update(key, value)} />;
  }

  function question(index: number, content: ReactNode, note?: ReactNode) {
    const item = INTAKE_QUESTIONS[index - 1];
    const hasError = resultState === "input_invalid" && invalidFields.some((field) =>
      (item.fields as readonly string[]).includes(field));
    return <section key={item.id} className="model-v2-intake-question" data-model-v2-question={item.id}
      data-complete={questionComplete(item, draft)} aria-labelledby={"model-v2-question-" + index}>
      <div className="model-v2-question-heading">
        <span className="model-v2-question-number" aria-hidden="true">{String(index).padStart(2, "0")}</span>
        <h3 id={"model-v2-question-" + index}>{item.label}</h3>
        {questionComplete(item, draft) && <span className="model-v2-question-complete">
          <span aria-hidden="true">✓</span><span className="sr-only">입력 완료</span>
        </span>}
      </div>
      {note && <p className="model-v2-question-note">{note}</p>}
      <div className="model-v2-question-control">{content}</div>
      {hasError && <p className="model-v2-question-error" aria-hidden="true">{message}</p>}
    </section>;
  }

  return <Scene id="S11" eyebrow="입력 기반 위험군 선별 신호"
    title="Model V2 생활정보 분석" tone="secondary" className="signal-scene model-v2-flow">
    <div className="model-v2-layout model-v2-intake-layout" data-model-v2-processed={processed ? "true" : undefined}>
      <aside className="model-v2-progress model-v2-intake-rail" aria-label="입력 진행">
        <p className="model-v2-progress-caption" role="status">{completedCount} / 11 입력 완료</p>
        <p className="model-v2-rail-copy">기본 정보 · 생활 습관 · 활동 · 수면</p>
      </aside>
      <form ref={formRef} className="measurement-panel model-v2-panel model-v2-intake-panel"
        data-model-v2-step={processed ? "result" : "intake"} onSubmit={submit}
        noValidate autoComplete="off" onKeyDown={(event) => {
          if (event.key === "Enter" && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) event.preventDefault();
        }}
        aria-describedby={resultState === "input_invalid" ? INPUT_ERROR_ID : undefined}>
        {processed ? <ModelV2Outcome draft={draft} previewOutput={previewOpen ? previewOutput : null}
          bloodPressureStatus={bloodPressureStatus} bloodPressureSupport={bloodPressureSupport}
          continuation={continuation} challengeStatus={challengeStatus} challengeSupport={challengeSupport}
          onContinue={onContinue} onReturnToToday={onReturnToToday} /> : <>
          {guestCue && <p className="model-v2-guest-cue">{guestCue}</p>}
          {resultState === "input_invalid" && <p id={INPUT_ERROR_ID} className="notice-error status-notice"
            role="alert" tabIndex={-1}>{message}</p>}
          {pending && <div id="model-v2-pending" className="model-v2-processing status-notice"
            role="status" tabIndex={-1}>
            <span className="model-v2-processing-mark" aria-hidden="true"><i /><i /><i /></span>
            <span><strong>Model V2 실행 중</strong>
              <small>모델 파일을 확인하고 현재 11개 입력을 이 브라우저에서 처리합니다.</small></span>
          </div>}
          {resultState === "temporarily_unavailable" && <div id="model-v2-unavailable"
            className="model-v2-unavailable notice-warning status-notice" role="status" tabIndex={-1}>
            <strong>지금은 분석을 완료할 수 없어요</strong>
            <p>자동으로 다시 요청하지 않습니다. 입력은 이 화면에 그대로 남아 있어요.</p>
            <small>준비가 되면 아래의 ‘Model V2로 분석하기’를 직접 눌러 주세요.</small>
          </div>}
          {showOlderApplicabilityNotice && <p className="notice-warning status-notice" role="status">
            만 80세 이상에서는 이 참고의 적용 근거가 상대적으로 약합니다. 이 내용만으로 건강 상태를 판단하지 말고, 실제 혈압을 확인해 보세요.
          </p>}
          <div className="model-v2-intake-sections">
            <section className="model-v2-intake-section" aria-labelledby="model-v2-section-basics">
              <header><h2 id="model-v2-section-basics">기본 정보</h2></header>
              {question(1, renderNumber("age"))}
              {question(2, renderChoices("sex"))}
              {question(3, <div className="model-v2-body-fields">{renderNumber("height")}{renderNumber("weight")}</div>,
                "BMI는 키와 몸무게로 자동 계산합니다.")}
            </section>
            <section className="model-v2-intake-section" aria-labelledby="model-v2-section-habits">
              <header><h2 id="model-v2-section-habits">생활 습관</h2></header>
              {question(4, renderChoices("smoking"), "일반담배 기준 · 전자담배 등 다른 제품 제외")}
              {question(5, renderSelect("alcoholFrequency"))}
              {question(6, nonDrinking
                ? <p className="model-v2-automatic">해당 없음 · 자동 적용</p>
                : renderSelect("alcoholAmount"))}
            </section>
            <section className="model-v2-intake-section" aria-labelledby="model-v2-section-activity">
              <header><h2 id="model-v2-section-activity">활동</h2></header>
              {question(7, renderChoices("walkingDays"), "같은 날 여러 번 걸었어도 하루로 세어 주세요.")}
              {question(8, noWalking
                ? <p className="model-v2-automatic">하루 평균 0분 · 자동 적용</p>
                : <label className="model-v2-number-field model-v2-walking-field" htmlFor="model-walking-total-minutes">
                  <span className="sr-only">걷는 날 하루 평균 분</span>
                  <span className="model-v2-number-control">
                    <input id="model-walking-total-minutes" type="number" min="0" max="1440" step="1"
                      inputMode="numeric" value={walkingTotalMinutes} disabled={pending} required
                      aria-invalid={invalidFields.includes("walkingHours") || undefined}
                      aria-describedby={invalidFields.includes("walkingHours") ? INPUT_ERROR_ID : undefined}
                      onChange={(event) => updateWalkingDuration(event.target.value)} />
                    <span aria-hidden="true">분</span>
                  </span>
                </label>, !noWalking && walkingTotalMinutes !== "" && Number.isInteger(Number(walkingTotalMinutes))
                  && Number(walkingTotalMinutes) >= 60 && Number(walkingTotalMinutes) <= 1440
                  ? Math.floor(Number(walkingTotalMinutes) / 60) + "시간 "
                    + String(Number(walkingTotalMinutes) % 60).padStart(2, "0") + "분"
                  : undefined)}
              {question(9, renderChoices("strengthDays"))}
            </section>
            <section className="model-v2-intake-section" aria-labelledby="model-v2-section-sleep">
              <header><h2 id="model-v2-section-sleep">수면</h2></header>
              <p className="model-v2-sleep-caption">각 시각의 오전·오후를 확인해 주세요. 자정은 오전 12:00이에요.</p>
              {question(10, <div className="model-v2-sleep-fields">{renderTime("weekdayBed")}{renderTime("weekdayWake")}</div>)}
              {question(11, <>
                <label className="model-v2-same-sleep">
                  <input id="model-weekend-same" type="checkbox" checked={weekendSame} disabled={pending}
                    onChange={(event) => toggleWeekendSame(event.target.checked)} />
                  <span>평일과 같음</span>
                </label>
                {weekendSame
                  ? <p className="model-v2-automatic">평일 취침·기상 시각을 적용했어요.</p>
                  : <div className="model-v2-sleep-fields">{renderTime("weekendBed")}{renderTime("weekendWake")}</div>}
              </>)}
              <p className="model-v2-field-help">시각을 정하기 어렵다면 분석 없이 혈압 기록과 챌린지를 이용할 수 있어요.</p>
            </section>
          </div>
          <div className="model-v2-final-action">
            <p className="model-v2-readiness" role="status">{completedCount} / 11 입력 완료</p>
            <button ref={submitRef} type="submit" disabled={pending}>
              {pending ? "Model V2 실행 중" : "Model V2로 분석하기"}
            </button>
            <p className="model-v2-action-privacy">이 브라우저에서 계산 · 분석 입력/결과 서버 추론 전송 없음 · 저장 안 함</p>
          </div>
          <div className="model-v2-intake-disclosure">
            <p>{previewOpen
              ? modelV2PreviewEndLabel + "까지 ‘연구/개발 미리보기 · 내부 연속 출력’을 소수로 표시합니다. 확률·진단·위험등급이나 치료·예방 효과가 아닙니다."
              : "이 도구는 개인별 모델 점수·백분율·등급을 제공하지 않습니다."}</p>
            <details className="model-v2-notice-details">
              <summary>입력 정보 이용 안내</summary>
              <p>입력은 생활정보 정리와 입력 기반 위험군 선별 신호 계산에만 사용해요.</p>
              <p>학습·재학습, 광고·마케팅, 프로필 보강에 사용하지 않습니다.</p>
              <p>혈압 관찰, 챌린지 기록, 이전 결과, 다른 사용자의 정보와 자동으로 결합하지 않습니다.</p>
              <p>이번 입력과 결과는 저장되지 않고, 화면을 나가거나 새로고침하면 사라져요.</p>
            </details>
          </div>
        </>}
      </form>
    </div>
  </Scene>;
}
