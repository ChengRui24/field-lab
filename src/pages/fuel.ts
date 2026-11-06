import "../styles/base.css";
import { initChrome } from "../chrome";
import { bindForm, inputValue } from "../lib/dom";
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
  splitServings,
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
  carbDuring,
  creatineDose,
  DEFAULT_GEL_GRAMS,
  diyRecipeParts,
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

function raceFluidItem(plan: RaceFuelPlan): string {
  const f = plan.fluid;
  switch (f.status) {
    case "noSweat":
      return raceItem("饮水", "先测出汗率", "", "用上方出汗率测一次。不同人每小时出汗差好几倍，这里不给固定的 mL/h");
    case "noWeight":
      return raceItem("饮水", `≤ ${f.maxLitersPerHour.toFixed(2)}`, "L/h", "来自上方出汗率；填体重后给出下限");
    case "ok": {
      const floorNote =
        f.minLitersPerHour === 0
          ? "按这个出汗率，全程不喝体重也降不到 2%，渴了再喝，但不要超过上限。"
          : `下限让失水不超过体重 2%（${formatKg(f.allowableLossKg)} kg）。`;
      const longNote = plan.minutes > 180 ? "超过 3 小时，小偏差会累积。" : "";
      return raceItem(
        "饮水",
        rangeText(f.minLitersPerHour, f.maxLitersPerHour, 2),
        "L/h",
        `来自上方出汗率 ${f.maxLitersPerHour.toFixed(2)} L/h，全程 ${rangeText(f.minTotalL, f.maxTotalL, 1)} L。${floorNote}上限是出汗量本身，喝到体重增加有低钠风险。${longNote}`,
      );
    }
    default: {
      const exhaustive: never = f;
      throw new Error(`未处理的补液状态: ${String(exhaustive)}`);
    }
  }
}

function numberField(id: string): { value: number | null; bad: boolean } {
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement && el.validity.badInput) return { value: null, bad: true };
  const raw = inputValue(id);
  const value = parseNumber(raw);
  return { value, bad: raw.trim() !== "" && value === null };
}

