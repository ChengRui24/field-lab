import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, inputValue, readNumber } from "../lib/dom";
import {
  formatMinSec,
  formatPace,
  formatWatts,
  parseDurationToMinutes,
  parseNumber,
} from "../lib/format";
import {
  analyzeCriticalTrials,
  cssWakayoshi,
  designIntervals,
  ftpFrom20min,
  INTERVAL_MAX_REPS,
  runTrial,
  speedToPaceSec,
  type CriticalResult,
  type IntervalRep,
  type Trial,
} from "../lib/critical";

function trial(timeId: string, outputId: string): Trial | null {
  const time = parseDurationToMinutes(inputValue(timeId));
  const output = parseNumber(inputValue(outputId));
  if (time === null || output === null) return null;
  return { timeMinutes: time, output };
}

function reasonBlock(kicker: string, reason: string): string {
  return `
      <div class="block">
        <p class="result-kicker">${kicker}</p>
        <p class="result-method">${reason}</p>
      </div>
    `;
}

const SOURCE_FIELDS = ["wb-cp", "wb-wprime"] as const;
const typedByUser = new Set<string>();

for (const id of SOURCE_FIELDS) {
  document.getElementById(id)?.addEventListener("input", (event) => {
    if (!(event.target instanceof HTMLInputElement)) return;
    if (event.target.value.trim() === "") typedByUser.delete(id);
    else typedByUser.add(id);
  });
}

/** Fill CP / W′ from the trials unless the user typed their own; returns whether the field now shows the trial value. */
function fillFromTrials(id: string, value: string): boolean {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement)) return false;
  if (typedByUser.has(id)) return el.value === value;
  if (el.value !== value) {
    el.value = value;
    // "change", not "input": persists via bindForm without marking the field as typed by the user.
    queueMicrotask(() => el.dispatchEvent(new Event("change", { bubbles: true })));
  }
  return true;
}

function syncSourceFields(bike: CriticalResult | null): void {
  const note = document.getElementById("wb-source-note");
  if (!note) return;
  if (bike === null || !bike.ok) {
    note.hidden = true;
    note.textContent = "";
    return;
  }
  const cp = String(Math.round(bike.critical));
  const wPrime = ((bike.workPrime * 60) / 1000).toFixed(1);
  const cpSynced = fillFromTrials("wb-cp", cp);
  const wPrimeSynced = fillFromTrials("wb-wprime", wPrime);
  note.textContent =
    cpSynced && wPrimeSynced
      ? "CP、W′ 来自上方测试。"
      : `手动填写的值优先；清空即改用上方测试（CP ${cp} W · W′ ${wPrime} kJ）。`;
  note.hidden = false;
}

function kj(joules: number): string {
  return (joules / 1000).toFixed(1);
}

function balanceCell(joules: number, wPrimeJ: number): string {
  return `${kj(joules)} kJ · ${Math.round((joules / wPrimeJ) * 100)}%`;
}

function repRow(rep: IntervalRep, wPrimeJ: number): string {
  if (rep.exhaustedAtSec !== null) {
    return `<tr><td>第 ${rep.rep} 组</td><td class="mono">约 ${formatMinSec(rep.exhaustedAtSec, 0)} 耗尽</td><td class="mono">—</td></tr>`;
  }
  return `<tr><td>第 ${rep.rep} 组</td><td class="mono">${balanceCell(rep.afterWorkJ, wPrimeJ)}</td><td class="mono">${
    rep.afterRestJ === null ? "—" : balanceCell(rep.afterRestJ, wPrimeJ)
  }</td></tr>`;
}

function repRows(reps: IntervalRep[], wPrimeJ: number): string {
  if (reps.length <= 12) return reps.map((rep) => repRow(rep, wPrimeJ)).join("");
  const head = reps.slice(0, 5);
  const tail = reps.slice(-5);
  return [
    ...head.map((rep) => repRow(rep, wPrimeJ)),
    `<tr><td>…</td><td colspan="2">第 ${head.length + 1}–${reps.length - tail.length} 组略</td></tr>`,
    ...tail.map((rep) => repRow(rep, wPrimeJ)),
  ].join("");
}

