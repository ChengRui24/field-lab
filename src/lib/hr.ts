export type Sex = "male" | "female";

export function foxHrMax(age: number): number {
  return 220 - age;
}

export function tanakaHrMax(age: number): number {
  return 208 - 0.7 * age;
}

export function gulatiHrMax(age: number): number {
  return 206 - 0.88 * age;
}

export function selectedHrMax(args: {
  age: number | null;
  sex: Sex | null;
  measured: number | null;
}): { value: number; method: string } | null {
  if (args.measured !== null) {
    return { value: args.measured, method: "现场实测" };
  }
  if (args.age === null) return null;
  if (args.sex === "female") {
    return { value: gulatiHrMax(args.age), method: "Gulati（女性）" };
  }
  return { value: tanakaHrMax(args.age), method: "Tanaka" };
}

export function heartRateReserve(hrMax: number, resting: number): number {
  return hrMax - resting;
}

export function karvonen(resting: number, hrr: number, intensity: number): number {
  return resting + hrr * intensity;
}

export const KARVONEN_ZONES = [
  { id: "z1", name: "Z1 恢复", low: 0.5, high: 0.6, physiology: "纯有氧，脂肪主导", talk: "能唱歌" },
  { id: "z2", name: "Z2 有氧", low: 0.6, high: 0.75, physiology: "LT1 以下，脂肪 + 糖混合", talk: "能说完整长句" },
  { id: "z3", name: "Z3 混氧下", low: 0.75, high: 0.82, physiology: "LT1–LT2 之间，乳酸缓慢上升", talk: "只能说短句" },
  { id: "z4", name: "Z4 阈值", low: 0.82, high: 0.88, physiology: "LT2 附近，乳酸稳态", talk: "只能说 3–5 个词" },
  { id: "z5", name: "Z5 无氧", low: 0.88, high: 1, physiology: "LT2 以上，乳酸快速堆积", talk: "只能蹦字" },
] as const;

export const HRMAX_ZONES = [
  { id: "z1", name: "Z1 恢复", low: 0.5, high: 0.6 },
  { id: "z2", name: "Z2 有氧", low: 0.6, high: 0.7 },
  { id: "z3", name: "Z3 混氧", low: 0.7, high: 0.8 },
  { id: "z4", name: "Z4 阈值", low: 0.8, high: 0.9 },
  { id: "z5", name: "Z5 无氧", low: 0.9, high: 1 },
] as const;

export const LT_COEFFICIENTS = {
  untrained: {
    lt1Karvonen: { low: 0.65, high: 0.7 },
    lt2Karvonen: { low: 0.8, high: 0.83 },
    lt1HrMax: { low: 0.65, high: 0.75 },
    lt2HrMax: { low: 0.82, high: 0.85 },
  },
  trained: {
    lt1Karvonen: { low: 0.65, high: 0.7 },
    lt2Karvonen: { low: 0.85, high: 0.88 },
    lt1HrMax: { low: 0.65, high: 0.75 },
    lt2HrMax: { low: 0.88, high: 0.92 },
  },
} as const;
