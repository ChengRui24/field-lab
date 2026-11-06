import { describe, expect, it } from "vitest";
import { planRecipe } from "./diyfuel";
import {
  caffeineDose,
  carbDaily,
  creatineDose,
  diyCarbTarget,
  diyRecipeParts,
  duringCarbRow,
  isGelConcentration,
  proteinDose,
  raceCarbMidpoint,
  raceFuelPlan,
  raceMinutesFromParts,
  sweatTest,
} from "./fuel";

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
  it("implausible sweat rate (> 6 L/h) → asks to check the inputs", () => {
    const r = sweatTest({ preKg: 250, postKg: 20, fluidL: 0, urineL: 0, minutes: 10 });
    expect(r.ok).toBe(false);
    expect(sweatTest({ preKg: 58.4, postKg: 57.6, fluidL: 0.3, urineL: 0, minutes: 60 })).toMatchObject({ ok: true });
  });
  it("negative sweat → contradictory data", () => {
    const r = sweatTest({ preKg: 70, postKg: 71, fluidL: 0.5, urineL: 0, minutes: 60 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("数据矛盾");
  });
});

describe("race fuel plan", () => {
  const plan = (minutes: number, extra: { weightKg?: number | null; sweat?: number | null; gel?: number | null } = {}) =>
    raceFuelPlan({
      minutes,
      weightKg: extra.weightKg === undefined ? 70 : extra.weightKg,
      sweatLitersPerHour: extra.sweat ?? null,
      gelGrams: extra.gel,
    });

  it("40 min → no carbohydrate needed", () => {
    const p = plan(40);
    expect(p?.during.band).toBe("none");
    expect(p?.during.highPerHour).toBe(0);
    expect(p?.during.gels).toBeNull();
  });

  it("60 min → small amounts / mouth rinse", () => {
    const p = plan(60);
    expect(p?.during.band).toBe("rinse");
    expect(p?.during.gels).toBeNull();
  });

  it("2 h → 30–60 g/h, 60–120 g, 3–4 × 25 g gels every 25–50 min", () => {
    const p = plan(120);
    expect(p?.during.band).toBe("moderate");
    expect(p?.during.lowPerHour).toBe(30);
    expect(p?.during.highPerHour).toBe(60);
    expect(p?.during.lowTotal).toBeCloseTo(60, 6);
    expect(p?.during.highTotal).toBeCloseTo(120, 6);
    expect(p?.during.gels).toEqual({
      gramsPerGel: 25,
      countLow: 3,
      countHigh: 4,
      intervalShortMin: 25,
      intervalLongMin: 50,
    });
  });

  it("2.5 h is still 30–60 g/h; just above → up to 90 g/h", () => {
    expect(plan(150)?.during.band).toBe("moderate");
    expect(plan(151)?.during.band).toBe("high");
  });

  it("4 h → up to 90 g/h, 240–360 g", () => {
    const p = plan(240);
    expect(p?.during.band).toBe("high");
    expect(p?.during.highPerHour).toBe(90);
    expect(p?.during.highTotal).toBeCloseTo(360, 6);
    // 25 g ÷ 90 g/h = 16.7 min → rounds up to 20 (75 g/h); 15 would be 100 g/h, above the cap
    expect(p?.during.gels?.intervalShortMin).toBe(20);
    expect(p?.during.gels?.intervalLongMin).toBe(25);
  });

  it("rounded gel intervals never leave the g/h band", () => {
    for (const gel of [7, 9.5, 13, 22, 25, 30, 40]) {
      for (const minutes of [90, 150, 240]) {
        const d = plan(minutes, { gel })!.during;
        const g = d.gels!;
        expect(g.intervalShortMin).toBeLessThanOrEqual(g.intervalLongMin);
        expect((gel / g.intervalShortMin) * 60).toBeLessThanOrEqual(d.highPerHour + 1e-9);
        expect((gel / g.intervalLongMin) * 60).toBeGreaterThanOrEqual(d.lowPerHour - 1e-9);
      }
    }
  });

  it("custom gel size changes the count", () => {
    expect(plan(120, { gel: 40 })?.during.gels).toMatchObject({ gramsPerGel: 40, countLow: 2, countHigh: 3 });
  });

  it("blank / invalid gel size falls back to 25 g", () => {
    expect(plan(120, { gel: null })?.during.gels?.gramsPerGel).toBe(25);
    expect(plan(120, { gel: 0 })?.during.gels?.gramsPerGel).toBe(25);
  });

  it("pre-race 70 kg → 70–280 g; carb loading only > 90 min", () => {
    const p = plan(120);
    expect(p?.pre).toEqual({ applies: true, lowG: 70, highG: 280 });
    expect(p?.carbLoading).toEqual({ lowG: 700, highG: 840 });
    expect(p?.carbLoadingApplies).toBe(true);
    expect(plan(90)?.carbLoadingApplies).toBe(false);
    expect(plan(60)?.pre?.applies).toBe(false);
  });

  it("no weight → pre-race grams absent, during-race g/h still given", () => {
    const p = plan(120, { weightKg: null });
    expect(p?.pre).toBeNull();
    expect(p?.carbLoading).toBeNull();
    expect(p?.during.lowPerHour).toBe(30);
    expect(p?.during.highPerHour).toBe(60);
  });

  it("fluid: 70 kg, 1.5 L/h, 3 h → allowable 1.4 kg, 1.03–1.5 L/h", () => {
    const p = plan(180, { sweat: 1.5 });
    if (p?.fluid.status !== "ok") throw new Error("expected fluid plan");
    expect(p.fluid.allowableLossKg).toBeCloseTo(1.4, 6);
    expect(p.fluid.minLitersPerHour).toBeCloseTo(1.0333, 3);
    expect(p.fluid.maxLitersPerHour).toBeCloseTo(1.5, 6);
    expect(p.fluid.maxTotalL).toBeCloseTo(4.5, 6);
  });

  it("fluid minimum never goes below 0", () => {
    const p = plan(60, { sweat: 0.5 });
    if (p?.fluid.status !== "ok") throw new Error("expected fluid plan");
    expect(p.fluid.minLitersPerHour).toBe(0);
  });

  it("no sweat rate → no fluid number", () => {
    expect(plan(180)?.fluid).toEqual({ status: "noSweat" });
  });

  it("sweat rate but no weight → only the upper bound", () => {
    expect(plan(180, { weightKg: null, sweat: 1.2 })?.fluid).toEqual({ status: "noWeight", maxLitersPerHour: 1.2 });
  });

  it("invalid durations → null", () => {
    expect(plan(0)).toBeNull();
    expect(plan(-30)).toBeNull();
    expect(plan(24 * 60 + 1)).toBeNull();
    expect(plan(Number.NaN)).toBeNull();
    expect(plan(24 * 60)).not.toBeNull();
  });
});

