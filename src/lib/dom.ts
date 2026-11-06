import {
  canonicalizeTimeInput,
  describeTimeCanonical,
  interpretTimeInput,
  parseNumber,
  rewriteTimeCharacters,
  type TimeInputKind,
  type TimeInputOptions,
} from "./format";

function timeKind(el: EventTarget | null): TimeInputKind | null {
  if (!(el instanceof HTMLInputElement)) return null;
  const kind = el.dataset.time;
  if (kind === "pace" || kind === "duration") return kind;
  return null;
}

/** `data-time-hm` on a duration input: 1:52 / 152 mean 1 h 52 min. */
function timeOptions(input: HTMLInputElement): TimeInputOptions {
  return { hm: input.hasAttribute("data-time-hm") };
}

function addDescribedBy(input: HTMLElement, id: string): void {
  const describedBy = input.getAttribute("aria-describedby");
  const ids = describedBy ? describedBy.split(/\s+/) : [];
  if (!ids.includes(id)) input.setAttribute("aria-describedby", [...ids, id].join(" "));
}

// Unit forms (4分30秒) are only rewritten on commit; doing it per keystroke would mangle "4分" mid-entry.
function applyTimePunctuation(input: HTMLInputElement): void {
  const next = rewriteTimeCharacters(input.value);
  if (next === input.value) return;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  input.value = next;
  if (start !== null && end !== null) {
    input.setSelectionRange(start, end);
  }
}

export function inputValue(id: string): string {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement)) {
    return "";
  }
  return el.value;
}

function outOfRange(el: HTMLInputElement): boolean {
  const { badInput, rangeUnderflow, rangeOverflow } = el.validity;
  return badInput || rangeUnderflow || rangeOverflow;
}

/** Parsed number from an input, or null when empty, unparseable, or outside the input's min/max. */
export function readNumber(id: string): number | null {
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement && outOfRange(el)) return null;
  return parseNumber(inputValue(id));
}

export function checkedRadio(name: string): string | null {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  if (!(el instanceof HTMLInputElement)) return null;
  return el.value;
}

export type Sex = "male" | "female";

export function checkedSex(name: string): Sex | null {
  const raw = checkedRadio(name);
  return raw === "male" || raw === "female" ? raw : null;
}

const PERSIST_PREFIX = "field-lab:";

type PersistField = HTMLInputElement | HTMLSelectElement;

function persistFields(form: HTMLFormElement): PersistField[] {
  return Array.from(form.querySelectorAll<PersistField>("[data-persist]"));
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(PERSIST_PREFIX + key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    if (value === "") localStorage.removeItem(PERSIST_PREFIX + key);
    else localStorage.setItem(PERSIST_PREFIX + key, value);
  } catch {
    // Storage can be unavailable (private mode, quota); persistence is best-effort.
  }
}

function restorePersisted(form: HTMLFormElement): void {
  for (const field of persistFields(form)) {
    const stored = readStored(field.dataset.persist ?? "");
    if (stored === null) continue;
    if (field instanceof HTMLInputElement && field.type === "radio") {
      field.checked = field.value === stored;
    } else if (field.value === "") {
      field.value = stored;
    }
  }
}

function savePersisted(target: EventTarget | null): void {
  if (suppressSave) return;
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
  const key = target.dataset.persist;
  if (!key) return;
  if (target instanceof HTMLInputElement && target.type === "radio" && !target.checked) return;
  if (target instanceof HTMLInputElement && outOfRange(target)) return;
  writeStored(key, target.value);
}

/** Keys kept by clearPersisted: the training-load week is a log, not a personal profile. */
function isLogKey(key: string): boolean {
  return key.startsWith("load-");
}

let suppressSave = false;

/**
 * Forget the remembered profile (age, sex, weight, height, heart rates…) but keep the
 * training-load week and the theme. Fields on the current page go back to their HTML
 * defaults and every bound form re-renders, so no reload is needed.
 */
