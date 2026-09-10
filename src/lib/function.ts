export type Sex = "male" | "female";

export function gaitSpeedMPerSec(distanceM: number, timeSec: number): number | null {
  if (distanceM <= 0 || timeSec <= 0) return null;
  return distanceM / timeSec;
}

export function gaitSpeedReading(speed: number): { headline: string; note: string } {
  if (speed <= 0.8) {
    return {
      headline: "低于 0.8 m/s",
      note: "EWGSOP2 把 ≤0.8 m/s 作为低步行速度。AWGS 2019 的 6 m 常速切点是 <1.0 m/s。这是筛查，不是肌少症诊断。",
    };
  }
  if (speed < 1) {
    return {
      headline: "0.8–1.0 m/s",
      note: "未到欧洲 0.8 m/s 切点，但低于 AWGS 2019 的 1.0 m/s。社区筛查里常作为「体能偏低」注意。",
    };
  }
  return {
    headline: "≥ 1.0 m/s",
    note: "常速达到 AWGS 2019 常用的 1.0 m/s 线。单次只作参考，前后对比更有用。",
  };
}

export function chairStandReading(seconds: number): { headline: string; note: string } {
  if (seconds >= 15) {
    return {
      headline: "≥ 15 秒",
      note: "同时超过 AWGS 2019（≥12 秒）和 EWGSOP2（>15 秒）的 5 次起坐切点。反映下肢力量/功率偏低，不是诊断。",
    };
  }
  if (seconds >= 12) {
    return {
      headline: "12–15 秒",
      note: "达到 AWGS 2019 低体能表现切点（≥12 秒），尚未到 EWGSOP2 的 >15 秒。亚洲人群筛查更常看 12 秒。",
    };
  }
  return {
    headline: "< 12 秒",
    note: "未到 AWGS 2019 的 5 次起坐切点。动作必须站直、坐实，手臂交叉在胸前。",
  };
}

export function tugReading(seconds: number): { headline: string; note: string } {
  if (seconds >= 12) {
    return {
      headline: "≥ 12 秒",
      note: "CDC STEADI 把社区老年人 ≥12 秒当作跌倒风险筛查注意线，不是医学诊断。受椅高、是否用手、场地影响。",
    };
  }
  return {
    headline: "< 12 秒",
    note: "未到 CDC STEADI 常用的 12 秒筛查线。仍应结合步态、力量和跌倒史看。",
  };
}

export function gripReading(kg: number, sex: Sex): { headline: string; note: string } {
  const awgs = sex === "male" ? 28 : 18;
  const ewg = sex === "male" ? 27 : 16;
  if (kg < ewg) {
    return {
      headline: `低于 ${ewg} kg`,
      note: `同时低于 AWGS 2019（${sex === "male" ? "男 <28" : "女 <18"} kg）和 EWGSOP2（${
        sex === "male" ? "男 <27" : "女 <16"
      } kg）。这是肌力筛查切点；确诊肌少症还需要肌量。`,
    };
  }
  if (kg < awgs) {
    return {
      headline: `${ewg}–${awgs} kg`,
      note: `达到 AWGS 2019 切点（${sex === "male" ? "男 <28" : "女 <18"} kg），尚未到 EWGSOP2（${
        sex === "male" ? "男 <27" : "女 <16"
      } kg）。亚洲筛查优先看 AWGS。`,
    };
  }
  return {
    headline: `≥ ${awgs} kg`,
    note: `未到 AWGS 2019 握力切点。用校准握力计，取两次较好值。`,
  };
}
