import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, checkedRadio, inputValue } from "../lib/dom";
import {
  formatBpm,
  formatBpmRange,
  parseNumber,
} from "../lib/format";
import {
  foxHrMax,
  gulatiHrMax,
  HRMAX_ZONES,
  KARVONEN_ZONES,
  karvonen,
  LT_COEFFICIENTS,
  selectedHrMax,
  tanakaHrMax,
  type Sex,
} from "../lib/hr";

function parseSex(raw: string | null): Sex | null {
  if (raw === "male" || raw === "female") return raw;
  return null;
}

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

  const hrMaxLt1 = formatBpmRange(hrMax * untrained.lt1HrMax.low, hrMax * untrained.lt1HrMax.high);
  const untrainedLt2HrMax = formatBpmRange(hrMax * untrained.lt2HrMax.low, hrMax * untrained.lt2HrMax.high);
  const trainedLt2HrMax = formatBpmRange(hrMax * trained.lt2HrMax.low, hrMax * trained.lt2HrMax.high);

  if (resting === null) {
    return `
      <p class="result-kicker">LT1 / LT2 心率 · %HRmax 对照</p>
      <table class="result-table">
        <thead>
          <tr><th></th><th>无运动习惯</th><th>有训练习惯</th></tr>
        </thead>
        <tbody>
          <tr><td>LT1</td><td class="mono">${hrMaxLt1}</td><td class="mono">${hrMaxLt1}</td></tr>
          <tr><td>LT2</td><td class="mono">${untrainedLt2HrMax}</td><td class="mono">${trainedLt2HrMax}</td></tr>
        </tbody>
      </table>
      <p class="result-method">未填静息心率，上表为 %HRmax。补测晨脉后改为 Karvonen，训练者务必如此。</p>
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
    <p class="result-kicker">LT1 / LT2 心率 · Karvonen</p>
    <table class="result-table">
      <thead>
        <tr><th></th><th>无运动习惯</th><th>有训练习惯</th></tr>
      </thead>
      <tbody>
        ${row("LT1", untrained.lt1Karvonen.low, untrained.lt1Karvonen.high, trained.lt1Karvonen.low, trained.lt1Karvonen.high)}
        ${row("LT2", untrained.lt2Karvonen.low, untrained.lt2Karvonen.high, trained.lt2Karvonen.low, trained.lt2Karvonen.high)}
      </tbody>
    </table>
    <p class="result-method">无习惯者取较低系数；训练者 LT2 取 85–88% HRR。对照 %HRmax：LT1 ${hrMaxLt1}，无习惯 LT2 ${untrainedLt2HrMax}，有习惯 LT2 ${trainedLt2HrMax}。</p>
  `;
}

function render(): void {
  const empty = document.getElementById("hr-empty");
  const output = document.getElementById("hr-output");
  const detail = document.getElementById("hr-detail");
  if (!empty || !output || !detail) return;

  const age = parseNumber(inputValue("age"));
  const rhr = parseNumber(inputValue("rhr"));
  const measured = parseNumber(inputValue("measured"));
  const sex = parseSex(checkedRadio("sex"));

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
  const chosen = selectedHrMax({ age, sex, measured });
  if (!chosen) return;

  const chosenMethod = chosen.method;
  const mark = (method: string) => (method === chosenMethod ? ' class="used"' : "");

  const hrMaxTable = `
    <p class="result-kicker">最大心率</p>
    <p class="result-value">${formatBpm(chosen.value)}<small>bpm</small></p>
    <p class="result-method">选用 <strong>${chosen.method}</strong>${
      rhr !== null ? ` · HRR ${formatBpm(chosen.value - rhr)} bpm` : ""
    }</p>
    <table class="result-table">
      <thead><tr><th>方法</th><th>HRmax</th><th></th></tr></thead>
      <tbody>
        ${tanaka !== null ? `<tr${mark("Tanaka")}><td>Tanaka</td><td class="mono">${formatBpm(tanaka)}</td><td>普通人群推荐</td></tr>` : ""}
        ${
          gulati !== null
            ? `<tr${mark("Gulati（女性）")}><td>Gulati</td><td class="mono">${formatBpm(gulati)}</td><td>${
                sex === "female" ? "女性选用" : "女性专用"
              }</td></tr>`
            : ""
        }
        ${fox !== null ? `<tr><td>Fox</td><td class="mono">${formatBpm(fox)}</td><td>仅对照</td></tr>` : ""}
        ${
          measured !== null
            ? `<tr${mark("现场实测")}><td>实测</td><td class="mono">${formatBpm(measured)}</td><td>覆盖公式</td></tr>`
            : `<tr><td>实测</td><td class="mono">—</td><td>未填</td></tr>`
        }
      </tbody>
    </table>
  `;

  const zones = zoneRows(chosen.value, rhr);
  const karvonenTable =
    rhr === null
      ? `<p class="result-method">未填静息心率。以下为手表常用的 %HRmax 五区，训练者会系统性偏低。补上 RHR 后改用 Karvonen。</p>
         <table class="result-table">
           <thead><tr><th>分区</th><th>心率 bpm</th><th>公式</th></tr></thead>
           <tbody>${zones.hrMaxPct}</tbody>
         </table>`
      : `<p class="result-kicker">五区 · Karvonen</p>
         <table class="result-table">
           <thead><tr><th>分区</th><th>心率 bpm</th><th>公式</th><th>生理</th><th>谈话测试</th></tr></thead>
           <tbody>${zones.karvonen}</tbody>
         </table>
         <p class="result-method">对照（勿用于训练者）：%HRmax 分区 Z2 通常只有 60–70% HRmax。</p>
         <table class="result-table">
           <thead><tr><th>分区</th><th>%HRmax bpm</th><th>公式</th></tr></thead>
           <tbody>${zones.hrMaxPct}</tbody>
         </table>`;

  output.innerHTML = hrMaxTable;
  detail.innerHTML = karvonenTable + ltBlock(chosen.value, rhr);
}

bindForm("hr-form", render);
initChrome("hr");
