import { describe, expect, it } from "vitest";
import {
  acsmSpeedWarning,
  cyclingVo2,
  predicted6mwd,
  runningVo2Acsm,
  walkingVo2,
  wattsToKgmMin,
  ymcaInputProblem,
  ymcaVo2max,
} from "./acsm";

describe("ACSM metabolic equations", () => {
  it("walking", () => {
    expect(walkingVo2(80, 0)).toBeCloseTo(11.5, 6);
    expect(walkingVo2(80, 0.05)).toBeCloseTo(18.7, 6);
  });

  it("running", () => {
    expect(runningVo2Acsm(200, 0)).toBeCloseTo(43.5, 6);
    expect(runningVo2Acsm(200, 0.05)).toBeCloseTo(52.5, 6);
  });

  it("leg cycling", () => {
    expect(cyclingVo2(wattsToKgmMin(150), 70)).toBeCloseTo(30.6, 1);
  });

  it("warns outside validated speed range", () => {
    expect(acsmSpeedWarning("walk", 101)).not.toBeNull();
    expect(acsmSpeedWarning("walk", 100)).toBeNull();
    expect(acsmSpeedWarning("run", 79)).not.toBeNull();
    expect(acsmSpeedWarning("run", 80)).toBeNull();
  });
});

describe("YMCA-style (Tanaka variant)", () => {
  const base = { age: 40, weightKg: 70, watts1: 50, hr1: 110, watts2: 100, hr2: 140 };

  it("extrapolates two stages to Tanaka HRmax", () => {
    expect(ymcaVo2max(base)).toBeCloseTo(33.2, 1);
  });

  it.each([
    ["watts2 <= watts1", { watts2: 50 }],
    ["hr2 <= hr1", { hr2: 110 }],
    ["hr1 < 110", { hr1: 105 }],
    ["hr2 > 150", { hr2: 155 }],
  ])("rejects %s with a reason", (_label, patch) => {
    const args = { ...base, ...patch };
    expect(ymcaVo2max(args)).toBeNull();
    expect(ymcaInputProblem(args)).toEqual(expect.any(String));
  });
});

describe("Enright & Sherrill 1998 6MWD", () => {
  it("male", () => {
    expect(predicted6mwd({ sex: "male", heightCm: 175, age: 60, weightKg: 75 })).toBeCloseTo(582.55, 2);
  });
  it("female", () => {
    expect(predicted6mwd({ sex: "female", heightCm: 160, age: 70, weightKg: 60 })).toBeCloseTo(462.6, 2);
  });
});
