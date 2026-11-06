/**
 * DIY 能量饮料 / 能量胶 / 盐胶囊计算（纯函数，无 UI）。
 * 约定：非法输入返回 null；任何输出都不会是 Infinity / NaN。
 * 浓度一律指「碳水化合物占最终溶液总质量的百分比（% w/w）」。
 */

const isPos = (x: number): boolean => Number.isFinite(x) && x > 0;
const isNonNeg = (x: number): boolean => Number.isFinite(x) && x >= 0;
const finiteOrNull = (x: number): number | null => (Number.isFinite(x) ? x : null);

// ───────────────────────── 分子量与通用常数 ─────────────────────────

/** 葡萄糖 / 果糖 C6H12O6，g/mol。 */
export const MW_HEXOSE = 180.16;
/** 一水葡萄糖 C6H12O6·H2O，g/mol（180.16 + 18.015）。 */
export const MW_GLUCOSE_MONOHYDRATE = 198.17;
/** 蔗糖 C12H22O11，g/mol。 */
export const MW_SUCROSE = 342.3;
/** 钠，g/mol（1 mmol Na = 22.99 mg）。 */
export const MW_NA = 22.99;
/** 氯化钠，g/mol。 */
export const MW_NACL = 58.44;
/** NaCl 中钠的质量分数 22.99/58.44 ≈ 0.3934（1 g 盐 ≈ 393 mg 钠）。 */
export const NA_FRACTION_NACL = MW_NA / MW_NACL;
/** 碳水化合物能量系数（Atwater）。 */
export const KCAL_PER_G_CARB = 4;

// ───────────────────────── 糖类原料 ─────────────────────────

export type IngredientId =
  | "sucrose"
  | "dextroseMonohydrate"
  | "dextroseAnhydrous"
  | "hfcs42"
  | "hfcs55"
  | "custom";

/** 碳水化合物内部组成（各项为占碳水质量的比例，合计 1）。oligo = 低聚糖等高级糖，渗透压按二糖分子量近似。 */
export interface CarbComposition {
  glucose: number;
  fructose: number;
  sucrose: number;
  oligo: number;
}

export interface IngredientInfo {
  id: IngredientId;
  name: string;
  form: "powder" | "syrup";
  /** 预设碳水 g/100 g；custom 为 null（必须用标签值）。 */
  carbPer100g: number | null;
  /** 预设会成为溶剂的水 g/100 g（糖浆游离水、一水葡萄糖结晶水）；未知为 null。 */
  waterPer100g: number | null;
  composition: CarbComposition | null;
  note: string;
}

const MONOHYDRATE_CARB_FRACTION = MW_HEXOSE / MW_GLUCOSE_MONOHYDRATE;

