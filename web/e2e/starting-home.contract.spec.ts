import { expect, test } from "@playwright/test";
import { isDefaultHomeEntry, normalizeStartingHomePreference, readStartingHomePreference,
  writeStartingHomePreference, resolveStartingHomeDestination, startingHomeStorageKey } from "../src/ui/startingHomePreference";

test("starting home accepts only a bounded preference and fails closed without storage repair", () => {
  for (const value of [null, undefined, "", "My Space", "https://evil.invalid", "{}", "classic-today"]) {
    expect(normalizeStartingHomePreference(value)).toBe("classic-today");
  }
  expect(normalizeStartingHomePreference("my-space")).toBe("my-space");
  expect(readStartingHomePreference(null)).toBe("classic-today");
  expect(readStartingHomePreference({ getItem() { throw new Error("blocked"); } })).toBe("classic-today");
  expect(writeStartingHomePreference("my-space", null)).toBe("classic-today");
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  expect(writeStartingHomePreference("my-space", storage)).toBe("my-space");
  expect([...values]).toEqual([[startingHomeStorageKey, "my-space"]]);
  expect(writeStartingHomePreference("classic-today", { ...storage, setItem() { throw new Error("blocked"); } })).toBe("my-space");
  expect(writeStartingHomePreference("https://evil.invalid", storage)).toBe("classic-today");
});

test("starting home policy only admits signed-in bare root and never explicit or auth context", () => {
  const base = { signedIn: true, evidenceMode: false, preference: "my-space" };
  expect(resolveStartingHomeDestination({ ...base, defaultEntry: isDefaultHomeEntry("https://example.invalid/") })).toBe("?experience=e2&view=3d&storage=account");
  for (const suffix of ["?screen=S02", "?screen=S10", "?screen=S14", "?screen=bad", "?guest=1", "?fixture=VP-10", "?e2e=signed-in", "?record=x", "?dashboard_window=prior", "?return_space=3d-account", "?experience=e2&view=3d&storage=account", "auth/confirm?token_hash=fake&type=email", "#access_token=fake&type=recovery", "?code=fake", "?unknown=value"]) {
    expect(resolveStartingHomeDestination({ ...base, defaultEntry: isDefaultHomeEntry(`https://example.invalid/${suffix}`) })).toBeNull();
  }
  expect(isDefaultHomeEntry("invalid")).toBe(false);
  for (const override of [{ signedIn: false }, { evidenceMode: true }, { preference: "classic-today" }, { preference: "unknown" }]) {
    expect(resolveStartingHomeDestination({ ...base, defaultEntry: true, ...override })).toBeNull();
  }
});
