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

/** ACSM equations are validated for walking 50–100 m/min and running ≥ 80 m/min (true jogging). */
export function acsmSpeedWarning(mode: "walk" | "run", speedMPerMin: number): string | null {
  if (mode === "walk" && speedMPerMin > 100) {
    return `步行方程只在 50–100 m/min 验证，当前 ${Math.round(speedMPerMin)} m/min 已超出，这么快通常应按「跑」计算。`;
  }
  if (mode === "run" && speedMPerMin < 80) {
    return `跑步方程只在 ≥ 80 m/min（真正慢跑）验证，当前 ${Math.round(speedMPerMin)} m/min 偏慢，结果会失真，可改用「走」。`;
  }
  return null;
}

export type YmcaArgs = {
  age: number;
  weightKg: number;
  watts1: number;
  hr1: number;
  watts2: number;
  hr2: number;
};

/** YMCA protocol requires two steady-state stages with HR in 110–150 bpm. */
export function ymcaInputProblem(args: YmcaArgs): string | null {
  if (args.watts2 <= args.watts1) return "负荷 2 必须高于负荷 1，才能做线性外推。";
  if (args.hr2 <= args.hr1) return "心率 2 必须高于心率 1，才能做线性外推。";
  if (args.hr1 < 110) return "心率 1 低于 110 bpm，尚未进入 YMCA 方案要求的 110–150 bpm 稳态窗口，请提高第一档负荷。";
  if (args.hr2 > 150) return "心率 2 高于 150 bpm，超出 YMCA 方案的 110–150 bpm 稳态窗口，请降低第二档负荷。";
  return null;
}

/**
 * YMCA-style extrapolation (Tanaka variant): two submax stages, linear HR–VO₂ to Tanaka HRmax.
 * The original YMCA protocol extrapolates to 220 − age. Work rates in watts.
 */
export function ymcaVo2max(args: YmcaArgs): number | null {
  if (ymcaInputProblem(args) !== null) return null;
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
