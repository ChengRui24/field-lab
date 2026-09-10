import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, checkedRadio, inputValue } from "../lib/dom";
import { parseNumber } from "../lib/format";
import { predicted6mwd } from "../lib/acsm";
import {
  chairStandReading,
  gaitSpeedMPerSec,
  gaitSpeedReading,
  gripReading,
  tugReading,
  type Sex,
} from "../lib/function";

function parseSex(raw: string | null): Sex | null {
  if (raw === "male" || raw === "female") return raw;
  return null;
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
  const mwtSex = parseSex(checkedRadio("mwt-sex"));
  if (mwtM !== null && mwtAge !== null && mwtCm !== null && mwtKg !== null && mwtSex !== null) {
    const predicted = predicted6mwd({
      sex: mwtSex,
      heightCm: mwtCm,
      age: mwtAge,
      weightKg: mwtKg,
    });
    const pct = predicted > 0 ? (mwtM / predicted) * 100 : 0;
    parts.push(`
      <div class="block">
        <p class="result-kicker">6 分钟步行</p>
        <p class="result-value">${Math.round(mwtM)}<small>m</small></p>
        <p class="result-method">Enright 预测 ${Math.round(predicted)} m，约为预测值的 ${pct.toFixed(0)}%。这是步行功能，不是 VO₂max，也不能单独诊断疾病。</p>
      </div>
    `);
  }

  const gaitM = parseNumber(inputValue("gait-m"));
  const gaitSec = parseNumber(inputValue("gait-sec"));
  if (gaitM !== null && gaitSec !== null) {
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
  if (sts !== null) {
    const reading = chairStandReading(sts);
    parts.push(`
      <div class="block">
        <p class="result-kicker">5 次起坐</p>
        <p class="result-value">${sts.toFixed(1)}<small>s</small></p>
        <p class="result-method">${reading.headline}。${reading.note}</p>
      </div>
    `);
  }

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
  const gripSex = parseSex(checkedRadio("grip-sex"));
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
