import { predicted6mwd } from "./acsm";

export type Sex = "male" | "female";

/** Enright & Sherrill 1998: derived in healthy adults aged 40–80 y. */
export const ENRIGHT_AGE_MIN = 40;
export const ENRIGHT_AGE_MAX = 80;

/** Enright 1998 lower limit of normal = predicted − 153 m (men) / − 139 m (women). */
export function enrightLlnOffset(sex: Sex): number {
  return sex === "male" ? 153 : 139;
}

export type SixMinuteWalkResult =
  | { inRange: true; predicted: number; lln: number; pctPredicted: number }
  | { inRange: false; reason: string };

export function sixMinuteWalkReading(args: {
  distanceM: number;
  sex: Sex;
  heightCm: number;
  age: number;
  weightKg: number;
}): SixMinuteWalkResult {
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
  return {
    inRange: true,
    predicted,
    lln: predicted - enrightLlnOffset(args.sex),
    pctPredicted: (args.distanceM / predicted) * 100,
  };
}

export function gaitSpeedMPerSec(distanceM: number, timeSec: number): number | null {
  if (distanceM <= 0 || timeSec <= 0) return null;
  return distanceM / timeSec;
}

export function gaitSpeedReading(speed: number): { headline: string; note: string } {
  if (speed <= 0.8) {
    return {
      headline: "≤ 0.8 m/s",
      note: "EWGSOP2 把 ≤0.8 m/s 作为低步行速度。AWGS 2019 的 6 m 常速切点是 <1.0 m/s。这是筛查，不是肌少症诊断。",
    };
  }
  if (speed < 1) {
    return {
      headline: "0.8–1.0 m/s",
      note: "未到欧洲 0.8 m/s 切点，但低于 AWGS 2019 的 1.0 m/s。社区筛查里常作为「体能偏低」注意。",
    };
  }
  return {
    headline: "≥ 1.0 m/s",
    note: "常速达到 AWGS 2019 常用的 1.0 m/s 线。单次只作参考，前后对比更有用。",
  };
}

export function chairStandReading(seconds: number): { headline: string; note: string } {
  if (seconds > 15) {
    return {
      headline: "> 15 秒",
      note: "同时超过 AWGS 2019（≥12 秒）和 EWGSOP2（>15 秒）的 5 次起坐切点。反映下肢力量/功率偏低，不是诊断。",
    };
  }
  if (seconds >= 12) {
    return {
      headline: "12–15 秒（含 15）",
      note: "达到 AWGS 2019 低体能表现切点（≥12 秒），尚未到 EWGSOP2 的 >15 秒。亚洲人群筛查更常看 12 秒。",
    };
  }
  return {
    headline: "< 12 秒",
    note: "未到 AWGS 2019 的 5 次起坐切点。动作必须站直、坐实，手臂交叉在胸前。",
  };
}

export function tugReading(seconds: number): { headline: string; note: string } {
  if (seconds >= 12) {
    return {
      headline: "≥ 12 秒",
      note: "CDC STEADI 把社区老年人 ≥12 秒当作跌倒风险筛查注意线，不是医学诊断。受椅高、是否用手、场地影响。",
    };
  }
  return {
    headline: "< 12 秒",
    note: "未到 CDC STEADI 常用的 12 秒筛查线。仍应结合步态、力量和跌倒史看。",
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
  else if (args.gaitSec !== null && args.gaitSec > 0) {
    if (args.gaitDistanceM !== null && Math.abs(args.gaitDistanceM - SPPB_GAIT_M) < 1e-9) {
      gait = sppbGaitScore(args.gaitSec);
    } else {
      gaitWrongDistance = true;
    }
  }

  let chair: number | null = null;
  if (args.chairUnable) chair = 0;
  else if (args.chairSec !== null && args.chairSec > 0) chair = sppbChairScore(args.chairSec);

  const missing: SppbComponent[] = [];
  if (balance === null) missing.push("balance");
  if (gait === null) missing.push("gait");
  if (chair === null) missing.push("chair");

  if (balance === null || gait === null || chair === null) {
    return { balance, gait, chair, gaitWrongDistance, missing, total: null, band: null, ewgsop2Low: null };
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
  };
}

export function gripReading(kg: number, sex: Sex): { headline: string; note: string } {
  const awgs = sex === "male" ? 28 : 18;
  const ewg = sex === "male" ? 27 : 16;
  if (kg < ewg) {
    return {
      headline: `低于 ${ewg} kg`,
      note: `同时低于 AWGS 2019（${sex === "male" ? "男 <28" : "女 <18"} kg）和 EWGSOP2（${
        sex === "male" ? "男 <27" : "女 <16"
      } kg）。这是肌力筛查切点；确诊肌少症还需要肌量。`,
    };
  }
  if (kg < awgs) {
    return {
      headline: `${ewg}–${awgs} kg`,
      note: `达到 AWGS 2019 切点（${sex === "male" ? "男 <28" : "女 <18"} kg），尚未到 EWGSOP2（${
        sex === "male" ? "男 <27" : "女 <16"
      } kg）。亚洲筛查优先看 AWGS。`,
    };
  }
  return {
    headline: `≥ ${awgs} kg`,
    note: `未到 AWGS 2019 握力切点。用校准握力计，取两次较好值。`,
  };
}
