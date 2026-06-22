import { describe, it, expect } from "vitest";
import {
  computeDayNumber,
  truncateName,
  getNamecardMilestone,
  NAMECARD_SEASONED_DAY_THRESHOLD,
  NAMECARD_LEGENDARY_DAY_THRESHOLD,
  NAMECARD_ANCIENT_DAY_THRESHOLD,
} from "../namecardUtils";

describe("computeDayNumber", () => {
  const ONE_DAY_MS = 86_400_000;

  it("returns 1 for a pet hatched less than 24 hours ago", () => {
    const now = Date.now();
    const hatchedAt = new Date(now - 12 * 60 * 60 * 1000).toISOString();
    expect(computeDayNumber(hatchedAt, now)).toBe(1);
  });

  it("returns 2 after exactly 24 hours", () => {
    const now = Date.now();
    const hatchedAt = new Date(now - ONE_DAY_MS).toISOString();
    expect(computeDayNumber(hatchedAt, now)).toBe(2);
  });

  it("returns correct day number for multi-day pets", () => {
    const now = Date.now();
    const hatchedAt = new Date(now - 5 * ONE_DAY_MS - 3600000).toISOString();
    expect(computeDayNumber(hatchedAt, now)).toBe(6);
  });

  it("returns 1 if hatchedAt is null or undefined", () => {
    expect(computeDayNumber(null as unknown as string)).toBe(1);
    expect(computeDayNumber(undefined as unknown as string)).toBe(1);
    expect(computeDayNumber("")).toBe(1);
  });

  it("returns 1 if hatchedAt is in the future (clock skew)", () => {
    const now = Date.now();
    const future = new Date(now + ONE_DAY_MS).toISOString();
    expect(computeDayNumber(future, now)).toBe(1);
  });

  it("returns 1 if hatchedAt is an invalid date string", () => {
    expect(computeDayNumber("not-a-date")).toBe(1);
  });

  it("returns 1 for a pet just hatched (now === hatchedAt)", () => {
    const now = Date.now();
    const hatchedAt = new Date(now).toISOString();
    expect(computeDayNumber(hatchedAt, now)).toBe(1);
  });
});

describe("truncateName", () => {
  it("returns the original string if 16 chars or fewer", () => {
    expect(truncateName("Bobo")).toBe("Bobo");
    expect(truncateName("1234567890123456")).toBe("1234567890123456");
  });

  it("truncates with ellipsis if name exceeds 16 chars", () => {
    const long = "12345678901234567";
    expect(truncateName(long)).toBe("1234567890123456\u2026");
    expect(truncateName(long).length).toBe(17);
  });

  it("respects custom maxLength", () => {
    expect(truncateName("Hello World", 5)).toBe("Hello\u2026");
  });

  it("handles empty string", () => {
    expect(truncateName("")).toBe("");
  });
});

describe("getNamecardMilestone", () => {
  it('returns "default" tier for Day 1', () => {
    const result = getNamecardMilestone(1);
    expect(result.tier).toBe("default");
    expect(result.className).toBe("overlay-namecard--default");
    expect(result.adornment).toBeUndefined();
  });

  it('returns "default" tier for Day 89', () => {
    const result = getNamecardMilestone(89);
    expect(result.tier).toBe("default");
  });

  it('returns "seasoned" tier at threshold (Day 90)', () => {
    const result = getNamecardMilestone(NAMECARD_SEASONED_DAY_THRESHOLD);
    expect(result.tier).toBe("seasoned");
    expect(result.className).toBe("overlay-namecard--seasoned");
    expect(result.adornment).toBe("\u2726");
  });

  it('returns "seasoned" tier for Day 179', () => {
    const result = getNamecardMilestone(179);
    expect(result.tier).toBe("seasoned");
  });

  it('returns "legendary" tier at threshold (Day 180)', () => {
    const result = getNamecardMilestone(NAMECARD_LEGENDARY_DAY_THRESHOLD);
    expect(result.tier).toBe("legendary");
    expect(result.className).toBe("overlay-namecard--legendary");
    expect(result.adornment).toBe("\u2726");
  });

  it('returns "legendary" tier for Day 364', () => {
    const result = getNamecardMilestone(364);
    expect(result.tier).toBe("legendary");
  });

  it('returns "ancient" tier at threshold (Day 365)', () => {
    const result = getNamecardMilestone(NAMECARD_ANCIENT_DAY_THRESHOLD);
    expect(result.tier).toBe("ancient");
    expect(result.className).toBe("overlay-namecard--ancient");
    expect(result.adornment).toBe("\u2739");
  });

  it('returns "ancient" tier for Day 1000', () => {
    const result = getNamecardMilestone(1000);
    expect(result.tier).toBe("ancient");
  });

  it("threshold constants have expected values", () => {
    expect(NAMECARD_SEASONED_DAY_THRESHOLD).toBe(90);
    expect(NAMECARD_LEGENDARY_DAY_THRESHOLD).toBe(180);
    expect(NAMECARD_ANCIENT_DAY_THRESHOLD).toBe(365);
  });
});
