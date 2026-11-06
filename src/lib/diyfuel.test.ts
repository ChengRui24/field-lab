import { describe, expect, it } from "vitest";
import {
  analyzeRecipe,
  capsuleFillEstimate,
  capsuleFromWeighing,
  capsulesPerHour,
  carbTargetGrams,
  drinkSodium,
  idealOsmolality,
  maxConcentrationPct,
  NA_FRACTION_NACL,
  planRecipe,
  resolveIngredient,
  saltGramsForDrink,
  saltGramsForSodium,
  saltSodiumFraction,
  sodiumMgFromSalt,
  splitServings,
  sweatSodiumLoss,
  sweatSodiumLossRange,
} from "./diyfuel";

describe("salt sodium", () => {
  it("1 g NaCl → 393.4 mg Na", () => {
    // 22.99 / 58.44 = 0.39339 → 393.39 mg
    expect(NA_FRACTION_NACL).toBeCloseTo(0.39339, 5);
    expect(sodiumMgFromSalt(1, { salt: "refined" })).toBeCloseTo(393.4, 1);
    expect(sodiumMgFromSalt(1, { salt: "iodized" })).toBeCloseTo(393.4, 1);
  });

  it("other salts and labels", () => {
    // 22.99 / 84.01 = 0.2737
    expect(saltSodiumFraction("bicarbonate")).toBeCloseTo(0.2737, 4);
    // 3 × 22.99 / 294.10 = 0.2345
    expect(saltSodiumFraction("citrateDihydrate")).toBeCloseTo(0.2345, 4);
    // label 25,000 mg/100 g → 0.25
    expect(saltSodiumFraction("lowSodium", 25_000)).toBeCloseTo(0.25, 6);
    // 500 mg Na from refined salt: 500 / 0.39339 = 1271 mg
    expect(saltGramsForSodium(500, { salt: "refined" })).toBeCloseTo(1.271, 3);
  });

  it("low-sodium / custom salts require a label; bad labels → null", () => {
    expect(saltSodiumFraction("lowSodium")).toBeNull();
    expect(saltSodiumFraction("custom")).toBeNull();
    expect(saltSodiumFraction("custom", 0)).toBeNull();
    expect(saltSodiumFraction("custom", 393_393)).toBeNull(); // mg/kg typed by mistake
    expect(saltSodiumFraction("custom", Number.NaN)).toBeNull();
    expect(sodiumMgFromSalt(-1, { salt: "refined" })).toBeNull();
  });
});

