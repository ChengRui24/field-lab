import { SITE_NAME, SITE_ORIGIN, ogImageUrl } from "./site";

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
  const found = document.head.querySelector(`link[rel="${rel}"]`);
  const el = found instanceof HTMLLinkElement ? found : document.createElement("link");
  if (!(found instanceof HTMLLinkElement)) {
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
  const image = ogImageUrl();

  upsertLink("canonical", url);
  upsertMeta("name", "robots", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", desc);
  upsertMeta("property", "og:url", url);
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:locale", "zh_CN");
  upsertMeta("property", "og:site_name", SITE_NAME);
  upsertMeta("property", "og:image", image);
  upsertMeta("property", "og:image:alt", SITE_NAME);
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", desc);
  upsertMeta("name", "twitter:image", image);
}
