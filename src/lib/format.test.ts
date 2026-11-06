import { describe, expect, it } from "vitest";
import {
  canonicalizeTimeInput,
  formatBpm,
  formatBpmRange,
  formatGrams,
  formatKg,
  formatMinSec,
  formatPace,
  formatPct,
  formatVo2,
  formatWatts,
  interpretTimeInput,
  parseDurationToMinutes,
  parseNumber,
  parsePaceToSecPerKm,
  rewriteTimeCharacters,
  rewriteTimePunctuation,
} from "./format";

describe("numeric formatters reject non-finite", () => {
  const formatters = [formatKg, formatVo2, formatBpm, formatPct, formatGrams, formatWatts, formatPace];
  it.each([Infinity, -Infinity, NaN])("%s → —", (value) => {
    for (const fmt of formatters) expect(fmt(value)).toBe("—");
  });

  it("formatBpmRange keeps ordering but not non-finite", () => {
    expect(formatBpmRange(170, 150)).toBe("150–170");
    expect(formatBpmRange(150.4, 149.6)).toBe("150");
    expect(formatBpmRange(NaN, 150)).toBe("—");
    expect(formatBpmRange(150, Infinity)).toBe("—");
  });

  it("happy paths unchanged", () => {
    expect(formatKg(72.25)).toBe("72.3");
    expect(formatVo2(52.04)).toBe("52.0");
    expect(formatBpm(151.6)).toBe("152");
    expect(formatPct(3.14)).toBe("3.1%");
    expect(formatGrams(9.44)).toBe("9.4");
    expect(formatGrams(60.4)).toBe("60");
    expect(formatWatts(250.5)).toBe("251");
    expect(formatPace(271)).toBe("4:31");
    expect(formatPace(299.6)).toBe("5:00");
  });
});

describe("formatMinSec", () => {
  it("rounds before splitting", () => {
    expect(formatMinSec(80)).toBe("1:20.0");
    expect(formatMinSec(119.96)).toBe("2:00.0");
    expect(formatMinSec(119.94)).toBe("1:59.9");
    expect(formatMinSec(59.999, 2)).toBe("1:00.00");
    expect(formatMinSec(65.4, 0)).toBe("1:05");
    expect(formatMinSec(0)).toBe("0:00.0");
    expect(formatMinSec(3725.25, 2)).toBe("62:05.25");
  });

  it("rejects non-finite and negative", () => {
    expect(formatMinSec(Infinity)).toBe("—");
    expect(formatMinSec(NaN)).toBe("—");
    expect(formatMinSec(-1)).toBe("—");
  });
});

describe("compact time digits", () => {
  it("pace: 3–4 digits are m:ss / mm:ss, 1–2 digits are minutes", () => {
    expect(parsePaceToSecPerKm("431")).toBe(271);
    expect(parsePaceToSecPerKm("1230")).toBe(750);
    expect(parsePaceToSecPerKm("5")).toBe(300);
    expect(parsePaceToSecPerKm("4.5")).toBe(270);
  });

  it("duration: last two digits are always seconds once there are 3+", () => {
    expect(parseDurationToMinutes("90")).toBe(90);
    expect(parseDurationToMinutes("100")).toBe(1);
    expect(parseDurationToMinutes("120")).toBeCloseTo(80 / 60);
    expect(parseDurationToMinutes("4500")).toBe(45);
    expect(parseDurationToMinutes("13600")).toBe(96);
    expect(parseDurationToMinutes("240000")).toBe(1440);
  });

  it("seconds or minutes ≥ 60 are rejected, not re-guessed", () => {
    expect(parseDurationToMinutes("180")).toBeNull();
    expect(parseDurationToMinutes("1:80")).toBeNull();
    expect(parseDurationToMinutes("16000")).toBeNull();
    expect(parsePaceToSecPerKm("461")).toBeNull();
    expect(interpretTimeInput("180", "duration").status).toBe("invalid");
  });

  it("canonical echo text makes the interpretation explicit", () => {
    expect(canonicalizeTimeInput("120", "duration")).toBe("1:20");
    expect(canonicalizeTimeInput("100", "duration")).toBe("1:00");
    expect(canonicalizeTimeInput("90", "duration")).toBe("1:30:00");
    expect(canonicalizeTimeInput("13600", "duration")).toBe("1:36:00");
    expect(canonicalizeTimeInput("4500", "duration")).toBe("45:00");
    expect(canonicalizeTimeInput("431", "pace")).toBe("4:31");
    expect(canonicalizeTimeInput("5", "pace")).toBe("5:00");
    expect(canonicalizeTimeInput("4.5", "pace")).toBe("4:30");
    expect(canonicalizeTimeInput("4:30.5", "pace")).toBe("4:30.5");
    expect(canonicalizeTimeInput("", "pace")).toBe("");
    expect(canonicalizeTimeInput("abc", "pace")).toBe("abc");
  });
});

