import { describe, expect, it } from "vitest";
import {
  defaultHrFormula,
  foxHrMax,
  KARVONEN_ZONES,
  gulatiHrMax,
  gulatiRangeNote,
  hrrToHrMaxFraction,
  karvonen,
  LT_COEFFICIENTS,
  REFERENCE_REST_RATIO,
  restingHrProblem,
  selectedHrMax,
  tanakaHrMax,
} from "./hr";

describe("HRmax formulas", () => {
  it("Tanaka 2001", () => {
    expect(tanakaHrMax(40)).toBeCloseTo(180, 6);
    expect(tanakaHrMax(20)).toBeCloseTo(194, 6);
    expect(tanakaHrMax(60)).toBeCloseTo(166, 6);
  });

  it("Gulati 2010", () => {
    expect(gulatiHrMax(40)).toBeCloseTo(170.8, 6);
    expect(gulatiHrMax(60)).toBeCloseTo(153.2, 6);
  });

  it("Fox", () => {
    expect(foxHrMax(40)).toBe(180);
  });

  it("selects measured, then Gulati for women ≥35, else Tanaka", () => {
    expect(selectedHrMax({ age: 40, sex: "male", measured: 190 })).toEqual({ value: 190, method: "measured" });
    expect(selectedHrMax({ age: 40, sex: "female", measured: null })?.value).toBeCloseTo(170.8, 6);
    expect(selectedHrMax({ age: 40, sex: null, measured: null })?.value).toBeCloseTo(180, 6);
    expect(selectedHrMax({ age: null, sex: null, measured: null })).toBeNull();
  });

  it("a 32-year-old woman defaults to Tanaka (Gulati cohort was women 35–93)", () => {
    expect(defaultHrFormula("female", 32)).toBe("tanaka");
    expect(defaultHrFormula("female", 35)).toBe("gulati");
    expect(defaultHrFormula("male", 50)).toBe("tanaka");
    expect(defaultHrFormula(null, 50)).toBe("tanaka");
    expect(defaultHrFormula("female", null)).toBe("tanaka");
    const chosen = selectedHrMax({ age: 32, sex: "female", measured: null });
    expect(chosen?.method).toBe("tanaka");
    expect(chosen?.value).toBeCloseTo(185.6, 6);
  });

  it("an explicit formula overrides the default, but measured still wins", () => {
    expect(selectedHrMax({ age: 32, sex: "female", measured: null, formula: "gulati" })?.method).toBe("gulati");
    expect(selectedHrMax({ age: 40, sex: "female", measured: null, formula: "tanaka" })?.method).toBe("tanaka");
    expect(selectedHrMax({ age: 40, sex: "male", measured: 188, formula: "gulati" })?.method).toBe("measured");
  });
});

describe("zone text", () => {
  it("does not claim LT1/LT2 boundaries (LT bands are estimated separately)", () => {
    for (const zone of KARVONEN_ZONES) expect(zone.physiology).not.toMatch(/LT/);
  });
});

describe("Karvonen", () => {
  it("HRmax 180, RHR 60", () => {
    expect(karvonen(60, 120, 0.7)).toBeCloseTo(144, 6);
    expect(karvonen(60, 120, 0.5)).toBeCloseTo(120, 6);
  });

  it("flags RHR >= HRmax", () => {
    expect(restingHrProblem(180, 180)).not.toBeNull();
    expect(restingHrProblem(180, 190)).not.toBeNull();
    expect(restingHrProblem(180, 60)).toBeNull();
  });
});

describe("LT coefficients are internally consistent", () => {
  for (const group of ["untrained", "trained"] as const) {
    const c = LT_COEFFICIENTS[group];
    it(`${group}: %HRmax bands equal the %HRR bands at the reference RHR ratio`, () => {
      const ratio = REFERENCE_REST_RATIO[group];
      for (const lt of ["lt1", "lt2"] as const) {
        const hrr = c[`${lt}Karvonen`];
        const hrMax = c[`${lt}HrMax`];
        expect(Math.abs(hrMax.low - hrrToHrMaxFraction(hrr.low, ratio))).toBeLessThanOrEqual(0.0051);
        expect(Math.abs(hrMax.high - hrrToHrMaxFraction(hrr.high, ratio))).toBeLessThanOrEqual(0.0051);
      }
    });
    it(`${group}: LT1 below LT2 in both representations`, () => {
      expect(c.lt1Karvonen.high).toBeLessThan(c.lt2Karvonen.low);
      expect(c.lt1HrMax.high).toBeLessThan(c.lt2HrMax.low);
    });
  }
});

describe("Gulati range note", () => {
  it("only for women under 35", () => {
    expect(gulatiRangeNote("female", 30)).not.toBeNull();
    expect(gulatiRangeNote("female", 35)).toBeNull();
    expect(gulatiRangeNote("male", 30)).toBeNull();
    expect(gulatiRangeNote("female", null)).toBeNull();
  });
});