export const INGREDIENTS: Record<IngredientId, IngredientInfo> = {
  sucrose: {
    id: "sucrose",
    name: "白砂糖（蔗糖）",
    form: "powder",
    carbPer100g: 100,
    waterPer100g: 0,
    composition: { glucose: 0, fructose: 0, sucrose: 1, oligo: 0 },
    note:
      "中国食物成分表：碳水 99.9 g/100 g，按 100 计。蔗糖水解为葡萄糖:果糖 1:1，本身即是多种可转运碳水；" +
      "Trommelen 2017（Nutrients）：以蔗糖提供果糖与游离果糖的外源碳水氧化率无差异。Jeukendrup 2014（Sports Med）",
  },
  dextroseMonohydrate: {
    id: "dextroseMonohydrate",
    name: "一水葡萄糖",
    form: "powder",
    carbPer100g: 100 * MONOHYDRATE_CARB_FRACTION,
    waterPer100g: 100 * (1 - MONOHYDRATE_CARB_FRACTION),
    composition: { glucose: 1, fructose: 0, sucrose: 0, oligo: 0 },
    note: "碳水 = 180.16/198.17 ≈ 90.9%，其余 9.1% 为结晶水（溶解后成为溶剂）。市售标签常写 91–92 g/100 g",
  },
  dextroseAnhydrous: {
    id: "dextroseAnhydrous",
    name: "无水葡萄糖",
    form: "powder",
    carbPer100g: 100,
    waterPer100g: 0,
    composition: { glucose: 1, fructose: 0, sucrose: 0, oligo: 0 },
    note: "单一葡萄糖经 SGLT1 吸收，约 60 g/h 饱和（Jeukendrup 2014）",
  },
  hfcs42: {
    id: "hfcs42",
    name: "果葡糖浆 F42",
    form: "syrup",
    carbPer100g: 71,
    waterPer100g: 29,
    composition: { glucose: 0.52, fructose: 0.42, sucrose: 0, oligo: 0.06 },
    note: "干物质 ≈71%（GB/T 20882.4-2021 ≥70.5%；ISBT 71.0±0.5%），果糖 ≥42%（干基）。以包装标签为准",
  },
  hfcs55: {
    id: "hfcs55",
    name: "果葡糖浆 F55",
    form: "syrup",
    carbPer100g: 77,
    waterPer100g: 23,
    composition: { glucose: 0.41, fructose: 0.55, sucrose: 0, oligo: 0.04 },
    note: "干物质 ≈77%（GB/T 20882.4-2021 ≥76.5%；ISBT 77.0±0.5%），果糖 ≥55%（干基）。以包装标签为准",
  },
  custom: {
    id: "custom",
    name: "自定义（按标签）",
    form: "powder",
    carbPer100g: null,
    waterPer100g: null,
    composition: null,
    note: "只知道标签碳水 g/100 g 时，用量与浓度可算，渗透压与葡萄糖:果糖比无法计算",
  },
};

export interface ResolvedIngredient {
  id: IngredientId;
  /** 碳水占原料质量的比例 0–1。 */
  carbFraction: number;
  /** 会成为溶剂的水占原料质量的比例；未知为 null。 */
  waterFraction: number | null;
  composition: CarbComposition | null;
}

/**
 * 标签值优先，预设兜底。糖浆假定「非碳水部分 = 水」；粉末沿用预设结晶水（不超过 1 − 碳水）。
 * 标签值须在 (0, 100]，custom 必须提供标签值。
 */
export function resolveIngredient(id: IngredientId, labelCarbPer100g?: number): ResolvedIngredient | null {
  const info = INGREDIENTS[id];
  if (info === undefined) return null;
  if (labelCarbPer100g !== undefined && !(isPos(labelCarbPer100g) && labelCarbPer100g <= 100)) return null;
  const carbPer100g = labelCarbPer100g ?? info.carbPer100g;
  if (carbPer100g === null) return null;
  const carbFraction = carbPer100g / 100;
  let waterFraction: number | null;
  if (info.waterPer100g === null) waterFraction = null;
  else if (info.form === "syrup") waterFraction = 1 - carbFraction;
  else waterFraction = Math.min(info.waterPer100g / 100, 1 - carbFraction);
  return { id, carbFraction, waterFraction, composition: info.composition };
}

// ───────────────────────── 浓度预设与提示 ─────────────────────────

export interface ConcentrationPreset {
  low: number;
  high: number;
  /** 是否有文献给出的数值区间。 */
  sourced: boolean;
  note: string;
}

export const CONCENTRATION_PRESETS: Record<"sportsDrink" | "gelStyle", ConcentrationPreset> = {
  sportsDrink: {
    low: 6,
    high: 8,
    sourced: true,
    note:
      "ACSM 2007（Sawka）：常规运动饮料按 6–8% 碳水计；若一种饮料同时承担补液和补糖，浓度不应超过 8%（甚至略低），" +
      "高浓度会减慢胃排空。IOM 给出的运动饮料碳水范围为 ~5–10%",
  },
  gelStyle: {
    low: 50,
    high: 70,
    sourced: false,
    note:
      "无文献推荐区间，仅为 DIY 常用起点。商业能量胶普遍高浓度，产品标签要求配水服用（标签观察，非文献数值）。" +
      "Jeukendrup 2014：高浓度碳水溶液会降低液体吸收",
  },
};

