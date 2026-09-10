export function caffeineDose(weightKg: number): { low: number; high: number } {
  return { low: 3 * weightKg, high: 6 * weightKg };
}

export function proteinDose(weightKg: number): { endurance: { low: number; high: number }; hypertrophy: { low: number; high: number } } {
  return {
    endurance: { low: 1.2 * weightKg, high: 1.6 * weightKg },
    hypertrophy: { low: 1.6 * weightKg, high: 2.2 * weightKg },
  };
}

export function creatineDose(weightKg: number): { loading: number; maintenanceLow: number; maintenanceHigh: number } {
  return {
    loading: 0.3 * weightKg,
    maintenanceLow: 3,
    maintenanceHigh: 5,
  };
}

export type CarbSession = "short" | "endurance" | "ultra";

export function carbDuring(session: CarbSession): { low: number; high: number; note: string } {
  switch (session) {
    case "short":
      return { low: 0, high: 0, note: "不足约 60 分钟通常不必在运动中额外补糖，靠日常饮食即可" };
    case "endurance":
      return { low: 30, high: 60, note: "约 1–2.5 小时：30–60 g/h。ISSN 运动营养立场" };
    case "ultra":
      return { low: 60, high: 90, note: "超过约 2.5 小时：60–90 g/h，需多种可转运碳水（葡萄糖+果糖）" };
    default: {
      const exhaustive: never = session;
      throw new Error(`未处理的训练时长: ${String(exhaustive)}`);
    }
  }
}

export type CarbDay = "light" | "moderate" | "high" | "veryHigh";

export function carbDaily(weightKg: number, day: CarbDay): { low: number; high: number; note: string } {
  switch (day) {
    case "light":
      return { low: 3 * weightKg, high: 5 * weightKg, note: "低训练量或休息日" };
    case "moderate":
      return { low: 5 * weightKg, high: 7 * weightKg, note: "约每天 1 小时中等训练" };
    case "high":
      return { low: 6 * weightKg, high: 10 * weightKg, note: "每天 1–3 小时" };
    case "veryHigh":
      return { low: 8 * weightKg, high: 12 * weightKg, note: "极量耐力日，ISSN：8–12 g/kg 以维持肌糖原" };
    default: {
      const exhaustive: never = day;
      throw new Error(`未处理的日训练量: ${String(exhaustive)}`);
    }
  }
}

export function sweatRateLitersPerHour(args: {
  preKg: number;
  postKg: number;
  fluidL: number;
  urineL: number;
  hours: number;
}): number {
  const loss = args.preKg - args.postKg + args.fluidL - args.urineL;
  return loss / args.hours;
}
