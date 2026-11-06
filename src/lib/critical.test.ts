import { describe, expect, it } from "vitest";
import {
  analyzeCriticalTrials,
  cssWakayoshi,
  designIntervals,
  ftpFrom20min,
  runTrial,
  skibaTau,
  wPrimeBalance,
  type IntervalInput,
} from "./critical";

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

describe("W′ balance (Skiba 2012 integral)", () => {
  it("τ(DCP 125) ≈ 472.4 s, τ(DCP 0) = 862 s", () => {
    expect(skibaTau(125)).toBeCloseTo(472.4, 1);
    expect(skibaTau(0)).toBeCloseTo(862, 9);
  });

  it("constant power below CP leaves W′bal at W′", () => {
    const bal = wPrimeBalance(Array(600).fill(240), 250, 20000, skibaTau(10));
    expect(bal.every((v) => v === 20000)).toBe(true);
  });

  it("continuous bout lasting W′/(P−CP) leaves W′bal > 0; exhaustion comes later", () => {
    const linearSec = 20000 / (300 - 250);
    const bal = wPrimeBalance(Array(3000).fill(300), 250, 20000, skibaTau(0));
    expect(bal[linearSec - 1]).toBeGreaterThan(0);
    expect(bal[linearSec - 1]).toBeLessThan(20000);
    const exhaustedSec = bal.findIndex((v) => v <= 0) + 1;
    expect(exhaustedSec).toBeGreaterThan(linearSec);
  });

  const example: IntervalInput = {
    cp: 250,
    wPrimeKj: 20,
    workPower: 300,
    workSec: 60,
    restSec: 30,
    restPower: 125,
  };

  it("CP 250 / W′ 20 kJ, 300 W 60 s on / 30 s off @125 W → not exhausted in 60 reps, plateau ≈ 3.74 kJ", () => {
    const r = designIntervals(example);
    if (!r.ok) throw new Error(r.reason);
    expect(r.tauSec).toBeCloseTo(472.4, 1);
    expect(r.dcp).toBe(125);
    expect(r.capReps).toBe(60);
    expect(r.exhausted).toBe(false);
    expect(r.fullReps).toBe(60);
    expect(r.reps[0].afterWorkJ / 1000).toBeCloseTo(17.18, 2);
    expect(r.reps[59].afterWorkJ / 1000).toBeCloseTo(3.74, 2);
    expect(r.reps[59].afterRestJ! / 1000).toBeCloseTo(4.74, 2);
  });

  it("same session at 350 W → 5 full reps, exhausted in rep 6", () => {
    const r = designIntervals({ ...example, workPower: 350 });
    if (!r.ok) throw new Error(r.reason);
    expect(r.fullReps).toBe(5);
    expect(r.exhausted).toBe(true);
    expect(r.reps[5].exhaustedAtSec).not.toBeNull();
    expect(r.reps[5].afterRestJ).toBeNull();
  });

  it("planned reps: achievable flag via fullReps, W′ left after last work bout", () => {
    const r = designIntervals({ ...example, workPower: 350, plannedReps: 4 });
    if (!r.ok) throw new Error(r.reason);
    expect(r.reps).toHaveLength(4);
    expect(r.exhausted).toBe(false);
    expect(r.reps[3].afterWorkJ).toBeGreaterThan(0);
    const fail = designIntervals({ ...example, workPower: 350, plannedReps: 8 });
    if (!fail.ok) throw new Error(fail.reason);
    expect(fail.exhausted).toBe(true);
    expect(fail.fullReps).toBe(5);
  });

  it("blank rest power → 50 % of CP", () => {
    const r = designIntervals({ ...example, restPower: null });
    if (!r.ok) throw new Error(r.reason);
    expect(r.restPowerAssumed).toBe(true);
    expect(r.restPower).toBe(125);
  });

  const achievable = (input: IntervalInput): number => {
    const r = designIntervals(input);
    if (!r.ok) throw new Error(r.reason);
    return r.exhausted ? r.fullReps : Infinity;
  };

  it("longer rest never reduces achievable reps", () => {
    for (const workPower of [330, 380, 450]) {
      let prev = -1;
      for (const restSec of [10, 20, 30, 60, 90, 120, 180, 300]) {
        const reps = achievable({ ...example, workPower, restSec });
        expect(reps).toBeGreaterThanOrEqual(prev);
        prev = reps;
      }
    }
  });

  it("higher interval power never increases achievable reps", () => {
    for (const restSec of [15, 30, 60, 120]) {
      let prev = Infinity;
      for (let workPower = 260; workPower <= 600; workPower += 20) {
        const reps = achievable({ ...example, workPower, restSec });
        expect(reps).toBeLessThanOrEqual(prev);
        prev = reps;
      }
    }
  });

  it("gives reasons instead of blanks", () => {
    const below = designIntervals({ ...example, workPower: 240 });
    expect(below.ok === false && below.reason).toContain("理论上不消耗 W′");
    const hotRest = designIntervals({ ...example, restPower: 260 });
    expect(hotRest.ok === false && hotRest.reason).toContain("不恢复 W′");
    const missing = designIntervals({ ...example, cp: null });
    expect(missing.ok === false && missing.reason).toContain("先做上方测试或填入已知 CP / W′");
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
