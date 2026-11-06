import { describe, expect, it } from "vitest";
import { brzycki1rm, epley1rm, estimate1rm, RIR_SCALE, STRENGTH_LOADS } from "./strength";

describe("1RM formulas", () => {
  it("100 kg × 5", () => {
    expect(epley1rm(100, 5)).toBeCloseTo(116.67, 2);
    expect(brzycki1rm(100, 5)).toBeCloseTo(112.5, 2);
  });
  it("100 kg × 10: both 133.33", () => {
    expect(epley1rm(100, 10)).toBeCloseTo(133.33, 2);
    expect(brzycki1rm(100, 10)).toBeCloseTo(133.33, 2);
  });
  it("80 kg × 3", () => {
    expect(epley1rm(80, 3)).toBeCloseTo(88.0, 2);
    expect(brzycki1rm(80, 3)).toBeCloseTo(84.71, 2);
  });
  it("Brzycki never returns Infinity or negative", () => {
    expect(Number.isNaN(brzycki1rm(100, 37))).toBe(true);
    expect(Number.isNaN(brzycki1rm(100, 40))).toBe(true);
  });
});

describe("estimate1rm with RIR", () => {
  it("ignoring RIR at 5 reps underestimates ~3% (1 RIR) and ~6–7% (2 RIR), as the page states", () => {
    const under = (f: (w: number, r: number) => number, rir: number) => 1 - f(100, 5) / f(100, 5 + rir);
    expect(under(epley1rm, 1)).toBeCloseTo(0.028, 2);
    expect(under(brzycki1rm, 1)).toBeCloseTo(0.031, 2);
    expect(under(epley1rm, 2)).toBeCloseTo(0.054, 2);
    expect(under(brzycki1rm, 2)).toBeCloseTo(0.063, 2);
  });
  it("100 kg × 5 @ 2 RIR → effective 7 reps, Epley 123.33", () => {
    const r = estimate1rm({ weight: 100, reps: 5, rir: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.effectiveReps).toBe(7);
    expect(r.epley).toBeCloseTo(123.33, 2);
  });
  it("RIR 0 matches plain formulas", () => {
    const r = estimate1rm({ weight: 100, reps: 5, rir: 0 });
    if (!r.ok) throw new Error(r.reason);
    expect(r.epley).toBeCloseTo(116.67, 2);
    expect(r.brzycki).toBeCloseTo(112.5, 2);
  });
  it("1 rep at 0 RIR is a measured 1RM", () => {
    const r = estimate1rm({ weight: 120, reps: 1, rir: 0 });
    if (!r.ok) throw new Error(r.reason);
    expect(r.value).toBe(120);
  });
  it("rejects non-integer or out-of-range reps / RIR", () => {
    expect(estimate1rm({ weight: 100, reps: 13, rir: 0 }).ok).toBe(false);
    expect(estimate1rm({ weight: 100, reps: 0, rir: 0 }).ok).toBe(false);
    expect(estimate1rm({ weight: 100, reps: 5.5, rir: 0 }).ok).toBe(false);
    expect(estimate1rm({ weight: 100, reps: 5, rir: 5 }).ok).toBe(false);
    expect(estimate1rm({ weight: 100, reps: 5, rir: -1 }).ok).toBe(false);
    expect(estimate1rm({ weight: 0, reps: 5, rir: 0 }).ok).toBe(false);
  });
});

describe("tables", () => {
  it("RPE 9.5 = 0 RIR; 8.5 and 7.5 present", () => {
    expect(RIR_SCALE.find((r) => r.rpe === "9.5")?.rir).toBe("0");
    expect(RIR_SCALE.find((r) => r.rpe === "8.5")?.rir).toBe("1–2");
    expect(RIR_SCALE.find((r) => r.rpe === "7.5")?.rir).toBe("2–3");
  });
  it("hypertrophy has no narrow %1RM band", () => {
    const h = STRENGTH_LOADS.find((r) => r.id === "hypertrophy")!;
    expect(h.low).toBeNull();
    expect(h.loadNote).toContain("30–100%");
  });
});
