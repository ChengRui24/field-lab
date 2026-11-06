import { CONCENTRATED_PCT, resolveIngredient, type IngredientId, type RecipePart } from "./diyfuel";

export function caffeineDose(weightKg: number): { low: number; high: number } {
  return { low: 3 * weightKg, high: 6 * weightKg };
}

export function proteinDose(weightKg: number): { endurance: { low: number; high: number }; hypertrophy: { low: number; high: number } } {
  return {
    endurance: { low: 1.2 * weightKg, high: 1.6 * weightKg },
    hypertrophy: { low: 1.6 * weightKg, high: 2.2 * weightKg },
  };
}

export function creatineDose(weightKg: number): { loading: number; maintenanceLow: number; maintenanceHigh: number } {
  return {
    loading: 0.3 * weightKg,
    maintenanceLow: 3,
    maintenanceHigh: 5,
  };
}

export type CarbSession = "short" | "endurance" | "ultra";

export function carbDuring(session: CarbSession): { low: number; high: number; note: string } {
  switch (session) {
    case "short":
      return { low: 0, high: 0, note: "不足约 60 分钟通常不必在运动中额外补糖，靠日常饮食即可" };
    case "endurance":
      return { low: 30, high: 60, note: "约 1–2.5 小时：30–60 g/h。ACSM/AND/DC 2016（Thomas）；Jeukendrup 2014" };
    case "ultra":
      return {
        low: 60,
        high: 90,
        note: "超过约 2.5 小时：60–90 g/h，需多种可转运碳水（葡萄糖+果糖）。ACSM/AND/DC 2016（Thomas）；Jeukendrup 2014",
      };
    default: {
      const exhaustive: never = session;
      throw new Error(`未处理的训练时长: ${String(exhaustive)}`);
    }
  }
}

export type CarbDay = "light" | "moderate" | "high" | "veryHigh";

export function carbDaily(weightKg: number, day: CarbDay): { low: number; high: number; note: string } {
  switch (day) {
    case "light":
      return { low: 3 * weightKg, high: 5 * weightKg, note: "低训练量或休息日" };
    case "moderate":
      return { low: 5 * weightKg, high: 7 * weightKg, note: "约每天 1 小时中等训练" };
    case "high":
      return { low: 6 * weightKg, high: 10 * weightKg, note: "每天 1–3 小时" };
    case "veryHigh":
      return { low: 8 * weightKg, high: 12 * weightKg, note: "极量耐力日（每天 4–5 小时以上），8–12 g/kg 以维持肌糖原。ACSM/AND/DC 2016" };
    default: {
      const exhaustive: never = day;
      throw new Error(`未处理的日训练量: ${String(exhaustive)}`);
    }
  }
}

export const DEFAULT_GEL_GRAMS = 25;
export const MAX_RACE_MINUTES = 24 * 60;

/** Thomas 2016 Table 2 duration bands for carbohydrate during exercise. */
export type RaceCarbBand = "none" | "rinse" | "moderate" | "high";

export interface GelSchedule {
  gramsPerGel: number;
  countLow: number;
  countHigh: number;
  /** Minutes between gels at the high rate (shorter) and the low rate (longer), rounded to 5 min. */
  intervalShortMin: number;
  intervalLongMin: number;
}

export type RaceFluid =
  | { status: "noSweat" }
  | { status: "noWeight"; maxLitersPerHour: number }
  | {
      status: "ok";
      allowableLossKg: number;
      minLitersPerHour: number;
      maxLitersPerHour: number;
      minTotalL: number;
      maxTotalL: number;
    };

export interface RaceFuelPlan {
  minutes: number;
  /** 1–4 g/kg 1–4 h before; Thomas 2016 lists it for exercise > 60 min. */
  pre: { applies: boolean; lowG: number; highG: number } | null;
  /** 10–12 g/kg/24 h for 36–48 h; only for events > 90 min. */
  carbLoading: { lowG: number; highG: number } | null;
  carbLoadingApplies: boolean;
  during: {
    band: RaceCarbBand;
    lowPerHour: number;
    highPerHour: number;
    lowTotal: number;
    highTotal: number;
    gels: GelSchedule | null;
  };
  fluid: RaceFluid;
}

