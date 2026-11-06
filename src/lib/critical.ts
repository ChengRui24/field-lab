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

/**
 * Skiba et al. 2012 (MSSE 44:1526) recovery time constant, seconds.
 * `dcp` = CP − recovery power (W). Fitted on 7 cyclists doing 60 s on / 30 s off.
 */
export function skibaTau(dcp: number): number {
  return 546 * Math.exp(-0.01 * dcp) + 316;
}

/**
 * Skiba integral W′bal, 1 Hz: S(t) = S(t−1)·e^(−1/τ) + max(0, P(t) − CP), W′bal = W′ − S.
 * Returns W′bal (J) after each second.
 */
export function wPrimeBalance(powers: readonly number[], cp: number, wPrimeJ: number, tauSec: number): number[] {
  const decay = Math.exp(-1 / tauSec);
  let spent = 0;
  return powers.map((power) => {
    spent = spent * decay + Math.max(0, power - cp);
    return wPrimeJ - spent;
  });
}

export const INTERVAL_MAX_REPS = 60;
export const INTERVAL_MAX_SEC = 3 * 3600;

export type IntervalInput = {
  cp: number | null;
  wPrimeKj: number | null;
  workPower: number | null;
  workSec: number | null;
  restSec: number | null;
  /** Blank → 50 % of CP. */
  restPower?: number | null;
  plannedReps?: number | null;
};

export type IntervalRep = {
  rep: number;
  /** W′bal (J) at the end of the work bout, or at the moment it hit 0. */
  afterWorkJ: number;
  /** W′bal (J) at the end of the rest; null when the rep was not completed. */
  afterRestJ: number | null;
  /** Second of the work bout (1-based) at which W′bal ≤ 0; null when the bout was completed. */
  exhaustedAtSec: number | null;
};

export type IntervalDesign =
  | {
      ok: true;
      wPrimeJ: number;
      tauSec: number;
      dcp: number;
      restPower: number;
      restPowerAssumed: boolean;
      /** Reps simulated when no plan is given (≤ 60 reps and ≤ 3 h). */
      capReps: number;
      plannedReps: number | null;
      reps: IntervalRep[];
      /** Work bouts finished with W′bal > 0. */
      fullReps: number;
      exhausted: boolean;
    }
  | { ok: false; reason: string };

export function designIntervals(input: IntervalInput): IntervalDesign {
  const { cp, wPrimeKj, workPower, workSec, restSec } = input;
  if (cp === null || wPrimeKj === null || !(cp > 0) || !(wPrimeKj > 0)) {
    return { ok: false, reason: "先做上方测试或填入已知 CP / W′。" };
  }
  if (workPower === null || workSec === null || restSec === null || !(workPower > 0)) {
    return { ok: false, reason: "填入间歇功率、每组做和每组歇三项。" };
  }
  if (!(workSec > 0) || !(restSec > 0)) {
    return { ok: false, reason: "每组做和每组歇都要大于 0 秒。" };
  }
  if (workPower <= cp) {
    return {
      ok: false,
      reason: `间歇功率 ${Math.round(workPower)} W 未超过 CP（${Math.round(cp)} W）。低于 CP，理论上不消耗 W′，可持续时间由其他因素决定。`,
    };
  }
  const restPowerAssumed = input.restPower === null || input.restPower === undefined;
  const restPower = restPowerAssumed ? cp * 0.5 : (input.restPower as number);
  if (restPower < 0) {
    return { ok: false, reason: "歇时功率不能为负。" };
  }
  if (restPower >= cp) {
    return {
      ok: false,
      reason: `歇时功率 ${Math.round(restPower)} W 不低于 CP（${Math.round(cp)} W）。模型里歇时不恢复 W′，这已不是间歇。`,
    };
  }
  const planned = input.plannedReps ?? null;
  if (planned !== null && !(Number.isInteger(planned) && planned >= 1 && planned <= INTERVAL_MAX_REPS)) {
    return { ok: false, reason: `计划组数请填 1–${INTERVAL_MAX_REPS} 的整数，或留空。` };
  }

  const work = Math.max(1, Math.round(workSec));
  const rest = Math.max(1, Math.round(restSec));
  const wPrimeJ = wPrimeKj * 1000;
  const dcp = cp - restPower;
  const tauSec = skibaTau(dcp);
  const decay = Math.exp(-1 / tauSec);
  const capReps = Math.max(1, Math.min(INTERVAL_MAX_REPS, Math.floor(INTERVAL_MAX_SEC / (work + rest))));
  const target = planned ?? capReps;
  const workExp = workPower - cp;

  const reps: IntervalRep[] = [];
  let spent = 0;
  let exhausted = false;
  for (let rep = 1; rep <= target && !exhausted; rep++) {
    let exhaustedAtSec: number | null = null;
    for (let s = 1; s <= work; s++) {
      spent = spent * decay + workExp;
      if (wPrimeJ - spent <= 0) {
        exhaustedAtSec = s;
        break;
      }
    }
    const afterWorkJ = wPrimeJ - spent;
    if (exhaustedAtSec !== null) {
      exhausted = true;
      reps.push({ rep, afterWorkJ, afterRestJ: null, exhaustedAtSec });
      break;
    }
    spent *= decay ** rest;
    reps.push({ rep, afterWorkJ, afterRestJ: wPrimeJ - spent, exhaustedAtSec: null });
  }

  return {
    ok: true,
    wPrimeJ,
    tauSec,
    dcp,
    restPower,
    restPowerAssumed,
    capReps,
    plannedReps: planned,
    reps,
    fullReps: reps.filter((rep) => rep.exhaustedAtSec === null).length,
    exhausted,
  };
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
