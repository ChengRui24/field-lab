export type TimeInputKind = "pace" | "duration";

export const MAX_PACE_SEC_PER_KM = 30 * 60;
export const MAX_DURATION_MINUTES = 24 * 60;

function toAsciiDigits(value: string): string {
  return value.replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

/**
 * Character-for-character IME cleanup (fullwidth digits, colons, 「．」).
 * Length-preserving, so it is safe to apply while the user is still typing.
 */
export function rewriteTimeCharacters(value: string): string {
  return toAsciiDigits(value)
    .replace(/[\uFF1A\uFE55\u2236]/g, ":")
    .replace(/\uFF0E/g, ".");
}

const UNIT_TOKEN =
  /(\d+(?:\.\d+)?)(小时|小時|钟头|鐘頭|时|時|hours?|hrs?|h|分钟|分鐘|分|minutes?|mins?|m|秒钟|秒鐘|秒|seconds?|secs?|s|''|’’|′′|″|"|”|'|’|′)?/iy;

function unitRank(unit: string): number {
  const u = unit.toLowerCase();
  if (/^(小时|小時|钟头|鐘頭|时|時|hours?|hrs?|h)$/.test(u)) return 0;
  if (/^(分钟|分鐘|分|minutes?|mins?|m|'|’|′)$/.test(u)) return 1;
  return 2;
}

function pad2(value: string): string {
  const [whole, frac] = value.split(".");
  const padded = whole.padStart(2, "0");
  return frac === undefined ? padded : `${padded}.${frac}`;
}

/** 4'30" / 4分30秒 / 1小时30分 / 1h30m → colon form; null if not a unit form. */
function rewriteUnitTime(compact: string): string | null {
  if (!/[^\d.:]/.test(compact)) return null;
  const values: (string | undefined)[] = [undefined, undefined, undefined];
  let lastRank = -1;
  let pos = 0;
  while (pos < compact.length) {
    UNIT_TOKEN.lastIndex = pos;
    const match = UNIT_TOKEN.exec(compact);
    if (!match) return null;
    const [token, digits, unit] = match;
    pos += token.length;
    let rank: number;
    if (unit === undefined) {
      // A bare trailing number takes the next smaller unit: 4'30 → 4:30, 1小时30 → 1:30:00.
      if (lastRank < 0 || pos !== compact.length) return null;
      rank = lastRank + 1;
    } else {
      rank = unitRank(unit);
    }
    if (rank <= lastRank || rank > 2) return null;
    if (lastRank >= 0 && values[lastRank]?.includes(".")) return null;
    values[rank] = digits;
    lastRank = rank;
  }
  const [hours, minutes, seconds] = values;
  if (hours === undefined && seconds === undefined && minutes !== undefined) {
    return minutes.includes(".") ? minutes : `${minutes}:00`;
  }
  if (hours !== undefined) return `${hours}:${pad2(minutes ?? "0")}:${pad2(seconds ?? "0")}`;
  return `${minutes ?? "0"}:${pad2(seconds ?? "0")}`;
}

/**
 * IME cleanup plus unit forms: fullwidth digits / colons, 「．」,
 * 4'30" · 4′30″ · 4分30秒 → 4:30, 1小时30分 → 1:30:00.
 */
export function rewriteTimePunctuation(value: string): string {
  const mapped = rewriteTimeCharacters(value);
  return rewriteUnitTime(mapped.replace(/\s+/g, "")) ?? mapped;
}

export function normalizeTimeText(raw: string): string {
  return rewriteTimePunctuation(raw).replace(/\s+/g, "").trim();
}

/**
 * Compact keypad entry. Rule: 1–2 digits are whole minutes (5 → 5:00, 90 → 90 min).
 * 3+ digits always end in two seconds digits, grouped from the right:
 * 431 → 4:31, 4500 → 45:00, 13600 → 1:36:00. Pace accepts 3–4 digits, duration 3–6.
 * Seconds (or minutes in h:mm:ss) ≥ 60 are rejected later by the parser, never re-guessed.
 */
export function expandCompactTimeDigits(raw: string, kind: TimeInputKind): string {
  if (!/^\d+$/.test(raw)) return raw;
  let maxLen: number;
  switch (kind) {
    case "pace":
      maxLen = 4;
      break;
    case "duration":
      maxLen = 6;
      break;
    default: {
      const _never: never = kind;
      return _never;
    }
  }
  if (raw.length < 3 || raw.length > maxLen) return raw;
  if (raw.length === 3) return `${raw[0]}:${raw.slice(1)}`;
  if (raw.length === 4) return `${raw.slice(0, 2)}:${raw.slice(2)}`;
  if (raw.length === 5) return `${raw[0]}:${raw.slice(1, 3)}:${raw.slice(3)}`;
  return `${raw.slice(0, 2)}:${raw.slice(2, 4)}:${raw.slice(4)}`;
}

export function prepareTimeText(raw: string, kind: TimeInputKind): string {
  return expandCompactTimeDigits(normalizeTimeText(raw), kind);
}

export interface TimeInterpretation {
  status: "empty" | "valid" | "invalid";
  /** Seconds per km for pace, minutes for duration. */
  value: number | null;
  /** Canonical colon form when valid, otherwise "". */
  canonical: string;
}

function formatClock(totalSec: number, withHours: boolean): string {
  const hundredths = Math.round(totalSec * 100);
  const whole = Math.floor(hundredths / 100);
  const frac = hundredths % 100;
  let secText = String(whole % 60).padStart(2, "0");
  if (frac !== 0) secText += `.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
  const totalMin = Math.floor(whole / 60);
  if (withHours && totalMin >= 60) {
    return `${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, "0")}:${secText}`;
  }
  return `${totalMin}:${secText}`;
}

export function interpretTimeInput(raw: string, kind: TimeInputKind): TimeInterpretation {
  const prepared = prepareTimeText(raw, kind);
  if (prepared === "") return { status: "empty", value: null, canonical: "" };
  let value: number | null;
  let canonical: string;
  switch (kind) {
    case "pace":
      value = parsePaceParts(prepared);
      canonical = value === null ? "" : formatClock(value, false);
      break;
    case "duration":
      value = parseDurationParts(prepared);
      canonical = value === null ? "" : formatClock(value * 60, true);
      break;
    default: {
      const _never: never = kind;
      return _never;
    }
  }
  if (value === null) return { status: "invalid", value: null, canonical: "" };
  return { status: "valid", value, canonical };
}

export function canonicalizeTimeInput(raw: string, kind: TimeInputKind): string {
  const result = interpretTimeInput(raw, kind);
  if (result.status === "valid") return result.canonical;
  if (result.status === "empty") return "";
  return normalizeTimeText(raw);
}

const INT_SEGMENT = /^\d+$/;
const TWO_DIGIT_SEGMENT = /^\d{2}$/;
const SECONDS_SEGMENT = /^\d{2}(\.\d+)?$/;
const DECIMAL = /^\d+(\.\d+)?$/;

function parsePaceParts(text: string): number | null {
  const parts = text.split(":");
  let total: number;
  if (parts.length === 1) {
    if (!DECIMAL.test(text)) return null;
    total = Number(text) * 60;
  } else if (parts.length === 2) {
    const [minutes, seconds] = parts;
    if (!INT_SEGMENT.test(minutes) || !SECONDS_SEGMENT.test(seconds)) return null;
    const sec = Number(seconds);
    if (sec >= 60) return null;
    total = Number(minutes) * 60 + sec;
  } else {
    return null;
  }
  if (!(total > 0) || total > MAX_PACE_SEC_PER_KM) return null;
  return total;
}

function parseDurationParts(text: string): number | null {
  const parts = text.split(":");
  let totalSec: number;
  if (parts.length === 1) {
    if (!DECIMAL.test(text)) return null;
    totalSec = Number(text) * 60;
  } else if (parts.length === 2) {
    const [minutes, seconds] = parts;
    if (!INT_SEGMENT.test(minutes) || !SECONDS_SEGMENT.test(seconds)) return null;
    const sec = Number(seconds);
    if (sec >= 60) return null;
    totalSec = Number(minutes) * 60 + sec;
  } else if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    if (!INT_SEGMENT.test(hours) || !TWO_DIGIT_SEGMENT.test(minutes) || !SECONDS_SEGMENT.test(seconds)) {
      return null;
    }
    const min = Number(minutes);
    const sec = Number(seconds);
    if (min >= 60 || sec >= 60) return null;
    totalSec = Number(hours) * 3600 + min * 60 + sec;
  } else {
    return null;
  }
  if (!(totalSec > 0) || totalSec > MAX_DURATION_MINUTES * 60) return null;
  return totalSec / 60;
}

/**
 * Plain decimal number. Accepts fullwidth digits, 「．」, and one "," / "，" as the
 * decimal mark (70,5 → 70.5). Rejects hex, exponents, Infinity, and "1,000"
 * (thousands separator or decimal mark is ambiguous there).
 */
export function parseNumber(raw: string): number | null {
  let text = toAsciiDigits(raw)
    .replace(/\uFF0E/g, ".")
    .replace(/\uFF0C/g, ",")
    .replace(/[\uFF0D\u2212]/g, "-")
    .replace(/\uFF0B/g, "+")
    .trim();
  if (text === "") return null;
  const commas = text.split(",").length - 1;
  if (commas > 1) return null;
  if (commas === 1) {
    if (text.includes(".")) return null;
    if (/^[+-]?[1-9]\d{0,2},\d{3}$/.test(text)) return null;
    text = text.replace(",", ".");
  }
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Parse mm:ss, compact 431, unit forms, or decimal minutes into seconds per km (≤ 30:00/km). */
export function parsePaceToSecPerKm(raw: string): number | null {
  return parsePaceParts(prepareTimeText(raw, "pace"));
}

/**
 * Parse race / test duration (≤ 24 h).
 * `h:mm:ss`, `mm:ss`, compact digits, unit forms, or decimal minutes.
 */
export function parseDurationToMinutes(raw: string): number | null {
  return parseDurationParts(prepareTimeText(raw, "duration"));
}

export function formatPace(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return "—";
  const total = Math.round(secPerKm);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatPaceRange(slowSec: number, fastSec: number): string {
  return `${formatPace(fastSec)}–${formatPace(slowSec)}`;
}

/** m:ss.d — rounds before splitting, so 119.96 → "2:00.0", never "1:60.0". */
export function formatMinSec(sec: number, decimals = 1): string {
  if (!Number.isFinite(sec) || sec < 0) return "—";
  const places = Math.min(6, Math.max(0, Math.trunc(decimals)));
  const scale = 10 ** places;
  const units = Math.round(sec * scale);
  const perMinute = 60 * scale;
  const minutes = Math.floor(units / perMinute);
  const seconds = (units - minutes * perMinute) / scale;
  const width = places > 0 ? 3 + places : 2;
  return `${minutes}:${seconds.toFixed(places).padStart(width, "0")}`;
}

export function formatBpm(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value)}`;
}

export function formatBpmRange(low: number, high: number): string {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return "—";
  const a = Math.round(low);
  const b = Math.round(high);
  if (a === b) return `${a}`;
  return `${Math.min(a, b)}–${Math.max(a, b)}`;
}

export function formatVo2(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

export function formatKg(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

export function formatGrams(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value >= 10 ? `${Math.round(value)}` : value.toFixed(1);
}

export function formatWatts(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value)}`;
}

export function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}
