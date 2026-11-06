import { describe, expect, it } from "vitest";
import {
  ift3015Vo2,
  iftIntervalDistance,
  legerStageSpeed,
  legerVo2,
  yoyoVo2,
} from "./fieldtests";

describe("Yo-Yo IR (Bangsbo 2008)", () => {
  it("IR1: distance × 0.0084 + 36.4", () => {
    expect(yoyoVo2("ir1", 2000)).toBeCloseTo(53.2, 6);
    expect(yoyoVo2("ir1", 1000)).toBeCloseTo(44.8, 6);
    expect(yoyoVo2("ir1", 1840)).toBeCloseTo(51.856, 6);
  });

  it("IR2: distance × 0.0136 + 45.3", () => {
    // 1000 × 0.0136 + 45.3 = 58.9
    expect(yoyoVo2("ir2", 1000)).toBeCloseTo(58.9, 6);
  });

  it("rejects out-of-range distance", () => {
    expect(yoyoVo2("ir1", 0)).toBeNull();
    expect(yoyoVo2("ir1", -40)).toBeNull();
    expect(yoyoVo2("ir1", 10000)).toBeNull();
    expect(yoyoVo2("ir1", Number.NaN)).toBeNull();
  });
});

describe("20 m shuttle run (Léger 1988)", () => {
  it("maps stage to speed: 8 + 0.5 × stage", () => {
    expect(legerStageSpeed(1)).toBe(8.5);
    expect(legerStageSpeed(10)).toBe(13);
    expect(legerStageSpeed(21)).toBe(18.5);
  });

  it("adult uses age fixed at 18", () => {
    // Stage 10 → 13 km/h. 31.025 + 3.238·13 − 3.248·18 + 0.1536·18·13
    // = 31.025 + 42.094 − 58.464 + 35.9424 = 50.5974 (rounded form −27.4 + 6.0·13 = 50.6)
    expect(legerVo2(10, 30)).toBeCloseTo(50.5974, 4);
    expect(legerVo2(10, 45)).toBeCloseTo(50.5974, 4);
    expect(legerVo2(10, 18)).toBeCloseTo(50.5974, 4);
  });

  it("child equation", () => {
    // Age 12, stage 6 → 11 km/h. 31.025 + 3.238·11 − 3.248·12 + 0.1536·12·11
    // = 31.025 + 35.618 − 38.976 + 20.2752 = 47.9422
    expect(legerVo2(6, 12)).toBeCloseTo(47.9422, 4);
  });

  it("rejects invalid stage or age", () => {
    expect(legerStageSpeed(0)).toBeNull();
    expect(legerStageSpeed(9.5)).toBeNull();
    expect(legerStageSpeed(22)).toBeNull();
    expect(legerVo2(10, 4)).toBeNull();
    expect(legerVo2(10, Number.NaN)).toBeNull();
  });
});

describe("30-15 IFT (Buchheit)", () => {
  it("VO₂max equation", () => {
    // Male (G = 1), 25 y, 75 kg, VIFT 19:
    // 28.3 − 2.15 − 0.741·25 − 0.0357·75 + 0.0586·25·19 + 1.03·19
    // = 28.3 − 2.15 − 18.525 − 2.6775 + 27.835 + 19.57 = 52.3525
    expect(ift3015Vo2({ viftKmh: 19, age: 25, sex: "male", weightKg: 75 })).toBeCloseTo(52.3525, 4);
    // Female (G = 2) is 2.15 lower.
    expect(ift3015Vo2({ viftKmh: 19, age: 25, sex: "female", weightKg: 75 })).toBeCloseTo(50.2025, 4);
  });

  it("depends on the player's own age, sex and weight", () => {
    // Last line: B's VIFT 20.5 with C's profile (15 y, female, 52 kg) is 50.2, not B's 55.6.
    expect(ift3015Vo2({ viftKmh: 19.5, age: 16, sex: "male", weightKg: 62 })).toBeCloseTo(50.4488, 4);
    expect(ift3015Vo2({ viftKmh: 20.5, age: 24, sex: "male", weightKg: 75 })).toBeCloseTo(55.6347, 4);
    expect(ift3015Vo2({ viftKmh: 17, age: 15, sex: "female", weightKg: 52 })).toBeCloseTo(43.4816, 4);
    expect(ift3015Vo2({ viftKmh: 20.5, age: 15, sex: "female", weightKg: 52 })).toBeCloseTo(50.1631, 4);
  });

  it("rejects invalid inputs", () => {
    expect(ift3015Vo2({ viftKmh: 5, age: 25, sex: "male", weightKg: 75 })).toBeNull();
    expect(ift3015Vo2({ viftKmh: 19, age: 5, sex: "male", weightKg: 75 })).toBeNull();
    expect(ift3015Vo2({ viftKmh: 19, age: 25, sex: "male", weightKg: 10 })).toBeNull();
  });

  it("interval distance: straight line", () => {
    // 19 / 3.6 × 0.95 × 15 = 75.208 m
    const d = iftIntervalDistance(19, 0.95, 15);
    expect(d?.meters).toBeCloseTo(75.21, 2);
    expect(d?.turns).toBe(0);
  });

  it("interval distance: 40 m shuttle subtracts 0.7 s per turn (Buchheit 2008 example 71.7 m)", () => {
    // (19 / 3.6 × 0.95) × (15 − 0.7) = 71.70 m, one turn
    const d = iftIntervalDistance(19, 0.95, 15, 40);
    expect(d?.meters).toBeCloseTo(71.7, 1);
    expect(d?.turns).toBe(1);
  });

  it("interval distance: no turn when the rep stays within one length", () => {
    // 10 / 3.6 × 0.9 × 15 = 37.5 m < 40 m
    expect(iftIntervalDistance(10, 0.9, 15, 40)?.turns).toBe(0);
  });

  it("interval distance rejects invalid inputs", () => {
    expect(iftIntervalDistance(0, 0.95, 15)).toBeNull();
    expect(iftIntervalDistance(19, 0, 15)).toBeNull();
    expect(iftIntervalDistance(19, 0.95, 0)).toBeNull();
    expect(iftIntervalDistance(19, 0.95, 15, 0)).toBeNull();
  });
});
