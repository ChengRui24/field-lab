import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  chairStandReading,
  FUNCTION_LIMITS,
  gaitSpeedMPerSec,
  gaitSpeedReading,
  gripReading,
  screeningSummary,
  sixMinuteWalkReading,
  sppbBalanceScore,
  sppbBand,
  sppbChairScore,
  sppbGaitScore,
  sppbResult,
  sppbTandemScore,
  tugReading,
  withinLimits,
} from "./function";

describe("6MWT Enright 1998", () => {
  it("male 175 cm, 60 y, 75 kg → 582.55 m, LLN 429.55 m", () => {
    const r = sixMinuteWalkReading({ distanceM: 500, sex: "male", heightCm: 175, age: 60, weightKg: 75 })!;
    expect(r.inRange).toBe(true);
    if (!r.inRange) return;
    expect(r.predicted).toBeCloseTo(582.55, 2);
    expect(r.lln).toBeCloseTo(429.55, 2);
  });

  it("female 160 cm, 70 y, 60 kg → 462.6 m, LLN 323.6 m", () => {
    const r = sixMinuteWalkReading({ distanceM: 400, sex: "female", heightCm: 160, age: 70, weightKg: 60 })!;
    expect(r.inRange).toBe(true);
    if (!r.inRange) return;
    expect(r.predicted).toBeCloseTo(462.6, 2);
    expect(r.lln).toBeCloseTo(323.6, 2);
    expect(r.belowLln).toBe(false);
  });

  it("persona: female 155 cm, 72 y, 60 kg, 380 m → 440.49 m predicted, 86%, above LLN", () => {
    const r = sixMinuteWalkReading({ distanceM: 380, sex: "female", heightCm: 155, age: 72, weightKg: 60 })!;
    if (!r.inRange) throw new Error("expected in range");
    expect(r.predicted).toBeCloseTo(440.49, 2);
    expect(r.pctPredicted).toBeCloseTo(86.27, 1);
    expect(r.belowLln).toBe(false);
  });

  it("age outside 40–80 is out of range", () => {
    expect(sixMinuteWalkReading({ distanceM: 400, sex: "female", heightCm: 160, age: 85, weightKg: 60 })?.inRange).toBe(false);
    expect(sixMinuteWalkReading({ distanceM: 400, sex: "male", heightCm: 175, age: 39, weightKg: 75 })?.inRange).toBe(false);
  });

  it("predicted ≤ 0 is out of range", () => {
    expect(sixMinuteWalkReading({ distanceM: 300, sex: "male", heightCm: 120, age: 80, weightKg: 200 })?.inRange).toBe(false);
  });
});

describe("gait speed", () => {
  it("6 m / 7.5 s = 0.80 → below AWGS, also EWGSOP2", () => {
    const speed = gaitSpeedMPerSec(6, 7.5)!;
    expect(speed).toBeCloseTo(0.8, 6);
    const r = gaitSpeedReading(speed);
    expect(r.tone).toBe("caution");
    expect(r.awgsLow).toBe(true);
    expect(r.note).toContain("也达到欧洲 EWGSOP2");
  });
  it("4 m / 4.5 s = 0.889 → below AWGS only", () => {
    const speed = gaitSpeedMPerSec(4, 4.5)!;
    expect(speed).toBeCloseTo(0.889, 3);
    const r = gaitSpeedReading(speed);
    expect(r.headline).toBe("低于亚洲参考线 1.0 m/s（偏慢）");
    expect(r.note).toContain("还没到欧洲 EWGSOP2");
  });
  it("6 m / 5 s = 1.20 → normal", () => {
    const speed = gaitSpeedMPerSec(6, 5)!;
    expect(speed).toBeCloseTo(1.2, 6);
    expect(gaitSpeedReading(speed)).toMatchObject({ tone: "ok", flag: "正常", awgsLow: false });
  });
  it("1.00 m/s exactly is not below the line", () => {
    expect(gaitSpeedReading(1).awgsLow).toBe(false);
  });
});

