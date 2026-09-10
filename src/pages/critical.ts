import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, inputValue } from "../lib/dom";
import {
  formatPace,
  formatWatts,
  parseDurationToMinutes,
  parseNumber,
} from "../lib/format";
import {
  criticalFromTrials,
  cssWakayoshi,
  ftpFrom20min,
  speedToPaceSec,
  type Trial,
} from "../lib/critical";

function trial(timeId: string, outputId: string): Trial | null {
  const time = parseDurationToMinutes(inputValue(timeId));
  const output = parseNumber(inputValue(outputId));
  if (time === null || output === null) return null;
  return { timeMinutes: time, output };
}

function render(): void {
  const empty = document.getElementById("cp-empty");
  const output = document.getElementById("cp-output");
  if (!empty || !output) return;

  const parts: string[] = [];

  const bikeTrials = [trial("cp-t1", "cp-p1"), trial("cp-t2", "cp-p2"), trial("cp-t3", "cp-p3")].filter(
    (item): item is Trial => item !== null,
  );
  const bike = criticalFromTrials(bikeTrials);
  if (bike !== null) {
    parts.push(`
      <div class="block">
        <p class="result-kicker">骑行临界功率</p>
        <p class="result-value">${formatWatts(bike.critical)}<small>W CP</small></p>
        <p class="result-method">P = CP + W′ / t。用了 ${bikeTrials.length} 次测试。W′ ≈ ${Math.round(bike.workPrime)} W·min（${(bike.workPrime * 60 / 1000).toFixed(1)} kJ）。</p>
      </div>
    `);
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
    const run = criticalFromTrials([
      { timeMinutes: t1, output: d1 / (t1 * 60) },
      { timeMinutes: t2, output: d2 / (t2 * 60) },
    ]);
    if (run !== null && run.critical > 0) {
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
    if (css !== null) {
      const per100 = 100 / css;
      const min = Math.floor(per100 / 60);
      const sec = (per100 - min * 60).toFixed(1);
      parts.push(`
        <div class="block">
          <p class="result-kicker">临界游速 CSS</p>
          <p class="result-value">${css.toFixed(2)}<small>m/s</small></p>
          <p class="result-method">Wakayoshi：200 / (T400 − T200)。约 ${min}:${sec.padStart(4, "0")} /100 m。</p>
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
