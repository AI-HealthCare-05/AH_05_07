import { useMemo } from "react";

import { adaptProductInput, FEATURES } from "../lib/model-v2/adapter";
import { buildPayload, type Draft } from "./modelV2Draft";
import { formatTimeKorean, reviewValue } from "./modelV2Steps";
import type { ModelV2Continuation } from "./modelV2Continuation";

type Props = {
  draft: Draft;
  previewOutput: number | null;
  bloodPressureStatus: string;
  bloodPressureSupport: string;
  continuation: ModelV2Continuation;
  challengeStatus: string;
  challengeSupport: string;
  onContinue: () => void;
  onReturnToToday: () => void;
};

const FEATURE_LABELS: Record<typeof FEATURES[number], string> = {
  age_years: "만 나이 · 세",
  sex_knhanes: "성별 · 설문 코드",
  bmi_from_height_weight: "키·몸무게로 계산한 BMI",
  cigarette_smoking_state: "일반담배 흡연 상태",
  alcohol_frequency: "음주 빈도",
  alcohol_amount_category: "한 번 마실 때 음주량",
  walking_days_7d: "최근 7일 걷기 · 일",
  walking_minutes_per_active_day: "걷는 날 하루 평균 · 분",
  strength_days_7d: "최근 7일 근력운동 · 범주",
  weekday_sleep_minutes: "평일 수면 구간 · 분",
  weekend_sleep_minutes: "주말 수면 구간 · 분",
};

function formatDurationMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