/** ACSM 2007：单一饮料兼顾补液与补糖时碳水不应超过 8%。 */
export const DRINK_MAX_PCT = 8;
/** 超过此浓度视为「胶状 / 浓缩」，必须配水服用（工程阈值）。 */
export const CONCENTRATED_PCT = 20;
/** 室温（20–25 °C）饱和溶解度，g 溶质 / g 水：葡萄糖 ≈0.91（≈47.6% w/w），蔗糖 ≈2.0（≈66.7% w/w）。 */
export const SOLUBILITY_G_PER_G_WATER = { glucose: 0.909, sucrose: 2.0 } as const;

export type RecipeWarning = "aboveDrinkLimit" | "concentratedTakeWithWater" | "mayNotDissolve";

export const RECIPE_WARNING_TEXT: Record<RecipeWarning, string> = {
  aboveDrinkLimit: "碳水浓度超过 8%：会减慢胃排空、增加胃肠不适风险，不适合作为唯一补液饮料（ACSM 2007；Jeukendrup 2014）。",
  concentratedTakeWithWater: "这是浓缩胶 / 糖浆，必须配清水服用，不能当饮料喝。",
  mayNotDissolve: "按室温溶解度估算，葡萄糖或蔗糖可能溶不完（会析出结晶）；可加热溶解或降低浓度、改用蔗糖 / 果葡糖浆。",
};

// ───────────────────────── 渗透压 ─────────────────────────

/** 血浆渗透压参考，mOsm/kg。 */
export const PLASMA_OSMOLALITY = { low: 285, high: 295 } as const;
/** NaCl 有效渗透粒子数 = 2 × 渗透系数 0.93（生理浓度附近；USP <785> 标定表 0.93 @ 200–300 mOsm/kg）。 */
export const NACL_OSMOTIC_FACTOR = 1.86;
/** 理想稀溶液近似只在碳水 ≤20% w/w 时给出；更浓时非理想性显著（蔗糖偏差 >5%），返回 null。 */
export const OSMOLALITY_MAX_PCT = 20;

export interface OsmolalityEstimate {
  mOsmPerKg: number;
  /** 恒为 true：理想稀溶液近似（糖按 φ=1，NaCl 按 1.86），非实测。 */
  approximate: true;
  vsPlasma: "below" | "within" | "above";
}

export interface Solutes {
  glucoseG: number;
  fructoseG: number;
  /** 未水解的蔗糖，按完整二糖计。 */
  sucroseG: number;
  /** 低聚糖等，按二糖分子量近似。 */
  oligoG?: number;
  naclG?: number;
}

/** 理想近似 mOsm/kg 水 = 1000 × Σ(溶质 mol × 粒子数) / 溶剂水 kg。 */
export function idealOsmolality(solutes: Solutes, solventWaterGrams: number): number | null {
  const oligo = solutes.oligoG ?? 0;
  const nacl = solutes.naclG ?? 0;
  const parts = [solutes.glucoseG, solutes.fructoseG, solutes.sucroseG, oligo, nacl];
  if (!parts.every(isNonNeg) || !isPos(solventWaterGrams)) return null;
  const osmoles =
    (solutes.glucoseG + solutes.fructoseG) / MW_HEXOSE +
    (solutes.sucroseG + oligo) / MW_SUCROSE +
    (nacl / MW_NACL) * NACL_OSMOTIC_FACTOR;
  return finiteOrNull((1000 * osmoles) / (solventWaterGrams / 1000));
}

function compareToPlasma(mOsm: number): OsmolalityEstimate["vsPlasma"] {
  if (mOsm < PLASMA_OSMOLALITY.low) return "below";
  if (mOsm > PLASMA_OSMOLALITY.high) return "above";
  return "within";
}

// ───────────────────────── 配方分析（正算） ─────────────────────────

export interface RecipeItem {
  ingredient: IngredientId;
  grams: number;
  /** 标签碳水 g/100 g，提供时优先于预设。 */
  labelCarbPer100g?: number;
}

