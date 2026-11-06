export const RPE_MIN = 0;
export const RPE_MAX = 10;
export const MINUTES_MAX = 600;
/** Commonly cited high-monotony line (Foster 1998 spikes >2.0); Foster's own illness thresholds were individual. */
export const MONOTONY_FLAG = 2;

/** Session load in arbitrary units (AU): CR-10 session RPE × session minutes (Foster 2001). */
export function sessionLoad(rpe: number, minutes: number): number {
  return rpe * minutes;
}

export type DayEntry =
  | { status: "empty" }
  | { status: "ok"; rpe: number; minutes: number; load: number }
  | { status: "error"; message: string; rpeInvalid: boolean; minutesInvalid: boolean };

/** Validates one day's pair of inputs; `day` is 1-based for messages. Both blank = rest day. */
export function readDay(day: number, rpe: number | null, minutes: number | null): DayEntry {
  if (rpe === null && minutes === null) return { status: "empty" };
  const rpeBad = rpe !== null && (rpe < RPE_MIN || rpe > RPE_MAX);
  const minutesBad = minutes !== null && (minutes <= 0 || minutes > MINUTES_MAX);
  if (rpeBad || minutesBad) {
    const parts: string[] = [];
    if (rpeBad) parts.push(`RPE 应在 ${RPE_MIN}–${RPE_MAX}`);
    if (minutesBad) parts.push(`分钟应大于 0 且不超过 ${MINUTES_MAX}`);
    return {
      status: "error",
      message: `第 ${day} 天 ${parts.join("，")}`,
      rpeInvalid: rpeBad,
      minutesInvalid: minutesBad,
    };
  }
  if (minutes === null) {
    return { status: "error", message: `第 ${day} 天还差分钟`, rpeInvalid: false, minutesInvalid: true };
  }
  if (rpe === null) {
    return { status: "error", message: `第 ${day} 天还差 RPE`, rpeInvalid: true, minutesInvalid: false };
  }
  return { status: "ok", rpe, minutes, load: sessionLoad(rpe, minutes) };
}

export interface WeekSummary {
  total: number;
  mean: number;
  /** Population SD over all days, rest days counted as 0. */
  sd: number;
  /** null when SD is 0 (every day identical, including all-rest weeks). */
  monotony: number | null;
  strain: number | null;
}

/** Foster 1998: monotony = daily mean / SD over the week; strain = weekly load × monotony. */
export function weekSummary(daily: readonly number[]): WeekSummary {
  const n = daily.length;
  const total = daily.reduce((sum, value) => sum + value, 0);
  const mean = n > 0 ? total / n : 0;
  const variance = n > 0 ? daily.reduce((sum, value) => sum + (value - mean) ** 2, 0) / n : 0;
  const sd = Math.sqrt(variance);
  if (sd <= 1e-9 * Math.max(1, Math.abs(mean))) {
    return { total, mean, sd: 0, monotony: null, strain: null };
  }
  const monotony = mean / sd;
  return { total, mean, sd, monotony, strain: total * monotony };
}

export function isHighMonotony(monotony: number | null): boolean {
  return monotony !== null && monotony > MONOTONY_FLAG;
}
