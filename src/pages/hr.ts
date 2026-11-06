import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, checkedRadio, checkedSex, readNumber } from "../lib/dom";
import { formatBpm, formatBpmRange } from "../lib/format";
import {
  foxHrMax,
  HRMAX_METHOD_LABEL,
  type HrFormulaChoice,
  gulatiHrMax,
  gulatiRangeNote,
  HRMAX_ZONES,
  KARVONEN_ZONES,
  karvonen,
  LT_COEFFICIENTS,
  restingHrProblem,
  selectedHrMax,
  tanakaHrMax,
} from "../lib/hr";

function zoneRows(
  hrMax: number,
  resting: number | null,
): { karvonen: string; hrMaxPct: string } {
  const hrMaxPct = HRMAX_ZONES.map((zone) => {
    const low = hrMax * zone.low;
    const high = hrMax * zone.high;
    return `<tr>
      <td>${zone.name}</td>
      <td class="mono">${formatBpmRange(low, high)}</td>
      <td class="mono">${Math.round(zone.low * 100)}–${Math.round(zone.high * 100)}% HRmax</td>
    </tr>`;
  }).join("");

  if (resting === null) {
    return { karvonen: "", hrMaxPct };
  }

  const hrr = hrMax - resting;
  const karvonenHtml = KARVONEN_ZONES.map((zone) => {
    const low = karvonen(resting, hrr, zone.low);
    const high = karvonen(resting, hrr, zone.high);
    return `<tr>
      <td>${zone.name}</td>
      <td class="mono">${formatBpmRange(low, high)}</td>
      <td class="mono">${Math.round(zone.low * 100)}–${Math.round(zone.high * 100)}% HRR</td>
      <td>${zone.physiology}</td>
      <td>${zone.talk}</td>
    </tr>`;
  }).join("");

  return { karvonen: karvonenHtml, hrMaxPct };
}

function ltBlock(hrMax: number, resting: number | null): string {
  const untrained = LT_COEFFICIENTS.untrained;
  const trained = LT_COEFFICIENTS.trained;

  if (resting === null) {
    const band = (b: { low: number; high: number }) => formatBpmRange(hrMax * b.low, hrMax * b.high);
    return `
      <p class="result-kicker">LT1 / LT2 心率 · %HRmax 对照（经验估计）</p>
      <table class="result-table">
        <thead>
          <tr><th></th><th>无运动习惯</th><th>有训练习惯</th></tr>
        </thead>
        <tbody>
          <tr><td>LT1</td><td class="mono">${band(untrained.lt1HrMax)}</td><td class="mono">${band(trained.lt1HrMax)}</td></tr>
          <tr><td>LT2</td><td class="mono">${band(untrained.lt2HrMax)}</td><td class="mono">${band(trained.lt2HrMax)}</td></tr>
        </tbody>
      </table>
      <p class="result-method">未填静息心率。上表把 %HRR 系数按典型静息心率（无习惯约 70、训练者约 55 bpm）换算成 %HRmax，系数本身为经验估计，无单一文献出处。补测晨脉后改为 Karvonen，结果才对应你自己的静息心率。</p>
    `;
  }

  const hrr = hrMax - resting;
  const row = (
    label: string,
    uLow: number,
    uHigh: number,
    tLow: number,
    tHigh: number,
  ) => `<tr>
    <td>${label}</td>
    <td class="mono">${formatBpmRange(karvonen(resting, hrr, uLow), karvonen(resting, hrr, uHigh))}</td>
    <td class="mono">${formatBpmRange(karvonen(resting, hrr, tLow), karvonen(resting, hrr, tHigh))}</td>
  </tr>`;

  return `
    <p class="result-kicker">LT1 / LT2 心率 · Karvonen（经验估计）</p>
    <table class="result-table">
      <thead>
        <tr><th></th><th>无运动习惯</th><th>有训练习惯</th></tr>
      </thead>
      <tbody>
        ${row("LT1", untrained.lt1Karvonen.low, untrained.lt1Karvonen.high, trained.lt1Karvonen.low, trained.lt1Karvonen.high)}
        ${row("LT2", untrained.lt2Karvonen.low, untrained.lt2Karvonen.high, trained.lt2Karvonen.low, trained.lt2Karvonen.high)}
      </tbody>
    </table>
    <p class="result-method">LT1 / LT2 系数为经验估计，无单一文献出处。LT1 两组都取 65–70% HRR；LT2 无习惯者 80–83% HRR，训练者 85–88% HRR。</p>
  `;
}

function readFormula(): HrFormulaChoice {
  const raw = checkedRadio("formula");
  return raw === "tanaka" || raw === "gulati" ? raw : "auto";
}

/** Z2 of the primary method: Karvonen when RHR is known, %HRmax otherwise. */
function easyBand(hrMax: number, resting: number | null): { low: number; high: number; basis: string } {
  if (resting !== null) {
    const z2 = KARVONEN_ZONES.find((zone) => zone.id === "z2")!;
    const hrr = hrMax - resting;
    return {
      low: karvonen(resting, hrr, z2.low),
      high: karvonen(resting, hrr, z2.high),
      basis: `Z2 = ${Math.round(z2.low * 100)}–${Math.round(z2.high * 100)}% HRR（Karvonen）`,
    };
  }
  const z2 = HRMAX_ZONES.find((zone) => zone.id === "z2")!;
  return {
    low: hrMax * z2.low,
    high: hrMax * z2.high,
    basis: `Z2 = ${Math.round(z2.low * 100)}–${Math.round(z2.high * 100)}% HRmax；有运动习惯者通常偏低，补上静息心率更准`,
  };
}

