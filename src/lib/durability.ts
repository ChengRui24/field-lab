/** Training-practice "worth noticing" line (~5%), not a diagnostic cut-off. */
export const DECOUPLING_FLAG = 5;

/**
 * TrainingPeaks / Friel Pa:HR (Pw:HR): efficiency factor EF = output / HR,
 * decoupling = (EF1 − EF2) / EF1 × 100. With HR/output ratios (= 1/EF) this is
 * 1 − early/late.
 */
export function decouplingPercent(earlyRatio: number, lateRatio: number): number {
  return (1 - earlyRatio / lateRatio) * 100;
}

/** Internal/external: HR per unit speed (m/s) or watts. */
export function workRatio(hr: number, external: number): number | null {
  if (external <= 0 || hr <= 0) return null;
  return hr / external;
}

/** EF = output / HR: speed in m/min per bpm (= metres per heartbeat) or watts per bpm. */
export function efficiencyFactor(output: number, hr: number): number | null {
  if (output <= 0 || hr <= 0) return null;
  return output / hr;
}

/** (EF前 − EF后) / EF前 × 100; positive = less output per heartbeat in the second half. */
export function decouplingFromEf(earlyEf: number, lateEf: number): number {
  return ((earlyEf - lateEf) / earlyEf) * 100;
}
