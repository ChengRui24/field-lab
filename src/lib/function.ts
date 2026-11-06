import { predicted6mwd } from "./acsm";

export type Sex = "male" | "female";

/**
 * Plausible input ranges; function.html min/max must match (checked in function.test.ts).
 * Values outside these produce no reading rather than a misleading "normal".
 */
export const FUNCTION_LIMITS = {
  age: { min: 18, max: 110 },
  heightCm: { min: 100, max: 220 },
  weightKg: { min: 20, max: 250 },
  mwtM: { min: 10, max: 1000 },
  gaitM: { min: 3, max: 20 },
  gaitSec: { min: 1, max: 60 },
  chairSec: { min: 3, max: 60 },
  tugSec: { min: 3, max: 120 },
  gripKg: { min: 1, max: 100 },
} as const;

export type FunctionLimitKey = keyof typeof FUNCTION_LIMITS;

export function withinLimits(key: FunctionLimitKey, value: number | null): value is number {
  if (value === null || !Number.isFinite(value)) return false;
  const { min, max } = FUNCTION_LIMITS[key];
  return value >= min && value <= max;
}

export type Tone = "ok" | "caution";

export type Reading = {
  /** Lay comparison with the reference line, e.g. 低于亚洲女性参考线 18 kg（偏弱）. */
  headline: string;
  note: string;
  tone: Tone;
  /** Badge text: 正常 / 偏低 / 需留意. */
  flag: string;
  /** Below the AWGS 2019 line for this item (counts toward "possible sarcopenia"). */
  awgsLow: boolean;
};

/** Enright & Sherrill 1998: derived in healthy adults aged 40–80 y. */
export const ENRIGHT_AGE_MIN = 40;
export const ENRIGHT_AGE_MAX = 80;

/** Enright 1998 lower limit of normal = predicted − 153 m (men) / − 139 m (women). */
export function enrightLlnOffset(sex: Sex): number {
  return sex === "male" ? 153 : 139;
}

export type SixMinuteWalkResult =
  | { inRange: true; predicted: number; lln: number; pctPredicted: number; belowLln: boolean }
  | { inRange: false; reason: string };

/** Null when any input is outside FUNCTION_LIMITS. */
export function sixMinuteWalkReading(args: {
  distanceM: number;
  sex: Sex;
  heightCm: number;
  age: number;
  weightKg: number;
}): SixMinuteWalkResult | null {
  if (
    !withinLimits("mwtM", args.distanceM) ||
    !withinLimits("age", args.age) ||
    !withinLimits("heightCm", args.heightCm) ||
    !withinLimits("weightKg", args.weightKg)
  ) {
    return null;
  }
  if (args.age < ENRIGHT_AGE_MIN || args.age > ENRIGHT_AGE_MAX) {
    return { inRange: false, reason: `年龄超出 Enright 方程的验证范围（${ENRIGHT_AGE_MIN}–${ENRIGHT_AGE_MAX} 岁）` };
  }
  const predicted = predicted6mwd({
    sex: args.sex,
    heightCm: args.heightCm,
    age: args.age,
    weightKg: args.weightKg,
  });
  if (!Number.isFinite(predicted) || predicted <= 0) {
    return { inRange: false, reason: "身高、体重组合使预测值 ≤ 0" };
  }
  const lln = predicted - enrightLlnOffset(args.sex);
  return {
    inRange: true,
    predicted,
    lln,
    pctPredicted: (args.distanceM / predicted) * 100,
    belowLln: args.distanceM < lln,
  };
}

export function gaitSpeedMPerSec(distanceM: number, timeSec: number): number | null {
  if (!withinLimits("gaitM", distanceM) || !withinLimits("gaitSec", timeSec)) return null;
  return distanceM / timeSec;
}

/** AWGS 2019: usual gait speed < 1.0 m/s (6 m); EWGSOP2: ≤ 0.8 m/s. */
export function gaitSpeedReading(speed: number): Reading {
  if (speed < 1) {
    const ewg = speed <= 0.8 ? "也达到欧洲 EWGSOP2 的 ≤0.8 m/s 慢步速线。" : "还没到欧洲 EWGSOP2 的 0.8 m/s 线。";
    return {
      headline: "低于亚洲参考线 1.0 m/s（偏慢）",
      note: `AWGS 2019 把常速 <1.0 m/s 算作体能表现低；${ewg}AWGS 原文用 6 m 测，4 m 结果只作近似对照。`,
      tone: "caution",
      flag: "偏低",
      awgsLow: true,
    };
  }
  return {
    headline: "达到参考线 1.0 m/s（正常范围）",
    note: "单次只作参考，隔段时间用同样方法复测、前后对比更有用。",
    tone: "ok",
    flag: "正常",
    awgsLow: false,
  };
}

