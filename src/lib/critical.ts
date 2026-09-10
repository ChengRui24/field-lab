export type Trial = { timeMinutes: number; output: number };

export function criticalFromTrials(trials: Trial[]): { critical: number; workPrime: number } | null {
  const valid = trials.filter((trial) => trial.timeMinutes > 0 && trial.output > 0);
  if (valid.length < 2) return null;

  const xs = valid.map((trial) => 1 / trial.timeMinutes);
  const ys = valid.map((trial) => trial.output);
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const workPrime = (n * sumXY - sumX * sumY) / denom;
  const critical = (sumY - workPrime * sumX) / n;
  if (!Number.isFinite(critical) || !Number.isFinite(workPrime)) return null;
  return { critical, workPrime };
}

export function ftpFrom20min(watts: number): number {
  return watts * 0.95;
}

export function cssWakayoshi(time200Sec: number, time400Sec: number): number | null {
  const delta = time400Sec - time200Sec;
  if (delta <= 0) return null;
  return 200 / delta;
}

export function speedToPaceSec(speedMPerSec: number): number {
  return 1000 / speedMPerSec;
}

export function paceToSpeed(secPerKm: number): number {
  return 1000 / secPerKm;
}
