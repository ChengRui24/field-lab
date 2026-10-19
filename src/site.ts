export const SITE_ORIGIN = "https://chengrui24.github.io/field-lab";
export const SITE_NAME = "Field Lab · 训练测算";
export const SITE_DESCRIPTION =
  "文献现场估算工具：心率分区、乳酸阈配速、VO₂max、1RM、临界功率与出汗率。同一页给出公式、精度和适用边界，不是实验室诊断。";
export const REPO_URL = "https://github.com/ChengRui24/field-lab";

export type SitePage = {
  file: string;
  path: string;
  name: string;
  priority: string;
};

export const PAGES: readonly SitePage[] = [
  { file: "index.html", path: "/", name: "训练测算", priority: "1.0" },
  { file: "hr.html", path: "/hr.html", name: "心率与分区", priority: "0.8" },
  { file: "threshold.html", path: "/threshold.html", name: "阈值与配速", priority: "0.8" },
  { file: "vo2.html", path: "/vo2.html", name: "VO₂max", priority: "0.8" },
  { file: "nodevice.html", path: "/nodevice.html", name: "无设备对照", priority: "0.8" },
  { file: "durability.html", path: "/durability.html", name: "心率脱耦联", priority: "0.8" },
  { file: "function.html", path: "/function.html", name: "步行与基础功能", priority: "0.8" },
  { file: "strength.html", path: "/strength.html", name: "1RM 与负荷", priority: "0.8" },
  { file: "critical.html", path: "/critical.html", name: "临界功率与临界速度", priority: "0.8" },
  { file: "fuel.html", path: "/fuel.html", name: "供能、补剂与出汗率", priority: "0.8" },
];

export function pageUrl(path: string): string {
  return path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;
}

export function ogImageUrl(): string {
  return `${SITE_ORIGIN}/og.png`;
}
