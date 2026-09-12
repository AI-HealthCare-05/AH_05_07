import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { ApiRequestError, scoreModelV2ProductInput } from "../lib/api";
import { Scene } from "./SceneShell";
import { buildPayload, clockParts, EMPTY_DRAFT, finiteNumber, TIME_FIELD_KEYS, type Draft } from "./modelV2Draft";
import { FIELDS, INPUT_STEPS, PROGRESS_STEPS, reviewValue, STEPS, stepProblem, type InputStep, type Step, type StepProblem } from "./modelV2Steps";
import "./ModelV2InputFlow.css";

type Props = {
  session: Session;
  captureRequestContext: (activeSession: Session | null) => ModelV2RequestContext | null;
  onSessionExpired: (requestContext: ModelV2RequestContext) => void;
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

export function ModelV2InputFlow({ session, captureRequestContext, onSessionExpired, onReturnToToday }: Props) {
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
  const requestInFlight = useRef(false);
  const mounted = useRef(true);
  const formRef = useRef<HTMLFormElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!focusRequest) return;
    formRef.current?.querySelector<HTMLElement>(`#${focusRequest.id}`)?.focus();
  }, [focusRequest]);

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
  }

  function update(key: keyof Draft, value: string) {
    if (requestInFlight.current) return;
    setDraft((current) => ({ ...current, [key]: value }));
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
      await scoreModelV2ProductInput(session, payload);
      if (!mounted.current) return;
      setResultState("processed");
      setFocusRequest({ id: "model-v2-result-title" });
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof ApiRequestError && error.status === 401) {
        onSessionExpired(requestContext);
        // A stale 401 may be ignored by the existing session guard. Restore
        // review focus in that case so the newer session can submit deliberately.
        setFocusRequest({ id: STEP_TITLE_ID });
        return;
      }
      if (error instanceof ApiRequestError && error.status === 422) {
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
    const describedBy = [isTime ? `${field.id}-status` : null, invalid ? INPUT_ERROR_ID : null].filter(Boolean).join(" ") || undefined;
    const shared = {
      id: field.id, value: draft[key], disabled: pending, required: true,
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
        {isTime && <span id={`${field.id}-status`} className={`model-v2-time-status${invalid ? " field-error" : ""}`} data-complete={complete}>
          {complete ? "선택 완료" : "시간 선택 필요"}
        </span>}
      </label>
    );
  }

  return (
    <Scene id="S11" eyebrow="입력 기반 위험군 선별 신호" title="생활정보를 차근차근 입력해요" tone="lavender" className="signal-scene model-v2-flow">
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
          <p className="model-v2-privacy-note">입력은 이 화면에만 머물러요.<br />화면을 나가거나 새로고침하면 사라져요.</p>
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
                <span className="status-pill">입력 처리 완료</span>
                <h2 id="model-v2-result-title" tabIndex={-1}>생활정보 분석이 완료되었습니다.</h2>
                <p>입력 처리가 완료되었다는 뜻이며, 건강 상태를 판단하는 결과는 아닙니다.</p>
                <p>현재는 개인별 모델 점수·백분율·등급을 제공하지 않습니다. 특정 생활습관이 결과의 원인이라는 뜻도 아닙니다.</p>
                <p>이번 입력과 결과는 저장되지 않습니다. 혈압 기록과 7일 생활 챌린지는 별도로 이용할 수 있어요.</p>
              </div>
              <div className="model-v2-actions"><button type="button" onClick={onReturnToToday}>오늘의 기록으로 돌아가기</button></div>
            </>
          ) : (
            <>
              <header className="model-v2-step-heading">
                <p className="model-v2-kicker">{step === "intro" ? "입력 전에 잠깐" : step === "review" ? "보내기 전 마지막 확인" : `${progressIndex + 1}번째 이야기`}</p>
                <h2 id={STEP_TITLE_ID} tabIndex={-1}>{step === "intro" ? "내 생활정보를 하나씩 살펴봐요" : STEPS[step].label}</h2>
                {step !== "intro" && <p>{STEPS[step].description}</p>}
              </header>

              {resultState === "input_invalid" && <p id={INPUT_ERROR_ID} className="notice notice-error" role="alert" tabIndex={-1}>{message}</p>}
              {pending && <p id="model-v2-pending" className="notice" role="status" tabIndex={-1}>생활정보 분석 중입니다. 잠시 기다려 주세요.</p>}
              {resultState === "temporarily_unavailable" && <p id="model-v2-unavailable" className="notice notice-warning" role="status" tabIndex={-1}>지금은 생활정보 분석을 완료할 수 없습니다. 자동으로 다시 요청하지 않습니다. 입력은 이 화면에 남아 있어요. 잠시 후 직접 다시 요청할 수 있습니다.</p>}

              {step === "intro" && <section className="model-v2-intro" aria-labelledby={STEP_TITLE_ID}>
                <div className="model-v2-intro-mark" aria-hidden="true" />
                <p>나이, 체격, 생활 습관, 활동, 수면 정보를 바탕으로 연구 데이터에서 함께 나타난 패턴을 확인합니다.</p>
                <p>건강 상태나 앞으로의 변화를 판단하는 결과는 아니며, 의료적 판단을 제공하지 않습니다.</p>
                <p>입력과 결과는 저장하지 않아요. 마지막 확인 단계에서 직접 분석을 요청할 수 있어요.</p>
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
                <p className="model-v2-sleep-caption">시간 선택 {timeCompleteCount} / 4 · 자정은 00:00으로 선택해 주세요.</p>
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
                  <p>이번 입력과 결과는 저장하지 않으며 학습·재학습, 광고·마케팅, 프로필 보강에 사용하지 않습니다. 혈압 관찰, 챌린지 기록, 이전 결과, 다른 사용자의 정보와 자동으로 결합하지 않습니다.</p>
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
