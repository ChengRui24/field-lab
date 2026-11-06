import { describe, expect, it } from "vitest";
import {
  cooperVo2,
  equivalentRaces,
  mile15Vo2,
  paceAtVdotPercent,
  predictRaceMinutes,
  rockportVo2,
  stepTestVo2,
  vdotFromRace,
  vdotTrainingPaces,
} from "./vo2";

const sec = (mmss: string): number => {
  const [m, s] = mmss.split(":").map(Number);
  return m * 60 + s;
};

describe("field VO₂max tests", () => {
  it("Cooper 12 min", () => {
    expect(cooperVo2(2800)).toBeCloseTo(51.3, 1);
    expect(cooperVo2(2400)).toBeCloseTo(42.4, 1);
  });

  it("1.5 mile run", () => {
    expect(mile15Vo2(10)).toBeCloseTo(51.8, 6);
    expect(mile15Vo2(12)).toBeCloseTo(43.75, 6);
  });

  it("Rockport (Kline 1987)", () => {
    expect(rockportVo2({ weightKg: 70, age: 40, sex: "male", timeMinutes: 14, endingHr: 130 })).toBeCloseTo(45.7, 1);
    expect(
      rockportVo2({ weightKg: 154 / 2.205, age: 40, sex: "female", timeMinutes: 14, endingHr: 130 }),
    ).toBeCloseTo(39.4, 1);
  });

  it("Queen's College step", () => {
    expect(stepTestVo2("male", 150)).toBeCloseTo(48.33, 2);
    expect(stepTestVo2("female", 160)).toBeCloseTo(36.26, 2);
  });
});

describe("VDOT (Daniels & Gilbert)", () => {
  it.each([
    ["5K", 5000, "19:57"],
    ["10K", 10000, "41:21"],
    ["HM", 21097.5, "1:31:35"],
    ["M", 42195, "3:10:49"],
  ])("Daniels table VDOT 50 · %s", (_label, meters, time) => {
    const parts = time.split(":").map(Number);
    const minutes = parts.length === 3 ? parts[0] * 60 + parts[1] + parts[2] / 60 : parts[0] + parts[1] / 60;
    expect(Math.abs(vdotFromRace(meters, minutes) - 50)).toBeLessThanOrEqual(0.1);
  });

  it("predictRaceMinutes inverts vdotFromRace", () => {
    const minutes = predictRaceMinutes(50, 42195);
    expect(vdotFromRace(42195, minutes)).toBeCloseTo(50, 4);
  });

  it("VDOT 50 training paces match Daniels' table (±3 s/km)", () => {
    const p = vdotTrainingPaces(50);
    expect(Math.abs(p.threshold - sec("4:15"))).toBeLessThanOrEqual(3);
    expect(Math.abs(p.interval - sec("3:55"))).toBeLessThanOrEqual(3);
    expect(Math.abs(p.marathon - sec("4:31"))).toBeLessThanOrEqual(3);
    expect(Math.abs(p.easy.fast - sec("4:56"))).toBeLessThanOrEqual(3);
    expect(Math.abs(p.easy.slow - sec("5:34"))).toBeLessThanOrEqual(3);
  });

  // Daniels' Running Formula training-pace table, per km: [E fast, E slow, M, T, I].
  // VDOT 30 M (7:03) is omitted: the book's M there is slower than the equivalent marathon race pace.
  const table: Record<number, [string, string, string | null, string, string]> = {
    30: ["7:27", "8:14", null, "6:24", "5:55"],
    40: ["5:56", "6:38", "5:29", "5:06", "4:42"],
    60: ["4:15", "4:49", "3:52", "3:40", "3:23"],
    70: ["3:44", "4:15", "3:24", "3:14", "2:59"],
  };
  it.each(Object.entries(table))("VDOT %s paces within ±3 s/km", (vdot, row) => {
    const p = vdotTrainingPaces(Number(vdot));
    const got = [p.easy.fast, p.easy.slow, p.marathon, p.threshold, p.interval];
    row.forEach((expected, i) => {
      if (expected === null) return;
      expect(Math.abs(got[i] - sec(expected))).toBeLessThanOrEqual(3);
    });
  });

  // The published table's marathon (3:10:49) sits ~9 s slower than the Daniels–Gilbert equations give (3:10:40).
  it.each([
    [5000, "19:57", 5],
    [10000, "41:21", 5],
    [21097.5, "1:31:35", 5],
    [42195, "3:10:49", 10],
  ])("equivalentRaces(50) · %s m ≈ %s (±%s s)", (meters, time, tolerance) => {
    const parts = time.split(":").map(Number);
    const expectedSec = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
    const race = equivalentRaces(50).find((r) => r.meters === meters);
    expect(race).toBeDefined();
    expect(Math.abs(race!.minutes * 60 - expectedSec)).toBeLessThanOrEqual(tolerance);
  });

  it("equivalentRaces round-trips to the same VDOT", () => {
    const vdot = vdotFromRace(10000, 41 + 21 / 60);
    for (const race of equivalentRaces(vdot)) {
      expect(Math.abs(vdotFromRace(race.meters, race.minutes) - vdot)).toBeLessThanOrEqual(0.1);
      expect(race.pace).toBeCloseTo((race.minutes * 60 * 1000) / race.meters, 6);
    }
  });

  it("equivalentRaces: longer distance → longer time and slower pace", () => {
    for (const vdot of [30, 50, 70]) {
      const races = equivalentRaces(vdot);
      for (let i = 1; i < races.length; i += 1) {
        expect(races[i].meters).toBeGreaterThan(races[i - 1].meters);
        expect(races[i].minutes).toBeGreaterThan(races[i - 1].minutes);
        expect(races[i].pace).toBeGreaterThan(races[i - 1].pace);
      }
    }
  });

  it("regression: paces are sec/km, never minutes", () => {
    for (const vdot of [30, 50, 85]) {
      const p = vdotTrainingPaces(vdot);
      for (const value of [p.easy.fast, p.easy.slow, p.marathon, p.threshold, p.interval]) {
        expect(value).toBeGreaterThan(120);
      }
      expect(paceAtVdotPercent(vdot, 0.88)).toBeGreaterThan(120);
    }
  });
});