function intervalBlock(): string | null {
  const ids = ["wb-power", "wb-work", "wb-rest", "wb-rest-power", "wb-reps"];
  if (ids.every((id) => inputValue(id).trim() === "")) return null;

  const workMin = parseDurationToMinutes(inputValue("wb-work"));
  const restMin = parseDurationToMinutes(inputValue("wb-rest"));
  const design = designIntervals({
    cp: readNumber("wb-cp"),
    wPrimeKj: readNumber("wb-wprime"),
    workPower: readNumber("wb-power"),
    workSec: workMin === null ? null : workMin * 60,
    restSec: restMin === null ? null : restMin * 60,
    restPower: readNumber("wb-rest-power"),
    plannedReps: readNumber("wb-reps"),
  });
  const kicker = "间歇设计 · W′ 平衡";
  if (!design.ok) return reasonBlock(kicker, design.reason);

  const { reps, fullReps, wPrimeJ, plannedReps } = design;
  const failed = reps[reps.length - 1];
  const failedAt = failed.exhaustedAtSec === null ? "" : formatMinSec(failed.exhaustedAtSec, 0);
  const lastDone = reps[fullReps - 1];
  const left = lastDone ? `最后一组做完剩 W′ ${kj(lastDone.afterWorkJ)} kJ（${Math.round((lastDone.afterWorkJ / wPrimeJ) * 100)}%）。` : "";

  let value: string;
  let method: string;
  if (plannedReps !== null) {
    if (!design.exhausted) {
      value = `${plannedReps}<small>组可完成</small>`;
      method = `计划 ${plannedReps} 组可以做完。${left}`;
    } else {
      value = `${fullReps}<small>组做满 · 计划 ${plannedReps} 组做不完</small>`;
      method = `第 ${failed.rep} 组做到约 ${failedAt} 时 W′ 耗尽。`;
    }
  } else if (design.exhausted) {
    value = `${fullReps}<small>组做满</small>`;
    method =
      fullReps === 0
        ? `第 1 组做到约 ${failedAt} 就耗尽 W′。缩短每组时长或降低功率。`
        : `第 ${failed.rep} 组做到约 ${failedAt} 时 W′ 耗尽（W′bal ≤ 0）。`;
  } else {
    value = `&gt;${design.capReps}<small>组</small>`;
    const cap = design.capReps < INTERVAL_MAX_REPS ? "（模拟上限 3 小时）" : "";
    const prev = reps[reps.length - 2];
    const plateau =
      prev && Math.abs(prev.afterWorkJ - lastDone.afterWorkJ) < 50
        ? "W′ 已趋于稳定：模型认为可一直重复，实际仍受糖原、体温等其他疲劳限制。"
        : "";
    method = `超过 ${design.capReps} 组仍未耗尽${cap}。${left}${plateau}`;
  }

  const rest = `歇时 ${formatWatts(design.restPower)} W${design.restPowerAssumed ? "，未填按轻松踩 ≈ CP 的一半" : ""}`;
  return `
      <div class="block">
        <p class="result-kicker">${kicker}</p>
        <p class="result-value">${value}</p>
        <p class="result-method">${method}</p>
        <table class="result-table">
          <thead><tr><th>组</th><th>做完剩</th><th>歇完剩</th></tr></thead>
          <tbody>${repRows(reps, wPrimeJ)}</tbody>
        </table>
        <p class="result-method">τ ≈ ${Math.round(design.tauSec)} s · DCP ${formatWatts(design.dcp)} W（${rest}）。Skiba 2012 积分模型，仅骑行，排课参考。</p>
      </div>
    `;
}

function render(): void {
  const empty = document.getElementById("cp-empty");
  const output = document.getElementById("cp-output");
  if (!empty || !output) return;

  const parts: string[] = [];

  const bikeTrials = [trial("cp-t1", "cp-p1"), trial("cp-t2", "cp-p2"), trial("cp-t3", "cp-p3")].filter(
    (item): item is Trial => item !== null,
  );
  const bike = bikeTrials.length > 0 ? analyzeCriticalTrials(bikeTrials, { critical: "CP", prime: "W′" }) : null;
  syncSourceFields(bike);
  if (bike !== null) {
    if (bike.ok) {
      parts.push(`
      <div class="block">
        <p class="result-kicker">骑行临界功率</p>
        <p class="result-value">${formatWatts(bike.critical)}<small>W CP</small></p>
        <p class="result-method">P = CP + W′ / t。用了 ${bike.trialCount} 次测试。W′ ≈ ${Math.round(bike.workPrime)} W·min（${(bike.workPrime * 60 / 1000).toFixed(1)} kJ）。</p>
      </div>
    `);
    } else {
      parts.push(reasonBlock("骑行临界功率", bike.reason));
    }
  }

  const intervals = intervalBlock();
  if (intervals !== null) parts.push(intervals);

  const ftp20 = parseNumber(inputValue("ftp-20"));
  if (ftp20 !== null) {
    const ftp = ftpFrom20min(ftp20);
    parts.push(`
      <div class="block">
        <p class="result-kicker">FTP（20 分钟法）</p>
        <p class="result-value">${formatWatts(ftp)}<small>W</small></p>
        <p class="result-method">20 分钟平均功率 × 0.95。这是操作定义，不是 CP。</p>
      </div>
    `);
  }

  const d1 = parseNumber(inputValue("cs-d1"));
  const d2 = parseNumber(inputValue("cs-d2"));
  const t1 = parseDurationToMinutes(inputValue("cs-t1"));
  const t2 = parseDurationToMinutes(inputValue("cs-t2"));
  if (d1 !== null && d2 !== null && t1 !== null && t2 !== null) {
    const run = analyzeCriticalTrials([runTrial(d1, t1), runTrial(d2, t2)], { critical: "CS", prime: "D′" });
    if (!run.ok) {
      parts.push(reasonBlock("跑步临界速度", run.reason));
    } else {
      const pace = speedToPaceSec(run.critical);
      parts.push(`
        <div class="block">
          <p class="result-kicker">跑步临界速度</p>
          <p class="result-value">${formatPace(pace)}<small>/km</small></p>
          <p class="result-method">CS ≈ ${run.critical.toFixed(2)} m/s。D′ ≈ ${(run.workPrime * 60).toFixed(0)} m。不要和骑行瓦数互换。</p>
        </div>
      `);
    }
  }

  const t200 = parseDurationToMinutes(inputValue("css-200"));
  const t400 = parseDurationToMinutes(inputValue("css-400"));
  if (t200 !== null && t400 !== null) {
    const css = cssWakayoshi(t200 * 60, t400 * 60);
    if (css === null) {
      parts.push(reasonBlock("临界游速 CSS", "400 m 成绩必须慢于 200 m 成绩，请核对两次时间。"));
    } else {
      parts.push(`
        <div class="block">
          <p class="result-kicker">临界游速 CSS</p>
          <p class="result-value">${css.toFixed(2)}<small>m/s</small></p>
          <p class="result-method">Wakayoshi：200 / (T400 − T200)。约 ${formatMinSec(100 / css)} /100 m。</p>
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

bindForm("cp-form", render);
initChrome("critical");
