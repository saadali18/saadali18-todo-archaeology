import { describe, expect, it } from "vitest";
import { computeAgeDays, humanizeAgeLong, humanizeAgeShort, parseDurationToDays } from "../src/age.js";

describe("computeAgeDays", () => {
  it("computes whole days between two dates", () => {
    const from = new Date("2024-01-01T00:00:00Z");
    const now = new Date("2024-01-04T00:00:00Z");
    expect(computeAgeDays(from, now)).toBe(3);
  });

  it("never returns a negative age", () => {
    const from = new Date("2030-01-01T00:00:00Z");
    const now = new Date("2024-01-01T00:00:00Z");
    expect(computeAgeDays(from, now)).toBe(0);
  });
});

describe("humanizeAgeLong", () => {
  const cases: Array<[number, string]> = [
    [0, "0 days"],
    [1, "1 day"],
    [3, "3 days"],
    [45, "1 month"],
    [335, "11 months"],
    [365, "1 year"],
    [365 + 30, "1 year, 1 month"],
    [365 * 6 + 30 * 3, "6 years, 3 months"],
  ];

  it.each(cases)("formats %i days as %s", (days, expected) => {
    expect(humanizeAgeLong(days)).toBe(expected);
  });
});

describe("humanizeAgeShort", () => {
  const cases: Array<[number, string]> = [
    [3, "3d"],
    [335, "11m"],
    [365, "1y"],
    [365 * 6 + 30 * 3, "6y 3m"],
  ];

  it.each(cases)("formats %i days as %s", (days, expected) => {
    expect(humanizeAgeShort(days)).toBe(expected);
  });
});

describe("parseDurationToDays", () => {
  it("parses years", () => {
    expect(parseDurationToDays("2y")).toBeCloseTo(730.5, 0);
  });

  it("parses months", () => {
    expect(parseDurationToDays("18m")).toBeCloseTo(548, 0);
  });

  it("parses days", () => {
    expect(parseDurationToDays("90d")).toBe(90);
  });

  it("throws on an invalid format", () => {
    expect(() => parseDurationToDays("2 weeks")).toThrow();
  });
});
