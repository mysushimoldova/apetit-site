import { test } from "@playwright/test";

// Первый экран меню Сорок — как макет docs/mock-meniu-soroca-390.png.
test("скриншот меню", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/soroca");
  await page.locator("main img").first().waitFor();
  // Дождаться, пока загрузятся фото первого экрана
  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter((img) => img.getBoundingClientRect().top < window.innerHeight)
      .every((img) => img.complete && img.naturalWidth > 0),
  );
  // Значок «N» dev-режима Next — не часть сайта
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  await page.screenshot({
    path: `docs/screens/03-meniu-${testInfo.project.name}.png`,
    fullPage: false,
  });
});
