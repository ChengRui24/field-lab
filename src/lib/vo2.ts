import { assertNever } from "./threshold";

export function cooperVo2(distanceMeters: number): number {
  return (distanceMeters - 504.9) / 44.73;
}

/** 1.5-mile (2414 m) run test; time in minutes. */
export function mile15Vo2(timeMinutes: number): number {
  return 3.5 + 483 / timeMinutes;
}

export function rockportVo2(args: {
  weightKg: number;
  age: number;
  sex: "male" | "female";
  timeMinutes: number;
  endingHr: number;
}): number {
  const weightLb = args.weightKg * 2.205;
  const sex = args.sex === "male" ? 1 : 0;
  return (
    132.853 -
    0.0769 * weightLb -
    0.3877 * args.age +
    6.315 * sex -
    3.2649 * args.timeMinutes -
    0.1565 * args.endingHr
  );
}

export function stepTestVo2(sex: "male" | "female", recoveryHr: number): number {
  switch (sex) {
    case "male":
      return 111.33 - 0.42 * recoveryHr;
    case "female":
      return 65.81 - 0.1847 * recoveryHr;
    default:
      return assertNever(sex);
  }
}

/** Daniels 1979: running VO₂ from speed in m/min. */
export function runningVo2(speedMPerMin: number): number {
  return -4.6 + 0.182258 * speedMPerMin + 0.000104 * speedMPerMin * speedMPerMin;
}

/** Fraction of VO₂max sustainable for duration t (minutes). */
export function sustainFraction(timeMinutes: number): number {
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * timeMinutes) +
    0.2989558 * Math.exp(-0.1932605 * timeMinutes)
  );
}

export function vdotFromRace(distanceMeters: number, timeMinutes: number): number {
  const speed = distanceMeters / timeMinutes;
  return runningVo2(speed) / sustainFraction(timeMinutes);
}

/** Inverse of runningVo2: speed in m/min. */
export function speedFromVo2(vo2: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - vo2;
  const disc = b * b - 4 * a * c;
  return (-b + Math.sqrt(disc)) / (2 * a);
}

/** Pace (sec/km) at a fraction of VDOT on the running VO₂ cost curve. */
export function paceAtVdotPercent(vdot: number, percent: number): number {
  const speed = speedFromVo2(vdot * percent);
  return 60000 / speed;
}

/**
 * Race time (minutes) that the Daniels–Gilbert curves predict for this VDOT, or null when
 * the answer lies outside 60 km/h … 3 km/h (the bisection bracket) instead of a clamped bound.
 */
export function predictRaceMinutes(vdot: number, distanceMeters: number): number | null {
  if (!Number.isFinite(vdot) || !(distanceMeters > 0)) return null;
  // vdotFromRace decreases monotonically with time, so bisect on time.
  let fast = distanceMeters / 1000;
  let slow = distanceMeters / 50;
  if (vdot > vdotFromRace(distanceMeters, fast) || vdot < vdotFromRace(distanceMeters, slow)) return null;
  for (let i = 0; i < 80; i += 1) {
    const mid = (fast + slow) / 2;
    if (vdotFromRace(distanceMeters, mid) > vdot) fast = mid;
    else slow = mid;
  }
  return (fast + slow) / 2;
}

/** Range covered by Daniels' published VDOT tables; outside it the result is not a usable VDOT. */
export const VDOT_PLAUSIBLE = { min: 20, max: 90 } as const;

/** Slowest average pace (sec/km) still treated as a race effort. */
export const SLOWEST_RACE_PACE = 12 * 60;

/** Men's road/track world records (seconds); a faster entry is a wrong distance or typo. */
export const WORLD_RECORD_SEC: Readonly<Record<number, number>> = {
  5000: 12 * 60 + 35,
  10000: 26 * 60 + 11,
  21097.5: 56 * 60 + 42,
  42195: 2 * 3600 + 35,
};

export type VdotReading =
  | { status: "ok"; vdot: number }
  | { status: "implausible"; vdot: number | null };

/** VDOT for a race, or "implausible" when the time and distance cannot belong together. */
export function readVdot(distanceMeters: number, timeMinutes: number): VdotReading {
  if (!(distanceMeters > 0) || !(timeMinutes > 0)) return { status: "implausible", vdot: null };
  const pace = (timeMinutes * 60 * 1000) / distanceMeters;
  const record = WORLD_RECORD_SEC[distanceMeters];
  const vdot = vdotFromRace(distanceMeters, timeMinutes);
  if (
    pace > SLOWEST_RACE_PACE ||
    (record !== undefined && timeMinutes * 60 < record) ||
    !Number.isFinite(vdot) ||
    vdot < VDOT_PLAUSIBLE.min ||
    vdot > VDOT_PLAUSIBLE.max
  ) {
    return { status: "implausible", vdot: Number.isFinite(vdot) ? vdot : null };
  }
  return { status: "ok", vdot };
}

export const MILE_METERS = 1609.344;

export const EQUIVALENT_RACE_DISTANCES = [
  { meters: 5000, label: "5 km" },
  { meters: 10000, label: "10 km" },
  { meters: 21097.5, label: "半马" },
  { meters: 42195, label: "全马" },
] as const;

export type EquivalentRace = {
  meters: number;
  label: string;
  minutes: number;
  /** Average pace in sec/km. */
  pace: number;
};

/** Race times the same VDOT predicts at standard distances (Daniels–Gilbert); unsolvable ones are omitted. */
export function equivalentRaces(vdot: number): EquivalentRace[] {
  return EQUIVALENT_RACE_DISTANCES.flatMap(({ meters, label }) => {
    const minutes = predictRaceMinutes(vdot, meters);
    if (minutes === null) return [];
    return [{ meters, label, minutes, pace: (minutes * 60 * 1000) / meters }];
  });
}

/**
 * Fractions of VDOT fitted to Daniels' Running Formula training-pace table
 * (VDOT 30–70, within ~3 s/km). M is not a fixed fraction: it is the predicted marathon pace.
 */
export const VDOT_FRACTIONS = {
  easySlow: 0.632,
  easyFast: 0.729,
  threshold: 0.88,
  interval: 0.975,
} as const;

export type VdotTrainingPaces = {
  easy: { slow: number; fast: number };
  /** Null only when the marathon time cannot be solved (VDOT far outside the tables). */
  marathon: number | null;
  threshold: number;
  interval: number;
  /** Daniels R ≈ current mile race pace; null when unsolvable. Within ~2 s/400 m of his table (VDOT 30–70). */
  repetition: number | null;
};

function racePace(vdot: number, meters: number): number | null {
  const minutes = predictRaceMinutes(vdot, meters);
  return minutes === null ? null : (minutes * 60 * 1000) / meters;
}

/** Training paces in sec/km. */
export function vdotTrainingPaces(vdot: number): VdotTrainingPaces {
  return {
    easy: {
      slow: paceAtVdotPercent(vdot, VDOT_FRACTIONS.easySlow),
      fast: paceAtVdotPercent(vdot, VDOT_FRACTIONS.easyFast),
    },
    marathon: racePace(vdot, 42195),
    threshold: paceAtVdotPercent(vdot, VDOT_FRACTIONS.threshold),
    interval: paceAtVdotPercent(vdot, VDOT_FRACTIONS.interval),
    repetition: racePace(vdot, MILE_METERS),
  };
}
