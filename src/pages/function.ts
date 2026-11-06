import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, checkedRadio, checkedSex, inputValue } from "../lib/dom";
import { parseNumber } from "../lib/format";
import {
  chairStandReading,
  enrightLlnOffset,
  gaitSpeedMPerSec,
  gaitSpeedReading,
  gripReading,
  sixMinuteWalkReading,
  SPPB_COMPONENT_LABEL,
  sppbResult,
  tugReading,
} from "../lib/function";

function checked(id: string): boolean {
  const el = document.getElementById(id);
  return el instanceof HTMLInputElement && el.checked;
}

function heldRadio(name: string): boolean | null {
  const raw = checkedRadio(name);
  return raw === null ? null : raw === "1";
}

function setDisabled(id: string, disabled: boolean): void {
  const el = document.getElementById(id);
  if (el instanceof HTMLFieldSetElement) el.disabled = disabled;
}

function sppbBlock(
  gaitM: number | null,
  gaitSec: number | null,
  gaitUnable: boolean,
  sts: number | null,
  stsUnable: boolean,
): string | null {
  const sideBySideHeld = heldRadio("bal-side");
  const semiTandemHeld = heldRadio("bal-semi");
  const tandemRaw = checkedRadio("bal-tandem");
  const tandemSec = tandemRaw === null ? null : parseNumber(tandemRaw);

  setDisabled("bal-semi-group", sideBySideHeld === false);
  setDisabled("bal-tandem-group", sideBySideHeld === false || semiTandemHeld === false);
  const skipNote = document.getElementById("bal-skip-note");
  if (skipNote) {
    const skipped = sideBySideHeld === false ? "并脚站" : semiTandemHeld === false ? "半前后脚" : null;
    skipNote.hidden = skipped === null;
    skipNote.textContent = skipped ? `${skipped}没站满，后面的平衡项不做，记 0 分。` : "";
  }

  const anyInput =
    sideBySideHeld !== null ||
    semiTandemHeld !== null ||
    tandemSec !== null ||
    gaitUnable ||
    gaitSec !== null ||
    stsUnable ||
    sts !== null;
  if (!anyInput) return null;

  const r = sppbResult({
    sideBySideHeld,
    semiTandemHeld,
    tandemSec,
    gaitUnable,
    gaitDistanceM: gaitM,
    gaitSec,
    chairUnable: stsUnable,
    chairSec: sts,
  });
  const sub = (score: number | null): string => (score === null ? "—" : `${score}`);
  const subs = `平衡 ${sub(r.balance)} · 步行 ${sub(r.gait)} · 起坐 ${sub(r.chair)}（各 0–4）`;
  const distanceNote = r.gaitWrongDistance ? "SPPB 需要 4 m 步行时间，当前距离不计分。" : "";

  if (r.total === null || r.band === null) {
    const missing = r.missing.map((c) => SPPB_COMPONENT_LABEL[c]).join(" / ");
    return `
      <div class="block">
        <p class="result-kicker">SPPB 简易体能</p>
        <p class="result-method">还差：${missing}。${distanceNote}${subs}。</p>
      </div>
    `;
  }
  const ewg = r.ewgsop2Low
    ? "≤8 分，达到 EWGSOP2 的体能表现低下切点。"
    : "高于 EWGSOP2 的 ≤8 分体能表现低下切点。";
  return `
    <div class="block">
      <p class="result-kicker">SPPB 简易体能</p>
      <p class="result-value">${r.total}<small>/ 12</small></p>
      <p class="result-method">${r.band.range} 分：${r.band.label}（Guralnik 1994）。${ewg}${subs}。这是筛查，不是诊断。</p>
    </div>
  `;
}

function render(): void {
  const empty = document.getElementById("fn-empty");
  const output = document.getElementById("fn-output");
  if (!empty || !output) return;

  const parts: string[] = [];

  const mwtM = parseNumber(inputValue("mwt-m"));
  const mwtAge = parseNumber(inputValue("mwt-age"));
  const mwtCm = parseNumber(inputValue("mwt-cm"));
  const mwtKg = parseNumber(inputValue("mwt-kg"));
  const mwtSex = checkedSex("mwt-sex");
  if (mwtM !== null && mwtAge !== null && mwtCm !== null && mwtKg !== null && mwtSex !== null) {
    const result = sixMinuteWalkReading({
      distanceM: mwtM,
      sex: mwtSex,
      heightCm: mwtCm,
      age: mwtAge,
      weightKg: mwtKg,
    });
    const method = result.inRange
      ? `Enright 预测 ${Math.round(result.predicted)} m，约为预测值的 ${result.pctPredicted.toFixed(0)}%；正常下限 ${Math.round(result.lln)} m（预测值 − ${enrightLlnOffset(mwtSex)} m）${
          mwtM < result.lln ? "，本次低于正常下限" : ""
        }。`
      : `超出方程适用范围：${result.reason}，只显示实测距离，不给预测值。`;
    parts.push(`
      <div class="block">
        <p class="result-kicker">6 分钟步行</p>
        <p class="result-value">${Math.round(mwtM)}<small>m</small></p>
        <p class="result-method">${method}这是步行功能，不是 VO₂max，也不能单独诊断疾病。</p>
      </div>
    `);
  }

  const gaitM = parseNumber(inputValue("gait-m"));
  const gaitSec = parseNumber(inputValue("gait-sec"));
  const gaitUnable = checked("gait-unable");
  if (!gaitUnable && gaitM !== null && gaitSec !== null) {
    const speed = gaitSpeedMPerSec(gaitM, gaitSec);
    if (speed !== null) {
      const reading = gaitSpeedReading(speed);
      parts.push(`
        <div class="block">
          <p class="result-kicker">常速步行</p>
          <p class="result-value">${speed.toFixed(2)}<small>m/s</small></p>
          <p class="result-method">${reading.headline}。${reading.note} 距离 ${gaitM} m，用时 ${gaitSec} s。</p>
        </div>
      `);
    }
  }

  const sts = parseNumber(inputValue("sts-sec"));
  const stsUnable = checked("sts-unable");
  if (!stsUnable && sts !== null) {
    const reading = chairStandReading(sts);
    parts.push(`
      <div class="block">
        <p class="result-kicker">5 次起坐</p>
        <p class="result-value">${sts.toFixed(1)}<small>s</small></p>
        <p class="result-method">${reading.headline}。${reading.note}</p>
      </div>
    `);
  }

  const sppb = sppbBlock(gaitM, gaitSec, gaitUnable, sts, stsUnable);
  if (sppb !== null) parts.push(sppb);

  const tug = parseNumber(inputValue("tug-sec"));
  if (tug !== null) {
    const reading = tugReading(tug);
    parts.push(`
      <div class="block">
        <p class="result-kicker">起立–行走 TUG</p>
        <p class="result-value">${tug.toFixed(1)}<small>s</small></p>
        <p class="result-method">${reading.headline}。${reading.note}</p>
      </div>
    `);
  }

  const grip = parseNumber(inputValue("grip-kg"));
  const gripSex = checkedSex("grip-sex");
  if (grip !== null && gripSex !== null) {
    const reading = gripReading(grip, gripSex);
    parts.push(`
      <div class="block">
        <p class="result-kicker">握力</p>
        <p class="result-value">${grip.toFixed(1)}<small>kg</small></p>
        <p class="result-method">${reading.headline}。${reading.note}</p>
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

bindForm("fn-form", render);
initChrome("function");
