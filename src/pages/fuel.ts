import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, inputValue, readNumber } from "../lib/dom";
import {
  ACSM_DRINK_SODIUM_MMOL_PER_L,
  capsuleFillEstimate,
  capsuleFromWeighing,
  capsulesPerHour,
  CONCENTRATED_PCT,
  maxConcentrationPct,
  planRecipe,
  RECIPE_WARNING_TEXT,
  saltGramsForDrink,
  SALTS,
  sweatSodiumLoss,
  sweatSodiumLossRange,
  SWEAT_SODIUM_MMOL_PER_L,
  PLASMA_OSMOLALITY,
  type CapsuleSize,
  type IngredientId,
  type SaltId,
  type SaltSelection,
} from "../lib/diyfuel";
import { formatGrams, formatKg, parseNumber } from "../lib/format";
import {
  caffeineDose,
  carbDaily,
  creatineDose,
  DEFAULT_GEL_GRAMS,
  diyCarbTarget,
  diyRecipeParts,
  duringCarbRow,
  isGelConcentration,
  LARGE_GEL_CARB_G,
  proteinDose,
  raceCarbMidpoint,
  raceFuelPlan,
  raceMinutesFromParts,
  sweatTest,
  type CarbDay,
  type CarbSession,
  type DiyIngredientChoice,
  type RaceDuration,
  type RaceFuelPlan,
} from "../lib/fuel";

function parseSession(raw: string): CarbSession {
  if (raw === "short" || raw === "endurance" || raw === "ultra") return raw;
  return "endurance";
}

function parseDay(raw: string): CarbDay {
  if (raw === "light" || raw === "moderate" || raw === "high" || raw === "veryHigh") return raw;
  return "moderate";
}

function formatDurationZh(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} 分钟`;
  return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分`;
}

function rangeText(low: number, high: number, digits = 0): string {
  const a = low.toFixed(digits);
  const b = high.toFixed(digits);
  return a === b ? a : `${a}–${b}`;
}

function raceItem(name: string, value: string, unit: string, meta: string): string {
  return `<div class="result-goal">
      <p class="result-goal-name">${name}</p>
      <p class="result-goal-load">${value}${unit ? `<small>${unit}</small>` : ""}</p>
      <p class="result-goal-meta">${meta}</p>
    </div>`;
}

/** Trailing notes as the last row of a result-goals list, so they get the same spacing as the items above. */
function noteItem(paragraphs: string[]): string {
  if (paragraphs.length === 0) return "";
  return `<div class="result-goal">${paragraphs.join("")}</div>`;
}

