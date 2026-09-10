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

export function bindForm(id: string, render: () => void): void {
  const form = document.getElementById(id);
  if (!(form instanceof HTMLFormElement)) return;
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
    render();
  });
  form.addEventListener("change", (event) => {
    commitTimeField(event);
    render();
  });
  form.addEventListener("focusout", (event) => {
    if (commitTimeField(event)) render();
  });
  render();
}
