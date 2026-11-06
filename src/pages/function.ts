import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, checkedRadio, checkedSex, readNumber } from "../lib/dom";
import { parseNumber } from "../lib/format";
import {
  chairStandReading,
  gaitSpeedMPerSec,
  gaitSpeedReading,
  gripReading,
  type Reading,
  type ScreeningFlags,
  screeningSummary,
  sixMinuteWalkReading,
  SPPB_COMPONENT_LABEL,
  sppbResult,
  type Tone,
  tugReading,
} from "../lib/function";

function checked(id: string): boolean {
  const el = document.getElementById(id);
  return el instanceof HTMLInputElement && el.checked;
}

function heldRadio(name: string): boolean | null {
  const raw = checkedRadio(name);
  return raw === null ? null : raw === "1";
}

function setDisabled(id: string, disabled: boolean): void {
  const el = document.getElementById(id);
  if (el instanceof HTMLFieldSetElement) el.disabled = disabled;
}

function flag(tone: Tone, text: string): string {
  return ` <span class="result-flag" data-tone="${tone}">${text}</span>`;
}

function card(kicker: string, value: string, unit: string, method: string, badge = ""): string {
  return `
    <div class="block">
      <p class="result-kicker">${kicker}${badge}</p>
      <p class="result-value">${value}<small>${unit}</small></p>
      <p class="result-method">${method}</p>
    </div>
  `;
}

function readingCard(kicker: string, value: string, unit: string, reading: Reading, extra = ""): string {
  return card(kicker, value, unit, `<strong>${reading.headline}</strong>。${reading.note}${extra}`, flag(reading.tone, reading.flag));
}

function sppbBlock(
  gaitM: number | null,
  gaitSec: number | null,
  gaitUnable: boolean,
  sts: number | null,
  stsUnable: boolean,
): { html: string; low: boolean | null } | null {
  const sideBySideHeld = heldRadio("bal-side");
  const semiTandemHeld = heldRadio("bal-semi");
  const tandemRaw = checkedRadio("bal-tandem");
  const tandemSec = tandemRaw === null ? null : parseNumber(tandemRaw);

  setDisabled("bal-semi-group", sideBySideHeld === false);
  setDisabled("bal-tandem-group", sideBySideHeld === false || semiTandemHeld === false);
  const skipNote = document.getElementById("bal-skip-note");
  if (skipNote) {
    const skipped = sideBySideHeld === false ? "并脚站" : semiTandemHeld === false ? "半前后脚" : null;
    skipNote.hidden = skipped === null;
    skipNote.textContent = skipped ? `${skipped}没站满，后面的平衡项不做，记 0 分。` : "";
  }

  const anyInput =
    sideBySideHeld !== null ||
    semiTandemHeld !== null ||
    tandemSec !== null ||
    gaitUnable ||
    gaitSec !== null ||
    stsUnable ||
    sts !== null;
  if (!anyInput) return null;

  const r = sppbResult({
    sideBySideHeld,
    semiTandemHeld,
    tandemSec,
    gaitUnable,
    gaitDistanceM: gaitM,
    gaitSec,
    chairUnable: stsUnable,
    chairSec: sts,
  });
  const sub = (score: number | null): string => (score === null ? "—" : `${score}`);
  const subs = `平衡 ${sub(r.balance)} · 步行 ${sub(r.gait)} · 起坐 ${sub(r.chair)}（各 0–4）`;
  const distanceNote = r.gaitWrongDistance ? "SPPB 需要 4 m 步行时间，当前距离不计分。" : "";

  if (r.total === null || r.band === null || r.awgsLow === null) {
    const missing = r.missing.map((c) => SPPB_COMPONENT_LABEL[c]).join(" / ");
    return {
      html: `
        <div class="block">
          <p class="result-kicker">SPPB 简易体能</p>
          <p class="result-method">还差：${missing}。${distanceNote}${subs}。</p>
        </div>
      `,
      low: null,
    };
  }
  const headline = r.awgsLow
    ? `≤9 分，低于亚洲 AWGS 2019 的体能表现参考线（偏低）`
    : `高于亚洲 AWGS 2019 的 ≤9 分参考线（正常范围）`;
  const ewg = r.ewgsop2Low ? "也达到欧洲 EWGSOP2 的 ≤8 分线。" : "";
  return {
    html: card(
      "SPPB 简易体能",
      `${r.total}`,
      "/ 12",
      `<strong>${headline}</strong>。${ewg}${r.band.range} 分对应 Guralnik 1994 的「${r.band.label}」。${subs}。`,
      flag(r.awgsLow ? "caution" : "ok", r.awgsLow ? "偏低" : "正常"),
    ),
    low: r.awgsLow,
  };
}

