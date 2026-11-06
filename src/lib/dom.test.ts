// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { bindForm, readNumber } from "./dom";

function fire(el: HTMLElement, type: string): void {
  el.dispatchEvent(new Event(type, { bubbles: true }));
}

function echoOf(id: string): HTMLElement {
  const el = document.getElementById(`${id}-time-echo`);
  if (!el) throw new Error("missing echo");
  return el;
}

beforeEach(() => {
  document.body.innerHTML = `
    <form id="f">
      <input id="dur" type="text" data-time="duration" />
      <input id="pace" type="text" data-time="pace" />
      <input id="kg" type="number" min="20" max="300" />
      <input id="age" type="number" data-range-note="超出验证范围" data-valid-min="18" data-valid-max="65" />
      <p id="age-range-note" hidden></p>
    </form>`;
});

describe("time echo", () => {
  it("is created after the input and explains compact input", () => {
    bindForm("f", () => {});
    const input = document.getElementById("dur") as HTMLInputElement;
    const echo = echoOf("dur");
    expect(input.nextElementSibling).toBe(echo);
    expect(echo.className).toBe("time-echo");
    expect(echo.getAttribute("aria-live")).toBe("polite");
    expect(echo.hidden).toBe(true);

    input.value = "120";
    fire(input, "input");
    expect(echo.hidden).toBe(false);
    expect(echo.textContent).toBe("已理解为 1:20");

    fire(input, "change");
    expect(input.value).toBe("1:20");
    expect(echo.hidden).toBe(true);
  });

  it("flags invalid time and does not create duplicates", () => {
    bindForm("f", () => {});
    bindForm("f", () => {});
    expect(document.querySelectorAll("#dur + .time-echo").length).toBe(1);
    expect(document.querySelectorAll(".time-echo").length).toBe(2);

    const input = document.getElementById("dur") as HTMLInputElement;
    input.value = "180";
    fire(input, "input");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(echoOf("dur").hidden).toBe(false);
    expect(echoOf("dur").dataset.state).toBe("invalid");

    input.value = "1:36:00";
    fire(input, "input");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(echoOf("dur").hidden).toBe(true);
  });

  it("commits unit forms on change", () => {
    bindForm("f", () => {});
    const pace = document.getElementById("pace") as HTMLInputElement;
    pace.value = "４分";
    fire(pace, "input");
    expect(pace.value).toBe("4分");
    expect(echoOf("pace").textContent).toBe("已理解为 4:00");
    pace.value = "4分30秒";
    fire(pace, "change");
    expect(pace.value).toBe("4:30");
  });
});

describe("number validity", () => {
  it("sets aria-invalid on out-of-range number inputs and keeps range notes", () => {
    bindForm("f", () => {});
    const kg = document.getElementById("kg") as HTMLInputElement;
    kg.value = "500";
    fire(kg, "input");
    expect(kg.getAttribute("aria-invalid")).toBe("true");
    kg.value = "70";
    fire(kg, "input");
    expect(kg.hasAttribute("aria-invalid")).toBe(false);

    const age = document.getElementById("age") as HTMLInputElement;
    const note = document.getElementById("age-range-note") as HTMLElement;
    age.value = "70";
    fire(age, "input");
    expect(note.hidden).toBe(false);
    expect(note.textContent).toBe("超出验证范围");
  });

  it("readNumber returns null for empty or invalid", () => {
    const kg = document.getElementById("kg") as HTMLInputElement;
    expect(readNumber("kg")).toBeNull();
    kg.value = "72.5";
    expect(readNumber("kg")).toBe(72.5);
    expect(readNumber("missing")).toBeNull();
  });
});