/** AWGS 2019: 5-time chair stand ≥ 12 s; EWGSOP2: > 15 s. Null outside FUNCTION_LIMITS. */
export function chairStandReading(seconds: number): Reading | null {
  if (!withinLimits("chairSec", seconds)) return null;
  if (seconds >= 12) {
    const ewg = seconds > 15 ? "也超过欧洲 EWGSOP2 的 15 秒线。" : "还没到欧洲 EWGSOP2 的 >15 秒线。";
    return {
      headline: "慢于亚洲参考线 12 秒（偏慢）",
      note: `AWGS 2019 把 5 次起坐 ≥12 秒算作体能表现低，反映腿部力量偏弱；${ewg}`,
      tone: "caution",
      flag: "偏低",
      awgsLow: true,
    };
  }
  return {
    headline: "快于亚洲参考线 12 秒（正常范围）",
    note: "前提是每次都站直、坐实，手臂交叉在胸前。",
    tone: "ok",
    flag: "正常",
    awgsLow: false,
  };
}

/** CDC STEADI: "An older adult who takes ≥12 seconds to complete the TUG is at risk for falling." */
export function tugReading(seconds: number): Reading | null {
  if (!withinLimits("tugSec", seconds)) return null;
  if (seconds >= 12) {
    return {
      headline: "慢于 CDC STEADI 参考线 12 秒（跌倒风险需留意）",
      note: "CDC STEADI：完成 TUG 需要 ≥12 秒的老年人有跌倒风险。这是筛查提示，不是诊断；椅高、是否扶手、场地都会影响。",
      tone: "caution",
      flag: "需留意",
      awgsLow: false,
    };
  }
  return {
    headline: "快于 CDC STEADI 参考线 12 秒（正常范围）",
    note: "仍要结合走路是否不稳、过去一年是否跌倒过来看。",
    tone: "ok",
    flag: "正常",
    awgsLow: false,
  };
}

/** AWGS 2019 grip: men < 28 kg, women < 18 kg; EWGSOP2: < 27 / < 16 kg. Null outside FUNCTION_LIMITS. */
export function gripReading(kg: number, sex: Sex): Reading | null {
  if (!withinLimits("gripKg", kg)) return null;
  const who = sex === "male" ? "男性" : "女性";
  const awgs = sex === "male" ? 28 : 18;
  const ewg = sex === "male" ? 27 : 16;
  if (kg < awgs) {
    const ewgNote = kg < ewg ? `也低于欧洲 EWGSOP2 的 ${ewg} kg 线。` : `还没低于欧洲 EWGSOP2 的 ${ewg} kg 线。`;
    return {
      headline: `低于亚洲${who}参考线 ${awgs} kg（偏弱）`,
      note: `AWGS 2019 把${who}握力 <${awgs} kg 算作肌力低；${ewgNote}单凭握力不能诊断肌少症，还需要测肌肉量。`,
      tone: "caution",
      flag: "偏低",
      awgsLow: true,
    };
  }
  return {
    headline: `在亚洲${who}参考线 ${awgs} kg 以上（正常范围）`,
    note: "前提是用校准过的握力计，取两次中较好的一次。",
    tone: "ok",
    flag: "正常",
    awgsLow: false,
  };
}

/** SPPB cut-offs are published to 0.01 s (EPESE sheet); round first so the gaps between bands are unambiguous. */
function hundredths(seconds: number): number {
  return Math.round(seconds * 100) / 100;
}

/** Guralnik 1994 / EPESE: full tandem ≥10 s = 2, 3–9.99 s = 1, <3 s = 0. */
export function sppbTandemScore(seconds: number): number {
  const t = hundredths(seconds);
  if (t >= 10) return 2;
  if (t >= 3) return 1;
  return 0;
}

/**
 * Side-by-side and semi-tandem are held-10-s yes/no. A failed stand ends the balance series
 * (later stands are not attempted and score 0). Returns null while the series is incomplete.
 */
export function sppbBalanceScore(args: {
  sideBySideHeld: boolean | null;
  semiTandemHeld: boolean | null;
  tandemSec: number | null;
}): number | null {
  if (args.sideBySideHeld === null) return null;
  if (!args.sideBySideHeld) return 0;
  if (args.semiTandemHeld === null) return null;
  if (!args.semiTandemHeld) return 1;
  if (args.tandemSec === null) return null;
  return 2 + sppbTandemScore(args.tandemSec);
}

/** 4 m usual pace, faster of two trials: <4.82 = 4; 4.82–6.20 = 3; 6.21–8.70 = 2; >8.70 = 1. */
export function sppbGaitScore(seconds: number): number {
  const t = hundredths(seconds);
  if (t < 4.82) return 4;
  if (t <= 6.2) return 3;
  if (t <= 8.7) return 2;
  return 1;
}

/** 5 rises: ≤11.19 = 4; 11.20–13.69 = 3; 13.70–16.69 = 2; 16.70–60 = 1; >60 s = 0. */
export function sppbChairScore(seconds: number): number {
  const t = hundredths(seconds);
  if (t <= 11.19) return 4;
  if (t <= 13.69) return 3;
  if (t <= 16.69) return 2;
  if (t <= 60) return 1;
  return 0;
}

