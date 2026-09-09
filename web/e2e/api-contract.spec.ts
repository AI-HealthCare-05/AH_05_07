import { expect, test } from "@playwright/test";

import {
  ApiRequestError,
  decodeApiError,
  requestTimeoutError,
} from "../src/lib/api-contract";

test("decodes normalized API error detail", () => {
  const error = decodeApiError(
    { detail: { code: "observation_conflict", message: "이미 기록이 있습니다." } },
    409,
  );

  expect(error).toBeInstanceOf(ApiRequestError);
  expect(error.status).toBe(409);
  expect(error.code).toBe("observation_conflict");
  expect(error.message).toBe("이미 기록이 있습니다.");
});

test("keeps validation-error compatibility", () => {
  const error = decodeApiError(
    { detail: [{ loc: ["body", "observed_on"], msg: "invalid" }] },
    422,
  );

  expect(error.status).toBe(422);
  expect(error.code).toBe("validation_error");
  expect(error.message).toBe("입력값을 확인해 주세요.");
});

test("falls back for malformed or missing API error detail", () => {
  for (const payload of [{}, { detail: "unexpected" }, { detail: null }]) {
    const error = decodeApiError(payload, 503);

    expect(error.status).toBe(503);
    expect(error.code).toBe("request_failed");
    expect(error.message).toBe("요청을 처리하지 못했습니다.");
  }
});

test("keeps the browser request-timeout identity unchanged", () => {
  const error = requestTimeoutError();

  expect(error).toBeInstanceOf(ApiRequestError);
  expect(error.status).toBe(0);
  expect(error.code).toBe("request_timeout");
  expect(error.message).toBe("요청 응답 시간을 초과했습니다.");
});