export function clearPersisted(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PERSIST_PREFIX) && !isLogKey(key.slice(PERSIST_PREFIX.length))) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Same best-effort contract as writeStored.
  }
  const touched: PersistField[] = [];
  for (const field of document.querySelectorAll<PersistField>("[data-persist]")) {
    if (isLogKey(field.dataset.persist ?? "")) continue;
    if (field instanceof HTMLInputElement && (field.type === "radio" || field.type === "checkbox")) {
      if (field.checked === field.defaultChecked) continue;
      field.checked = field.defaultChecked;
    } else if (field instanceof HTMLSelectElement) {
      const index = Array.from(field.options).findIndex((option) => option.defaultSelected);
      const next = index < 0 ? 0 : index;
      if (field.selectedIndex === next) continue;
      field.selectedIndex = next;
    } else {
      if (field.value === field.defaultValue) continue;
      field.value = field.defaultValue;
    }
    touched.push(field);
  }
  suppressSave = true;
  try {
    for (const field of touched) dispatchSynced(field);
  } finally {
    suppressSave = false;
  }
}

let syncing = false;

function dispatchSynced(field: PersistField): void {
  const wasSyncing = syncing;
  syncing = true;
  try {
    field.dispatchEvent(new Event("input", { bubbles: true }));
  } finally {
    syncing = wasSyncing;
  }
}

/** Mirror a remembered value into every other field on the page that shares its data-persist key. */
function syncSameKey(target: EventTarget | null): void {
  if (syncing) return;
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
  const key = target.dataset.persist;
  if (!key) return;
  const isRadio = target instanceof HTMLInputElement && target.type === "radio";
  if (isRadio && !target.checked) return;
  if (target instanceof HTMLInputElement && outOfRange(target)) return;
  const changed: PersistField[] = [];
  for (const field of document.querySelectorAll<PersistField>("[data-persist]")) {
    if (field === target || field.dataset.persist !== key) continue;
    if (field instanceof HTMLInputElement && field.type === "radio") {
      if (isRadio && field.name === (target as HTMLInputElement).name) continue;
      const shouldCheck = field.value === target.value;
      if (field.checked === shouldCheck) continue;
      field.checked = shouldCheck;
      if (shouldCheck) changed.push(field);
    } else if (!isRadio && field.value !== target.value) {
      field.value = target.value;
      changed.push(field);
    }
  }
  for (const field of changed) dispatchSynced(field);
}

function updateRangeNotes(form: HTMLFormElement): void {
  for (const field of form.querySelectorAll<HTMLInputElement>("input[data-range-note]")) {
    const note = document.getElementById(`${field.id}-range-note`);
    if (!note) continue;
    const value = field.valueAsNumber;
    const min = field.dataset.validMin === undefined ? -Infinity : Number(field.dataset.validMin);
    const max = field.dataset.validMax === undefined ? Infinity : Number(field.dataset.validMax);
    // A value the input itself rejects gets the limit note instead; one message at a time.
    const outside = Number.isFinite(value) && (value < min || value > max) && !outOfRange(field);
    note.hidden = !outside;
    note.textContent = outside ? (field.dataset.rangeNote ?? "") : "";
  }
}

function setInvalid(field: HTMLInputElement, invalid: boolean): void {
  if (invalid) field.setAttribute("aria-invalid", "true");
  else field.removeAttribute("aria-invalid");
}

const ASCII_UNIT = /^[A-Za-z′/\d. ]+$/;
const CJK_UNIT = /^(岁|秒|分钟|小时|米|次|%)$/;

/** Unit from a label like 体重（kg）or 静息心率（…，bpm）; "" when there is none. */
function labelUnit(field: HTMLInputElement): string {
  const label = field.labels?.[0]?.textContent ?? field.getAttribute("aria-label") ?? "";
  const match = /[（(]([^（()）]*)[)）]\s*$/.exec(label.trim());
  if (!match) return "";
  const segments = match[1].split(/[，,]/).map((s) => s.trim());
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];
    if (CJK_UNIT.test(segment)) return segment;
    if (ASCII_UNIT.test(segment) && /[A-Za-z]/.test(segment)) return segment;
  }
  return "";
}

function limitText(field: HTMLInputElement): string {
  const { badInput, rangeUnderflow, rangeOverflow } = field.validity;
  if (badInput) return "请输入数字";
  if (!rangeUnderflow && !rangeOverflow) return "";
  const unit = labelUnit(field);
  const cjk = unit !== "" && !ASCII_UNIT.test(unit);
  const withUnit = (value: string): string => {
    if (unit === "") return value;
    return unit === "%" ? `${value}%` : `${value} ${unit}`;
  };
  const min = field.min === "" ? null : field.min;
  const max = field.max === "" ? null : field.max;
  if (min !== null && max !== null) {
    return `应在 ${withUnit(`${min}–${max}`)}${cjk || unit === "%" ? "" : " "}之间`;
  }
  if (min !== null) return `至少 ${withUnit(min)}`;
  return `不超过 ${withUnit(max ?? "")}`;
}

