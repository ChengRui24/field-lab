import { canonicalizeTimeInput, rewriteTimePunctuation, type TimeInputKind } from "./format";

function timeKind(el: EventTarget | null): TimeInputKind | null {
  if (!(el instanceof HTMLInputElement)) return null;
  const kind = el.dataset.time;
  if (kind === "pace" || kind === "duration") return kind;
  return null;
}

function applyTimePunctuation(input: HTMLInputElement): void {
  const next = rewriteTimePunctuation(input.value);
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
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
  const key = target.dataset.persist;
  if (!key) return;
  if (target instanceof HTMLInputElement && target.type === "radio" && !target.checked) return;
  writeStored(key, target.value);
}

export function clearPersisted(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PERSIST_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Same best-effort contract as writeStored.
  }
}

function updateRangeNotes(form: HTMLFormElement): void {
  for (const field of form.querySelectorAll<HTMLInputElement>("input[data-range-note]")) {
    const note = document.getElementById(`${field.id}-range-note`);
    if (!note) continue;
    const value = field.valueAsNumber;
    const min = field.dataset.validMin === undefined ? -Infinity : Number(field.dataset.validMin);
    const max = field.dataset.validMax === undefined ? Infinity : Number(field.dataset.validMax);
    const outside = Number.isFinite(value) && (value < min || value > max);
    note.hidden = !outside;
    note.textContent = outside ? (field.dataset.rangeNote ?? "") : "";
  }
}

export function bindForm(id: string, render: () => void): void {
  const form = document.getElementById(id);
  if (!(form instanceof HTMLFormElement)) return;
  restorePersisted(form);
  const renderAll = (): void => {
    updateRangeNotes(form);
    render();
  };
  const commitTimeField = (event: Event): boolean => {
    const kind = timeKind(event.target);
    if (!kind || !(event.target instanceof HTMLInputElement)) return false;
    const next = canonicalizeTimeInput(event.target.value, kind);
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
  });
  form.addEventListener("change", (event) => {
    commitTimeField(event);
    savePersisted(event.target);
    renderAll();
  });
  form.addEventListener("focusout", (event) => {
    if (commitTimeField(event)) renderAll();
  });
  renderAll();
}