export const SPPB_GAIT_M = 4;
export const SPPB_EWGSOP2_LOW_MAX = 8;
export const SPPB_AWGS_LOW_MAX = 9;

export type SppbComponent = "balance" | "gait" | "chair";

export const SPPB_COMPONENT_LABEL: Record<SppbComponent, string> = {
  balance: "平衡",
  gait: "4 m 步行",
  chair: "5 次起坐",
};

export type SppbBand = { range: string; label: string };

export function sppbBand(total: number): SppbBand {
  if (total <= 3) return { range: "0–3", label: "重度活动受限" };
  if (total <= 6) return { range: "4–6", label: "中度活动受限" };
  if (total <= 9) return { range: "7–9", label: "轻度活动受限" };
  return { range: "10–12", label: "无或极轻活动受限" };
}

export type SppbResult = {
  balance: number | null;
  gait: number | null;
  chair: number | null;
  /** Gait time was entered over a distance other than 4 m, so it cannot be scored. */
  gaitWrongDistance: boolean;
  missing: SppbComponent[];
  total: number | null;
  band: SppbBand | null;
  /** EWGSOP2 (Cruz-Jentoft 2019): SPPB ≤ 8 = poor physical performance. */
  ewgsop2Low: boolean | null;
  /** AWGS 2019 (Chen 2020): SPPB ≤ 9 = low physical performance. */
  awgsLow: boolean | null;
};

export function sppbResult(args: {
  sideBySideHeld: boolean | null;
  semiTandemHeld: boolean | null;
  tandemSec: number | null;
  gaitUnable: boolean;
  gaitDistanceM: number | null;
  gaitSec: number | null;
  chairUnable: boolean;
  chairSec: number | null;
}): SppbResult {
  const balance = sppbBalanceScore(args);

  let gait: number | null = null;
  let gaitWrongDistance = false;
  if (args.gaitUnable) gait = 0;
  else if (withinLimits("gaitSec", args.gaitSec)) {
    if (args.gaitDistanceM !== null && Math.abs(args.gaitDistanceM - SPPB_GAIT_M) < 1e-9) {
      gait = sppbGaitScore(args.gaitSec);
    } else {
      gaitWrongDistance = true;
    }
  }

  let chair: number | null = null;
  if (args.chairUnable) chair = 0;
  else if (withinLimits("chairSec", args.chairSec)) chair = sppbChairScore(args.chairSec);

  const missing: SppbComponent[] = [];
  if (balance === null) missing.push("balance");
  if (gait === null) missing.push("gait");
  if (chair === null) missing.push("chair");

  if (balance === null || gait === null || chair === null) {
    return { balance, gait, chair, gaitWrongDistance, missing, total: null, band: null, ewgsop2Low: null, awgsLow: null };
  }
  const total = balance + gait + chair;
  return {
    balance,
    gait,
    chair,
    gaitWrongDistance,
    missing,
    total,
    band: sppbBand(total),
    ewgsop2Low: total <= SPPB_EWGSOP2_LOW_MAX,
    awgsLow: total <= SPPB_AWGS_LOW_MAX,
  };
}

/** Each item: true = below its screening line, false = within, null = not tested / invalid. */
export type ScreeningFlags = {
  gait: boolean | null;
  chair: boolean | null;
  sppb: boolean | null;
  grip: boolean | null;
  tug: boolean | null;
  mwt: boolean | null;
};

export const SCREENING_LABEL: Record<keyof ScreeningFlags, string> = {
  gait: "步速",
  chair: "起坐",
  sppb: "SPPB",
  grip: "握力",
  tug: "起立–行走",
  mwt: "6 分钟步行",
};

const AWGS_ITEMS = ["gait", "chair", "sppb", "grip"] as const;

export type ScreeningSummary = {
  tested: number;
  /** Labels of AWGS 2019 items below the line, in page order. */
  awgsLow: string[];
  /**
   * AWGS 2019 "possible sarcopenia": low muscle strength (grip) or low physical performance
   * (gait < 1.0 m/s, SPPB ≤ 9, or 5-time chair stand ≥ 12 s) — muscle mass not required.
   */
  possibleSarcopenia: boolean;
  /** CDC STEADI: TUG ≥ 12 s. */
  fallRisk: boolean;
  /** Below Enright 1998 lower limit of normal. */
  mwtLow: boolean;
};

export function screeningSummary(flags: ScreeningFlags): ScreeningSummary {
  const tested = Object.values(flags).filter((v) => v !== null).length;
  const awgsLow = AWGS_ITEMS.filter((k) => flags[k] === true).map((k) => SCREENING_LABEL[k]);
  return {
    tested,
    awgsLow,
    possibleSarcopenia: awgsLow.length > 0,
    fallRisk: flags.tug === true,
    mwtLow: flags.mwt === true,
  };
}