export interface SugarBreakdown {
  /** 按碳水质量计，蔗糖按 50/50 拆分（忽略水解增重约 5%，与产品标注「2:1」的惯例一致）。 */
  glucoseG: number;
  fructoseG: number;
  /** 不计入葡萄糖/果糖的低聚糖等。 */
  otherG: number;
  /** 葡萄糖 : 果糖（= 葡萄糖 / 果糖）；无果糖时为 null。 */
  glucoseToFructose: number | null;
  /** 果糖占（葡萄糖 + 果糖）的比例。 */
  fructoseShare: number;
}

export interface RecipeAnalysis {
  carbGrams: number;
  ingredientGrams: number;
  waterGrams: number;
  naclGrams: number;
  totalGrams: number;
  concentrationPct: number;
  kcal: number;
  /** 溶剂水 = 加入的水 + 糖浆游离水 + 结晶水；含未知原料时为 null。 */
  solventWaterGrams: number | null;
  sugars: SugarBreakdown | null;
  osmolality: OsmolalityEstimate | null;
  osmolalityUnavailable: "unknownComposition" | "tooConcentrated" | null;
  warnings: RecipeWarning[];
}

/** 已知原料克数 + 加水克数 → 浓度、热量、葡萄糖:果糖、估算渗透压。 */
export function analyzeRecipe(args: { items: RecipeItem[]; waterGrams: number; naclGrams?: number }): RecipeAnalysis | null {
  const naclGrams = args.naclGrams ?? 0;
  if (args.items.length === 0 || !isNonNeg(args.waterGrams) || !isNonNeg(naclGrams)) return null;

  let carbGrams = 0;
  let ingredientGrams = 0;
  let ingredientWater: number | null = 0;
  let sugars: { glucose: number; fructose: number; sucrose: number; oligo: number } | null = {
    glucose: 0,
    fructose: 0,
    sucrose: 0,
    oligo: 0,
  };
  let dextroseGlucose = 0;
  let sucroseOnly = 0;

  for (const item of args.items) {
    if (!isNonNeg(item.grams)) return null;
    const r = resolveIngredient(item.ingredient, item.labelCarbPer100g);
    if (r === null) return null;
    const carb = item.grams * r.carbFraction;
    carbGrams += carb;
    ingredientGrams += item.grams;
    ingredientWater = ingredientWater === null || r.waterFraction === null ? null : ingredientWater + item.grams * r.waterFraction;
    if (sugars !== null && r.composition !== null) {
      sugars.glucose += carb * r.composition.glucose;
      sugars.fructose += carb * r.composition.fructose;
      sugars.sucrose += carb * r.composition.sucrose;
      sugars.oligo += carb * r.composition.oligo;
    } else {
      sugars = null;
    }
    if (item.ingredient === "dextroseMonohydrate" || item.ingredient === "dextroseAnhydrous") dextroseGlucose += carb;
    if (item.ingredient === "sucrose") sucroseOnly += carb;
  }
  if (!isPos(carbGrams)) return null;

  const totalGrams = ingredientGrams + args.waterGrams + naclGrams;
  const concentrationPct = (carbGrams / totalGrams) * 100;
  if (!Number.isFinite(concentrationPct) || concentrationPct > 100) return null;
  const solventWaterGrams = ingredientWater === null ? null : args.waterGrams + ingredientWater;

  let breakdown: SugarBreakdown | null = null;
  if (sugars !== null) {
    const glucoseG = sugars.glucose + sugars.sucrose / 2;
    const fructoseG = sugars.fructose + sugars.sucrose / 2;
    const monos = glucoseG + fructoseG;
    breakdown = {
      glucoseG,
      fructoseG,
      otherG: sugars.oligo,
      glucoseToFructose: fructoseG > 0 ? glucoseG / fructoseG : null,
      fructoseShare: monos > 0 ? fructoseG / monos : 0,
    };
  }

  let osmolality: OsmolalityEstimate | null = null;
  let osmolalityUnavailable: RecipeAnalysis["osmolalityUnavailable"] = null;
  if (sugars === null || solventWaterGrams === null) osmolalityUnavailable = "unknownComposition";
  else if (concentrationPct > OSMOLALITY_MAX_PCT) osmolalityUnavailable = "tooConcentrated";
  else {
    const mOsm = idealOsmolality(
      { glucoseG: sugars.glucose, fructoseG: sugars.fructose, sucroseG: sugars.sucrose, oligoG: sugars.oligo, naclG: naclGrams },
      solventWaterGrams,
    );
    if (mOsm === null) osmolalityUnavailable = "tooConcentrated";
    else osmolality = { mOsmPerKg: mOsm, approximate: true, vsPlasma: compareToPlasma(mOsm) };
  }

  const warnings: RecipeWarning[] = [];
  if (concentrationPct > DRINK_MAX_PCT) warnings.push("aboveDrinkLimit");
  if (concentrationPct > CONCENTRATED_PCT) warnings.push("concentratedTakeWithWater");
  if (solventWaterGrams !== null) {
    const exceeds =
      solventWaterGrams <= 0
        ? dextroseGlucose + sucroseOnly > 0
        : dextroseGlucose / solventWaterGrams > SOLUBILITY_G_PER_G_WATER.glucose ||
          sucroseOnly / solventWaterGrams > SOLUBILITY_G_PER_G_WATER.sucrose;
    if (exceeds) warnings.push("mayNotDissolve");
  }

  return {
    carbGrams,
    ingredientGrams,
    waterGrams: args.waterGrams,
    naclGrams,
    totalGrams,
    concentrationPct,
    kcal: carbGrams * KCAL_PER_G_CARB,
    solventWaterGrams,
    sugars: breakdown,
    osmolality,
    osmolalityUnavailable,
    warnings,
  };
}