describe("race duration from hours + minutes", () => {
  it("3 h 30 min → 210 min; blank part = 0", () => {
    expect(raceMinutesFromParts(3, 30)).toEqual({ status: "valid", minutes: 210 });
    expect(raceMinutesFromParts(2, null)).toEqual({ status: "valid", minutes: 120 });
    expect(raceMinutesFromParts(null, 45)).toEqual({ status: "valid", minutes: 45 });
    expect(raceMinutesFromParts(24, null)).toEqual({ status: "valid", minutes: 1440 });
  });
  it("both blank → empty", () => {
    expect(raceMinutesFromParts(null, null)).toEqual({ status: "empty" });
  });
  it("out of range → invalid", () => {
    expect(raceMinutesFromParts(0, 0).status).toBe("invalid");
    expect(raceMinutesFromParts(25, 0).status).toBe("invalid");
    expect(raceMinutesFromParts(24, 1).status).toBe("invalid");
    expect(raceMinutesFromParts(1, 60).status).toBe("invalid");
    expect(raceMinutesFromParts(-1, 30).status).toBe("invalid");
    expect(raceMinutesFromParts(1, -5).status).toBe("invalid");
  });
});

describe("DIY recipe parts", () => {
  it("glucose + sucrose 1:1 by mass gives equal ingredient grams", () => {
    const parts = diyRecipeParts("glucoseSucrose1to1");
    if (!parts) throw new Error("expected parts");
    const plan = planRecipe({ parts, carbGrams: 100, concentrationPct: 8 });
    if (!plan) throw new Error("expected plan");
    expect(plan.items).toHaveLength(2);
    expect(plan.items[0].grams).toBeCloseTo(plan.items[1].grams, 6);
    expect(plan.items[0].carbGrams + plan.items[1].carbGrams).toBeCloseTo(100, 6);
  });
  it("single ingredient passes the label value through", () => {
    expect(diyRecipeParts("sucrose")).toEqual([{ ingredient: "sucrose" }]);
    expect(diyRecipeParts("hfcs55", 76)).toEqual([{ ingredient: "hfcs55", labelCarbPer100g: 76 }]);
  });
  it("custom without label, or an impossible label → null", () => {
    expect(diyRecipeParts("custom")).toBeNull();
    expect(diyRecipeParts("sucrose", 0)).toBeNull();
    expect(diyRecipeParts("sucrose", 120)).toBeNull();
  });
});

describe("race carbohydrate midpoint", () => {
  it("2 h → (60 + 120) / 2 = 90 g", () => {
    expect(raceCarbMidpoint(raceFuelPlan({ minutes: 120, weightKg: null, sweatLitersPerHour: null }))).toBeCloseTo(90, 6);
  });
  it("no during-race carbohydrate or no plan → null", () => {
    expect(raceCarbMidpoint(raceFuelPlan({ minutes: 60, weightKg: null, sweatLitersPerHour: null }))).toBeNull();
    expect(raceCarbMidpoint(null)).toBeNull();
  });
});

