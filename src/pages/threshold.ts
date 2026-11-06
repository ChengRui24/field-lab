import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, inputValue, readNumber } from "../lib/dom";
import {
  formatBpm,
  formatBpmRange,
  formatPace,
  formatPaceRange,
  formatVo2,
  interpretTimeInput,
  parseNumber,
  parsePaceToSecPerKm,
} from "../lib/format";
import {
  lt1PaceFromLt2,
  paceFromRace,
  raceDistanceFromMeters,
  raceToLt2Hr,
  raceToLt2Pace,
  type RaceDistance,
} from "../lib/threshold";
import { VDOT_FRACTIONS, equivalentRaces, readVdot, vdotTrainingPaces } from "../lib/vo2";

/** Half marathon and longer: "1:52" means 1 h 52 min. */
const HM_MIN_METERS = 21097.5;

const DISTANCE_LABEL: Record<RaceDistance, string> = { "10k": "10 km", half: "半马", full: "全马" };

/** Whole-second race time: m:ss below an hour, h:mm:ss above. */
function formatRaceTime(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const total = Math.round(minutes * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function distanceLabel(meters: number): string {
  if (meters === 5000) return "5 km";
  const race = raceDistanceFromMeters(meters);
  return race ? DISTANCE_LABEL[race] : `${meters} m`;
}

function raceTimeInput(): HTMLInputElement | null {
  const el = document.getElementById("race-time");
  return el instanceof HTMLInputElement ? el : null;
}

function readRaceMinutes(): number | null {
  const el = raceTimeInput();
  if (!el) return null;
  const result = interpretTimeInput(el.value, "duration", { hm: el.hasAttribute("data-time-hm") });
  return result.status === "valid" ? result.value : null;
}

function hmsFromMinutes(minutes: number): string {
  const total = Math.round(minutes * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function syncRaceTimeMode(): void {
  const el = raceTimeInput();
  if (!el) return;
  const meters = parseNumber(inputValue("race-distance"));
  const hm = meters !== null && meters >= HM_MIN_METERS;
  const wasHm = el.hasAttribute("data-time-hm");
  if (hm !== wasHm) {
    // An existing "25:00" must keep its meaning (25 min) when the h:mm reading switches on or off.
    const prior = interpretTimeInput(el.value, "duration", { hm: wasHm });
    if (prior.status === "valid" && prior.value !== null) el.value = hmsFromMinutes(prior.value);
  }
  el.toggleAttribute("data-time-hm", hm);
  el.placeholder = meters === null ? "先选距离" : hm ? "1:52:00 或 1:52" : "45:00 或 4500";
}

function flag(label: string, detail: string): string {
  return `<div class="block" role="status">
    <p class="result-kicker"><span class="result-flag" data-tone="caution">${label}</span></p>
    <p class="result-method">${detail}</p>
  </div>`;
}

function raceBackDetails(distance: RaceDistance, raceMinutes: number, raceHr: number | null): string {
  const racePace = paceFromRace(distance, raceMinutes);
  const lt2Pace = raceToLt2Pace(distance, racePace);
  const lt1 = lt1PaceFromLt2((lt2Pace.faster + lt2Pace.slower) / 2);
  const lt2Hr = raceHr !== null ? raceToLt2Hr(distance, raceHr) : null;
  const marathonCaveat =
    distance === "full" && raceMinutes > 180
      ? "全马慢于约 3 小时时，这条固定 10–15 秒的规则会低估差距：按 Daniels 训练配速表，M 与 T 在 VDOT 50（全马约 3:11）相差约 16 秒/km，VDOT 40（约 3:49）约 23 秒/km。所以这里的 LT2 往往比上面的 T 配速偏慢，以 T 为准。"
      : "";
  return `
    <details class="method-details">
      <summary>另一种粗估：比赛配速反推</summary>
      <p class="result-method">${lt2Pace.note}，无单一文献出处。${DISTANCE_LABEL[distance]}比赛配速 ${formatPace(racePace)}/km。${marathonCaveat}</p>
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
          <tr><td>LT1 配速（经验估计）</td><td class="mono">${formatPaceRange(lt1.slow, lt1.fast)}/km</td></tr>
        </tbody>
      </table>
    </details>
  `;
}

function raceBlock(meters: number, raceMinutes: number, raceHr: number | null): string {
  const reading = readVdot(meters, raceMinutes);
  if (reading.status === "implausible") {
    return flag(
      "成绩和距离对不上？",
      `检查距离是否选对。${distanceLabel(meters)} ${formatRaceTime(raceMinutes)} 换算不出可信的 VDOT（应在 20–90，平均配速在 12:00/km 与世界纪录之间），所以不出配速表。半马、全马请写成 时:分:秒，例如 1:52:00。`,
    );
  }
  const vdot = reading.vdot;
  const paces = vdotTrainingPaces(vdot);
  const pct = (fraction: number): string => `${(fraction * 100).toFixed(1).replace(/\.0$/, "")}%`;
  const rows = [
    {
      name: "E",
      pace: `${formatPaceRange(paces.easy.slow, paces.easy.fast)}/km`,
      intensity: `约 ${pct(VDOT_FRACTIONS.easySlow)}–${pct(VDOT_FRACTIONS.easyFast)} VDOT`,
      meaning: "轻松：有氧基础、恢复跑、长距离",
    },
    {
      name: "M",
      pace: paces.marathon === null ? "—" : `${formatPace(paces.marathon)}/km`,
      intensity: "该 VDOT 预测值",
      meaning: "马拉松：全马比赛配速",
    },
    {
      name: "T",
      pace: `${formatPace(paces.threshold)}/km`,
      intensity: `约 ${pct(VDOT_FRACTIONS.threshold)} VDOT`,
      meaning: "阈值：乳酸阈，舒适地吃力",
    },
    {
      name: "I",
      pace: `${formatPace(paces.interval)}/km`,
      intensity: `约 ${pct(VDOT_FRACTIONS.interval)} VDOT`,
      meaning: "间歇：最大摄氧量",
    },
    {
      name: "R",
      pace:
        paces.repetition === null
          ? "—"
          : `${formatPace(paces.repetition)}/km<br />400 m ${formatRaceTime((paces.repetition * 0.4) / 60)}`,
      intensity: "≈ 当前 1 英里比赛配速",
      meaning: "重复跑：速度与跑步经济性，200–400 m 短段、充分恢复",
    },
  ]
    .map(
      (row) => `<tr>
        <td>${row.name}</td>
        <td class="mono">${row.pace}</td>
        <td>${row.meaning}；${row.intensity}</td>
      </tr>`,
    )
    .join("");
  const equivalentRows = equivalentRaces(vdot)
    .map((race) => {
      const own = Math.abs(race.meters - meters) < 1;
      return `<tr>
        <td>${own ? `<strong>${race.label}</strong>（你的成绩）` : race.label}</td>
        <td class="mono">${formatRaceTime(own ? raceMinutes : race.minutes)}</td>
        <td class="mono">${formatPace(own ? (raceMinutes * 60 * 1000) / meters : race.pace)}/km</td>
      </tr>`;
    })
    .join("");
  const raceBack = raceDistanceFromMeters(meters);

  return `
    <div class="block">
      <p class="result-kicker">阈值配速 · Daniels T（${distanceLabel(meters)} ${formatRaceTime(raceMinutes)}）</p>
      <p class="result-value">${formatPace(paces.threshold)}<small>/km 阈值</small></p>
      <p class="result-method">VDOT <strong>${formatVo2(vdot)}</strong>。T 配速接近乳酸阈配速，「舒适地吃力」，用于节奏跑和阈值间歇。VDOT 是从比赛成绩反推的有效有氧能力，不是心率；配速按 Daniels–Gilbert 方程计算，与《Daniels' Running Formula》训练配速表相差约 3 秒/km 以内（VDOT 低于约 40 时 M 比原表快几秒到约 10 秒/km）。</p>
      <p class="result-kicker">训练配速</p>
      <table class="result-table">
        <thead><tr><th>区间</th><th>配速</th><th>用途与强度</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="result-kicker">等效成绩</p>
      <p class="result-method">同一 VDOT 在其他距离的预测成绩，前提是针对该距离做过相应训练。用 5K/10K 推全马时，缺少马拉松专项跑量的跑者通常跑不到这个成绩（Daniels' Running Formula）。</p>
      <table class="result-table">
        <thead><tr><th>距离</th><th>预测成绩</th><th>平均配速</th></tr></thead>
        <tbody>${equivalentRows}</tbody>
      </table>
      ${raceBack ? raceBackDetails(raceBack, raceMinutes, raceHr) : ""}
    </div>
  `;
}

function render(): void {
  const empty = document.getElementById("th-empty");
  const output = document.getElementById("th-output");
  if (!empty || !output) return;

  const raceMeters = parseNumber(inputValue("race-distance"));
  const raceMinutes = readRaceMinutes();
  const raceHr = readNumber("race-hr");
  const ttHr = readNumber("tt-hr");
  const ttPace = parsePaceToSecPerKm(inputValue("tt-pace"));
  const knownLt2 = parsePaceToSecPerKm(inputValue("known-lt2"));

  const parts: string[] = [];

  if (raceMinutes !== null) {
    parts.push(
      raceMeters === null
        ? flag("请选择距离", "已填成绩，请先在上方选择比赛距离（5 km / 10 km / 半马 / 全马），才能换算。")
        : raceBlock(raceMeters, raceMinutes, raceHr),
    );
  }

  if (ttHr !== null || ttPace !== null) {
    const lt1 = ttPace !== null ? lt1PaceFromLt2(ttPace) : null;
    parts.push(`
      <div class="block">
      <p class="result-kicker">30 分钟计时赛</p>
      ${ttHr !== null ? `<p class="result-value">${formatBpm(ttHr)}<small>bpm LT2</small></p>` : ""}
      <p class="result-method">Joe Friel 法：最后 20 分钟平均心率 ≈ LTHR（LT2 心率）；全程平均配速 ≈ LT2 配速。LT1 为经验估计，无单一文献出处。和比赛推出的 T 配速是两种测法，不必相同。</p>
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

document.getElementById("race-distance")?.addEventListener("change", () => {
  syncRaceTimeMode();
  raceTimeInput()?.dispatchEvent(new Event("input", { bubbles: true }));
});
syncRaceTimeMode();
bindForm("th-form", render);
initChrome("threshold");
