import { describe, expect, it } from "vitest";

import { formatTime, formatTimeVerbose } from "./formatTime";

describe("formatTime", () => {
  it("formats seconds as m:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(600)).toBe("10:00");
  });

  it("floors fractional seconds", () => {
    expect(formatTime(5.9)).toBe("0:05");
  });

  it("treats negative/invalid input as 0:00", () => {
    expect(formatTime(-5)).toBe("0:00");
    expect(formatTime(NaN)).toBe("0:00");
    expect(formatTime(Infinity)).toBe("0:00");
  });
});

describe("formatTimeVerbose", () => {
  it("omits minutes when zero", () => {
    expect(formatTimeVerbose(5)).toBe("5 seconds");
    expect(formatTimeVerbose(1)).toBe("1 second");
  });

  it("includes both units with correct pluralisation", () => {
    expect(formatTimeVerbose(65)).toBe("1 minute 5 seconds");
    expect(formatTimeVerbose(125)).toBe("2 minutes 5 seconds");
    expect(formatTimeVerbose(120)).toBe("2 minutes 0 seconds");
  });

  it("treats negative/invalid input as 0 seconds", () => {
    expect(formatTimeVerbose(-5)).toBe("0 seconds");
    expect(formatTimeVerbose(NaN)).toBe("0 seconds");
  });
});
