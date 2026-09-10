import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, inputValue } from "../lib/dom";
import { formatGrams, formatKg, parseNumber } from "../lib/format";
import {
  caffeineDose,
  carbDaily,
  carbDuring,
  creatineDose,
  proteinDose,
  sweatRateLitersPerHour,
  type CarbDay,
  type CarbSession,
} from "../lib/fuel";

function parseSession(raw: string): CarbSession {
  if (raw === "short" || raw === "endurance" || raw === "ultra") return raw;
  return "endurance";
}

function parseDay(raw: string): CarbDay {
  if (raw === "light" || raw === "moderate" || raw === "high" || raw === "veryHigh") return raw;
  return "moderate";
}

function render(): void {
  const empty = document.getElementById("fuel-empty");
  const output = document.getElementById("fuel-output");
  if (!empty || !output) return;

  const kg = parseNumber(inputValue("fu-kg"));
  const parts: string[] = [];

  if (kg !== null) {
    const caffeine = caffeineDose(kg);
    const protein = proteinDose(kg);
    const creatine = creatineDose(kg);
    const session = carbDuring(parseSession(inputValue("fu-session")));
    const daily = carbDaily(kg, parseDay(inputValue("fu-day")));
    parts.push(`
      <div class="block">
        <p class="result-kicker">按体重 ${formatKg(kg)} kg</p>
        <table class="result-table">
          <thead><tr><th>项目</th><th>剂量</th><th></th></tr></thead>
          <tbody>
            <tr><td>咖啡因</td><td class="mono">${formatGrams(caffeine.low)}–${formatGrams(caffeine.high)} mg</td><td>3–6 mg/kg</td></tr>
            <tr><td>蛋白 · 耐力</td><td class="mono">${formatGrams(protein.endurance.low)}–${formatGrams(protein.endurance.high)} g/日</td><td>1.2–1.6 g/kg</td></tr>
            <tr><td>蛋白 · 增肌</td><td class="mono">${formatGrams(protein.hypertrophy.low)}–${formatGrams(protein.hypertrophy.high)} g/日</td><td>1.6–2.2 g/kg</td></tr>
            <tr><td>肌酸负荷</td><td class="mono">${formatGrams(creatine.loading)} g/日 × 5–7 天</td><td>0.3 g/kg，可分 3–4 次</td></tr>
            <tr><td>肌酸维持</td><td class="mono">${creatine.maintenanceLow}–${creatine.maintenanceHigh} g/日</td><td>也可跳过负荷、直接维持</td></tr>
            <tr><td>运动中碳水</td><td class="mono">${
              session.high === 0 ? "不必额外补糖" : `${session.low}–${session.high} g/h`
            }</td><td>${session.note}</td></tr>
            <tr><td>日常碳水</td><td class="mono">${formatGrams(daily.low)}–${formatGrams(daily.high)} g/日</td><td>${daily.note}</td></tr>
          </tbody>
        </table>
      </div>
    `);
  }

  const pre = parseNumber(inputValue("sw-pre"));
  const post = parseNumber(inputValue("sw-post"));
  const minutes = parseNumber(inputValue("sw-min"));
  const fluid = parseNumber(inputValue("sw-fluid")) ?? 0;
  const urine = parseNumber(inputValue("sw-urine")) ?? 0;
  if (pre !== null && post !== null && minutes !== null && minutes > 0) {
    const rate = sweatRateLitersPerHour({
      preKg: pre,
      postKg: post,
      fluidL: fluid,
      urineL: urine,
      hours: minutes / 60,
    });
    const lossPct = ((pre - post) / pre) * 100;
    parts.push(`
      <div class="block">
        <p class="result-kicker">出汗率</p>
        <p class="result-value">${rate.toFixed(2)}<small>L/h</small></p>
        <p class="result-method">（前体重 − 后体重 + 摄入 − 尿量）/ 时间。体重变化 ${lossPct.toFixed(1)}%。超过约 2% 时表现常开始受损。</p>
      </div>
    `);
  }

  if (parts.length === 0) {
    empty.hidden = false;
    output.hidden = true;
    output.innerHTML = "";
    return;
  }
  empty.hidden = true;
  output.hidden = false;
  output.innerHTML = parts.join("");
}

bindForm("fuel-form", render);
initChrome("fuel");
