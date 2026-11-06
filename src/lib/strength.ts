export function epley1rm(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

/** Brzycki is undefined at 37 reps and negative beyond; returns NaN there. */
export function brzycki1rm(weight: number, reps: number): number {
  if (reps >= 37) return Number.NaN;
  if (reps <= 1) return weight;
  return weight * (36 / (37 - reps));
}

export const MAX_REPS = 12;
export const MAX_RIR = 4;

export type Strength1rmInput = { weight: number; reps: number; rir: number };

export type Strength1rmResult =
  | {
      ok: true;
      effectiveReps: number;
      epley: number;
      brzycki: number;
      value: number;
      method: string;
    }
  | { ok: false; reason: string };

/** Epley/Brzycki assume a set to failure, so reps stopped short count as reps + RIR. */
export function estimate1rm({ weight, reps, rir }: Strength1rmInput): Strength1rmResult {
  if (!Number.isFinite(weight) || weight <= 0) return { ok: false, reason: "重量需大于 0。" };
  if (!Number.isInteger(reps) || reps < 1 || reps > MAX_REPS) {
    return { ok: false, reason: `次数需为 1–${MAX_REPS} 的整数；次数更多时公式误差过大。` };
  }
  if (!Number.isInteger(rir) || rir < 0 || rir > MAX_RIR) {
    return { ok: false, reason: `RIR 需为 0–${MAX_RIR} 的整数；离力竭更远时剩余次数估不准。` };
  }
  const effectiveReps = reps + rir;
  if (effectiveReps <= 1) {
    return { ok: true, effectiveReps, epley: weight, brzycki: weight, value: weight, method: "实测 1 次" };
  }
  const epley = epley1rm(weight, effectiveReps);
  const brzycki = brzycki1rm(weight, effectiveReps);
  return { ok: true, effectiveReps, epley, brzycki, value: (epley + brzycki) / 2, method: "Epley 与 Brzycki 均值" };
}

export const PLATE_STEP_KG = 2.5;

export function roundToPlate(kg: number, step = PLATE_STEP_KG): number {
  return Math.round(kg / step) * step;
}

/** Inverse of epley1rm: the weight that `reps` to failure would correspond to. */
export function epleyWeight(oneRm: number, reps: number): number {
  if (reps <= 1) return oneRm;
  return oneRm / (1 + reps / 30);
}

/** Inverse of brzycki1rm. */
export function brzyckiWeight(oneRm: number, reps: number): number {
  if (reps >= 37) return Number.NaN;
  if (reps <= 1) return oneRm;
  return (oneRm * (37 - reps)) / 36;
}

export const MAX_PLAN_REPS = 12;

export type StrengthPlanResult =
  | { ok: true; repsToFailure: number; epley: number; brzycki: number; value: number; rounded: number }
  | { ok: false; reason: string };

/** Planned set of `reps` leaving `rir` in reserve: invert both equations at reps + RIR and average. */
export function planWeight(oneRm: number, reps: number, rir: number): StrengthPlanResult {
  if (!Number.isFinite(oneRm) || oneRm <= 0) return { ok: false, reason: "1RM 需大于 0。" };
  if (!Number.isInteger(reps) || reps < 1 || reps > MAX_PLAN_REPS) {
    return { ok: false, reason: `计划次数需为 1–${MAX_PLAN_REPS} 的整数。` };
  }
  if (!Number.isInteger(rir) || rir < 0 || rir > MAX_RIR) {
    return { ok: false, reason: `计划 RIR 需为 0–${MAX_RIR} 的整数。` };
  }
  const repsToFailure = reps + rir;
  const epley = epleyWeight(oneRm, repsToFailure);
  const brzycki = brzyckiWeight(oneRm, repsToFailure);
  const value = (epley + brzycki) / 2;
  return { ok: true, repsToFailure, epley, brzycki, value, rounded: roundToPlate(value) };
}

export type StrengthGoal = {
  id: string;
  name: string;
  /** null = no %1RM band; effort (proximity to failure) matters more than load. */
  low: number | null;
  high: number | null;
  loadNote: string;
  volume: string;
  how: string;
};

export const STRENGTH_LOADS: readonly StrengthGoal[] = [
  {
    id: "power",
    name: "爆发力",
    low: 0.3,
    high: 0.7,
    loadNote: "30–70% 1RM",
    volume: "每动作 次数 × 组数 ≤ 24",
    how: "举起、蹬起时尽量快，每次都保持速度，不做到力竭。负荷轻是为了速度，不是骑车瓦数。",
  },
  {
    id: "hypertrophy",
    name: "增肌",
    low: null,
    high: null,
    loadNote: "30–100% 1RM 效果相近",
    volume: "每肌群每周 ≥ 10 组",
    how: "前提是每组接近力竭（约 0–3 RIR）。重量不必局限在某个窄区间，一周做够有效组更关键。",
  },
  {
    id: "strength",
    name: "最大力量",
    low: 0.8,
    high: 1,
    loadNote: "≥ 80% 1RM",
    volume: "每动作 2–3 组",
    how: "接近最大重量，每组次数少。ACSM：≥80% 1RM。",
  },
];

export const RIR_SCALE = [
  { rpe: "10", rir: "0", meaning: "最大努力，无法再做 1 次" },
  { rpe: "9.5", rir: "0", meaning: "不能再做，但可略加重量" },
  { rpe: "9", rir: "1", meaning: "还能做 1 次" },
  { rpe: "8.5", rir: "1–2", meaning: "肯定还能 1 次，也许 2 次" },
  { rpe: "8", rir: "2", meaning: "还能做 2 次" },
  { rpe: "7.5", rir: "2–3", meaning: "肯定还能 2 次，也许 3 次" },
  { rpe: "7", rir: "3", meaning: "还能做 3 次" },
  { rpe: "5–6", rir: "4–6", meaning: "离力竭较远，判断变差" },
  { rpe: "1–4", rir: "—", meaning: "轻松，不用于负荷处方" },
] as const;
