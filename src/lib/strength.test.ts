import { describe, expect, it } from "vitest";
import {
  brzycki1rm,
  brzyckiWeight,
  epley1rm,
  epleyWeight,
  estimate1rm,
  planWeight,
  RIR_SCALE,
  roundToPlate,
  STRENGTH_LOADS,
} from "./strength";

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

describe("planned set weight (inverse Epley / Brzycki)", () => {
  it("1RM 121.7, 5 reps RIR 2 → reps to failure 7 → ≈ 100 kg", () => {
    // Epley: 121.7 / (1 + 7/30) = 98.68; Brzycki: 121.7 × 30 / 36 = 101.42; mean = 100.05
    const plan = planWeight(121.7, 5, 2);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.repsToFailure).toBe(7);
    expect(plan.epley).toBeCloseTo(98.68, 2);
    expect(plan.brzycki).toBeCloseTo(101.42, 2);
    expect(plan.value).toBeCloseTo(100.05, 2);
    expect(plan.rounded).toBe(100);
  });

  it("inverts the forward equations", () => {
    expect(epleyWeight(epley1rm(80, 8), 8)).toBeCloseTo(80, 9);
    expect(brzyckiWeight(brzycki1rm(80, 8), 8)).toBeCloseTo(80, 9);
  });

  it("round trip: 100 kg × 5 RIR 2 → 1RM → plan 5 RIR 2 = 100 kg", () => {
    const est = estimate1rm({ weight: 100, reps: 5, rir: 2 });
    expect(est.ok).toBe(true);
    if (!est.ok) return;
    const plan = planWeight(est.value, 5, 2);
    expect(plan.ok && plan.rounded).toBe(100);
  });

  it("rejects out-of-range plans", () => {
    expect(planWeight(100, 0, 2).ok).toBe(false);
    expect(planWeight(100, 5, 5).ok).toBe(false);
  });

  it("rounds to the nearest 2.5 kg", () => {
    expect(roundToPlate(98.7)).toBe(97.5);
    expect(roundToPlate(98.76)).toBe(100);
    expect(roundToPlate(121.7)).toBe(122.5);
  });
});
