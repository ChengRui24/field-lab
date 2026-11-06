import "../styles/base.css";
import "../styles/vo2.css";
import { initChrome } from "../chrome";
import { bindForm, checkedRadio, checkedSex, inputValue, readNumber, type Sex } from "../lib/dom";
import { formatVo2, parseDurationToMinutes, parsePaceToSecPerKm } from "../lib/format";
import { cooperVo2, mile15Vo2, rockportVo2, stepTestVo2 } from "../lib/vo2";
import {
  IFT_INTERVAL_FRACTIONS,
  ift3015Vo2,
  iftIntervalDistance,
  legerStageSpeed,
  legerVo2,
  yoyoVo2,
} from "../lib/fieldtests";
import {
  acsmSpeedWarning,
  cyclingVo2,
  runningVo2Acsm,
  walkingVo2,
  wattsToKgmMin,
  ymcaInputProblem,
  ymcaVo2max,
} from "../lib/acsm";

const PROFILE_KEYS = ["age", "sex", "weight", "height"] as const;
type ProfileKey = (typeof PROFILE_KEYS)[number];

const PROFILE_LABEL: Record<ProfileKey, string> = {
  age: "年龄",
  sex: "性别",
  weight: "体重",
  height: "身高",
};

/** Profile keys whose value came from storage on load and has not been typed over since. */
const restored = new Set<ProfileKey>();

/** Test card the user last focused or typed in; 换人 refocuses there instead of the first card. */
let lastCard: Element | null = null;

function profileKey(el: EventTarget | null): ProfileKey | null {
  if (!(el instanceof HTMLInputElement)) return null;
  const key = el.dataset.persist;
  return PROFILE_KEYS.find((k) => k === key) ?? null;
}

function profileFields(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>("#vo2-form input[data-persist]")).filter(
    (field) => profileKey(field) !== null,
  );
}

function currentProfileValue(key: ProfileKey): string | null {
  for (const field of profileFields()) {
    if (profileKey(field) !== key) continue;
    if (field.type === "radio") {
      if (field.checked) return field.value;
    } else if (field.value !== "") {
      return field.value;
    }
  }
  return null;
}

function formatProfileValue(key: ProfileKey, value: string): string {
  if (key === "age") return `${value} 岁`;
  if (key === "sex") return value === "male" ? "男" : "女";
  if (key === "weight") return `${value} kg`;
  return `${value} cm`;
}

function updateProfileBanner(): void {
  const banner = document.getElementById("vo2-profile");
  const text = document.getElementById("vo2-profile-text");
  if (!banner || !text) return;
  const parts: string[] = [];
  for (const key of PROFILE_KEYS) {
    if (!restored.has(key)) continue;
    const value = currentProfileValue(key);
    if (value !== null) parts.push(formatProfileValue(key, value));
  }
  banner.hidden = parts.length === 0;
  text.textContent = parts.length === 0 ? "" : `沿用上次：${parts.join(" · ")}`;
}

function clearProfile(): void {
  restored.clear();
  const fields = profileFields();
  for (const field of fields) {
    if (field.type === "radio") field.checked = false;
    else field.value = "";
  }
  for (const field of fields) field.dispatchEvent(new Event("input", { bubbles: true }));
  // Unchecking a radio never reaches storage through the input event, so drop the keys here.
  for (const key of PROFILE_KEYS) {
    try {
      localStorage.removeItem(`field-lab:${key}`);
    } catch {
      // Storage may be unavailable; the fields are already cleared.
    }
  }
  const target = fields.find((field) => lastCard?.contains(field)) ?? fields[0];
  if (!target) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "center" });
}

type Profile = { age?: number; sex?: Sex; weightKg?: number };

/** "按 15 岁 · 女 · 52 kg", flagged when any of the used values was carried over from last time. */
function profileFlag(profile: Profile): string {
  const used: ProfileKey[] = [];
  const parts: string[] = [];
  if (profile.age !== undefined) {
    used.push("age");
    parts.push(`${profile.age} 岁`);
  }
  if (profile.sex !== undefined) {
    used.push("sex");
    parts.push(profile.sex === "male" ? "男" : "女");
  }
  if (profile.weightKg !== undefined) {
    used.push("weight");
    parts.push(`${profile.weightKg} kg`);
  }
  const text = `按 ${parts.join(" · ")}`;
  const stale = used.filter((key) => restored.has(key));
  if (stale.length === 0) return `<p class="result-flag" data-tone="neutral">${text}</p>`;
  const which = stale.length === used.length ? "" : stale.map((key) => PROFILE_LABEL[key]).join("、");
  return `<p class="result-flag" data-tone="caution">${text}（${which}沿用上次，<a href="#vo2-profile">不是这个人？</a>）</p>`;
}