describe("5× chair stand", () => {
  it("11.9 s → faster than 12 s line", () => {
    expect(chairStandReading(11.9)).toMatchObject({ headline: "快于亚洲参考线 12 秒（正常范围）", tone: "ok" });
  });
  it("12.0 s → slower than AWGS line; 15.0 s not yet EWGSOP2", () => {
    expect(chairStandReading(12)).toMatchObject({ headline: "慢于亚洲参考线 12 秒（偏慢）", flag: "偏低", awgsLow: true });
    expect(chairStandReading(15)!.note).toContain("还没到欧洲 EWGSOP2");
  });
  it("15.1 s is beyond EWGSOP2", () => {
    expect(chairStandReading(15.1)!.note).toContain("也超过欧洲 EWGSOP2");
  });
});

describe("TUG", () => {
  it("12 s → STEADI fall-risk cue", () => {
    expect(tugReading(12)).toMatchObject({ tone: "caution", flag: "需留意", awgsLow: false });
  });
  it("11.9 s → normal", () => {
    expect(tugReading(11.9)?.tone).toBe("ok");
  });
});

describe("grip", () => {
  it("male 28 normal, 27 below AWGS only, 26.9 below both", () => {
    expect(gripReading(28, "male")).toMatchObject({ tone: "ok", headline: "在亚洲男性参考线 28 kg 以上（正常范围）" });
    expect(gripReading(27, "male")).toMatchObject({ headline: "低于亚洲男性参考线 28 kg（偏弱）", awgsLow: true });
    expect(gripReading(27, "male")!.note).toContain("还没低于欧洲 EWGSOP2 的 27 kg");
    expect(gripReading(26.9, "male")!.note).toContain("也低于欧洲 EWGSOP2 的 27 kg");
  });
  it("female 17 below AWGS 18", () => {
    expect(gripReading(17, "female")).toMatchObject({ headline: "低于亚洲女性参考线 18 kg（偏弱）", flag: "偏低" });
    expect(gripReading(18, "female")?.tone).toBe("ok");
  });
});

describe("out-of-range inputs give no reading", () => {
  it.each([-3, 0, 2.9, 60.1, 999])("chair stand %s s → null", (s) => {
    expect(chairStandReading(s)).toBeNull();
  });
  it.each([0, 0.5, 100.1, 999999, -5])("grip %s kg → null", (kg) => {
    expect(gripReading(kg, "female")).toBeNull();
  });
  it.each([2.9, 120.1, -1])("TUG %s s → null", (s) => {
    expect(tugReading(s)).toBeNull();
  });
  it("gait time or distance out of range → null speed", () => {
    expect(gaitSpeedMPerSec(4, 0.5)).toBeNull();
    expect(gaitSpeedMPerSec(4, 61)).toBeNull();
    expect(gaitSpeedMPerSec(4, -5)).toBeNull();
    expect(gaitSpeedMPerSec(0, 5)).toBeNull();
    expect(gaitSpeedMPerSec(100, 5)).toBeNull();
  });
  it("6MWT with implausible distance or body data → null", () => {
    const ok = { distanceM: 380, sex: "female" as const, heightCm: 155, age: 72, weightKg: 60 };
    expect(sixMinuteWalkReading(ok)).not.toBeNull();
    expect(sixMinuteWalkReading({ ...ok, distanceM: 5 })).toBeNull();
    expect(sixMinuteWalkReading({ ...ok, distanceM: 1001 })).toBeNull();
    expect(sixMinuteWalkReading({ ...ok, age: 111 })).toBeNull();
    expect(sixMinuteWalkReading({ ...ok, heightCm: 99 })).toBeNull();
    expect(sixMinuteWalkReading({ ...ok, weightKg: 251 })).toBeNull();
  });
  it("SPPB treats out-of-range times as missing, not scored", () => {
    const r = sppbResult({
      sideBySideHeld: true,
      semiTandemHeld: true,
      tandemSec: 10,
      gaitUnable: false,
      gaitDistanceM: 4,
      gaitSec: 0.2,
      chairUnable: false,
      chairSec: -3,
    });
    expect(r.gait).toBeNull();
    expect(r.chair).toBeNull();
    expect(r.total).toBeNull();
    expect(r.missing).toEqual(["gait", "chair"]);
  });
  it("withinLimits rejects null and NaN", () => {
    expect(withinLimits("gripKg", null)).toBe(false);
    expect(withinLimits("gripKg", Number.NaN)).toBe(false);
    expect(withinLimits("gripKg", 1)).toBe(true);
    expect(withinLimits("gripKg", 100)).toBe(true);
  });
});

