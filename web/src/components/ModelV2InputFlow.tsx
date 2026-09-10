import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import {
  ApiRequestError,
  scoreModelV2ProductInput,
  type ModelV2ProductInput,
} from "../lib/api";
import { Scene } from "./SceneShell";

type Props = {
  session: Session;
  captureRequestContext: (activeSession: Session | null) => ModelV2RequestContext | null;
  onSessionExpired: (requestContext: ModelV2RequestContext) => void;
};

export type ModelV2RequestContext = {
  userId: string;
  generation: number;
  accessToken: string;
};

type ResultState = "idle" | "input_invalid" | "temporarily_unavailable" | "processed";

type TimeDraftKey =
  | "weekdayBed"
  | "weekdayWake"
  | "weekendBed"
  | "weekendWake";

const TIME_FIELD_KEYS: readonly TimeDraftKey[] = [
  "weekdayBed",
  "weekdayWake",
  "weekendBed",
  "weekendWake",
];

type Draft = {
  age: string;
  sex: "" | "1" | "2";
  height: string;
  weight: string;
  smoking: string;
  alcoholFrequency: string;
  alcoholAmount: string;
  walkingDays: string;
  walkingHours: string;
  walkingMinutes: string;
  strengthDays: string;
  weekdayBed: string;
  weekdayWake: string;
  weekendBed: string;
  weekendWake: string;
};

const EMPTY_DRAFT: Draft = {
  age: "",
  sex: "",
  height: "",
  weight: "",
  smoking: "",
  alcoholFrequency: "",
  alcoholAmount: "",
  walkingDays: "",
  walkingHours: "",
  walkingMinutes: "",
  strengthDays: "",
  weekdayBed: "",
  weekdayWake: "",
  weekendBed: "",
  weekendWake: "",
};

function finiteNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clockParts(value: string): [number, number] | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return [hour, minute];
}

function buildPayload(draft: Draft): ModelV2ProductInput | null {
  const age = finiteNumber(draft.age);
  const height = finiteNumber(draft.height);
  const weight = finiteNumber(draft.weight);
  const walkingDays = finiteNumber(draft.walkingDays);
  const walkingHours = finiteNumber(draft.walkingHours);
  const walkingMinutes = finiteNumber(draft.walkingMinutes);
  const weekdayBed = clockParts(draft.weekdayBed);
  const weekdayWake = clockParts(draft.weekdayWake);
  const weekendBed = clockParts(draft.weekendBed);
  const weekendWake = clockParts(draft.weekendWake);

  if (
    age === null
    || !draft.sex
    || height === null
    || weight === null
    || !draft.smoking
    || !draft.alcoholFrequency
    || !draft.alcoholAmount
    || walkingDays === null
    || walkingHours === null
    || walkingMinutes === null
    || !draft.strengthDays
    || !weekdayBed
    || !weekdayWake
    || !weekendBed
    || !weekendWake
  ) return null;

  return {
    age_years: age,
    sex_knhanes: Number(draft.sex) as 1 | 2,
    height_cm: height,
    weight_kg: weight,
    cigarette_smoking_state: draft.smoking,
    alcohol_frequency: draft.alcoholFrequency,
    alcohol_amount_category: draft.alcoholAmount,
    walking_days_7d: walkingDays,
    walking_active_day_hours: walkingHours,
    walking_active_day_minutes: walkingMinutes,
    strength_days_7d: draft.strengthDays,
    weekday_bed_hour: weekdayBed[0],
    weekday_bed_minute: weekdayBed[1],
    weekday_wake_hour: weekdayWake[0],
    weekday_wake_minute: weekdayWake[1],
    weekend_bed_hour: weekendBed[0],
    weekend_bed_minute: weekendBed[1],
    weekend_wake_hour: weekendWake[0],
    weekend_wake_minute: weekendWake[1],
  };
}