describe("time segment validation", () => {
  it("happy paths", () => {
    expect(parsePaceToSecPerKm("4:31")).toBe(271);
    expect(parseDurationToMinutes("1:36:00")).toBe(96);
    expect(parseDurationToMinutes("45:00")).toBe(45);
    expect(parseDurationToMinutes("12")).toBe(12);
    expect(parseDurationToMinutes(" 3:00 ")).toBe(3);
  });

  it.each(["1:", ":30", "-0:30:00", "0x1e", "1e3", "1::00", "4:5", "1.5:00", "Infinity", "0", "0:00"])(
    "duration rejects %j",
    (raw) => {
      expect(parseDurationToMinutes(raw)).toBeNull();
    },
  );

  it.each(["1:", "-4:30", "0x1e", "1e1", "12345", "31:00", "4:30:00", "0:00"])("pace rejects %j", (raw) => {
    expect(parsePaceToSecPerKm(raw)).toBeNull();
  });

  it("upper bounds", () => {
    expect(parsePaceToSecPerKm("30:00")).toBe(1800);
    expect(parsePaceToSecPerKm("30:01")).toBeNull();
    expect(parseDurationToMinutes("24:00:00")).toBe(1440);
    expect(parseDurationToMinutes("24:00:01")).toBeNull();
    expect(parseDurationToMinutes("1441")).toBeCloseTo(14 + 41 / 60);
    expect(parseDurationToMinutes("1441:00")).toBeNull();
    expect(parseDurationToMinutes("1441.5")).toBeNull();
  });
});

describe("rewriteTimePunctuation", () => {
  it("fullwidth digits, colons and 「．」", () => {
    expect(rewriteTimePunctuation("４：３０")).toBe("4:30");
    expect(rewriteTimePunctuation("４．５")).toBe("4.5");
    expect(parsePaceToSecPerKm("４．５")).toBe(270);
    expect(parsePaceToSecPerKm("４３１")).toBe(271);
  });

  it.each([
    [`4'30"`, "4:30"],
    ["4′30″", "4:30"],
    ["4'30", "4:30"],
    ["4’30”", "4:30"],
    ["4分30秒", "4:30"],
    ["4 分 30 秒", "4:30"],
    ["4分", "4:00"],
    ["30秒", "0:30"],
    ["1小时30分", "1:30:00"],
    ["1小时30分5秒", "1:30:05"],
    ["1h30m", "1:30:00"],
    ["４分３０秒", "4:30"],
  ])("%j → %j", (raw, expected) => {
    expect(rewriteTimePunctuation(raw)).toBe(expected);
  });

  it("unit forms parse end to end", () => {
    expect(parsePaceToSecPerKm(`4'30"`)).toBe(270);
    expect(parseDurationToMinutes("1小时30分")).toBe(90);
    expect(canonicalizeTimeInput("4分30秒", "pace")).toBe("4:30");
  });

  it("malformed unit forms are not guessed", () => {
    expect(parsePaceToSecPerKm("30秒4分")).toBeNull();
    expect(parsePaceToSecPerKm("4分75秒")).toBeNull();
    expect(parsePaceToSecPerKm("4.5分30秒")).toBeNull();
  });

  it("live character rewrite is length-preserving", () => {
    expect(rewriteTimeCharacters("４分")).toBe("4分");
    expect(rewriteTimeCharacters("４：３．５")).toBe("4:3.5");
  });
});

describe("parseNumber", () => {
  it("plain numbers", () => {
    expect(parseNumber(" 70.5 ")).toBe(70.5);
    expect(parseNumber("-3")).toBe(-3);
    expect(parseNumber(".5")).toBe(0.5);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("   ")).toBeNull();
  });

  it("fullwidth digits and decimal marks", () => {
    expect(parseNumber("７０")).toBe(70);
    expect(parseNumber("７０．５")).toBe(70.5);
    expect(parseNumber("70,5")).toBe(70.5);
    expect(parseNumber("７０，５")).toBe(70.5);
    expect(parseNumber("0,125")).toBe(0.125);
    expect(parseNumber("　６５　")).toBe(65);
  });

  it.each(["0x1e", "1e3", "Infinity", "NaN", "1,2,3", "1.2,3", "1,000", "12 3", "abc", "5kg"])("rejects %j", (raw) => {
    expect(parseNumber(raw)).toBeNull();
  });
});
