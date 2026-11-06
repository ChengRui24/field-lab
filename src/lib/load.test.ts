import { describe, expect, it } from "vitest";
import { isHighMonotony, readDay, sessionLoad, weekSummary } from "./load";

describe("session-RPE load", () => {
  it("RPE 7 × 60 min = 420 AU", () => {
    expect(sessionLoad(7, 60)).toBe(420);
  });
});

describe("weekly monotony and strain", () => {
  it("[420, 0, 300, 0, 480, 240, 0]", () => {
    // sum = 1440; mean = 1440 / 7 = 205.714
    // Σx² = 420² + 300² + 480² + 240² = 554400; Σ(x − mean)² = 554400 − 1440² / 7 = 258171.43
    // population SD = √(258171.43 / 7) = √36881.63 = 192.046
    // monotony = 205.714 / 192.046 = 1.0712; strain = 1440 × 1.0712 = 1542.5
    const week = weekSummary([420, 0, 300, 0, 480, 240, 0]);
    expect(week.total).toBe(1440);
    expect(week.mean).toBeCloseTo(205.714, 3);
    expect(week.sd).toBeCloseTo(192.046, 3);
    expect(week.monotony).toBeCloseTo(1.0712, 4);
    expect(week.strain).toBeCloseTo(1542.49, 2);
    expect(isHighMonotony(week.monotony)).toBe(false);
  });

  it("identical non-zero load every day has no monotony", () => {
    const week = weekSummary([300, 300, 300, 300, 300, 300, 300]);
    expect(week.total).toBe(2100);
    expect(week.sd).toBe(0);
    expect(week.monotony).toBeNull();
    expect(week.strain).toBeNull();
  });

  it("all-rest week has no monotony", () => {
    const week = weekSummary([0, 0, 0, 0, 0, 0, 0]);
    expect(week.total).toBe(0);
    expect(week.monotony).toBeNull();
  });
});

describe("high-monotony flag (> 2.0)", () => {
  it("is strict at 2.0", () => {
    expect(isHighMonotony(2)).toBe(false);
    expect(isHighMonotony(2.0001)).toBe(true);
    expect(isHighMonotony(null)).toBe(false);
  });

  it("six equal days + one rest: monotony = √6 = 2.449, flagged", () => {
    // mean = 1800 / 7 = 257.14; SD = 300 × √(6/7 × 1/7) = 104.98; monotony = √(6/1)
    const week = weekSummary([300, 300, 300, 300, 300, 300, 0]);
    expect(week.monotony).toBeCloseTo(Math.sqrt(6), 6);
    expect(isHighMonotony(week.monotony)).toBe(true);
  });

  it("five equal days + two rest: monotony = √(5/2) = 1.58, not flagged", () => {
    const week = weekSummary([300, 300, 300, 300, 300, 0, 0]);
    expect(week.monotony).toBeCloseTo(Math.sqrt(2.5), 6);
    expect(isHighMonotony(week.monotony)).toBe(false);
  });
});

describe("day validation", () => {
  it("blank pair is a rest day", () => {
    expect(readDay(1, null, null)).toEqual({ status: "empty" });
  });

  it("half-filled rows name what is missing", () => {
    expect(readDay(3, 6, null)).toMatchObject({ status: "error", message: "第 3 天还差分钟" });
    expect(readDay(4, null, 45)).toMatchObject({ status: "error", message: "第 4 天还差 RPE" });
  });

  it("out-of-range values are rejected", () => {
    expect(readDay(1, 11, 60)).toMatchObject({ status: "error", rpeInvalid: true });
    expect(readDay(1, -1, 60)).toMatchObject({ status: "error", rpeInvalid: true });
    expect(readDay(1, 5, 0)).toMatchObject({ status: "error", minutesInvalid: true });
    expect(readDay(1, 5, 601)).toMatchObject({ status: "error", minutesInvalid: true });
    expect(readDay(1, 5, 600)).toMatchObject({ status: "ok", load: 3000 });
  });
});
