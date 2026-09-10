import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, inputValue } from "../lib/dom";
import { formatKg, parseNumber } from "../lib/format";
import { brzycki1rm, epley1rm, selected1rm, STRENGTH_LOADS } from "../lib/strength";

function render(): void {
  const empty = document.getElementById("st-empty");
  const output = document.getElementById("st-output");
  if (!empty || !output) return;

  const weight = parseNumber(inputValue("st-weight"));
  const reps = parseNumber(inputValue("st-reps"));
  if (weight === null || reps === null || reps < 1) {
    empty.hidden = false;
    output.hidden = true;
    output.innerHTML = "";
    return;
  }

  const epley = epley1rm(weight, reps);
  const brzycki = brzycki1rm(weight, reps);
  const { value: chosen, method } = selected1rm(weight, reps);

  const loadBlocks = STRENGTH_LOADS.map((row) => {
    const low = chosen * row.low;
    const high = chosen * row.high;
    return `<div class="result-goal">
      <p class="result-goal-name">${row.name}</p>
      <p class="result-goal-load">${formatKg(low)}–${formatKg(high)}<small>kg</small></p>
      <p class="result-goal-meta">${Math.round(row.low * 100)}–${Math.round(row.high * 100)}% 1RM · ${row.volume}</p>
      <p class="result-goal-how">${row.how}</p>
    </div>`;
  }).join("");

  const pctRows = [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1]
    .map((pct) => `<tr><td class="mono">${Math.round(pct * 100)}%</td><td class="mono">${formatKg(chosen * pct)} kg</td></tr>`)
    .join("");

  empty.hidden = true;
  output.hidden = false;
  output.innerHTML = `
    <p class="result-kicker">估算 1RM</p>
    <p class="result-value">${formatKg(chosen)}<small>kg</small></p>
    <p class="result-method">选用 ${method}。</p>
    <table class="result-table">
      <caption class="result-source">由这次次最大组推算：${formatKg(weight)} kg × ${Math.round(reps)} 次</caption>
      <thead><tr><th>方法</th><th>1RM</th><th>公式</th></tr></thead>
      <tbody>
        <tr><td>Epley</td><td class="mono">${formatKg(epley)} kg</td><td class="mono">重量 × (1 + 次数/30)</td></tr>
        <tr><td>Brzycki</td><td class="mono">${formatKg(brzycki)} kg</td><td class="mono">重量 × 36 / (37 − 次数)</td></tr>
      </tbody>
    </table>
    <h3 class="result-section">按训练目标给负荷</h3>
    <p class="result-lede">把上面的 1RM 按 ACSM 2026 拆成三种常见目标。爆发力在文献里常叫 power，指跳、抓、快速推这类训练，不是骑行功率。</p>
    <div class="result-goals">${loadBlocks}</div>
    <h3 class="result-section">%1RM 速查</h3>
    <p class="result-lede">同一估算 1RM 下的常用百分比，方便对照杠铃片。</p>
    <table class="result-table">
      <thead><tr><th>%1RM</th><th>重量</th></tr></thead>
      <tbody>${pctRows}</tbody>
    </table>
    ${reps > 10 ? `<p class="result-method">次数超过 10，公式误差明显变大，仅供粗看。</p>` : ""}
  `;
}

bindForm("st-form", render);
initChrome("strength");