export function ModelV2InputFlow({ session, captureRequestContext, onSessionExpired }: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [resultState, setResultState] = useState<ResultState>("idle");
  const [message, setMessage] = useState("");
  const [inputErrorTarget, setInputErrorTarget] = useState<"form" | "age" | "consent" | null>(null);
  const [invalidTimeFields, setInvalidTimeFields] = useState<TimeDraftKey[]>([]);
  const requestInFlight = useRef(false);
  const mounted = useRef(true);

  const inputErrorId = "model-v2-input-error";

  useEffect(() => () => {
    mounted.current = false;
  }, []);

  const age = finiteNumber(draft.age);
  const showOlderApplicabilityNotice = age !== null && age >= 80;

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setResultState("idle");
    setMessage("");
    setInputErrorTarget(null);
    setInvalidTimeFields([]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestInFlight.current) return;

    const incompleteTimeFields = TIME_FIELD_KEYS.filter(
      (key) => clockParts(draft[key]) === null,
    );
    if (incompleteTimeFields.length > 0) {
      setResultState("input_invalid");
      setMessage("시간 항목을 모두 선택해 주세요.");
      setInputErrorTarget("form");
      setInvalidTimeFields([...incompleteTimeFields]);
      return;
    }

    setInvalidTimeFields([]);
    const payload = buildPayload(draft);
    if (!payload) {
      setResultState("input_invalid");
      setMessage("필수 입력 항목을 모두 확인해 주세요.");
      setInputErrorTarget("form");
      return;
    }
    if (payload.age_years < 19) {
      setResultState("input_invalid");
      setMessage("이 기능은 만 19세 이상에서만 사용할 수 있습니다.");
      setInputErrorTarget("age");
      return;
    }
    if (!noticeAccepted) {
      setResultState("input_invalid");
      setMessage("입력과 결과가 저장되지 않는다는 안내를 확인해 주세요.");
      setInputErrorTarget("consent");
      return;
    }

    const requestContext = captureRequestContext(session);
    if (!requestContext) return;
    requestInFlight.current = true;
    setPending(true);
    setResultState("idle");
    setMessage("");

    try {
      await scoreModelV2ProductInput(session, payload);
      if (!mounted.current) return;
      setResultState("processed");
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof ApiRequestError && error.status === 401) {
        onSessionExpired(requestContext);
        return;
      }
      if (error instanceof ApiRequestError && error.status === 422) {
        setResultState("input_invalid");
        setMessage("입력 조합을 확인해 주세요. 수정한 뒤 다시 시도할 수 있습니다.");
        setInputErrorTarget("form");
        return;
      }
      setResultState("temporarily_unavailable");
    } finally {
      requestInFlight.current = false;
      if (mounted.current) setPending(false);
    }
  }

  return (
    <Scene
      id="S11"
      eyebrow="생활정보 기반 고혈압 선별 참고"
      title="생활정보를 바탕으로 고혈압 관련 패턴을 확인해요"
      tone="lavender"
      className="signal-scene"
    >
      <section className="signal-card" aria-labelledby="model-v2-notice-title">
        <h2 id="model-v2-notice-title">입력 전에 확인해 주세요</h2>
        <p>나이, 체격, 흡연·음주, 활동량, 수면 정보를 바탕으로 연구 데이터에서 고혈압 상태와 함께 나타난 패턴을 모델로 확인합니다.</p>
        <p>이 기능은 진단, 치료, 예방 또는 임상 결정을 제공하지 않습니다.</p>
        <p>이번 입력과 결과는 저장하지 않으며 학습·재학습, 광고·마케팅, 프로필 보강에 사용하지 않습니다.</p>
        <p>혈압 관찰, 챌린지 기록, 이전 결과, 다른 사용자의 정보와 자동으로 결합하지 않습니다.</p>
      </section>

      {showOlderApplicabilityNotice && (
        <p className="notice notice-warning" role="status">
          만 80세 이상에서는 이 참고의 적용 근거가 상대적으로 약합니다. 이 내용만으로 건강 상태를 판단하지 말고, 실제 혈압을 확인해 보세요.
        </p>
      )}

      <form
        className="measurement-panel"
        onSubmit={submit}
        noValidate
        aria-describedby={resultState === "input_invalid" ? inputErrorId : undefined}
      >
        <div className="field-grid">
          <label htmlFor="model-age">나이
            <input id="model-age" type="number" min="19" step="1" inputMode="numeric" value={draft.age} onChange={(event) => update("age", event.target.value)} disabled={pending} required aria-invalid={inputErrorTarget === "age" || undefined} aria-describedby={inputErrorTarget === "age" ? inputErrorId : undefined} />
          </label>
          <label htmlFor="model-sex">성별
            <select id="model-sex" value={draft.sex} onChange={(event) => update("sex", event.target.value as Draft["sex"])} disabled={pending} required>
              <option value="">선택</option>
              <option value="1">남성</option>
              <option value="2">여성</option>
            </select>
          </label>
          <label htmlFor="model-height">키 <span className="unit">cm</span>
            <input id="model-height" type="number" min="1" step="0.1" inputMode="decimal" value={draft.height} onChange={(event) => update("height", event.target.value)} disabled={pending} required />
          </label>
          <label htmlFor="model-weight">몸무게 <span className="unit">kg</span>
            <input id="model-weight" type="number" min="1" step="0.1" inputMode="decimal" value={draft.weight} onChange={(event) => update("weight", event.target.value)} disabled={pending} required />
          </label>
          <label htmlFor="model-smoking">흡연 상태
            <select id="model-smoking" value={draft.smoking} onChange={(event) => update("smoking", event.target.value)} disabled={pending} required>
              <option value="">선택</option>
              <option value="daily_current">현재 매일 흡연</option>
              <option value="occasional_current">현재 가끔 흡연</option>
              <option value="former_currently_not_smoking">과거 흡연, 현재 금연</option>
              <option value="never_smoked">비흡연</option>
            </select>
          </label>
          <label htmlFor="model-alcohol-frequency">음주 빈도
            <select id="model-alcohol-frequency" value={draft.alcoholFrequency} onChange={(event) => update("alcoholFrequency", event.target.value)} disabled={pending} required>
              <option value="">선택</option>
              <option value="none_past_year">최근 1년간 마시지 않음</option>
              <option value="lt_monthly">월 1회 미만</option>
              <option value="monthly_once">월 1회 정도</option>
              <option value="monthly_2_4">월 2~4회</option>
              <option value="weekly_2_3">주 2~3회</option>
              <option value="weekly_4_plus">주 4회 이상</option>
              <option value="lifetime_nonapplicable">평생 마시지 않음</option>
            </select>
          </label>
          <label htmlFor="model-alcohol-amount">한 번 마실 때 음주량
            <select id="model-alcohol-amount" value={draft.alcoholAmount} onChange={(event) => update("alcoholAmount", event.target.value)} disabled={pending} required>
              <option value="">선택</option>
              <option value="1_2_drinks">1~2잔</option>
              <option value="3_4_drinks">3~4잔</option>
              <option value="5_6_drinks">5~6잔</option>
              <option value="7_9_drinks">7~9잔</option>
              <option value="10_plus_drinks">10잔 이상</option>
              <option value="none">해당 없음</option>
            </select>
          </label>
          <label htmlFor="model-walking-days">최근 7일 걷기 일수
            <input id="model-walking-days" type="number" min="0" max="7" step="1" inputMode="numeric" value={draft.walkingDays} onChange={(event) => update("walkingDays", event.target.value)} disabled={pending} required />
          </label>
          <label htmlFor="model-walking-hours">걷는 날 하루 평균 시간 <span className="unit">시간</span>
            <input id="model-walking-hours" type="number" min="0" max="24" step="1" inputMode="numeric" value={draft.walkingHours} onChange={(event) => update("walkingHours", event.target.value)} disabled={pending} required />
          </label>
          <label htmlFor="model-walking-minutes">걷는 날 추가 시간 <span className="unit">분</span>
            <input id="model-walking-minutes" type="number" min="0" max="59" step="1" inputMode="numeric" value={draft.walkingMinutes} onChange={(event) => update("walkingMinutes", event.target.value)} disabled={pending} required />
          </label>
          <label htmlFor="model-strength">최근 7일 근력운동
            <select id="model-strength" value={draft.strengthDays} onChange={(event) => update("strengthDays", event.target.value)} disabled={pending} required>
              <option value="">선택</option>
              <option value="0_days">0일</option>
              <option value="1_day">1일</option>
              <option value="2_days">2일</option>
              <option value="3_days">3일</option>
              <option value="4_days">4일</option>
              <option value="5_plus_days">5일 이상</option>
            </select>
          </label>
          <label htmlFor="model-weekday-bed">평일 취침 시간
            <input
              id="model-weekday-bed"
              type="time"
              value={draft.weekdayBed}
              onChange={(event) => update("weekdayBed", event.target.value)}
              disabled={pending}
              required
              data-time-complete={clockParts(draft.weekdayBed) ? "true" : "false"}
              aria-invalid={invalidTimeFields.includes("weekdayBed") || undefined}
              aria-describedby={`model-weekday-bed-status${invalidTimeFields.includes("weekdayBed") ? ` ${inputErrorId}` : ""}`}
            />
            <span
              id="model-weekday-bed-status"
              className={invalidTimeFields.includes("weekdayBed") ? "field-error" : "unit"}
            >
              {clockParts(draft.weekdayBed) ? "선택 완료" : "시간 선택 필요"}
            </span>
          </label>
          <label htmlFor="model-weekday-wake">평일 기상 시간
            <input
              id="model-weekday-wake"
              type="time"
              value={draft.weekdayWake}
              onChange={(event) => update("weekdayWake", event.target.value)}
              disabled={pending}
              required
              data-time-complete={clockParts(draft.weekdayWake) ? "true" : "false"}
              aria-invalid={invalidTimeFields.includes("weekdayWake") || undefined}
              aria-describedby={`model-weekday-wake-status${invalidTimeFields.includes("weekdayWake") ? ` ${inputErrorId}` : ""}`}
            />
            <span
              id="model-weekday-wake-status"
              className={invalidTimeFields.includes("weekdayWake") ? "field-error" : "unit"}
            >
              {clockParts(draft.weekdayWake) ? "선택 완료" : "시간 선택 필요"}
            </span>
          </label>
          <label htmlFor="model-weekend-bed">주말 취침 시간
            <input
              id="model-weekend-bed"
              type="time"
              value={draft.weekendBed}
              onChange={(event) => update("weekendBed", event.target.value)}
              disabled={pending}
              required
              data-time-complete={clockParts(draft.weekendBed) ? "true" : "false"}
              aria-invalid={invalidTimeFields.includes("weekendBed") || undefined}
              aria-describedby={`model-weekend-bed-status${invalidTimeFields.includes("weekendBed") ? ` ${inputErrorId}` : ""}`}
            />
            <span
              id="model-weekend-bed-status"
              className={invalidTimeFields.includes("weekendBed") ? "field-error" : "unit"}
            >
              {clockParts(draft.weekendBed) ? "선택 완료" : "시간 선택 필요"}
            </span>
          </label>
          <label htmlFor="model-weekend-wake">주말 기상 시간
            <input
              id="model-weekend-wake"
              type="time"
              value={draft.weekendWake}
              onChange={(event) => update("weekendWake", event.target.value)}
              disabled={pending}
              required
              data-time-complete={clockParts(draft.weekendWake) ? "true" : "false"}
              aria-invalid={invalidTimeFields.includes("weekendWake") || undefined}
              aria-describedby={`model-weekend-wake-status${invalidTimeFields.includes("weekendWake") ? ` ${inputErrorId}` : ""}`}
            />
            <span
              id="model-weekend-wake-status"
              className={invalidTimeFields.includes("weekendWake") ? "field-error" : "unit"}
            >
              {clockParts(draft.weekendWake) ? "선택 완료" : "시간 선택 필요"}
            </span>
          </label>
        </div>

        <label className="signal-consent" htmlFor="model-notice-accepted">
          <input id="model-notice-accepted" type="checkbox" checked={noticeAccepted} onChange={(event) => { setNoticeAccepted(event.target.checked); setResultState("idle"); setMessage(""); setInputErrorTarget(null); setInvalidTimeFields([]); }} disabled={pending} aria-invalid={inputErrorTarget === "consent" || undefined} aria-describedby={inputErrorTarget === "consent" ? inputErrorId : undefined} />
          위 안내를 확인했습니다.
        </label>

        {resultState === "input_invalid" && <p id={inputErrorId} className="notice notice-error" role="alert">{message}</p>}
        {resultState === "temporarily_unavailable" && <p className="notice notice-warning" role="status">지금은 생활정보 분석을 완료할 수 없습니다. 자동으로 다시 요청하지 않습니다.</p>}
        {resultState === "processed" && (
          <div className="signal-card" data-model-v2-user-result="processed" role="status" aria-live="polite">
            <span className="status-pill">분석 완료</span>
            <h2>생활정보 분석이 완료되었습니다.</h2>
            <p>현재는 개인별 모델 점수·백분율·등급을 제공하지 않습니다.</p>
            <p>이 기능은 고혈압 진단이나 앞으로 고혈압이 생길 가능성을 알려주지 않으며, 특정 생활습관이 결과의 원인이라는 뜻도 아닙니다.</p>
            <p>다음 단계로 실제 혈압을 확인해 보세요. 원하면 혈압 기록을 남기고, 7일 생활 챌린지는 별도로 선택할 수 있습니다.</p>
          </div>
        )}

        <button type="submit" disabled={pending}>{pending ? "생활정보 분석 중" : "생활정보 분석하기"}</button>
      </form>
    </Scene>
  );
}
