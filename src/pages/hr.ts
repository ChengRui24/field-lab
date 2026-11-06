import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, checkedSex, inputValue } from "../lib/dom";
import {
  formatBpm,
  formatBpmRange,
  parseNumber,
} from "../lib/format";
import {
  foxHrMax,
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

function render(): void {
  const empty = document.getElementById("hr-empty");
  const output = document.getElementById("hr-output");
  const detail = document.getElementById("hr-detail");
  if (!empty || !output || !detail) return;

  const age = parseNumber(inputValue("age"));
  const rhr = parseNumber(inputValue("rhr"));
  const measured = parseNumber(inputValue("measured"));
  const sex = checkedSex("sex");

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

  const rhrProblem = rhr !== null ? restingHrProblem(chosen.value, rhr) : null;
  const gulatiNote = gulatiRangeNote(sex, age);
  const chosenMethod = chosen.method;
  const mark = (method: string) => (method === chosenMethod ? ' class="used"' : "");

  const hrMaxTable = `
    <p class="result-kicker">最大心率</p>
    <p class="result-value">${formatBpm(chosen.value)}<small>bpm</small></p>
    <p class="result-method">选用 <strong>${chosen.method}</strong>${
      rhr !== null && rhrProblem === null ? ` · HRR ${formatBpm(chosen.value - rhr)} bpm` : ""
    }</p>
    <table class="result-table">
      <thead><tr><th>方法</th><th>HRmax</th><th>说明</th></tr></thead>
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
    ${gulatiNote !== null ? `<p class="field-note range-note">${gulatiNote}</p>` : ""}
  `;

  if (rhrProblem !== null) {
    output.innerHTML = hrMaxTable;
    detail.innerHTML = `<p class="result-method range-note" role="alert">${rhrProblem}</p>`;
    return;
  }

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