// ───────────────────────── 配方规划（反算） ─────────────────────────

export interface RecipePart {
  ingredient: IngredientId;
  /** 该原料提供的碳水份额（相对权重，内部归一化）；省略时为 1。 */
  carbShare?: number;
  labelCarbPer100g?: number;
}

export interface RecipePlan {
  items: (RecipeItem & { carbGrams: number })[];
  /** 需额外加入的水，g（≈ mL）。 */
  waterToAddGrams: number;
  analysis: RecipeAnalysis;
}

/** 比赛计划 g/h × 小时 → 总碳水 g。 */
export function carbTargetGrams(gPerHour: number, hours: number): number | null {
  if (!isPos(gPerHour) || !isPos(hours)) return null;
  return finiteOrNull(gPerHour * hours);
}

function normalizeParts(parts: RecipePart[]): { part: RecipePart; share: number; r: ResolvedIngredient }[] | null {
  if (parts.length === 0) return null;
  const resolved = [];
  let sum = 0;
  for (const part of parts) {
    const weight = part.carbShare ?? 1;
    if (!isPos(weight)) return null;
    const r = resolveIngredient(part.ingredient, part.labelCarbPer100g);
    if (r === null) return null;
    resolved.push({ part, weight, r });
    sum += weight;
  }
  return resolved.map(({ part, weight, r }) => ({ part, share: weight / sum, r }));
}

/** 该原料组合（不加水）能达到的最高碳水浓度 %。 */
export function maxConcentrationPct(parts: RecipePart[], naclGrams = 0): number | null {
  const norm = normalizeParts(parts);
  if (norm === null || !isNonNeg(naclGrams)) return null;
  // 每 1 g 碳水所需原料克数
  const gramsPerCarb = norm.reduce((acc, { share, r }) => acc + share / r.carbFraction, 0);
  return finiteOrNull(100 / gramsPerCarb);
}

/**
 * 目标碳水克数 + 目标浓度 → 各原料克数与加水量。
 * 加水量 = 碳水 / 浓度 − 原料总质量 − 盐（糖浆自带水与结晶水已扣除）。浓度超出原料可达上限时返回 null。
 */