function limitNote(field: HTMLInputElement, create: boolean): HTMLElement | null {
  const id = field.id ? `${field.id}-limit-note` : "";
  const existing = id ? document.getElementById(id) : null;
  if (existing) return existing;
  const next = field.nextElementSibling;
  if (next instanceof HTMLElement && next.classList.contains("limit-note")) return next;
  if (!create) return null;
  const note = document.createElement("p");
  note.className = "limit-note";
  note.dataset.state = "invalid";
  note.setAttribute("aria-live", "polite");
  note.hidden = true;
  if (id) {
    note.id = id;
    addDescribedBy(field, id);
  }
  field.insertAdjacentElement("afterend", note);
  return note;
}

function updateNumberValidity(form: HTMLFormElement): void {
  for (const field of form.querySelectorAll<HTMLInputElement>('input[type="number"]')) {
    const text = limitText(field);
    setInvalid(field, text !== "");
    const note = limitNote(field, text !== "");
    if (!note) continue;
    note.textContent = text;
    note.hidden = text === "";
  }
}

const TIME_HELP: Record<TimeInputKind, string> = {
  pace: "无法识别：请写 4:30、431 或 4.5（不超过 30:00/km）",
  duration: "无法识别：请写 45:00、1:36:00 或 4500（不超过 24 小时）",
};

const TIME_HELP_HM = "无法识别：请写 1:52（时:分）、1:52:30、152 或 112 分（不超过 24 小时）";

function timeEcho(input: HTMLInputElement): HTMLElement {
  const next = input.nextElementSibling;
  if (next instanceof HTMLElement && next.classList.contains("time-echo")) return next;
  const echo = document.createElement("p");
  echo.className = "time-echo";
  echo.setAttribute("aria-live", "polite");
  echo.hidden = true;
  if (input.id) {
    echo.id = `${input.id}-time-echo`;
    addDescribedBy(input, echo.id);
  }
  input.insertAdjacentElement("afterend", echo);
  return echo;
}

function updateTimeEchoes(form: HTMLFormElement): void {
  for (const input of form.querySelectorAll<HTMLInputElement>("input[data-time]")) {
    const kind = timeKind(input);
    if (!kind) continue;
    const echo = timeEcho(input);
    const options = timeOptions(input);
    const result = interpretTimeInput(input.value, kind, options);
    let text = "";
    if (result.status === "invalid") text = options.hm && kind === "duration" ? TIME_HELP_HM : TIME_HELP[kind];
    else if (result.status === "valid") text = `已理解为 ${describeTimeCanonical(result.canonical, kind)}`;
    setInvalid(input, result.status === "invalid");
    if (result.status === "invalid") echo.dataset.state = "invalid";
    else delete echo.dataset.state;
    echo.textContent = text;
    echo.hidden = text === "";
  }
}

export function bindForm(id: string, render: () => void): void {
  const form = document.getElementById(id);
  if (!(form instanceof HTMLFormElement)) return;
  restorePersisted(form);
  const renderAll = (): void => {
    updateRangeNotes(form);
    updateNumberValidity(form);
    updateTimeEchoes(form);
    render();
  };
  const commitTimeField = (event: Event): boolean => {
    const kind = timeKind(event.target);
    if (!kind || !(event.target instanceof HTMLInputElement)) return false;
    const next = canonicalizeTimeInput(event.target.value, kind, timeOptions(event.target));
    if (next === event.target.value) return false;
    event.target.value = next;
    return true;
  };

  form.addEventListener("input", (event) => {
    if (event.target instanceof HTMLInputElement && timeKind(event.target)) {
      applyTimePunctuation(event.target);
    }
    savePersisted(event.target);
    renderAll();
    syncSameKey(event.target);
  });
  form.addEventListener("change", (event) => {
    commitTimeField(event);
    savePersisted(event.target);
    renderAll();
    syncSameKey(event.target);
  });
  form.addEventListener("focusout", (event) => {
    if (commitTimeField(event)) {
      savePersisted(event.target);
      renderAll();
      syncSameKey(event.target);
    }
  });
  renderAll();
}
