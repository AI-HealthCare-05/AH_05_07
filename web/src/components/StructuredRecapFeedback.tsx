import { useState } from "react";
import type { Session } from "@supabase/supabase-js";

import {
  ApiRequestError,
  submitStructuredFeedback,
  type StructuredFeedbackResponse,
} from "../lib/api";

type StructuredRecapFeedbackProps = {
  session: Session;
  disabled?: boolean;
  onSessionError: (error: ApiRequestError, requestSession: Session) => void;
};

type SubmissionState = "idle" | "pending" | "saved" | "already" | "unknown" | "error";

const choices: ReadonlyArray<{ value: StructuredFeedbackResponse; label: string }> = [
  { value: "clear", label: "이해하기 쉬웠어요" },
  { value: "unclear", label: "조금 애매했어요" },
  { value: "hard_to_understand", label: "이해하기 어려웠어요" },
];

export function StructuredRecapFeedback({
  session,
  disabled = false,
  onSessionError,
}: StructuredRecapFeedbackProps) {
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [selectedResponse, setSelectedResponse] = useState<StructuredFeedbackResponse | null>(null);

  const locked =
    disabled
    || submissionState === "pending"
    || submissionState === "saved"
    || submissionState === "already";

  async function submit(response: StructuredFeedbackResponse) {
    if (locked) return;

    setSelectedResponse(response);
    setSubmissionState("pending");

    try {
      await submitStructuredFeedback(session, {
        surface: "seven_day_recap",
        response,
      });
      setSubmissionState("saved");
    } catch (error) {
      if (
        error instanceof ApiRequestError
        && (
          error.status === 401
          || error.code === "supabase_session_required"
          || error.code === "supabase_session_invalid"
        )
      ) {
        setSubmissionState("error");
        onSessionError(error, session);
        return;
      }

      if (
        error instanceof ApiRequestError
        && error.status === 409
        && error.code === "feedback_already_submitted"
      ) {
        setSubmissionState("already");
        return;
      }

      if (
        error instanceof ApiRequestError
        && (error.code === "network_error" || error.code === "request_timeout")
      ) {
        setSubmissionState("unknown");
        return;
      }

      setSubmissionState("error");
    }
  }

  return (
    <section className="state-card" data-structured-feedback aria-labelledby="structured-feedback-title">
      <p className="eyebrow">짧은 의견</p>
      <h2 id="structured-feedback-title">이 7일 기록을 이해하기 쉬웠나요?</h2>
      <p>선택한 답만 별도 의견으로 저장해요. 혈압 기록이나 챌린지 기록과 합치지 않아요.</p>

      <div className="inline-actions" role="group" aria-label="7일 기록 이해도">
        {choices.map((choice) => (
          <button
            key={choice.value}
            className="secondary"
            type="button"
            aria-pressed={selectedResponse === choice.value}
            disabled={locked}
            onClick={() => void submit(choice.value)}
          >
            {choice.label}
          </button>
        ))}
      </div>

      {submissionState === "pending" && (
        <p className="notice notice-warning" role="status">의견을 저장하는 중이에요.</p>
      )}
      {submissionState === "saved" && (
        <p className="notice notice-success" role="status">
          의견을 남겼어요. 이 응답은 다른 건강 기록과 별도로 보관돼요.
        </p>
      )}
      {submissionState === "already" && (
        <p className="notice notice-warning" role="status">
          오늘은 이미 이 화면에 대한 의견을 남겼어요.
        </p>
      )}
      {submissionState === "unknown" && (
        <p className="notice notice-warning" role="status">
          저장 여부를 확인할 수 없어요. 다시 시도하면 이미 저장된 경우 중복 대신 이미 제출됨으로 확인돼요.
        </p>
      )}
      {submissionState === "error" && (
        <p className="notice notice-error" role="alert">
          의견을 저장하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.
        </p>
      )}
    </section>
  );
}
