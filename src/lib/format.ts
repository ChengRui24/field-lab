export type TimeInputKind = "pace" | "duration";

/** Fullwidth digits and colons from Chinese IME → ASCII. */
export function rewriteTimePunctuation(value: string): string {
  return value
    .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\uFF1A\uFE55\u2236]/g, ":");
}

export function normalizeTimeText(raw: string): string {
  return rewriteTimePunctuation(raw).replace(/\s+/g, "").trim();
}

/**
 * Compact keypad entry: 431 → 4:31, 4500 → 45:00, 13600 → 1:36:00.
 * 1–2 digits stay decimal minutes (12 → 12:00).
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

export function canonicalizeTimeInput(raw: string, kind: TimeInputKind): string {
  const prepared = prepareTimeText(raw, kind);
  if (prepared === "") return "";
  let parsed: number | null;
  switch (kind) {
    case "pace":
      parsed = parsePaceParts(prepared);
      break;
    case "duration":
      parsed = parseDurationParts(prepared);
      break;
    default: {
      const _never: never = kind;
      return _never;
    }
  }
  if (parsed === null) return normalizeTimeText(raw);
  return prepared;
}

function parsePaceParts(trimmed: string): number | null {
  if (trimmed === "") return null;
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length !== 2) return null;
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    if (seconds < 0 || seconds >= 60 || minutes < 0) return null;
    const total = minutes * 60 + seconds;
    if (total <= 0) return null;
    return total;
  }
  const minutes = Number(trimmed);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return minutes * 60;
}

function parseDurationParts(trimmed: string): number | null {
  if (trimmed === "") return null;
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map((part) => Number(part));
    if (parts.some((part) => !Number.isFinite(part))) return null;
    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      if (minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) return null;
      const total = hours * 60 + minutes + seconds / 60;
      return total > 0 ? total : null;
    }
    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      if (seconds < 0 || seconds >= 60) return null;
      const total = minutes + seconds / 60;
      return total > 0 ? total : null;
    }
    return null;
  }
  const minutes = Number(trimmed);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return minutes;
}

export function parseNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return value;
}

/** Parse mm:ss, compact 431, or decimal minutes into seconds per km. */
export function parsePaceToSecPerKm(raw: string): number | null {
  return parsePaceParts(prepareTimeText(raw, "pace"));
}

/**
 * Parse race / test duration.
 * `h:mm:ss`, `mm:ss`, compact digits, or decimal minutes.
 */
export function parseDurationToMinutes(raw: string): number | null {
  return parseDurationParts(prepareTimeText(raw, "duration"));
}

export function formatPace(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return "—";
  const total = Math.round(secPerKm);
  let minutes = Math.floor(total / 60);
  let seconds = total % 60;
  if (seconds === 60) {
    minutes += 1;
    seconds = 0;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatPaceRange(slowSec: number, fastSec: number): string {
  return `${formatPace(fastSec)}–${formatPace(slowSec)}`;
}

export function formatBpm(value: number): string {
  return `${Math.round(value)}`;
}

export function formatBpmRange(low: number, high: number): string {
  const a = Math.round(low);
  const b = Math.round(high);
  if (a === b) return `${a}`;
  return `${Math.min(a, b)}–${Math.max(a, b)}`;
}

export function formatVo2(value: number): string {
  return value.toFixed(1);
}

export function formatKg(value: number): string {
  return value.toFixed(1);
}

export function formatGrams(value: number): string {
  return value >= 10 ? `${Math.round(value)}` : value.toFixed(1);
}

export function formatWatts(value: number): string {
  return `${Math.round(value)}`;
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}