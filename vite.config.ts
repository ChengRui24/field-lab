import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import {
  PAGES,
  REPO_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_ORIGIN,
  pageUrl,
  type SitePage,
} from "./src/site";

const root = fileURLToPath(new URL(".", import.meta.url));
const LASTMOD = new Date().toISOString().slice(0, 10);
const OG_IMAGE = `${SITE_ORIGIN}/og.png`;

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function seoPlugin(): Plugin {
  return {
    name: "field-lab-seo",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        if (html.includes('property="og:image"')) return html;
        const file = ctx.filename.split("/").pop() ?? "";
        const page = PAGES.find((item) => item.file === file);
        const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? SITE_NAME;
        const description =
          html.match(/<meta\s[^>]*name="description"[^>]*content="([^"]*)"/s)?.[1]?.trim() ??
          SITE_DESCRIPTION;
        const url =
          html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/)?.[1] ??
          (page ? pageUrl(page.path) : `${SITE_ORIGIN}/`);
        const withCard = html.replace(
          '<meta name="twitter:card" content="summary" />',
          '<meta name="twitter:card" content="summary_large_image" />',
        );
        const block = renderHead({ page, title, description, url });
        return withCard.replace(/\n\s*<\/head>/, `\n${block}\n  </head>`);
      },
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: renderSitemap(),
      });
    },
  };
}

function renderHead(input: {
  page: SitePage | undefined;
  title: string;
  description: string;
  url: string;
}): string {
  const crumbs =
    input.page?.path === "/"
      ? [{ name: "Field Lab", item: pageUrl("/") }]
      : [
          { name: "Field Lab", item: pageUrl("/") },
          { name: input.page?.name ?? input.title, item: input.url },
        ];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_ORIGIN}/#website`,
        name: "Field Lab",
        alternateName: "训练测算",
        url: `${SITE_ORIGIN}/`,
        inLanguage: "zh-CN",
        description: SITE_DESCRIPTION,
        sameAs: [REPO_URL],
      },
      {
        "@type": "WebPage",
        "@id": input.url,
        url: input.url,
        name: input.title,
        description: input.description,
        inLanguage: "zh-CN",
        dateModified: LASTMOD,
        isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
        primaryImageOfPage: { "@type": "ImageObject", url: OG_IMAGE },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: crumb.item,
        })),
      },
    ],
  };
  const json = JSON.stringify(structuredData).replace(/</g, "\\u003c");
  const tags = [
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeAttr(SITE_NAME)}" />`,
    `<meta name="twitter:title" content="${escapeAttr(input.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(input.description)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
    `<meta name="twitter:image:alt" content="${escapeAttr(SITE_NAME)}" />`,
    `<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />`,
    `<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />`,
    `<link rel="alternate" hreflang="zh-CN" href="${input.url}" />`,
    `<link rel="alternate" hreflang="x-default" href="${input.url}" />`,
    `<link rel="icon" href="${SITE_ORIGIN}/favicon.svg" type="image/svg+xml" />`,
    `<link rel="icon" href="${SITE_ORIGIN}/favicon-48.png" type="image/png" sizes="48x48" />`,
    `<link rel="apple-touch-icon" href="${SITE_ORIGIN}/apple-touch-icon.png" />`,
    `<script type="application/ld+json">${json}</script>`,
  ];
  return tags.map((tag) => `    ${tag}`).join("\n");
}

function renderSitemap(): string {
  const urls = PAGES.map((page) => {
    const loc = pageUrl(page.path);
    return [
      "  <url>",
      `    <loc>${loc}</loc>`,
      `    <lastmod>${LASTMOD}</lastmod>`,
      `    <priority>${page.priority}</priority>`,
      "  </url>",
    ].join("\n");
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    ``,
  ].join("\n");
}

export default defineConfig({
  base: "./",
  plugins: [seoPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        hr: resolve(root, "hr.html"),
        threshold: resolve(root, "threshold.html"),
        critical: resolve(root, "critical.html"),
        vo2: resolve(root, "vo2.html"),
        nodevice: resolve(root, "nodevice.html"),
        strength: resolve(root, "strength.html"),
        fuel: resolve(root, "fuel.html"),
        function: resolve(root, "function.html"),
        durability: resolve(root, "durability.html"),
      },
    },
  },
});