function readRaceDuration(): RaceDuration {
  const hours = numberField("rf-hours");
  const mins = numberField("rf-mins");
  if (hours.bad || mins.bad) return { status: "invalid" };
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

function raceHtml(duration: RaceDuration, kg: number | null, sweatLitersPerHour: number | null): { html: string; plan: RaceFuelPlan | null } | null {
  if (duration.status === "empty") return null;
  const gelRaw = parseNumber(inputValue("rf-gel"));
  const gelAssumed = gelRaw === null || !(gelRaw > 0);
  const plan =
    duration.status === "valid"
      ? raceFuelPlan({ minutes: duration.minutes, weightKg: kg, sweatLitersPerHour, gelGrams: gelAssumed ? DEFAULT_GEL_GRAMS : gelRaw })
      : null;
  if (!plan) {
    return {
      plan: null,
      html: `
      <div class="block">
        <p class="result-kicker">比赛日补给</p>
        <p class="result-method">预计时长需大于 0 且不超过 24 小时：小时填 0–24，分钟填 0–59。</p>
      </div>
    `,
    };
  }

  return {
    plan,
    html: `
    <div class="block">
      <p class="result-kicker">比赛日补给 · 按 ${formatDurationZh(plan.minutes)}${kg !== null ? ` · ${formatKg(kg)} kg` : ""}</p>
      <div class="result-goals">
        ${racePreItems(plan)}
        ${raceDuringItems(plan, gelAssumed)}
        ${raceFluidItem(plan)}
      </div>
      <p class="result-method">钠：ACSM 2007 引用的运动饮料约含钠 20–30 mEq/L（约 460–690 mg/L）。汗钠个体差异大，这里不给个人钠量。出汗率随天气和强度变，比赛条件差别大时重新测。</p>
    </div>
  `,
  };
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

function positive(value: number | null): number | undefined {
  return value !== null && value > 0 ? value : undefined;
}

function sugarHtml(racePlan: RaceFuelPlan | null): { html: string; drinkVolumeL: number | null } | null {
  const choice = parseDiyChoice(inputValue("dy-ing"));
  const label = positive(parseNumber(inputValue("dy-label")));
  const userCarb = positive(parseNumber(inputValue("dy-carb")));
  const midpoint = raceCarbMidpoint(racePlan);
  const hint = document.getElementById("dy-carb-hint");
  if (hint) {
    hint.textContent =
      midpoint !== null
        ? `留空时取比赛日补给全程碳水的中点：${formatGrams(midpoint)} g。`
        : "留空时取比赛日补给全程碳水的中点；上面填时长后才有。";
  }
  const carbGrams = userCarb ?? midpoint;
  const carbSource = userCarb !== undefined ? "你填的总碳水" : "来自比赛日补给（全程区间的中点）";

  const concRaw = inputValue("dy-conc");
  const customWrap = document.getElementById("dy-conc-custom-wrap");
  if (customWrap) customWrap.hidden = concRaw !== "custom";
  const conc = concRaw === "custom" ? positive(parseNumber(inputValue("dy-conc-custom"))) : positive(parseNumber(concRaw));

  const wrap = (body: string): string => `
    <div class="block">
      <p class="result-kicker">自制补给 · 糖水 / 自制胶</p>
      ${body}
    </div>`;

  if (carbGrams === null || carbGrams === undefined) {
    if (inputValue("dy-carb").trim() === "" && racePlan === null) return null;
    return {
      html: wrap(`<p class="result-method">填总碳水克数，或在比赛日补给里填一个超过 75 分钟的时长。</p>`),
      drinkVolumeL: null,
    };
  }
  if (conc === undefined || conc > 100) {
    return { html: wrap(`<p class="result-method">自定义浓度填 1–100 之间的百分数。</p>`), drinkVolumeL: null };
  }
  const parts = diyRecipeParts(choice, choice === "glucoseSucrose1to1" ? undefined : label);
  if (!parts) {
    const why =
      choice === "custom"
        ? "选「其他 / 按配料表」时，需填配料表里每 100 g 的碳水克数。"
        : "配料表碳水需在 1–100 g/100 g 之间。";
    return { html: wrap(`<p class="result-method">${why}</p>`), drinkVolumeL: null };
  }
  const recipe = planRecipe({ parts, carbGrams, concentrationPct: conc });
  if (!recipe) {
    const max = maxConcentrationPct(parts);
    const why =
      max !== null && conc > max
        ? `${DIY_CHOICE_NAME[choice]} 不加水最高约 ${max.toFixed(0)}%，配不出 ${conc}%。换浓度更低的档，或换含碳水更高的原料。`
        : "这组输入算不出配方，请核对。";
    return { html: wrap(`<p class="result-method">${why}</p>`), drinkVolumeL: null };
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

  const servingsRaw = parseNumber(inputValue("dy-servings"));
  let servingLine = "";
  if (servingsRaw !== null) {
    const perServing = splitServings(a.totalGrams, servingsRaw);
    servingLine =
      perServing === null
        ? `<p class="result-method">份数填正整数。</p>`
        : `<p class="result-method">分 ${servingsRaw} 份：每份约 ${formatGrams(perServing)} g，含碳水约 ${formatGrams(a.carbGrams / servingsRaw)} g。</p>`;
  }

  const warnings = a.warnings.map((w) => RECIPE_WARNING_TEXT[w]);
  const glucoseOnly = a.sugars !== null && a.sugars.fructoseG === 0;
  if (glucoseOnly && racePlan !== null && racePlan.during.highPerHour > 60) {
    warnings.push(
      "只用葡萄糖时，肠道吸收葡萄糖的转运体（SGLT1）约 60 g/h 就饱和；想吃到 60 g/h 以上要加果糖或蔗糖（Jeukendrup 2014）。这是吸收上限，和能不能溶解是两回事。",
    );
  }
  const isDrink = a.concentrationPct <= CONCENTRATED_PCT;
  const html = wrap(`
      <p class="result-method">总碳水 ${formatGrams(carbGrams)} g · ${carbSource}；浓度 ${conc}%${concRaw === "50" ? "（无文献推荐值，DIY 起点）" : ""}。</p>
      <div class="result-goals">
        ${raceItem("原料", items, "", "按配料表碳水折算；糖浆自带的水已扣除")}
        ${raceItem("加水", `${water}`, "g ≈ mL", `成品总重约 ${formatGrams(a.totalGrams)} g，热量约 ${Math.round(a.kcal)} kcal`)}
        ${raceItem(
          "葡萄糖 : 果糖",
          ratio,
          "",
          recipe.items.some((it) => it.ingredient === "sucrose")
            ? "蔗糖按 1:1 拆成葡萄糖和果糖；Trommelen 2017：蔗糖提供的果糖与游离果糖效果相当"
            : "按原料典型组成估算；果葡糖浆以配料表和产品规格为准",
        )}
        ${raceItem("估算渗透压", a.osmolality ? `${Math.round(a.osmolality.mOsmPerKg)}` : "—", a.osmolality ? "mOsm/kg" : "", osmo)}
      </div>
      ${servingLine}
      ${warnings.map((w) => `<p class="result-method">${w}</p>`).join("")}
  `);
  return { html, drinkVolumeL: isDrink ? a.totalGrams / 1000 : null };
}

const CAPSULE_SIZES: readonly CapsuleSize[] = ["00", "0", "1"];

function saltHtml(sweatLitersPerHour: number | null, raceMinutes: number | null, drinkVolumeL: number | null, touched: boolean): string | null {
  const salt = parseSaltChoice(inputValue("sa-salt"));
  const label = positive(parseNumber(inputValue("sa-label")));
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
  if (needsLabel && label === undefined) {
    return wrap(`<p class="result-method">${salt === "lowSodium" ? "低钠盐" : "这种盐"}的钠含量因产品而异，先填配料表里的钠 mg/100 g。</p>`);
  }
  if (label !== undefined && label > 40000) {
    return wrap(`<p class="result-method">钠超过 40,000 mg/100 g 不可能（纯氯化钠约 39,340），多半是单位填错。</p>`);
  }

  const items: string[] = [];
  const capNet = positive(parseNumber(inputValue("sa-cap10")));
  const capsule = capNet === undefined ? null : capsuleFromWeighing({ netSaltGrams: capNet, capsuleCount: 10, ...sel });
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

  const sweatNa = positive(parseNumber(inputValue("sa-sweatna")));
  const hours = raceMinutes === null ? null : raceMinutes / 60;
  let lossLow: number | null = null;
  let lossHigh: number | null = null;
  if (sweatLitersPerHour === null) {
    items.push(raceItem("汗钠流失", "先测出汗率", "", "用上方出汗率测一次，才能估每小时流失多少钠"));
  } else if (sweatNa !== undefined) {
    const loss = sweatSodiumLoss(sweatLitersPerHour, sweatNa);
    if (loss) {
      lossLow = loss.mgPerHour;
      lossHigh = loss.mgPerHour;
      const total = hours === null ? "" : `，全程约 ${Math.round(loss.mgPerHour * hours)} mg`;
      items.push(raceItem("汗钠流失", `${Math.round(loss.mgPerHour)}`, "mg/h", `出汗率 ${sweatLitersPerHour.toFixed(2)} L/h（来自上方出汗率）× 你的汗钠 ${sweatNa} mmol/L${total}。这是流失量，不是补充处方`));
    } else {
      items.push(raceItem("汗钠流失", "—", "", "汗钠浓度需在 0–150 mmol/L 之间"));
    }
  } else {
    const range = sweatSodiumLossRange(sweatLitersPerHour);
    if (range) {
      lossLow = range.low;
      lossHigh = range.high;
      const total = hours === null ? "" : `，全程约 ${Math.round(range.low * hours)}–${Math.round(range.high * hours)} mg`;
      items.push(
        raceItem(
          "汗钠流失",
          `${Math.round(range.low)}–${Math.round(range.high)}`,
          "mg/h",
          `出汗率 ${sweatLitersPerHour.toFixed(2)} L/h（来自上方出汗率）× 全身汗钠 ${SWEAT_SODIUM_MMOL_PER_L.low}–${SWEAT_SODIUM_MMOL_PER_L.high} mmol/L（Baker 2017；均值约 ${SWEAT_SODIUM_MMOL_PER_L.mean}，Baker 2016）${total}。这是流失量，不是补充处方`,
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

function render(): void {
  const empty = document.getElementById("fuel-empty");
  const output = document.getElementById("fuel-output");
  if (!empty || !output) return;

  const kg = parseNumber(inputValue("fu-kg"));
  const parts: string[] = [];

  if (kg !== null && kg > 0) {
    const caffeine = caffeineDose(kg);
    const protein = proteinDose(kg);
    const creatine = creatineDose(kg);
    const session = carbDuring(parseSession(inputValue("fu-session")));
    const daily = carbDaily(kg, parseDay(inputValue("fu-day")));
    parts.push(`
      <div class="block">
        <p class="result-kicker">按体重 ${formatKg(kg)} kg</p>
        <table class="result-table">
          <thead><tr><th>项目</th><th>剂量</th><th></th></tr></thead>
          <tbody>
            <tr><td>咖啡因</td><td class="mono">${formatGrams(caffeine.low)}–${formatGrams(caffeine.high)} mg</td><td>3–6 mg/kg，运动前约 60 分钟（30–90）</td></tr>
            <tr><td>蛋白 · 耐力</td><td class="mono">${formatGrams(protein.endurance.low)}–${formatGrams(protein.endurance.high)} g/日</td><td>1.2–1.6 g/kg</td></tr>
            <tr><td>蛋白 · 增肌</td><td class="mono">${formatGrams(protein.hypertrophy.low)}–${formatGrams(protein.hypertrophy.high)} g/日</td><td>1.6–2.2 g/kg</td></tr>
            <tr><td>肌酸负荷</td><td class="mono">${formatGrams(creatine.loading)} g/日 × 5–7 天</td><td>0.3 g/kg，可分 3–4 次</td></tr>
            <tr><td>肌酸维持</td><td class="mono">${creatine.maintenanceLow}–${creatine.maintenanceHigh} g/日</td><td>也可跳过负荷、直接维持</td></tr>
            <tr><td>运动中碳水</td><td class="mono">${
              session.high === 0 ? "不必额外补糖" : `${session.low}–${session.high} g/h`
            }</td><td>${session.note}</td></tr>
            <tr><td>日常碳水</td><td class="mono">${formatGrams(daily.low)}–${formatGrams(daily.high)} g/日</td><td>${daily.note}</td></tr>
          </tbody>
        </table>
      </div>
    `);
  }

  const pre = parseNumber(inputValue("sw-pre"));
  const post = parseNumber(inputValue("sw-post"));
  const minutes = parseNumber(inputValue("sw-min"));
  const fluid = parseNumber(inputValue("sw-fluid")) ?? 0;
  const urine = parseNumber(inputValue("sw-urine")) ?? 0;
  let sweatLitersPerHour: number | null = null;
  if (pre !== null && post !== null && minutes !== null) {
    const sweat = sweatTest({ preKg: pre, postKg: post, fluidL: fluid, urineL: urine, minutes });
    if (sweat.ok) sweatLitersPerHour = sweat.litersPerHour;
    parts.push(
      sweat.ok
        ? `
      <div class="block">
        <p class="result-kicker">出汗率</p>
        <p class="result-value">${sweat.litersPerHour.toFixed(2)}<small>L/h</small></p>
        <p class="result-method">（前体重 − 后体重 + 摄入 − 尿量）/ 时间。体重变化 ${sweat.bodyMassChangePct.toFixed(1)}%。超过约 2% 时表现常开始受损。</p>
      </div>
    `
        : `
      <div class="block">
        <p class="result-kicker">出汗率</p>
        <p class="result-method">${sweat.reason}</p>
      </div>
    `,
    );
  }

  const duration = readRaceDuration();
  updateDurationEcho(duration);
  const race = raceHtml(duration, kg !== null && kg > 0 ? kg : null, sweatLitersPerHour);
  if (race) parts.push(race.html);
  const racePlan = race?.plan ?? null;

  const sugar = sugarHtml(racePlan);
  if (sugar) parts.push(sugar.html);
  const saltTouched = inputValue("sa-salt") !== "refined";
  const salt = saltHtml(sweatLitersPerHour, racePlan?.minutes ?? null, sugar?.drinkVolumeL ?? null, saltTouched);
  if (salt) parts.push(salt);

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
