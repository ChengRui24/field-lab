import { describe, expect, it } from "vitest";
import {
  chairStandReading,
  gaitSpeedMPerSec,
  gaitSpeedReading,
  gripReading,
  sixMinuteWalkReading,
  sppbBalanceScore,
  sppbBand,
  sppbChairScore,
  sppbGaitScore,
  sppbResult,
  sppbTandemScore,
} from "./function";

describe("6MWT Enright 1998", () => {
  it("male 175 cm, 60 y, 75 kg → 582.55 m, LLN 429.55 m", () => {
    const r = sixMinuteWalkReading({ distanceM: 500, sex: "male", heightCm: 175, age: 60, weightKg: 75 });
    expect(r.inRange).toBe(true);
    if (!r.inRange) return;
    expect(r.predicted).toBeCloseTo(582.55, 2);
    expect(r.lln).toBeCloseTo(429.55, 2);
  });

  it("female 160 cm, 70 y, 60 kg → 462.6 m, LLN 323.6 m", () => {
    const r = sixMinuteWalkReading({ distanceM: 400, sex: "female", heightCm: 160, age: 70, weightKg: 60 });
    expect(r.inRange).toBe(true);
    if (!r.inRange) return;
    expect(r.predicted).toBeCloseTo(462.6, 2);
    expect(r.lln).toBeCloseTo(323.6, 2);
  });

  it("age outside 40–80 is out of range", () => {
    expect(sixMinuteWalkReading({ distanceM: 400, sex: "female", heightCm: 160, age: 85, weightKg: 60 }).inRange).toBe(false);
    expect(sixMinuteWalkReading({ distanceM: 400, sex: "male", heightCm: 175, age: 39, weightKg: 75 }).inRange).toBe(false);
  });

  it("predicted ≤ 0 is out of range", () => {
    expect(sixMinuteWalkReading({ distanceM: 300, sex: "male", heightCm: 120, age: 80, weightKg: 200 }).inRange).toBe(false);
  });
});

describe("gait speed", () => {
  it("6 m / 7.5 s = 0.80 → ≤0.8 band", () => {
    const speed = gaitSpeedMPerSec(6, 7.5)!;
    expect(speed).toBeCloseTo(0.8, 6);
    expect(gaitSpeedReading(speed).headline).toBe("≤ 0.8 m/s");
  });
  it("4 m / 4.5 s = 0.889 → middle band", () => {
    const speed = gaitSpeedMPerSec(4, 4.5)!;
    expect(speed).toBeCloseTo(0.889, 3);
    expect(gaitSpeedReading(speed).headline).toBe("0.8–1.0 m/s");
  });
  it("6 m / 5 s = 1.20 → ≥1.0", () => {
    const speed = gaitSpeedMPerSec(6, 5)!;
    expect(speed).toBeCloseTo(1.2, 6);
    expect(gaitSpeedReading(speed).headline).toBe("≥ 1.0 m/s");
  });
});

describe("5× chair stand", () => {
  it("15.0 s is in the 12–15 band (EWGSOP2 is >15)", () => {
    expect(chairStandReading(15).headline).toBe("12–15 秒（含 15）");
  });
  it("15.1 s is beyond EWGSOP2", () => {
    expect(chairStandReading(15.1).headline).toBe("> 15 秒");
  });
});

describe("grip", () => {
  it("male 27.0 middle, 26.9 low", () => {
    expect(gripReading(27, "male").headline).toBe("27–28 kg");
    expect(gripReading(26.9, "male").headline).toBe("低于 27 kg");
  });
  it("female 17.9 middle, 15.9 low", () => {
    expect(gripReading(17.9, "female").headline).toBe("16–18 kg");
    expect(gripReading(15.9, "female").headline).toBe("低于 16 kg");
  });
});

describe("SPPB component cut-offs (Guralnik 1994 / EPESE)", () => {
  it.each([
    [4.81, 4],
    [4.82, 3],
    [6.2, 3],
    [6.21, 2],
    [8.7, 2],
    [8.71, 1],
  ])("4 m gait %s s → %i", (sec, score) => {
    expect(sppbGaitScore(sec)).toBe(score);
  });

  it.each([
    [11.19, 4],
    [11.2, 3],
    [13.69, 3],
    [13.7, 2],
    [16.69, 2],
    [16.7, 1],
    [60, 1],
    [60.1, 0],
  ])("5× chair stand %s s → %i", (sec, score) => {
    expect(sppbChairScore(sec)).toBe(score);
  });

  it.each([
    [10, 2],
    [9.99, 1],
    [3, 1],
    [2.99, 0],
  ])("full tandem %s s → %i", (sec, score) => {
    expect(sppbTandemScore(sec)).toBe(score);
  });
});

