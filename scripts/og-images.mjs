// Собирает картинки для соцсетей (Open Graph / Twitter, 1200×630) в
// public/og/: общую apetit.png и по одной на город. Снимает макет /dev/og
// (src/components/dev/og-card.tsx) в Chromium через Playwright — так текст
// набран настоящими шрифтами сайта, а линии — той же формулой, что фон.
//
// Запуск: сначала `npm run dev`, затем `npm run og`.
// Картинки — обычные файлы в git; пересобирать только когда меняется макет.
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.OG_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = new URL("../public/og/", import.meta.url);
const CITIES = ["soroca", "sculeni", "otaci", "briceni"];

async function snap(page, query, file) {
  await page.goto(`${BASE_URL}/dev/og${query}`);
  await page.locator("canvas[data-ready]").waitFor({ state: "attached" });
  await page.evaluate(() => document.fonts.ready);
  const card = page.locator("[data-og-card]");
  await card.screenshot({ path: fileURLToPath(new URL(file, OUT_DIR)) });
  console.log(`✓ public/og/${file}`);
}

const browser = await chromium.launch();
try {
  await mkdir(OUT_DIR, { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const check = await page.goto(`${BASE_URL}/dev/og`);
  if (!check || check.status() !== 200) {
    throw new Error(
      `/dev/og отвечает ${check?.status()} — запусти dev-сервер (npm run dev)`,
    );
  }
  await snap(page, "", "apetit.png");
  for (const city of CITIES) await snap(page, `?city=${city}`, `${city}.png`);
} finally {
  await browser.close();
}