function show(id: string, visible: boolean): void {
  const el = document.getElementById(id);
  if (el) el.hidden = !visible;
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/** value is null when empty or out of the input's min/max; invalid marks the latter (the form shows the range). */
function numberField(id: string): { value: number | null; invalid: boolean } {
  const el = document.getElementById(id);
  const value = readNumber(id);
  const filled = inputValue(id).trim() !== "" || (el instanceof HTMLInputElement && el.validity.badInput);
  return { value, invalid: filled && value === null };
}

function racePreItems(plan: RaceFuelPlan): string {
  const items: string[] = [];
  if (plan.carbLoadingApplies) {
    items.push(
      plan.carbLoading
        ? raceItem("充碳（可选）", `${formatGrams(plan.carbLoading.lowG)}–${formatGrams(plan.carbLoading.highG)}`, "g/日", "10–12 g/kg，赛前 36–48 小时，配合减量。只用于 90 分钟以上的比赛")
        : raceItem("充碳（可选）", "10–12", "g/kg/日", "赛前 36–48 小时，配合减量；填体重后给出克数"),
    );
  }
  if (!plan.pre) {
    items.push(raceItem("赛前碳水", "1–4", "g/kg", "赛前 1–4 小时；填体重后给出克数"));
  } else if (plan.pre.applies) {
    items.push(
      raceItem("赛前碳水", `${formatGrams(plan.pre.lowG)}–${formatGrams(plan.pre.highG)}`, "g", "1–4 g/kg，赛前 1–4 小时；离出发越近吃得越少，选低脂低纤维"),
    );
  } else {
    items.push(raceItem("赛前碳水", "正常吃", "", "1–4 g/kg 的赛前餐指南针对 60 分钟以上的运动"));
  }
  return items.join("");
}

function raceDuringItems(plan: RaceFuelPlan, gelAssumed: boolean): string {
  const d = plan.during;
  switch (d.band) {
    case "none":
      return raceItem("赛中碳水", "不需要", "", "不足 45 分钟，赛前吃好即可");
    case "rinse":
      return raceItem("赛中碳水", "少量", "", "45–75 分钟：少量运动饮料，或含一口再吐掉（含漱）");
    case "moderate":
    case "high": {
      const note =
        d.band === "high"
          ? "超过 2.5–3 小时：最高约 90 g/h，需葡萄糖+果糖等多种糖，并在训练中练过"
          : "1–2.5 小时：30–60 g/h";
      const items = [
        raceItem("赛中碳水", `${d.lowPerHour}–${d.highPerHour}`, "g/h", `${note}。全程合计 ${formatGrams(d.lowTotal)}–${formatGrams(d.highTotal)} g`),
      ];
      const gels = d.gels;
      if (gels) {
        const count = gels.countLow === gels.countHigh ? `${gels.countLow}` : `${gels.countLow}–${gels.countHigh}`;
        const interval = `${d.lowPerHour} g/h 下限 → 每 ${gels.intervalLongMin} 分钟一支，${d.highPerHour} g/h 上限 → 每 ${gels.intervalShortMin} 分钟一支`;
        const assumption = gelAssumed
          ? `按每支 ${gels.gramsPerGel} g 估（产品不同，看包装）`
          : `每支 ${formatGrams(gels.gramsPerGel)} g`;
        items.push(raceItem("能量胶", count, "支", `${interval}（间隔按 5 分钟取整，取整后仍落在上下限之内）。${assumption}；饮料、软糖里的碳水也算进去`));
      }
      return items.join("");
    }
    default: {
      const exhaustive: never = d.band;
      throw new Error(`未处理的时长档: ${String(exhaustive)}`);
    }
  }
}

const UPPER_LABEL = "饮水 · 上限（不要超过）";

function upperMeta(maxL: number, totalL: number | null): string {
  const total = totalL === null ? "" : `全程不超过约 ${totalL.toFixed(1)} L。`;
  return `= 你测的出汗率 ${maxL.toFixed(2)} L/h。${total}这是上限，不是要喝到的量：喝得比出汗多，体重会增加（ACSM 2007，Sawka）`;
}

function raceFluidItems(plan: RaceFuelPlan): string {
  const f = plan.fluid;
  switch (f.status) {
    case "noSweat":
      return raceItem("饮水", "先测出汗率", "", "用表单里的「出汗率」测一次。不同人每小时出汗差好几倍，这里不给固定的 mL/h");
    case "noWeight":
      return raceItem(UPPER_LABEL, `≤ ${f.maxLitersPerHour.toFixed(2)}`, "L/h", `${upperMeta(f.maxLitersPerHour, f.maxLitersPerHour * (plan.minutes / 60))}。填体重后给出下限`);
    case "ok": {
      const lower =
        f.minLitersPerHour === 0
          ? raceItem("饮水 · 下限", "不设", "", "按这个出汗率，全程不喝体重也降不到 2%。渴了再喝，不超过上限")
          : raceItem(
              "饮水 · 下限",
              f.minLitersPerHour.toFixed(2),
              "L/h",
              `让失水不超过体重 2%（${formatKg(f.allowableLossKg)} kg），全程约 ${f.minTotalL.toFixed(1)} L（ACSM 2007）。上下限之间按口渴喝（Hew-Butler 2015 共识）`,
            );
      return raceItem(UPPER_LABEL, `≤ ${f.maxLitersPerHour.toFixed(2)}`, "L/h", `${upperMeta(f.maxLitersPerHour, f.maxTotalL)}`) + lower;
    }
    default: {
      const exhaustive: never = f;
      throw new Error(`未处理的补液状态: ${String(exhaustive)}`);
    }
  }
}

function raceFluidNotes(plan: RaceFuelPlan): string[] {
  if (plan.fluid.status === "noSweat") return [];
  const longer = plan.minutes > 240 ? "你的预计时长超过 4 小时。" : "";
  return [
    `<p class="result-method"><span class="result-flag" data-tone="caution">低钠风险</span> 波士顿马拉松研究（Almond 2005，<cite>NEJM</cite>）中，比赛中体重增加、完赛超过 4 小时、BMI 偏低（&lt;20）与运动相关低钠血症有关。Hew-Butler 2015 共识指出，体型小、配速慢、喝得比出汗多的人更容易发生，建议按口渴喝。${longer}赛后体重比赛前还重，说明喝多了。</p>`,
    `<p class="result-method">出汗率只来自你测的那一次；天气更热、强度更高时出汗更多（Baker 2017），比赛条件差别大时按比赛条件重测。</p>`,
  ];
}

function readRaceDuration(): RaceDuration {
  const hours = numberField("rf-hours");
  const mins = numberField("rf-mins");
  if (hours.invalid || mins.invalid) return { status: "invalid" };
  return raceMinutesFromParts(hours.value, mins.value);
}

function updateDurationEcho(duration: RaceDuration): void {
  const echo = document.getElementById("rf-echo");
  if (!echo) return;
  if (duration.status === "empty") {
    echo.hidden = true;
    echo.textContent = "";
    return;
  }
  echo.hidden = false;
  echo.textContent =
    duration.status === "valid"
      ? `按 ${formatDurationZh(duration.minutes)}计算。`
      : "小时填 0–24、分钟填 0–59，合计大于 0 且不超过 24 小时。";
}

function readGel(): { grams: number; assumed: boolean } {
  const gel = readNumber("rf-gel");
  return gel === null ? { grams: DEFAULT_GEL_GRAMS, assumed: true } : { grams: gel, assumed: false };
}

function raceHtml(duration: RaceDuration, plan: RaceFuelPlan | null, kg: number | null, gelAssumed: boolean): string | null {
  if (duration.status === "empty") return null;
  if (!plan) {
    return `
      <div class="block">
        <p class="result-kicker">比赛日补给</p>
        <p class="result-method">预计时长需大于 0 且不超过 24 小时：小时填 0–24，分钟填 0–59。</p>
      </div>
    `;
  }
  return `
    <div class="block">
      <p class="result-kicker">比赛日补给 · 按 ${formatDurationZh(plan.minutes)}${kg !== null ? ` · ${formatKg(kg)} kg` : ""}</p>
      <div class="result-goals">
        ${racePreItems(plan)}
        ${raceDuringItems(plan, gelAssumed)}
        ${raceFluidItems(plan)}
        ${noteItem([
          ...raceFluidNotes(plan),
          `<p class="result-method">钠：ACSM 2007 引用的运动饮料约含钠 20–30 mEq/L（约 460–690 mg/L）。汗钠流失见「盐丸 / 饮料加盐」。</p>`,
        ])}
      </div>
    </div>
  `;
}

function supplementHtml(kg: number, racePlan: RaceFuelPlan | null): string {
  const caffeine = caffeineDose(kg);
  const protein = proteinDose(kg);
  const creatine = creatineDose(kg);
  const during = duringCarbRow(parseSession(inputValue("fu-session")), racePlan);
  const daily = carbDaily(kg, parseDay(inputValue("fu-day")));
  const row = (name: string, dose: string, note: string): string =>
    `<tr><td style="white-space: nowrap">${name}</td><td><span class="mono">${dose}</span><br /><span class="result-goal-meta">${note}</span></td></tr>`;
  const table = `
        <table class="result-table">
          <thead><tr><th>项目</th><th>剂量</th></tr></thead>
          <tbody>
            ${row("咖啡因", `${formatGrams(caffeine.low)}–${formatGrams(caffeine.high)} mg`, "3–6 mg/kg，运动前约 60 分钟（30–90）")}
            ${row("蛋白 · 耐力", `${formatGrams(protein.endurance.low)}–${formatGrams(protein.endurance.high)} g/日`, "1.2–1.6 g/kg")}
            ${row("蛋白 · 增肌", `${formatGrams(protein.hypertrophy.low)}–${formatGrams(protein.hypertrophy.high)} g/日`, "1.6–2.2 g/kg")}
            ${row("肌酸负荷", `${formatGrams(creatine.loading)} g/日 × 5–7 天`, "0.3 g/kg，可分 3–4 次")}
            ${row("肌酸维持", `${creatine.maintenanceLow}–${creatine.maintenanceHigh} g/日`, "也可跳过负荷、直接维持")}
            ${row("运动中碳水", during.text, during.note)}
            ${row("日常碳水", `${formatGrams(daily.low)}–${formatGrams(daily.high)} g/日`, daily.note)}
          </tbody>
        </table>`;
  if (racePlan) {
    return `
      <div class="block">
        <details class="method-details">
          <summary>按体重 ${formatKg(kg)} kg · 咖啡因、蛋白、肌酸、日常碳水</summary>
          ${table}
        </details>
      </div>
    `;
  }
  return `
      <div class="block">
        <p class="result-kicker">按体重 ${formatKg(kg)} kg</p>
        ${table}
      </div>
    `;
}

const DIY_CHOICES: readonly DiyIngredientChoice[] = [
  "sucrose",
  "dextroseMonohydrate",
  "dextroseAnhydrous",
  "hfcs42",
  "hfcs55",
  "glucoseSucrose1to1",
  "custom",
];

function parseDiyChoice(raw: string): DiyIngredientChoice {
  return DIY_CHOICES.find((c) => c === raw) ?? "sucrose";
}

const DIY_CHOICE_NAME: Record<DiyIngredientChoice, string> = {
  sucrose: "白砂糖",
  dextroseMonohydrate: "一水葡萄糖",
  dextroseAnhydrous: "无水葡萄糖",
  hfcs42: "果葡糖浆 F42",
  hfcs55: "果葡糖浆 F55",
  glucoseSucrose1to1: "一水葡萄糖 + 白砂糖 1:1",
  custom: "按配料表的原料",
};

function ingredientName(id: IngredientId): string {
  return DIY_CHOICE_NAME[id];
}

function parseSaltChoice(raw: string): SaltId {
  if (raw === "refined" || raw === "iodized" || raw === "lowSodium" || raw === "custom") return raw;
  return "refined";
}

const DIY_INPUTS = ["dy-label", "dy-conc-custom", "dy-carb", "dy-servings", "dy-gel-carb"] as const;

function sugarHtml(racePlan: RaceFuelPlan | null, gelAssumed: boolean): { html: string; drinkVolumeL: number | null } | null {
  const choice = parseDiyChoice(inputValue("dy-ing"));
  const concRaw = inputValue("dy-conc");
  show("dy-conc-custom-wrap", concRaw === "custom");
  const concField = concRaw === "custom" ? numberField("dy-conc-custom") : { value: parseNumber(concRaw), invalid: false };
  const conc = concField.value !== null && concField.value > 0 ? concField.value : null;
  const gelMode = conc !== null && isGelConcentration(conc);

  const raceGels = racePlan?.during.gels ?? null;
  const midpoint = raceCarbMidpoint(racePlan);
  const defaultPerGel = raceGels?.gramsPerGel ?? DEFAULT_GEL_GRAMS;
  show("dy-carb-wrap", !gelMode);
  show("dy-gel-wrap", gelMode);
  show("dy-servings-hint", gelMode);
  setText("dy-servings-label", gelMode ? "做几支" : "分几份（可选）");
  setText(
    "dy-servings-hint",
    raceGels ? `留空按比赛日补给能量胶支数的下限：${raceGels.countLow} 支。` : "填要做几支；填了比赛日预计时长后，留空按能量胶支数下限。",
  );
  setText(
    "dy-gel-hint",
    raceGels
      ? `留空按比赛日补给的每支能量胶：${formatGrams(defaultPerGel)} g${gelAssumed ? "（那里没填，按 25 g）" : ""}。`
      : `留空按 ${DEFAULT_GEL_GRAMS} g。`,
  );
  const gelInput = document.getElementById("dy-gel-carb");
  if (gelInput instanceof HTMLInputElement) gelInput.placeholder = formatGrams(defaultPerGel);
  setText(
    "dy-carb-hint",
    midpoint !== null
      ? `留空时取比赛日补给全程碳水的中点：${formatGrams(midpoint)} g。`
      : "留空时取比赛日补给全程碳水的中点；上面填时长后才有。",
  );

  const touched = DIY_INPUTS.some((id) => inputValue(id).trim() !== "") || concRaw !== "8" || choice !== "sucrose";
  if (!touched && racePlan === null) return null;

  const wrap = (body: string): string => `
    <div class="block">
      <p class="result-kicker">自制补给 · ${gelMode ? "自制胶" : "糖水"}</p>
      ${body}
    </div>`;
  const message = (text: string): { html: string; drinkVolumeL: null } => ({ html: wrap(`<p class="result-method">${text}</p>`), drinkVolumeL: null });

  if (conc === null || conc > 100 || concField.invalid) return message("自定义浓度填 1–100 之间的百分数。");
  const label = numberField("dy-label");
  const carb = numberField("dy-carb");
  const servings = numberField("dy-servings");
  const perGel = numberField("dy-gel-carb");
  const outOfRange = [
    label.invalid ? "配料表碳水" : "",
    !gelMode && carb.invalid ? "总碳水" : "",
    servings.invalid ? (gelMode ? "做几支" : "分几份") : "",
    gelMode && perGel.invalid ? "每支碳水" : "",
  ].filter(Boolean);
  if (outOfRange.length > 0) return message(`${outOfRange.map((n) => `「${n}」`).join("、")}超出范围，按输入框下的提示改。`);

  const target = diyCarbTarget({
    concentrationPct: conc,
    totalCarbG: carb.value,
    servings: servings.value,
    perGelCarbG: perGel.value,
    plan: racePlan,
  });
  if (target.carbGrams === null) {
    switch (target.missing) {
      case "total":
        return message("填总碳水克数，或在比赛日补给里填一个超过 75 分钟的时长。");
      case "count":
        return message("填做几支；或在比赛日补给里填一个超过 75 分钟的时长，按能量胶支数下限。");
      case "badServings":
        return message(gelMode ? "支数填正整数。" : "份数填正整数。");
      default: {
        const exhaustive: never = target;
        throw new Error(`未处理的缺失项: ${String(exhaustive)}`);
      }
    }
  }

  const labelValue = label.value ?? undefined;
  const parts = diyRecipeParts(choice, choice === "glucoseSucrose1to1" ? undefined : labelValue);
  if (!parts) {
    return message(
      choice === "custom" ? "选「其他 / 按配料表」时，需填配料表里每 100 g 的碳水克数。" : "配料表碳水需在 1–100 g/100 g 之间。",
    );
  }
  const recipe = planRecipe({ parts, carbGrams: target.carbGrams, concentrationPct: conc });
  if (!recipe) {
    const max = maxConcentrationPct(parts);
    return message(
      max !== null && conc > max
        ? `${DIY_CHOICE_NAME[choice]} 不加水最高约 ${max.toFixed(0)}%，配不出 ${conc}%。换浓度更低的档，或换含碳水更高的原料。`
        : "这组输入算不出配方，请核对。",
    );
  }

  const a = recipe.analysis;
  const items = recipe.items.map((it) => `${ingredientName(it.ingredient)} ${formatGrams(it.grams)} g`).join(" + ");
  const water = Math.round(recipe.waterToAddGrams);
  const ratio =
    a.sugars === null
      ? "原料组成未知，算不出"
      : a.sugars.glucoseToFructose === null
        ? "只有葡萄糖，没有果糖"
        : `约 ${a.sugars.glucoseToFructose.toFixed(1)} : 1（果糖占 ${(a.sugars.fructoseShare * 100).toFixed(0)}%）`;
  let osmo: string;
  if (a.osmolality) {
    const vs = a.osmolality.vsPlasma === "below" ? "低于" : a.osmolality.vsPlasma === "above" ? "高于" : "接近";
    osmo = `约 ${Math.round(a.osmolality.mOsmPerKg)} mOsm/kg（近似估算，非实测），${vs}血浆 ${PLASMA_OSMOLALITY.low}–${PLASMA_OSMOLALITY.high}`;
  } else if (a.osmolalityUnavailable === "tooConcentrated") {
    osmo = `浓度超过 ${CONCENTRATED_PCT}%，理想溶液近似误差太大，不估算`;
  } else {
    osmo = "只知道配料表碳水，不知道糖的组成，无法估算";
  }

  let source: string;
  let servingItem = "";
  const warnings = a.warnings.map((w) => RECIPE_WARNING_TEXT[w]);
  if (target.mode === "gel") {
    const countFrom = target.countSource === "user" ? "支数是你填的" : "支数取比赛日补给能量胶的下限";
    const perFrom =
      target.perGelSource === "user"
        ? "每支碳水是你填的"
        : target.perGelSource === "race"
          ? `每支碳水同比赛日补给的能量胶${gelAssumed ? "（那里没填，按 25 g）" : ""}`
          : `每支碳水按 ${DEFAULT_GEL_GRAMS} g`;
    source = `${target.count} 支 × 每支碳水 ${formatGrams(target.perGelCarbG)} g = ${formatGrams(target.carbGrams)} g · ${countFrom}，${perFrom}`;
    servingItem = raceItem("每支", formatGrams(a.totalGrams / target.count), "g", `含碳水 ${formatGrams(target.perGelCarbG)} g，共 ${target.count} 支`);
    if (target.largerThanCommercial) {
      warnings.push(
        `每支碳水超过约 ${LARGE_GEL_CARB_G} g，比常见市售能量胶大：多数单支约 20–30 g 碳水，高碳款约 40 g（产品标签观察，以包装为准）。`,
      );
    }
  } else {
    source = `总碳水 ${formatGrams(target.carbGrams)} g · ${target.totalSource === "user" ? "你填的总碳水" : "来自比赛日补给（全程区间的中点）"}`;
    if (target.servings !== null) {
      servingItem = raceItem(
        `分 ${target.servings} 份`,
        formatGrams(a.totalGrams / target.servings),
        "g / 份",
        `每份含碳水约 ${formatGrams(target.carbGrams / target.servings)} g`,
      );
    }
  }

  const glucoseOnly = a.sugars !== null && a.sugars.fructoseG === 0;
  if (glucoseOnly && racePlan !== null && racePlan.during.highPerHour > 60) {
    warnings.push(
      "只用葡萄糖时，肠道吸收葡萄糖的转运体（SGLT1）约 60 g/h 就饱和；想吃到 60 g/h 以上要加果糖或蔗糖（Jeukendrup 2014）。这是吸收上限，和能不能溶解是两回事。",
    );
  }
  const html = wrap(`
      <p class="result-method">${source}；浓度 ${conc}%${concRaw === "50" ? "（无文献推荐值，DIY 起点）" : ""}。</p>
      <div class="result-goals">
        ${raceItem("原料", items, "", "按配料表碳水折算；糖浆自带的水已扣除")}
        ${raceItem("加水", `${water}`, "g ≈ mL", `成品总重约 ${formatGrams(a.totalGrams)} g，热量约 ${Math.round(a.kcal)} kcal`)}
        ${servingItem}
        ${raceItem(
          "葡萄糖 : 果糖",
          ratio,
          "",
          recipe.items.some((it) => it.ingredient === "sucrose")
            ? "蔗糖按 1:1 拆成葡萄糖和果糖；Trommelen 2017：蔗糖提供的果糖与游离果糖效果相当"
            : "按原料典型组成估算；果葡糖浆以配料表和产品规格为准",
        )}
        ${raceItem("估算渗透压", a.osmolality ? `${Math.round(a.osmolality.mOsmPerKg)}` : "—", a.osmolality ? "mOsm/kg" : "", osmo)}
        ${noteItem(warnings.map((w) => `<p class="result-method">${w}</p>`))}
      </div>
  `);
  return { html, drinkVolumeL: gelMode ? null : a.totalGrams / 1000 };
}

const CAPSULE_SIZES: readonly CapsuleSize[] = ["00", "0", "1"];

function saltHtml(sweatLitersPerHour: number | null, raceMinutes: number | null, drinkVolumeL: number | null, touched: boolean): string | null {
  const salt = parseSaltChoice(inputValue("sa-salt"));
  const labelField = numberField("sa-label");
  const label = labelField.value ?? undefined;
  const sel: SaltSelection = label === undefined ? { salt } : { salt, labelSodiumMgPer100g: label };
  const needsLabel = SALTS[salt].sodiumMgPer100g === null;
  const anyInput =
    touched || ["sa-label", "sa-cap10", "sa-sweatna"].some((id) => inputValue(id).trim() !== "") || inputValue("sa-replace") !== "";
  if (!anyInput && sweatLitersPerHour === null && drinkVolumeL === null) return null;

  const wrap = (body: string): string => `
    <div class="block">
      <p class="result-kicker">自制补给 · 盐丸 / 饮料加盐</p>
      ${body}
    </div>`;
  if (labelField.invalid) {
    return wrap(`<p class="result-method">配料表钠填 1–40,000 mg/100 g（纯氯化钠约 39,340）；更大多半是单位填错。</p>`);
  }
  if (needsLabel && label === undefined) {
    return wrap(`<p class="result-method">${salt === "lowSodium" ? "低钠盐" : "这种盐"}的钠含量因产品而异，先填配料表里的钠 mg/100 g。</p>`);
  }

  const items: string[] = [];
  const capNet = readNumber("sa-cap10");
  const capsule = capNet === null ? null : capsuleFromWeighing({ netSaltGrams: capNet, capsuleCount: 10, ...sel });
  if (capsule) {
    items.push(
      raceItem("每粒盐丸", `${Math.round(capsule.sodiumMgPerCapsule)}`, "mg 钠", `含盐 ${Math.round(capsule.saltMgPerCapsule)} mg（按 10 粒净重 ${capNet} g 算）`),
    );
  } else {
    const rows = CAPSULE_SIZES.map((size) => {
      const est = capsuleFillEstimate(size, sel);
      return est ? `${size} 号 ${Math.round(est.saltMgLow)}–${Math.round(est.saltMgHigh)} mg 盐（${Math.round(est.sodiumMgLow)}–${Math.round(est.sodiumMgHigh)} mg 钠）` : "";
    }).filter(Boolean);
    items.push(raceItem("每粒盐丸 · 粗估，以称重为准", "未称重", "", `装满时：${rows.join("；")}。按胶囊容积 × 细盐堆积密度估，实际装量差别大`));
  }

  const sweatNaField = numberField("sa-sweatna");
  const sweatNa = sweatNaField.value;
  const hours = raceMinutes === null ? null : raceMinutes / 60;
  const totalText = (mgPerHour: number): string => (hours === null ? "" : `，全程约 ${Math.round(mgPerHour * hours)} mg`);
  let lossLow: number | null = null;
  let lossHigh: number | null = null;
  if (sweatLitersPerHour === null) {
    items.push(raceItem("汗钠流失", "先测出汗率", "", "用表单里的「出汗率」测一次，才能估每小时流失多少钠"));
  } else if (sweatNaField.invalid) {
    items.push(raceItem("汗钠流失", "—", "", "汗钠浓度填 5–150 mmol/L"));
  } else if (sweatNa !== null) {
    const loss = sweatSodiumLoss(sweatLitersPerHour, sweatNa);
    if (loss) {
      lossLow = loss.mgPerHour;
      lossHigh = loss.mgPerHour;
      items.push(
        raceItem(
          "汗钠流失",
          `${Math.round(loss.mgPerHour)}`,
          "mg/h",
          `你测的出汗率 ${sweatLitersPerHour.toFixed(2)} L/h × 你的汗钠 ${sweatNa} mmol/L${totalText(loss.mgPerHour)}。这是流失量，不是补充处方`,
        ),
      );
    }
  } else {
    const range = sweatSodiumLossRange(sweatLitersPerHour);
    if (range) {
      lossLow = range.low;
      lossHigh = range.high;
      items.push(
        raceItem(
          "汗钠流失 · 按平均汗钠",
          `约 ${Math.round(range.mean)}`,
          "mg/h",
          `你测的出汗率 ${sweatLitersPerHour.toFixed(2)} L/h × 汗钠 ${SWEAT_SODIUM_MMOL_PER_L.mean} mmol/L（Baker 2016，506 名运动员的均值）${totalText(range.mean)}。这是流失量，不是补充处方`,
        ),
        raceItem(
          "汗钠流失 · 个体范围",
          `${Math.round(range.low)}–${Math.round(range.high)}`,
          "mg/h",
          `按全身汗钠 ${SWEAT_SODIUM_MMOL_PER_L.low}–${SWEAT_SODIUM_MMOL_PER_L.high} mmol/L（Baker 2017）${
            hours === null ? "" : `，全程约 ${Math.round(range.low * hours)}–${Math.round(range.high * hours)} mg`
          }。人与人差好几倍；Baker 2017 认为，按规范采集和解读的汗液检测可以帮助估计个人汗钠流失`,
        ),
      );
    }
  }

  const replace = parseNumber(inputValue("sa-replace"));
  if (replace !== null && lossLow !== null && lossHigh !== null) {
    if (capsule) {
      const low = capsulesPerHour({ lossMgPerHour: lossLow, replaceFraction: replace, sodiumMgPerCapsule: capsule.sodiumMgPerCapsule });
      const high = capsulesPerHour({ lossMgPerHour: lossHigh, replaceFraction: replace, sodiumMgPerCapsule: capsule.sodiumMgPerCapsule });
      if (low !== null && high !== null) {
        items.push(raceItem(`补回 ${Math.round(replace * 100)}%`, rangeText(low, high, 1), "粒/h", "比例是你选的，不是推荐值；饮料、食物里的钠也算进去"));
      }
    } else {
      items.push(raceItem(`补回 ${Math.round(replace * 100)}%`, "先称重", "", "称 10 粒胶囊的净盐重后给出每小时粒数；粗估装量误差太大"));
    }
  }

  if (drinkVolumeL !== null) {
    const g20 = saltGramsForDrink({ targetMmolPerL: ACSM_DRINK_SODIUM_MMOL_PER_L.low, volumeL: drinkVolumeL, ...sel });
    const g30 = saltGramsForDrink({ targetMmolPerL: ACSM_DRINK_SODIUM_MMOL_PER_L.high, volumeL: drinkVolumeL, ...sel });
    if (g20 !== null && g30 !== null) {
      items.push(
        raceItem(
          "糖水加盐",
          `${g20.toFixed(1)}–${g30.toFixed(1)}`,
          "g",
          `按上面糖水约 ${drinkVolumeL.toFixed(2)} L（成品总重 g ≈ mL）配到钠 ${ACSM_DRINK_SODIUM_MMOL_PER_L.low}–${ACSM_DRINK_SODIUM_MMOL_PER_L.high} mmol/L（ACSM 2007 引 IOM）。厨房秤精度不够时，按 1 L 的量配好再分装`,
        ),
      );
    }
  }

  return wrap(`<div class="result-goals">${items.join("")}</div>`);
}

function sweatHtml(): { html: string | null; litersPerHour: number | null } {
  const fields = {
    pre: numberField("sw-pre"),
    post: numberField("sw-post"),
    minutes: numberField("sw-min"),
    fluid: numberField("sw-fluid"),
    urine: numberField("sw-urine"),
  };
  const present = (f: { value: number | null; invalid: boolean }): boolean => f.value !== null || f.invalid;
  if (!present(fields.pre) || !present(fields.post) || !present(fields.minutes)) return { html: null, litersPerHour: null };
  const block = (body: string): string => `
      <div class="block">
        <p class="result-kicker">出汗率</p>
        ${body}
      </div>
    `;
  if (Object.values(fields).some((f) => f.invalid)) {
    return { html: block(`<p class="result-method">有数值超出输入框的范围，按输入框下的提示改正后再算。</p>`), litersPerHour: null };
  }
  const sweat = sweatTest({
    preKg: fields.pre.value ?? 0,
    postKg: fields.post.value ?? 0,
    fluidL: fields.fluid.value ?? 0,
    urineL: fields.urine.value ?? 0,
    minutes: fields.minutes.value ?? 0,
  });
  if (!sweat.ok) return { html: block(`<p class="result-method">${sweat.reason}</p>`), litersPerHour: null };
  return {
    litersPerHour: sweat.litersPerHour,
    html: block(`
        <p class="result-value">${sweat.litersPerHour.toFixed(2)}<small>L/h</small></p>
        <p class="result-method">（前体重 − 后体重 + 摄入 − 尿量）/ 时间。体重变化 ${sweat.bodyMassChangePct.toFixed(1)}%。超过约 2% 时表现常开始受损。</p>
      `),
  };
}

function render(): void {
  const empty = document.getElementById("fuel-empty");
  const output = document.getElementById("fuel-output");
  if (!empty || !output) return;

  const kg = readNumber("fu-kg");
  const sweat = sweatHtml();
  const duration = readRaceDuration();
  updateDurationEcho(duration);
  const gel = readGel();
  const racePlan =
    duration.status === "valid"
      ? raceFuelPlan({ minutes: duration.minutes, weightKg: kg, sweatLitersPerHour: sweat.litersPerHour, gelGrams: gel.grams })
      : null;
  const race = raceHtml(duration, racePlan, kg, gel.assumed);

  show("fu-session-hint", racePlan !== null);
  setText("fu-session-hint", racePlan ? `已填比赛日预计时长：结果里的「运动中碳水」按 ${formatDurationZh(racePlan.minutes)}给出。` : "");

  const sugar = sugarHtml(racePlan, gel.assumed);
  const saltTouched = inputValue("sa-salt") !== "refined";
  const salt = saltHtml(sweat.litersPerHour, racePlan?.minutes ?? null, sugar?.drinkVolumeL ?? null, saltTouched);
  const supplements = kg === null ? null : supplementHtml(kg, racePlan);

  const ordered = racePlan
    ? [race, sweat.html, sugar?.html ?? null, salt, supplements]
    : [supplements, sweat.html, race, sugar?.html ?? null, salt];
  const parts = ordered.filter((p): p is string => p !== null);

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

bindForm("fuel-form", render);
initChrome("fuel");