describe("planRecipe", () => {
  it("60 g carbohydrate at 8% from sucrose → 60 g sugar + 690 g water", () => {
    // total = 60 / 0.08 = 750 g; water = 750 − 60 = 690 g
    const plan = planRecipe({ parts: [{ ingredient: "sucrose" }], carbGrams: 60, concentrationPct: 8 });
    expect(plan).not.toBeNull();
    expect(plan!.items[0].grams).toBeCloseTo(60, 6);
    expect(plan!.waterToAddGrams).toBeCloseTo(690, 6);
    expect(plan!.analysis.totalGrams).toBeCloseTo(750, 6);
    expect(plan!.analysis.kcal).toBeCloseTo(240, 6);
    expect(plan!.analysis.warnings).toEqual([]);
  });

  it("dextrose monohydrate: 66.0 g powder, water reduced by hydrate water", () => {
    // powder = 60 × 198.17 / 180.16 = 65.997 g (≈ 6.0 g hydrate water)
    // water to add = 750 − 65.997 = 684.003 g; solvent water still 690 g
    const plan = planRecipe({ parts: [{ ingredient: "dextroseMonohydrate" }], carbGrams: 60, concentrationPct: 8 });
    expect(plan!.items[0].grams).toBeCloseTo(66.0, 1);
    expect(plan!.waterToAddGrams).toBeCloseTo(684.0, 1);
    expect(plan!.analysis.solventWaterGrams).toBeCloseTo(690, 6);
  });

  it("planning exactly at 8% / 20% does not trip the limit warnings through float noise", () => {
    const mix = [
      { ingredient: "dextroseMonohydrate" as const, carbShare: 0.5 },
      { ingredient: "sucrose" as const, carbShare: 0.5 },
    ];
    for (const carbGrams of [37, 70, 200, 263]) {
      const at8 = planRecipe({ parts: mix, carbGrams, concentrationPct: 8 })!;
      expect(at8.analysis.warnings).not.toContain("aboveDrinkLimit");
      const at20 = planRecipe({ parts: mix, carbGrams, concentrationPct: 20 })!;
      expect(at20.analysis.warnings).not.toContain("concentratedTakeWithWater");
      expect(at20.analysis.osmolalityUnavailable).toBeNull();
    }
  });

  it("HFCS label 75 g/100 g (25% water) → syrup grams and reduced water", () => {
    // syrup = 60 / 0.75 = 80 g (20 g of it water); water to add = 750 − 80 = 670 g
    const plan = planRecipe({
      parts: [{ ingredient: "hfcs55", labelCarbPer100g: 75 }],
      carbGrams: 60,
      concentrationPct: 8,
    });
    expect(plan!.items[0].grams).toBeCloseTo(80, 6);
    expect(plan!.waterToAddGrams).toBeCloseTo(670, 6);
    expect(plan!.analysis.solventWaterGrams).toBeCloseTo(690, 6);
  });

  it("HFCS preset falls back to typical dry solids", () => {
    // F42 preset 71%: 60 / 0.71 = 84.51 g
    const plan = planRecipe({ parts: [{ ingredient: "hfcs42" }], carbGrams: 60, concentrationPct: 8 });
    expect(plan!.items[0].grams).toBeCloseTo(84.51, 2);
  });

  it("mixed parts split carbohydrate by share", () => {
    // 90 g carbohydrate, glucose:sucrose shares 1:1 → 45 g carb each
    // monohydrate powder = 45 / 0.90912 = 49.50 g; sucrose = 45 g
    const plan = planRecipe({
      parts: [
        { ingredient: "dextroseMonohydrate", carbShare: 1 },
        { ingredient: "sucrose", carbShare: 1 },
      ],
      carbGrams: 90,
      concentrationPct: 8,
    });
    expect(plan!.items[0].grams).toBeCloseTo(49.5, 1);
    expect(plan!.items[1].grams).toBeCloseTo(45, 6);
    // glucose 45 + 22.5 = 67.5, fructose 22.5 → 3:1
    expect(plan!.analysis.sugars!.glucoseToFructose).toBeCloseTo(3, 6);
  });

  it("concentration above what the ingredient allows → null", () => {
    expect(maxConcentrationPct([{ ingredient: "hfcs55", labelCarbPer100g: 75 }])).toBeCloseTo(75, 6);
    expect(
      planRecipe({ parts: [{ ingredient: "hfcs55", labelCarbPer100g: 75 }], carbGrams: 60, concentrationPct: 80 }),
    ).toBeNull();
  });

  it("invalid inputs → null", () => {
    const sucrose = [{ ingredient: "sucrose" as const }];
    expect(planRecipe({ parts: sucrose, carbGrams: 0, concentrationPct: 8 })).toBeNull();
    expect(planRecipe({ parts: sucrose, carbGrams: 60, concentrationPct: 0 })).toBeNull();
    expect(planRecipe({ parts: sucrose, carbGrams: 60, concentrationPct: 120 })).toBeNull();
    expect(planRecipe({ parts: sucrose, carbGrams: Number.POSITIVE_INFINITY, concentrationPct: 8 })).toBeNull();
    expect(planRecipe({ parts: [], carbGrams: 60, concentrationPct: 8 })).toBeNull();
    expect(planRecipe({ parts: [{ ingredient: "custom" }], carbGrams: 60, concentrationPct: 8 })).toBeNull();
    expect(planRecipe({ parts: [{ ingredient: "sucrose", carbShare: 0 }], carbGrams: 60, concentrationPct: 8 })).toBeNull();
    expect(resolveIngredient("hfcs42", 120)).toBeNull();
  });
});

