import assert from "node:assert/strict";
import { test } from "@playwright/test";
import { buildPayload, finiteNumber, clockParts, type Draft } from "../src/components/modelV2Draft";
import { INPUT_STEPS, stepProblem } from "../src/components/modelV2Steps";
import { adaptProductInput } from "../src/lib/model-v2/adapter";
import { visibleModelV2Output } from "../src/ui/modelV2VisibilityPolicy";

// Synthetic-only, complete control input. Never fill unanswered product inputs.
const base: Draft = {
  age: "35", sex: "1", height: "170", weight: "68", smoking: "never_smoked",
  alcoholFrequency: "lt_monthly", alcoholAmount: "1_2_drinks",
  walkingDays: "4", walkingHours: "0", walkingMinutes: "40", strengthDays: "2_days",
  weekdayBed: "23:30", weekdayWake: "07:00", weekendBed: "22:00", weekendWake: "08:00",
};
const draft = (changes: Partial<Draft> = {}): Draft => ({ ...base, ...changes });
const problems = (d: Draft) => INPUT_STEPS.map(s => stepProblem(s, d)).filter(Boolean);

for (const days of ["0", "1", "7"]) {
  test(`S11 zero/time contract: ${days} walking days with explicit zero duration remains valid`, () => {
    const d = draft({ walkingDays: days, walkingHours: "0", walkingMinutes: "0", strengthDays: "0_days" });
    assert.deepEqual(problems(d), []);
    const features = adaptProductInput(buildPayload(d));
    assert.equal(features.walking_minutes_per_active_day, 0);
    assert.equal(features.strength_days_7d, "0_days");
  });
}

for (const key of ["height", "weight"] as const) {
  test(`S11 zero/time contract: nonpositive ${key} is explained in basics`, () => {
    for (const value of ["0", "-1"]) {
      const d = draft({ [key]: value });
      const problem = stepProblem("basics", d);
      assert.equal(problem?.step, "basics");
      assert.ok(problem?.fields.includes(key));
      assert.throws(() => adaptProductInput(buildPayload(d)));
    }
    // Do not turn HTML min=1 into an invented minimum greater than zero.
    assert.equal(stepProblem("basics", draft({ [key]: "0.5" })), null);
  });
}

test("S11 zero/time contract: zero-day contradiction is caught without rewriting the draft", () => {
  for (const changes of [{ walkingHours: "0", walkingMinutes: "1" }, { walkingHours: "1", walkingMinutes: "0" }]) {
    const d = draft({ walkingDays: "0", ...changes });
    const before = { ...d };
    const problem = stepProblem("activity", d);
    assert.equal(problem?.step, "activity");
    assert.ok(problem?.fields.includes("walkingHours"));
    assert.ok(problem?.fields.includes("walkingMinutes"));
    assert.deepEqual(d, before);
    assert.throws(() => adaptProductInput(buildPayload(d)));
  }
});

test("S11 zero/time contract: combined duration 24:01 fails, 24:00 remains valid", () => {
  const valid = draft({ walkingDays: "1", walkingHours: "24", walkingMinutes: "0" });
  assert.equal(stepProblem("activity", valid), null);
  assert.equal(adaptProductInput(buildPayload(valid)).walking_minutes_per_active_day, 1440);
  const invalid = { ...valid, walkingMinutes: "1" };
  assert.equal(stepProblem("activity", invalid)?.step, "activity");
  assert.throws(() => adaptProductInput(buildPayload(invalid)));
});

for (const frequency of ["none_past_year", "lifetime_nonapplicable"]) {
  test(`S11 zero/time contract: ${frequency} plus none and zero strength is accepted`, () => {
    const d = draft({ alcoholFrequency: frequency, alcoholAmount: "none", strengthDays: "0_days" });
    assert.deepEqual(problems(d), []);
    assert.equal(adaptProductInput(buildPayload(d)).alcohol_amount_category, "none");
  });
}