function duringBand(minutes: number): { band: RaceCarbBand; low: number; high: number } {
  if (minutes < 45) return { band: "none", low: 0, high: 0 };
  if (minutes < 75) return { band: "rinse", low: 0, high: 0 };
  if (minutes <= 150) return { band: "moderate", low: 30, high: 60 };
  return { band: "high", low: 60, high: 90 };
}

/**
 * Short interval (upper g/h) rounds up and long interval (lower g/h) rounds down to 5 min,
 * so the rounded schedule never leaves the g/h band; falls back to whole minutes if 5-min steps don't fit.
 */
function gelIntervals(gramsPerGel: number, lowPerHour: number, highPerHour: number): { short: number; long: number } {
  const exactShort = (gramsPerGel / highPerHour) * 60;
  const exactLong = (gramsPerGel / lowPerHour) * 60;
  const short5 = Math.ceil(exactShort / 5 - 1e-9) * 5;
  const long5 = Math.floor(exactLong / 5 + 1e-9) * 5;
  if (long5 >= 5 && short5 <= long5) return { short: short5, long: long5 };
  return { short: Math.max(1, Math.ceil(exactShort - 1e-9)), long: Math.max(1, Math.floor(exactLong + 1e-9)) };
}

function gelSchedule(lowTotal: number, highTotal: number, lowPerHour: number, highPerHour: number, gramsPerGel: number): GelSchedule {
  let countLow = Math.ceil(lowTotal / gramsPerGel - 1e-9);
  let countHigh = Math.floor(highTotal / gramsPerGel + 1e-9);
  if (countLow > countHigh) {
    const mid = Math.max(1, Math.round((lowTotal + highTotal) / 2 / gramsPerGel));
    countLow = mid;
    countHigh = mid;
  }
  const interval = gelIntervals(gramsPerGel, lowPerHour, highPerHour);
  return {
    gramsPerGel,
    countLow: Math.max(1, countLow),
    countHigh: Math.max(1, countHigh),
    intervalShortMin: interval.short,
    intervalLongMin: interval.long,
  };
}

/**
 * Race-day fueling plan from expected duration. Weight and sweat rate are optional;
 * returns null when the duration is not in (0, 24 h].
 */
export function raceFuelPlan(args: {
  minutes: number;
  weightKg: number | null;
  sweatLitersPerHour: number | null;
  gelGrams?: number | null;
}): RaceFuelPlan | null {
  const { minutes } = args;
  if (!Number.isFinite(minutes) || !(minutes > 0) || minutes > MAX_RACE_MINUTES) return null;
  const kg = args.weightKg !== null && Number.isFinite(args.weightKg) && args.weightKg > 0 ? args.weightKg : null;
  const gelGrams =
    args.gelGrams !== null && args.gelGrams !== undefined && Number.isFinite(args.gelGrams) && args.gelGrams > 0
      ? args.gelGrams
      : DEFAULT_GEL_GRAMS;
  const hours = minutes / 60;

  const band = duringBand(minutes);
  const lowTotal = band.low * hours;
  const highTotal = band.high * hours;
  const gels = band.high > 0 ? gelSchedule(lowTotal, highTotal, band.low, band.high, gelGrams) : null;

  const carbLoadingApplies = minutes > 90;

  let fluid: RaceFluid;
  const sweat = args.sweatLitersPerHour;
  if (sweat === null || !Number.isFinite(sweat) || !(sweat > 0)) {
    fluid = { status: "noSweat" };
  } else if (kg === null) {
    fluid = { status: "noWeight", maxLitersPerHour: sweat };
  } else {
    const allowableLossKg = 0.02 * kg;
    const minLitersPerHour = Math.max(0, sweat - allowableLossKg / hours);
    fluid = {
      status: "ok",
      allowableLossKg,
      minLitersPerHour,
      maxLitersPerHour: sweat,
      minTotalL: minLitersPerHour * hours,
      maxTotalL: sweat * hours,
    };
  }

  return {
    minutes,
    pre: kg === null ? null : { applies: minutes > 60, lowG: 1 * kg, highG: 4 * kg },
    carbLoading: kg === null ? null : { lowG: 10 * kg, highG: 12 * kg },
    carbLoadingApplies,
    during: { band: band.band, lowPerHour: band.low, highPerHour: band.high, lowTotal, highTotal, gels },
    fluid,
  };
}