class Needs {
  private missing: string[] = [];
  private invalid: string[] = [];

  private note(raw: string, label: string): void {
    (raw.trim() === "" ? this.missing : this.invalid).push(label);
  }

  num(id: string, label: string): number | null {
    const value = readNumber(id);
    if (value === null) this.note(inputValue(id), label);
    return value;
  }

  duration(id: string, label: string): number | null {
    const value = parseDurationToMinutes(inputValue(id));
    if (value === null) this.note(inputValue(id), label);
    return value;
  }

  pace(id: string, label: string): number | null {
    const value = parsePaceToSecPerKm(inputValue(id));
    if (value === null) this.note(inputValue(id), label);
    return value;
  }

  sex(name: string): Sex | null {
    const value = checkedSex(name);
    if (value === null) this.missing.push("性别");
    return value;
  }

  get ok(): boolean {
    return this.missing.length === 0 && this.invalid.length === 0;
  }

  text(): string {
    const parts: string[] = [];
    if (this.missing.length > 0) parts.push(`还差：${this.missing.join("、")}`);
    if (this.invalid.length > 0) parts.push(`需修正：${this.invalid.join("、")}`);
    return parts.join("；");
  }
}

const UNIT = "<small>mL/kg/min</small>";

function card(title: string, body: string): string {
  return `<p class="result-kicker">${title}</p>${body}`;
}

function pending(title: string, needs: Needs, prefix = ""): string {
  return card(title, `<p class="result-empty">${prefix}${needs.text()}</p>`);
}

function failure(title: string, message: string): string {
  return card(title, `<p class="result-method range-note">无法计算：${message}</p>`);
}

function vo2maxValue(vo2: number): string {
  return `<p class="result-value">${formatVo2(vo2)}${UNIT}</p>`;
}

const lastHtml = new Map<string, string>();

/** Only touch a slot when its content changes, so each aria-live region announces its own test. */
function setSlot(id: string, html: string): void {
  if (lastHtml.get(id) === html) return;
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = html;
  lastHtml.set(id, html);
}

function renderCooper(): string {
  const title = "Cooper 12 分钟跑 · 结果";
  const needs = new Needs();
  const meters = needs.num("cooper-m", "12 分钟距离");
  if (meters === null) return pending(title, needs);
  return card(
    title,
    `${vo2maxValue(cooperVo2(meters))}
    <p class="result-method">VO₂max = (距离 − 504.9) ÷ 44.73。距离 ${meters} m。</p>`,
  );
}

function renderMile(): string {
  const title = "1.5 英里（2.41 km）计时跑 · 结果";
  const needs = new Needs();
  const minutes = needs.duration("mile-time", "完成时间");
  if (minutes === null) return pending(title, needs);
  return card(
    title,
    `${vo2maxValue(mile15Vo2(minutes))}
    <p class="result-method">VO₂max = 3.5 + 483 ÷ 时间(分钟)。时间 ${minutes.toFixed(2)} min。</p>`,
  );
}

function renderRockport(): string {
  const title = "Rockport 步行 · 结果";
  const needs = new Needs();
  const time = needs.duration("rp-time", "1.6 km 用时");
  const hr = needs.num("rp-hr", "即刻心率");
  const age = needs.num("rp-age", "年龄");
  const sex = needs.sex("rp-sex");
  const kg = needs.num("rp-kg", "体重");
  if (time === null || hr === null || age === null || sex === null || kg === null) {
    return pending(title, needs);
  }
  const vo2 = rockportVo2({ weightKg: kg, age, sex, timeMinutes: time, endingHr: hr });
  return card(
    title,
    `${vo2maxValue(vo2)}
    ${profileFlag({ age, sex, weightKg: kg })}
    <p class="result-method">低体能现场公式（Kline 1987）。体重已按 ×2.205 换算为磅。适合无运动习惯或大 BMI。</p>`,
  );
}

function renderStep(): string {
  const title = "Queen's College 台阶 · 结果";
  const needs = new Needs();
  const hr = needs.num("st-hr", "恢复心率");
  const sex = needs.sex("st-sex");
  if (hr === null || sex === null) return pending(title, needs);
  const formula = sex === "male" ? "111.33 − 0.42 × 心率" : "65.81 − 0.1847 × 心率";
  return card(
    title,
    `${vo2maxValue(stepTestVo2(sex, hr))}
    ${profileFlag({ sex })}
    <p class="result-method">${sex === "male" ? "男性" : "女性"}公式：${formula}。精度约 ±10%，粗略参考。</p>`,
  );
}

