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

/** Race time (minutes) that the Daniels–Gilbert curves predict for this VDOT. */
export function predictRaceMinutes(vdot: number, distanceMeters: number): number {
  // vdotFromRace decreases monotonically with time, so bisect on time.
  let fast = distanceMeters / 1000;
  let slow = distanceMeters / 50;
  for (let i = 0; i < 80; i += 1) {
    const mid = (fast + slow) / 2;
    if (vdotFromRace(distanceMeters, mid) > vdot) fast = mid;
    else slow = mid;
  }
  return (fast + slow) / 2;
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
  marathon: number;
  threshold: number;
  interval: number;
};

/** Training paces in sec/km. */
export function vdotTrainingPaces(vdot: number): VdotTrainingPaces {
  return {
    easy: {
      slow: paceAtVdotPercent(vdot, VDOT_FRACTIONS.easySlow),
      fast: paceAtVdotPercent(vdot, VDOT_FRACTIONS.easyFast),
    },
    marathon: (predictRaceMinutes(vdot, 42195) * 60 * 1000) / 42195,
    threshold: paceAtVdotPercent(vdot, VDOT_FRACTIONS.threshold),
    interval: paceAtVdotPercent(vdot, VDOT_FRACTIONS.interval),
  };
}
