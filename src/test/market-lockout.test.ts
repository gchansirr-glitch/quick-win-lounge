import { describe, expect, it } from "vitest";

import { isMarketLocked, lockoutSecondsFor } from "@/lib/market";

describe("market betting lockout windows", () => {
  it.each([
    [30, 5],
    [60, 10],
    [180, 15],
    [300, 15],
  ])("locks the %i-second market for its final %i seconds", (duration, lockout) => {
    expect(lockoutSecondsFor(duration)).toBe(lockout);
    expect(isMarketLocked(duration, lockout + 1)).toBe(false);
    expect(isMarketLocked(duration, lockout)).toBe(true);
    expect(isMarketLocked(duration, 1)).toBe(true);
    expect(isMarketLocked(duration, duration)).toBe(false);
  });
});
