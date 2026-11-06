import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, inputValue } from "../lib/dom";
import { formatKg, parseNumber } from "../lib/format";
import { estimate1rm, STRENGTH_LOADS } from "../lib/strength";

function render(): void {
  const empty = document.getElementById("st-empty");
  const output = document.getElementById("st-output");
  if (!empty || !output) return;

  const weight = parseNumber(inputValue("st-weight"));
  const reps = parseNumber(inputValue("st-reps"));
  const rir = parseNumber(inputValue("st-rir")) ?? 0;
  if (weight === null || reps === null) {
    empty.hidden = false;
    output.hidden = true;
    output.innerHTML = "";
    return;
  }

  const result = estimate1rm({ weight, reps, rir });
  empty.hidden = true;
  output.hidden = false;
  if (!result.ok) {
    output.innerHTML = `
      <p class="result-kicker">估算 1RM</p>
      <p class="result-method">${result.reason}</p>
    `;
    return;
  }

  const { value: chosen, method, epley, brzycki, effectiveReps } = result;

  const loadBlocks = STRENGTH_LOADS.map((row) => {
    const load =
      row.low !== null && row.high !== null
        ? `${formatKg(chosen * row.low)}–${formatKg(chosen * row.high)}<small>kg</small>`
        : `${row.loadNote}`;
    return `<div class="result-goal">
      <p class="result-goal-name">${row.name}</p>
      <p class="result-goal-load">${load}</p>
      <p class="result-goal-meta">${row.loadNote} · ${row.volume}</p>
      <p class="result-goal-how">${row.how}</p>
    </div>`;
  }).join("");

  const pctRows = [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1]
    .map((pct) => `<tr><td class="mono">${Math.round(pct * 100)}%</td><td class="mono">${formatKg(chosen * pct)} kg</td></tr>`)
    .join("");

  const setText =
    rir > 0
      ? `${formatKg(weight)} kg × ${reps} 次，剩 ${rir} RIR → 按 ${effectiveReps} 次力竭计算`
      : `${formatKg(weight)} kg × ${reps} 次（视为做到力竭）`;

  output.innerHTML = `
    <p class="result-kicker">估算 1RM</p>
    <p class="result-value">${formatKg(chosen)}<small>kg</small></p>
    <p class="result-method">选用 ${method}。</p>
    <table class="result-table">
      <caption class="result-source">由这次次最大组推算：${setText}</caption>
      <thead><tr><th>方法</th><th>1RM</th><th>公式</th></tr></thead>
      <tbody>
        <tr><td>Epley</td><td class="mono">${formatKg(epley)} kg</td><td class="mono">重量 × (1 + 次数/30)</td></tr>
        <tr><td>Brzycki</td><td class="mono">${formatKg(brzycki)} kg</td><td class="mono">重量 × 36 / (37 − 次数)</td></tr>
      </tbody>
    </table>
    <h3 class="result-section">按训练目标给负荷</h3>
    <p class="result-lede">按 ACSM 2026 阻力训练立场拆成三种常见目标。增肌在 30–100% 1RM 都有效，只要每组接近力竭，所以不给窄的公斤区间。爆发力在文献里常叫 power，指跳、抓、快速推这类训练，不是骑行功率。</p>
    <div class="result-goals">${loadBlocks}</div>
    <h3 class="result-section">%1RM 速查</h3>
    <p class="result-lede">同一估算 1RM 下的常用百分比，方便对照杠铃片。</p>
    <table class="result-table">
      <thead><tr><th>%1RM</th><th>重量</th></tr></thead>
      <tbody>${pctRows}</tbody>
    </table>
    ${effectiveReps > 10 ? `<p class="result-method">折算次数超过 10，公式误差明显变大，仅供粗看。</p>` : ""}
  `;
}

bindForm("st-form", render);
initChrome("strength");
