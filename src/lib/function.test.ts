import { describe, expect, it } from "vitest";
import {
  chairStandReading,
  gaitSpeedMPerSec,
  gaitSpeedReading,
  gripReading,
  sixMinuteWalkReading,
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