export type RaceDuration = { status: "empty" } | { status: "invalid" } | { status: "valid"; minutes: number };

/** 小时 + 分钟两个字段（留空 = 0）。小时 0–24，分钟 0–<60，合计须在 (0, 24 h]。 */
export function raceMinutesFromParts(hours: number | null, minutes: number | null): RaceDuration {
  if (hours === null && minutes === null) return { status: "empty" };
  const h = hours ?? 0;
  const m = minutes ?? 0;
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 24 || m < 0 || m >= 60) return { status: "invalid" };
  const total = h * 60 + m;
  if (!(total > 0) || total > MAX_RACE_MINUTES) return { status: "invalid" };
  return { status: "valid", minutes: total };
}

export type DiyIngredientChoice = IngredientId | "glucoseSucrose1to1";

/**
 * Ingredient choice → planRecipe parts. 「葡萄糖 + 白砂糖 1:1（按质量）」用一水葡萄糖：
 * 碳水份额取各自碳水比例，使两者克数相等。混合预设不使用标签值。
 */
export function diyRecipeParts(choice: DiyIngredientChoice, labelCarbPer100g?: number): RecipePart[] | null {
  if (choice === "glucoseSucrose1to1") {
    const glucose = resolveIngredient("dextroseMonohydrate");
    const sucrose = resolveIngredient("sucrose");
    if (!glucose || !sucrose) return null;
    return [
      { ingredient: "dextroseMonohydrate", carbShare: glucose.carbFraction },
      { ingredient: "sucrose", carbShare: sucrose.carbFraction },
    ];
  }
  if (resolveIngredient(choice, labelCarbPer100g) === null) return null;
  return [labelCarbPer100g === undefined ? { ingredient: choice } : { ingredient: choice, labelCarbPer100g }];
}

/** 比赛日补给全程碳水的中点；没有赛中碳水时为 null。 */
export function raceCarbMidpoint(plan: RaceFuelPlan | null): number | null {
  if (!plan || !(plan.during.highTotal > 0)) return null;
  return (plan.during.lowTotal + plan.during.highTotal) / 2;
}

/** 「按体重」表里的运动中碳水：填了有效比赛时长时跟随比赛日补给，避免两处数字矛盾。 */
export function duringCarbRow(session: CarbSession, plan: RaceFuelPlan | null): { text: string; note: string; fromRace: boolean } {
  if (plan) {
    const d = plan.during;
    switch (d.band) {
      case "none":
        return { text: "不必额外补糖", note: "按比赛日预计时长：不足 45 分钟，赛前吃好即可", fromRace: true };
      case "rinse":
        return { text: "少量 / 含漱", note: "按比赛日预计时长：45–75 分钟，少量运动饮料或含漱", fromRace: true };
      case "moderate":
      case "high":
        return { text: `${d.lowPerHour}–${d.highPerHour} g/h`, note: "按比赛日预计时长，详见比赛日补给。ACSM/AND/DC 2016（Thomas）表 2", fromRace: true };
      default: {
        const exhaustive: never = d.band;
        throw new Error(`未处理的时长档: ${String(exhaustive)}`);
      }
    }
  }
  const s = carbDuring(session);
  return { text: s.high === 0 ? "不必额外补糖" : `${s.low}–${s.high} g/h`, note: s.note, fromRace: false };
}

/**
 * 每份碳水超过此值时提示「比常见市售能量胶大」。产品标签观察（非文献推荐值）：
 * 常见单支约 20–30 g 碳水，高碳款约 40 g。
 */
export const LARGE_GEL_CARB_G = 40;

/** 碳水浓度超过 CONCENTRATED_PCT 视为自制胶，按「做几支 × 每支碳水」规划。 */
export function isGelConcentration(concentrationPct: number): boolean {
  return concentrationPct > CONCENTRATED_PCT + 1e-9;
}

export type DiyCarbTarget =
  | { mode: "drink"; carbGrams: number; totalSource: "user" | "race"; servings: number | null }
  | {
      mode: "gel";
      carbGrams: number;
      count: number;
      countSource: "user" | "race";
      perGelCarbG: number;
      perGelSource: "user" | "race" | "default";
      largerThanCommercial: boolean;
    }
  | { mode: "drink"; carbGrams: null; missing: "total" }
  | { mode: "gel"; carbGrams: null; missing: "count" }
  | { mode: "drink" | "gel"; carbGrams: null; missing: "badServings" };

