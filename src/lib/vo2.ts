import { assertNever } from "./threshold";

export function cooperVo2(distanceMeters: number): number {
  return (distanceMeters - 504.9) / 44.73;
}

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

export function speedFromVo2(vo2: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - vo2;
  const disc = b * b - 4 * a * c;
  return (-b + Math.sqrt(disc)) / (2 * a);
}

export const VDOT_PACE_ZONES = [
  { id: "E", name: "E Easy / 轻松", low: 0.59, high: 0.74, meaning: "有氧基础" },
  { id: "M", name: "M Marathon / 马拉松配速", low: 0.75, high: 0.84, meaning: "全马比赛配速" },
  { id: "T", name: "T Threshold / 阈值", low: 0.83, high: 0.88, meaning: "乳酸阈" },
  { id: "I", name: "I Interval / 间歇", low: 0.95, high: 1, meaning: "最大摄氧量" },
] as const;

export function paceAtVdotPercent(vdot: number, percent: number): number {
  const speed = speedFromVo2(vdot * percent);
  return 1000 / speed;
}