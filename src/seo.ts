export const SITE_ORIGIN = "https://chengrui24.github.io/field-lab";

function canonicalPath(): string {
  const file = window.location.pathname.split("/").pop() ?? "";
  if (file === "" || file === "index.html") return "/";
  return `/${file}`;
}

function canonicalUrl(): string {
  const path = canonicalPath();
  return path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;
}

function upsertMeta(attr: "name" | "property", key: string, content: string): void {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector(selector);
  if (!(el instanceof HTMLMetaElement)) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!(el instanceof HTMLLinkElement)) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function initSeo(): void {
  const url = canonicalUrl();
  const title = document.title;
  const desc =
    document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";

  upsertLink("canonical", url);
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", desc);
  upsertMeta("property", "og:url", url);
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:locale", "zh_CN");
  upsertMeta("property", "og:site_name", "Field Lab · 训练测算");
  upsertMeta("name", "twitter:card", "summary");
}