function summaryBlock(flags: ScreeningFlags): string {
  const s = screeningSummary(flags);
  if (s.tested === 0) return "";
  const lines: string[] = [];
  if (s.possibleSarcopenia) {
    lines.push(
      `<strong>${s.awgsLow.length} 项低于亚洲（AWGS 2019）筛查线：${s.awgsLow.join("、")}</strong>。这符合 AWGS 2019「可能肌少症」的筛查标准（肌力低或体能表现低，有一项即算）。建议近期带着这些结果到老年科或康复科评估，确诊还要测肌肉量；这不是急诊。AWGS 2019 也建议从运动和营养等生活方式调整开始。`,
    );
  }
  if (s.fallRisk) {
    lines.push(
      `<strong>起立–行走 ≥12 秒</strong>：CDC STEADI 认为这提示有跌倒风险，建议请医生做一次跌倒风险评估。`,
    );
  }
  if (s.mwtLow) {
    lines.push(`<strong>6 分钟步行低于同龄预测正常下限</strong>（Enright 1998），可以一起带给医生看。`);
  }
  const caution = lines.length > 0;
  if (!caution) {
    lines.push(`已填的 ${s.tested} 项都在筛查线以内。这只是一次现场筛查，不能排除所有问题；没填的项目不算在内。`);
  }
  return `
    <div class="block" id="fn-summary">
      <p class="result-kicker">总体结论${flag(caution ? "caution" : "ok", caution ? "需留意" : "正常")}</p>
      ${lines.map((l) => `<p class="result-method">${l}</p>`).join("")}
    </div>
  `;
}

function render(): void {
  const empty = document.getElementById("fn-empty");
  const output = document.getElementById("fn-output");
  if (!empty || !output) return;

  const parts: string[] = [];
  const flags: ScreeningFlags = { gait: null, chair: null, sppb: null, grip: null, tug: null, mwt: null };

  const age = readNumber("info-age");
  const heightCm = readNumber("info-cm");
  const weightKg = readNumber("info-kg");
  const sex = checkedSex("info-sex");

  const gaitM = readNumber("gait-m");
  const gaitSec = readNumber("gait-sec");
  const gaitUnable = checked("gait-unable");
  if (!gaitUnable && gaitM !== null && gaitSec !== null) {
    const speed = gaitSpeedMPerSec(gaitM, gaitSec);
    if (speed !== null) {
      const reading = gaitSpeedReading(speed);
      flags.gait = reading.awgsLow;
      parts.push(readingCard("常速步行", speed.toFixed(2), "m/s", reading, ` 距离 ${gaitM} m，用时 ${gaitSec} 秒。`));
    }
  }

  const sts = readNumber("sts-sec");
  const stsUnable = checked("sts-unable");
  if (stsUnable) {
    flags.chair = true;
    parts.push(card("5 次起坐", "做不到", "", "没能完成 5 次或超过 60 秒，按 AWGS 2019 算作体能表现低。", flag("caution", "偏低")));
  } else if (sts !== null) {
    const reading = chairStandReading(sts);
    if (reading) {
      flags.chair = reading.awgsLow;
      parts.push(readingCard("5 次起坐", sts.toFixed(1), "秒", reading));
    }
  }

  const sppb = sppbBlock(gaitM, gaitSec, gaitUnable, sts, stsUnable);
  if (sppb !== null) {
    flags.sppb = sppb.low;
    parts.push(sppb.html);
  }

  const grip = readNumber("grip-kg");
  if (grip !== null) {
    const reading = sex === null ? null : gripReading(grip, sex);
    if (reading) {
      flags.grip = reading.awgsLow;
      parts.push(readingCard("握力", grip.toFixed(1), "kg", reading));
    } else if (sex === null) {
      parts.push(card("握力", grip.toFixed(1), "kg", "请在上方「基本信息」里选性别，才能和对应的参考线比较。"));
    }
  }

  const tug = readNumber("tug-sec");
  if (tug !== null) {
    const reading = tugReading(tug);
    if (reading) {
      flags.tug = reading.tone === "caution";
      parts.push(readingCard("起立–行走 TUG", tug.toFixed(1), "秒", reading));
    }
  }

  const mwtM = readNumber("mwt-m");
  if (mwtM !== null) {
    const tail = "这是步行耐力，不是 VO₂max，也不能单独诊断疾病。";
    const result =
      age !== null && heightCm !== null && weightKg !== null && sex !== null
        ? sixMinuteWalkReading({ distanceM: mwtM, sex, heightCm, age, weightKg })
        : null;
    if (result === null) {
      parts.push(
        card("6 分钟步行", `${Math.round(mwtM)}`, "m", `在上方「基本信息」填年龄、性别、身高、体重，就能和 Enright 1998 预测距离比较。${tail}`),
      );
    } else if (!result.inRange) {
      parts.push(card("6 分钟步行", `${Math.round(mwtM)}`, "m", `超出方程适用范围：${result.reason}，只显示实测距离，不给预测值。${tail}`));
    } else {
      flags.mwt = result.belowLln;
      const headline = result.belowLln
        ? `低于正常下限 ${Math.round(result.lln)} m（偏低）`
        : `在正常下限 ${Math.round(result.lln)} m 以上（正常范围）`;
      parts.push(
        card(
          "6 分钟步行",
          `${Math.round(mwtM)}`,
          "m",
          `<strong>${headline}</strong>。Enright 1998 预测 ${Math.round(result.predicted)} m，本次约为预测值的 ${result.pctPredicted.toFixed(0)}%；正常下限 = 预测值 − ${Math.round(result.predicted - result.lln)} m。${tail}`,
          flag(result.belowLln ? "caution" : "ok", result.belowLln ? "偏低" : "正常"),
        ),
      );
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
  output.innerHTML = summaryBlock(flags) + parts.join("");
}

bindForm("fn-form", render);
initChrome("function");
