// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bindForm, clearPersisted, readNumber } from "./dom";

function fire(el: HTMLElement, type: string): void {
  el.dispatchEvent(new Event(type, { bubbles: true }));
}

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  const store = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
  };
  return new Proxy(store, {
    ownKeys: () => Array.from(data.keys()),
    getOwnPropertyDescriptor: (_target, key) =>
      typeof key === "string" && data.has(key)
        ? { enumerable: true, configurable: true, value: data.get(key) }
        : undefined,
  }) as unknown as Storage;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

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
    expect(echo.textContent).toBe("已理解为 1 分 20 秒");

    fire(input, "change");
    expect(input.value).toBe("1:20");
    expect(echo.hidden).toBe(false);
    expect(echo.textContent).toBe("已理解为 1 分 20 秒");

    input.value = "";
    fire(input, "input");
    expect(echo.hidden).toBe(true);
  });

  it("reads h:mm when data-time-hm is toggled on and re-dispatched", () => {
    bindForm("f", () => {});
    const input = document.getElementById("dur") as HTMLInputElement;
    input.value = "1:52";
    fire(input, "input");
    expect(echoOf("dur").textContent).toBe("已理解为 1 分 52 秒");

    input.setAttribute("data-time-hm", "");
    fire(input, "input");
    expect(echoOf("dur").textContent).toBe("已理解为 1 小时 52 分 00 秒");
    fire(input, "change");
    expect(input.value).toBe("1:52:00");

    input.value = "352";
    fire(input, "input");
    expect(echoOf("dur").textContent).toBe("已理解为 3 小时 52 分 00 秒");
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
    expect(echoOf("dur").dataset.state).toBeUndefined();
    expect(echoOf("dur").textContent).toBe("已理解为 1 小时 36 分 00 秒");
  });

  it("commits unit forms on change", () => {
    bindForm("f", () => {});
    const pace = document.getElementById("pace") as HTMLInputElement;
    pace.value = "４分";
    fire(pace, "input");
    expect(pace.value).toBe("4分");
    expect(echoOf("pace").textContent).toBe("已理解为 4 分 00 秒/km");
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

  it("shows a limit note with the label unit and drops the population note meanwhile", () => {
    document.body.innerHTML = `
      <form id="f">
        <label for="kg">体重（kg）</label><input id="kg" type="number" min="30" max="200" />
        <label for="age">年龄（岁）</label>
        <input id="age" type="number" min="10" max="90" data-range-note="超出验证人群" data-valid-min="18" data-valid-max="65" />
        <p id="age-range-note" hidden></p>
        <label for="rhr">静息心率 RHR（resting heart rate，bpm）</label><input id="rhr" type="number" min="30" />
        <label for="n">分几份（可选）</label><input id="n" type="number" max="10" />
      </form>`;
    bindForm("f", () => {});
    expect(document.querySelector(".limit-note")).toBeNull();

    const kg = document.getElementById("kg") as HTMLInputElement;
    kg.value = "500";
    fire(kg, "input");
    const note = document.getElementById("kg-limit-note") as HTMLElement;
    expect(kg.nextElementSibling).toBe(note);
    expect(note.hidden).toBe(false);
    expect(note.textContent).toBe("应在 30–200 kg 之间");
    expect(kg.getAttribute("aria-describedby")).toContain("kg-limit-note");
    kg.value = "70";
    fire(kg, "input");
    expect(note.hidden).toBe(true);
    expect(kg.hasAttribute("aria-invalid")).toBe(false);

    const age = document.getElementById("age") as HTMLInputElement;
    age.value = "5";
    fire(age, "input");
    expect(document.getElementById("age-limit-note")?.textContent).toBe("应在 10–90 岁之间");
    expect(document.getElementById("age-range-note")?.hidden).toBe(true);
    age.value = "70";
    fire(age, "input");
    expect(document.getElementById("age-limit-note")?.hidden).toBe(true);
    expect(document.getElementById("age-range-note")?.hidden).toBe(false);

    const rhr = document.getElementById("rhr") as HTMLInputElement;
    rhr.value = "20";
    fire(rhr, "input");
    expect(document.getElementById("rhr-limit-note")?.textContent).toBe("至少 30 bpm");

    const n = document.getElementById("n") as HTMLInputElement;
    n.value = "11";
    fire(n, "input");
    expect(document.getElementById("n-limit-note")?.textContent).toBe("不超过 10");
  });

  it("readNumber returns null for empty or invalid", () => {
    const kg = document.getElementById("kg") as HTMLInputElement;
    expect(readNumber("kg")).toBeNull();
    kg.value = "72.5";
    expect(readNumber("kg")).toBe(72.5);
    expect(readNumber("missing")).toBeNull();
  });
});

describe("same-key sync", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <form id="a">
        <input id="a-age" type="number" min="10" max="90" data-persist="age" />
        <label><input type="radio" name="a-sex" value="male" data-persist="sex" /> 男</label>
        <label><input type="radio" name="a-sex" value="female" data-persist="sex" /> 女</label>
      </form>
      <form id="b">
        <input id="b-age" type="number" min="10" max="90" data-persist="age" />
        <label><input type="radio" name="b-sex" value="male" data-persist="sex" /> 男</label>
        <label><input type="radio" name="b-sex" value="female" data-persist="sex" /> 女</label>
      </form>`;
  });

  it("mirrors values and radios into other forms and re-renders them once per change", () => {
    let renderA = 0;
    let renderB = 0;
    bindForm("a", () => renderA++);
    bindForm("b", () => renderB++);
    renderA = 0;
    renderB = 0;

    const aAge = document.getElementById("a-age") as HTMLInputElement;
    const bAge = document.getElementById("b-age") as HTMLInputElement;
    aAge.value = "40";
    fire(aAge, "input");
    expect(bAge.value).toBe("40");
    expect(renderA).toBe(1);
    expect(renderB).toBe(1);

    aAge.value = "400";
    fire(aAge, "input");
    expect(bAge.value).toBe("40");

    const bFemale = document.querySelector<HTMLInputElement>('input[name="b-sex"][value="female"]')!;
    bFemale.checked = true;
    fire(bFemale, "change");
    expect(document.querySelector<HTMLInputElement>('input[name="a-sex"]:checked')?.value).toBe("female");
    expect(localStorage.getItem("field-lab:sex")).toBe("female");
  });
});

describe("clearPersisted", () => {
  it("clears profile keys and resets fields but keeps the load log and theme", () => {
    localStorage.clear();
    localStorage.setItem("field-lab:age", "40");
    localStorage.setItem("field-lab:load-d1-rpe", "6");
    localStorage.setItem("field-lab-theme", "dark");
    document.body.innerHTML = `
      <form id="f">
        <input id="age" type="number" data-persist="age" />
        <input id="rpe" type="number" data-persist="load-d1-rpe" />
      </form>`;
    let renders = 0;
    bindForm("f", () => renders++);
    const age = document.getElementById("age") as HTMLInputElement;
    expect(age.value).toBe("40");
    renders = 0;

    clearPersisted();
    expect(age.value).toBe("");
    expect((document.getElementById("rpe") as HTMLInputElement).value).toBe("6");
    expect(renders).toBe(1);
    expect(localStorage.getItem("field-lab:age")).toBeNull();
    expect(localStorage.getItem("field-lab:load-d1-rpe")).toBe("6");
    expect(localStorage.getItem("field-lab-theme")).toBe("dark");
  });
});
