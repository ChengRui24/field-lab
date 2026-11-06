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
