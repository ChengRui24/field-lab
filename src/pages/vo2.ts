import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, checkedRadio, checkedSex, inputValue } from "../lib/dom";
import {
  formatVo2,
  parseDurationToMinutes,
  parseNumber,
  parsePaceToSecPerKm,
} from "../lib/format";
import { cooperVo2, mile15Vo2, rockportVo2, stepTestVo2 } from "../lib/vo2";
import {
  IFT_INTERVAL_FRACTIONS,
  ift3015Vo2,
  iftIntervalDistance,
  legerStageSpeed,
  legerVo2,
  yoyoVo2,
} from "../lib/fieldtests";
import {
  acsmSpeedWarning,
  cyclingVo2,
  runningVo2Acsm,
  walkingVo2,
  wattsToKgmMin,
  ymcaInputProblem,
  ymcaVo2max,
} from "../lib/acsm";

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
      <p class="result-kicker">1.5 英里（2.41 km）计时跑</p>
      <p class="result-value">${formatVo2(vo2)}<small>mL/kg/min</small></p>
      <p class="result-method">VO₂max = 3.5 + 483 ÷ 时间(分钟)。时间 ${mileTime.toFixed(2)} min。</p>
      </div>
    `);
  }

  const rpKg = parseNumber(inputValue("rp-kg"));
  const rpAge = parseNumber(inputValue("rp-age"));
  const rpSex = checkedSex("rp-sex");
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
      <p class="result-method">低体能现场公式（Kline 1987）。体重已按 ×2.205 换算为磅。适合无运动习惯或大 BMI。</p>
      </div>
    `);
  }

  const stSex = checkedSex("st-sex");
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
    const ymArgs = {
      age: ymAge,
      weightKg: ymKg,
      watts1: ymW1,
      hr1: ymHr1,
      watts2: ymW2,
      hr2: ymHr2,
    };
    const problem = ymcaInputProblem(ymArgs);
    const vo2 = ymcaVo2max(ymArgs);
    if (problem === null && vo2 !== null) {
      parts.push(`
      <div class="block">
      <p class="result-kicker">YMCA 式（Tanaka 变体）功率车外推</p>
      <p class="result-value">${formatVo2(vo2)}<small>mL/kg/min</small></p>
      <p class="result-method">两级 VO₂ 对心率连线，外推到 Tanaka HRmax（原版 YMCA 外推到 220 − 年龄）。功已按 ×6.12 换成 kg·m/min。</p>
      </div>
    `);
    } else {
      parts.push(`
      <div class="block">
      <p class="result-kicker">YMCA 式（Tanaka 变体）功率车外推</p>
      <p class="result-method range-note" role="alert">无法计算：${problem ?? "输入无效。"}</p>
      </div>
    `);
    }
  }

  const yyLevel = inputValue("yy-level") === "ir2" ? "ir2" : "ir1";
  const yyM = parseNumber(inputValue("yy-m"));
  if (yyM !== null) {
    const vo2 = yoyoVo2(yyLevel, yyM);
    const label = yyLevel === "ir1" ? "IR1" : "IR2";
    const formula = yyLevel === "ir1" ? "距离 × 0.0084 + 36.4" : "距离 × 0.0136 + 45.3";
    const r = yyLevel === "ir1" ? "0.70" : "0.58";
    parts.push(
      vo2 !== null
        ? `
      <div class="block">
      <p class="result-kicker">Yo-Yo ${label}</p>
      <p class="result-value">${formatVo2(vo2)}<small>mL/kg/min</small></p>
      <p class="result-method">VO₂max = ${formula}（Bangsbo 2008）。距离 ${yyM} m。与实验室值仅 r = ${r}，追踪请直接比距离。</p>
      </div>
    `
        : `
      <div class="block">
      <p class="result-kicker">Yo-Yo ${label}</p>
      <p class="result-method range-note" role="alert">无法计算：距离需在 40–4000 m。</p>
      </div>
    `,
    );
  }

  const srStage = parseNumber(inputValue("sr-stage"));
  const srAge = parseNumber(inputValue("sr-age"));
  if (srStage !== null && srAge !== null) {
    const speed = legerStageSpeed(srStage);
    const vo2 = legerVo2(srStage, srAge);
    if (speed !== null && vo2 !== null) {
      const adult = srAge >= 18;
      parts.push(`
      <div class="block">
      <p class="result-kicker">20 m 往返跑（Léger 1988）</p>
      <p class="result-value">${formatVo2(vo2)}<small>mL/kg/min</small></p>
      <p class="result-method">第 ${srStage} 级 = ${speed.toFixed(1)} km/h。${
        adult
          ? "成人式：年龄固定取 18，约 −27.4 + 6.0 × 速度。"
          : `儿童式：31.025 + 3.238S − 3.248A + 0.1536AS，A = ${srAge}。`
      }</p>
      </div>
    `);
    } else {
      parts.push(`
      <div class="block">
      <p class="result-kicker">20 m 往返跑（Léger 1988）</p>
      <p class="result-method range-note" role="alert">无法计算：级数需为 1–21 的整数，年龄 6–90 岁。</p>
      </div>
    `);
    }
  }

  const iftV = parseNumber(inputValue("ift-v"));
  const iftAge = parseNumber(inputValue("ift-age"));
  const iftKg = parseNumber(inputValue("ift-kg"));
  const iftSex = checkedSex("ift-sex");
  if (iftV !== null) {
    const vo2 =
      iftAge !== null && iftKg !== null && iftSex !== null
        ? ift3015Vo2({ viftKmh: iftV, age: iftAge, sex: iftSex, weightKg: iftKg })
        : null;
    const rows = IFT_INTERVAL_FRACTIONS.map((fraction) => {
      const straight = iftIntervalDistance(iftV, fraction, 15);
      const shuttle = iftIntervalDistance(iftV, fraction, 15, 40);
      if (straight === null || shuttle === null) return "";
      return `<tr>
        <td>${Math.round(fraction * 100)}%</td>
        <td class="mono">${straight.meters.toFixed(1)} m</td>
        <td class="mono">${shuttle.meters.toFixed(1)} m</td>
      </tr>`;
    }).join("");
    if (rows === "") {
      parts.push(`
      <div class="block">
      <p class="result-kicker">30-15 IFT</p>
      <p class="result-method range-note" role="alert">无法计算：V<sub>IFT</sub> 需在 8–28 km/h。</p>
      </div>
    `);
    } else {
      parts.push(`
      <div class="block">
      <p class="result-kicker">30-15 IFT · V<sub>IFT</sub> ${iftV} km/h</p>
      ${
        vo2 !== null
          ? `<p class="result-value">${formatVo2(vo2)}<small>mL/kg/min</small></p>
      <p class="result-method">28.3 − 2.15G − 0.741A − 0.0357W + 0.0586A·V + 1.03V。验证样本为约 16 岁青少年（r = 0.82），成人仅供参考。</p>`
          : `<p class="result-method">补上年龄、体重和性别可估 VO₂max。下面的间歇距离只需要 V<sub>IFT</sub>。</p>`
      }
      <table class="result-table">
        <thead><tr><th>15 s 跑 / 15 s 停</th><th>直线</th><th>40 m 往返</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="result-method">每趟距离 = V<sub>IFT</sub> ÷ 3.6 × 百分比 × 15 s；往返每转身一次扣 0.7 s（Buchheit 2008）。Buchheit 列出的 15 s/15 s 方案用 95–100%（2008 年验证用 95%），90% 是更保守的选择；间歇整体建议范围 85–100%。</p>
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
      const speedWarning = acsmSpeedWarning(metMode, speed);
      parts.push(`
      <div class="block">
      <p class="result-kicker">ACSM ${metMode === "walk" ? "走" : "跑"}</p>
      <p class="result-value">${formatVo2(vo2)}<small>mL/kg/min</small></p>
      <p class="result-method">当前强度摄氧量，不是 VO₂max。S = ${speed.toFixed(0)} m/min，坡度 ${gradePct}%。</p>
      ${speedWarning !== null ? `<p class="field-note range-note">${speedWarning}</p>` : ""}
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
