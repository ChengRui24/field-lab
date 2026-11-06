import { describe, expect, it } from "vitest";
import { lt1PaceFromLt2, paceFromRace, raceToLt2Hr, raceToLt2Pace } from "./threshold";

describe("raceToLt2Pace", () => {
  it("marathon 3:00:00 → LT2 4:01–4:06/km, faster than race pace", () => {
    const race = paceFromRace("full", 180);
    const lt2 = raceToLt2Pace("full", race);
    expect(Math.round(lt2.faster)).toBeGreaterThanOrEqual(241);
    expect(Math.round(lt2.slower)).toBeLessThanOrEqual(246);
    expect(lt2.faster).toBeLessThan(lt2.slower);
    expect(lt2.slower).toBeLessThan(race);
  });

  it("10K race is faster than LT2", () => {
    const race = paceFromRace("10k", 40);
    const lt2 = raceToLt2Pace("10k", race);
    expect(lt2.faster).toBeGreaterThan(race);
    expect(lt2.slower).toBeGreaterThan(lt2.faster);
  });

  it("half marathon ≈ LT2", () => {
    const race = paceFromRace("half", 90);
    expect(raceToLt2Pace("half", race)).toMatchObject({ faster: race, slower: race });
  });
});

describe("raceToLt2Hr", () => {
  it("marathon average HR is below LT2 HR", () => {
    const hr = raceToLt2Hr("full", 160);
    expect(hr.low).toBeGreaterThan(160);
  });
});

describe("lt1PaceFromLt2", () => {
  it("is 20–25% slower", () => {
    expect(lt1PaceFromLt2(300)).toEqual({ fast: 360, slow: 375 });
  });
});
