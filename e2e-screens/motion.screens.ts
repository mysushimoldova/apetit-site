import { test, type Page } from "@playwright/test";
import { PAGE_BACKGROUNDS } from "../src/motion/config-schema";
import { pageThemeVars } from "../src/lib/page-theme";

// Скриншоты движка: фон в меню (телефон и компьютер), панель настройки и
// четыре варианта цвета фона страницы.
// Запуск: npm run screens -- motion

/** Значок «N» dev-режима Next — не часть сайта. */
async function hideNextBadge(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
}

async function openMenu(page: Page) {
  await page.goto("/soroca");
  await page.locator("main img").first().waitFor();
  // Фото первого экрана загружены
  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter((img) => img.getBoundingClientRect().top < window.innerHeight)
      .every((img) => img.complete && img.naturalWidth > 0),
  );
  // Движок подключается после показа страницы — ждём первый кадр
  await page
    .locator("canvas.motion-canvas[data-ready]")
    .waitFor({ state: "attached" });
  await hideNextBadge(page);
  // Дать закончиться проявлению холста и появлению плиток
  await page.waitForTimeout(600);
}

test("фон меню", async ({ page }, testInfo) => {
  await openMenu(page);
  await page.screenshot({
    path: `docs/screens/09-fundal-${testInfo.project.name}.png`,
  });
});

test("панель настройки движения", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "1280", "панель — только для компьютера");
  await page.goto("/dev/motion");
  await page
    .frameLocator('iframe[title="Меню Сорок"]')
    .locator("canvas.motion-canvas[data-ready]")
    .waitFor({ state: "attached" });
  await hideNextBadge(page);
  // Значок «N» есть и внутри рамки — это тоже страница dev-сервера
  const frame = page.frames().find((f) => f.url().endsWith("/soroca"));
  await frame?.addStyleTag({ content: "nextjs-portal { display: none }" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "docs/screens/09-panou-1280.png" });
});

// Четыре варианта цвета фона на выбор Амяну (задача 09, пункт 2). В файле
// сохранён вариант A — остальные ставим те же переменные CSS, что поставил бы
// корневой layout, и снимаем меню.
for (const [hex, letter] of Object.entries(PAGE_BACKGROUNDS)) {
  test(`фон страницы ${letter}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "390", "выбор — на телефоне");
    await openMenu(page);
    await page.evaluate((vars) => {
      for (const [name, value] of Object.entries(vars)) {
        document.documentElement.style.setProperty(name, value);
      }
    }, pageThemeVars(hex));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `docs/screens/09-fon-${letter}-390.png` });
  });
}
