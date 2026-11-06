import type { Sex } from "./dom";

export type YoyoLevel = "ir1" | "ir2";

const YOYO_COEFFICIENTS: Record<YoyoLevel, { slope: number; intercept: number }> = {
  ir1: { slope: 0.0084, intercept: 36.4 },
  ir2: { slope: 0.0136, intercept: 45.3 },
};

/** Bangsbo, Iaia & Krustrup 2008: VO₂max (mL/kg/min) from Yo-Yo IR total distance (m). */
export function yoyoVo2(level: YoyoLevel, distanceM: number): number | null {
  if (!Number.isFinite(distanceM) || distanceM < 40 || distanceM > 4000) return null;
  const { slope, intercept } = YOYO_COEFFICIENTS[level];
  return distanceM * slope + intercept;
}

export const LEGER_MAX_STAGE = 21;

/** Léger et al. 1988 20 m shuttle (1-min stages): speed = 8 + 0.5 × stage, stage 1 = 8.5 km/h. */
export function legerStageSpeed(stage: number): number | null {
  if (!Number.isInteger(stage) || stage < 1 || stage > LEGER_MAX_STAGE) return null;
  return 8 + 0.5 * stage;
}

/**
 * Léger et al. 1988: 31.025 + 3.238·S − 3.248·A + 0.1536·A·S.
 * Adults (≥ 18 y) use the same equation with A fixed at 18 (≈ −27.4 + 6.0·S).
 */
export function legerVo2(stage: number, age: number): number | null {
  const speed = legerStageSpeed(stage);
  if (speed === null || !Number.isFinite(age) || age < 6 || age > 90) return null;
  const a = Math.min(age, 18);
  return 31.025 + 3.238 * speed - 3.248 * a + 0.1536 * a * speed;
}

/** Buchheit 30-15 IFT VO₂max; G = 1 male, 2 female; VIFT = last completed stage speed (km/h). */
export function ift3015Vo2(args: {
  viftKmh: number;
  age: number;
  sex: Sex;
  weightKg: number;
}): number | null {
  const { viftKmh: v, age, weightKg } = args;
  if (!Number.isFinite(v) || v < 8 || v > 28) return null;
  if (!Number.isFinite(age) || age < 10 || age > 90) return null;
  if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 200) return null;
  const g = args.sex === "male" ? 1 : 2;
  return 28.3 - 2.15 * g - 0.741 * age - 0.0357 * weightKg + 0.0586 * age * v + 1.03 * v;
}

/** Buchheit 2008 JSCR: each change of direction costs ~0.7 s of the run time. */
export const COD_SECONDS = 0.7;

export const IFT_INTERVAL_FRACTIONS = [0.9, 0.95, 1] as const;

export type IntervalDistance = { meters: number; turns: number };

/**
 * Target distance for one rep at `fraction` of VIFT. With `shuttleM`, subtracts 0.7 s per turn
 * (e.g. 95% of 19 km/h, 15 s, 40 m shuttle → (19/3.6 × 0.95) × (15 − 0.7) = 71.7 m).
 */
export function iftIntervalDistance(
  viftKmh: number,
  fraction: number,
  seconds: number,
  shuttleM?: number,
): IntervalDistance | null {
  if (!Number.isFinite(viftKmh) || viftKmh < 8 || viftKmh > 28) return null;
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1.2) return null;
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 600) return null;
  const speed = (viftKmh / 3.6) * fraction;
  if (shuttleM === undefined) return { meters: speed * seconds, turns: 0 };
  if (!Number.isFinite(shuttleM) || shuttleM <= 0) return null;
  // A turn is only needed when the distance passes a line, and each turn shortens the run.
  let turns = Math.floor((speed * seconds) / shuttleM);
  while (turns > 0 && speed * (seconds - COD_SECONDS * turns) <= shuttleM * turns) turns -= 1;
  return { meters: speed * (seconds - COD_SECONDS * turns), turns };
}
