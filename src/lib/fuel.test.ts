import { describe, expect, it } from "vitest";
import { caffeineDose, carbDaily, creatineDose, proteinDose, sweatTest } from "./fuel";

describe("doses for 70 kg", () => {
  it("caffeine 210–420 mg", () => {
    expect(caffeineDose(70)).toEqual({ low: 210, high: 420 });
  });
  it("protein endurance 84–112 g, hypertrophy 112–154 g", () => {
    const p = proteinDose(70);
    expect(p.endurance.low).toBeCloseTo(84, 6);
    expect(p.endurance.high).toBeCloseTo(112, 6);
    expect(p.hypertrophy.low).toBeCloseTo(112, 6);
    expect(p.hypertrophy.high).toBeCloseTo(154, 6);
  });
  it("creatine loading 21 g/d", () => {
    expect(creatineDose(70).loading).toBeCloseTo(21, 6);
  });
  it("moderate-day carbs 350–490 g", () => {
    const d = carbDaily(70, "moderate");
    expect(d.low).toBeCloseTo(350, 6);
    expect(d.high).toBeCloseTo(490, 6);
  });
});

describe("sweat test", () => {
  it("70.0 → 69.0 kg, 0.5 L, 60 min → 1.50 L/h, 1.43%", () => {
    const r = sweatTest({ preKg: 70, postKg: 69, fluidL: 0.5, urineL: 0, minutes: 60 });
    if (!r.ok) throw new Error(r.reason);
    expect(r.litersPerHour).toBeCloseTo(1.5, 6);
    expect(r.bodyMassChangePct).toBeCloseTo(1.43, 2);
  });
  it("65.0 → 63.8 kg, 1.0 L, 0.2 L urine, 90 min → 1.33 L/h, 1.85%", () => {
    const r = sweatTest({ preKg: 65, postKg: 63.8, fluidL: 1, urineL: 0.2, minutes: 90 });
    if (!r.ok) throw new Error(r.reason);
    expect(r.litersPerHour).toBeCloseTo(1.33, 2);
    expect(r.bodyMassChangePct).toBeCloseTo(1.85, 2);
  });
  it("pre = 0 does not divide by zero", () => {
    expect(sweatTest({ preKg: 0, postKg: 69, fluidL: 0, urineL: 0, minutes: 60 }).ok).toBe(false);
    expect(sweatTest({ preKg: 70, postKg: 0, fluidL: 0, urineL: 0, minutes: 60 }).ok).toBe(false);
  });
  it("negative sweat → contradictory data", () => {
    const r = sweatTest({ preKg: 70, postKg: 71, fluidL: 0.5, urineL: 0, minutes: 60 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("数据矛盾");
  });
});