describe("analyzeRecipe", () => {
  it("inverse: grams + water → concentration", () => {
    // 60 / (60 + 690) = 8%
    const a = analyzeRecipe({ items: [{ ingredient: "sucrose", grams: 60 }], waterGrams: 690 });
    expect(a!.concentrationPct).toBeCloseTo(8, 6);
  });

  it("osmolality: 8% glucose ≈ 483, 8% sucrose ≈ 254 mOsm/kg (ideal)", () => {
    // glucose: 80 / 180.16 = 0.44405 mol in 0.920 kg water → 482.7
    const glu = analyzeRecipe({ items: [{ ingredient: "dextroseAnhydrous", grams: 80 }], waterGrams: 920 });
    expect(glu!.osmolality!.mOsmPerKg).toBeCloseTo(482.7, 1);
    expect(glu!.osmolality!.approximate).toBe(true);
    expect(glu!.osmolality!.vsPlasma).toBe("above");
    // sucrose (intact disaccharide): 80 / 342.3 = 0.23371 mol / 0.920 kg → 254.0
    const suc = analyzeRecipe({ items: [{ ingredient: "sucrose", grams: 80 }], waterGrams: 920 });
    expect(suc!.osmolality!.mOsmPerKg).toBeCloseTo(254.0, 1);
    expect(suc!.osmolality!.vsPlasma).toBe("below");
  });

  it("monohydrate hydrate water counts as solvent", () => {
    // 88.0 g monohydrate = 80.0 g glucose + 8.0 g water; + 912 g water → 920 g solvent → same 482.7
    const grams = (80 * 198.17) / 180.16;
    const a = analyzeRecipe({ items: [{ ingredient: "dextroseMonohydrate", grams }], waterGrams: 1000 - grams });
    expect(a!.osmolality!.mOsmPerKg).toBeCloseTo(482.7, 1);
  });

  it("NaCl uses 1.86 effective particles", () => {
    // 1 g NaCl in 1 kg water: 1/58.44 × 1.86 × 1000 = 31.83 mOsm/kg
    expect(idealOsmolality({ glucoseG: 0, fructoseG: 0, sucroseG: 0, naclG: 1 }, 1000)).toBeCloseTo(31.83, 2);
  });

  it("osmolality null for unknown composition or gel-style concentration", () => {
    const custom = analyzeRecipe({ items: [{ ingredient: "custom", grams: 60, labelCarbPer100g: 95 }], waterGrams: 650 });
    expect(custom!.concentrationPct).toBeCloseTo(8.028, 3); // 57 / 710
    expect(custom!.osmolality).toBeNull();
    expect(custom!.osmolalityUnavailable).toBe("unknownComposition");
    expect(custom!.sugars).toBeNull();

    // 60 g sucrose + 40 g water = 60%
    const gel = analyzeRecipe({ items: [{ ingredient: "sucrose", grams: 60 }], waterGrams: 40 });
    expect(gel!.osmolality).toBeNull();
    expect(gel!.osmolalityUnavailable).toBe("tooConcentrated");
    expect(gel!.warnings).toEqual(["aboveDrinkLimit", "concentratedTakeWithWater"]);
  });

  it("glucose gel at 60% may not dissolve at room temperature", () => {
    // 60 g glucose / 40 g water = 1.5 g/g > 0.909
    const a = analyzeRecipe({ items: [{ ingredient: "dextroseAnhydrous", grams: 60 }], waterGrams: 40 });
    expect(a!.warnings).toContain("mayNotDissolve");
  });

  it("glucose:fructose ratios", () => {
    // sucrose only → 1:1
    const suc = analyzeRecipe({ items: [{ ingredient: "sucrose", grams: 50 }], waterGrams: 500 });
    expect(suc!.sugars!.glucoseToFructose).toBeCloseTo(1, 6);
    // 50 g glucose + 50 g sucrose → glucose 75 g, fructose 25 g → glucose:fructose 3:1
    const mix = analyzeRecipe({
      items: [
        { ingredient: "dextroseAnhydrous", grams: 50 },
        { ingredient: "sucrose", grams: 50 },
      ],
      waterGrams: 1000,
    });
    expect(mix!.sugars!.glucoseG).toBeCloseTo(75, 6);
    expect(mix!.sugars!.fructoseG).toBeCloseTo(25, 6);
    expect(mix!.sugars!.glucoseToFructose).toBeCloseTo(3, 6);
    expect(mix!.sugars!.fructoseShare).toBeCloseTo(0.25, 6);
    // glucose only → no fructose → ratio null
    const glu = analyzeRecipe({ items: [{ ingredient: "dextroseAnhydrous", grams: 50 }], waterGrams: 500 });
    expect(glu!.sugars!.glucoseToFructose).toBeNull();
  });

  it("invalid inputs → null", () => {
    expect(analyzeRecipe({ items: [], waterGrams: 500 })).toBeNull();
    expect(analyzeRecipe({ items: [{ ingredient: "sucrose", grams: -1 }], waterGrams: 500 })).toBeNull();
    expect(analyzeRecipe({ items: [{ ingredient: "sucrose", grams: 0 }], waterGrams: 500 })).toBeNull();
    expect(analyzeRecipe({ items: [{ ingredient: "sucrose", grams: 60 }], waterGrams: Number.NaN })).toBeNull();
    expect(analyzeRecipe({ items: [{ ingredient: "custom", grams: 60 }], waterGrams: 500 })).toBeNull();
    expect(idealOsmolality({ glucoseG: 10, fructoseG: 0, sucroseG: 0 }, 0)).toBeNull();
  });
});

describe("targets and portions", () => {
  it("g/h × hours and servings", () => {
    expect(carbTargetGrams(60, 3)).toBe(180);
    expect(splitServings(180, 6)).toBe(30);
    expect(carbTargetGrams(0, 3)).toBeNull();
    expect(carbTargetGrams(60, Number.NaN)).toBeNull();
    expect(splitServings(180, 0)).toBeNull();
    expect(splitServings(180, 1.5)).toBeNull();
  });
});

