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
  onSessionExpired: () => void;
};

type ResultState = "idle" | "input_invalid" | "temporarily_unavailable" | "processed";

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
  return [Number(match[1]), Number(match[2])];
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

export function ModelV2InputFlow({ session, onSessionExpired }: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [resultState, setResultState] = useState<ResultState>("idle");
  const [message, setMessage] = useState("");
  const requestInFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => () => {
    mounted.current = false;
  }, []);

  const age = finiteNumber(draft.age);
  const showOlderApplicabilityNotice = age !== null && age >= 80;

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setResultState("idle");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestInFlight.current) return;

    const payload = buildPayload(draft);
    if (!payload) {
      setResultState("input_invalid");
      setMessage("필수 입력 항목을 모두 확인해 주세요.");
      return;
    }
    if (payload.age_years < 19) {
      setResultState("input_invalid");
      setMessage("이 기능은 만 19세 이상에서만 사용할 수 있습니다.");
      return;
    }
    if (!noticeAccepted) {
      setResultState("input_invalid");
      setMessage("입력과 결과가 저장되지 않는다는 안내를 확인해 주세요.");
      return;
    }

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
        onSessionExpired();
        return;
      }
      if (error instanceof ApiRequestError && error.status === 422) {
        setResultState("input_invalid");
        setMessage("입력 조합을 확인해 주세요. 수정한 뒤 다시 시도할 수 있습니다.");
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
      eyebrow="입력 기반 위험군 선별 신호"
      title="생활 정보를 직접 입력해 신호를 준비해요"
      tone="lavender"
      className="signal-scene"
    >
      <section className="signal-card" aria-labelledby="model-v2-notice-title">
        <h2 id="model-v2-notice-title">입력 전에 확인해 주세요</h2>
        <p>나이, 성별, 키·몸무게, 흡연, 음주, 걷기·활동, 근력운동, 평일·주말 수면 정보를 사용합니다.</p>
        <p>이 기능은 진단, 치료, 예방 또는 임상 결정을 제공하지 않습니다.</p>
        <p>이번 입력과 결과는 저장하지 않으며 학습·재학습, 광고·마케팅, 프로필 보강에 사용하지 않습니다.</p>
        <p>혈압 관찰, 챌린지 기록, 이전 결과, 다른 사용자의 정보와 자동으로 결합하지 않습니다.</p>
      </section>

      {showOlderApplicabilityNotice && (
        <p className="notice notice-warning" role="status">
          만 80세 이상에서는 모델 개발 근거의 적용 가능성이 상대적으로 덜 확실합니다. 결과가 무효라는 뜻은 아니며 진단이나 임상 판단으로 사용하지 마세요.
        </p>
      )}

      <form className="measurement-panel" onSubmit={submit} noValidate>
        <div className="field-grid">
          <label htmlFor="model-age">나이
            <input id="model-age" type="number" min="19" step="1" inputMode="numeric" value={draft.age} onChange={(event) => update("age", event.target.value)} disabled={pending} required />
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
            <input id="model-weekday-bed" type="time" value={draft.weekdayBed} onChange={(event) => update("weekdayBed", event.target.value)} disabled={pending} required />
          </label>
          <label htmlFor="model-weekday-wake">평일 기상 시간
            <input id="model-weekday-wake" type="time" value={draft.weekdayWake} onChange={(event) => update("weekdayWake", event.target.value)} disabled={pending} required />
          </label>
          <label htmlFor="model-weekend-bed">주말 취침 시간
            <input id="model-weekend-bed" type="time" value={draft.weekendBed} onChange={(event) => update("weekendBed", event.target.value)} disabled={pending} required />
          </label>
          <label htmlFor="model-weekend-wake">주말 기상 시간
            <input id="model-weekend-wake" type="time" value={draft.weekendWake} onChange={(event) => update("weekendWake", event.target.value)} disabled={pending} required />
          </label>
        </div>

        <label className="signal-consent" htmlFor="model-notice-accepted">
          <input id="model-notice-accepted" type="checkbox" checked={noticeAccepted} onChange={(event) => setNoticeAccepted(event.target.checked)} disabled={pending} />
          위 안내를 확인했습니다.
        </label>

        {resultState === "input_invalid" && <p className="notice notice-error" role="alert">{message}</p>}
        {resultState === "temporarily_unavailable" && <p className="notice notice-warning" role="status">지금은 신호를 준비할 수 없습니다. 자동으로 다시 요청하지 않습니다.</p>}
        {resultState === "processed" && (
          <div className="signal-card" data-model-v2-user-result="processed" role="status" aria-live="polite">
            <span className="status-pill">처리 완료</span>
            <h2>입력 기반 위험군 선별 신호를 처리했습니다.</h2>
            <p>점수, 확률, 등급은 표시하거나 저장하지 않습니다.</p>
            <p>이 신호는 진단·치료·예방 판단을 제공하지 않습니다.</p>
          </div>
        )}

        <button type="submit" disabled={pending}>{pending ? "신호 준비 중" : "신호 준비하기"}</button>
      </form>
    </Scene>
  );
}
