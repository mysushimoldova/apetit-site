import { test, type Page } from "@playwright/test";

// Скриншоты движка: фон в меню (телефон и компьютер) и панель настройки.
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
    path: `docs/screens/07-fundal-${testInfo.project.name}.png`,
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
  await page.screenshot({ path: "docs/screens/07-panou-1280.png" });
});