function renderYmca(): string {
  const title = "YMCA 式（Tanaka 变体）功率车 · 结果";
  const needs = new Needs();
  const watts1 = needs.num("ym-w1", "负荷 1");
  const hr1 = needs.num("ym-hr1", "心率 1");
  const watts2 = needs.num("ym-w2", "负荷 2");
  const hr2 = needs.num("ym-hr2", "心率 2");
  const age = needs.num("ym-age", "年龄");
  const weightKg = needs.num("ym-kg", "体重");
  if (
    watts1 === null ||
    hr1 === null ||
    watts2 === null ||
    hr2 === null ||
    age === null ||
    weightKg === null
  ) {
    return pending(title, needs);
  }
  const args = { age, weightKg, watts1, hr1, watts2, hr2 };
  const problem = ymcaInputProblem(args);
  const vo2 = ymcaVo2max(args);
  if (problem !== null || vo2 === null) return failure(title, problem ?? "输入无效。");
  return card(
    title,
    `${vo2maxValue(vo2)}
    ${profileFlag({ age, weightKg })}
    <p class="result-method">两级 VO₂ 对心率连线，外推到 Tanaka HRmax（原版 YMCA 外推到 220 − 年龄）。功已按 ×6.12 换成 kg·m/min。</p>`,
  );
}

function renderYoyo(): string {
  const level = inputValue("yy-level") === "ir2" ? "ir2" : "ir1";
  const label = level === "ir1" ? "IR1" : "IR2";
  const title = `Yo-Yo ${label} · 结果`;
  const needs = new Needs();
  const meters = needs.num("yy-m", "总距离");
  if (meters === null) return pending(title, needs);
  const vo2 = yoyoVo2(level, meters);
  if (vo2 === null) return failure(title, "距离需在 40–4000 m。");
  const formula = level === "ir1" ? "距离 × 0.0084 + 36.4" : "距离 × 0.0136 + 45.3";
  const r = level === "ir1" ? "0.70" : "0.58";
  return card(
    title,
    `${vo2maxValue(vo2)}
    <p class="result-method">VO₂max = ${formula}（Bangsbo 2008）。距离 ${meters} m。与实验室值仅 r = ${r}，追踪请直接比距离。</p>`,
  );
}

function renderShuttle(): string {
  const title = "20 m 往返跑（Léger 1988）· 结果";
  const needs = new Needs();
  const stage = needs.num("sr-stage", "级数");
  const age = needs.num("sr-age", "年龄");
  if (stage === null || age === null) return pending(title, needs);
  const speed = legerStageSpeed(stage);
  const vo2 = legerVo2(stage, age);
  if (speed === null || vo2 === null) return failure(title, "级数需为 1–21 的整数。");
  const method =
    age >= 18
      ? "成人式：年龄固定取 18，约 −27.4 + 6.0 × 速度。"
      : `儿童式：31.025 + 3.238S − 3.248A + 0.1536AS，A = ${age}。`;
  return card(
    title,
    `${vo2maxValue(vo2)}
    ${profileFlag({ age })}
    <p class="result-method">第 ${stage} 级 = ${speed.toFixed(1)} km/h。${method}</p>`,
  );
}

