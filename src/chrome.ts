import { initTheme } from "./theme";

export type PageId =
  | "home"
  | "hr"
  | "threshold"
  | "vo2"
  | "nodevice"
  | "function"
  | "strength"
  | "critical"
  | "fuel"
  | "durability";

const LINKS: { id: PageId; href: string; label: string }[] = [
  { id: "hr", href: "./hr.html", label: "心率" },
  { id: "threshold", href: "./threshold.html", label: "阈值" },
  { id: "vo2", href: "./vo2.html", label: "VO₂max" },
  { id: "nodevice", href: "./nodevice.html", label: "无设备" },
  { id: "function", href: "./function.html", label: "功能" },
  { id: "strength", href: "./strength.html", label: "力量" },
  { id: "critical", href: "./critical.html", label: "临界" },
  { id: "fuel", href: "./fuel.html", label: "供能" },
  { id: "durability", href: "./durability.html", label: "脱耦联" },
];

export function initChrome(current: PageId): void {
  const nav = document.querySelector(".site-nav");
  if (nav instanceof HTMLElement) {
    nav.innerHTML = LINKS.map((link) => {
      const currentAttr = link.id === current ? ' aria-current="page"' : "";
      return `<a href="${link.href}"${currentAttr}>${link.label}</a>`;
    }).join("");
  }
  initTheme();
}