export function planRecipe(args: {
  parts: RecipePart[];
  carbGrams: number;
  concentrationPct: number;
  naclGrams?: number;
}): RecipePlan | null {
  const naclGrams = args.naclGrams ?? 0;
  if (!isPos(args.carbGrams) || !isPos(args.concentrationPct) || args.concentrationPct > 100 || !isNonNeg(naclGrams)) {
    return null;
  }
  const norm = normalizeParts(args.parts);
  if (norm === null) return null;
  const items = norm.map(({ part, share, r }) => {
    const carbGrams = args.carbGrams * share;
    const item: RecipeItem & { carbGrams: number } = { ingredient: part.ingredient, grams: carbGrams / r.carbFraction, carbGrams };
    if (part.labelCarbPer100g !== undefined) item.labelCarbPer100g = part.labelCarbPer100g;
    return item;
  });
  const totalGrams = args.carbGrams / (args.concentrationPct / 100);
  const ingredientGrams = items.reduce((acc, it) => acc + it.grams, 0);
  const waterToAddGrams = totalGrams - ingredientGrams - naclGrams;
  // 允许浮点误差范围内的 0
  if (!Number.isFinite(waterToAddGrams) || waterToAddGrams < -1e-9) return null;
  const water = Math.max(0, waterToAddGrams);
  const analysis = analyzeRecipe({ items, waterGrams: water, naclGrams });
  if (analysis === null) return null;
  return { items, waterToAddGrams: water, analysis };
}

/** 平均分成 N 份（每支胶 / 每 20–30 分钟一份）。 */
export function splitServings(totalGrams: number, servings: number): number | null {
  if (!isPos(totalGrams) || !Number.isInteger(servings) || servings < 1) return null;
  return totalGrams / servings;
}

// ───────────────────────── 盐 ─────────────────────────

export type SaltId = "refined" | "iodized" | "lowSodium" | "bicarbonate" | "citrateDihydrate" | "custom";

export interface SaltInfo {
  id: SaltId;
  name: string;
  /** 预设钠 mg/100 g；低钠盐、自定义为 null（必须填标签值）。 */
  sodiumMgPer100g: number | null;
  note: string;
}

export const SALTS: Record<SaltId, SaltInfo> = {
  refined: {
    id: "refined",
    name: "精制盐",
    sodiumMgPer100g: 100_000 * NA_FRACTION_NACL,
    note: "按纯 NaCl 计 ≈39,340 mg/100 g；中国食物成分表「精盐」39,311 mg/100 g，差异 <0.1%",
  },
  iodized: {
    id: "iodized",
    name: "加碘盐",
    sodiumMgPer100g: 100_000 * NA_FRACTION_NACL,
    note: "碘酸钾添加量为 mg/kg 级，钠含量与精制盐相同",
  },
  lowSodium: {
    id: "lowSodium",
    name: "低钠盐",
    sodiumMgPer100g: null,
    note:
      "GB 2721-2015：以 KCl 替代部分 NaCl，KCl 10–35 g/100 g，钠含量因产品而异，必须填包装标签值。" +
      "含钾约 5–18 g/100 g；肾功能不全、高血钾或服用保钾类药物者慎用",
  },
  bicarbonate: {
    id: "bicarbonate",
    name: "小苏打 NaHCO₃",
    sodiumMgPer100g: (100_000 * MW_NA) / 84.01,
    note: "钠 27.4%（22.99/84.01）。大剂量常见胃肠不适",
  },
  citrateDihydrate: {
    id: "citrateDihydrate",
    name: "二水柠檬酸钠",
    sodiumMgPer100g: (100_000 * 3 * MW_NA) / 294.1,
    note: "Na₃C₆H₅O₇·2H₂O，钠 23.5%（3×22.99/294.10）；注意区分无水物（25.8%）",
  },
  custom: {
    id: "custom",
    name: "自定义（按标签钠）",
    sodiumMgPer100g: null,
    note: "填写营养成分表中的钠 mg/100 g",
  },
};

/** 标签钠上限：纯 NaCl ≈39,340 mg/100 g，留少量取整余量；超过多半是单位填错（如 mg/kg）。 */
export const MAX_LABEL_SODIUM_MG_PER_100G = 40_000;

