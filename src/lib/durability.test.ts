import { describe, expect, it } from "vitest";
import { paceToSpeed } from "./critical";
import { decouplingFromEf, decouplingPercent, efficiencyFactor, workRatio } from "./durability";

describe("Pa:HR / Pw:HR decoupling", () => {
  it("200 W @ 140 → 200 W @ 147 = 4.76%", () => {
    const pct = decouplingPercent(workRatio(140, 200)!, workRatio(147, 200)!);
    expect(pct).toBeCloseTo(4.76, 2);
  });

  it("5:20 → 5:28 /km at the same HR = 2.44%", () => {
    const pct = decouplingPercent(workRatio(150, paceToSpeed(320))!, workRatio(150, paceToSpeed(328))!);
    expect(pct).toBeCloseTo(2.44, 2);
  });

  it("zero power has no ratio", () => {
    expect(workRatio(140, 0)).toBeNull();
  });
});

describe("efficiency factor (output / HR)", () => {
  it("5:50 /km @ 142 → 5:52 /km @ 151 = 6.49%", () => {
    // speed 1000 / 5.8333 = 171.43 m/min → EF 1.2072 m/beat; 1000 / 5.8667 = 170.45 → 1.1288
    const early = efficiencyFactor(paceToSpeed(350) * 60, 142)!;
    const late = efficiencyFactor(paceToSpeed(352) * 60, 151)!;
    expect(early).toBeCloseTo(1.2072, 4);
    expect(late).toBeCloseTo(1.1288, 4);
    expect(decouplingFromEf(early, late)).toBeCloseTo(6.49, 2);
  });

  it("matches the HR/output ratio form", () => {
    const viaEf = decouplingFromEf(efficiencyFactor(200, 140)!, efficiencyFactor(200, 147)!);
    expect(viaEf).toBeCloseTo(decouplingPercent(workRatio(140, 200)!, workRatio(147, 200)!), 9);
  });

  it("zero output or HR has no EF", () => {
    expect(efficiencyFactor(0, 140)).toBeNull();
    expect(efficiencyFactor(200, 0)).toBeNull();
  });
});
