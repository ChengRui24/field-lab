const STORAGE_KEY = "field-lab-theme";

type Theme = "light" | "dark";

const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

let pageChoice: Theme | null = null;

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "dark" || value === "light") return value;
  } catch {
    // Fall through to the choice made on this page view.
  }
  return pageChoice;
}

/** A manual choice wins; without one the page follows the system appearance. */
function effectiveTheme(): Theme {
  return savedTheme() ?? (systemDark.matches ? "dark" : "light");
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function labelFor(theme: Theme): string {
  return theme === "dark" ? "浅色" : "深色";
}

export function initTheme(): void {
  applyTheme(effectiveTheme());

  const header = document.querySelector(".site-header");
  if (!(header instanceof HTMLElement)) return;
  if (header.querySelector(".theme-toggle")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-toggle";
  button.textContent = labelFor(effectiveTheme());
  button.setAttribute("aria-label", "切换浅色或深色外观");
  button.addEventListener("click", () => {
    const next: Theme = effectiveTheme() === "dark" ? "light" : "dark";
    pageChoice = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Without storage the choice still applies for this page view.
    }
    applyTheme(next);
    button.textContent = labelFor(next);
  });
  systemDark.addEventListener("change", () => {
    if (savedTheme() !== null) return;
    const theme = effectiveTheme();
    applyTheme(theme);
    button.textContent = labelFor(theme);
  });
  header.appendChild(button);
}
