export type RaceDistance = "10k" | "half" | "full";

export const RACE_METERS: Record<RaceDistance, number> = {
  "10k": 10000,
  half: 21097.5,
  full: 42195,
};

/** Race-back only covers 10K and longer; 5 km and unknown distances return null. */
export function raceDistanceFromMeters(meters: number): RaceDistance | null {
  for (const key of Object.keys(RACE_METERS) as RaceDistance[]) {
    if (Math.abs(RACE_METERS[key] - meters) < 1) return key;
  }
  return null;
}

export function assertNever(value: never): never {
  throw new Error(`未处理的分支: ${String(value)}`);
}

/** Empirical rule of thumb (LT1 20–25% slower than LT2); no single primary source. */
export function lt1PaceFromLt2(lt2SecPerKm: number): { fast: number; slow: number } {
  return {
    fast: lt2SecPerKm * 1.2,
    slow: lt2SecPerKm * 1.25,
  };
}

export function raceToLt2Pace(distance: RaceDistance, raceSecPerKm: number): {
  faster: number;
  slower: number;
  note: string;
} {
  switch (distance) {
    case "10k":
      return {
        faster: raceSecPerKm + 5,
        slower: raceSecPerKm + 10,
        note: "10K 略快于 LT2，配速加 5–10 秒/km",
      };
    case "half":
      return {
        faster: raceSecPerKm,
        slower: raceSecPerKm,
        note: "半马平均配速最接近 LT2",
      };
    case "full":
      return {
        faster: raceSecPerKm - 15,
        slower: raceSecPerKm - 10,
        note: "全马慢于 LT2，配速减 10–15 秒/km（经验规则）",
      };
    default:
      return assertNever(distance);
  }
}

export function raceToLt2Hr(distance: RaceDistance, avgHr: number): {
  low: number;
  high: number;
  note: string;
} {
  switch (distance) {
    case "10k":
      return {
        low: avgHr - 5,
        high: avgHr - 3,
        note: "10K 平均心率减 3–5 bpm",
      };
    case "half":
      return {
        low: avgHr,
        high: avgHr,
        note: "半马平均心率 ≈ LT2 心率",
      };
    case "full":
      return {
        low: avgHr + 5,
        high: avgHr + 8,
        note: "全马平均心率加 5–8 bpm",
      };
    default:
      return assertNever(distance);
  }
}

export function paceFromRace(distance: RaceDistance, timeMinutes: number): number {
  const km = RACE_METERS[distance] / 1000;
  return (timeMinutes * 60) / km;
}
