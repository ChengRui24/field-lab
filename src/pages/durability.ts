import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, checkedRadio, inputValue } from "../lib/dom";
import { formatPct, parseNumber, parsePaceToSecPerKm } from "../lib/format";
import { paceToSpeed } from "../lib/critical";
import { decouplingPercent, workRatio } from "../lib/durability";

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

  const mode = checkedRadio("dc-mode") ?? "pace";
  const earlyHr = parseNumber(inputValue("dc-early-hr"));
  const lateHr = parseNumber(inputValue("dc-late-hr"));

  let earlyExt: number | null = null;
  let lateExt: number | null = null;
  let unit = "";

  if (mode === "pace") {
    const earlyPace = parsePaceToSecPerKm(inputValue("dc-early-pace"));
    const latePace = parsePaceToSecPerKm(inputValue("dc-late-pace"));
    if (earlyPace !== null) earlyExt = paceToSpeed(earlyPace);
    if (latePace !== null) lateExt = paceToSpeed(latePace);
    unit = "心率 / 速度";
  } else {
    earlyExt = parseNumber(inputValue("dc-early-power"));
    lateExt = parseNumber(inputValue("dc-late-power"));
    unit = "心率 / 功率";
  }

  if (earlyHr === null || lateHr === null || earlyExt === null || lateExt === null) {
    empty.hidden = false;
    output.hidden = true;
    output.innerHTML = "";
    return;
  }

  const early = workRatio(earlyHr, earlyExt);
  const late = workRatio(lateHr, lateExt);
  if (early === null || late === null) {
    empty.hidden = false;
    output.hidden = true;
    output.innerHTML = "";
    return;
  }

  const pct = decouplingPercent(early, late);
  const reading =
    pct > 5 ? "后半漂移较明显，可考虑降速或缩短。" : pct > 0 ? "有轻度漂移，可结合体感判断。" : "后半比值未升高。";

  empty.hidden = true;
  output.hidden = false;
  output.innerHTML = `
    <p class="result-kicker">${unit}</p>
    <p class="result-value">${formatPct(pct)}</p>
    <p class="result-method">${reading} 前半比值 ${early.toFixed(3)}，后半 ${late.toFixed(3)}。约 5% 是训练实践中的注意线，不是诊断切点。</p>
  `;
}

bindForm("dc-form", render);
initChrome("durability");
