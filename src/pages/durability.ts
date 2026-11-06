import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, checkedRadio, inputValue, readNumber } from "../lib/dom";
import { formatPct, parsePaceToSecPerKm } from "../lib/format";
import { paceToSpeed } from "../lib/critical";
import { DECOUPLING_FLAG, decouplingFromEf, efficiencyFactor } from "../lib/durability";

function syncMode(): void {
  const mode = checkedRadio("dc-mode") ?? "pace";
  const pace = mode === "pace";
  const earlyPace = document.getElementById("dc-early-pace-wrap");
  const latePace = document.getElementById("dc-late-pace-wrap");
  const earlyPower = document.getElementById("dc-early-power-wrap");
  const latePower = document.getElementById("dc-late-power-wrap");
  if (earlyPace) earlyPace.hidden = !pace;
  if (latePace) latePace.hidden = !pace;
  if (earlyPower) earlyPower.hidden = pace;
  if (latePower) latePower.hidden = pace;
}

function render(): void {
  syncMode();
  const empty = document.getElementById("dc-empty");
  const output = document.getElementById("dc-output");
  if (!empty || !output) return;

  const pace = (checkedRadio("dc-mode") ?? "pace") === "pace";
  const earlyHr = readNumber("dc-early-hr");
  const lateHr = readNumber("dc-late-hr");

  let earlyOut: number | null = null;
  let lateOut: number | null = null;
  if (pace) {
    const earlyPace = parsePaceToSecPerKm(inputValue("dc-early-pace"));
    const latePace = parsePaceToSecPerKm(inputValue("dc-late-pace"));
    if (earlyPace !== null) earlyOut = paceToSpeed(earlyPace) * 60;
    if (latePace !== null) lateOut = paceToSpeed(latePace) * 60;
  } else {
    earlyOut = readNumber("dc-early-power");
    lateOut = readNumber("dc-late-power");
  }
  const kicker = pace ? "Pa:HR 脱耦联（配速 / 心率）" : "Pw:HR 脱耦联（功率 / 心率）";

  if (earlyHr === null || lateHr === null || earlyOut === null || lateOut === null) {
    empty.hidden = false;
    output.hidden = true;
    output.innerHTML = "";
    return;
  }

  const early = efficiencyFactor(earlyOut, earlyHr);
  const late = efficiencyFactor(lateOut, lateHr);
  if (early === null || late === null) {
    const reason =
      earlyHr <= 0 || lateHr <= 0
        ? "心率必须大于 0。"
        : pace
          ? "配速必须大于 0。"
          : "功率为 0 时无法计算（滑行、停踩段会把 EF 拉到 0）。请只截取持续踩踏的稳定段，两段平均功率都要大于 0。";
    empty.hidden = true;
    output.hidden = false;
    output.innerHTML = `
    <p class="result-kicker">${kicker}</p>
    <p class="result-method">${reason}</p>
  `;
    return;
  }

  const pct = decouplingFromEf(early, late);
  const per = pace ? "每一下心跳跑出的距离" : "每 1 bpm 心率换来的功率";
  const abs = Math.abs(pct).toFixed(1);
  let conclusion: string;
  if (pct > DECOUPLING_FLAG) {
    conclusion = `后半程${per}比前半少 ${abs}%，超过约 ${DECOUPLING_FLAG}% 的训练常用注意线：可考虑降速或缩短。`;
  } else if (pct > 0) {
    conclusion = `后半程${per}比前半少 ${abs}%，未超过约 ${DECOUPLING_FLAG}% 的注意线，可结合体感判断。`;
  } else {
    conclusion = `后半程${per}没有比前半少（${pct === 0 ? "持平" : `多 ${abs}%`}），心率相对${pace ? "配速" : "功率"}没有往上漂。`;
  }
  const causes =
    pct > 0
      ? `<p class="result-method">热、脱水、坡度都会让这个数变大（2025 <cite>Experimental Physiology</cite> 方法学综述），先排除这些，再把它当成耐久性信号；同类课的趋势比单次值更有用。</p>`
      : "";

  const unit = pace ? "米/次心跳" : "W/bpm";
  const outText = (value: number): string => (pace ? `${Math.round(value)} m/min` : `${Math.round(value)} W`);
  const efRow = (label: string, ef: number, out: number, hr: number): string =>
    `<tr><td>${label}</td><td class="mono">${ef.toFixed(2)} ${unit}<br /><small>${outText(out)} ÷ ${Math.round(hr)} bpm</small></td></tr>`;

  empty.hidden = true;
  output.hidden = false;
  output.innerHTML = `
    <p class="result-kicker">${kicker}</p>
    <p class="result-value">${formatPct(pct)}</p>
    <p class="result-method">${conclusion}</p>
    ${causes}
    <table class="result-table">
      <thead><tr><th>段</th><th>EF（${pace ? "速度" : "功率"} ÷ 心率）</th></tr></thead>
      <tbody>
        ${efRow("前\u2060半", early, earlyOut, earlyHr)}
        ${efRow("后\u2060半", late, lateOut, lateHr)}
      </tbody>
    </table>
    <p class="result-method">EF = ${pace ? "速度" : "功率"} ÷ 心率；脱耦联 = (EF前 − EF后) / EF前 × 100。约 ${DECOUPLING_FLAG}% 是训练实践中的注意线，不是诊断切点。</p>
  `;
}

bindForm("dc-form", render);
initChrome("durability");
