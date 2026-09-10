import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, checkedRadio, inputValue } from "../lib/dom";
import {
  formatVo2,
  parseDurationToMinutes,
  parseNumber,
  parsePaceToSecPerKm,
} from "../lib/format";
import { cooperVo2, mile15Vo2, rockportVo2, stepTestVo2 } from "../lib/vo2";
import { cyclingVo2, runningVo2Acsm, walkingVo2, wattsToKgmMin, ymcaVo2max } from "../lib/acsm";

function parseSex(raw: string | null): "male" | "female" | null {
  if (raw === "male" || raw === "female") return raw;
  return null;
}

function render(): void {
  const empty = document.getElementById("vo2-empty");
  const output = document.getElementById("vo2-output");
  if (!empty || !output) return;

  const parts: string[] = [];

  const cooperM = parseNumber(inputValue("cooper-m"));
  if (cooperM !== null) {
    const vo2 = cooperVo2(cooperM);
    parts.push(`
      <div class="block">
      <p class="result-kicker">Cooper 12 分钟跑</p>
      <p class="result-value">${formatVo2(vo2)}<small>mL/kg/min</small></p>
      <p class="result-method">VO₂max = (距离 − 504.9) ÷ 44.73。距离 ${cooperM} m。</p>
      </div>
    `);
  }

  const mileTime = parseDurationToMinutes(inputValue("mile-time"));
  if (mileTime !== null) {
    const vo2 = mile15Vo2(mileTime);
    parts.push(`
      <div class="block">
      <p class="result-kicker">2.4 km 计时跑</p>
      <p class="result-value">${formatVo2(vo2)}<small>mL/kg/min</small></p>
      <p class="result-method">VO₂max = 3.5 + 483 ÷ 时间(分钟)。时间 ${mileTime.toFixed(2)} min。</p>
      </div>
    `);
  }

  const rpKg = parseNumber(inputValue("rp-kg"));
  const rpAge = parseNumber(inputValue("rp-age"));
  const rpSex = parseSex(checkedRadio("rp-sex"));
  const rpTime = parseDurationToMinutes(inputValue("rp-time"));
  const rpHr = parseNumber(inputValue("rp-hr"));
  if (rpKg !== null && rpAge !== null && rpSex !== null && rpTime !== null && rpHr !== null) {
    const vo2 = rockportVo2({
      weightKg: rpKg,
      age: rpAge,
      sex: rpSex,
      timeMinutes: rpTime,
      endingHr: rpHr,
    });
    parts.push(`
      <div class="block">
      <p class="result-kicker">Rockport 步行</p>
      <p class="result-value">${formatVo2(vo2)}<small>mL/kg/min</small></p>
      <p class="result-method">低体能现场公式。体重已按 ×2.205 换算为磅。适合无运动习惯或大 BMI。</p>
      </div>
    `);
  }

  const stSex = parseSex(checkedRadio("st-sex"));
  const stHr = parseNumber(inputValue("st-hr"));
  if (stSex !== null && stHr !== null) {
    const vo2 = stepTestVo2(stSex, stHr);
    const formula = stSex === "male" ? "111.33 − 0.42 × 心率" : "65.81 − 0.1847 × 心率";
    parts.push(`
      <div class="block">
      <p class="result-kicker">Queen's College 台阶</p>
      <p class="result-value">${formatVo2(vo2)}<small>mL/kg/min</small></p>
      <p class="result-method">${stSex === "male" ? "男性" : "女性"}公式：${formula}。精度约 ±10%，粗略参考。</p>
      </div>
    `);
  }

  const ymAge = parseNumber(inputValue("ym-age"));
  const ymKg = parseNumber(inputValue("ym-kg"));
  const ymW1 = parseNumber(inputValue("ym-w1"));
  const ymHr1 = parseNumber(inputValue("ym-hr1"));
  const ymW2 = parseNumber(inputValue("ym-w2"));
  const ymHr2 = parseNumber(inputValue("ym-hr2"));
  if (
    ymAge !== null &&
    ymKg !== null &&
    ymW1 !== null &&
    ymHr1 !== null &&
    ymW2 !== null &&
    ymHr2 !== null
  ) {
    const vo2 = ymcaVo2max({
      age: ymAge,
      weightKg: ymKg,
      watts1: ymW1,
      hr1: ymHr1,
      watts2: ymW2,
      hr2: ymHr2,
    });
    if (vo2 !== null) {
      parts.push(`
      <div class="block">
      <p class="result-kicker">YMCA 功率车外推</p>
      <p class="result-value">${formatVo2(vo2)}<small>mL/kg/min</small></p>
      <p class="result-method">两级 VO₂ 对心率连线，外推到 Tanaka HRmax。功已按 ×6.12 换成 kg·m/min。</p>
      </div>
    `);
    } else {
      parts.push(`
      <div class="block">
      <p class="result-kicker">YMCA 功率车外推</p>
      <p class="result-method">第二级心率必须高于第一级，才能做线性外推。</p>
      </div>
    `);
    }
  }

  const metMode = checkedRadio("met-mode");
  if (metMode === "walk" || metMode === "run") {
    const paceSec = parsePaceToSecPerKm(inputValue("met-pace"));
    const gradePct = parseNumber(inputValue("met-grade")) ?? 0;
    if (paceSec !== null) {
      const speed = 60000 / paceSec;
      const grade = gradePct / 100;
      const vo2 = metMode === "walk" ? walkingVo2(speed, grade) : runningVo2Acsm(speed, grade);
      parts.push(`
      <div class="block">
      <p class="result-kicker">ACSM ${metMode === "walk" ? "走" : "跑"}</p>
      <p class="result-value">${formatVo2(vo2)}<small>mL/kg/min</small></p>
      <p class="result-method">当前强度摄氧量，不是 VO₂max。S = ${speed.toFixed(0)} m/min，坡度 ${gradePct}%。</p>
      </div>
    `);
    }
  }
  if (metMode === "bike") {
    const watts = parseNumber(inputValue("met-watts"));
    const kg = parseNumber(inputValue("met-kg"));
    if (watts !== null && kg !== null) {
      const vo2 = cyclingVo2(wattsToKgmMin(watts), kg);
      parts.push(`
      <div class="block">
      <p class="result-kicker">ACSM 骑行</p>
      <p class="result-value">${formatVo2(vo2)}<small>mL/kg/min</small></p>
      <p class="result-method">1.8 × 功 / 体重 + 7。当前强度摄氧量，不是 VO₂max。</p>
      </div>
    `);
    }
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

bindForm("vo2-form", render);
initChrome("vo2");