describe("SPPB balance series", () => {
  it("all held → 4", () => {
    expect(sppbBalanceScore({ sideBySideHeld: true, semiTandemHeld: true, tandemSec: 10 })).toBe(4);
  });
  it("side-by-side failure forces 0 even if later items are filled", () => {
    expect(sppbBalanceScore({ sideBySideHeld: false, semiTandemHeld: true, tandemSec: 10 })).toBe(0);
    expect(sppbBalanceScore({ sideBySideHeld: false, semiTandemHeld: null, tandemSec: null })).toBe(0);
  });
  it("semi-tandem failure ends the series at 1", () => {
    expect(sppbBalanceScore({ sideBySideHeld: true, semiTandemHeld: false, tandemSec: 10 })).toBe(1);
  });
  it("incomplete series → null", () => {
    expect(sppbBalanceScore({ sideBySideHeld: null, semiTandemHeld: true, tandemSec: 10 })).toBeNull();
    expect(sppbBalanceScore({ sideBySideHeld: true, semiTandemHeld: null, tandemSec: null })).toBeNull();
    expect(sppbBalanceScore({ sideBySideHeld: true, semiTandemHeld: true, tandemSec: null })).toBeNull();
  });
});

describe("SPPB totals and bands", () => {
  const base = {
    sideBySideHeld: true,
    semiTandemHeld: true,
    tandemSec: 10,
    gaitUnable: false,
    gaitDistanceM: 4,
    gaitSec: 4,
    chairUnable: false,
    chairSec: 10,
  };

  it("12 → 10–12 band, not EWGSOP2 low", () => {
    const r = sppbResult(base);
    expect(r.total).toBe(12);
    expect(r.band?.range).toBe("10–12");
    expect(r.ewgsop2Low).toBe(false);
    expect(r.missing).toEqual([]);
  });
  it("9 → 7–9 band, EWGSOP2 false", () => {
    const r = sppbResult({ ...base, tandemSec: 5, gaitSec: 5, chairSec: 12 });
    expect([r.balance, r.gait, r.chair]).toEqual([3, 3, 3]);
    expect(r.total).toBe(9);
    expect(r.band?.range).toBe("7–9");
    expect(r.ewgsop2Low).toBe(false);
  });
  it("8 → EWGSOP2 low performance true", () => {
    const r = sppbResult({ ...base, tandemSec: 5, gaitSec: 5, chairSec: 14 });
    expect(r.total).toBe(8);
    expect(r.ewgsop2Low).toBe(true);
  });
  it("3 → 0–3 band", () => {
    const r = sppbResult({ ...base, semiTandemHeld: false, gaitSec: 9, chairSec: 30 });
    expect(r.total).toBe(3);
    expect(r.band?.range).toBe("0–3");
    expect(r.ewgsop2Low).toBe(true);
  });
  it("0 with unable gait and chair", () => {
    const r = sppbResult({ ...base, sideBySideHeld: false, gaitUnable: true, gaitSec: null, chairUnable: true, chairSec: null });
    expect(r.total).toBe(0);
    expect(r.band?.range).toBe("0–3");
    expect(r.ewgsop2Low).toBe(true);
  });
  it("band edges", () => {
    expect(sppbBand(4).range).toBe("4–6");
    expect(sppbBand(6).range).toBe("4–6");
    expect(sppbBand(7).range).toBe("7–9");
    expect(sppbBand(10).range).toBe("10–12");
  });
});

describe("SPPB partial input", () => {
  const none = {
    sideBySideHeld: null,
    semiTandemHeld: null,
    tandemSec: null,
    gaitUnable: false,
    gaitDistanceM: 4,
    gaitSec: null,
    chairUnable: false,
    chairSec: null,
  };

  it("nothing entered → all three missing", () => {
    expect(sppbResult(none).missing).toEqual(["balance", "gait", "chair"]);
  });
  it("only chair → balance and gait missing, no total", () => {
    const r = sppbResult({ ...none, chairSec: 12 });
    expect(r.chair).toBe(3);
    expect(r.missing).toEqual(["balance", "gait"]);
    expect(r.total).toBeNull();
    expect(r.ewgsop2Low).toBeNull();
  });
  it("gait over 6 m is not converted and counts as missing", () => {
    const r = sppbResult({ ...none, sideBySideHeld: false, gaitDistanceM: 6, gaitSec: 5, chairSec: 12 });
    expect(r.gait).toBeNull();
    expect(r.gaitWrongDistance).toBe(true);
    expect(r.missing).toEqual(["gait"]);
  });
});
