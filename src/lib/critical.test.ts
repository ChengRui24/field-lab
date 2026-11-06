import { describe, expect, it } from "vitest";
import { analyzeCriticalTrials, cssWakayoshi, ftpFrom20min, runTrial } from "./critical";

const CP = { critical: "CP", prime: "W′" };
const CS = { critical: "CS", prime: "D′" };

describe("critical power", () => {
  it("3:00 @ 400 W + 12:00 @ 300 W → CP 266.67 W, W′ 400 W·min (24.0 kJ)", () => {
    const r = analyzeCriticalTrials(
      [
        { timeMinutes: 3, output: 400 },
        { timeMinutes: 12, output: 300 },
      ],
      CP,
    );
    if (!r.ok) throw new Error(r.reason);
    expect(r.critical).toBeCloseTo(266.67, 2);
    expect(r.workPrime).toBeCloseTo(400, 6);
    expect((r.workPrime * 60) / 1000).toBeCloseTo(24.0, 6);
    expect(r.trialCount).toBe(2);
  });

  it("counts only valid trials", () => {
    const r = analyzeCriticalTrials(
      [
        { timeMinutes: 3, output: 400 },
        { timeMinutes: 12, output: 300 },
        { timeMinutes: 6, output: 0 },
      ],
      CP,
    );
    if (!r.ok) throw new Error(r.reason);
    expect(r.trialCount).toBe(2);
  });

  it("equal durations give a reason", () => {
    const r = analyzeCriticalTrials(
      [
        { timeMinutes: 5, output: 350 },
        { timeMinutes: 5, output: 340 },
      ],
      CP,
    );
    expect(r.ok).toBe(false);
  });

  it("longer trial with higher power → W′ ≤ 0 → reason", () => {
    const r = analyzeCriticalTrials(
      [
        { timeMinutes: 3, output: 300 },
        { timeMinutes: 12, output: 320 },
      ],
      CP,
    );
    expect(r.ok).toBe(false);
  });

  it("FTP 250 → 237.5", () => {
    expect(ftpFrom20min(250)).toBeCloseTo(237.5, 6);
  });
});

describe("critical speed", () => {
  it("1200 m 3:40 + 3000 m 10:30 → 4.390 m/s, D′ 234.1 m", () => {
    const r = analyzeCriticalTrials([runTrial(1200, 220 / 60), runTrial(3000, 630 / 60)], CS);
    if (!r.ok) throw new Error(r.reason);
    expect(r.critical).toBeCloseTo(4.39, 3);
    expect(r.workPrime * 60).toBeCloseTo(234.1, 1);
  });
});

describe("CSS Wakayoshi", () => {
  it("200 m 2:20 + 400 m 5:00 → 1.25 m/s, 80.0 s/100 m", () => {
    const css = cssWakayoshi(140, 300)!;
    expect(css).toBeCloseTo(1.25, 6);
    expect(100 / css).toBeCloseTo(80.0, 6);
  });
  it("3:00 + 6:10 → 95.0 s/100 m (1:35.0)", () => {
    const css = cssWakayoshi(180, 370)!;
    expect(100 / css).toBeCloseTo(95.0, 6);
  });
  it("400 m not slower than 200 m → null", () => {
    expect(cssWakayoshi(180, 180)).toBeNull();
    expect(cssWakayoshi(180, 170)).toBeNull();
  });
});