/**
 * 自制补给的总碳水。饮料浓度：用户填的总碳水，留空取比赛日全程中点。
 * 胶浓度：做几支（留空取比赛日能量胶支数下限）× 每支碳水（留空取比赛日每支能量胶克数，再不行 25 g）。
 */
export function diyCarbTarget(args: {
  concentrationPct: number;
  totalCarbG: number | null;
  servings: number | null;
  perGelCarbG: number | null;
  plan: RaceFuelPlan | null;
}): DiyCarbTarget {
  const servings = args.servings;
  const servingsOk = servings === null || (Number.isInteger(servings) && servings >= 1);
  if (!isGelConcentration(args.concentrationPct)) {
    if (!servingsOk) return { mode: "drink", carbGrams: null, missing: "badServings" };
    const user = args.totalCarbG !== null && args.totalCarbG > 0 ? args.totalCarbG : null;
    const total = user ?? raceCarbMidpoint(args.plan);
    if (total === null) return { mode: "drink", carbGrams: null, missing: "total" };
    return { mode: "drink", carbGrams: total, totalSource: user !== null ? "user" : "race", servings };
  }
  if (!servingsOk) return { mode: "gel", carbGrams: null, missing: "badServings" };
  const raceGels = args.plan?.during.gels ?? null;
  const count = servings ?? raceGels?.countLow ?? null;
  if (count === null) return { mode: "gel", carbGrams: null, missing: "count" };
  const userPer = args.perGelCarbG !== null && args.perGelCarbG > 0 ? args.perGelCarbG : null;
  const perGelCarbG = userPer ?? raceGels?.gramsPerGel ?? DEFAULT_GEL_GRAMS;
  const perGelSource = userPer !== null ? "user" : raceGels ? "race" : "default";
  return {
    mode: "gel",
    carbGrams: count * perGelCarbG,
    count,
    countSource: servings !== null ? "user" : "race",
    perGelCarbG,
    perGelSource,
    largerThanCommercial: perGelCarbG > LARGE_GEL_CARB_G,
  };
}

export function sweatRateLitersPerHour(args: {
  preKg: number;
  postKg: number;
  fluidL: number;
  urineL: number;
  hours: number;
}): number {
  const loss = args.preKg - args.postKg + args.fluidL - args.urineL;
  return loss / args.hours;
}

/** 数据核对阈值（与 diyfuel 汗钠计算的上限一致），不是生理极限。 */
export const MAX_PLAUSIBLE_SWEAT_L_PER_H = 6;

export type SweatResult =
  | { ok: true; litersPerHour: number; bodyMassChangePct: number }
  | { ok: false; reason: string };

export function sweatTest(args: {
  preKg: number;
  postKg: number;
  fluidL: number;
  urineL: number;
  minutes: number;
}): SweatResult {
  if (!(args.preKg > 0) || !(args.postKg > 0)) {
    return { ok: false, reason: "运动前、后体重都必须大于 0。" };
  }
  if (!(args.minutes > 0)) return { ok: false, reason: "运动时间必须大于 0。" };
  if (args.fluidL < 0 || args.urineL < 0) return { ok: false, reason: "饮水量和尿量不能为负。" };
  const litersPerHour = sweatRateLitersPerHour({
    preKg: args.preKg,
    postKg: args.postKg,
    fluidL: args.fluidL,
    urineL: args.urineL,
    hours: args.minutes / 60,
  });
  if (litersPerHour < 0) {
    return { ok: false, reason: "数据矛盾，请核对：算出的出汗量为负（体重增加超过了喝进去的量）。" };
  }
  if (litersPerHour > MAX_PLAUSIBLE_SWEAT_L_PER_H) {
    return {
      ok: false,
      reason: `算出的出汗率超过 ${MAX_PLAUSIBLE_SWEAT_L_PER_H} L/h，远高于文献报告（Baker 2017：通常约 0.5–2 L/h，超过 3 L/h 少见），请核对体重、饮水和时间。`,
    };
  }
  return {
    ok: true,
    litersPerHour,
    bodyMassChangePct: ((args.preKg - args.postKg) / args.preKg) * 100,
  };
}
