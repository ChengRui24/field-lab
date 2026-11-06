import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, inputValue, readNumber } from "../lib/dom";
import { formatKg } from "../lib/format";
import { estimate1rm, planWeight, roundToPlate, STRENGTH_LOADS } from "../lib/strength";

/** Blank → fallback; typed but invalid or out of range → null. */
function optionalNumber(id: string, fallback: number): number | null {
  return inputValue(id).trim() === "" ? fallback : readNumber(id);
}

function plateKg(value: number): string {
  return formatKg(roundToPlate(value)).replace(/\.0$/, "");
}

function planBlock(oneRm: number, testedReps: number): string {
  const reps = optionalNumber("st-plan-reps", testedReps);
  const rir = optionalNumber("st-plan-rir", 2);
  if (reps === null || rir === null) {
    return `<p class="result-kicker">计划组</p><p class="result-method">计划次数需为 1–12 的整数，RIR 需为 0–4 的整数。</p>`;
  }
  const plan = planWeight(oneRm, reps, rir);
  if (!plan.ok) return `<p class="result-kicker">计划组</p><p class="result-method">${plan.reason}</p>`;
  return `
    <p class="result-kicker">计划：每组 ${reps} 次，留 ${rir} 次（RIR）</p>
    <p class="result-value">${plateKg(plan.rounded)}<small>kg · 按 2.5 kg 取整</small></p>
    <p class="result-method">按 ${plan.repsToFailure} 次力竭（${reps} + ${rir}）反推：Epley ${formatKg(plan.epley)} kg、Brzycki ${formatKg(plan.brzycki)} kg，均值 ${formatKg(plan.value)} kg。</p>
  `;
}

function render(): void {
  const empty = document.getElementById("st-empty");
  const output = document.getElementById("st-output");
  if (!empty || !output) return;

  const weight = readNumber("st-weight");
  const reps = readNumber("st-reps");
  const rir = optionalNumber("st-rir", 0);
  if (weight === null || reps === null || rir === null) {
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
    let load = row.loadNote;
    let extra = "";
    if (row.low !== null && row.high !== null) {
      if (row.high >= 1) {
        load = `${plateKg(chosen * row.low)}<small>kg 起</small>`;
        extra = `<p class="result-goal-how">上限就是 1RM（${formatKg(chosen)} kg），只能做 1 次；多次多组（如 3×5）用的重量要低于它，可用上方「计划组」反推。</p>`;
      } else {
        load = `${plateKg(chosen * row.low)}–${plateKg(chosen * row.high)}<small>kg</small>`;
      }
    }
    return `<div class="result-goal">
      <p class="result-goal-name">${row.name}</p>
      <p class="result-goal-load">${load}</p>
      <p class="result-goal-meta">${row.loadNote} · ${row.volume}</p>
      <p class="result-goal-how">${row.how}</p>
      ${extra}
    </div>`;
  }).join("");

  const pctRows = [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1]
    .map(
      (pct) =>
        `<tr><td class="mono">${Math.round(pct * 100)}%</td><td class="mono">${formatKg(roundToPlate(chosen * pct))} kg <small>（${formatKg(chosen * pct)}）</small></td></tr>`,
    )
    .join("");

  const setText =
    rir > 0
      ? `${formatKg(weight)} kg × ${reps} 次，剩 ${rir} RIR → 按 ${effectiveReps} 次力竭计算`
      : `${formatKg(weight)} kg × ${reps} 次（视为做到力竭）`;

  output.innerHTML = `
    ${planBlock(chosen, reps)}
    <h3 class="result-section">估算 1RM</h3>
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
    <p class="result-lede">按 ACSM 2026 阻力训练立场拆成三种常见目标，重量按 2.5 kg 取整。增肌在 30–100% 1RM 都有效，只要每组接近力竭，所以不给窄的公斤区间。爆发力在文献里常叫 power，指跳、抓、快速推这类训练，不是骑行功率。</p>
    <div class="result-goals">${loadBlocks}</div>
    <h3 class="result-section">%1RM 速查</h3>
    <p class="result-lede">同一估算 1RM 下的常用百分比，按 2.5 kg 取整，括号内为未取整值。</p>
    <table class="result-table">
      <thead><tr><th>%1RM</th><th>重量</th></tr></thead>
      <tbody>${pctRows}</tbody>
    </table>
    ${effectiveReps > 10 ? `<p class="result-method">折算次数超过 10，公式误差明显变大，仅供粗看。</p>` : ""}
  `;
}

bindForm("st-form", render);
initChrome("strength");
