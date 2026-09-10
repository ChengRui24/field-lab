const STORAGE_KEY = "field-lab-theme";

type Theme = "light" | "dark";

function storedTheme(): Theme {
  return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function labelFor(theme: Theme): string {
  return theme === "dark" ? "浅色" : "深色";
}

export function initTheme(): void {
  applyTheme(storedTheme());

  const header = document.querySelector(".site-header");
  if (!(header instanceof HTMLElement)) return;
  if (header.querySelector(".theme-toggle")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-toggle";
  button.textContent = labelFor(storedTheme());
  button.setAttribute("aria-label", "切换浅色或深色外观");
  button.addEventListener("click", () => {
    const next: Theme = storedTheme() === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    button.textContent = labelFor(next);
  });
  header.appendChild(button);
}
