import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, inputValue } from "../lib/dom";
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
  ftpFrom20min,
  runTrial,
  speedToPaceSec,
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

function render(): void {
  const empty = document.getElementById("cp-empty");
  const output = document.getElementById("cp-output");
  if (!empty || !output) return;

  const parts: string[] = [];

  const bikeTrials = [trial("cp-t1", "cp-p1"), trial("cp-t2", "cp-p2"), trial("cp-t3", "cp-p3")].filter(
    (item): item is Trial => item !== null,
  );
  if (bikeTrials.length > 0) {
    const bike = analyzeCriticalTrials(bikeTrials, { critical: "CP", prime: "W′" });
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