describe("function.html input ranges match FUNCTION_LIMITS", () => {
  const html = readFileSync(resolve(__dirname, "../../function.html"), "utf8");
  const ids: Record<string, keyof typeof FUNCTION_LIMITS> = {
    "info-age": "age",
    "info-cm": "heightCm",
    "info-kg": "weightKg",
    "mwt-m": "mwtM",
    "gait-m": "gaitM",
    "gait-sec": "gaitSec",
    "sts-sec": "chairSec",
    "tug-sec": "tugSec",
    "grip-kg": "gripKg",
  };
  it.each(Object.entries(ids))("#%s", (id, key) => {
    const tag = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`, "s"))?.[0];
    expect(tag, id).toBeDefined();
    expect(tag).toContain(`min="${FUNCTION_LIMITS[key].min}"`);
    expect(tag).toContain(`max="${FUNCTION_LIMITS[key].max}"`);
  });
});

describe("screening summary", () => {
  const none = { gait: null, chair: null, sppb: null, grip: null, tug: null, mwt: null };
  it("persona: gait, chair, SPPB, grip low → possible sarcopenia", () => {
    const s = screeningSummary({ ...none, gait: true, chair: true, sppb: true, grip: true, mwt: false });
    expect(s.awgsLow).toEqual(["步速", "起坐", "SPPB", "握力"]);
    expect(s.possibleSarcopenia).toBe(true);
    expect(s.fallRisk).toBe(false);
    expect(s.tested).toBe(5);
  });
  it("grip alone (low strength) is enough for possible sarcopenia", () => {
    expect(screeningSummary({ ...none, grip: true, chair: false }).possibleSarcopenia).toBe(true);
  });
  it("TUG and 6MWT do not count toward AWGS", () => {
    const s = screeningSummary({ ...none, tug: true, mwt: true });
    expect(s.possibleSarcopenia).toBe(false);
    expect(s.fallRisk).toBe(true);
    expect(s.mwtLow).toBe(true);
  });
  it("all within lines", () => {
    const s = screeningSummary({ ...none, gait: false, grip: false });
    expect(s.awgsLow).toEqual([]);
    expect(s.tested).toBe(2);
  });
});

describe("SPPB component cut-offs (Guralnik 1994 / EPESE)", () => {
  it.each([
    [4.81, 4],
    [4.82, 3],
    [6.2, 3],
    [6.21, 2],
    [8.7, 2],
    [8.71, 1],
  ])("4 m gait %s s → %i", (sec, score) => {
    expect(sppbGaitScore(sec)).toBe(score);
  });

  it.each([
    [11.19, 4],
    [11.2, 3],
    [13.69, 3],
    [13.7, 2],
    [16.69, 2],
    [16.7, 1],
    [60, 1],
    [60.1, 0],
  ])("5× chair stand %s s → %i", (sec, score) => {
    expect(sppbChairScore(sec)).toBe(score);
  });

  it.each([
    [10, 2],
    [9.99, 1],
    [3, 1],
    [2.99, 0],
  ])("full tandem %s s → %i", (sec, score) => {
    expect(sppbTandemScore(sec)).toBe(score);
  });
});

describe("SPPB balance series", () => {
  it("all held → 4", () => {
    expect(sppbBalanceScore({ sideBySideHeld: true, semiTandemHeld: true, tandemSec: 10 })).toBe(4);
  });
  it("side-by-side failure forces 0 even if later items are filled", () => {
    expect(sppbBalanceScore({ sideBySideHeld: false, semiTandemHeld: true, tandemSec: 10 })).toBe(0);
    expect(sppbBalanceScore({ sideBySideHeld: false, semiTandemHeld: null, tandemSec: null })).toBe(0);
  });
  it("semi-tandem failure ends the series at 1", () => {
    expect(sppbBalanceScore({ sideBySideHeld: true, semiTandemHeld: false, tandemSec: 10 })).toBe(1);
  });
  it("incomplete series → null", () => {
    expect(sppbBalanceScore({ sideBySideHeld: null, semiTandemHeld: true, tandemSec: 10 })).toBeNull();
    expect(sppbBalanceScore({ sideBySideHeld: true, semiTandemHeld: null, tandemSec: null })).toBeNull();
    expect(sppbBalanceScore({ sideBySideHeld: true, semiTandemHeld: true, tandemSec: null })).toBeNull();
  });
});

describe("SPPB totals and bands", () => {
  const base = {
    sideBySideHeld: true,
    semiTandemHeld: true,
    tandemSec: 10,
    gaitUnable: false,
    gaitDistanceM: 4,
    gaitSec: 4,
    chairUnable: false,
    chairSec: 10,
  };

  it("12 → 10–12 band, not EWGSOP2 low", () => {
    const r = sppbResult(base);
    expect(r.total).toBe(12);
    expect(r.band?.range).toBe("10–12");
    expect(r.ewgsop2Low).toBe(false);
    expect(r.missing).toEqual([]);
  });
  it("9 → 7–9 band, EWGSOP2 false", () => {
    const r = sppbResult({ ...base, tandemSec: 5, gaitSec: 5, chairSec: 12 });
    expect([r.balance, r.gait, r.chair]).toEqual([3, 3, 3]);
    expect(r.total).toBe(9);
    expect(r.band?.range).toBe("7–9");
    expect(r.ewgsop2Low).toBe(false);
  });
  it("8 → EWGSOP2 low performance true", () => {
    const r = sppbResult({ ...base, tandemSec: 5, gaitSec: 5, chairSec: 14 });
    expect(r.total).toBe(8);
    expect(r.ewgsop2Low).toBe(true);
    expect(r.awgsLow).toBe(true);
  });
  it("persona: tandem 6 s, 4 m in 5.2 s, chair 14.8 s → 3 + 3 + 2 = 8", () => {
    const r = sppbResult({ ...base, tandemSec: 6, gaitSec: 5.2, chairSec: 14.8 });
    expect([r.balance, r.gait, r.chair]).toEqual([3, 3, 2]);
    expect(r.total).toBe(8);
  });
  it("9 is AWGS low (≤9) but not EWGSOP2 low (≤8); 10 is neither", () => {
    expect(sppbResult({ ...base, tandemSec: 5, gaitSec: 5, chairSec: 12 })).toMatchObject({ total: 9, awgsLow: true, ewgsop2Low: false });
    expect(sppbResult({ ...base, tandemSec: 5, gaitSec: 4, chairSec: 12 })).toMatchObject({ total: 10, awgsLow: false });
  });
  it("3 → 0–3 band", () => {
    const r = sppbResult({ ...base, semiTandemHeld: false, gaitSec: 9, chairSec: 30 });
    expect(r.total).toBe(3);
    expect(r.band?.range).toBe("0–3");
    expect(r.ewgsop2Low).toBe(true);
  });
  it("0 with unable gait and chair", () => {
    const r = sppbResult({ ...base, sideBySideHeld: false, gaitUnable: true, gaitSec: null, chairUnable: true, chairSec: null });
    expect(r.total).toBe(0);
    expect(r.band?.range).toBe("0–3");
    expect(r.ewgsop2Low).toBe(true);
  });
  it("band edges", () => {
    expect(sppbBand(4).range).toBe("4–6");
    expect(sppbBand(6).range).toBe("4–6");
    expect(sppbBand(7).range).toBe("7–9");
    expect(sppbBand(10).range).toBe("10–12");
  });
});

describe("SPPB partial input", () => {
  const none = {
    sideBySideHeld: null,
    semiTandemHeld: null,
    tandemSec: null,
    gaitUnable: false,
    gaitDistanceM: 4,
    gaitSec: null,
    chairUnable: false,
    chairSec: null,
  };

  it("nothing entered → all three missing", () => {
    expect(sppbResult(none).missing).toEqual(["balance", "gait", "chair"]);
  });
  it("only chair → balance and gait missing, no total", () => {
    const r = sppbResult({ ...none, chairSec: 12 });
    expect(r.chair).toBe(3);
    expect(r.missing).toEqual(["balance", "gait"]);
    expect(r.total).toBeNull();
    expect(r.ewgsop2Low).toBeNull();
  });
  it("gait over 6 m is not converted and counts as missing", () => {
    const r = sppbResult({ ...none, sideBySideHeld: false, gaitDistanceM: 6, gaitSec: 5, chairSec: 12 });
    expect(r.gait).toBeNull();
    expect(r.gaitWrongDistance).toBe(true);
    expect(r.missing).toEqual(["gait"]);
  });
});
