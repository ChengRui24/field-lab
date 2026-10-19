import { readdirSync, readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const ORIGIN = "https://chengrui24.github.io/field-lab";
const HOST = "chengrui24.github.io";

const keyFile = readdirSync("public").find((name) => /^[a-f0-9-]{8,128}\.txt$/i.test(name));
if (!keyFile) {
  console.error("public/ is missing an IndexNow key file");
  process.exit(1);
}

const key = readFileSync(`public/${keyFile}`, "utf8").trim();
const keyLocation = `${ORIGIN}/${keyFile}`;

async function fetchText(url) {
  const response = await fetch(url);
  return { ok: response.ok, status: response.status, text: (await response.text()).trim() };
}

async function waitFor(url, accept) {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const result = await fetchText(url);
      if (accept(result)) return result;
      console.log(`${url} not ready (${result.status}), attempt ${attempt}`);
    } catch (error) {
      console.log(`${url} not ready (${error}), attempt ${attempt}`);
    }
    await sleep(15_000);
  }
  return null;
}

const keyReady = await waitFor(keyLocation, (result) => result.ok && result.text === key);
if (!keyReady) {
  console.warn("IndexNow key is not reachable yet. Notification skipped.");
  process.exit(0);
}

const sitemap = await waitFor(
  `${ORIGIN}/sitemap.xml`,
  (result) => result.ok && result.text.includes("<loc>"),
);
if (!sitemap) {
  console.warn("Sitemap is not reachable yet. Notification skipped.");
  process.exit(0);
}

const urlList = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key, keyLocation, urlList }),
});
const body = await response.text();
console.log(`IndexNow ${response.status} for ${urlList.length} URLs`);
if (body) console.log(body);
if (response.status !== 200 && response.status !== 202) process.exit(1);