/** 钠占盐质量的比例（mg 钠 / mg 盐）。标签值优先；低钠盐、自定义必须提供标签值。 */
export function saltSodiumFraction(salt: SaltId, labelSodiumMgPer100g?: number): number | null {
  const info = SALTS[salt];
  if (info === undefined) return null;
  if (
    labelSodiumMgPer100g !== undefined &&
    !(isPos(labelSodiumMgPer100g) && labelSodiumMgPer100g <= MAX_LABEL_SODIUM_MG_PER_100G)
  ) {
    return null;
  }
  const mgPer100g = labelSodiumMgPer100g ?? info.sodiumMgPer100g;
  if (mgPer100g === null) return null;
  return mgPer100g / 100_000;
}

export interface SaltSelection {
  salt: SaltId;
  labelSodiumMgPer100g?: number;
}

/** 盐克数 → 钠 mg。 */
export function sodiumMgFromSalt(saltGrams: number, sel: SaltSelection): number | null {
  const f = saltSodiumFraction(sel.salt, sel.labelSodiumMgPer100g);
  if (f === null || !isNonNeg(saltGrams)) return null;
  return saltGrams * 1000 * f;
}

/** 目标钠 mg → 需要的盐克数。 */
export function saltGramsForSodium(sodiumMg: number, sel: SaltSelection): number | null {
  const f = saltSodiumFraction(sel.salt, sel.labelSodiumMgPer100g);
  if (f === null || !isNonNeg(sodiumMg)) return null;
  return sodiumMg / f / 1000;
}

export interface CapsuleDose {
  saltMgPerCapsule: number;
  sodiumMgPerCapsule: number;
  sodiumMmolPerCapsule: number;
}

/** 称 N 粒装好的胶囊的净盐重（已扣空壳）→ 每粒盐 / 钠。 */
export function capsuleFromWeighing(args: { netSaltGrams: number; capsuleCount: number } & SaltSelection): CapsuleDose | null {
  if (!isPos(args.netSaltGrams) || !Number.isInteger(args.capsuleCount) || args.capsuleCount < 1) return null;
  const f = saltSodiumFraction(args.salt, args.labelSodiumMgPer100g);
  if (f === null) return null;
  const saltMgPerCapsule = (args.netSaltGrams * 1000) / args.capsuleCount;
  const sodiumMgPerCapsule = saltMgPerCapsule * f;
  return { saltMgPerCapsule, sodiumMgPerCapsule, sodiumMmolPerCapsule: sodiumMgPerCapsule / MW_NA };
}

export type CapsuleSize = "00" | "0" | "1";

/** 硬胶囊标称容积 mL（Capsugel / Lonza Coni-Snap）。 */
export const CAPSULE_VOLUME_ML: Record<CapsuleSize, number> = { "00": 0.91, "0": 0.68, "1": 0.5 };
/** 细食盐松装堆积密度 g/mL（Morton 规格书 1.12–1.27）。 */
export const SALT_BULK_DENSITY = { low: 1.12, high: 1.27 } as const;

export interface CapsuleFillEstimate {
  volumeMl: number;
  saltMgLow: number;
  saltMgHigh: number;
  sodiumMgLow: number;
  sodiumMgHigh: number;
}

/** 按胶囊容积 × 盐堆积密度粗估装量；仅供参考，实际以称重为准。 */
export function capsuleFillEstimate(size: CapsuleSize, sel: SaltSelection): CapsuleFillEstimate | null {
  const volumeMl = CAPSULE_VOLUME_ML[size];
  const f = saltSodiumFraction(sel.salt, sel.labelSodiumMgPer100g);
  if (volumeMl === undefined || f === null) return null;
  const saltMgLow = volumeMl * SALT_BULK_DENSITY.low * 1000;
  const saltMgHigh = volumeMl * SALT_BULK_DENSITY.high * 1000;
  return { volumeMl, saltMgLow, saltMgHigh, sodiumMgLow: saltMgLow * f, sodiumMgHigh: saltMgHigh * f };
}

// ───────────────────────── 汗钠流失 ─────────────────────────

/**
 * 全身汗钠浓度参考，mmol/L。mean：Baker 2016（J Sports Sci，506 名运动员，预测全身 35.9±10.4，范围 18.2–70.8）；
 * low/high：Baker 2017（Sports Med 综述）全身汗钠约 10–70 mmol/L。
 */
