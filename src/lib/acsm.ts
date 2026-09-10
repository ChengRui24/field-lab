import { tanakaHrMax } from "./hr";

/** ACSM metabolic equations. Speed in m/min, grade as fraction (0.05 = 5%). */
export function walkingVo2(speedMPerMin: number, grade: number): number {
  return 0.1 * speedMPerMin + 1.8 * speedMPerMin * grade + 3.5;
}

export function runningVo2Acsm(speedMPerMin: number, grade: number): number {
  return 0.2 * speedMPerMin + 0.9 * speedMPerMin * grade + 3.5;
}

/** Leg cycling: work rate in kg·m/min. 1 W ≈ 6.12 kg·m/min. */
export function cyclingVo2(workKgmMin: number, bodyMassKg: number): number {
  return (1.8 * workKgmMin) / bodyMassKg + 7;
}

export function wattsToKgmMin(watts: number): number {
  return watts * 6.12;
}

/**
 * YMCA-style extrapolation: two submax stages, linear HR–VO₂ to HRmax.
 * Work rates in watts.
 */
export function ymcaVo2max(args: {
  age: number;
  weightKg: number;
  watts1: number;
  hr1: number;
  watts2: number;
  hr2: number;
}): number | null {
  if (args.hr2 <= args.hr1) return null;
  const vo21 = cyclingVo2(wattsToKgmMin(args.watts1), args.weightKg);
  const vo22 = cyclingVo2(wattsToKgmMin(args.watts2), args.weightKg);
  const slope = (vo22 - vo21) / (args.hr2 - args.hr1);
  const hrMax = tanakaHrMax(args.age);
  return vo22 + slope * (hrMax - args.hr2);
}

/** Enright & Sherrill 1998 predicted 6MWD (m). */
export function predicted6mwd(args: { sex: "male" | "female"; heightCm: number; age: number; weightKg: number }): number {
  if (args.sex === "male") {
    return 7.57 * args.heightCm - 5.02 * args.age - 1.76 * args.weightKg - 309;
  }
  return 2.11 * args.heightCm - 5.78 * args.age - 2.29 * args.weightKg + 667;
}
