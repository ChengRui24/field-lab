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

// Same order as the home-page cards (and its ItemList structured data).
const LINKS: { id: PageId; href: string; label: string }[] = [
  { id: "home", href: "./index.html", label: "首页" },
  { id: "hr", href: "./hr.html", label: "心率" },
  { id: "threshold", href: "./threshold.html", label: "阈值" },
  { id: "vo2", href: "./vo2.html", label: "VO₂max" },
  { id: "nodevice", href: "./nodevice.html", label: "无设备" },
  { id: "durability", href: "./durability.html", label: "脱耦联" },
  { id: "function", href: "./function.html", label: "功能" },
  { id: "strength", href: "./strength.html", label: "力量" },
  { id: "critical", href: "./critical.html", label: "临界" },
  { id: "fuel", href: "./fuel.html", label: "供能" },
  { id: "load", href: "./load.html", label: "训练负荷" },
];

const SINGLE_COLUMN = "(max-width: 860px)";

// On phones the nav is one scrollable row; start it with the current page visible.
function initNavScroll(nav: HTMLElement): void {
  const markMore = (): void => {
    nav.toggleAttribute("data-more-end", nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2);
  };
  const current = nav.querySelector('[aria-current="page"]');
  if (current instanceof HTMLElement && nav.scrollWidth > nav.clientWidth) {
    const navBox = nav.getBoundingClientRect();
    const itemBox = current.getBoundingClientRect();
    const offset = itemBox.left - navBox.left + nav.scrollLeft;
    nav.scrollLeft = Math.max(0, offset - (nav.clientWidth - itemBox.width) / 2);
  }
  markMore();
  nav.addEventListener("scroll", markMore, { passive: true });
  window.addEventListener("resize", markMore);
}

const CLEAR_SCOPE = "年龄、性别、体重、身高、心率等个人资料；不清训练负荷记录";

function initClearData(): void {
  const footer = document.querySelector(".site-footer");
  if (!(footer instanceof HTMLElement)) return;
  if (footer.querySelector(".clear-data")) return;

  const group = document.createElement("div");
  group.className = "clear-data-group";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "clear-data";
  button.textContent = "清除本机记住的个人资料";
  button.title = `清除${CLEAR_SCOPE}`;

  const scope = document.createElement("span");
  scope.className = "clear-data-scope";
  scope.id = "clear-data-scope";
  scope.textContent = CLEAR_SCOPE;
  button.setAttribute("aria-describedby", scope.id);

  const status = document.createElement("span");
  status.className = "clear-data-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  let timer = 0;
  button.addEventListener("click", () => {
    clearPersisted();
    status.textContent = "已清除";
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      status.textContent = "";
    }, 4000);
  });
  group.append(button, status, scope);
  footer.appendChild(group);
}

function isEditingField(el: Element | null): boolean {
  if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) return el.closest("form") !== null;
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.type === "radio" || el.type === "checkbox" || el.type === "button") return false;
  return el.closest("form") !== null;
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
  // While a field is being edited the floating button would sit over the inputs (and the
  // on-screen keyboard shrinks the viewport), so it stays out of the way until focus leaves.
  const update = (): void => {
    const resultsBelow = results.getBoundingClientRect().top >= window.innerHeight;
    const editing = isEditingField(document.activeElement);
    button.hidden = !(singleColumn.matches && resultsBelow && empty.hidden && !editing);
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
  document.addEventListener("focusin", scheduleUpdate);
  document.addEventListener("focusout", scheduleUpdate);
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
    initNavScroll(nav);
  }
  initTheme();
  initSeo();
  initClearData();
  initResultsJump();
}