export const SWEAT_SODIUM_MMOL_PER_L = { low: 10, mean: 35.9, high: 70 } as const;
/** Baker 2017：全身出汗率通常 ~0.5–2.0 L/h，>3 L/h 少见。 */
export const TYPICAL_SWEAT_RATE_L_PER_H = { low: 0.5, high: 2.0 } as const;
const MAX_SWEAT_RATE_L_PER_H = 6;
const MAX_SWEAT_NA_MMOL_PER_L = 150;

export interface SodiumRate {
  mgPerHour: number;
  mmolPerHour: number;
}

/** 汗钠流失 = 出汗率 × 汗钠浓度 × 22.99。只是流失量，不是「必须补回」的处方。 */
export function sweatSodiumLoss(sweatLPerHour: number, sweatNaMmolPerL: number): SodiumRate | null {
  if (!isPos(sweatLPerHour) || sweatLPerHour > MAX_SWEAT_RATE_L_PER_H) return null;
  if (!isPos(sweatNaMmolPerL) || sweatNaMmolPerL > MAX_SWEAT_NA_MMOL_PER_L) return null;
  const mmolPerHour = sweatLPerHour * sweatNaMmolPerL;
  return { mgPerHour: mmolPerHour * MW_NA, mmolPerHour };
}

/** 不知道自己汗钠浓度时，用文献低 / 均值 / 高给出范围（mg/h）。 */
export function sweatSodiumLossRange(sweatLPerHour: number): { low: number; mean: number; high: number } | null {
  const low = sweatSodiumLoss(sweatLPerHour, SWEAT_SODIUM_MMOL_PER_L.low);
  const mean = sweatSodiumLoss(sweatLPerHour, SWEAT_SODIUM_MMOL_PER_L.mean);
  const high = sweatSodiumLoss(sweatLPerHour, SWEAT_SODIUM_MMOL_PER_L.high);
  if (low === null || mean === null || high === null) return null;
  return { low: low.mgPerHour, mean: mean.mgPerHour, high: high.mgPerHour };
}

/** 补回流失量的某一比例（0–1，由用户显式选择）所需每小时胶囊数。 */
export function capsulesPerHour(args: {
  lossMgPerHour: number;
  replaceFraction: number;
  sodiumMgPerCapsule: number;
}): number | null {
  if (!isNonNeg(args.lossMgPerHour) || !isPos(args.sodiumMgPerCapsule)) return null;
  if (!isNonNeg(args.replaceFraction) || args.replaceFraction > 1) return null;
  return finiteOrNull((args.lossMgPerHour * args.replaceFraction) / args.sodiumMgPerCapsule);
}

// ───────────────────────── 饮料钠浓度 ─────────────────────────

/** ACSM 2007 引 IOM：运动饮料钠 ~20–30 mEq/L（Na⁺ 一价，mEq = mmol），即约 460–690 mg/L。 */
export const ACSM_DRINK_SODIUM_MMOL_PER_L = { low: 20, high: 30 } as const;

export interface DrinkSodium {
  mgPerL: number;
  mmolPerL: number;
  vsAcsm: "below" | "within" | "above";
}

export function drinkSodium(sodiumMg: number, volumeL: number): DrinkSodium | null {
  if (!isNonNeg(sodiumMg) || !isPos(volumeL)) return null;
  const mgPerL = sodiumMg / volumeL;
  const mmolPerL = mgPerL / MW_NA;
  if (!Number.isFinite(mmolPerL)) return null;
  const vsAcsm =
    mmolPerL < ACSM_DRINK_SODIUM_MMOL_PER_L.low ? "below" : mmolPerL > ACSM_DRINK_SODIUM_MMOL_PER_L.high ? "above" : "within";
  return { mgPerL, mmolPerL, vsAcsm };
}

/** 目标饮料钠浓度 mmol/L × 体积 → 盐克数。 */
export function saltGramsForDrink(args: { targetMmolPerL: number; volumeL: number } & SaltSelection): number | null {
  if (!isNonNeg(args.targetMmolPerL) || !isPos(args.volumeL)) return null;
  return saltGramsForSodium(args.targetMmolPerL * args.volumeL * MW_NA, args);
}
