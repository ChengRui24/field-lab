export function epley1rm(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

export function brzycki1rm(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (36 / (37 - reps));
}

export function selected1rm(weight: number, reps: number): { value: number; method: string } {
  if (reps <= 1) return { value: weight, method: "实测 1 次" };
  const epley = epley1rm(weight, reps);
  const brzycki = brzycki1rm(weight, reps);
  return { value: (epley + brzycki) / 2, method: "Epley 与 Brzycki 均值" };
}

export const STRENGTH_LOADS = [
  {
    id: "power",
    name: "爆发力",
    low: 0.3,
    high: 0.7,
    volume: "每动作 2–5 组",
    how: "举起、蹬起时尽量快。负荷轻是为了速度，不是骑车瓦数。",
  },
  {
    id: "hypertrophy",
    name: "增肌",
    low: 0.6,
    high: 0.8,
    volume: "每肌群每周约 10 组",
    how: "关键是一周做够有效组，单组不必最重，但组内要够努力。",
  },
  {
    id: "strength",
    name: "最大力量",
    low: 0.8,
    high: 1,
    volume: "每动作 2–3 组",
    how: "接近最大重量，每组次数少。ACSM：≥80% 1RM。",
  },
] as const;

export const RIR_SCALE = [
  { rpe: "10", rir: "0", meaning: "无法再做 1 次" },
  { rpe: "9.5", rir: "1 可能", meaning: "也许还能做 1 次" },
  { rpe: "9", rir: "1", meaning: "还能做 1 次" },
  { rpe: "8", rir: "2", meaning: "还能做 2 次" },
  { rpe: "7", rir: "3", meaning: "还能做 3 次" },
  { rpe: "5–6", rir: "4–6", meaning: "离力竭较远，判断变差" },
  { rpe: "1–4", rir: "—", meaning: "轻松，不用于负荷处方" },
] as const;
