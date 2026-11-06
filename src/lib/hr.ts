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

export type HrFormula = "tanaka" | "gulati";
export type HrFormulaChoice = HrFormula | "auto";
export type HrMaxMethod = HrFormula | "measured";

/** Gulati 2010 cohort was women aged 35–93, so it is the default only there; everyone else gets Tanaka. */
export function defaultHrFormula(sex: Sex | null, age: number | null): HrFormula {
  return sex === "female" && age !== null && age >= 35 ? "gulati" : "tanaka";
}

export const HRMAX_METHOD_LABEL: Record<HrMaxMethod, string> = {
  tanaka: "Tanaka",
  gulati: "Gulati",
  measured: "现场实测",
};

export function selectedHrMax(args: {
  age: number | null;
  sex: Sex | null;
  measured: number | null;
  formula?: HrFormulaChoice;
}): { value: number; method: HrMaxMethod } | null {
  if (args.measured !== null) {
    return { value: args.measured, method: "measured" };
  }
  if (args.age === null) return null;
  const choice = args.formula ?? "auto";
  const formula = choice === "auto" ? defaultHrFormula(args.sex, args.age) : choice;
  switch (formula) {
    case "gulati":
      return { value: gulatiHrMax(args.age), method: "gulati" };
    case "tanaka":
      return { value: tanakaHrMax(args.age), method: "tanaka" };
    default: {
      const _never: never = formula;
      return _never;
    }
  }
}

export function heartRateReserve(hrMax: number, resting: number): number {
  return hrMax - resting;
}

export function karvonen(resting: number, hrr: number, intensity: number): number {
  return resting + hrr * intensity;
}

/** Zones are %HRR bands; they do not claim LT1/LT2 boundaries (those are estimated separately). */
export const KARVONEN_ZONES = [
  { id: "z1", name: "Z1 恢复", low: 0.5, high: 0.6, physiology: "恢复、热身、放松", talk: "能唱歌" },
  { id: "z2", name: "Z2 有氧", low: 0.6, high: 0.75, physiology: "有氧基础，日常轻松跑和长距离", talk: "能说完整句子" },
  { id: "z3", name: "Z3 中等", low: 0.75, high: 0.82, physiology: "中等强度，稳态跑", talk: "只能说短句" },
  { id: "z4", name: "Z4 吃力", low: 0.82, high: 0.88, physiology: "接近阈值的吃力强度，节奏跑", talk: "只能说 3–5 个词" },
  { id: "z5", name: "Z5 很吃力", low: 0.88, high: 1, physiology: "高强度间歇", talk: "只能蹦字" },
] as const;

export const HRMAX_ZONES = [
  { id: "z1", name: "Z1 恢复", low: 0.5, high: 0.6 },
  { id: "z2", name: "Z2 有氧", low: 0.6, high: 0.7 },
  { id: "z3", name: "Z3 混氧", low: 0.7, high: 0.8 },
  { id: "z4", name: "Z4 阈值", low: 0.8, high: 0.9 },
  { id: "z5", name: "Z5 无氧", low: 0.9, high: 1 },
] as const;

/** %HRR → %HRmax for a given RHR/HRmax ratio (Karvonen identity). */
export function hrrToHrMaxFraction(hrrFraction: number, restToMaxRatio: number): number {
  return restToMaxRatio + hrrFraction * (1 - restToMaxRatio);
}

/**
 * Typical RHR/HRmax per group (untrained ≈ 70/185, trained ≈ 55/185), used only to
 * express the %HRR bands as %HRmax for users without a resting HR.
 */
export const REFERENCE_REST_RATIO = { untrained: 0.38, trained: 0.3 } as const;

type Band = { low: number; high: number };

function toHrMaxBand(hrr: Band, restRatio: number): Band {
  const round = (x: number): number => Math.round(x * 100) / 100;
  return {
    low: round(hrrToHrMaxFraction(hrr.low, restRatio)),
    high: round(hrrToHrMaxFraction(hrr.high, restRatio)),
  };
}

function lactateBands(lt1Karvonen: Band, lt2Karvonen: Band, restRatio: number) {
  return {
    lt1Karvonen,
    lt2Karvonen,
    lt1HrMax: toHrMaxBand(lt1Karvonen, restRatio),
    lt2HrMax: toHrMaxBand(lt2Karvonen, restRatio),
  };
}

/**
 * Empirical %HRR estimates with no single primary source. %HRR is primary because it
 * tracks %VO₂R (Swain & Leutholtz 1997); the %HRmax bands are derived, never set by hand.
 */
export const LT_COEFFICIENTS = {
  untrained: lactateBands({ low: 0.65, high: 0.7 }, { low: 0.8, high: 0.83 }, REFERENCE_REST_RATIO.untrained),
  trained: lactateBands({ low: 0.65, high: 0.7 }, { low: 0.85, high: 0.88 }, REFERENCE_REST_RATIO.trained),
} as const;

/** Karvonen zones are only meaningful when RHR < HRmax. */
export function restingHrProblem(hrMax: number, resting: number): string | null {
  if (resting >= hrMax) {
    return `静息心率 ${Math.round(resting)} bpm 不低于最大心率 ${Math.round(hrMax)} bpm，储备心率为零或负，无法计算 Karvonen 分区。请检查输入。`;
  }
  return null;
}

/** Gulati 2010 cohort: women aged ≥35. */
export function gulatiRangeNote(sex: Sex | null, age: number | null): string | null {
  if (sex === "female" && age !== null && age < 35) {
    return "Gulati 公式只在 35 岁及以上女性中验证（Gulati 2010），低于 35 岁结果仅供参考。";
  }
  return null;
}
