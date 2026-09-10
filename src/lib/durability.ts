export function decouplingPercent(earlyRatio: number, lateRatio: number): number {
  return (lateRatio / earlyRatio - 1) * 100;
}

/** Internal/external: HR per unit speed (m/s) or watts. */
export function workRatio(hr: number, external: number): number | null {
  if (external <= 0 || hr <= 0) return null;
  return hr / external;
}
