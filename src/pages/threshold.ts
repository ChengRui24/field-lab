import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, inputValue } from "../lib/dom";
import {
  formatBpm,
  formatBpmRange,
  formatPace,
  formatPaceRange,
  formatVo2,
  parseDurationToMinutes,
  parseNumber,
  parsePaceToSecPerKm,
} from "../lib/format";
import {
  lt1PaceFromLt2,
  paceFromRace,
  raceToLt2Hr,
  raceToLt2Pace,
  type RaceDistance,
} from "../lib/threshold";
import { VDOT_FRACTIONS, vdotFromRace, vdotTrainingPaces } from "../lib/vo2";

function parseDistance(raw: string): RaceDistance {
  if (raw === "10k" || raw === "half" || raw === "full") return raw;
  return "half";
}

function render(): void {
  const empty = document.getElementById("th-empty");
  const output = document.getElementById("th-output");
  if (!empty || !output) return;

  const ttHr = parseNumber(inputValue("tt-hr"));
  const ttPace = parsePaceToSecPerKm(inputValue("tt-pace"));
  const distance = parseDistance(inputValue("race-distance"));
  const raceMinutes = parseDurationToMinutes(inputValue("race-time"));
  const raceHr = parseNumber(inputValue("race-hr"));
  const knownLt2 = parsePaceToSecPerKm(inputValue("known-lt2"));

  const parts: string[] = [];

  if (ttHr !== null || ttPace !== null) {
    const lt1 = ttPace !== null ? lt1PaceFromLt2(ttPace) : null;
    parts.push(`
      <div class="block">
      <p class="result-kicker">30 分钟计时赛</p>
      ${ttHr !== null ? `<p class="result-value">${formatBpm(ttHr)}<small>bpm LT2</small></p>` : ""}
      <p class="result-method">Joe Friel 法：最后 20 分钟平均心率 ≈ LTHR（LT2 心率）；全程平均配速 ≈ LT2 配速。LT1 为经验估计，无单一文献出处。</p>
      <table class="result-table">
        <thead><tr><th>参数</th><th>结果</th></tr></thead>
        <tbody>
          <tr><td>LT2 心率</td><td class="mono">${ttHr !== null ? `${formatBpm(ttHr)} bpm` : "—"}</td></tr>
          <tr><td>LT2 配速</td><td class="mono">${ttPace !== null ? `${formatPace(ttPace)}/km` : "—"}</td></tr>
          <tr><td>LT1 配速（经验估计）</td><td class="mono">${
            lt1 ? `${formatPaceRange(lt1.slow, lt1.fast)}/km` : "—"
          }</td></tr>
        </tbody>
      </table>
      </div>
    `);
  }

  if (raceMinutes !== null) {
    const racePace = paceFromRace(distance, raceMinutes);
    const lt2Pace = raceToLt2Pace(distance, racePace);
    const lt1FromRace = lt1PaceFromLt2((lt2Pace.faster + lt2Pace.slower) / 2);
    const lt2Hr = raceHr !== null ? raceToLt2Hr(distance, raceHr) : null;
    const distanceLabel = distance === "10k" ? "10K" : distance === "half" ? "半马" : "全马";

    parts.push(`
      <div class="block">
      <p class="result-kicker">比赛反推 · ${distanceLabel}</p>
      <p class="result-value">${formatPace((lt2Pace.faster + lt2Pace.slower) / 2)}<small>/km LT2</small></p>
      <p class="result-method">${lt2Pace.note}。比赛配速 ${formatPace(racePace)}/km。</p>
      <table class="result-table">
        <thead><tr><th>参数</th><th>结果</th></tr></thead>
        <tbody>
          <tr><td>LT2 配速</td><td class="mono">${
            lt2Pace.faster === lt2Pace.slower
              ? `${formatPace(lt2Pace.faster)}/km`
              : `${formatPace(lt2Pace.faster)}–${formatPace(lt2Pace.slower)}/km`
          }</td></tr>
          <tr><td>LT2 心率</td><td class="mono">${
            lt2Hr ? `${formatBpmRange(lt2Hr.low, lt2Hr.high)} bpm · ${lt2Hr.note}` : "未填平均心率"
          }</td></tr>
          <tr><td>LT1 配速（经验估计）</td><td class="mono">${formatPaceRange(lt1FromRace.slow, lt1FromRace.fast)}/km</td></tr>
        </tbody>
      </table>
      </div>
    `);
  }

  if (knownLt2 !== null) {
    const lt1 = lt1PaceFromLt2(knownLt2);
    parts.push(`
      <div class="block">
      <p class="result-kicker">由 LT2 推 LT1</p>
      <p class="result-value">${formatPaceRange(lt1.slow, lt1.fast)}<small>/km</small></p>
      <p class="result-method">LT1 配速 ≈ LT2 × 1.20–1.25（慢 20–25%），经验估计，无单一文献出处。LT2 为 ${formatPace(knownLt2)}/km。</p>
      </div>
    `);
  }

  const vdotMeters = parseNumber(inputValue("vdot-distance"));
  const vdotTime = parseDurationToMinutes(inputValue("vdot-time"));
  if (vdotMeters !== null && vdotTime !== null) {
    const vdot = vdotFromRace(vdotMeters, vdotTime);
    const paces = vdotTrainingPaces(vdot);
    const pct = (fraction: number): string => `${(fraction * 100).toFixed(1).replace(/\.0$/, "")}%`;
    const rows = [
      {
        name: "E Easy / 轻松",
        pace: formatPaceRange(paces.easy.slow, paces.easy.fast),
        intensity: `约 ${pct(VDOT_FRACTIONS.easySlow)}–${pct(VDOT_FRACTIONS.easyFast)} VDOT`,
        meaning: "有氧基础、恢复跑、长距离",
      },
      {
        name: "M Marathon / 马拉松配速",
        pace: formatPace(paces.marathon),
        intensity: "该 VDOT 预测的全马比赛配速",
        meaning: "全马比赛配速",
      },
      {
        name: "T Threshold / 阈值",
        pace: formatPace(paces.threshold),
        intensity: `约 ${pct(VDOT_FRACTIONS.threshold)} VDOT`,
        meaning: "乳酸阈，舒适地吃力",
      },
      {
        name: "I Interval / 间歇",
        pace: formatPace(paces.interval),
        intensity: `约 ${pct(VDOT_FRACTIONS.interval)} VDOT`,
        meaning: "最大摄氧量",
      },
    ]
      .map(
        (row) => `<tr>
        <td>${row.name}</td>
        <td class="mono">${row.pace}/km</td>
        <td>${row.intensity}</td>
        <td>${row.meaning}</td>
      </tr>`,
      )
      .join("");
    parts.push(`
      <div class="block">
      <p class="result-kicker">Daniels VDOT</p>
      <p class="result-value">${formatVo2(vdot)}<small>VDOT</small></p>
      <p class="result-method">这不是心率。VDOT 是从比赛成绩反推的「有效有氧能力」（含跑步经济性），用来定 E/M/T/I 配速。配速按 Daniels–Gilbert 方程计算，与《Daniels' Running Formula》训练配速表相差约 3 秒/km 以内（VDOT 低于约 40 时 M 比原表快几秒到约 10 秒/km）。T 配速接近阈值配速，但和 30 分钟计时赛不是同一个数。</p>
      <table class="result-table">
        <thead><tr><th>区间</th><th>配速</th><th>强度</th><th>用途</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
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

bindForm("th-form", render);
initChrome("threshold");