function render(): void {
  const empty = document.getElementById("hr-empty");
  const output = document.getElementById("hr-output");
  const detail = document.getElementById("hr-detail");
  if (!empty || !output || !detail) return;

  const age = readNumber("age");
  const rhr = readNumber("rhr");
  const measured = readNumber("measured");
  const sex = checkedSex("sex");
  const formula = readFormula();

  if (age === null && measured === null) {
    empty.hidden = false;
    output.hidden = true;
    detail.hidden = true;
    output.innerHTML = "";
    detail.innerHTML = "";
    return;
  }

  empty.hidden = true;
  output.hidden = false;
  detail.hidden = false;

  const tanaka = age !== null ? tanakaHrMax(age) : null;
  const gulati = age !== null ? gulatiHrMax(age) : null;
  const fox = age !== null ? foxHrMax(age) : null;
  const chosen = selectedHrMax({ age, sex, measured, formula });
  if (!chosen) return;

  const rhrProblem = rhr !== null ? restingHrProblem(chosen.value, rhr) : null;
  const gulatiNote = chosen.method === "gulati" ? gulatiRangeNote(sex, age) : null;
  const mark = (method: string) => (method === chosen.method ? ' class="used"' : "");
  const gulatiComment =
    sex === "female" ? (age !== null && age < 35 ? "35 岁以下未经验证" : "35 岁及以上女性") : "女性专用";

  const hrMaxTable = `
    <p class="result-kicker">最大心率</p>
    <p class="result-value">${formatBpm(chosen.value)}<small>bpm</small></p>
    <p class="result-method">选用 <strong>${HRMAX_METHOD_LABEL[chosen.method]}</strong>${
      rhr !== null && rhrProblem === null ? ` · HRR ${formatBpm(chosen.value - rhr)} bpm` : ""
    }</p>
    <table class="result-table">
      <thead><tr><th>方法</th><th>HRmax</th><th>说明</th></tr></thead>
      <tbody>
        ${tanaka !== null ? `<tr${mark("tanaka")}><td>Tanaka</td><td class="mono">${formatBpm(tanaka)}</td><td>普通人群推荐</td></tr>` : ""}
        ${gulati !== null ? `<tr${mark("gulati")}><td>Gulati</td><td class="mono">${formatBpm(gulati)}</td><td>${gulatiComment}</td></tr>` : ""}
        ${fox !== null ? `<tr><td>Fox</td><td class="mono">${formatBpm(fox)}</td><td>仅对照</td></tr>` : ""}
        ${
          measured !== null
            ? `<tr${mark("measured")}><td>实测</td><td class="mono">${formatBpm(measured)}</td><td>覆盖公式</td></tr>`
            : `<tr><td>实测</td><td class="mono">—</td><td>未填</td></tr>`
        }
      </tbody>
    </table>
    ${gulatiNote !== null ? `<p class="result-method range-note table-after-note">${gulatiNote}</p>` : ""}
  `;

  if (rhrProblem !== null) {
    output.innerHTML = hrMaxTable;
    detail.innerHTML = `<p class="result-method range-note" role="alert">${rhrProblem}</p>`;
    return;
  }

  const easy = easyBand(chosen.value, rhr);
  const easyHeadline = `
    <p class="result-kicker">日常轻松跑（能说完整句子）</p>
    <p class="result-value">${formatBpmRange(easy.low, easy.high)}<small>bpm</small></p>
    <p class="result-method">日常轻松跑：约 ${formatBpmRange(easy.low, easy.high)} bpm。${easy.basis}。</p>
  `;

  const zones = zoneRows(chosen.value, rhr);
  const zoneCaveat =
    "分区按心率百分比划分，边界不等于 LT1 / LT2；LT 心率见下方，另算且更粗略。";
  const karvonenTable =
    rhr === null
      ? `<p class="result-kicker">五区 · %HRmax</p>
         <p class="result-method">未填静息心率。以下为手表常用的 %HRmax 五区，训练者会系统性偏低。补上 RHR 后改用 Karvonen。${zoneCaveat}</p>
         <table class="result-table">
           <thead><tr><th>分区</th><th>心率 bpm</th><th>公式</th></tr></thead>
           <tbody>${zones.hrMaxPct}</tbody>
         </table>`
      : `<p class="result-kicker">五区 · Karvonen</p>
         <p class="result-method">${zoneCaveat}</p>
         <table class="result-table">
           <thead><tr><th>分区</th><th>心率 bpm</th><th>公式</th><th>用途</th><th>谈话测试</th></tr></thead>
           <tbody>${zones.karvonen}</tbody>
         </table>
         <details class="method-details">
           <summary>对照：%HRmax 五区（勿用于训练者）</summary>
           <p class="result-method">手表默认的 %HRmax 分区 Z2 通常只有 60–70% HRmax，对有运动习惯者偏低。</p>
           <table class="result-table">
             <thead><tr><th>分区</th><th>%HRmax bpm</th><th>公式</th></tr></thead>
             <tbody>${zones.hrMaxPct}</tbody>
           </table>
         </details>`;

  output.innerHTML = easyHeadline + hrMaxTable;
  detail.innerHTML = karvonenTable + ltBlock(chosen.value, rhr);
}

bindForm("hr-form", render);
initChrome("hr");