for (const prefix of ["weekday", "weekend"] as const) {
  test(`S11 zero/time contract: ${prefix} midnight limitation is identified early`, () => {
    const bed = `${prefix}Bed` as const, wake = `${prefix}Wake` as const;
    for (const [b, w] of [["00:59", "00:00"], ["01:00", "00:30"], ["12:59", "00:59"]]) {
      const d = draft({ [bed]: b, [wake]: w });
      const before = { ...d };
      const problem = stepProblem("sleep", d);
      assert.equal(problem?.step, "sleep");
      assert.ok(problem?.fields.includes(bed));
      assert.ok(problem?.fields.includes(wake));
      assert.ok(problem?.message.includes("현재 분석"));
      assert.ok(problem?.message.includes("바꾸지 않아도"));
      assert.deepEqual(d, before);
      assert.throws(() => adaptProductInput(buildPayload(d)));
    }
  });
  test(`S11 zero/time contract: ${prefix} adjacent valid and zero-sleep cases stay valid`, () => {
    const bed = `${prefix}Bed` as const, wake = `${prefix}Wake` as const;
    for (const [b, w, expected] of [
      ["00:00", "08:00", 480], ["00:30", "08:30", 480], ["23:30", "00:30", 60],
      ["23:59", "00:00", 1], ["00:59", "00:59", 0], ["08:00", "08:00", 0],
      ["23:00", "23:00", 0], ["08:00", "16:00", 480],
    ] as const) {
      const d = draft({ [bed]: b, [wake]: w });
      assert.equal(stepProblem("sleep", d), null);
      assert.equal(adaptProductInput(buildPayload(d))[`${prefix}_sleep_minutes`], expected);
    }
  });
}

test("S11 zero/time contract: finite zero is not missing, and expired output is not shown", () => {
  assert.equal(finiteNumber("0"), 0);
  assert.equal(finiteNumber(""), null);
  assert.deepEqual(clockParts("00:00"), [0, 0]);
  assert.equal(clockParts("24:00"), null);
  assert.equal(visibleModelV2Output(0, "2026-09-21"), 0);
  assert.equal(visibleModelV2Output(0, "2026-10-18"), null);
  for (const value of [null, NaN, Infinity, -Infinity]) assert.equal(visibleModelV2Output(value, "2026-09-21"), null);
});

test("S11 zero/time contract: walking-component domain agrees with canonical adapter rejection", () => {
  for (let days = 0; days <= 7; days++) for (let hours = 0; hours <= 24; hours++) for (let minutes = 0; minutes < 60; minutes++) {
    const d = draft({ walkingDays: String(days), walkingHours: String(hours), walkingMinutes: String(minutes) });
    let accepted = true;
    try { adaptProductInput(buildPayload(d)); } catch { accepted = false; }
    assert.equal(stepProblem("activity", d) === null, accepted, `walking boundary ${days}/${hours}/${minutes}`);
  }
});

test("S11 zero/time contract: sleep boundary grid agrees without replacing frozen derivation", () => {
  for (const prefix of ["weekday", "weekend"] as const) {
    const bed = `${prefix}Bed` as const, wake = `${prefix}Wake` as const;
    for (let bh = 0; bh < 24; bh++) for (let wh = 0; wh < 24; wh++) for (const bm of [0, 1, 30, 59]) for (const wm of [0, 1, 30, 59]) {
      const b = `${String(bh).padStart(2, "0")}:${String(bm).padStart(2, "0")}`;
      const w = `${String(wh).padStart(2, "0")}:${String(wm).padStart(2, "0")}`;
      const d = draft({ [bed]: b, [wake]: w });
      let accepted = true;
      try { adaptProductInput(buildPayload(d)); } catch { accepted = false; }
      assert.equal(stepProblem("sleep", d) === null, accepted, `${prefix} boundary ${b}/${w}`);
    }
  }
});