describe("capsules", () => {
  it("10 capsules weigh 6.0 g net → 600 mg salt → 236 mg Na each", () => {
    // 6000 mg / 10 = 600 mg; 600 × 0.39339 = 236.0 mg; / 22.99 = 10.27 mmol
    const dose = capsuleFromWeighing({ netSaltGrams: 6.0, capsuleCount: 10, salt: "refined" });
    expect(dose!.saltMgPerCapsule).toBeCloseTo(600, 6);
    expect(dose!.sodiumMgPerCapsule).toBeCloseTo(236.0, 1);
    expect(dose!.sodiumMmolPerCapsule).toBeCloseTo(10.27, 2);
  });

  it("fill estimate from volume × bulk density", () => {
    // size 00: 0.91 mL × 1.12–1.27 g/mL = 1019–1156 mg salt
    const est = capsuleFillEstimate("00", { salt: "refined" });
    expect(est!.saltMgLow).toBeCloseTo(1019.2, 1);
    expect(est!.saltMgHigh).toBeCloseTo(1155.7, 1);
    // 1019.2 × 0.39339 = 400.95 mg Na
    expect(est!.sodiumMgLow).toBeCloseTo(400.95, 1);
  });

  it("invalid → null", () => {
    expect(capsuleFromWeighing({ netSaltGrams: 6, capsuleCount: 0, salt: "refined" })).toBeNull();
    expect(capsuleFromWeighing({ netSaltGrams: 0, capsuleCount: 10, salt: "refined" })).toBeNull();
    expect(capsuleFromWeighing({ netSaltGrams: 6, capsuleCount: 10, salt: "lowSodium" })).toBeNull();
  });
});

describe("sweat sodium", () => {
  it("1.0 L/h × 40 mmol/L → 920 mg/h", () => {
    // 1.0 × 40 × 22.99 = 919.6 mg/h
    const loss = sweatSodiumLoss(1.0, 40);
    expect(loss!.mgPerHour).toBeCloseTo(919.6, 1);
    expect(loss!.mmolPerHour).toBeCloseTo(40, 6);
  });

  it("literature range", () => {
    // 1.0 L/h × (10 / 35.9 / 70) × 22.99 = 229.9 / 825.3 / 1609.3
    const r = sweatSodiumLossRange(1.0);
    expect(r!.low).toBeCloseTo(229.9, 1);
    expect(r!.mean).toBeCloseTo(825.3, 1);
    expect(r!.high).toBeCloseTo(1609.3, 1);
  });

  it("capsules per hour only for an explicit fraction", () => {
    // 919.6 × 0.5 / 236.03 = 1.948
    expect(capsulesPerHour({ lossMgPerHour: 919.6, replaceFraction: 0.5, sodiumMgPerCapsule: 236.03 })).toBeCloseTo(1.948, 3);
    expect(capsulesPerHour({ lossMgPerHour: 919.6, replaceFraction: 0, sodiumMgPerCapsule: 236 })).toBe(0);
    expect(capsulesPerHour({ lossMgPerHour: 919.6, replaceFraction: 1.2, sodiumMgPerCapsule: 236 })).toBeNull();
    expect(capsulesPerHour({ lossMgPerHour: 919.6, replaceFraction: 0.5, sodiumMgPerCapsule: 0 })).toBeNull();
  });

  it("invalid → null", () => {
    expect(sweatSodiumLoss(0, 40)).toBeNull();
    expect(sweatSodiumLoss(1, -5)).toBeNull();
    expect(sweatSodiumLoss(20, 40)).toBeNull();
    expect(sweatSodiumLoss(Number.POSITIVE_INFINITY, 40)).toBeNull();
    expect(sweatSodiumLossRange(-1)).toBeNull();
  });
});

describe("drink sodium", () => {
  it("mg/L, mmol/L and ACSM 20–30 mmol/L band", () => {
    // 393.39 mg in 0.75 L = 524.5 mg/L = 22.8 mmol/L → within
    const d = drinkSodium(393.39, 0.75);
    expect(d!.mgPerL).toBeCloseTo(524.5, 1);
    expect(d!.mmolPerL).toBeCloseTo(22.82, 2);
    expect(d!.vsAcsm).toBe("within");
    expect(drinkSodium(200, 1)!.vsAcsm).toBe("below"); // 8.7 mmol/L
    expect(drinkSodium(800, 1)!.vsAcsm).toBe("above"); // 34.8 mmol/L
  });

  it("salt grams for a target concentration", () => {
    // 25 mmol/L × 0.75 L = 18.75 mmol NaCl × 58.44 = 1095.75 mg salt
    expect(saltGramsForDrink({ targetMmolPerL: 25, volumeL: 0.75, salt: "refined" })).toBeCloseTo(1.09575, 5);
  });

  it("invalid → null", () => {
    expect(drinkSodium(500, 0)).toBeNull();
    expect(drinkSodium(-1, 1)).toBeNull();
    expect(saltGramsForDrink({ targetMmolPerL: 25, volumeL: 0.75, salt: "custom" })).toBeNull();
  });
});
