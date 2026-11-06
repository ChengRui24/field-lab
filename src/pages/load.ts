import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, readNumber } from "../lib/dom";
import { MONOTONY_FLAG, isHighMonotony, readDay, weekSummary, type DayEntry } from "../lib/load";

const DAYS = [1, 2, 3, 4, 5, 6, 7];

function fieldIds(day: number): { rpe: string; minutes: string } {
  return { rpe: `load-d${day}-rpe`, minutes: `load-d${day}-min` };
}

function markInvalid(id: string): void {
  document.getElementById(id)?.setAttribute("aria-invalid", "true");
}

function formatAu(value: number): string {
  return Math.round(value).toLocaleString("zh-CN");
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function render(): void {
  const empty = document.getElementById("load-empty");
  const output = document.getElementById("load-output");
  const msg = document.getElementById("load-msg");
  if (!empty || !output || !msg) return;

  const entries: DayEntry[] = DAYS.map((day) => {
    const ids = fieldIds(day);
    const entry = readDay(day, readNumber(ids.rpe), readNumber(ids.minutes));
    if (entry.status === "error") {
      if (entry.rpeInvalid) markInvalid(ids.rpe);
      if (entry.minutesInvalid) markInvalid(ids.minutes);
    }
    return entry;
  });

  const messages = entries.flatMap((entry) => (entry.status === "error" ? [entry.message] : []));
  msg.hidden = messages.length === 0;
  msg.textContent = messages.length ? `${messages.join("；")}。这几天暂不计入。` : "";

  const sessions = entries.flatMap((entry, index) =>
    entry.status === "ok" ? [{ day: index + 1, ...entry }] : [],
  );

  if (sessions.length === 0) {
    empty.hidden = false;
    output.hidden = true;
    output.innerHTML = "";
    return;
  }

  empty.hidden = true;
  output.hidden = false;

  if (sessions.length === 1) {
    const s = sessions[0];
    output.innerHTML = `
    <p class="result-kicker">第 ${s.day} 天 · 单次课负荷</p>
    <p class="result-value">${formatAu(s.load)}<small>AU</small></p>
    <p class="result-method">RPE ${formatNumber(s.rpe)} × ${formatNumber(s.minutes)} 分钟。再记至少一天，就能看本周负荷、单调度与应变。</p>
  `;
    return;
  }

  const daily = entries.map((entry) => (entry.status === "ok" ? entry.load : 0));
  const week = weekSummary(daily);
  const restDays = daily.filter((load) => load === 0).length;

  let monotonyText: string;
  let reading: string;
  if (week.monotony === null || week.strain === null) {
    monotonyText = "无法定义";
    reading =
      "7 天负荷完全相同，标准差为 0，单调度 = 均值 ÷ 0 没有意义。这本身就说明这一周没有轻重变化。";
  } else {
    monotonyText = week.monotony.toFixed(2);
    reading = isHighMonotony(week.monotony)
      ? `单调度高于 ${MONOTONY_FLAG.toFixed(1)}：Foster 1998 观察到小病多出现在单调度或应变的尖峰之后。这是一个观察，不是诊断；若负荷也高，可以考虑把某几天换成真正的轻松日或休息日。`
      : `单调度不高于 ${MONOTONY_FLAG.toFixed(1)}，这一周有轻重变化。`;
  }

  const strainRow =
    week.strain === null ? "" : `<tr><td>应变</td><td class="mono">${formatAu(week.strain)} AU</td></tr>`;

  const dayRows = DAYS.map((day, index) => {
    const entry = entries[index];
    const detail =
      entry.status === "ok"
        ? `${formatNumber(entry.rpe)} × ${formatNumber(entry.minutes)}`
        : entry.status === "error"
          ? "未计入"
          : "休息";
    return `<tr><td>第 ${day} 天</td><td>${detail}</td><td class="mono">${formatAu(daily[index])}</td></tr>`;
  }).join("");

  output.innerHTML = `
    <p class="result-kicker">本周负荷 · ${sessions.length} 次课、${restDays} 天按 0 计</p>
    <p class="result-value">${formatAu(week.total)}<small>AU</small></p>
    <p class="result-method">${reading}</p>
    <table class="result-table">
      <tbody>
        <tr><td>日均负荷</td><td class="mono">${formatAu(week.mean)} AU</td></tr>
        <tr><td>标准差</td><td class="mono">${formatAu(week.sd)} AU</td></tr>
        <tr><td>单调度</td><td class="mono">${monotonyText}</td></tr>
        ${strainRow}
      </tbody>
    </table>
    <h3 class="result-section">每天</h3>
    <table class="result-table">
      <thead><tr><th>日</th><th>RPE × 分钟</th><th>负荷 AU</th></tr></thead>
      <tbody>${dayRows}</tbody>
    </table>
  `;
}

function initClearWeek(): void {
  const button = document.getElementById("load-clear");
  if (!button) return;
  button.addEventListener("click", () => {
    for (const day of DAYS) {
      const ids = fieldIds(day);
      for (const id of [ids.rpe, ids.minutes]) {
        const input = document.getElementById(id);
        if (!(input instanceof HTMLInputElement)) continue;
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  });
}

bindForm("load-form", render);
initClearWeek();
initChrome("load");