function renderIft(): string {
  const needs = new Needs();
  const vift = needs.num("ift-v", "V<sub>IFT</sub>");
  if (vift === null) return pending("30-15 IFT · 结果", needs);
  const title = `30-15 IFT · V<sub>IFT</sub> ${vift} km/h`;
  const rows = IFT_INTERVAL_FRACTIONS.map((fraction) => {
    const straight = iftIntervalDistance(vift, fraction, 15);
    const shuttle = iftIntervalDistance(vift, fraction, 15, 40);
    if (straight === null || shuttle === null) return "";
    return `<tr>
        <td>${Math.round(fraction * 100)}%</td>
        <td class="mono">${straight.meters.toFixed(1)} m</td>
        <td class="mono">${shuttle.meters.toFixed(1)} m</td>
      </tr>`;
  }).join("");
  if (rows === "") return failure(title, "V<sub>IFT</sub> 需在 8–28 km/h。");

  const profileNeeds = new Needs();
  const age = profileNeeds.num("ift-age", "年龄");
  const sex = profileNeeds.sex("ift-sex");
  const weightKg = profileNeeds.num("ift-kg", "体重");
  const vo2 =
    age !== null && sex !== null && weightKg !== null
      ? ift3015Vo2({ viftKmh: vift, age, sex, weightKg })
      : null;
  const vo2Html =
    vo2 !== null && age !== null && sex !== null && weightKg !== null
      ? `${vo2maxValue(vo2)}
    ${profileFlag({ age, sex, weightKg })}
    <p class="result-method">28.3 − 2.15G − 0.741A − 0.0357W + 0.0586A·V + 1.03V。验证样本为约 16 岁青少年（r = 0.82），成人仅供参考。</p>`
      : `<p class="result-empty">估 VO₂max ${profileNeeds.text()}。下面的间歇距离只需要 V<sub>IFT</sub>。</p>`;
  return card(
    title,
    `${vo2Html}
    <table class="result-table">
      <thead><tr><th>15 s 跑 / 15 s 停</th><th>直线</th><th>40 m 往返</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="result-method">每趟距离 = V<sub>IFT</sub> ÷ 3.6 × 百分比 × 15 s；往返每转身一次扣 0.7 s（Buchheit 2008）。Buchheit 列出的 15 s/15 s 方案用 95–100%（2008 年验证用 95%），90% 是更保守的选择；间歇整体建议范围 85–100%。</p>`,
  );
}

function renderAcsm(): string {
  const mode = checkedRadio("met-mode");
  const note = "这个强度的摄氧量，不是 VO₂max";
  if (mode !== "walk" && mode !== "run" && mode !== "bike") {
    return card(`ACSM 代谢式 · ${note}`, `<p class="result-empty">还差：方式（走 / 跑 / 骑）</p>`);
  }
  const modeLabel = mode === "walk" ? "走" : mode === "run" ? "跑" : "骑";
  const title = `ACSM ${modeLabel} · ${note}`;
  const needs = new Needs();
  const minor = (vo2: number): string => `<p class="result-value vo2-minor">${formatVo2(vo2)}${UNIT}</p>`;

  if (mode === "bike") {
    const watts = needs.num("met-watts", "功率");
    const kg = needs.num("met-kg", "体重");
    if (watts === null || kg === null) return pending(title, needs);
    return card(
      title,
      `${minor(cyclingVo2(wattsToKgmMin(watts), kg))}
      ${profileFlag({ weightKg: kg })}
      <p class="result-method">1.8 × 功 / 体重 + 7，功已按 ×6.12 换成 kg·m/min。</p>`,
    );
  }

  const paceSec = needs.pace("met-pace", "配速");
  const gradeRaw = inputValue("met-grade").trim();
  const gradeValue = gradeRaw === "" ? 0 : needs.num("met-grade", "坡度");
  if (paceSec === null || gradeValue === null) return pending(title, needs);
  const speed = 60000 / paceSec;
  const grade = gradeValue / 100;
  const vo2 = mode === "walk" ? walkingVo2(speed, grade) : runningVo2Acsm(speed, grade);
  const speedWarning = acsmSpeedWarning(mode, speed);
  return card(
    title,
    `${minor(vo2)}
    <p class="result-method">S = ${speed.toFixed(0)} m/min，坡度 ${gradeValue}%。可用来对照某个配速占你 VO₂max 的比例。</p>
    ${speedWarning !== null ? `<p class="field-note range-note">${speedWarning}</p>` : ""}`,
  );
}

function render(): void {
  updateProfileBanner();
  setSlot("cooper-result", renderCooper());
  setSlot("mile-result", renderMile());
  setSlot("rockport-result", renderRockport());
  setSlot("step-result", renderStep());
  setSlot("ymca-result", renderYmca());
  setSlot("yoyo-result", renderYoyo());
  setSlot("shuttle-result", renderShuttle());
  setSlot("ift-result", renderIft());
  setSlot("acsm-result", renderAcsm());
}

const form = document.getElementById("vo2-form");
form?.addEventListener("focusin", (event) => {
  if (event.target instanceof Element) lastCard = event.target.closest(".vo2-test") ?? lastCard;
});
form?.addEventListener("input", (event) => {
  if (!event.isTrusted) return;
  if (event.target instanceof Element) lastCard = event.target.closest(".vo2-test") ?? lastCard;
  const key = profileKey(event.target);
  if (key) restored.delete(key);
});
document.getElementById("vo2-profile-clear")?.addEventListener("click", clearProfile);

bindForm("vo2-form", render);
for (const key of PROFILE_KEYS) {
  if (currentProfileValue(key) !== null) restored.add(key);
}
render();
initChrome("vo2");
