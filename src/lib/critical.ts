export type Trial = { timeMinutes: number; output: number };

export type CriticalFit = { critical: number; workPrime: number; trialCount: number };

export function criticalFromTrials(trials: Trial[]): CriticalFit | null {
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
  if (Math.abs(denom) < 1e-12) return null;
  const workPrime = (n * sumXY - sumX * sumY) / denom;
  const critical = (sumY - workPrime * sumX) / n;
  if (!Number.isFinite(critical) || !Number.isFinite(workPrime)) return null;
  return { critical, workPrime, trialCount: n };
}

export type CriticalResult = ({ ok: true } & CriticalFit) | { ok: false; reason: string };

/**
 * Fit with the reasons a user needs when no physiological answer exists.
 * `labels` names the asymptote and curvature constant (CP/W′ or CS/D′).
 */
export function analyzeCriticalTrials(
  trials: Trial[],
  labels: { critical: string; prime: string },
): CriticalResult {
  const valid = trials.filter((trial) => trial.timeMinutes > 0 && trial.output > 0);
  if (valid.length < 2) {
    return { ok: false, reason: "至少需要两次时长、成绩都有效（大于 0）的测试。" };
  }
  const distinctTimes = new Set(valid.map((trial) => trial.timeMinutes.toFixed(6)));
  if (distinctTimes.size < 2) {
    return { ok: false, reason: "测试时长相同，无法拟合。请用时长明显不同的两次测试（例如 3 分钟与 12 分钟）。" };
  }
  const fit = criticalFromTrials(valid);
  if (fit === null) {
    return { ok: false, reason: "无法拟合，请核对时间和成绩。" };
  }
  if (fit.critical <= 0 || fit.workPrime <= 0) {
    return {
      ok: false,
      reason: `拟合得到 ${labels.critical} ≤ 0 或 ${labels.prime} ≤ 0，不符合生理。时长越长、平均输出应越低，请核对数据或确认每次都全力。`,
    };
  }
  return { ok: true, ...fit };
}

/** Running trial as distance (m) over time (min) → mean speed (m/s). */
export function runTrial(distanceM: number, timeMinutes: number): Trial {
  return { timeMinutes, output: distanceM / (timeMinutes * 60) };
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