export function ModelV2Outcome({
  draft,
  previewOutput,
  bloodPressureStatus,
  bloodPressureSupport,
  continuation,
  challengeStatus,
  challengeSupport,
  onContinue,
  onReturnToToday,
}: Props) {
  // Mounted only after successful local inference with this unchanged draft.
  // Reuse its canonical derivation; presentation rounding never feeds the model.
  const features = useMemo(() => adaptProductInput(buildPayload(draft)), [draft]);
  const walkingDays = features.walking_days_7d as number;
  const walkingMinutes = features.walking_minutes_per_active_day as number;
  const weeklyWalkingMinutes = walkingDays * walkingMinutes;
  const weekdayMinutes = features.weekday_sleep_minutes as number;
  const weekendMinutes = features.weekend_sleep_minutes as number;
  const sleepDifference = weekendMinutes - weekdayMinutes;
  const bmi = features.bmi_from_height_weight as number;
  const hasPreview = previewOutput !== null && Number.isFinite(previewOutput);

  return <div className="model-v2-outcome" data-model-v2-user-result="processed">
    <header className="model-v2-outcome-heading">
      <h2 id="model-v2-result-title" tabIndex={-1}>{hasPreview ? "연구 모델 분석 결과" : "생활정보 처리를 완료했어요"}</h2>
      {hasPreview ? (
        <div data-model-v2-preview>
          <p id="model-v2-preview-label">연구/개발 미리보기 · 내부 연속 출력</p>
          <p data-model-v2-preview-value>{previewOutput.toFixed(3)}</p>
          <p>입력한 생활정보를 이 기기에서 Model V2가 처리해 만든 연속 출력입니다.</p>
          <p className="model-v2-result-disclaimer">이 값은 확률·백분율·백분위, 진단, 정상/비정상 판정, 위험군 등급, 중증도 또는 향후 고혈압 발생 가능성을 뜻하지 않습니다. 치료·예방 효과를 뜻하지 않습니다.</p>
        </div>
      ) : (
        <p>현재 제품에서는 개인별 모델 점수·확률·백분율·등급을 표시하지 않아요.</p>
      )}
      <p className="model-v2-local-privacy">이 브라우저에서 계산됨 · 분석 입력·결과 서버 전송 없음 · 저장 안 함</p>
      {Number(draft.age) >= 80 && <p className="notice notice-warning">
        만 80세 이상에서는 이 참고의 적용 근거가 상대적으로 약합니다. 이 내용만으로 건강 상태를 판단하지 말고, 실제 혈압을 확인해 보세요.
      </p>}
    </header>

    <div className="model-v2-summary-heading">
      <p className="model-v2-outcome-kicker">오늘의 시작점 · 이번 이용에만</p>
      <h3>오늘의 생활 패턴을 정리했어요</h3>
    </div>

    <div className="model-v2-result-summary" aria-label="입력한 생활정보 요약">
      <section className="model-v2-result-section" aria-labelledby="model-v2-activity-title">
        <h3 id="model-v2-activity-title">활동</h3>
        <dl>
          <div><dt>최근 7일 걷기</dt><dd>{walkingDays}일</dd></div>
          <div><dt>걷는 날 하루 평균</dt><dd>{formatDurationMinutes(walkingMinutes)}</dd></div>
          <div className="model-v2-result-keyfact"><dt>입력 기준 주간 합계</dt><dd>약 {weeklyWalkingMinutes}분</dd></div>
          <div><dt>최근 7일 근력운동</dt><dd>{reviewValue("strengthDays", draft)}</dd></div>
        </dl>
        <p className="model-v2-result-explanation">입력한 걷기 일수에 걷는 날 하루 평균 시간을 곱한 단순 계산값이에요.</p>
      </section>

      <section className="model-v2-result-section" aria-labelledby="model-v2-sleep-title">
        <h3 id="model-v2-sleep-title">수면</h3>
        <dl>
          <div>
            <dt>평일</dt>
            <dd><span className="model-v2-result-clock">{formatTimeKorean(draft.weekdayBed)} → {formatTimeKorean(draft.weekdayWake)}</span>{formatDurationMinutes(weekdayMinutes)}</dd>
          </div>
          <div>
            <dt>주말</dt>
            <dd><span className="model-v2-result-clock">{formatTimeKorean(draft.weekendBed)} → {formatTimeKorean(draft.weekendWake)}</span>{formatDurationMinutes(weekendMinutes)}</dd>
          </div>
        </dl>
        <p className="model-v2-sleep-comparison">{sleepDifference === 0
          ? "입력한 평일·주말 수면 구간의 길이가 같아요."
          : `주말이 평일보다 ${formatDurationMinutes(Math.abs(sleepDifference))} ${sleepDifference > 0 ? "길어요" : "짧아요"}.`}</p>
        <p className="model-v2-result-explanation">입력한 취침·기상 시각 사이의 간격이에요.</p>
      </section>

      <section className="model-v2-result-section" aria-labelledby="model-v2-habits-title">
        <h3 id="model-v2-habits-title">생활 습관</h3>
        <dl>
          <div><dt>일반담배</dt><dd>{reviewValue("smoking", draft)}</dd></div>
          <div><dt>음주</dt><dd>{reviewValue("alcoholFrequency", draft)} · {draft.alcoholAmount === "none" ? reviewValue("alcoholAmount", draft) : `한 번 ${reviewValue("alcoholAmount", draft)}`}</dd></div>
        </dl>
      </section>

      <section className="model-v2-result-section" aria-labelledby="model-v2-body-title">
        <h3 id="model-v2-body-title">체격 참고</h3>
        <dl>
          <div><dt>키</dt><dd>{reviewValue("height", draft)}</dd></div>
          <div><dt>몸무게</dt><dd>{reviewValue("weight", draft)}</dd></div>
          <div><dt>계산 BMI</dt><dd>{bmi.toFixed(1)}</dd></div>
        </dl>
        <p className="model-v2-result-explanation">입력한 키와 몸무게로 계산한 참고값이에요.</p>
      </section>
    </div>

    <section className="model-v2-result-next" aria-labelledby="model-v2-next-title">
      <p className="eyebrow">현재 기록 기준</p>
      <h3 id="model-v2-next-title">다음 한 걸음</h3>
      <div className="model-v2-continuation" data-model-v2-continuation={continuation.key}>
        <h4>{continuation.title}</h4>
        <p>{continuation.support}</p>
        <div className="model-v2-actions">
          <button type="button" onClick={onContinue}>{continuation.actionLabel}</button>
        </div>
      </div>
      <div className="model-v2-next-context" aria-label="현재 앱 기록 상태">
        <div data-model-v2-continuity="blood-pressure">
          <span>오늘 혈압</span>
          <strong>{bloodPressureStatus}</strong>
          <small>{bloodPressureSupport}</small>
        </div>
        <div data-model-v2-continuity="challenge">
          <span>7일 챌린지</span>
          <strong>{challengeStatus}</strong>
          <small>{challengeSupport}</small>
        </div>
      </div>
      <p className="model-v2-result-explanation">다음 행동은 분석값이 아니라, 현재 앱에 남아 있는 오늘 기록 상태만 보고 정해요.</p>
      {continuation.destination !== "S02" && <button className="text-button" type="button" onClick={onReturnToToday}>오늘의 기록으로 돌아가기</button>}
    </section>

    <p className="model-v2-result-disclaimer">
      이 요약은 입력한 생활정보를 읽기 좋게 정리한 것이며, 건강 상태나 질환 위험도를 판단하는 결과가 아니에요.
      특정 생활습관이 어떤 결과의 원인이라는 뜻도 아닙니다.
    </p>
    <p className="model-v2-result-explanation">이번 입력과 결과는 저장되지 않아 기록 목록에서 다시 볼 수 없어요. 화면을 나가거나 새로고침하면 사라져요.</p>

    <section className="model-v2-result-model-note" aria-labelledby="model-v2-research-title">
      <h3 id="model-v2-research-title">처리 방식과 입력 상세</h3>
      <details className="model-v2-notice-details" data-model-v2-research>
        <summary>Model V2 처리 안내</summary>
        <p>Model V2 처리가 완료됐어요.</p>
        <p>계산에 필요한 모델 파일은 네트워크에서 받을 수 있어요. 이 분석의 생활정보와 결과값은 서버 추론 요청으로 전송하지 않고, 이 브라우저에서 일시적으로 처리합니다.</p>
        {hasPreview && <p>소수점 셋째 자리 표시는 화면 표시용 반올림이며, 판단 기준이나 등급을 뜻하지 않습니다.</p>}
      </details>
      <details className="model-v2-notice-details" data-model-v2-inputs>
        <summary>모델에 사용된 입력 보기</summary>
        <p>방금 입력한 내용을 모델에 맞게 변환한 11개 값이에요. 모델에 전달한 순서와 값 그대로 표시해요.</p>
        <p>성별은 설문 코드(남성 1, 여성 2), 생활 습관과 근력운동은 선택한 범주로 표시돼요. BMI는 위 참고값과 달리 화면용 반올림을 하지 않았어요.</p>
        <dl className="model-v2-feature-list">
          {FEATURES.map((feature) => <div key={feature} data-model-v2-feature={feature}>
            <dt>{FEATURE_LABELS[feature]}<code>{feature}</code></dt>
            <dd>{String(features[feature])}</dd>
          </div>)}
        </dl>
      </details>
    </section>
  </div>;
}