describe("during-exercise carbohydrate row", () => {
  const plan = (minutes: number) => raceFuelPlan({ minutes, weightKg: 58, sweatLitersPerHour: null });
  it("no race duration → follows the session select", () => {
    expect(duringCarbRow("endurance", null)).toMatchObject({ text: "30–60 g/h", fromRace: false });
    expect(duringCarbRow("short", null).text).toBe("不必额外补糖");
  });
  it("4 h race overrides a 1–2.5 h session select → 60–90 g/h", () => {
    expect(duringCarbRow("endurance", plan(240))).toMatchObject({ text: "60–90 g/h", fromRace: true });
  });
  it("short races follow the race bands too", () => {
    expect(duringCarbRow("ultra", plan(40)).text).toBe("不必额外补糖");
    expect(duringCarbRow("ultra", plan(60)).text).toBe("少量 / 含漱");
    expect(duringCarbRow("ultra", plan(120)).text).toBe("30–60 g/h");
  });
});

describe("DIY carbohydrate target", () => {
  const fourHours = raceFuelPlan({ minutes: 240, weightKg: 58, sweatLitersPerHour: null });
  it("gel threshold is strictly above 20%", () => {
    expect(isGelConcentration(8)).toBe(false);
    expect(isGelConcentration(20)).toBe(false);
    expect(isGelConcentration(50)).toBe(true);
  });
  it("50% sucrose, 4 gels, blank grams → 4 × 25 g = 100 g, not the 300 g race midpoint", () => {
    const t = diyCarbTarget({ concentrationPct: 50, totalCarbG: null, servings: 4, perGelCarbG: null, plan: fourHours });
    expect(t).toMatchObject({ mode: "gel", carbGrams: 100, count: 4, perGelCarbG: 25, perGelSource: "race", largerThanCommercial: false });
  });
  it("gel mode ignores a typed total and uses count × grams", () => {
    const t = diyCarbTarget({ concentrationPct: 50, totalCarbG: 300, servings: 3, perGelCarbG: 30, plan: null });
    expect(t).toMatchObject({ mode: "gel", carbGrams: 90, perGelSource: "user", countSource: "user" });
  });
  it("gel per-serving grams follow the race-plan gel size", () => {
    const plan = raceFuelPlan({ minutes: 240, weightKg: null, sweatLitersPerHour: null, gelGrams: 40 });
    const t = diyCarbTarget({ concentrationPct: 50, totalCarbG: null, servings: 2, perGelCarbG: null, plan });
    expect(t).toMatchObject({ carbGrams: 80, perGelCarbG: 40, largerThanCommercial: false });
  });
  it("blank count → race-plan gel count lower bound; no plan → missing count", () => {
    const t = diyCarbTarget({ concentrationPct: 50, totalCarbG: null, servings: null, perGelCarbG: null, plan: fourHours });
    expect(t).toMatchObject({ mode: "gel", count: 10, countSource: "race", carbGrams: 250 });
    expect(diyCarbTarget({ concentrationPct: 50, totalCarbG: null, servings: null, perGelCarbG: null, plan: null })).toMatchObject({
      mode: "gel",
      carbGrams: null,
      missing: "count",
    });
  });
  it("no plan, no gel size → 25 g default", () => {
    const t = diyCarbTarget({ concentrationPct: 60, totalCarbG: null, servings: 2, perGelCarbG: null, plan: null });
    expect(t).toMatchObject({ carbGrams: 50, perGelSource: "default" });
  });
  it("flags servings above 40 g carbohydrate", () => {
    const t = diyCarbTarget({ concentrationPct: 50, totalCarbG: null, servings: 4, perGelCarbG: 75, plan: null });
    expect(t).toMatchObject({ largerThanCommercial: true });
    expect(diyCarbTarget({ concentrationPct: 50, totalCarbG: null, servings: 4, perGelCarbG: 40, plan: null })).toMatchObject({
      largerThanCommercial: false,
    });
  });
  it("drink concentrations keep the race midpoint default", () => {
    const t = diyCarbTarget({ concentrationPct: 8, totalCarbG: null, servings: 4, perGelCarbG: 25, plan: fourHours });
    expect(t).toMatchObject({ mode: "drink", carbGrams: 300, totalSource: "race", servings: 4 });
    expect(diyCarbTarget({ concentrationPct: 6, totalCarbG: 60, servings: null, perGelCarbG: null, plan: fourHours })).toMatchObject({
      carbGrams: 60,
      totalSource: "user",
    });
    expect(diyCarbTarget({ concentrationPct: 6, totalCarbG: null, servings: null, perGelCarbG: null, plan: null })).toMatchObject({
      missing: "total",
    });
  });
  it("non-integer servings → badServings", () => {
    expect(diyCarbTarget({ concentrationPct: 50, totalCarbG: null, servings: 2.5, perGelCarbG: null, plan: null })).toMatchObject({
      missing: "badServings",
    });
    expect(diyCarbTarget({ concentrationPct: 8, totalCarbG: 60, servings: 0, perGelCarbG: null, plan: null })).toMatchObject({
      missing: "badServings",
    });
  });
});
