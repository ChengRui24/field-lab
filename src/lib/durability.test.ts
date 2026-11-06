import { describe, expect, it } from "vitest";
import { paceToSpeed } from "./critical";
import { decouplingPercent, workRatio } from "./durability";

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
