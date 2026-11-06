import { initTheme } from "./theme";
import { initSeo } from "./seo";
import { clearPersisted } from "./lib/dom";

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
  | "durability"
  | "load";

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
  { id: "load", href: "./load.html", label: "训练负荷" },
];

const SINGLE_COLUMN = "(max-width: 860px)";

function initClearData(): void {
  const footer = document.querySelector(".site-footer");
  if (!(footer instanceof HTMLElement)) return;
  if (footer.querySelector(".clear-data")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "clear-data";
  button.textContent = "清除已记住的数据";
  button.title = "清除本机记住的年龄、性别、体重、身高与心率";
  button.addEventListener("click", () => {
    clearPersisted();
    window.location.reload();
  });
  footer.appendChild(button);
}

// On a single-column layout the results panel sits below every input block, so a
// live update is easy to miss; offer a jump while results exist but are off-screen below.
function initResultsJump(): void {
  const results = document.querySelector(".workbench .panel.results");
  if (!(results instanceof HTMLElement)) return;
  const empty = results.querySelector(".result-empty");
  if (!(empty instanceof HTMLElement)) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "results-jump";
  button.textContent = "查看结果 ↓";
  button.hidden = true;
  document.body.appendChild(button);

  const singleColumn = window.matchMedia(SINGLE_COLUMN);
  // Read the position on every scroll: an IntersectionObserver never fires when a fast
  // fling or anchor jump skips from "below" to "above" without the panel intersecting.
  const update = (): void => {
    const resultsBelow = results.getBoundingClientRect().top >= window.innerHeight;
    button.hidden = !(singleColumn.matches && resultsBelow && empty.hidden);
  };
  let frame = 0;
  const scheduleUpdate = (): void => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };

  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  new MutationObserver(update).observe(empty, { attributes: true, attributeFilter: ["hidden"] });
  singleColumn.addEventListener("change", update);
  update();

  button.addEventListener("click", () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    results.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    if (!results.hasAttribute("tabindex")) results.tabIndex = -1;
    results.focus({ preventScroll: true });
  });
}

export function initChrome(current: PageId): void {
  const nav = document.querySelector(".site-nav");
  if (nav instanceof HTMLElement) {
    nav.innerHTML = LINKS.map((link) => {
      const currentAttr = link.id === current ? ' aria-current="page"' : "";
      return `<a href="${link.href}"${currentAttr}>${link.label}</a>`;
    }).join("");
  }
  initTheme();
  initSeo();
  initClearData();
  initResultsJump();
}
